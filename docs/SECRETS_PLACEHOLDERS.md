# Pet Wash™ Production Secrets Configuration

> ⚠️ **SECURITY NOTICE — read before deploying**
>
> All real secret values must live in environment variables only
> (Replit Secrets / GCP Secret Manager). **Never hard-code real secrets
> in source files, docs, dist outputs, or workflow fallback values.**
>
> ## Active Secret Scanning Findings — Status After This Cleanup Pass
>
> | Secret | Type | Files Cleaned | Rotation Required? |
> |--------|------|---------------|--------------------|
> | Twilio Account SID (`ACd21e…`) | Active credential | `.replit` replaced with placeholder | **YES — rotate in Twilio Console** |
> | Twilio Messaging SID (`MG442e…`) | Active credential | `.replit` replaced with placeholder | **YES — rotate in Twilio Console** |
> | Firebase Web API Key (`AIzaSyDzbXi…`) | Active credential | Removed from tracked `dist/` (1 631 files untracked) | **YES — restrict/rotate in Firebase Console** |
> | RSA Private Key (`petwash-wallet.key` body) | Active private key | `attached_assets` transcript redacted | **YES — regenerate and re-provision the key pair** |
> | Firebase VAPID Key (`BGkI_w5H…`) | FCM push public key | `attached_assets` transcript redacted | Recommended — regenerate in Firebase Console → Cloud Messaging |
> | Google OAuth Client ID (`136197986889-vann…`) | OAuth public client ID | `attached_assets` transcript redacted | Recommended — restrict origins in GCP Console |
> | reCAPTCHA Enterprise Site Key (`6LfPr3ks…`) | Site key (semi-public) | CI workflow hardcoded fallback removed | Recommended — restrict domains in GCP Console |
> | Cloudflare Turnstile Site Key (`0x4AAAAA…`) | Site key (semi-public) | `.replit` replaced with placeholder | Optional — restrict domains in Cloudflare |
> | Admin emails / phone / Firebase UID | PII | `.replit` replaced with placeholders | No rotation needed — values are access controls not secrets |
>
> **Do NOT close any GitHub secret scanning alert until you have confirmed
> rotation/revocation in the provider console and purged the value from
> git history if required.**

---

## What Was Done In This Pass

1. **`dist/` untracked** — 1 631 committed build artifacts removed from the git index.
   `dist/` is already in `.gitignore`. Cloud Run CI rebuilds `dist/` fresh from
   `npm run build` using VITE_* secrets injected at build time. Tracked dist files
   are unnecessary and were leaking the Firebase API key in compiled bundles.

2. **`.replit` sanitised** — All real Twilio SIDs, site keys, UIDs, emails, and phone
   numbers replaced with `YOUR_*` placeholders.  Replit environments source secrets
   from Replit Secrets (not from `.replit` userenv).

3. **`attached_assets` scan transcript redacted** — The Replit security scan paste
   contained two copies of `petwash-wallet.key` (RSA private key body), the Firebase
   VAPID key, and the Google OAuth client ID.  All replaced with placeholders.

4. **CI workflow hardcoded fallback removed** — `RECAPTCHA_SITE_KEY` and
   `ACCOUNTING_SPREADSHEET_ID` were hardcoded as `ensure_secret` fallback values.
   Changed to fail-loudly if the secret is absent from GCP Secret Manager.

5. **IoT SSRF guard added** — `MachineCommandService.ts` now blocks fetches to
   metadata IP ranges (169.254.x.x, ::1, 0.0.0.0) before sending commands to K9000
   stations.

---

## Remaining Manual Actions (YOU must do outside GitHub)

### 1. Twilio — **CRITICAL, do first**
- Go to: https://console.twilio.com
- Account → API Keys → revoke any key associated with SID `ACd21e…`
- Create a new Account SID / Auth Token pair
- Update `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in GCP Secret Manager
- If `MG442e367c8e5c0f70cb245fbd21a6514d` was used for production messaging, recreate the Messaging Service

### 2. Firebase API Key — **HIGH priority**
- Go to: https://console.firebase.google.com → Project Settings → General → Web API Key
- The key `AIzaSyDzbXi…` should be restricted to your production domain only (HTTP referrers)
- If it was used without restrictions, rotate it (delete + recreate, update all references in GCP Secret Manager)

### 3. RSA Private Key (`petwash-wallet.key`) — **CRITICAL**
- The private key body was committed in an attached_assets paste transcript
- This key is COMPROMISED — it must be considered public
- Regenerate the key pair and provision the new public key wherever the old one was registered
- Update the new private key in GCP Secret Manager (never commit to repo)
- The `.gitignore` already blocks `*.key` files

### 4. Firebase VAPID Key — recommended
- Go to: Firebase Console → Project Settings → Cloud Messaging → Web configuration
- Generate new VAPID key pair
- Update `VITE_FIREBASE_VAPID_KEY` in GCP Secret Manager and redeploy

### 5. Google OAuth Client ID — recommended
- Go to: https://console.cloud.google.com/apis/credentials
- Find the client ID `136197986889-vann…`
- Add Authorized JavaScript origins (restrict to your domains only)
- Consider rotating if origins were unrestricted

### 6. reCAPTCHA Enterprise Site Key — recommended
- Go to: https://console.cloud.google.com/security/recaptcha
- Find key `6LfPr3ks…`
- Add domain restrictions so the key only works on your production domain

---

## All Required Environment Variables (Placeholders)

```env
# ── Firebase ───────────────────────────────────────────────────────────────
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID
VITE_FIREBASE_VAPID_KEY=YOUR_FIREBASE_VAPID_KEY
VITE_FIREBASE_APPCHECK_SITE_KEY=YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY

