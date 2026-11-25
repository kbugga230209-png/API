# Blockers — what the owner has to provide

Everything else is built. These four items cannot be done from the agent sandbox,
and the software is written to fail loudly and honestly until they are resolved.

## 1. Razorpay keys (blocks real payments)

Payments are implemented end to end — order creation, signature verification,
payment re-read from the Razorpay API, idempotent grants, webhook handling, grace
periods, cancellation. They currently return HTTP 503
`razorpay_not_configured` and the UI says *"Payments are not configured on this
deployment yet. Nothing was charged."*

Set these as Supabase secrets (Project `xetdzgsbzjctenhelaki` → Edge Functions →
Secrets, or `supabase secrets set`):

| Secret | Where to get it |
| --- | --- |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Account & Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | same page (shown once) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks → the secret you type when creating the endpoint |
| `RAZORPAY_PLAN_MONTHLY_ID` | optional — Razorpay Plans → create ₹49 / 30-day plan |
| `RAZORPAY_PLAN_ANNUAL_ID` | optional — create ₹399 / 365-day plan |
| `RAZORPAY_MODE` | `test` or `live` (defaults to `test`) |

Webhook endpoint to register (events: `payment.captured`, `payment.failed`,
`subscription.activated`, `subscription.charged`, `subscription.cancelled`,
`subscription.halted`, `order.paid`):

```
https://xetdzgsbzjctenhelaki.supabase.co/functions/v1/razorpay-webhook
```

Use a **test** key first. A live key without merchant approval will simply fail at
Razorpay's end.

## 2. Android release keystore (blocks the APK)

No JDK, Android SDK or signing key exists in this environment, and an unsigned or
unverified APK must never be distributed. `/download` states this explicitly.

Needed: a keystore (`keytool -genkeypair …`), `key.properties` kept out of Git, and
a CI runner (`ubuntu-latest` with `setup-java` + `android-actions/setup-android`)
that builds and signs. Store the keystore + passwords as GitHub Actions secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`.

## 3. Recognition model + published `model_versions` row

`model-manifest` returns 404 `no_published_model` on purpose: there is no trained
artifact and therefore nothing to sign. The app falls back to manual search rather
than downloading anything unverified.

Needed: a licensed Indian-food image corpus, a training run (steps in `docs/PLAN.md`
§1.9), then an Ed25519 signing key held outside the repo and one `model_versions`
row (version, artifact URL, SHA-256, size, signature, metrics).

## 4. Nothing else

Repo, database schema, RLS, catalog seed, all eight Edge Functions, the auth
configuration and the web app deployment are done. Domain (if wanted later):
point DNS at Vercel and add the domain to Supabase → Auth → URL Configuration.
