# Pet Wash™ Complete Environment Variables Reference
**Auto-Generated:** October 25, 2025  
**All Secrets Required for Production**

---

## 🔐 CRITICAL SECURITY SECRETS (Generate Immediately)

### WebAuthn / Passkey Authentication

```bash
# ⚠️ SECURITY: Generate unique value for each environment!
# Command: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Example output: XyZ123abc...= (DO NOT USE THIS EXAMPLE!)
WEBAUTHN_COOKIE_SECRET=<GENERATE_YOUR_OWN_SECRET>

# Relying Party ID (must match production domain)
WEBAUTHN_RP_ID=petwash.co.il
WEBAUTHN_RP_NAME=Pet Wash™
```

### Session Management

```bash
# ⚠️ SECURITY: Generate unique value for each environment!
# Command: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SESSION_SECRET=<GENERATE_YOUR_OWN_SECRET>

# Mobile wallet link security  
# ⚠️ SECURITY: Generate unique value!
MOBILE_LINK_SECRET=<GENERATE_YOUR_OWN_SECRET>
```

---

## 🔥 Firebase Configuration

### Frontend (VITE_*)

```bash
# Firebase Web App Configuration
VITE_FIREBASE_API_KEY=AIzaSyDzbXi3-hnitnEtaTOQqakoxOetGvOCP0E
VITE_FIREBASE_AUTH_DOMAIN=signinpetwash.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=signinpetwash
VITE_FIREBASE_APP_ID=1:136197986889:web:51bc2ff5f721d22da67d98
VITE_FIREBASE_MEASUREMENT_ID=G-B30RXHEX6R

# WebAuthn Client Configuration
VITE_WEBAUTHN_RP_ID=petwash.co.il

# reCAPTCHA (optional but recommended)
VITE_RECAPTCHA_SITE_KEY=<your-recaptcha-site-key>

# Google One Tap (optional)
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

### Backend

```bash
# Firebase Admin SDK (Service Account JSON)
# Get from: Firebase Console → Project Settings → Service Accounts → Generate Private Key
FIREBASE_SERVICE_ACCOUNT_KEY='{
  "type": "service_account",
  "project_id": "signinpetwash",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@signinpetwash.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}'

# reCAPTCHA Secret (backend verification)
RECAPTCHA_SECRET_KEY=<your-recaptcha-secret-key>
```

---

## 🍎 Apple Wallet Integration

### Required Certificates

Get from: [Apple Developer Portal](https://developer.apple.com/account/resources/certificates)

```bash
# Apple Developer Team ID
APPLE_TEAM_ID=<your-10-char-team-id>

# Pass Type ID (create in Identifiers section)
APPLE_PASS_TYPE_ID=pass.com.petwash.vip

# Apple Worldwide Developer Relations Certificate (PEM format)
APPLE_WWDR_CERT='-----BEGIN CERTIFICATE-----
MIIEIjCCAwqgAwIBAgIIAd68xDltoBAwDQYJKoZIhvcNAQEFBQAwYjELMAkGA1UE
BhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsTHUFwcGxlIENlcnRp
...
-----END CERTIFICATE-----'

# Pass Type ID Certificate (PEM format)
APPLE_SIGNER_CERT='-----BEGIN CERTIFICATE-----
MIIFljCCBH6gAwIBAgIIJc8EG6V8XiYwDQYJKoZIhvcNAQELBQAwgZYxCzAJBgNV
...
-----END CERTIFICATE-----'

# Private Signing Key (PEM format)
APPLE_SIGNER_KEY='-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2
...
-----END PRIVATE KEY-----'

# Optional: Passphrase for encrypted private key
APPLE_KEY_PASSPHRASE=<passphrase-if-key-is-encrypted>
```

### How to Generate Apple Certificates

```bash
# 1. Create Certificate Signing Request (CSR) on Mac:
#    - Open Keychain Access
#    - Keychain Access → Certificate Assistant → Request a Certificate
#    - Enter your email and name, save to disk

# 2. In Apple Developer Portal:
#    - Go to Certificates, Identifiers & Profiles
#    - Create Pass Type ID under Identifiers
#    - Create Certificate for Pass Type ID
#    - Upload CSR and download certificate

