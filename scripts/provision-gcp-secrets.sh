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
echo "This script creates ALL missing secrets in Google Cloud Secret Manager"
echo "so that Cloud Run deployment succeeds."
echo ""
echo "Legend:"
echo "  [AUTO-GENERATED] = Secure random value, ready to use"
echo "  [PLACEHOLDER]    = Needs real value — update later"
echo "  [KNOWN VALUE]    = Default value based on project config"
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
EXISTING_COUNT=$(echo "${EXISTING_SECRETS}" | grep -c . || echo "0")
echo "  Found ${EXISTING_COUNT} secrets in project"

echo ""
echo "--- Step 2: Create missing secrets ---"

echo ""
echo "[Configuration (previously env vars, now secrets)]"
create_secret "BASE_URL" "https://petwash.co.il" "[KNOWN VALUE]"
create_secret "FIREBASE_PROJECT_ID" "signinpetwash" "[KNOWN VALUE]"
create_secret "GOOGLE_DIALOGFLOW_PROJECT_ID" "signinpetwash" "[KNOWN VALUE]"
create_secret "WEBAUTHN_RP_ID" "petwash.co.il" "[KNOWN VALUE]"
create_secret "SENTRY_ENV" "production" "[KNOWN VALUE]"

echo ""
echo "[Core Authentication & Security]"
create_secret "JWT_REFRESH_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "MOBILE_LINK_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "WALLET_LINK_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "WEBAUTHN_COOKIE_SECRET" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "KYC_SALT" "$(openssl rand -hex 16)" "[AUTO-GENERATED]"
create_secret "GMAIL_TOKEN_ENCRYPTION_KEY" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"

echo ""
echo "[Google API Keys]"
create_secret "GOOGLE_MAPS_API_KEY" "placeholder-update-with-google-maps-api-key" "[PLACEHOLDER]"
create_secret "GOOGLE_TRANSLATE_API_KEY" "placeholder-update-with-google-translate-api-key" "[PLACEHOLDER]"
create_secret "GOOGLE_WEATHER_API_KEY" "placeholder-update-with-google-weather-api-key" "[PLACEHOLDER]"

echo ""
echo "[Google Dialogflow / AI Agent]"
create_secret "GOOGLE_AGENT_ID" "placeholder-update-with-dialogflow-agent-id" "[PLACEHOLDER]"
create_secret "GOOGLE_AGENT_LOCATION" "global" "[KNOWN VALUE]"

echo ""
echo "[Google Business Profile]"
create_secret "GOOGLE_BUSINESS_CLIENT_ID" "placeholder-update-with-google-business-client-id" "[PLACEHOLDER]"
create_secret "GOOGLE_BUSINESS_CLIENT_SECRET" "placeholder-update-with-google-business-client-secret" "[PLACEHOLDER]"
create_secret "GOOGLE_BUSINESS_REFRESH_TOKEN" "placeholder-update-with-google-business-refresh-token" "[PLACEHOLDER]"
create_secret "GOOGLE_BUSINESS_ACCOUNT_ID" "placeholder-update-with-google-business-account-id" "[PLACEHOLDER]"

echo ""
echo "[Biometric & Storage]"
create_secret "BIOMETRIC_BUCKET_NAME" "signinpetwash.firebasestorage.app" "[KNOWN VALUE]"
create_secret "BIOMETRIC_PREFIX" "biometric-data" "[KNOWN VALUE]"

echo ""
echo "[Payment & Security]"
create_secret "NAYAX_WEBHOOK_SECRET" "placeholder-update-with-real-nayax-webhook-secret" "[PLACEHOLDER]"
create_secret "RECAPTCHA_SECRET_KEY" "placeholder-update-with-real-recaptcha-key" "[PLACEHOLDER]"
create_secret "VOUCHER_SALT" "$(openssl rand -hex 16)" "[AUTO-GENERATED]"

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
  if ! gcloud secrets describe "VOUCHER_ES256_PUBLIC_KEY_PEM" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  ⚠️  VOUCHER_ES256_PUBLIC_KEY_PEM missing but private key exists — generate matching public key manually"
  else
    echo "  ✅ VOUCHER_ES256_PUBLIC_KEY_PEM — already exists"
  fi
fi

echo ""
echo "[CRM & Marketing]"
create_secret "HUBSPOT_FORM_GUID" "placeholder-update-with-hubspot-form-guid" "[PLACEHOLDER]"
create_secret "HUBSPOT_PORTAL_ID" "placeholder-update-with-hubspot-portal-id" "[PLACEHOLDER]"

echo ""
echo "[Monitoring]"
create_secret "SENTRY_DSN" "placeholder-update-with-sentry-dsn" "[PLACEHOLDER]"
create_secret "METRICS_AUTH_TOKEN" "$(openssl rand -hex 32)" "[AUTO-GENERATED]"
create_secret "ALERTS_SLACK_WEBHOOK" "placeholder-update-with-slack-webhook" "[PLACEHOLDER]"

echo ""
echo "[Backup Buckets]"
create_secret "CS_BACKUP_BUCKET" "petwash-secure-documents" "[KNOWN VALUE]"
create_secret "GCS_BACKUP_BUCKET" "petwash-backups" "[PLACEHOLDER - update if different]"
create_secret "GCS_CODE_BUCKET" "petwash-code-backups" "[PLACEHOLDER - update if different]"
create_secret "GCS_FIRESTORE_BUCKET" "petwash-firestore-backups" "[PLACEHOLDER - update if different]"

