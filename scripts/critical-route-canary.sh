#!/usr/bin/env bash
#
# Post-release 2026-09-03 (backlog P1): critical-route canary.
#
# Reclaimed from closed PR #2169 (deploy-hardening lane).
# Post-deploy smoke that hits the critical public routes against
# the LIVE hostname and asserts:
#   1. HTTP 200 or a 3xx that ultimately resolves 200.
#   2. Response body is HTML (not an origin error page).
#   3. Body carries the app shell marker `<div id="root"` — the
#      absence of it is the exact signature of a bad build serving
#      the raw error page.
#   4. First JS asset referenced by the HTML is reachable + non-empty.
#
# Same discipline as release-smoke.yml but as a stand-alone shell
# so an ops human on a laptop can run it after a rollback.
#
# Usage: scripts/critical-route-canary.sh https://petwash.co.il
#
# Zero deps beyond bash + curl + grep + sed.

set -o pipefail

BASE="${1:-https://petwash.co.il}"
BASE="${BASE%/}"

echo "[critical-route-canary] base=$BASE at $(date -u +%FT%TZ)"

declare -a ROUTES=("/" "/signin" "/signup")
declare -a FAILURES=()

for path in "${ROUTES[@]}"; do
  url="${BASE}${path}"
  # -L follows redirects; --write-out prints the effective code.
  body_and_code="$(curl -sS -L --max-time 25 -w '\n__HTTP_CODE__%{http_code}' "$url" || echo '')"
  if [ -z "$body_and_code" ]; then
    FAILURES+=("$path: no response")
    continue
  fi

  code="$(echo "$body_and_code" | grep -o '__HTTP_CODE__[0-9]*$' | sed 's/__HTTP_CODE__//' )"
  body="$(echo "$body_and_code" | sed 's/__HTTP_CODE__[0-9]*$//' )"

  if [ "$code" != "200" ]; then
    FAILURES+=("$path: HTTP $code")
    continue
  fi

  # App shell marker — the React root div. If it's absent, we're
  # serving an origin/CDN error page.
  if ! echo "$body" | grep -qiE '<div[^>]+id=["'\'']root["'\'']'; then
    FAILURES+=("$path: response missing <div id=\"root\"> — origin error page?")
    continue
  fi

  # First JS asset referenced. Confirm it's reachable + non-empty
  # (catches the stale-chunk 404 the release runbook fears).
  asset="$(echo "$body" | grep -oE '<script[^>]+src=["'\'']/assets/[A-Za-z0-9_.\-]+\.js["'\'']' | head -1 | grep -oE '/assets/[A-Za-z0-9_.\-]+\.js' | head -1)"
  if [ -z "$asset" ]; then
    echo "  ✔ ${path} · shell rendered (no /assets/*.js ref found, skipping asset check)"
    continue
  fi
  asset_url="${BASE}${asset}"
  bytes="$(curl -sS -L --max-time 20 -o /dev/null -w '%{size_download}' "$asset_url" || echo 0)"
  if [ -z "$bytes" ] || [ "$bytes" -lt 200 ]; then
    FAILURES+=("$path: first JS asset $asset served ${bytes:-0} bytes")
    continue
  fi
  echo "  ✔ ${path} · HTTP 200 + shell + asset ${asset} (${bytes} bytes)"
done

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo
  echo "[critical-route-canary] ❌ ${#FAILURES[@]} route(s) failed:" >&2
  for f in "${FAILURES[@]}"; do
    echo "  - $f" >&2
  done
  exit 1
fi

echo
echo "[critical-route-canary] ✅ every critical route rendered and served its first asset."