# 3. Download WWDR Certificate:
#    https://www.apple.com/certificateauthority/
#    AppleWWDRCA.cer

# 4. Convert to PEM format:
openssl x509 -inform DER -in AppleWWDRCA.cer -out WWDR.pem
openssl x509 -inform DER -in pass.cer -out signer_cert.pem

# 5. Export private key from Keychain:
#    - Find certificate in Keychain, expand it
#    - Right-click private key → Export → .p12 format
#    - Convert to PEM:
openssl pkcs12 -in Certificates.p12 -out signer_key.pem -nodes

# 6. Copy contents to environment variables
```

---

## 🤖 Google Wallet Integration

Get from: [Google Pay & Wallet Console](https://pay.google.com/business/console)

```bash
# Google Wallet Issuer ID (from Google Wallet Console)
GOOGLE_WALLET_ISSUER_ID=<your-issuer-id>

# Service Account Credentials (JSON from Google Cloud Console)
GOOGLE_WALLET_SERVICE_ACCOUNT='{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "wallet@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}'
```

### How to Setup Google Wallet

```bash
# 1. Go to Google Pay & Wallet Console
#    https://pay.google.com/business/console

# 2. Create Issuer Account
#    - Business name: Pet Wash™
#    - Note the Issuer ID

# 3. Enable Google Wallet API in Google Cloud Console
#    - Go to APIs & Services → Library
#    - Search "Google Wallet API"
#    - Click Enable

# 4. Create Service Account
#    - Go to IAM & Admin → Service Accounts
#    - Create Service Account
#    - Name: "PetWash Wallet Service"
#    - Grant role: "Service Account Token Creator"
#    - Create Key (JSON format)
#    - Download and copy to GOOGLE_WALLET_SERVICE_ACCOUNT
```

---

## 🌍 Domain & Deployment Configuration

```bash
# Production domain
BASE_URL=https://petwash.co.il

# Staging domain (optional)
STAGING_DOMAIN=staging.petwash.co.il

# Current Replit development domain (auto-detected, but can override)
REPLIT_DEV_DOMAIN=f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev

# Custom RP IDs (comma-separated, optional)
CUSTOM_RP_IDS=preview.petwash.co.il,beta.petwash.co.il

# Custom CORS origins (comma-separated, optional)
CUSTOM_ORIGINS=https://preview.petwash.co.il,https://beta.petwash.co.il
```

---

## 📧 Email Services (SendGrid)

```bash
# SendGrid API Key
# Get from: https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# HubSpot Form Integration
HUBSPOT_PORTAL_ID=<your-portal-id>
HUBSPOT_FORM_GUID=<your-form-guid>
```

---

## 📱 SMS Services (Twilio)

```bash
# Twilio Account Credentials
# Get from: https://console.twilio.com/
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 💳 Payment Gateway (Nayax)

```bash
# Nayax API Configuration
NAYAX_API_KEY=<your-api-key>
NAYAX_BASE_URL=https://api.nayax.com
NAYAX_MERCHANT_ID=<your-merchant-id>
NAYAX_SECRET=<your-secret>
NAYAX_TERMINAL_ID=<your-terminal-id>
NAYAX_WEBHOOK_SECRET=<webhook-secret>
NAYAX_MERCHANT_FEE_RATE=0.029

# Payment provider selection
PAYMENTS_PROVIDER=nayax
```

---

## 🛡️ Security & Monitoring

```bash
# Sentry Error Tracking
# Get from: https://sentry.io/settings/
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxx.ingest.sentry.io/xxxxxxx

# Slack Alerts
ALERTS_SLACK_WEBHOOK=https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXXX

# Metrics Authentication
METRICS_AUTH_TOKEN=<generate-secure-token>
```

---

## 🗄️ Database Configuration

```bash
# PostgreSQL Connection (Neon)
# Auto-configured by Replit, but can override:
DATABASE_URL=postgresql://user:password@host/database
PGHOST=<host>
PGPORT=5432
PGUSER=<user>
PGPASSWORD=<password>
PGDATABASE=<database>
```

---

## 🔐 KYC & Data Protection

