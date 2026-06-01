#!/usr/bin/env bash
#
# scripts/prune-gcp-secret-versions.sh — one-shot bulk cleanup of bloated
# GCP Secret Manager versions.
#
# CONTEXT
#   .github/workflows/petwash-ci.yml used to call `gcloud secrets versions add`
#   unconditionally on every CI run, accumulating 300+ versions per secret.
#   The fix that stops new bloat lives in `scripts/sync-gcp-secret.sh` (called
#   from petwash-ci.yml since commit e232c58ad). This script cleans up the
#   historical accumulation that the bug already produced.
#
#   The latest N versions are kept live — N defaults to 6, matching GCP's
#   "first 6 active versions are free" tier. Anything older is destroyed.
#   Already-destroyed versions are skipped.
#
# USAGE
#   PROJECT=signinpetwash bash scripts/prune-gcp-secret-versions.sh
#   PROJECT=signinpetwash KEEP=10 bash scripts/prune-gcp-secret-versions.sh
#   PROJECT=signinpetwash DRY_RUN=1 bash scripts/prune-gcp-secret-versions.sh
#   PROJECT=signinpetwash SECRETS="TWILIO_AUTH_TOKEN GEMINI_API_KEY" \
#       bash scripts/prune-gcp-secret-versions.sh   # subset
#
# SAFETY
#   * Always keeps the latest KEEP ENABLED versions — never destroys
#     v(latest), so the live secret keeps working.
#   * ALL DISABLED versions are destroyed (they're still billable but
#     never served, so there's no reason to keep them around). Set
#     PRESERVE_DISABLED=1 to opt out and leave Disabled versions alone.
#   * Skips versions already in DESTROYED state.
#   * DRY_RUN=1 prints what it WOULD do without touching anything.
#   * Per-version destroy uses `--quiet` to avoid an interactive prompt.
#   * Versions destroyed by GCP are SOFT-DELETED for 30 days; recovery is
#     a `gcloud secrets versions enable` away during that window.

set -euo pipefail

if [ -z "${PROJECT:-}" ]; then
  echo "PROJECT env var required (e.g. PROJECT=signinpetwash)" >&2
  exit 2
fi

KEEP="${KEEP:-6}"
DRY_RUN="${DRY_RUN:-0}"
PRESERVE_DISABLED="${PRESERVE_DISABLED:-0}"

# Default list: everything petwash-ci.yml used to bloat. Override via SECRETS.
DEFAULT_SECRETS=(
  TWILIO_AUTH_TOKEN
  TWILIO_ACCOUNT_SID
  TWILIO_PHONE_NUMBER
  TWILIO_MESSAGING_SERVICE_SID
  GEMINI_API_KEY
  SENDGRID_API_KEY
  RECAPTCHA_SECRET_KEY
  GOOGLE_MAPS_API_KEY
  GOOGLE_SERVICE_ACCOUNT_JSON
  SUPER_ADMIN_EMAILS
  FIREBASE_WEB_API_KEY
  FIREBASE_PROJECT_ID
  FIREBASE_MESSAGING_SENDER_ID
  FIREBASE_APP_ID
  FIREBASE_MEASUREMENT_ID
  REDIS_URL
  SLACK_WEBHOOK_URL
  TRANZILA_TERMINAL_NAME
  TRANZILA_API_KEY
  TRANZILA_WEBHOOK_SECRET
  TRANZILA_TERMINAL_PASSWORD
  TRANZILA_ALLOWED_IPS
  TRANZILA_MARKETPLACE_ENABLED
  TRANZILA_WALLET_TOPUP_ENABLED
  TRANZILA_PAYMENT_REQUESTS_ENABLED
)

if [ -n "${SECRETS:-}" ]; then
  read -r -a SECRETS_ARR <<< "$SECRETS"
else
  SECRETS_ARR=("${DEFAULT_SECRETS[@]}")
fi

echo "================================================================"
echo "  GCP Secret Manager version pruner"
echo "  Project:           $PROJECT"
echo "  Keep:              latest $KEEP ENABLED versions per secret"
echo "  Disabled versions: $([ "$PRESERVE_DISABLED" = "1" ] && echo "PRESERVED" || echo "destroyed (set PRESERVE_DISABLED=1 to keep)")"
echo "  Dry run:           $DRY_RUN"
echo "  Targets:           ${#SECRETS_ARR[@]} secret(s)"
echo "================================================================"

