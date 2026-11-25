// create-subscription — starts a ₹49/month (or ₹399/year) Razorpay Subscriptions
// mandate. Creates a `pending` entitlement, never an active one: access is only
// granted after the mandate is authenticated and the webhook/verify call lands.

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

const PRICES: Record<string, number> = { plus_monthly: 4900, plus_annual: 39900 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthenticated' }, 401);
  const user = userData.user;

  let plan = 'plus_monthly';
  try {
    const body = await req.json();
    if (typeof body?.plan === 'string') plan = body.plan;
  } catch {
    // default plan
  }
  if (!(plan in PRICES)) return json({ error: 'invalid_plan' }, 400);

  if (!keyId || !keySecret) {
    return json(
      {
        error: 'razorpay_not_configured',
        message:
          'Razorpay keys are not set on this project. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as Supabase secrets. No subscription was created.',
      },
      503,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: canProceed } = await admin.rpc('check_rate_limit', {
    p_bucket: `create-subscription:${user.id}`,
    p_limit: 10,
    p_window_seconds: 3600,
  });
  if (canProceed === false) return json({ error: 'rate_limited' }, 429);

  const planEnvKey = plan === 'plus_monthly' ? 'RAZORPAY_PLAN_MONTHLY_ID' : 'RAZORPAY_PLAN_ANNUAL_ID';
  let planId = Deno.env.get(planEnvKey) ?? undefined;
  const mode = (Deno.env.get('RAZORPAY_MODE') ?? 'test') === 'live' ? 'live' : 'test';
  const auth = btoa(`${keyId}:${keySecret}`);

  // Without a pre-created plan id we create one. Only allowed in test mode:
  // creating plans in a live merchant account is an owner decision.
  if (!planId) {
    if (mode === 'live') {
      return json(
        {
          error: 'plan_not_configured',
          message: `${planEnvKey} is missing. Create the Razorpay plan in the dashboard and add the secret before enabling live subscriptions.`,
        },
        503,
      );
    }
    const created = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: plan === 'plus_monthly' ? 'monthly' : 'yearly',
        interval: 1,
        item: {
          name: plan === 'plus_monthly' ? 'BharatBite Plus — Monthly' : 'BharatBite Plus — Annual',
          amount: PRICES[plan],
          currency: 'INR',
          description: 'Optional premium themes and Indian diet planner. Core nutrition stays free.',
        },
        notes: { plan_code: plan },
      }),
    });
    const planJson = (await created.json()) as { id?: string; error?: unknown };
    if (!created.ok || !planJson.id) {
      return json({ error: 'plan_creation_failed', detail: planJson }, 502);
    }
    planId = planJson.id;
  }

  const created = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId,
      total_count: plan === 'plus_monthly' ? 12 : 5,
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: user.id, plan_code: plan },
    }),
  });
  const sub = (await created.json()) as {
    id?: string;
    short_url?: string;
    status?: string;
    current_end?: number | null;
    error?: { description?: string };
  };
  if (!created.ok || !sub.id) {
    return json({ error: 'subscription_creation_failed', detail: sub }, 502);
  }

  const { error: insertError } = await admin.from('subscriptions').insert({
    user_id: user.id,
    provider_subscription_id: sub.id,
    provider_plan_id: planId,
    plan_code: plan,
    status: 'created',
    short_url: sub.short_url ?? null,
    raw: sub,
  });
  if (insertError) return json({ error: 'persist_failed', detail: insertError.message }, 500);

  await admin.rpc('apply_entitlement', {
    p_user: user.id,
    p_status: 'pending',
    p_plan: plan,
    p_source: 'razorpay_subscription_created',
  });

  return json({
    subscription_id: sub.id,
    short_url: sub.short_url ?? null,
    status: sub.status ?? 'created',
    key_id: keyId,
    plan_code: plan,
    amount_paise: PRICES[plan],
    mode,
  });
});
