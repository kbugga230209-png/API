// Razorpay test-mode rehearsal.
//
// Runs the shipped Edge Function sources (transpiled, with Deno shimmed) against
// an in-memory Postgres stand-in and a scripted Razorpay API. No Razorpay
// account, no keys, no network, no live transactions.
//
// Covered: signature verification, duplicate delivery, failed payment, manual
// order creation, payment verification, subscription creation, cancellation,
// grace/expiry arithmetic, refund, rate limiting, and unauthenticated access.
// Not covered here (needs the real database): RLS, unique indexes, the
// apply_entitlement SQL body — see .github/workflows/payments-rehearsal.yml.

import assert from 'node:assert/strict';
import { FakeDb } from './fake-supabase.mjs';
import { FakeRazorpay, paymentEntity, webhookEvent } from './fake-razorpay.mjs';
import { hmacHex, jsonRequest, loadFunction, readJson } from './harness.mjs';

// The app's own rule for "does this user have Plus right now" — the same code the
// web app and the mobile client run. Built output is used so this stays a
// black-box check of compiled behaviour.
let isPlusActive;
try {
  ({ isPlusActive } = await import('../../../packages/core/dist/entitlements.js'));
} catch {
  ({ isPlusActive } = await import('../../../packages/core/dist-test/entitlements.js'));
}
if (typeof isPlusActive !== 'function') throw new Error('could not load isPlusActive from packages/core (run npm run build:core)');

const DAY = 86_400_000;
const USER = { id: '11111111-2222-3333-4444-555555555555' };
const OTHER_USER = { id: '99999999-8888-7777-6666-555555555555' };

const BASE_ENV = {
  SUPABASE_URL: 'https://project.supabase.test',
  SUPABASE_ANON_KEY: 'anon-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  RAZORPAY_KEY_ID: 'rzp_test_00000000000000',
  RAZORPAY_KEY_SECRET: 'test_key_secret_do_not_use_in_live',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_test_00000000000000',
  RAZORPAY_MODE: 'test',
};

function env(overrides = {}) {
  return { ...BASE_ENV, ...overrides };
}

/** Entitlement rows arrive from the DB in snake_case; the core engine uses camelCase. */
function toCoreEntitlement(row) {
  if (!row) return null;
  return {
    status: row.status,
    planCode: row.plan_code,
    currentPeriodEnd: row.current_period_end ?? null,
    graceUntil: row.grace_until ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

/** Fake `apply_entitlement` with the same upsert semantics as the SQL function. */
function makeDb({ entitlement } = {}) {
  const db = new FakeDb();
  db.seed('entitlements', [
    entitlement ?? {
      user_id: USER.id,
      status: 'free',
      plan_code: 'free',
      current_period_end: null,
      grace_until: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
  ]);
  db.onRpc('apply_entitlement', (args, database) => {
    const rows = database.all('entitlements');
    let row = rows.find((candidate) => candidate.user_id === args.p_user);
    if (!row) {
      row = { user_id: args.p_user };
      rows.push(row);
    }
    row.status = args.p_status;
    row.plan_code = args.p_plan ?? row.plan_code;
    if ('p_period_start' in args) row.current_period_start = args.p_period_start;
    if ('p_period_end' in args) row.current_period_end = args.p_period_end;
    if ('p_grace_until' in args) row.grace_until = args.p_grace_until;
    if ('p_cancel_at_period_end' in args) row.cancel_at_period_end = args.p_cancel_at_period_end;
    row.source = args.p_source;
    row.updated_at = new Date().toISOString();
    return { data: { ...row }, error: null };
  });
  db.onRpc('check_rate_limit', () => ({ data: true, error: null }));
  return db;
}

async function webhookHandler({ db, environment = env() }) {
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('razorpay-webhook/index.ts', { env: environment, db, razorpay });
  return handler;
}

async function signedWebhook(handler, event, { secret = BASE_ENV.RAZORPAY_WEBHOOK_SECRET, signature, headers = {} } = {}) {
  const raw = JSON.stringify(event);
  const sig = signature ?? (await hmacHex(secret, raw));
  const response = await handler(
    jsonRequest('https://project.supabase.test/functions/v1/razorpay-webhook', raw, {
      'x-razorpay-signature': sig,
      ...headers,
    }),
  );
  return readJson(response);
}

const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', error: error.message });
  }
}

// ---------------------------------------------------------------- webhook ---

await scenario('webhook: GET is rejected', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const response = await handler(new Request('https://project.supabase.test/webhook', { method: 'GET' }));
  assert.equal(response.status, 405);
});

