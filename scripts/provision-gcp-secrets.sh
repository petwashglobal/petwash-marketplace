#!/bin/bash
set -euo pipefail

PROJECT_ID="signinpetwash"
REGION="me-west1"
SERVICE_NAME="petwash-api"

echo "============================================"
echo " PetWash™ — GCP Secret Manager Provisioning"
echo " Project: ${PROJECT_ID}"
echo "============================================"
echo ""
echo "This script creates missing secrets in Google Cloud Secret Manager"
echo "so that Cloud Run deployment succeeds."
echo ""
echo "IMPORTANT: Secrets marked [PLACEHOLDER] need real values."
echo "Update them later via:"
echo "  echo -n 'real-value' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""

gcloud config set project "${PROJECT_ID}" 2>/dev/null

SA_EMAIL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")

if [ -z "${SA_EMAIL}" ]; then
  PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)" 2>/dev/null)
  SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "⚠️  Using default Compute Engine service account: ${SA_EMAIL}"
else
  echo "✅ Cloud Run service account: ${SA_EMAIL}"
fi

create_secret() {
  local name="$1"
  local value="$2"
  local label="$3"

  if gcloud secrets describe "${name}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  ✅ ${name} — already exists"
  else
    echo -n "${value}" | gcloud secrets create "${name}" \
      --project="${PROJECT_ID}" \
      --replication-policy="automatic" \
      --data-file=- 2>/dev/null
    echo "  🆕 ${name} — created ${label}"
  fi
}

grant_access() {
  local name="$1"
  gcloud secrets add-iam-policy-binding "${name}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet &>/dev/null 2>&1 || true
}

echo ""
echo "--- Step 1: Verify existing secrets ---"
EXISTING_SECRETS=$(gcloud secrets list --project="${PROJECT_ID}" --format="value(name)" 2>/dev/null)
echo "  Found $(echo "${EXISTING_SECRETS}" | wc -l | tr -d ' ') secrets in project"

echo ""
echo "--- Step 2: Create missing secrets ---"
echo ""
echo "[Core Authentication & Security]"
create_secret "MOBILE_LINK_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "WALLET_LINK_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "WEBAUTHN_COOKIE_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "VOUCHER_SALT" "$(openssl rand -hex 16)" "[AUTO-GENERATED]"
create_secret "KYC_SALT" "$(openssl rand -hex 16)" "[AUTO-GENERATED]"
create_secret "GMAIL_TOKEN_ENCRYPTION_KEY" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"

echo ""
echo "[Biometric & Storage]"
create_secret "BIOMETRIC_BUCKET_NAME" "signinpetwash.firebasestorage.app" "[KNOWN VALUE]"
create_secret "BIOMETRIC_PREFIX" "biometric-data" "[PLACEHOLDER - update if different]"

echo ""
echo "[Payment & Webhooks]"
create_secret "NAYAX_WEBHOOK_SECRET" "placeholder-update-with-real-nayax-webhook-secret" "[PLACEHOLDER]"
create_secret "RECAPTCHA_SECRET_KEY" "placeholder-update-with-real-recaptcha-key" "[PLACEHOLDER]"

echo ""
echo "[Voucher ES256 Keys]"
if ! gcloud secrets describe "VOUCHER_ES256_PRIVATE_KEY_PEM" --project="${PROJECT_ID}" &>/dev/null; then
  KEYTMP=$(mktemp -d)
  openssl ecparam -genkey -name prime256v1 -noout -out "${KEYTMP}/private.pem" 2>/dev/null
  openssl ec -in "${KEYTMP}/private.pem" -pubout -out "${KEYTMP}/public.pem" 2>/dev/null
  create_secret "VOUCHER_ES256_PRIVATE_KEY_PEM" "$(cat ${KEYTMP}/private.pem)" "[AUTO-GENERATED]"
  create_secret "VOUCHER_ES256_PUBLIC_KEY_PEM" "$(cat ${KEYTMP}/public.pem)" "[AUTO-GENERATED]"
  rm -rf "${KEYTMP}"
else
  echo "  ✅ VOUCHER_ES256_PRIVATE_KEY_PEM — already exists"
  echo "  ✅ VOUCHER_ES256_PUBLIC_KEY_PEM — already exists"
fi

echo ""
echo "[CRM & Marketing]"
create_secret "HUBSPOT_FORM_GUID" "placeholder-update-with-hubspot-form-guid" "[PLACEHOLDER]"
create_secret "HUBSPOT_PORTAL_ID" "placeholder-update-with-hubspot-portal-id" "[PLACEHOLDER]"