TOTAL_DESTROYED=0
TOTAL_DRYRUN=0
TOTAL_MISSING=0

destroy_one() {
  local NAME="$1" VERSION="$2" REASON="$3"
  if [ "$DRY_RUN" = "1" ]; then
    echo "     [dry-run] would destroy v$VERSION ($REASON)"
    TOTAL_DRYRUN=$((TOTAL_DRYRUN + 1))
    return 0
  fi
  if gcloud secrets versions destroy "$VERSION" \
       --secret="$NAME" --project="$PROJECT" --quiet >/dev/null 2>&1; then
    echo "     ✓ destroyed v$VERSION ($REASON)"
    TOTAL_DESTROYED=$((TOTAL_DESTROYED + 1))
  else
    echo "     ✗ failed to destroy v$VERSION (skipped)"
  fi
}

for NAME in "${SECRETS_ARR[@]}"; do
  if ! gcloud secrets describe "$NAME" --project="$PROJECT" --quiet >/dev/null 2>&1; then
    echo "  ⚠️  $NAME — secret does not exist in project, skipping"
    TOTAL_MISSING=$((TOTAL_MISSING + 1))
    continue
  fi

  # ---- Pass 1: ENABLED — keep the latest $KEEP, destroy the rest ----
  ENABLED_VERSIONS=$(gcloud secrets versions list "$NAME" \
    --project="$PROJECT" \
    --filter='state:ENABLED' \
    --format='value(name)' \
    --sort-by=~createTime 2>/dev/null || true)

  ENABLED_COUNT=0
  if [ -n "$ENABLED_VERSIONS" ]; then
    ENABLED_COUNT=$(echo "$ENABLED_VERSIONS" | wc -l | tr -d ' ')
  fi

  if [ "$ENABLED_COUNT" -gt "$KEEP" ]; then
    TO_PRUNE_COUNT=$((ENABLED_COUNT - KEEP))
    TO_PRUNE=$(echo "$ENABLED_VERSIONS" | tail -n "$TO_PRUNE_COUNT")
    echo "  🧹 $NAME — enabled: $ENABLED_COUNT total, pruning $TO_PRUNE_COUNT (keeping newest $KEEP)"
    while IFS= read -r VERSION; do
      [ -z "$VERSION" ] && continue
      destroy_one "$NAME" "$VERSION" "enabled-overflow"
    done <<< "$TO_PRUNE"
  else
    echo "  ✅ $NAME — enabled: $ENABLED_COUNT (≤ KEEP=$KEEP), no pruning needed"
  fi

  # ---- Pass 2: DISABLED — destroy them all unless PRESERVE_DISABLED=1 ----
  if [ "$PRESERVE_DISABLED" = "1" ]; then
    continue
  fi
  DISABLED_VERSIONS=$(gcloud secrets versions list "$NAME" \
    --project="$PROJECT" \
    --filter='state:DISABLED' \
    --format='value(name)' \
    --sort-by=~createTime 2>/dev/null || true)
  if [ -n "$DISABLED_VERSIONS" ]; then
    DISABLED_COUNT=$(echo "$DISABLED_VERSIONS" | wc -l | tr -d ' ')
    echo "  🧹 $NAME — disabled: $DISABLED_COUNT to destroy (still billable)"
    while IFS= read -r VERSION; do
      [ -z "$VERSION" ] && continue
      destroy_one "$NAME" "$VERSION" "disabled"
    done <<< "$DISABLED_VERSIONS"
  fi
done

echo "----------------------------------------------------------------"
if [ "$DRY_RUN" = "1" ]; then
  echo "  DRY RUN — would destroy $TOTAL_DRYRUN version(s) across ${#SECRETS_ARR[@]} secret(s)"
  echo "  Re-run without DRY_RUN=1 to actually destroy."
else
  echo "  Destroyed: $TOTAL_DESTROYED version(s)"
fi
[ "$TOTAL_MISSING" -gt 0 ] && echo "  Skipped:   $TOTAL_MISSING secret(s) that don't exist in this project"
echo "================================================================"
echo "  Recovery window: destroyed versions are recoverable for 30 days"
echo "  via:  gcloud secrets versions enable <N> --secret=<NAME> --project=$PROJECT"
echo "================================================================"