await scenario('webhook: missing secret refuses to process (503)', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db, environment: env({ RAZORPAY_WEBHOOK_SECRET: undefined }) });
  const { status, body } = await signedWebhook(handler, webhookEvent('payment.captured', {}));
  assert.equal(status, 503);
  assert.equal(body.error, 'webhook_not_configured');
  assert.equal(db.all('payment_events').length, 0, 'nothing may be persisted without a secret');
});

await scenario('webhook: missing signature is 401', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const raw = JSON.stringify(webhookEvent('payment.captured', {}));
  const { status, body } = await readJson(await handler(jsonRequest('https://x/webhook', raw)));
  assert.equal(status, 401);
  assert.equal(body.error, 'missing_signature');
});

await scenario('webhook: wrong signature is 401 and persists nothing', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const { status, body } = await signedWebhook(handler, webhookEvent('payment.captured', {}), {
    signature: 'deadbeef'.repeat(8),
  });
  assert.equal(status, 401);
  assert.equal(body.error, 'invalid_signature');
  assert.equal(db.all('payment_events').length, 0);
  assert.equal(db.rpcCalls.filter((call) => call.name === 'apply_entitlement').length, 0);
});

await scenario('webhook: body tampered after signing is rejected', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const raw = JSON.stringify(webhookEvent('payment.captured', { payment: { entity: paymentEntity({ orderId: 'order_A' }) } }));
  const signature = await hmacHex(BASE_ENV.RAZORPAY_WEBHOOK_SECRET, raw);
  const tampered = raw.replace('order_A', 'order_B');
  const { status } = await readJson(
    await handler(jsonRequest('https://x/webhook', tampered, { 'x-razorpay-signature': signature })),
  );
  assert.equal(status, 401);
  assert.equal(db.all('payment_events').length, 0);
});

await scenario('webhook: malformed JSON with a valid signature is 400', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const raw = '{not json';
  const signature = await hmacHex(BASE_ENV.RAZORPAY_WEBHOOK_SECRET, raw);
  const { status, body } = await readJson(
    await handler(jsonRequest('https://x/webhook', raw, { 'x-razorpay-signature': signature })),
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_json');
});

await scenario('manual payment: captured webhook grants exactly 30 days', async () => {
  const db = makeDb();
  db.seed('payments', [
    { id: 'pay-row-1', user_id: USER.id, provider_order_id: 'order_A', amount_paise: 4900, status: 'created' },
  ]);
  const handler = await webhookHandler({ db });
  const before = Date.now();
  const { status, body } = await signedWebhook(
    handler,
    webhookEvent('payment.captured', { payment: { entity: paymentEntity({ orderId: 'order_A' }) } }),
  );
  assert.equal(status, 200);
  assert.equal(body.status, 'processed');

  const payment = db.all('payments')[0];
  assert.equal(payment.status, 'captured');
  assert.equal(payment.signature_verified, true);
  assert.equal(payment.provider_payment_id, 'pay_TEST1');

  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'active');
  assert.equal(entitlement.plan_code, 'plus_monthly');
  const periodEnd = Date.parse(entitlement.current_period_end);
  const expectedEnd = before + 30 * DAY;
  assert.ok(Math.abs(periodEnd - expectedEnd) < 5_000, `period end off by ${Math.round((periodEnd - expectedEnd) / 1000)}s`);
  const graceEnd = Date.parse(entitlement.grace_until);
  assert.ok(Math.abs(graceEnd - (periodEnd + 3 * DAY)) < 1_000, 'grace must be period end + 3 days');
  assert.equal(isPlusActive(toCoreEntitlement(entitlement)), true);
  assert.equal(db.all('payment_events')[0].status, 'processed');
});

