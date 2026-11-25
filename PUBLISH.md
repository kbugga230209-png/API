# Publishing the rebuilds

The six rebuilds are finished and live in this repo under `sites/`. This file is about getting them **into their original repos**.

## Status

| | |
|---|---|
| Rebuilds committed here | ✅ `sites/<key>/`, verified by `--dry-run` against all six repos |
| GitHub App permission (`Contents`) | ✅ **Read and write** — confirmed in installation settings |
| Token issued to this session | ❌ **read-only** — `403 Resource not accessible by integration` on every write |
| Sync script | ✅ verified; sets commit identity, survives per-repo failures |

So the grant is correct and repo access is correct; the token this sandbox receives is scoped down to read-only before it reaches the agent. That is not fixable from installation settings — Route 2 or 3 is the way.

Run `bash scripts/publish-check.sh` any time to re-test all six repos.

## Route 1 — grant write access, then let the agent sync

Already done and confirmed: the installation shows **Read and write access to actions, code, issues, pull requests, and workflows**, and it covers all 7 repos. Re-testing still returns 403, so the token, not the permission, is the limit. Keep this section only as a record of what was ruled out:

1. Open <https://github.com/settings/installations/158123716>
2. Under **Permissions**, set **Contents → Read and write**, save.
3. Come back and say "done" — the agent re-runs `publish-check.sh` and, if it passes, `sync-to-repos.sh --yes`.

If GitHub shows **Contents** as read-only and won't let you change it, that permission is declared by the Arena app itself, not by your installation — in that case use Route 2 or 3.

## Route 2 — run one command yourself (guaranteed)

One paste, in any terminal where `git push` already works for your account. Verified against a fresh clone of this branch:

```bash
git clone -b arena/7a52f1c4-api https://github.com/kbugga230209-png/API.git heavenly \
  && cd heavenly && bash scripts/sync-to-repos.sh
```

Add `--dry-run` before the run to preview all six diffs without pushing anything.

Or a single repo: `bash scripts/sync-to-repos.sh maxxing`

What it does per repo: clone → replace working tree with `sites/<key>/` (removing dead files like the extensionless `Heaven` and AiOutfit's 1-byte backend stubs) → commit on top of existing history → push to `main`. GitHub Pages rebuilds in about a minute.

## Route 3 — publish live on Vercel instead

If you just want working URLs now: the Vercel app is connected (hobby plan, no projects yet) and the hub is a static site, so the whole thing — hub plus all six realms — deploys as one project in a couple of minutes. Ask the agent to deploy it.

## After publishing

Pages URLs once the push lands:

- https://kbugga230209-png.github.io/Heaven/
- https://kbugga230209-png.github.io/Heavenly-site/
- https://kbugga230209-png.github.io/Heavenly-/
- https://kbugga230209-png.github.io/maxxing/
- https://kbugga230209-png.github.io/AiOutfit/
- https://kbugga230209-png.github.io/LegaGMe/

The hub itself can be hosted from this repo:

```bash
gh api -X POST repos/kbugga230209-png/API/pages -f 'source[branch]=main' -f 'source[path]=/'
```
