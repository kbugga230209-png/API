// sync-entitlement — cheap, idempotent read of the authoritative entitlement.
// The client calls this on app resume and after any checkout return. It also
// performs the expiry sweep that a missed webhook would otherwise leave behind.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthenticated' }, 401);
  const user = userData.user;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: ent } = await admin
    .from('entitlements')
    .select('status, plan_code, current_period_start, current_period_end, grace_until, cancel_at_period_end, version, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!ent) {
    const { data: created } = await admin.rpc('apply_entitlement', {
      p_user: user.id,
      p_status: 'free',
      p_plan: 'free',
      p_source: 'sync-entitlement-bootstrap',
    });
    return json({ entitlement: created, plus_active: false, created: true });
  }

  const now = new Date();
  const end = ent.current_period_end ? new Date(ent.current_period_end) : null;
  const grace = ent.grace_until ? new Date(ent.grace_until) : null;

  // Expiry sweep: an active/past_due row whose window has closed becomes expired.
  if ((ent.status === 'active' || ent.status === 'past_due' || ent.status === 'cancelled')) {
    const deadline = ent.status === 'past_due' ? (grace ?? end) : end;
    if (deadline && deadline < now) {
      const { data: updated } = await admin.rpc('apply_entitlement', {
        p_user: user.id,
        p_status: 'expired',
        p_plan: ent.plan_code,
        p_period_end: ent.current_period_end,
        p_source: 'sync-entitlement-expiry-sweep',
      });
      return json({ entitlement: updated, plus_active: false, expired: true });
    }
  }

  const plusActive =
    ent.plan_code !== 'free' &&
    ((['active', 'cancelled'].includes(ent.status) && end !== null && end > now) ||
      (ent.status === 'past_due' && (grace ?? end) !== null && (grace ?? end)! > now));

  return json({ entitlement: ent, plus_active: plusActive });
});