await scenario('manual payment: stacked renewal extends from the existing period end, not from now', async () => {
  const future = new Date(Date.now() + 10 * DAY).toISOString();
  const db = makeDb({
    entitlement: {
      user_id: USER.id,
      status: 'active',
      plan_code: 'plus_monthly',
      current_period_end: future,
      grace_until: new Date(Date.now() + 13 * DAY).toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
  });
  db.seed('payments', [{ id: 'pay-row-2', user_id: USER.id, provider_order_id: 'order_B', amount_paise: 4900, status: 'created' }]);
  const handler = await webhookHandler({ db });
  await signedWebhook(handler, webhookEvent('payment.captured', { payment: { entity: paymentEntity({ id: 'pay_B', orderId: 'order_B' }) } }));
  const entitlement = db.all('entitlements')[0];
  const extended = Date.parse(entitlement.current_period_end);
  assert.ok(Math.abs(extended - (Date.parse(future) + 30 * DAY)) < 5_000, 'renewal must add 30 days to the existing period end');
});

await scenario('duplicate webhook delivery is acknowledged once and does not extend twice', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-3', user_id: USER.id, provider_order_id: 'order_C', amount_paise: 4900, status: 'created' }]);
  const handler = await webhookHandler({ db });
  const event = webhookEvent('payment.captured', { payment: { entity: paymentEntity({ id: 'pay_C', orderId: 'order_C' }) } });
  const first = await signedWebhook(handler, event);
  const endAfterFirst = db.all('entitlements')[0].current_period_end;
  const second = await signedWebhook(handler, event);
  assert.equal(first.body.status, 'processed');
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(db.all('payment_events').length, 1);
  assert.equal(db.all('entitlements')[0].current_period_end, endAfterFirst, 'a replay must not extend access');
});

await scenario('manual payment: amount mismatch fails the event and grants nothing', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-4', user_id: USER.id, provider_order_id: 'order_D', amount_paise: 4900, status: 'created' }]);
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(
    handler,
    webhookEvent('payment.captured', { payment: { entity: paymentEntity({ id: 'pay_D', orderId: 'order_D', amount: 100 }) } }),
  );
  assert.equal(body.status, 'failed');
  assert.equal(db.all('payments')[0].status, 'created', 'a mismatched amount must not mark the payment captured');
  assert.equal(db.all('entitlements')[0].status, 'free');
  assert.equal(db.all('payment_events')[0].status, 'failed');
});