```bash
# KYC Salt for hashing
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
KYC_SALT=<generate-64-char-hex-string>

# Voucher Salt
VOUCHER_SALT=<generate-64-char-hex-string>

# Email Unsubscribe HMAC Secret
UNSUBSCRIBE_HMAC_SECRET=<generate-secure-secret>
```

---

## 🌐 OAuth Integrations

### TikTok

```bash
TIKTOK_CLIENT_KEY=<your-client-key>
TIKTOK_CLIENT_SECRET=<your-client-secret>
```

### Facebook

```bash
FACEBOOK_APP_ID=<your-app-id>
FACEBOOK_APP_SECRET=<your-app-secret>
```

### Instagram

```bash
INSTAGRAM_CLIENT_ID=<your-client-id>
INSTAGRAM_CLIENT_SECRET=<your-client-secret>
```

### Google (OAuth)

```bash
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

### Apple Sign In

```bash
APPLE_CLIENT_ID=<your-client-id>
APPLE_CLIENT_SECRET=<your-client-secret>
```

---

## 💰 Financial & Tax Configuration

```bash
# VAT Rate (Israel)
VAT_RATE=0.18

# Reports Email Recipients
REPORTS_EMAIL_TO=finance@petwash.co.il
REPORTS_EMAIL_CC=accounting@petwash.co.il
```

---

## 📊 Analytics & Tracking

```bash
# Microsoft Clarity (already configured in frontend)
# No backend secrets needed

# Google Analytics (already configured)
# VITE_FIREBASE_MEASUREMENT_ID covers this

# Facebook Pixel, TikTok Pixel (frontend only)
# No backend configuration needed
```

---

## 🎯 Quick Start - Minimal Required Secrets

**To get authentication working immediately, add these 5 secrets:**

```bash
# 1. WebAuthn Security (CRITICAL)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
WEBAUTHN_COOKIE_SECRET=<PASTE_YOUR_GENERATED_SECRET_HERE>

# 2. Frontend Firebase Auth Domain (CRITICAL)
VITE_FIREBASE_AUTH_DOMAIN=signinpetwash.firebaseapp.com

# 3. Frontend WebAuthn RP ID (CRITICAL)
VITE_WEBAUTHN_RP_ID=petwash.co.il

# 4. Backend WebAuthn RP ID (CRITICAL)
WEBAUTHN_RP_ID=petwash.co.il

# 5. Firebase Service Account (CRITICAL)
# Get from Firebase Console → Project Settings → Service Accounts → Generate Private Key
FIREBASE_SERVICE_ACCOUNT_KEY='<PASTE_FULL_JSON_FROM_FIREBASE_CONSOLE>'
```

---

## ✅ Verification Checklist

After adding secrets:

- [ ] Run `./scripts/verify-auth.sh` to test authentication
- [ ] Test Face ID on iPhone Safari
- [ ] Test Touch ID on Mac Safari
- [ ] Test Windows Hello on Windows Edge/Chrome
- [ ] Test Android fingerprint on Samsung Chrome
- [ ] Test Apple Wallet download (if certificates added)
- [ ] Test Google Wallet download (if credentials added)
- [ ] Verify session persistence across page refreshes
- [ ] Test cross-domain authentication (www vs non-www)

---

## 🔧 How to Add Secrets in Replit

### Option 1: Replit Secrets Manager (Recommended)

1. Click "Tools" in Replit IDE
2. Click "Secrets"
3. Add each secret:
   - Key: `WEBAUTHN_COOKIE_SECRET`
   - Value: `m3Fzzmf+J7CZNS4DpW2lPY2JJI5wdaJy8bmcb36eJY0=`
4. Click "Add secret"
5. Restart workflow

### Option 2: .env File (Development Only)

```bash
# Create .env file in project root
cp .env.example .env

# Edit .env and add secrets
nano .env

# Restart server
```

**⚠️ NEVER commit .env to git! It's already in .gitignore**

---

## 📞 Support

**Questions about secrets?**
- Firebase: https://firebase.google.com/support
- Apple Wallet: https://developer.apple.com/support/
- Google Wallet: https://support.google.com/pay/

**Emergency Contact:**
- Nir Hadad (CEO): nirhadad1@gmail.com
- Technical Support: Support@PetWash.co.il

---

**Last Updated:** October 25, 2025  
**Next Review:** After Firebase Console setup complete
