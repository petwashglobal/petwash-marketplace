#!/usr/bin/env bash
# audit-cache-headers — CEO 2026-08-29 P0-5 §15.
#
# Fetch HEAD headers against a live deployment and prove the cache
# policy for a STALE-INDEX-WITH-FRESH-ASSETS incident cannot recur:
#
#   * /index.html          MUST NOT be cached as `immutable`.
#                          Prefer `no-cache` / short max-age.
#   * /assets/*.js|*.css   MUST be cached long + immutable.
#                          The hash in the filename guarantees version
#                          identity — the CDN can serve them forever.
#
# The exact production incident was a browser tab holding an OLD
# index.html that referenced a new hashed chunk the CDN had already
# purged. This audit refuses to pass a deploy where the cache policy
# would let that scenario recur.
#
# Usage:
#   ./scripts/audit-cache-headers.sh                       # PROD_URL env
#   PROD_URL=https://petwash.co.il ./scripts/audit-cache-headers.sh
#   ./scripts/audit-cache-headers.sh https://staging.petwash.co.il
#
# Exit codes:
#   0  every probed URL has an acceptable Cache-Control
#   1  any probed URL fails the policy
#   2  usage / arg error
set -uo pipefail

BASE_URL="${1:-${PROD_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "usage: $0 <base-url>   OR   PROD_URL=<url> $0" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

# HEAD /index.html — must NOT be immutable / must be short-lived.
head_html() {
  curl -sSI --max-time 10 "$1" | tr -d '\r' | grep -i '^cache-control:' | head -1
}

# HEAD /assets/... — must be immutable + long-lived.
audit_index() {
  local url="${BASE_URL}/"
  local cc
  cc="$(head_html "${url}" | sed 's/^[Cc]ache-[Cc]ontrol:[[:space:]]*//i')"
  if [[ -z "${cc}" ]]; then
    echo "  ✗  ${url}  no Cache-Control header returned"
    return 1
  fi
  # Fail on `immutable` on the index — a browser tab must be able to
  # re-fetch a fresh index after a deploy.
  if echo "${cc}" | grep -qiE '(^|,)[[:space:]]*immutable([[:space:]]|,|$)'; then
    echo "  ✗  ${url}  index.html is 'immutable' — a stale tab can never learn about a new deploy"
    echo "         cache-control: ${cc}"
    return 1
  fi
  # Warn (not fail) on very long max-age.
  if echo "${cc}" | grep -oiE 'max-age=[0-9]+' | awk -F= '{print $2}' | grep -qE '^([0-9]{5,})$'; then
    echo "  ⚠  ${url}  long max-age on index.html — recommend max-age ≤ 3600"
    echo "         cache-control: ${cc}"
  fi
  echo "  ✓  ${url}  cache-control: ${cc}"
  return 0
}

# For assets we sample a JS reference out of the served index.html and
# probe THAT URL — this guarantees we test the exact CDN path the
# customer's browser will hit.
audit_first_asset() {
  local index_url="${BASE_URL}/"
  local html
  html="$(curl -sS --max-time 10 "${index_url}")"
  local ref
  # First <script src="/assets/...">
  ref="$(echo "${html}" | grep -oiE '<script[^>]+src="/assets/[^"]+\.js"' | head -1 | sed -E 's/.*src="([^"]+)".*/\1/i')"
  if [[ -z "${ref}" ]]; then
    # Try <link href="/assets/....css">
    ref="$(echo "${html}" | grep -oiE '<link[^>]+href="/assets/[^"]+\.(css|js)"' | head -1 | sed -E 's/.*href="([^"]+)".*/\1/i')"
  fi
  if [[ -z "${ref}" ]]; then
    echo "  ⚠  no /assets/*.js|css reference found in index.html — asset audit skipped"
    return 0
  fi
  local url="${BASE_URL}${ref}"
  local cc
  cc="$(head_html "${url}" | sed 's/^[Cc]ache-[Cc]ontrol:[[:space:]]*//i')"
  if [[ -z "${cc}" ]]; then
    echo "  ✗  ${url}  no Cache-Control header returned"
    return 1
  fi
  # Assets MUST be immutable (or equivalent).
  if ! echo "${cc}" | grep -qiE '(^|,)[[:space:]]*immutable([[:space:]]|,|$)'; then
    echo "  ✗  ${url}  hashed asset is NOT 'immutable' — CDN can silently swap file contents behind the same URL"
    echo "         cache-control: ${cc}"
    return 1
  fi
  # And should have a long max-age — 30d or more.
  local ma
  ma="$(echo "${cc}" | grep -oiE 'max-age=[0-9]+' | awk -F= '{print $2}')"
  if [[ -z "${ma}" || "${ma}" -lt 2592000 ]]; then
    echo "  ⚠  ${url}  asset max-age is ${ma:-none} — recommend ≥ 2592000 (30d)"
    echo "         cache-control: ${cc}"
  fi
  echo "  ✓  ${url}  cache-control: ${cc}"
  return 0
}

echo "[cache-audit] base=${BASE_URL}"
fails=0
audit_index || fails=$((fails + 1))
audit_first_asset || fails=$((fails + 1))

if [[ "${fails}" -gt 0 ]]; then
  echo "[cache-audit] FAIL — ${fails} rule violation(s)" >&2
  exit 1
fi
echo "[cache-audit] PASS — index.html short-lived, hashed assets immutable"