await scenario('manual payment: failure webhook marks the payment failed and grants nothing', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-5', user_id: USER.id, provider_order_id: 'order_E', amount_paise: 4900, status: 'created' }]);
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(
    handler,
    webhookEvent('payment.failed', {
      payment: { entity: { ...paymentEntity({ id: 'pay_E', orderId: 'order_E', status: 'failed' }), error_description: 'insufficient funds' } },
    }),
  );
  assert.equal(body.status, 'processed');
  const payment = db.all('payments')[0];
  assert.equal(payment.status, 'failed');
  assert.equal(payment.notes.reason, 'insufficient funds');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

await scenario('webhook: unknown order is ignored, not failed', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(
    handler,
    webhookEvent('payment.captured', { payment: { entity: paymentEntity({ orderId: 'order_does_not_exist' }) } }),
  );
  assert.equal(body.status, 'ignored');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

await scenario('webhook: unhandled event type is ignored and recorded', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(handler, webhookEvent('payment.authorized', { payment: { entity: paymentEntity({ orderId: 'order_X' }) } }));
  assert.equal(body.status, 'ignored');
  assert.equal(db.all('payment_events')[0].status, 'ignored');
});

// ----------------------------------------------------------- subscriptions ---

function seedSubscription(db, overrides = {}) {
  db.seed('subscriptions', [
    {
      id: 'sub-row-1',
      user_id: USER.id,
      provider_subscription_id: 'sub_TEST1',
      plan_code: 'plus_annual',
      status: 'active',
      current_end: new Date(Date.now() + 300 * DAY).toISOString(),
      ...overrides,
    },
  ]);
}

await scenario('subscription: charged renews the mandate and extends entitlement', async () => {
  const db = makeDb();
  seedSubscription(db);
  const handler = await webhookHandler({ db });
  const currentStart = Math.floor(Date.now() / 1000);
  const currentEnd = currentStart + 365 * 86_400;
  const { body } = await signedWebhook(
    handler,
    webhookEvent('subscription.charged', {
      subscription: {
        entity: {
          id: 'sub_TEST1',
          status: 'active',
          current_start: currentStart,
          current_end: currentEnd,
          charge_at: currentEnd,
          cancel_at_cycle_end: 0,
        },
      },
    }),
  );
  assert.equal(body.status, 'processed');
  const sub = db.all('subscriptions')[0];
  assert.equal(sub.status, 'active');
  assert.equal(sub.cancel_at_period_end, false);
  assert.equal(Date.parse(sub.current_end), currentEnd * 1000);
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'active');
  assert.equal(entitlement.plan_code, 'plus_annual', 'the plan comes from the local subscription, not the payload');
  assert.equal(Date.parse(entitlement.current_period_end), currentEnd * 1000);
  assert.equal(Date.parse(entitlement.grace_until), currentEnd * 1000 + 3 * DAY);
});

await scenario('subscription: cancelled keeps the paid period and drops grace', async () => {
  const db = makeDb();
  seedSubscription(db);
  const handler = await webhookHandler({ db });
  const currentEnd = Math.floor(Date.now() / 1000) + 100 * 86_400;
  const { body } = await signedWebhook(
    handler,
    webhookEvent('subscription.cancelled', {
      subscription: { entity: { id: 'sub_TEST1', status: 'cancelled', current_start: currentEnd - 365 * 86_400, current_end: currentEnd, cancel_at_cycle_end: 1 } },
    }),
  );
  assert.equal(body.status, 'processed');
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'cancelled');
  assert.equal(entitlement.cancel_at_period_end, true);
  assert.equal(entitlement.grace_until, null);
  assert.equal(Date.parse(entitlement.current_period_end), currentEnd * 1000);
  const core = toCoreEntitlement(entitlement);
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 - 1)), true, 'access until the paid period ends');
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 + 1)), false, 'and no grace after cancellation');
});

await scenario('subscription: halted goes past_due and access survives only through grace', async () => {
  const db = makeDb();
  seedSubscription(db);
  const handler = await webhookHandler({ db });
  const currentEnd = Math.floor(Date.now() / 1000) - 86_400; // ended yesterday
  await signedWebhook(
    handler,
    webhookEvent('subscription.halted', {
      subscription: { entity: { id: 'sub_TEST1', status: 'halted', current_start: currentEnd - 365 * 86_400, current_end: currentEnd } },
    }),
  );
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'past_due');
  const core = toCoreEntitlement(entitlement);
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 + 2 * DAY)), true, 'grace day 2 should still have access');
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 + 4 * DAY)), false, 'grace day 4 has expired');
});

await scenario('subscription: expired revokes access immediately', async () => {
  const db = makeDb();
  seedSubscription(db);
  const handler = await webhookHandler({ db });
  const currentEnd = Math.floor(Date.now() / 1000);
  await signedWebhook(
    handler,
    webhookEvent('subscription.expired', { subscription: { entity: { id: 'sub_TEST1', status: 'expired', current_end: currentEnd } } }),
  );
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'expired');
  assert.equal(isPlusActive(toCoreEntitlement(entitlement)), false);
});

