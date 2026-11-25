// razorpay-webhook — the source of truth for Plus entitlement.
//
// Deploy with verify_jwt = false (Razorpay cannot send a Supabase JWT). Security
// comes from the X-Razorpay-Signature HMAC over the raw body, plus idempotent
// storage in payment_events (unique provider+event_id).

import { createClient } from 'npm:@supabase/supabase-js@2';

const GRACE_DAYS = 3;
const PLAN_DAYS: Record<string, number> = { plus_monthly: 30, plus_annual: 365 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!secret) {
    return json({ error: 'webhook_not_configured', message: 'RAZORPAY_WEBHOOK_SECRET is missing; refusing to process events.' }, 503);
  }
  if (!signature) return json({ error: 'missing_signature' }, 401);

  const expected = await hmacHex(secret, raw);
  if (!timingSafeEqual(expected, signature)) return json({ error: 'invalid_signature' }, 401);

  let event: { event?: string; payload?: Record<string, any>; created_at?: number };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const eventType = event.event ?? 'unknown';
  const eventId =
    (event.payload?.payment?.entity?.id ? `${eventType}:${event.payload.payment.entity.id}` : null) ??
    (event.payload?.subscription?.entity?.id && event.payload?.subscription?.entity?.current_end
      ? `${eventType}:${event.payload.subscription.entity.id}:${event.payload.subscription.entity.current_end}`
      : null) ??
    `${eventType}:${raw.length}:${event.created_at ?? 0}`;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: insertedEvent, error: insertError } = await admin
    .from('payment_events')
    .insert({ event_id: eventId, event_type: eventType, signature_valid: true, payload: event, status: 'received' })
    .select('id')
    .maybeSingle();

  if (insertError) {
    // Duplicate delivery: acknowledge so Razorpay stops retrying, and do nothing.
    if (insertError.code === '23505') return json({ ok: true, duplicate: true });
    return json({ error: 'event_persist_failed', detail: insertError.message }, 500);
  }

  const finish = async (status: 'processed' | 'ignored' | 'failed', error?: string, extra: Record<string, unknown> = {}) => {
    await admin
      .from('payment_events')
      .update({ status, processed_at: new Date().toISOString(), error: error ?? null })
      .eq('id', insertedEvent!.id);
    return json({ ok: status !== 'failed', status, ...extra });
  };

  try {
    const p = event.payload ?? {};

    // ----- One-time payment (manual 30-day cycle) -----
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = p.payment?.entity;
      if (!payment?.order_id) return await finish('ignored', 'no order on payment');
      const { data: localPayment } = await admin
        .from('payments')
        .select('id, user_id, amount_paise, status')
        .eq('provider_order_id', payment.order_id)
        .maybeSingle();
      if (!localPayment) return await finish('ignored', 'unknown order');
      if (localPayment.amount_paise !== payment.amount) return await finish('failed', 'amount mismatch');

      const now = new Date();
      const periodEnd = addDays(now, PLAN_DAYS.plus_monthly ?? 30);
      const grace = addDays(periodEnd, GRACE_DAYS);

      await admin
        .from('payments')
        .update({
          status: 'captured',
          provider_payment_id: payment.id,
          signature_verified: true,
          verified_at: now.toISOString(),
        })
        .eq('id', localPayment.id)
        .neq('status', 'captured');

      const { data: current } = await admin
        .from('entitlements')
        .select('current_period_end')
        .eq('user_id', localPayment.user_id)
        .maybeSingle();
      const existingEnd = current?.current_period_end ? new Date(current.current_period_end) : null;
      const effectiveStart = existingEnd && existingEnd > now ? existingEnd : now;
      const effectiveEnd = addDays(effectiveStart, PLAN_DAYS.plus_monthly ?? 30);

      await admin.rpc('apply_entitlement', {
        p_user: localPayment.user_id,
        p_status: 'active',
        p_plan: 'plus_monthly',
        p_period_start: effectiveStart.toISOString(),
        p_period_end: effectiveEnd.toISOString(),
        p_grace_until: addDays(effectiveEnd, GRACE_DAYS).toISOString(),
        p_cancel_at_period_end: false,
        p_source: `webhook:${eventType}`,
      });
      return await finish('processed', undefined, { user_id: localPayment.user_id });
    }

    if (eventType === 'payment.failed') {
      const payment = p.payment?.entity;
      if (!payment?.order_id) return await finish('ignored', 'no order');
      const { data: localPayment } = await admin
        .from('payments')
        .select('id, user_id')
        .eq('provider_order_id', payment.order_id)
        .maybeSingle();
      if (localPayment) {
        await admin
          .from('payments')
          .update({ status: 'failed', provider_payment_id: payment.id, notes: { reason: payment.error_description ?? null } })
          .eq('id', localPayment.id);
      }
      return await finish('processed');
    }

    // ----- Subscriptions (automatic renewal) -----
    const sub = p.subscription?.entity;
    if (sub?.id) {
      const { data: localSub } = await admin
        .from('subscriptions')
        .select('id, user_id, plan_code, current_end')
        .eq('provider_subscription_id', sub.id)
        .maybeSingle();
      if (!localSub) return await finish('ignored', 'unknown subscription');

      const planCode = localSub.plan_code as 'plus_monthly' | 'plus_annual';
      const periodEnd = sub.current_end ? new Date(sub.current_end * 1000) : addDays(new Date(), PLAN_DAYS[planCode] ?? 30);
      const periodStart = sub.current_start ? new Date(sub.current_start * 1000) : new Date();

      await admin
        .from('subscriptions')
        .update({
          status: sub.status ?? 'active',
          current_start: periodStart.toISOString(),
          current_end: periodEnd.toISOString(),
          grace_until: addDays(periodEnd, GRACE_DAYS).toISOString(),
          cancel_at_period_end: Boolean(sub.cancel_at_cycle_end),
          ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
          raw: sub,
        })
        .eq('id', localSub.id);

      if (eventType === 'subscription.activated' || eventType === 'subscription.charged' || eventType === 'subscription.authenticated') {
        await admin.rpc('apply_entitlement', {
          p_user: localSub.user_id,
          p_status: 'active',
          p_plan: planCode,
          p_period_start: periodStart.toISOString(),
          p_period_end: periodEnd.toISOString(),
          p_grace_until: addDays(periodEnd, GRACE_DAYS).toISOString(),
          p_cancel_at_period_end: false,
          p_source: `webhook:${eventType}`,
        });
      } else if (eventType === 'subscription.pending' || eventType === 'subscription.halted') {
        await admin.rpc('apply_entitlement', {
          p_user: localSub.user_id,
          p_status: 'past_due',
          p_plan: planCode,
          p_period_end: periodEnd.toISOString(),
          p_grace_until: addDays(periodEnd, GRACE_DAYS).toISOString(),
          p_cancel_at_period_end: false,
          p_source: `webhook:${eventType}`,
        });
      } else if (eventType === 'subscription.cancelled') {
        // Cancellation preserves access until the already-paid period ends.
        await admin.rpc('apply_entitlement', {
          p_user: localSub.user_id,
          p_status: 'cancelled',
          p_plan: planCode,
          p_period_end: periodEnd.toISOString(),
          p_grace_until: null,
          p_cancel_at_period_end: true,
          p_source: `webhook:${eventType}`,
        });
      } else if (eventType === 'subscription.completed' || eventType === 'subscription.expired') {
        await admin.rpc('apply_entitlement', {
          p_user: localSub.user_id,
          p_status: 'expired',
          p_plan: planCode,
          p_period_end: periodEnd.toISOString(),
          p_source: `webhook:${eventType}`,
        });
      }
      return await finish('processed', undefined, { user_id: localSub.user_id });
    }

    if (eventType === 'refund.processed') {
      const refund = p.refund?.entity;
      const paymentId = refund?.payment_id;
      if (!paymentId) return await finish('ignored', 'no payment on refund');
      const { data: localPayment } = await admin
        .from('payments')
        .select('id, user_id')
        .eq('provider_payment_id', paymentId)
        .maybeSingle();
      if (!localPayment) return await finish('ignored', 'unknown payment');
      await admin.from('payments').update({ status: 'refunded' }).eq('id', localPayment.id);
      await admin.rpc('apply_entitlement', {
        p_user: localPayment.user_id,
        p_status: 'refunded',
        p_plan: 'plus_monthly',
        p_source: 'webhook:refund.processed',
      });
      return await finish('processed');
    }

    return await finish('ignored', `unhandled event ${eventType}`);
  } catch (err) {
    return await finish('failed', err instanceof Error ? err.message : String(err));
  }
});
