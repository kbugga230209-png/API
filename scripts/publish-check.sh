#!/usr/bin/env bash
# publish-check.sh — can this environment actually write to the six site repos?
#
# Usage: bash scripts/publish-check.sh
#
# Probes a real ref creation on each repo (the only reliable test — the API's
# .permissions field reports the *user's* rights, not the token's) and deletes
# the probe ref immediately afterwards. Nothing else is touched.

set -uo pipefail

OWNER="kbugga230209-png"
KEYS=(heavenly heavenly-site thatminecraft maxxing aioutfit legagme)
repo_for() {
  case "$1" in
    heavenly) echo "Heaven" ;; heavenly-site) echo "Heavenly-site" ;;
    thatminecraft) echo "Heavenly-" ;; maxxing) echo "maxxing" ;;
    aioutfit) echo "AiOutfit" ;; legagme) echo "LegaGMe" ;;
  esac
}

ok=0; bad=0
printf "%-15s %-10s %s\n" "REPO" "WRITE" "DETAIL"
printf "%-15s %-10s %s\n" "---------------" "-----" "------"

for key in "${KEYS[@]}"; do
  repo="$(repo_for "$key")"
  sha="$(gh api "repos/$OWNER/$repo/git/ref/heads/main" --jq .object.sha 2>/dev/null)"
  if [[ -z "$sha" ]]; then
    printf "%-15s %-10s %s\n" "$repo" "?" "cannot read main (check access)"
    bad=$((bad+1)); continue
  fi

  err="$(gh api -X POST "repos/$OWNER/$repo/git/refs" \
          -f ref="refs/heads/arena-write-probe" -f sha="$sha" 2>&1 >/dev/null)"
  if [[ -z "$err" ]]; then
    gh api -X DELETE "repos/$OWNER/$repo/git/refs/heads/arena-write-probe" >/dev/null 2>&1
    printf "%-15s %-10s %s\n" "$repo" "YES" "probe ref created and deleted"
    ok=$((ok+1))
  else
    printf "%-15s %-10s %s\n" "$repo" "NO" "$(echo "$err" | head -1 | cut -c1-90)"
    bad=$((bad+1))
  fi
done

echo ""
if [[ "$bad" -eq 0 ]]; then
  echo "All six repos are writable — run: bash scripts/sync-to-repos.sh --yes"
else
  echo "Writable: $ok   Blocked: $bad"
  echo "The token here cannot write. Grant Contents: Read and write to the GitHub"
  echo "app installation, or run scripts/sync-to-repos.sh where git push works."
  exit 1
fi
