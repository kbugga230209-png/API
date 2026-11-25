# Publishing the rebuilds

The six rebuilds are finished and live in this repo under `sites/`. This file is about getting them **into their original repos**.

## Status

| | |
|---|---|
| Rebuilds committed here | ✅ `sites/<key>/`, verified by `--dry-run` against all six repos |
| GitHub write access from this session | ❌ **blocked** — read-only app token (`403 Resource not accessible by integration`) |
| Sync script | ✅ verified; sets commit identity, survives per-repo failures |

Run `bash scripts/publish-check.sh` any time to see the current answer for all six repos.

## Route 1 — grant write access, then let the agent sync

The GitHub connection here is a GitHub App installation (**id `158123716`**) that covers all 7 repos but holds read-only contents.

1. Open <https://github.com/settings/installations/158123716>
2. Under **Permissions**, set **Contents → Read and write**, save.
3. Come back and say "done" — the agent re-runs `publish-check.sh` and, if it passes, `sync-to-repos.sh --yes`.

If GitHub shows **Contents** as read-only and won't let you change it, that permission is declared by the Arena app itself, not by your installation — in that case use Route 2 or 3.

## Route 2 — run one command yourself (guaranteed)

Anywhere `git push` already works for your account:

```bash
git clone https://github.com/kbugga230209-png/API.git
cd API
git checkout arena/7a52f1c4-api
bash scripts/sync-to-repos.sh --dry-run   # preview all six diffs, push nothing
bash scripts/sync-to-repos.sh             # commit + push all six
```

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
