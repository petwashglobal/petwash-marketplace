#!/usr/bin/env bash
#
# Post-release 2026-09-03 (backlog P1): auth-route cache-header audit.
#
# Reclaimed from closed PR #2169 (deploy-hardening lane). The
# specific class of failure this prevents:
#
#   • Firebase Hosting caches /signin's index.html for 60s.
#   • A user hits /signin, gets index.html with a stale asset ref.
#   • A newer revision is promoted; old chunk deleted.
#   • Browser loads stale HTML → 404 on the referenced chunk → crash.
#
# The fix is that every auth-route HTML response MUST set
# Cache-Control: no-store (or equivalent no-cache + must-revalidate).
# This script asserts that at deploy time.
#
# Usage: scripts/audit-cache-headers.sh https://petwash.co.il
#
# Zero deps beyond bash + curl.

set -o pipefail

BASE="${1:-https://petwash.co.il}"
BASE="${BASE%/}"

echo "[audit-cache-headers] base=$BASE at $(date -u +%FT%TZ)"

declare -a ROUTES=("/" "/signin" "/signup" "/sign-in" "/login")
declare -a FAILURES=()

for path in "${ROUTES[@]}"; do
  url="${BASE}${path}"
  headers="$(curl -sS -I -L --max-time 20 "$url" || echo '')"
  if [ -z "$headers" ]; then
    FAILURES+=("$path: no response")
    continue
  fi

  cc="$(echo "$headers" | tr -d '\r' | awk 'tolower($1) == "cache-control:" { $1=""; sub(/^ +/,""); print; exit }')"

  ok=0
  if echo "$cc" | grep -qiE 'no-store'; then ok=1; fi
  if echo "$cc" | grep -qiE 'no-cache'; then ok=1; fi
  if echo "$cc" | grep -qiE 'max-age=0' && echo "$cc" | grep -qiE 'must-revalidate'; then ok=1; fi

  if [ "$ok" -eq 1 ]; then
    echo "  ✔ ${path} · Cache-Control: ${cc:-<none>}"
  else
    FAILURES+=("$path: Cache-Control='${cc:-<absent>}' — expected no-store / no-cache / max-age=0+must-revalidate")
  fi
done

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo
  echo "[audit-cache-headers] ❌ ${#FAILURES[@]} auth-route(s) with unsafe cache:" >&2
  for f in "${FAILURES[@]}"; do
    echo "  - $f" >&2
  done
  echo
  echo "Unsafe cache on an auth-route HTML page means a stale index.html can" >&2
  echo "reference an already-pruned lazy chunk → 404 → tree crash. Fix hosting" >&2
  echo "or middleware to send Cache-Control: no-store on /, /signin, /signup." >&2
  exit 1
fi

echo
echo "[audit-cache-headers] ✅ every auth route sends a cache-safe header."
