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

The pipeline that consumes the corpus is finished and tested (`ml/`, 103 unittest
cases). What is missing is data and compute, not code:

| Ask | Detail |
| --- | --- |
| Image corpus | 50 classes × ~120 images; at least 40 per class, 5+ validation per class. Sourcing plan and licence rules in `ml/dataset/README.md`. Owned capture is the important part — open corpora alone do not look like a canteen tray. |
| GPU machine (or CI dispatch) | `pip install -r ml/requirements-train.txt`, then `train.py` → `quantize.py` → `evaluate.py`. The `ml-pipeline` workflow can be run manually with `run_training_smoke` to prove the plumbing on a runner. |
| Signing key | `python3 -m bharatbite_ml.cli new-key`; store the private half as the GitHub Actions secret `BHARATBITE_MODEL_SIGNING_KEY`, commit only the public half. `export_manifest` reads it from the environment and refuses to sign without a measured benchmark. |
| One `model_versions` row | version, artifact URL, SHA-256, size, signature, metrics — only after `benchmark --results` recommends a model. |

The gate is not negotiable: top-1 ≥ 0.75, top-5 ≥ 0.90, p95 ≤ 350 ms, artifact
≤ 25 MB, and the signed SHA-256 must be the exact file the benchmark measured.

## 4. Nothing else

Repo, database schema, RLS, catalog seed, all eight Edge Functions, the auth
configuration and the web app deployment are done. Domain (if wanted later):
point DNS at Vercel and add the domain to Supabase → Auth → URL Configuration.
