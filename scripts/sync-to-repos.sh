#!/usr/bin/env bash
# sync-to-repos.sh — port each rebuilt site from this hub back to its original repo.
#
# Usage:
#   bash scripts/sync-to-repos.sh --dry-run   # show what would change, push nothing
#   bash scripts/sync-to-repos.sh             # sync all six repos (asks once)
#   bash scripts/sync-to-repos.sh maxxing     # sync just one site key
#
# Site keys: heavenly heavenly-site thatminecraft maxxing aioutfit legagme
#
# Requires: git with push access to github.com/kbugga230209-png (gh auth login or a credential helper).
# Each repo's default branch is replaced with the contents of sites/<key>/ plus its README.
# History is preserved — this is a normal commit on top of whatever is there.

set -euo pipefail

OWNER="kbugga230209-png"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
ONLY=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) ONLY="$arg" ;;
  esac
done
ASSUME_YES="${ASSUME_YES:-0}"

# site key -> repo name
KEYS=(heavenly heavenly-site thatminecraft maxxing aioutfit legagme)
repo_for() {
  case "$1" in
    heavenly)       echo "Heaven" ;;
    heavenly-site)  echo "Heavenly-site" ;;
    thatminecraft)  echo "Heavenly-" ;;
    maxxing)        echo "maxxing" ;;
    aioutfit)       echo "AiOutfit" ;;
    legagme)        echo "LegaGMe" ;;
    *) echo "" ;;
  esac
}

if [[ -n "$ONLY" && -z "$(repo_for "$ONLY")" ]]; then
  echo "Unknown site key: $ONLY" >&2
  echo "Valid keys: ${KEYS[*]}" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "0" && "$ASSUME_YES" == "0" ]]; then
  echo "This will commit and push the rebuilt sites to:"
  for k in "${KEYS[@]}"; do
    [[ -n "$ONLY" && "$k" != "$ONLY" ]] && continue
    echo "  - github.com/$OWNER/$(repo_for "$k")"
  done
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Aborted."; exit 0; }
fi

# Commit author. Fresh clones have no identity, so fall back to the authenticated
# GitHub account (never overwrites an identity the repo or the user already set).
GH_USER="$(gh api user --jq .login 2>/dev/null || echo "$OWNER")"
IDENT_NAME="${GIT_AUTHOR_NAME:-$(git config --global user.name 2>/dev/null || echo "$OWNER")}"
IDENT_EMAIL="${GIT_AUTHOR_EMAIL:-$(git config --global user.email 2>/dev/null || echo "$GH_USER@users.noreply.github.com")}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILED=()

for key in "${KEYS[@]}"; do
  [[ -n "$ONLY" && "$key" != "$ONLY" ]] && continue
  repo="$(repo_for "$key")"
  src="$ROOT/sites/$key"
  dst="$WORK/$repo"

  echo ""
  echo "=== $key -> $OWNER/$repo ==="
  [[ -d "$src" ]] || { echo "Missing $src — skipping" >&2; continue; }

  git clone --quiet "https://github.com/$OWNER/$repo.git" "$dst"
  branch="$(git -C "$dst" rev-parse --abbrev-ref HEAD)"

  # Replace working tree (keep .git): removes dead files like the extensionless
  # 'Heaven' file and AiOutfit's empty backend/ + database/ stubs.
  find "$dst" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
  cp -R "$src/." "$dst/"

  git -C "$dst" add -A
  if git -C "$dst" diff --cached --quiet; then
    echo "Already up to date."
    continue
  fi

  # Ensure this clone can commit even with no global identity configured.
  git -C "$dst" config user.name "$IDENT_NAME"
  git -C "$dst" config user.email "$IDENT_EMAIL"

  echo "Changes:"
  git -C "$dst" diff --cached --stat | sed 's/^/  /'

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] would commit + push to $branch — nothing pushed."
  else
    git -C "$dst" commit -q -F - <<'MSG'
100x rebuild: see AUDIT.md in kbugga230209-png/API

Ported from the Heavenly Universe hub:
- fixed live-site bugs, dead code and broken assets
- performance, mobile, accessibility and metadata upgrades
- self-contained and GitHub-Pages-ready
MSG
    if git -C "$dst" push origin "$branch"; then
      echo "Pushed to $OWNER/$repo ($branch). Pages will rebuild in ~1 minute."
    else
      # A read-only token or missing write access lands here — keep going so the
      # other repos still sync, and report every failure at the end.
      echo "PUSH FAILED: $OWNER/$repo" >&2
      FAILED+=("$repo")
    fi
  fi
done

if [[ "${#FAILED[@]}" -gt 0 ]]; then
  echo ""
  echo "Could not push to: ${FAILED[*]}" >&2
  echo "Most likely the GitHub credential in use has read-only access to those repos." >&2
  echo "Either reconnect GitHub with write access, or run this script from a machine" >&2
  echo "where 'git push' already works (e.g. your laptop with your own credentials)." >&2
  exit 1
fi

echo ""
echo "Done. Tip: enable GitHub Pages on the API repo too, to host the hub itself:"
echo "  gh api -X POST repos/$OWNER/API/pages -f 'source[branch]=main' -f 'source[path]=/'"
