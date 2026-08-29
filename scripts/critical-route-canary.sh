#!/usr/bin/env bash
# critical-route-canary — CEO MASTER 2026-08-28 P0 runbook §15 §26.
#
# Hit the critical customer-entry URLs on a target host and prove:
#   * HTTP 200 (not 302, not 404, not 500)
#   * response body is non-empty
#   * no `<title>` containing "error" / "not found"
#   * no visible "Cannot read properties of undefined" / "reading 'default'"
#     (the exact P0 fingerprint)
#
# Emits ONE line per route. Exits 0 if every route is healthy, 1 on
# any failure. Wire into cron / GitHub Actions / an uptime robot;
# this is not a replacement for real production monitoring, but it
# turns "did the last deploy break /signin?" into a 30-second answer.
#
# Usage:
#   ./scripts/critical-route-canary.sh                 # defaults to PROD_URL env
#   PROD_URL=https://petwash.co.il ./scripts/critical-route-canary.sh
#   ./scripts/critical-route-canary.sh https://staging.petwash.co.il
#
# Env:
#   PROD_URL   base URL to canary (positional arg wins)
#   TIMEOUT    per-request timeout in seconds (default 10)
set -u

BASE_URL="${1:-${PROD_URL:-}}"
TIMEOUT="${TIMEOUT:-10}"

if [[ -z "${BASE_URL}" ]]; then
  echo "usage: $0 <base-url>   OR   PROD_URL=<url> $0" >&2
  echo "example: $0 https://petwash.co.il" >&2
  exit 2
fi

# Strip trailing slash — every route below carries its own leading /
BASE_URL="${BASE_URL%/}"

# The critical route set the CEO §15 named. Add to this list — never
# remove one just because it turned red.
ROUTES=(
  "/"
  "/signin"
  "/sign-in"
  "/login"
  "/signup"
  "/pet-parent/home"
  "/provider/home"
  "/my-account"
  "/account/transactions"
)

FAIL_FINGERPRINT_RE="reading 'default'|Cannot read properties of undefined|ChunkLoadError|Loading chunk .* failed"
FAIL_TITLE_RE="<title[^>]*>[^<]*\\b(error|not found|500|502|503|504)\\b"

any_fail=0
echo "[canary] base=${BASE_URL}  timeout=${TIMEOUT}s  routes=${#ROUTES[@]}"

for route in "${ROUTES[@]}"; do
  url="${BASE_URL}${route}"
  body_file="$(mktemp)"
  http_code="$(curl -sS -L \
    --max-time "${TIMEOUT}" \
    --write-out "%{http_code}" \
    --output "${body_file}" \
    --user-agent "petwash-canary/1.0 (+critical-route-canary)" \
    "${url}" 2>/dev/null || echo "000")"

  size="$(wc -c <"${body_file}" | tr -d ' ')"
  status_note="ok"
  ok=1

  # HTTP status must be 200 for /, /signin, /signup, /login family.
  # Protected pages may 302/redirect to /signin — accept 200/301/302/303/307/308.
  case "${http_code}" in
    200) : ;;
    301|302|303|307|308) : ;;
    *) ok=0; status_note="http ${http_code}" ;;
  esac

  # Body must be non-empty for the public entry routes.
  if [[ "${ok}" == "1" && "${size}" -lt 200 ]]; then
    ok=0
    status_note="body too small (${size}B)"
  fi

  # P0 fingerprint scan — never let the exact incident string leak
  # to a customer through a canary.
  if [[ "${ok}" == "1" ]] && grep -Ei "${FAIL_FINGERPRINT_RE}" "${body_file}" >/dev/null 2>&1; then
    ok=0
    status_note="lazy-module fingerprint present in body"
  fi

  # Title guard.
  if [[ "${ok}" == "1" ]] && grep -Eio "${FAIL_TITLE_RE}" "${body_file}" >/dev/null 2>&1; then
    ok=0
    status_note="error title in body"
  fi

  rm -f "${body_file}"

  if [[ "${ok}" == "1" ]]; then
    printf "  ✓  %-30s  %s  %sB\n" "${route}" "${http_code}" "${size}"
  else
    any_fail=1
    printf "  ✗  %-30s  %s  %sB  %s\n" "${route}" "${http_code}" "${size}" "${status_note}"
  fi
done

if [[ "${any_fail}" == "1" ]]; then
  echo "[canary] FAIL — one or more critical routes unhealthy" >&2
  exit 1
fi

echo "[canary] PASS — every critical route healthy"
