# Blockers — what the owner has to provide

Everything else is built. These four items cannot be done from the agent sandbox,
and the software is written to fail loudly and honestly until they are resolved.

## 1. Razorpay keys (blocks real payments, not the rehearsal)

Payments are implemented end to end and were rehearsed in test mode without
credentials: 36/36 Edge Function scenarios plus a database-level check of
entitlement expiry, idempotency and RLS (`docs/PAYMENTS.md`). What remains
blocked is a real checkout and real webhook delivery.

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

The pipeline that consumes the corpus is finished and tested (`ml/`, 166 unittest
cases). What is missing is data and compute, not code:

| Ask | Detail |
| --- | --- |
| Image corpus | 50 classes × ~120 images; at least 40 per class, 5+ validation per class. Sourcing plan and licence rules in `docs/DATASET.md` (register: `ml/dataset/sources.json`). Owned capture is the important part — open corpora alone do not look like a canteen tray. |
| GPU machine (or CI dispatch) | `pip install -r ml/requirements-train.txt`, then `train.py` → `quantize.py` → `evaluate.py`. The `ml-pipeline` workflow can be run manually with `run_training_smoke` to prove the plumbing on a runner. |
| Signing key | `python3 -m bharatbite_ml.cli new-key`; store the private half as the GitHub Actions secret `BHARATBITE_MODEL_SIGNING_KEY`, commit only the public half. `export_manifest` reads it from the environment and refuses to sign without a measured benchmark. |
| One `model_versions` row | version, artifact URL, SHA-256, size, signature, metrics — only after `benchmark --results` recommends a model. |

The gate is not negotiable: top-1 ≥ 0.75, top-5 ≥ 0.90, p95 ≤ 350 ms, artifact
≤ 25 MB, and the signed SHA-256 must be the exact file the benchmark measured.

## 4. Dataset acquisition (blocks training)

The dataset *pipeline* exists and is tested; no corpus has been acquired.
`ml/dataset/sources.json` records eight researched sources with per-source
licence status, and only three may be trained on and shipped: Wikimedia Commons
(per-file licence, machine-readable), Open Images V7 (per-image licence, thin
Indian coverage) and our own capture. The Kaggle/Hugging Face Indian-food sets
are eval-only because their images were scraped from Google Images with no
per-image licence or author; `ashishpadala/indian-food-images` is rejected
outright (an Apache-2.0 dataset-level tag cannot relicense scraped photographs).
Reasoning, per-source detail and commands: `docs/DATASET.md`.

This sandbox has **no outbound HTTPS**: the Commons MediaWiki API fails with
`URLError: TLS/SSL connection has been closed (EOF)`, so `sources-fetch` records
`skippedError` per class and downloads nothing. No proxy or bypass was
attempted — bypassing an access restriction is out of scope. The same limit
blocks the Open Images shards.

To unblock, any one of:

| Route | Detail |
| --- | --- |
| Network access | run `sources-fetch --per-class 40` → `quality-audit` → `split-groups` on a connected machine, then review labels by hand |
| Owned capture | ~2,000 photographs of the 50 dishes as served (home, canteen, thali restaurant) — the only route to 40+ regional dishes and the real distribution |
| Written permission | a licence from a corpus author granting redistribution; only then does that source move from `evalOnly` to `trainingAllowed` in `sources.json` |

Until then: no training run, no benchmark numbers, no signed manifest, no
`model_versions` row. `train.py` refuses without a validated manifest and
`MIN_IMAGES_PER_CLASS = 40` cannot be met.

## 5. Nothing else

Repo, database schema, RLS, catalog seed, all eight Edge Functions, the auth
configuration and the web app deployment are done. Domain (if wanted later):
point DNS at Vercel and add the domain to Supabase → Auth → URL Configuration.
