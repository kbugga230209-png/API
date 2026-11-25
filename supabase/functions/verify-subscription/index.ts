// verify-subscription — reconciles a user's subscription with Razorpay after a
// checkout redirect, so the app reflects reality even if the webhook is delayed.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const GRACE_DAYS = 3;
const PLAN_DAYS: Record<string, number> = { plus_monthly: 30, plus_annual: 365 };

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
    return json({ error: 'razorpay_not_configured', message: 'Razorpay keys are missing; nothing was reconciled.' }, 503);
  }

  let subscriptionId: string | undefined;
  try {
    const body = await req.json();
    subscriptionId = typeof body?.subscription_id === 'string' ? body.subscription_id : undefined;
  } catch {
    // fall through to "most recent local subscription"
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (!subscriptionId) {
    const { data: latest } = await admin
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['created', 'authenticated', 'active', 'pending', 'halted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionId = latest?.provider_subscription_id ?? undefined;
  }
  if (!subscriptionId) return json({ error: 'no_subscription' }, 404);

  const { data: localSub } = await admin
    .from('subscriptions')
    .select('id, user_id, plan_code')
    .eq('user_id', user.id)
    .eq('provider_subscription_id', subscriptionId)
    .maybeSingle();
  if (!localSub) return json({ error: 'subscription_not_found' }, 404);

  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const sub = (await res.json()) as {
    id?: string; status?: string; current_start?: number; current_end?: number;
    cancel_at_cycle_end?: number | boolean; paid_count?: number;
  };
  if (!res.ok || !sub.id) return json({ error: 'lookup_failed', detail: sub }, 502);

  const planCode = localSub.plan_code as 'plus_monthly' | 'plus_annual';
  const now = new Date();
  const periodStart = sub.current_start ? new Date(sub.current_start * 1000) : now;
  const periodEnd = sub.current_end ? new Date(sub.current_end * 1000) : new Date(now.getTime() + (PLAN_DAYS[planCode] ?? 30) * 86_400_000);
  const grace = new Date(periodEnd.getTime() + GRACE_DAYS * 86_400_000);

  await admin
    .from('subscriptions')
    .update({
      status: sub.status ?? 'created',
      current_start: periodStart.toISOString(),
      current_end: periodEnd.toISOString(),
      grace_until: grace.toISOString(),
      cancel_at_period_end: Boolean(sub.cancel_at_cycle_end),
      raw: sub,
    })
    .eq('id', localSub.id);

  // Only a paid, authenticated mandate grants access.
  const paid = (sub.paid_count ?? 0) > 0 || sub.status === 'active';
  let status: 'active' | 'pending' | 'past_due' = 'pending';
  if (sub.status === 'active' && paid) status = 'active';
  else if (sub.status === 'pending' || sub.status === 'halted') status = 'past_due';

  const { data: entitlement } = await admin.rpc('apply_entitlement', {
    p_user: user.id,
    p_status: status,
    p_plan: planCode,
    p_period_start: periodStart.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_grace_until: grace.toISOString(),
    p_cancel_at_period_end: Boolean(sub.cancel_at_cycle_end),
    p_source: 'verify-subscription',
  });

  return json({ subscription_status: sub.status, plan_code: planCode, entitlement });
});
