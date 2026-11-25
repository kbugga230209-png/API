// verify-payment — server-side confirmation of a one-time payment.
//
// Never trust the client: this recomputes the Razorpay signature, then re-reads
// the payment and the order from the Razorpay API to confirm amount, currency and
// captured status before granting Plus.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const EXPECTED_PAISE = 4900;
const PERIOD_DAYS = 30;
const GRACE_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthenticated' }, 401);
  const user = userData.user;

  if (!keyId || !keySecret) {
    return json({ error: 'razorpay_not_configured', message: 'Razorpay keys are missing. Nothing was verified or unlocked.' }, 503);
  }

  let payload: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: 'missing_fields' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Signature over "order_id|payment_id".
  const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!timingSafeEqual(expected, razorpay_signature)) {
    return json({ error: 'signature_mismatch' }, 400);
  }

  // 2. The order must exist, belong to this user and match the price.
  const { data: localPayment } = await admin
    .from('payments')
    .select('id, user_id, amount_paise, status, provider_order_id')
    .eq('provider_order_id', razorpay_order_id)
    .maybeSingle();
  if (!localPayment || localPayment.user_id !== user.id) {
    return json({ error: 'order_not_found' }, 404);
  }

  const auth = btoa(`${keyId}:${keySecret}`);
  const [paymentRes, orderRes] = await Promise.all([
    fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    }),
    fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    }),
  ]);
  const payment = (await paymentRes.json()) as {
    order_id?: string; status?: string; amount?: number; currency?: string; method?: string;
  };
  const order = (await orderRes.json()) as { amount?: number; currency?: string; status?: string };

  if (!paymentRes.ok) return json({ error: 'payment_lookup_failed', detail: payment }, 502);
  if (payment.order_id !== razorpay_order_id) return json({ error: 'order_mismatch' }, 400);
  if (payment.status !== 'captured') return json({ error: 'payment_not_captured', status: payment.status }, 409);
  if (payment.amount !== EXPECTED_PAISE || order.amount !== EXPECTED_PAISE) {
    return json({ error: 'amount_mismatch' }, 400);
  }
  if (payment.currency !== 'INR' || order.currency !== 'INR') return json({ error: 'currency_mismatch' }, 400);

  // 3. Idempotent write: a replayed verify call must not extend access twice.
  const now = new Date();
  const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 86_400_000);
  const graceUntil = new Date(periodEnd.getTime() + GRACE_DAYS * 86_400_000);

  const { data: updated, error: updateError } = await admin
    .from('payments')
    .update({
      status: 'captured',
      provider_payment_id: razorpay_payment_id,
      signature_verified: true,
      verified_at: now.toISOString(),
      notes: { method: payment.method ?? null, order_status: order.status ?? null },
    })
    .eq('id', localPayment.id)
    .neq('status', 'captured')
    .select('id')
    .maybeSingle();

  if (updateError) return json({ error: 'persist_failed', detail: updateError.message }, 500);

  if (!updated) {
    const { data: entitlement } = await admin
      .from('entitlements')
      .select('status, plan_code, current_period_end, grace_until, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle();
    return json({ already_processed: true, entitlement });
  }

  const { data: entitlement, error: entitlementError } = await admin.rpc('apply_entitlement', {
    p_user: user.id,
    p_status: 'active',
    p_plan: 'plus_monthly',
    p_period_start: now.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_grace_until: graceUntil.toISOString(),
    p_cancel_at_period_end: false,
    p_source: 'razorpay_one_time_payment',
  });
  if (entitlementError) return json({ error: 'entitlement_failed', detail: entitlementError.message }, 500);

  return json({ verified: true, plan_code: 'plus_monthly', period_end: periodEnd.toISOString(), entitlement });
});