# ── Twilio ─────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID=YOUR_TWILIO_MESSAGING_SERVICE_SID
TWILIO_VERIFY_SERVICE_SID=YOUR_TWILIO_VERIFY_SERVICE_SID

# ── Google / GCP ──────────────────────────────────────────────────────────
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
GOOGLE_TRANSLATE_API_KEY=YOUR_GOOGLE_TRANSLATE_API_KEY
RECAPTCHA_SITE_KEY=YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY
ACCOUNTING_SPREADSHEET_ID=YOUR_ACCOUNTING_SPREADSHEET_ID
GOOGLE_FORMS_SPREADSHEET_ID=YOUR_GOOGLE_FORMS_SPREADSHEET_ID

# ── Cloudflare ────────────────────────────────────────────────────────────
VITE_TURNSTILE_SITE_KEY=YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY

# ── SendGrid ──────────────────────────────────────────────────────────────
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY

# ── Slack ─────────────────────────────────────────────────────────────────
ALERTS_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# ── Admin config (set per environment in GCP Secret Manager) ─────────────
SUPER_ADMIN_EMAILS=admin@yourdomain.com
SUPER_ADMIN_UID=YOUR_FIREBASE_SUPER_ADMIN_UID
ADMIN_APPROVER_EMAIL=admin@yourdomain.com
FINANCE_AUTHORIZED_EMAILS=finance@yourdomain.com
```

---

**Last Updated**: 2026-04-08 — security hardening pass  
**Maintained By**: Pet Wash™ DevOps Team

This document lists all required and optional environment variables for production deployment. Add these secrets in the **Replit Secrets panel** (🔒 icon in left sidebar).

## 🚨 Critical Production Secrets (Required)

### Sentry Error Tracking
```bash
SENTRY_DSN=https://xxxxxxxxxxxxx@o000000.ingest.sentry.io/0000000
```
**Where to get**: 
1. Go to https://sentry.io
2. Create project → Select "Express" 
3. Copy the DSN from project settings
4. **Example**: `https://abc123def456@o987654.ingest.sentry.io/1234567`

```bash
SENTRY_ENV=production
```
**Options**: `development`, `staging`, `production`

---

