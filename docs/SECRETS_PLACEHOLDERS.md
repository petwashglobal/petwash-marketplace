# Pet Wash™ Production Secrets Configuration

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

### Twilio SMS Alerts
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
TWILIO_ALERT_PHONE=+972501234567
```
**Where to get**:
1. Go to https://console.twilio.com
2. Get Account SID & Auth Token from dashboard
3. Buy phone number → Copy number
4. Set `TWILIO_ALERT_PHONE` to your mobile (receives critical alerts)

**Used for**: SMS alerts on critical failures (auth outage, deploy rollback)

---

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

**Phase 2 - Important** (Within 48 hours):
5. ⚙️ `TWILIO_ACCOUNT_SID`
6. ⚙️ `TWILIO_AUTH_TOKEN`
7. ⚙️ `TWILIO_PHONE_NUMBER`
8. ⚙️ `TWILIO_ALERT_PHONE`

**Phase 3 - Analytics** (Within 1 week):
9. 📊 `GA4_MEASUREMENT_ID`
10. 📊 `GA4_API_SECRET`
11. 📊 `BIGQUERY_PROJECT_ID`
12. 📊 `BIGQUERY_DATASET_ID`

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

**Twilio SMS failing?**
- Verify phone number is E.164 format (+15551234567)
- Check account balance
- Ensure number is verified (trial accounts)

---

**Last Updated**: October 16, 2025  
**Maintained By**: Pet Wash™ DevOps Team