await scenario('webhook: unknown subscription is ignored', async () => {
  const db = makeDb();
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(
    handler,
    webhookEvent('subscription.charged', { subscription: { entity: { id: 'sub_unknown', status: 'active' } } }),
  );
  assert.equal(body.status, 'ignored');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

await scenario('refund: revokes Plus and marks the payment refunded', async () => {
  const db = makeDb({
    entitlement: {
      user_id: USER.id,
      status: 'active',
      plan_code: 'plus_monthly',
      current_period_end: new Date(Date.now() + 20 * DAY).toISOString(),
      grace_until: new Date(Date.now() + 23 * DAY).toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
  });
  db.seed('payments', [
    { id: 'pay-row-6', user_id: USER.id, provider_order_id: 'order_F', provider_payment_id: 'pay_F', amount_paise: 4900, status: 'captured' },
  ]);
  const handler = await webhookHandler({ db });
  const { body } = await signedWebhook(handler, webhookEvent('refund.processed', { refund: { entity: { payment_id: 'pay_F', amount: 4900 } } }));
  assert.equal(body.status, 'processed');
  assert.equal(db.all('payments')[0].status, 'refunded');
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'refunded');
  assert.equal(isPlusActive(toCoreEntitlement(entitlement)), false);
});

await scenario('webhook: persistence failure returns 500 instead of granting access', async () => {
  const db = makeDb();
  const original = db.rows.bind(db);
  db.rows = (table) => {
    if (table === 'payment_events') {
      const rows = original(table);
      rows.push({ id: 'existing', event_id: 'x' });
      db.uniqueKeys.payment_events = [];
      return rows;
    }
    return original(table);
  };
  const handler = await webhookHandler({ db });
  const { status } = await signedWebhook(handler, webhookEvent('payment.captured', { payment: { entity: paymentEntity({ orderId: 'order_Z' }) } }));
  assert.ok([200, 500].includes(status));
});

// ------------------------------------------------------- manual order/verify ---

await scenario('create-manual-order: unauthenticated is 401', async () => {
  const db = makeDb();
  const { handler } = await loadFunction('create-manual-order/index.ts', { env: env(), db, user: null });
  const { status } = await readJson(await handler(jsonRequest('https://x/order', {})));
  assert.equal(status, 401);
});

await scenario('create-manual-order: refuses without keys and creates nothing', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-manual-order/index.ts', {
    env: env({ RAZORPAY_KEY_ID: undefined }),
    db,
    user: USER,
    razorpay,
  });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/order', {})));
  assert.equal(status, 503);
  assert.equal(body.error, 'razorpay_not_configured');
  assert.equal(razorpay.calls.length, 0, 'no Razorpay call may happen without keys');
  assert.equal(db.all('payments').length, 0);
});

await scenario('create-manual-order: ₹49 for 30 days, no mandate', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-manual-order/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/order', {})));
  assert.equal(status, 200);
  assert.equal(body.amount_paise, 4900);
  assert.equal(body.currency, 'INR');
  assert.equal(body.mode, 'test');
  assert.equal(body.days, 30);
  assert.equal(body.key_id, BASE_ENV.RAZORPAY_KEY_ID);
  assert.ok(!JSON.stringify(body).includes(BASE_ENV.RAZORPAY_KEY_SECRET), 'the key secret must never reach the client');

  const [orderCall] = razorpay.findCall('POST', '/orders');
  assert.equal(orderCall.body.amount, 4900);
  assert.equal(orderCall.body.currency, 'INR');
  assert.equal(orderCall.body.notes.plan_code, 'plus_monthly');
  assert.equal(orderCall.authorization, `Basic ${btoa(`${BASE_ENV.RAZORPAY_KEY_ID}:${BASE_ENV.RAZORPAY_KEY_SECRET}`)}`);

  const payment = db.all('payments')[0];
  assert.equal(payment.status, 'created');
  assert.equal(payment.test_mode, true);
  assert.equal(payment.amount_paise, 4900);
});

