# BharatBite

India-first food recognition and nutrition tracking. Built around roti, dal, sabzi,
thepla, dosa and the thousand variations in between — not a Western tracker with a
few Indian rows bolted on.

**Live:** https://bharatbite.vercel.app · **Database:** Supabase `ap-south-1`

## What works today

| Area | State |
| --- | --- |
| Food catalog | 226 foods · 352 preparations · 471 regional aliases · 604 servings |
| Nutrition engine | per-100 g canonical values, portion scaling, day rollups, 38 unit tests |
| Web app | marketing, searchable catalog, auth, dashboard, diary, planner, Plus checkout, account/export, PWA |
| Database | 6 applied migrations, RLS verified empirically (cross-user writes rejected), alias-aware `search_foods` |
| Edge Functions | 8 deployed: payments, webhooks, entitlement sync, model manifest |
| Android APK | **not published** — no toolchain or signing key in this environment |
| Payments | **code complete, keys missing** — fails closed with 503, never silently succeeds |
| Recognition model | **not trained** — `model-manifest` returns 404 and the app falls back to search |

`docs/BLOCKERS.md` lists the four things only the owner can supply, with the exact
commands and the real behaviour until each is resolved.

## Layout

```
apps/web              Next.js 15 PWA (see apps/web/README.md)
packages/core         pure TypeScript domain logic: nutrition, goals, entitlements,
                      model manifest, diary, search, diet planner  (38 tests)
packages/foods        catalog build + recipe calorie engine, checked-in JSON sources
                      and generated artifacts  (11 tests)
supabase/migrations   schema 0001–0009, RLS policies, helper functions
supabase/functions    Deno Edge Functions (Razorpay, entitlements, model manifest)
supabase/seed         reproducible catalog loader
docs                  PLAN.md (stages, decisions, infra) and BLOCKERS.md
```

## Develop

```bash
npm install
npm run build:core && npm run build -w @bharatbite/foods   # compile the two libraries
npm run dev:web                                            # http://localhost:3000
npm test                                                   # 38 + 11 tests
npm run typecheck                                          # all three workspaces
npm run seed:generate                                      # rebuild catalog artifacts + SQL seed
```

The web app builds with no environment variables; it falls back to the public
Supabase project and to the catalog compiled into the bundle. To point it
elsewhere, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(see `apps/web/.env.example`). No secret key ever belongs in the client.

## Data honesty rules

- Every nutrition row records `source`, `methodology` (`ifct_value`,
  `standardized_recipe_calculation`, …) and a verification status. Provisional
  rows are labelled as provisional in the UI.
- Composites are computed from weighted raw ingredients and a cooked edible
  yield, never estimated per dish.
- A photo cannot see how much oil went into the tadka, so the app asks
  (homemade / restaurant / low-oil) instead of guessing.
- We do not ship an unsigned APK, a fake payment success, or a model manifest
  pointing at a model that does not exist.

Not medical advice. Talk to a doctor or registered dietitian for clinical
nutrition.
