#!/usr/bin/env bash
#
# scripts/sync-gcp-secret.sh — idempotent GCP Secret Manager sync.
#
# THE PROBLEM THIS FIXES
#   .github/workflows/petwash-ci.yml used to call `gcloud secrets versions add`
#   unconditionally for every secret on every CI run. Result: TWILIO_AUTH_TOKEN
#   accumulated 330+ versions in a few weeks, every other secret had similar
#   bloat. Every active version above the first 6 costs ~$0.06/mo, every add
#   pollutes the audit log so real rotation events get drowned in CI noise.
#
# THE FIX
#   Read the current `latest` payload; if it already matches the requested
#   value, do nothing. Only call `versions add` when the value really changed.
#   `gcloud secrets create` is reserved for the case where the secret does
#   not exist yet. Caller behavior is preserved — same exit code semantics:
#     - empty value + secret already exists → leave alone, exit 0
#     - empty value + secret missing       → fail (exit 1) so CI blocks deploy
#
# USAGE
#   PROJECT=signinpetwash \
#   scripts/sync-gcp-secret.sh TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN_VAL"
#
# EXIT CODES
#   0  — unchanged, rotated, created, or "empty but exists"
#   1  — empty value AND no secret in GCP (intentional fail)
#   2  — usage error

set -euo pipefail

NAME="${1:-}"
VALUE="${2:-}"

if [ -z "$NAME" ]; then
  echo "usage: $0 SECRET_NAME VALUE" >&2
  exit 2
fi
if [ -z "${PROJECT:-}" ]; then
  echo "PROJECT env var required" >&2
  exit 2
fi

# No new value passed: just confirm the secret exists, never touch it.
if [ -z "$VALUE" ]; then
  if gcloud secrets describe "$NAME" --project="$PROJECT" --quiet >/dev/null 2>&1; then
    echo "✅ $NAME: empty input; secret already exists in GCP — leaving alone"
    exit 0
  fi
  echo "❌ $NAME: empty input AND secret does not exist in GCP Secret Manager." >&2
  exit 1
fi

# Compare against the current `latest` version's plaintext. If identical, skip.
# `versions access` exits non-zero if the secret does not exist yet — treat
# that as a miss (CURRENT remains empty, the comparison falls through to add).
CURRENT="$(gcloud secrets versions access latest \
            --secret="$NAME" --project="$PROJECT" 2>/dev/null || true)"

if [ "$CURRENT" = "$VALUE" ]; then
  echo "✅ $NAME: unchanged (latest version already matches input)"
  exit 0
fi

# Value changed — add a new version. If the secret itself does not exist, create it.
if printf '%s' "$VALUE" | gcloud secrets versions add "$NAME" \
     --project="$PROJECT" --data-file=- --quiet >/dev/null 2>&1; then
  echo "🔄 $NAME: rotated (new version added — value changed)"
else
  printf '%s' "$VALUE" | gcloud secrets create "$NAME" \
    --project="$PROJECT" --replication-policy=automatic --data-file=- --quiet
  echo "✨ $NAME: created (did not exist in GCP yet)"
fi
