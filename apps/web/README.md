# @bharatbite/web

The BharatBite web application: marketing site, installable PWA, auth, diary,
dashboard, diet planner, Plus checkout and account/data controls. Next.js 15 App
Router, React 19, Supabase for auth/Postgres/storage, Razorpay via Edge Functions.

## Layout

```
app/
  page.tsx                 marketing home (free vs Plus, catalog showcase)
  foods/                   searchable catalog + per-food detail and logging
  download/page.tsx        Android distribution page (honest about no APK yet)
  privacy/page.tsx         what is stored, where, and how to delete it
  login/page.tsx           sign in / sign up (server actions)
  auth/callback/route.ts   email-confirmation code exchange (+ PKCE cookies)
  app/                     authenticated shell
    page.tsx               dashboard: energy, macros, meals, weight
    diary/page.tsx         day picker, search-to-log, delete entries
    planner/page.tsx       Plus-gated 7-day plan, one-tap logging, grocery list
    plus/page.tsx          pricing + Razorpay checkout
    settings/page.tsx      body/goal/preferences → daily targets
    account/page.tsx       export, billing status, delete data
    onboarding/page.tsx    four-field baseline right after signup
  api/export/route.ts      CSV / JSON export of the user's own rows
  offline/page.tsx         service-worker fallback
  robots.ts, sitemap.ts    SEO (sitemap includes all 226 foods)
components/                nav, footer, theme toggle, checkout, subscription mgmt
lib/
  config.ts                public Supabase URL/key, prices, links
  supabase/{client,server}.ts  browser client + cookie-bound server client
  data.ts                  every read: search, diary, weights, plans, entitlement
  actions.ts               every write: auth, logging, weights, prefs, planner
  catalog.ts               the compiled catalog (226 foods) used offline
middleware.ts              session refresh + /app guard
public/                    manifest, service worker, generated PNG icons
scripts/gen-icons.mjs      regenerates icons/ without an image dependency
```

## Why there are two data paths

`lib/data.ts` prefers Postgres (`search_foods` RPC, joins over
`food_items`/`food_variants`/`food_nutrition`) and falls back to the catalog
compiled into the bundle. Search, food pages and portion maths therefore work
with the network down or the database slow — and the marketing site can render
real rows without a query per request. The server is still the only writer.

## Environment

Both values have usable defaults for the `bharatbite` project, so the app builds
with no env at all. Override them in Vercel if you point at another project:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable anon key>
```

No secret key, service-role key or Razorpay secret belongs in this app. Payments
are created and verified by Edge Functions (`create-manual-order`,
`create-subscription`, `verify-payment`, `cancel-subscription`,
`sync-entitlement`); the browser only ever receives an order id and the public
key id.

## Commands

```bash
npm run build:app          # from the repo root: core → foods → web
npm run dev:web            # http://localhost:3000
npm run typecheck          # tsc for all three workspaces
node apps/web/scripts/gen-icons.mjs   # regenerate PWA icons
```

## Deploying to Vercel

Set the project's **Root Directory** to `apps/web` and keep "Include files
outside the Root Directory" on — `vercel.json` then installs from the repo root
(`npm ci`, workspaces) and runs `npm run build:app`, which compiles
`@bharatbite/core` and `@bharatbite/foods` before `next build`.

After the first deploy, add the resulting domains to Supabase →
Authentication → URL Configuration (`site_url` plus the `https://*-….vercel.app/auth/callback`
wildcard that is already allowed).

## Known gaps

- **No signed Android APK is published.** The download page says so instead of
  offering an unverified binary.
- **Payments fail closed.** Until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
  `RAZORPAY_WEBHOOK_SECRET` are set as Supabase secrets, the checkout shows a
  clear "not configured, nothing was charged" message (HTTP 503).
- **`model-manifest` returns 404** because no `model_versions` row is published
  yet; the app falls back to manual search instead of downloading a model.
- Account deletion is a data wipe plus a manual request — we do not claim
  self-service account deletion in the UI.