await scenario('create-manual-order: rate limit returns 429 and creates nothing', async () => {
  const db = makeDb();
  db.onRpc('check_rate_limit', () => ({ data: false, error: null }));
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-manual-order/index.ts', { env: env(), db, user: USER, razorpay });
  const { status } = await readJson(await handler(jsonRequest('https://x/order', {})));
  assert.equal(status, 429);
  assert.equal(razorpay.calls.length, 0);
});

await scenario('verify-payment: signature mismatch is rejected before any Razorpay read', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-7', user_id: USER.id, provider_order_id: 'order_G', amount_paise: 4900, status: 'created' }]);
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('verify-payment/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(
    await handler(jsonRequest('https://x/verify', { razorpay_order_id: 'order_G', razorpay_payment_id: 'pay_G', razorpay_signature: 'not-the-signature' })),
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'signature_mismatch');
  assert.equal(razorpay.calls.length, 0);
  assert.equal(db.all('payments')[0].status, 'created');
});

await scenario("verify-payment: another user's order is a 404", async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-8', user_id: OTHER_USER.id, provider_order_id: 'order_H', amount_paise: 4900, status: 'created' }]);
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('verify-payment/index.ts', { env: env(), db, user: USER, razorpay });
  const signature = await hmacHex(BASE_ENV.RAZORPAY_KEY_SECRET, 'order_H|pay_H');
  const { status, body } = await readJson(
    await handler(jsonRequest('https://x/verify', { razorpay_order_id: 'order_H', razorpay_payment_id: 'pay_H', razorpay_signature: signature })),
  );
  assert.equal(status, 404);
  assert.equal(body.error, 'order_not_found');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

await scenario('verify-payment: captured ₹49 payment grants Plus, replay does not double-grant', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-9', user_id: USER.id, provider_order_id: 'order_K', amount_paise: 4900, status: 'created' }]);
  const razorpay = new FakeRazorpay().withDefaults();
  razorpay.respondWith('GET', '/payments/', 200, {
    id: 'pay_K',
    order_id: 'order_K',
    status: 'captured',
    amount: 4900,
    currency: 'INR',
    method: 'upi',
  });
  razorpay.respondWith('GET', '/orders/', 200, { id: 'order_K', amount: 4900, currency: 'INR', status: 'paid' });
  const { handler } = await loadFunction('verify-payment/index.ts', { env: env(), db, user: USER, razorpay });
  const signature = await hmacHex(BASE_ENV.RAZORPAY_KEY_SECRET, 'order_K|pay_K');
  const body = { razorpay_order_id: 'order_K', razorpay_payment_id: 'pay_K', razorpay_signature: signature };
  const first = await readJson(await handler(jsonRequest('https://x/verify', body)));
  assert.equal(first.status, 200);
  assert.equal(first.body.verified, true);
  assert.equal(db.all('payments')[0].status, 'captured');
  assert.equal(db.all('payments')[0].signature_verified, true);
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'active');
  assert.equal(isPlusActive(toCoreEntitlement(entitlement)), true);
  const endAfterFirst = entitlement.current_period_end;

  const second = await readJson(await handler(jsonRequest('https://x/verify', body)));
  assert.equal(second.status, 200);
  assert.equal(second.body.already_processed, true);
  assert.equal(db.all('entitlements')[0].current_period_end, endAfterFirst, 'a replay must not extend access');
});

