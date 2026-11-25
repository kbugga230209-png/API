# Payments — test-mode rehearsal

Razorpay is wired for both manual (one-time ₹49 / 30-day) and recurring
(₹49/month or ₹399/year mandate) Plus. The webhook is the source of truth; the
client never unlocks Plus from a success callback.

**No live transaction has ever been attempted from this repository, and no
Razorpay credentials exist in it.** The webhook returns HTTP 503
`webhook_not_configured` until `RAZORPAY_WEBHOOK_SECRET` is set, and the order
functions return 503 `razorpay_not_configured` until test-mode keys exist
(`docs/BLOCKERS.md` §1).

## What was actually rehearsed

### 1. Edge Function logic — `npm run test:payments` (36/36 scenarios)

`supabase/tests/rehearsal/` transpiles the **shipped** function sources
(`razorpay-webhook`, `create-manual-order`, `verify-payment`,
`create-subscription`, `cancel-subscription`), runs them under Node with a small
`Deno` shim, an in-memory Supabase client and a scripted `api.razorpay.com`.
Nothing is re-implemented: signature checks, idempotency, entitlement arithmetic
and status transitions are the deployed code paths.

| Area | Asserted |
| --- | --- |
| Signature | missing signature → 401; wrong signature → 401 with nothing persisted; body tampered after signing → 401; valid signature + malformed JSON → 400; `GET` → 405 |
| Missing config | no webhook secret → 503 and zero rows; no keys → 503 and zero Razorpay calls |
| Manual payment | `payment.captured` grants exactly 30 days + 3-day grace, marks the payment captured with `signature_verified`; a second purchase stacks from the existing period end, not from today |
| Idempotency | replaying the same signed event returns `{duplicate: true}` and does **not** extend access; `verify-payment` replay returns `already_processed` |
| Failure paths | amount mismatch → event `failed`, payment untouched, no entitlement; `payment.failed` → payment failed with the reason, no entitlement; unknown order → `ignored`; unhandled event → `ignored` and recorded |
| Subscriptions | `subscription.charged` extends to Razorpay's `current_end`; `cancelled` keeps the paid period, drops grace, sets `cancel_at_period_end`; `halted` → `past_due` (access only through grace); `expired` → no access; plan code comes from the local subscription row, not the payload |
| Refund | `refund.processed` marks the payment refunded and revokes Plus immediately |
| Creation flows | manual order is ₹49 / INR / 30 days / `mode: test`, key secret never returned; rate limit → 429 with no Razorpay call; annual mandate is ₹399 with `total_count: 5` and stays `pending` (no access) until authenticated; live mode without a plan id refuses (503) instead of auto-creating a plan; invalid plan → 400 |
| Cancellation | `cancel_at_cycle_end: 1` is sent, access until `current_end`, then none; no active mandate → 404; Razorpay rejection → 502 with entitlement untouched |

Run locally: `npm run test:payments` (needs `npm run build:core` once, or the
existing `dist-test` build). CI: `.github/workflows/payments-rehearsal.yml`.

### 2. Database semantics — real project, synthetic users, cleaned up

Run against `xetdzgsbzjctenhelaki` on 2026-11-25 with throwaway users
(`rehearsal-…@e2e.bharatbite.invalid`, deleted afterwards; all tables verified
back to 0 rows).

| Check | Result |
| --- | --- |
| `apply_entitlement` + `has_plus_access`: active, period end in future | access granted |
| active, period end in the past | access denied |
| past_due inside grace | access granted |
| past_due after grace | access denied |
| cancelled with a future period end | access granted, `cancel_at_period_end = true` |
| expired | access denied |
| refunded with a future period end | access denied (refund wins) |
| `free` reset | periods and grace nulled, no access |
| `apply_entitlement` with null `p_period_start` | keeps the previous start (coalesce path) |
| unknown user | no access |
| duplicate `(provider, event_id)` insert | rejected with `23505`, exactly one row retained |
| `check_rate_limit(bucket, 2, 3600)` ×3 | `true, true, false` |
| authenticated SELECT on `payments` / `entitlements` | own row only; other users' rows invisible |
| authenticated UPDATE on `entitlements` (self-grant Plus) | denied — `42501 permission denied` |
| authenticated INSERT into `payments` (fake purchase) | denied — `42501` |
| authenticated SELECT on `payment_events` | denied — `42501` (no grant, no policy) |

The last four are the ones that matter: a signed-in client cannot mint a payment,
cannot unlock Plus, and cannot read the webhook log.

### 3. What is still unverified

| Gap | Why | What unlocks it |
| --- | --- | --- |
| A real test-mode checkout (order → UPI intent → capture) | requires Razorpay test keys | owner adds `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test mode) |
| Webhook delivery from Razorpay's servers | endpoint needs a webhook secret and registration | owner sets `RAZORPAY_WEBHOOK_SECRET`, registers the endpoint, uses Dashboard → Webhooks → *Test* |
| Mandate authentication (`subscription.authenticated`) | needs a real subscription checkout | test-mode keys + plan ids |
| Refund via dashboard | needs a captured test payment | same |
| Live-mode behaviour | out of scope by instruction | merchant approval, owner decision |

Once test keys exist, the rehearsal to run is: create a manual order on `/app/plus`
with test credentials (`success@razorpay` simulated UPI), confirm the entitlement
row and the `payment_events` row, replay the same webhook id (expect
`duplicate: true`), then cancel a test subscription and confirm access survives
to `current_end`. That is a checklist, not a claim: none of it has been run.
