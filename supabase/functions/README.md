# Edge Functions

All functions are Deno/TypeScript and are also deployed live to the `bharatbite`
Supabase project (`xetdzgsbzjctenhelaki`).

| Function | JWT | Purpose |
| --- | --- | --- |
| `create-subscription` | yes | Creates a Razorpay Subscription (₹49/mo or ₹399/yr) and a `pending` entitlement |
| `create-manual-order` | yes | Creates a one-time Razorpay Order for a 30-day manual renewal (never a mandate) |
| `verify-payment` | yes | Recomputes the signature, re-reads the payment from Razorpay, grants Plus once |
| `verify-subscription` | yes | Reconciles a subscription after checkout redirect |
| `razorpay-webhook` | **no** | Signature-verified, idempotent event sink; the authoritative grant path |
| `cancel-subscription` | yes | Cancels at cycle end, preserving already-paid access |
| `sync-entitlement` | yes | Cheap authoritative read + expiry sweep |
| `model-manifest` | no | Public signed model manifest for the AI install screen |

## Required secrets

```
RAZORPAY_KEY_ID=rzp_test_...        # owner-supplied; test mode first
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_MONTHLY_ID=plan_...   # optional in test mode (auto-created)
RAZORPAY_PLAN_ANNUAL_ID=plan_...
RAZORPAY_MODE=test                  # switch to live only with owner approval
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by
the platform. The service-role key never leaves the function runtime.

## Deploy from the repository

```bash
supabase link --project-ref xetdzgsbzjctenhelaki
supabase functions deploy create-subscription create-manual-order verify-payment \
  verify-subscription cancel-subscription sync-entitlement
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy model-manifest --no-verify-jwt
```

Webhook URL to register in the Razorpay dashboard:

```
https://xetdzgsbzjctenhelaki.supabase.co/functions/v1/razorpay-webhook
```

Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
`subscription.authenticated`, `subscription.activated`, `subscription.charged`,
`subscription.pending`, `subscription.halted`, `subscription.cancelled`,
`subscription.completed`, `subscription.expired`.