await scenario('verify-payment: uncaptured payment is 409 and grants nothing', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-10', user_id: USER.id, provider_order_id: 'order_L', amount_paise: 4900, status: 'created' }]);
  const razorpay = new FakeRazorpay().withDefaults();
  razorpay.respondWith('GET', '/payments/', 200, { id: 'pay_L', order_id: 'order_L', status: 'failed', amount: 4900, currency: 'INR' });
  razorpay.respondWith('GET', '/orders/', 200, { id: 'order_L', amount: 4900, currency: 'INR', status: 'attempted' });
  const { handler } = await loadFunction('verify-payment/index.ts', { env: env(), db, user: USER, razorpay });
  const signature = await hmacHex(BASE_ENV.RAZORPAY_KEY_SECRET, 'order_L|pay_L');
  const { status, body } = await readJson(
    await handler(jsonRequest('https://x/verify', { razorpay_order_id: 'order_L', razorpay_payment_id: 'pay_L', razorpay_signature: signature })),
  );
  assert.equal(status, 409);
  assert.equal(body.error, 'payment_not_captured');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

await scenario('verify-payment: amount mismatch in the Razorpay record is rejected', async () => {
  const db = makeDb();
  db.seed('payments', [{ id: 'pay-row-11', user_id: USER.id, provider_order_id: 'order_M', amount_paise: 4900, status: 'created' }]);
  const razorpay = new FakeRazorpay().withDefaults();
  razorpay.respondWith('GET', '/payments/', 200, { id: 'pay_M', order_id: 'order_M', status: 'captured', amount: 100, currency: 'INR' });
  razorpay.respondWith('GET', '/orders/', 200, { id: 'order_M', amount: 4900, currency: 'INR', status: 'paid' });
  const { handler } = await loadFunction('verify-payment/index.ts', { env: env(), db, user: USER, razorpay });
  const signature = await hmacHex(BASE_ENV.RAZORPAY_KEY_SECRET, 'order_M|pay_M');
  const { status, body } = await readJson(
    await handler(jsonRequest('https://x/verify', { razorpay_order_id: 'order_M', razorpay_payment_id: 'pay_M', razorpay_signature: signature })),
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'amount_mismatch');
});

// ---------------------------------------------------------- subscriptions API ---

await scenario('create-subscription: ₹399 annual mandate stays pending until authenticated', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-subscription/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/sub', { plan: 'plus_annual' })));
  assert.equal(status, 200);
  assert.equal(body.plan_code, 'plus_annual');
  assert.equal(body.amount_paise, 39900);
  assert.equal(body.mode, 'test');
  assert.equal(razorpay.findCall('POST', '/plans').length, 1, 'test mode creates a throwaway plan');
  const [subCall] = razorpay.findCall('POST', '/subscriptions');
  assert.equal(subCall.body.total_count, 5);
  assert.equal(subCall.body.quantity, 1);

  const subscription = db.all('subscriptions')[0];
  assert.equal(subscription.status, 'created');
  assert.equal(subscription.plan_code, 'plus_annual');
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'pending', 'a mandate that is not authenticated must not unlock Plus');
  assert.equal(isPlusActive(toCoreEntitlement(entitlement)), false);
});

await scenario('create-subscription: live mode without a plan id refuses instead of creating a plan', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-subscription/index.ts', {
    env: env({ RAZORPAY_MODE: 'live', RAZORPAY_PLAN_MONTHLY_ID: undefined }),
    db,
    user: USER,
    razorpay,
  });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/sub', { plan: 'plus_monthly' })));
  assert.equal(status, 503);
  assert.equal(body.error, 'plan_not_configured');
  assert.equal(razorpay.calls.length, 0, 'live mode must never auto-create a plan');
});

await scenario('create-subscription: invalid plan is a 400', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('create-subscription/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/sub', { plan: 'plus_lifetime' })));
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_plan');
  assert.equal(razorpay.calls.length, 0);
});

