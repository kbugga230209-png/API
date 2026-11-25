// create-manual-order — one-time ₹49 order for a 30-day manual renewal.
// Razorpay Orders never create a recurring mandate, which is the whole point of
// offering this path alongside auto-renew subscriptions.

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

const MANUAL_PRICE_PAISE = 4900;
const MANUAL_DAYS = 30;

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
    return json(
      {
        error: 'razorpay_not_configured',
        message:
          'Razorpay keys are not set on this project. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as Supabase secrets. No order was created.',
      },
      503,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: canProceed } = await admin.rpc('check_rate_limit', {
    p_bucket: `create-order:${user.id}`,
    p_limit: 10,
    p_window_seconds: 3600,
  });
  if (canProceed === false) return json({ error: 'rate_limited' }, 429);

  const auth = btoa(`${keyId}:${keySecret}`);
  const receipt = `bb_${Date.now().toString(36)}_${user.id.slice(0, 8)}`;

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: MANUAL_PRICE_PAISE,
      currency: 'INR',
      receipt,
      notes: { user_id: user.id, plan_code: 'plus_monthly', kind: 'manual_cycle', days: MANUAL_DAYS },
    }),
  });
  const order = (await res.json()) as { id?: string; amount?: number; currency?: string; status?: string };
  if (!res.ok || !order.id) return json({ error: 'order_creation_failed', detail: order }, 502);

  const mode = (Deno.env.get('RAZORPAY_MODE') ?? 'test') === 'live' ? 'live' : 'test';
  const { error: insertError } = await admin.from('payments').insert({
    user_id: user.id,
    kind: 'manual_cycle',
    status: 'created',
    plan_code: 'plus_monthly',
    provider_order_id: order.id,
    amount_paise: MANUAL_PRICE_PAISE,
    currency: 'INR',
    receipt,
    test_mode: mode === 'test',
    notes: { user_id: user.id, days: MANUAL_DAYS },
  });
  if (insertError) return json({ error: 'persist_failed', detail: insertError.message }, 500);

  return json({
    order_id: order.id,
    amount_paise: MANUAL_PRICE_PAISE,
    currency: 'INR',
    key_id: keyId,
    receipt,
    mode,
    days: MANUAL_DAYS,
    note: 'One-time payment. No recurring mandate is created.',
  });
});
