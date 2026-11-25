// cancel-subscription — cancels an auto-renew mandate at the end of the paid
// cycle. Access is preserved until `current_end`; nothing is clawed back.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

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
    return json({ error: 'razorpay_not_configured', message: 'Razorpay keys are missing; cancellation cannot be sent to Razorpay.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, provider_subscription_id, status, current_end, plan_code')
    .eq('user_id', user.id)
    .in('status', ['created', 'authenticated', 'active', 'pending', 'halted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return json({ error: 'no_active_subscription' }, 404);

  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.provider_subscription_id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
  const result = (await res.json()) as { status?: string; current_end?: number; error?: { description?: string } };
  if (!res.ok) return json({ error: 'cancel_failed', detail: result }, 502);

  const periodEnd = result.current_end
    ? new Date(result.current_end * 1000)
    : sub.current_end
      ? new Date(sub.current_end)
      : new Date();

  await admin
    .from('subscriptions')
    .update({ cancel_at_period_end: true, status: result.status ?? 'active', raw: result })
    .eq('id', sub.id);

  const { data: entitlement } = await admin.rpc('apply_entitlement', {
    p_user: user.id,
    p_status: 'cancelled',
    p_plan: sub.plan_code,
    p_period_end: periodEnd.toISOString(),
    p_grace_until: null,
    p_cancel_at_period_end: true,
    p_source: 'cancel-subscription',
  });

  return json({
    cancelled: true,
    access_until: periodEnd.toISOString(),
    message: 'Auto-renew is off. Plus features stay available until the end of the period you already paid for.',
    entitlement,
  });
});