### Alert System (Slack)
```bash
ALERTS_SLACK_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```
**Where to get**:
1. Go to https://api.slack.com/apps
2. Create new app → Choose workspace
3. Enable "Incoming Webhooks"
4. Add webhook to channel (e.g., #alerts-petwash)
5. Copy webhook URL

---

### SendGrid Email (Already configured)
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Status**: ✅ Already configured
**Used for**: Birthday emails, vaccine reminders, revenue reports, system alerts

---

### Firebase (Already configured)
```bash
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxx
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```
**Status**: ✅ Already configured
**Used for**: Authentication, Firestore, Cloud Storage

---

## ⚙️ Optional Production Secrets

### Google Analytics 4
```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Where to get**:
1. Go to https://analytics.google.com/analytics/web/
2. Admin → Data Streams → Web → Copy Measurement ID
3. Admin → Data Streams → Measurement Protocol API secrets → Create
4. Copy API secret

**Used for**: Auth funnel tracking, user journey analytics

---

### BigQuery Export (GA4 Integration)
```bash
BIGQUERY_PROJECT_ID=petwash-analytics
BIGQUERY_DATASET_ID=firebase_analytics
```
**Where to get**:
1. Firebase Console → Integrations → BigQuery
2. Enable BigQuery Export
3. Note the project ID and dataset ID
4. Grant service account `bigquery.dataViewer` role

**Used for**: Advanced analytics, custom reports, ML insights

---

### Metrics Authentication (Production Only)
```bash
METRICS_AUTH_TOKEN=<generate-random-64-char-string>
```
**Generate with**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Used for**: Protecting `/metrics` endpoint in production

---

### Firebase Debug (Development/Staging Only)
```bash
FIREBASE_DEBUG_LOGS=false
```
**Options**: `true` (verbose), `false` (normal)
**Warning**: Never enable in production (performance impact)

---

## 💳 Payment Gateway (Already configured)

### Nayax Integration
```bash
NAYAX_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NAYAX_BASE_URL=https://api.nayax.com
NAYAX_MERCHANT_ID=12345678
NAYAX_TERMINAL_ID=terminal_123
NAYAX_SECRET=xxxxxxxxxxxxxxxxxxxx
NAYAX_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NAYAX_MERCHANT_FEE_RATE=0.025
```
**Status**: ✅ Already configured (if in production)
**Used for**: K9000 station payments, QR voucher redemption

---

## 📊 Monitoring & Observability

### Prometheus/Grafana (Optional)
```bash
PROMETHEUS_PUSH_GATEWAY=http://prometheus-pushgateway:9091
GRAFANA_API_KEY=eyJrIjoiXXXXXXXXXXXXXXXXXXX
```
**Used for**: External metrics aggregation, custom dashboards

---

## 🔐 Security & Compliance

### HubSpot CRM (Already configured)
```bash
HUBSPOT_PORTAL_ID=xxxxxxxx
HUBSPOT_FORM_GUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
**Status**: ✅ Already configured
**Used for**: Lead capture, customer sync

### KYC & Voucher Salts (Already configured)
```bash
KYC_SALT=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VOUCHER_SALT=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Status**: ✅ Already configured
**Used for**: Document hashing, voucher code generation

---

## 🌍 Social OAuth (Optional - Future Phase)

### Google OAuth
```bash
GOOGLE_CLIENT_ID=000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Facebook OAuth
```bash
FACEBOOK_APP_ID=000000000000000
FACEBOOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Apple Sign-In
```bash
APPLE_CLIENT_ID=com.petwash.service
APPLE_CLIENT_SECRET=eyXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 📧 Email Configuration (Already configured)

### SendGrid Additional
```bash
REPORTS_EMAIL_TO=Support@PetWash.co.il
REPORTS_EMAIL_CC=accounting@petwash.co.il
UNSUBSCRIBE_HMAC_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Status**: ✅ Partially configured
**Add if needed**: CC addresses, unsubscribe security

---

## 💰 Tax & Compliance

### VAT Configuration
```bash
VAT_RATE=0.18
```
**Default**: 18% (Israeli VAT)
**Used for**: Revenue reporting, tax calculations

---

## 🗄️ Google Cloud Storage (Already configured)

### GCS Backup System
```bash
GOOGLE_CLOUD_PROJECT=signinpetwash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```
**Status**: ✅ Already configured via Firebase service account
**Used for**: Code backups, Firestore exports

---

## 📝 How to Add Secrets in Replit

1. **Open Secrets Panel**:
   - Click 🔒 "Secrets" icon in left sidebar
   - Or click "Tools" → "Secrets"

2. **Add Each Secret**:
   ```
   Key:   SENTRY_DSN
   Value: https://abc123@o987654.ingest.sentry.io/1234567
   ```

3. **Click "Add secret"**

4. **Restart Application**:
   - Secrets are loaded on server startup
   - Click "Stop" → "Run" or use workflow restart

---

## ✅ Verification Checklist

After adding secrets, verify each integration:

### Sentry
```bash
curl -X POST http://localhost:5000/api/test/sentry-error
# Check Sentry dashboard for test error
```

### Slack Alerts
```bash
curl -X POST http://localhost:5000/api/test/slack-alert
# Check Slack channel for test message
```

### Twilio SMS
```bash
curl -X POST http://localhost:5000/api/test/twilio-sms
# Check phone for test SMS
```

### GA4 Events
```bash
curl -X POST http://localhost:5000/api/test/ga4-event
# Check GA4 Realtime view for test event
```

### Metrics Protection
```bash
# Should fail without token
curl http://localhost:5000/metrics

# Should succeed with token
curl -H "Authorization: Bearer YOUR_METRICS_TOKEN" http://localhost:5000/metrics
```

---

## 🚀 Deployment Order

**Phase 1 - Critical** (Deploy now):
1. ✅ `SENTRY_DSN`
2. ✅ `SENTRY_ENV`
3. ✅ `ALERTS_SLACK_WEBHOOK`
4. ✅ `METRICS_AUTH_TOKEN`

**Phase 2 - Analytics** (Within 1 week):
5. 📊 `GA4_MEASUREMENT_ID`
6. 📊 `GA4_API_SECRET`
7. 📊 `BIGQUERY_PROJECT_ID`
8. 📊 `BIGQUERY_DATASET_ID`

**Phase 4 - Future** (As needed):
- Social OAuth credentials
- Additional monitoring tools
- Third-party integrations

---

## 🆘 Troubleshooting

**Secret not loaded?**
- Restart the application
- Check secret name matches exactly (case-sensitive)
- No quotes around values in Replit Secrets

**Sentry not receiving errors?**
- Verify DSN format
- Check project exists in Sentry
- Ensure `SENTRY_ENV` is set

**Slack alerts not working?**
- Test webhook URL in browser
- Verify channel permissions
- Check webhook not expired

---

**Last Updated**: October 16, 2025  
**Maintained By**: Pet Wash™ DevOps Team