echo ""
echo "--- Step 3: Grant Cloud Run service account access to ALL secrets ---"
ALL_SECRETS=(
  BASE_URL FIREBASE_PROJECT_ID GOOGLE_DIALOGFLOW_PROJECT_ID WEBAUTHN_RP_ID SENTRY_ENV
  DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET SESSION_SECRET
  SENDGRID_API_KEY FIREBASE_SERVICE_ACCOUNT_KEY
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER
  GEMINI_API_KEY GOOGLE_MAPS_API_KEY GOOGLE_SERVICE_ACCOUNT_JSON
  GOOGLE_TRANSLATE_API_KEY GOOGLE_WEATHER_API_KEY
  GOOGLE_AGENT_ID GOOGLE_AGENT_LOCATION
  GOOGLE_BUSINESS_CLIENT_ID GOOGLE_BUSINESS_CLIENT_SECRET
  GOOGLE_BUSINESS_REFRESH_TOKEN GOOGLE_BUSINESS_ACCOUNT_ID
  MOBILE_LINK_SECRET WALLET_LINK_SECRET
  BIOMETRIC_BUCKET_NAME BIOMETRIC_PREFIX
  WEBAUTHN_COOKIE_SECRET NAYAX_WEBHOOK_SECRET
  VOUCHER_SALT VOUCHER_ES256_PRIVATE_KEY_PEM VOUCHER_ES256_PUBLIC_KEY_PEM
  RECAPTCHA_SECRET_KEY KYC_SALT GMAIL_TOKEN_ENCRYPTION_KEY
  HUBSPOT_FORM_GUID HUBSPOT_PORTAL_ID
  SENTRY_DSN METRICS_AUTH_TOKEN ALERTS_SLACK_WEBHOOK
  CS_BACKUP_BUCKET GCS_BACKUP_BUCKET GCS_CODE_BUCKET GCS_FIRESTORE_BUCKET
)

echo "  Granting access to ${#ALL_SECRETS[@]} secrets..."
for secret in "${ALL_SECRETS[@]}"; do
  grant_access "${secret}"
done
echo "  ✅ IAM bindings applied for ${SA_EMAIL}"

echo ""
echo "--- Step 4: Final verification — all 42 CI-required secrets ---"
MISSING=0
for secret in "${ALL_SECRETS[@]}"; do
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  ❌ MISSING: ${secret}"
    MISSING=$((MISSING + 1))
  fi
done

if [ "${MISSING}" -eq 0 ]; then
  echo "  ✅ All ${#ALL_SECRETS[@]} CI-required secrets verified!"
  echo ""
  echo "  🚀 You can now trigger GitHub Actions to deploy!"
else
  echo ""
  echo "  ⚠️  ${MISSING} secret(s) still missing — deployment will fail"
fi

echo ""
echo "============================================"
echo " ✅ Provisioning complete!"
echo "============================================"
echo ""
echo "SECRETS WITH PLACEHOLDER VALUES — update these with real values:"
echo ""
echo "  Google API Keys (copy from Google Cloud Console > APIs & Services > Credentials):"
echo "    gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=- <<< 'YOUR_KEY'"
echo "    gcloud secrets versions add GOOGLE_TRANSLATE_API_KEY --data-file=- <<< 'YOUR_KEY'"
echo "    gcloud secrets versions add GOOGLE_WEATHER_API_KEY --data-file=- <<< 'YOUR_KEY'"
echo ""
echo "  Google Dialogflow (from Dialogflow CX Console):"
echo "    gcloud secrets versions add GOOGLE_AGENT_ID --data-file=- <<< 'YOUR_AGENT_ID'"
echo ""
echo "  Google Business Profile (from Google Cloud Console > OAuth):"
echo "    gcloud secrets versions add GOOGLE_BUSINESS_CLIENT_ID --data-file=- <<< 'YOUR_ID'"
echo "    gcloud secrets versions add GOOGLE_BUSINESS_CLIENT_SECRET --data-file=- <<< 'YOUR_SECRET'"
echo "    gcloud secrets versions add GOOGLE_BUSINESS_REFRESH_TOKEN --data-file=- <<< 'YOUR_TOKEN'"
echo "    gcloud secrets versions add GOOGLE_BUSINESS_ACCOUNT_ID --data-file=- <<< 'YOUR_ACCOUNT'"
echo ""
echo "  reCAPTCHA (from Google reCAPTCHA Console):"
echo "    gcloud secrets versions add RECAPTCHA_SECRET_KEY --data-file=- <<< 'YOUR_KEY'"
echo ""
echo "  Nayax (from Nayax Dashboard):"
echo "    gcloud secrets versions add NAYAX_WEBHOOK_SECRET --data-file=- <<< 'YOUR_SECRET'"
echo ""
echo "  HubSpot (from HubSpot Settings):"
echo "    gcloud secrets versions add HUBSPOT_FORM_GUID --data-file=- <<< 'YOUR_GUID'"
echo "    gcloud secrets versions add HUBSPOT_PORTAL_ID --data-file=- <<< 'YOUR_ID'"
echo ""
echo "  GCS Buckets (update with actual bucket names if different):"
echo "    gcloud secrets versions add GCS_BACKUP_BUCKET --data-file=- <<< 'YOUR_BUCKET'"
echo "    gcloud secrets versions add GCS_CODE_BUCKET --data-file=- <<< 'YOUR_BUCKET'"
echo "    gcloud secrets versions add GCS_FIRESTORE_BUCKET --data-file=- <<< 'YOUR_BUCKET'"
echo ""
echo "TIP: The app will START with placeholder values — those features just"
echo "won't work until you update them with real values."
echo ""
