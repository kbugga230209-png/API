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
3. `[~]` Monorepo scaffold: `packages/core` (domain logic), `packages/foods` (data + recipe calorie engine), `apps/web` (Next.js), `apps/mobile` (Expo), `supabase/`, `ml/`.
4. `[ ]` Version-controlled SQL migrations: profiles, prefs, catalog, logging, billing, entitlements, devices, model versions, diet plans + RLS + storage buckets.
5. `[ ]` Food database: IFCT-derived ingredients + standardized recipe calculation for composite dishes; aliases in 12 Indian languages; variants (homemade/restaurant, oil level, dry/gravy); servings.
6. `[ ]` Edge Functions: `create-subscription`, `create-manual-order`, `verify-payment`, `verify-subscription`, `razorpay-webhook`, `cancel-subscription`, `sync-entitlement` (+ `model-manifest`).
7. `[ ]` Web app (Vercel): landing, download/APK page, auth, scan & confirm, diary, dashboard, weight, Plus paywall, diet planner, settings, privacy.
8. `[ ]` Mobile app (Expo RN): onboarding, AI install screen with progress/SHA-256/atomic install, on-device inference adapter (ONNX/TFLite), offline SQLite + sync outbox, Zustand stores, design tokens, light/dark, Plus theming.
9. `[ ]` ML: training pipeline (EfficientNet-Lite0 INT8 / MobileNetV3-Small INT8 benchmark), dataset/licensing audit, manifest signing + verification, evaluation harness.
10. `[ ]` Tests: TypeScript typecheck, lint, unit (nutrition engine, entitlement machine, manifest verify), SQL/RLS tests executed against the live project, webhook replay tests, Vercel build checks.
11. `[ ]` Vercel preview → production deploy.
12. `[!]` Signed APK + GitHub Release: blocked (no toolchain, no signing key material).
13. `[!]` Live Razorpay: blocked (no keys / no merchant approval evidence).
14. `[!]` Production-grade recognition model: blocked (no licensed Indian food image corpus is reachable from the sandbox network allow-list).

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
