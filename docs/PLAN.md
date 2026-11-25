# BharatBite — Implementation Plan

Status legend: `[x]` done & verified · `[~]` in progress · `[ ]` not started · `[!]` blocked externally

## 0. Infrastructure (verified via connectors)

| Resource | State |
| --- | --- |
| GitHub repo | `kbugga230209-png/API` (was empty — placeholder README only) |
| Working branch | `arena/1a49ed4f-api` (branched from `main` @ `dc09958`) |
| Supabase org | `kbugga230209-png's Org` (`ndefgopxrbcpnwdvjmyp`) |
| Supabase project | **created** `bharatbite` — ref `xetdzgsbzjctenhelaki`, region `ap-south-1`, status `ACTIVE_HEALTHY` |
| Vercel team | `kbugga230209-png's projects` (`team_sEVb6krtaA6CiC4JWYneC2ES`), hobby plan, 0 projects before this work |
| Razorpay | **no connector available** — code written against documented REST API, test-mode only. Owner must supply keys. |
| Android toolchain | **absent** (no JDK / Android SDK in sandbox) — APK build requires owner machine or CI runner |

## 1. Work stages

1. `[x]` Inspect connected GitHub / Supabase / Vercel / toolchain state.
2. `[x]` Provision Supabase project (ap-south-1).
3. `[x]` Monorepo scaffold: `packages/core` (domain logic), `packages/foods` (data + recipe calorie engine), `apps/web` (Next.js), `supabase/`. `apps/mobile` and `ml/` still to come.
4. `[x]` Version-controlled SQL migrations (`supabase/migrations/0001`–`0009`) + all six applied to the live project + RLS verified empirically.
5. `[x]` Food database: 226 foods / 352 variants / 471 aliases / 604 servings, seeded to Supabase, `search_foods` alias-aware.
6. `[x]` Edge Functions (deployed and ACTIVE; payment paths fail closed until keys exist): `create-subscription`, `create-manual-order`, `verify-payment`, `verify-subscription`, `razorpay-webhook`, `cancel-subscription`, `sync-entitlement` (+ `model-manifest`).
7. `[~]` Web app (`apps/web`): landing, food database, download page, privacy, auth, dashboard, diary, planner, Plus checkout, settings, account/export, PWA shell — **built and smoke-tested**, not yet deployed. Scan & confirm is deferred to the mobile app (photos stay on device).
8. `[ ]` Mobile app (Expo RN): onboarding, AI install screen with progress/SHA-256/atomic install, on-device inference adapter (ONNX/TFLite), offline SQLite + sync outbox, Zustand stores, design tokens, light/dark, Plus theming.
9. `[ ]` ML: training pipeline (EfficientNet-Lite0 INT8 / MobileNetV3-Small INT8 benchmark), dataset/licensing audit, manifest signing + verification, evaluation harness.
10. `[ ]` Tests: TypeScript typecheck, lint, unit (nutrition engine, entitlement machine, manifest verify), SQL/RLS tests executed against the live project, webhook replay tests, Vercel build checks.
11. `[ ]` Vercel preview → production deploy.
12. `[!]` Signed APK + GitHub Release: blocked (no toolchain, no signing key material).
13. `[!]` Live Razorpay: blocked (no keys / no merchant approval evidence).
14. `[!]` Publish a `model_versions` row so `model-manifest` stops returning 404 — needs a real artifact + Ed25519 signature, which needs the training run in step 9.
15. `[!]` Production-grade recognition model: blocked (no licensed Indian food image corpus is reachable from the sandbox network allow-list).

## 2. Architecture decisions

- **Monorepo, npm workspaces.** `packages/core` and `packages/foods` are pure TypeScript with zero runtime deps so they compile for both web and React Native (Hermes-safe, no Node built-ins at import time; crypto is injected).
- **Nutrition truth lives in one engine** (`packages/core/src/nutrition`): per-100g canonical values → portion scaling → meal/day rollups. The database stores per-100g values and per-log *snapshots* so historical logs never change when a food record is corrected.
- **Composite Indian dishes are computed, not guessed.** `packages/foods/data/dishes.json` declares a standardized recipe (raw ingredient grams + household measure + cooked yield). The engine computes per-100g energy/macros from IFCT-derived ingredient values. Every row carries `source` + `methodology` + `verification_status`.
- **Offline-first.** Client generates UUIDv7 ids, writes to SQLite, enqueues into an outbox, pushes to Supabase when online. `food_logs` has `client_created_at`, `updated_at`, `deleted_at` for last-write-wins sync.
- **Entitlements are server-authoritative.** Only `service_role` can write `entitlements`, `payments`, `payment_events`, `subscriptions`. The client never unlocks Plus from a success callback; it polls `entitlements` after Razorpay verification and the webhook is the source of truth.
- **Model delivery is signed.** Manifest is Ed25519-signed; the app verifies the signature with an embedded public key, then verifies SHA-256 of the downloaded artifact before atomic rename. Private signing key is never in the repo.
- **Privacy.** Meal photos stay on device; the web scan flow runs entirely client-side. Uploads happen only to a user-scoped private bucket after explicit consent.

## 3. External blockers (exact asks for the owner)

See `docs/BLOCKERS.md`.

## 4. Web app (apps/web) — what shipped

- **Stack:** Next.js 15.5.29 App Router, React 19, `@supabase/ssr` 0.7-style cookie auth (session refreshed in `middleware.ts`), no client-side secrets.
- **Routes:** `/` (marketing), `/foods` + `/foods/[slug]`, `/download`, `/privacy`, `/login`, `/auth/callback`, `/app` (dashboard), `/app/diary`, `/app/planner`, `/app/plus`, `/app/settings`, `/app/account`, `/app/onboarding`, `/api/export`, `/offline`, `robots.txt`, `sitemap.xml` (226 food URLs).
- **Two data paths:** Postgres first (`search_foods` RPC + joins), compiled catalog second (`searchFoods` from `@bharatbite/core`). Search and food pages work offline and in preview environments with no DB egress; writing always requires the server.
- **Server actions only for writes** — logging, deletes, weights, preferences, plan generation. Portions are scaled with `scaleNutrition` from the same engine the mobile app uses, so a 146 g katori of dal is identical everywhere.
- **Planner is gated on `has_plus_access()`** at the database *and* in the route; the plan is persisted as `diet_plans` + `diet_plan_meals` + `grocery_items` so it survives reloads and can be logged one meal at a time.
- **Payments:** amounts are fixed server-side in the Edge Functions; the browser receives only `order_id`, `amount_paise`, `key_id`. 503 `razorpay_not_configured` is surfaced as "nothing was charged".
- **PWA:** `app/manifest.webmanifest`, service worker (network-first navigations, cache-first static, `/offline` fallback), generated PNG icons via `scripts/gen-icons.mjs`, installable with `start_url=/app`.
- **Honest surfaces:** `/download` states no signed APK exists; `/privacy` describes real behaviour; `/app/account` says account deletion is a data wipe plus a manual request.