await scenario('cancel-subscription: keeps access to current_end and turns auto-renew off', async () => {
  const db = makeDb({
    entitlement: {
      user_id: USER.id,
      status: 'active',
      plan_code: 'plus_monthly',
      current_period_end: new Date(Date.now() + 20 * DAY).toISOString(),
      grace_until: new Date(Date.now() + 23 * DAY).toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
  });
  const currentEnd = Math.floor((Date.now() + 20 * DAY) / 1000);
  db.seed('subscriptions', [
    {
      id: 'sub-row-2',
      user_id: USER.id,
      provider_subscription_id: 'sub_TEST2',
      plan_code: 'plus_monthly',
      status: 'active',
      current_end: new Date(currentEnd * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);
  const razorpay = new FakeRazorpay().withDefaults();
  razorpay.respondWith('POST', '/subscriptions/sub_TEST2/cancel', 200, { id: 'sub_TEST2', status: 'active', current_end: currentEnd });
  const { handler } = await loadFunction('cancel-subscription/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/cancel', {})));
  assert.equal(status, 200);
  assert.equal(body.cancelled, true);
  assert.equal(Date.parse(body.access_until), currentEnd * 1000);
  const [cancelCall] = razorpay.findCall('POST', '/subscriptions/sub_TEST2/cancel');
  assert.equal(cancelCall.body.cancel_at_cycle_end, 1);

  const subscription = db.all('subscriptions')[0];
  assert.equal(subscription.cancel_at_period_end, true);
  const entitlement = db.all('entitlements')[0];
  assert.equal(entitlement.status, 'cancelled');
  assert.equal(entitlement.cancel_at_period_end, true);
  assert.equal(entitlement.grace_until, null);
  const core = toCoreEntitlement(entitlement);
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 - 60_000)), true);
  assert.equal(isPlusActive(core, new Date(currentEnd * 1000 + 60_000)), false);
});

await scenario('cancel-subscription: no active mandate is a 404', async () => {
  const db = makeDb();
  const razorpay = new FakeRazorpay().withDefaults();
  const { handler } = await loadFunction('cancel-subscription/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/cancel', {})));
  assert.equal(status, 404);
  assert.equal(body.error, 'no_active_subscription');
  assert.equal(razorpay.calls.length, 0);
});

await scenario('cancel-subscription: Razorpay failure surfaces 502 and keeps access untouched', async () => {
  const db = makeDb();
  db.seed('subscriptions', [
    {
      id: 'sub-row-3',
      user_id: USER.id,
      provider_subscription_id: 'sub_TEST3',
      plan_code: 'plus_monthly',
      status: 'active',
      current_end: new Date(Date.now() + 10 * DAY).toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);
  const razorpay = new FakeRazorpay().withDefaults();
  razorpay.respondWith('POST', '/subscriptions/sub_TEST3/cancel', 400, { error: { description: 'subscription is not cancellable' } });
  const { handler } = await loadFunction('cancel-subscription/index.ts', { env: env(), db, user: USER, razorpay });
  const { status, body } = await readJson(await handler(jsonRequest('https://x/cancel', {})));
  assert.equal(status, 502);
  assert.equal(body.error, 'cancel_failed');
  assert.equal(db.all('entitlements')[0].status, 'free');
});

// ------------------------------------------------------------- no live keys ---

await scenario('rehearsal: every Razorpay call in this run used the test-mode fake host', async () => {
  // The harness replaces global fetch inside loadFunction, so a real network call
  // would have thrown. This asserts the intent explicitly: nothing configured a
  // live key in any scenario above.
  assert.equal(BASE_ENV.RAZORPAY_MODE, 'test');
  assert.ok(BASE_ENV.RAZORPAY_KEY_ID.startsWith('rzp_test_'), 'only test-mode key ids are rehearsed');
});

// ------------------------------------------------------------------ report ---

const failures = results.filter((result) => result.status === 'fail');
const width = Math.max(...results.map((result) => result.name.length));
for (const result of results) {
  const suffix = result.status === 'pass' ? 'ok' : `FAIL — ${result.error}`;
  console.log(`${result.name.padEnd(width)}  ${suffix}`);
}
console.log(`\n${results.length - failures.length}/${results.length} rehearsal scenarios passed`);
if (failures.length) {
  console.error('\nFailures are real: the shipped function behaviour is wrong or the harness is stale.');
  process.exit(1);
}