echo ""
echo "[Backup Buckets]"
create_secret "GCS_BACKUP_BUCKET" "petwash-backups" "[PLACEHOLDER - update if different]"
create_secret "GCS_CODE_BUCKET" "petwash-code-backups" "[PLACEHOLDER - update if different]"
create_secret "GCS_FIRESTORE_BUCKET" "petwash-firestore-backups" "[PLACEHOLDER - update if different]"

echo ""
echo "--- Step 3: Grant Cloud Run service account access ---"
SECRETS=(
  MOBILE_LINK_SECRET WALLET_LINK_SECRET WEBAUTHN_COOKIE_SECRET
  VOUCHER_SALT KYC_SALT GMAIL_TOKEN_ENCRYPTION_KEY
  BIOMETRIC_BUCKET_NAME BIOMETRIC_PREFIX
  NAYAX_WEBHOOK_SECRET RECAPTCHA_SECRET_KEY
  VOUCHER_ES256_PRIVATE_KEY_PEM VOUCHER_ES256_PUBLIC_KEY_PEM
  HUBSPOT_FORM_GUID HUBSPOT_PORTAL_ID
  GCS_BACKUP_BUCKET GCS_CODE_BUCKET GCS_FIRESTORE_BUCKET
)

for secret in "${SECRETS[@]}"; do
  grant_access "${secret}"
done
echo "  ✅ IAM bindings applied for ${SA_EMAIL}"

echo ""
echo "--- Step 4: Verify all CI-required secrets exist ---"
CI_SECRETS=(
  DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET SESSION_SECRET
  SENDGRID_API_KEY FIREBASE_SERVICE_ACCOUNT_KEY
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER
  GEMINI_API_KEY GOOGLE_MAPS_API_KEY
  GOOGLE_SERVICE_ACCOUNT_JSON
  GOOGLE_TRANSLATE_API_KEY GOOGLE_WEATHER_API_KEY
  GOOGLE_AGENT_ID GOOGLE_AGENT_LOCATION
  GOOGLE_BUSINESS_CLIENT_ID GOOGLE_BUSINESS_CLIENT_SECRET
  MOBILE_LINK_SECRET WALLET_LINK_SECRET
  BIOMETRIC_BUCKET_NAME BIOMETRIC_PREFIX
  WEBAUTHN_COOKIE_SECRET NAYAX_WEBHOOK_SECRET
  VOUCHER_SALT VOUCHER_ES256_PRIVATE_KEY_PEM VOUCHER_ES256_PUBLIC_KEY_PEM
  RECAPTCHA_SECRET_KEY KYC_SALT GMAIL_TOKEN_ENCRYPTION_KEY
  HUBSPOT_FORM_GUID HUBSPOT_PORTAL_ID
  GCS_BACKUP_BUCKET GCS_CODE_BUCKET GCS_FIRESTORE_BUCKET
)

MISSING=0
for secret in "${CI_SECRETS[@]}"; do
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  ❌ MISSING: ${secret}"
    MISSING=$((MISSING + 1))
  fi
done

if [ "${MISSING}" -eq 0 ]; then
  echo "  ✅ All ${#CI_SECRETS[@]} CI-required secrets verified!"
else
  echo ""
  echo "  ⚠️  ${MISSING} secret(s) still missing — deployment will fail until these are created"
fi

echo ""
echo "============================================"
echo " ✅ Provisioning complete!"
echo "============================================"
echo ""
echo "NEXT STEPS — Update placeholder secrets with real values:"
echo ""
echo "  1. NAYAX_WEBHOOK_SECRET   — Get from Nayax dashboard"
echo "  2. RECAPTCHA_SECRET_KEY   — Get from Google reCAPTCHA console"
echo "  3. HUBSPOT_FORM_GUID      — Get from HubSpot Forms"
echo "  4. HUBSPOT_PORTAL_ID      — Get from HubSpot Settings > Account"
echo "  5. GCS_BACKUP_BUCKET      — Your actual GCS bucket name for backups"
echo "  6. GCS_CODE_BUCKET        — Your actual GCS bucket name for code"
echo "  7. GCS_FIRESTORE_BUCKET   — Your actual GCS bucket name for Firestore"
echo "  8. BIOMETRIC_PREFIX       — Confirm prefix matches your setup"
echo ""
echo "To update a secret:"
echo "  echo -n 'real-value' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo "Then re-run your GitHub Actions workflow to deploy."
