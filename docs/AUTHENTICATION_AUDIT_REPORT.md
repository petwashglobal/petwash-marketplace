# Pet Wash™ Authentication Infrastructure Audit
**Date:** October 25, 2025  
**Auditor:** Senior Authentication Architect  
**Status:** CRITICAL - Immediate Action Required

---

## Executive Summary

The authentication system has **4 critical blockers** preventing production deployment and causing "Configuration Error" for users. The root cause is **environment configuration drift** between Firebase Console, Google Cloud Console, frontend environment variables, and backend configuration.

### 🔴 Critical Priority Issues (Production Blockers)

1. **Firebase/Google Cloud Domain Authorization MISSING** → Blocks all authentication
2. **Production WebAuthn secret defaults to dev placeholder** → Security vulnerability
3. **Firebase Admin SDK running without credentials** → Limited permissions
4. **RP_ID mismatch across environments** → Passkey/Face ID failures

---

## 1. Firebase Authentication Infrastructure

### Current State
```
Project ID: signinpetwash
Auth Domain: signinpetwash.firebaseapp.com
Production Domain: petwash.co.il
Status: ❌ BLOCKED - Domains not authorized
```

### Root Cause Analysis

**Firebase Console → Authentication → Settings → Authorized domains**
- ❌ `petwash.co.il` - NOT AUTHORIZED
- ❌ `www.petwash.co.il` - NOT AUTHORIZED  
- ❌ `*.replit.dev` - NOT AUTHORIZED
- ✅ `signinpetwash.firebaseapp.com` - Default only

**Google Cloud Console → API Keys → HTTP Referrer Restrictions**
- ❌ Same domains missing from API key referrer whitelist
- Result: "Configuration Error" on all authentication attempts

### Impact
- 🚫 Users cannot sign in on production domain
- 🚫 OAuth redirects fail
- 🚫 WebAuthn challenges blocked by CORS
- 🚫 Session cookies not restored after redirects

---

## 2. WebAuthn/Passkey RP_ID Synchronization

### Current Configuration

**Client** (`client/src/lib/firebase.ts`):
```typescript
export const RP_ID = import.meta.env.VITE_WEBAUTHN_RP_ID || 
  ((typeof window !== 'undefined' && window.location.hostname.includes('.replit.dev')) 
    ? window.location.hostname.split(':')[0]
    : 'petwash.co.il');
```

**Server** (`server/webauthn/config.ts`):
```typescript
rpId: process.env.WEBAUTHN_RP_ID || 'petwash.co.il'

RP_IDS = [
  'petwash.co.il',
  'www.petwash.co.il',
  'pet-wash-nl-nirhadad1.replit.app',
  'localhost',
  '127.0.0.1'
]
```

### Issues Identified

| Environment | Client RP_ID | Server RP_ID | Status |
|-------------|-------------|-------------|---------|
| petwash.co.il | ✅ petwash.co.il | ✅ petwash.co.il | ✅ Match |
| www.petwash.co.il | ❌ www.petwash.co.il | ✅ petwash.co.il (via fallback) | ⚠️ Mismatch |
| *.replit.dev | ⚠️ Dynamic detection | ❌ Only specific URL in list | 🔴 **FAIL** |
| Staging domains | ❌ Not handled | ❌ Not in RP_IDS | 🔴 **FAIL** |

### Security Vulnerabilities

1. **WebAuthn Challenge Cookie Secret**
   - Production default: `'dev-only-secret-change-in-production'`
   - Risk: **HIGH** - Replay attacks, challenge tampering
   - Required: `WEBAUTHN_COOKIE_SECRET` environment variable

2. **Session Cookie Security**
   - Missing `SameSite=None` for cross-domain auth
   - Not signed/encrypted
   - Risk: **MEDIUM** - Session fixation, CSRF

---

## 3. CORS & Origin Validation

### Current Origin Whitelist
```typescript
ORIGINS = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://pet-wash-nl-nirhadad1.replit.app',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
]
```

### Missing Origins
- ❌ `https://*.replit.dev` (wildcard for preview deployments)
- ❌ `http://localhost:5173` (Vite default dev server)
- ❌ Firebase hosting domain
- ❌ Staging domain (if exists)

### Impact
- WebAuthn challenges rejected before creation (403 Forbidden)
- CORS errors on authenticated API calls
- OAuth callback failures

---

## 4. Environment Configuration Drift

### Current State Matrix

| Secret Name | Replit Secrets | Production | Local Dev | Status |
|-------------|---------------|-----------|-----------|---------|
| VITE_FIREBASE_API_KEY | ✅ | ❓ | ✅ | Needs verification |
| VITE_FIREBASE_AUTH_DOMAIN | ❌ Missing | ❌ | ❌ | **CRITICAL** |
| VITE_WEBAUTHN_RP_ID | ❌ Missing | ❌ | ❌ | **CRITICAL** |
| WEBAUTHN_COOKIE_SECRET | ❌ Missing | ❌ | ❌ | **SECURITY RISK** |
| FIREBASE_SERVICE_ACCOUNT_KEY | ⚠️ Unverified | ❓ | ⚠️ | Needs check |
| APPLE_WWDR_CERT | ❌ Missing | ❌ | ❌ | Wallet blocked |
| APPLE_SIGNER_CERT | ❌ Missing | ❌ | ❌ | Wallet blocked |
| APPLE_SIGNER_KEY | ❌ Missing | ❌ | ❌ | Wallet blocked |
| GOOGLE_WALLET_ISSUER_ID | ❌ Missing | ❌ | ❌ | Wallet blocked |
| GOOGLE_WALLET_SERVICE_ACCOUNT | ❌ Missing | ❌ | ❌ | Wallet blocked |

### Firebase Admin SDK Issue
```
Status: Running without service account credentials
Impact: Limited permissions, potential auth failures
```

---

## 5. Apple & Google Wallet Integration

### Apple Wallet Requirements
```
Status: ❌ BLOCKED
Missing Certificates:
- APPLE_WWDR_CERT (Apple Worldwide Developer Relations Certificate)
- APPLE_SIGNER_CERT (Pass Type ID Certificate)
- APPLE_SIGNER_KEY (Private Signing Key)
- APPLE_KEY_PASSPHRASE (Optional)
- APPLE_PASS_TYPE_ID (e.g., pass.com.petwash.vip)
- APPLE_TEAM_ID (Developer Team ID)

Source: https://developer.apple.com/account/resources/certificates
```

### Google Wallet Requirements
```
Status: ❌ BLOCKED
Missing Credentials:
- GOOGLE_WALLET_ISSUER_ID
- GOOGLE_WALLET_SERVICE_ACCOUNT (JSON with private key)

Source: https://pay.google.com/business/console
Required API: Google Wallet API (enabled)
```

---

## Remediation Checklist

### Priority 1: CRITICAL (Do Immediately)

#### ✅ Task 1.1: Authorize Firebase Domains
**Time Estimate:** 10 minutes  
**Impact:** Unblocks all authentication

**Steps:**
1. Go to [Firebase Console](https://console.firebase.google.com/project/signinpetwash/authentication/settings)
2. Navigate to: **Authentication → Settings → Authorized domains**
3. Click "Add domain" and add:
   - `petwash.co.il`
   - `www.petwash.co.il`
   - Your Replit preview URL (e.g., `xxx.replit.dev`)
4. Click "Save"

**Verification:**
```bash
curl -I https://petwash.co.il/__/auth/handler
# Should return 200 OK, not 403
```

#### ✅ Task 1.2: Update Google Cloud API Key Restrictions
**Time Estimate:** 5 minutes  
**Impact:** Prevents API key blocking

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=signinpetwash)
2. Find API key ending in `...OetGvOCP0E`
3. Click "Edit API key"
4. Under "Website restrictions", add:
   - `https://petwash.co.il/*`
   - `https://www.petwash.co.il/*`
   - `https://*.replit.dev/*`
   - `http://localhost:*`
5. Click "Save"

#### ✅ Task 1.3: Set Critical Environment Variables
**Time Estimate:** 15 minutes  
**Impact:** Fixes security vulnerabilities

**Replit Secrets to Add:**
```bash
# WebAuthn Security (CRITICAL)
WEBAUTHN_COOKIE_SECRET=<generate-secure-random-32-char-string>
WEBAUTHN_RP_ID=petwash.co.il

# Firebase Configuration
VITE_FIREBASE_AUTH_DOMAIN=signinpetwash.firebaseapp.com
VITE_WEBAUTHN_RP_ID=petwash.co.il
```

**Generate secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### ✅ Task 1.4: Verify Firebase Service Account
**Time Estimate:** 5 minutes  
**Impact:** Ensures proper Admin SDK permissions

**Steps:**
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Save JSON file
4. Add to Replit Secrets: `FIREBASE_SERVICE_ACCOUNT_KEY=<entire-json-content>`
5. Restart application

---

### Priority 2: HIGH (Next 24 Hours)

#### ✅ Task 2.1: Expand RP_ID Whitelist for Staging
**File:** `server/webauthn/config.ts`

```typescript
export const RP_IDS = [
  'petwash.co.il',
  'www.petwash.co.il',
  // Add all Replit preview URLs dynamically
  ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  // Add staging if exists
  ...(process.env.STAGING_DOMAIN ? [process.env.STAGING_DOMAIN] : []),
  'localhost',
  '127.0.0.1'
];
```

#### ✅ Task 2.2: Update CORS Origins
**File:** `server/webauthn/config.ts`

```typescript
export const ORIGINS = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  // Dynamic Replit preview
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
  // Vite dev server
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
```

#### ✅ Task 2.3: Enable Signed Session Cookies
**File:** `server/middleware/auth.ts`

Update session configuration:
```typescript
sameSite: 'none', // Required for cross-domain
secure: true,     // HTTPS only
signed: true,     // Cryptographic signature
```

---

### Priority 3: MEDIUM (Apple/Google Wallet)

#### ✅ Task 3.1: Obtain Apple Wallet Certificates
**Time Estimate:** 2-3 hours  
**Dependency:** Apple Developer Account ($99/year)

**Steps:**
1. Log in to [Apple Developer Portal](https://developer.apple.com/account/resources/certificates)
2. Create Pass Type ID:
   - Go to Identifiers → Pass Type IDs → Register
   - Description: "Pet Wash VIP Loyalty Card"
   - Identifier: `pass.com.petwash.vip`
3. Create Certificate:
   - Go to Certificates → Create Certificate
   - Type: "Pass Type ID Certificate"
   - Select your Pass Type ID
   - Upload CSR (generate with Keychain Access on Mac)
   - Download certificate `.cer` file
4. Download WWDR Certificate:
   - [AppleWWDRCA.cer](https://www.apple.com/certificateauthority/)
5. Convert to PEM format:
   ```bash
   openssl x509 -inform DER -in AppleWWDRCA.cer -out WWDR.pem
   openssl x509 -inform DER -in passcertificate.cer -out signer.pem
   openssl pkcs12 -in Certificates.p12 -out signerkey.pem -nodes
   ```
6. Add to Replit Secrets (multi-line PEM format)

#### ✅ Task 3.2: Setup Google Wallet
**Time Estimate:** 1 hour  
**Dependency:** Google Cloud Project, Wallet API enabled

**Steps:**
1. Go to [Google Pay & Wallet Console](https://pay.google.com/business/console)
2. Create Issuer Account → Note Issuer ID
3. Go to Google Cloud Console → APIs & Services
4. Enable "Google Wallet API"
5. Create Service Account:
   - IAM & Admin → Service Accounts → Create
   - Name: "PetWash Wallet Service"
   - Grant role: "Service Account Token Creator"
   - Create key (JSON format)
6. Add to Replit Secrets:
   ```
   GOOGLE_WALLET_ISSUER_ID=<issuer-id>
   GOOGLE_WALLET_SERVICE_ACCOUNT=<full-json-content>
   ```

---

## Verification Script

### Automated Tests

Create `scripts/verify-auth.sh`:
```bash
#!/bin/bash
set -e

echo "🔍 Pet Wash™ Authentication Verification Script"
echo "================================================"
echo ""

BASE_URL="${BASE_URL:-https://petwash.co.il}"

# Test 1: Firebase Auth Handler
echo "✅ Test 1: Firebase Auth Handler"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/__/auth/handler")
if [ "$STATUS" = "200" ]; then
  echo "   ✅ PASS: Firebase auth handler accessible"
else
  echo "   ❌ FAIL: Got HTTP $STATUS (expected 200)"
  exit 1
fi

# Test 2: WebAuthn Registration Options
echo "✅ Test 2: WebAuthn Registration Endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/webauthn/register/options")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
  echo "   ✅ PASS: WebAuthn endpoint responding"
else
  echo "   ❌ FAIL: Got HTTP $STATUS"
  exit 1
fi

# Test 3: CORS Headers
echo "✅ Test 3: CORS Configuration"
CORS=$(curl -s -I -H "Origin: $BASE_URL" "$BASE_URL/api/health" | grep -i "access-control")
if [ -n "$CORS" ]; then
  echo "   ✅ PASS: CORS headers present"
else
  echo "   ⚠️  WARN: No CORS headers found"
fi

# Test 4: Environment Variables
echo "✅ Test 4: Critical Environment Variables"
VARS=("WEBAUTHN_COOKIE_SECRET" "VITE_FIREBASE_AUTH_DOMAIN" "VITE_WEBAUTHN_RP_ID")
for VAR in "${VARS[@]}"; do
  if [ -n "${!VAR}" ]; then
    echo "   ✅ $VAR is set"
  else
    echo "   ❌ $VAR is MISSING"
  fi
done

echo ""
echo "================================================"
echo "✅ Verification Complete"
```

**Run:**
```bash
chmod +x scripts/verify-auth.sh
./scripts/verify-auth.sh
```

---

## Monitoring & Alerting

### Sentry Error Tracking

**Add these error patterns to Sentry alerts:**
```javascript
// Firebase auth errors
"auth/configuration-not-found"
"auth/unauthorized-domain"
"auth/invalid-api-key"

// WebAuthn errors
"NotAllowedError"
"SecurityError"
"RP ID mismatch"

// Session errors
"Session cookie verification failed"
"Challenge signature verification failed"
```

### Firebase Analytics Events

**Track these authentication events:**
```javascript
logEvent(analytics, 'sign_in_attempt', { method: 'passkey' });
logEvent(analytics, 'sign_in_success', { method: 'passkey' });
logEvent(analytics, 'sign_in_failure', { error: 'rp_id_mismatch' });
logEvent(analytics, 'wallet_download', { type: 'apple' });
```

### Cloud Logging Filters

**Create alert for authentication failures:**
```
severity >= ERROR
jsonPayload.message =~ "auth|webauthn|Configuration Error"
```

---

## Architecture Diagrams

### Authentication Flow
```
┌─────────────┐
│   User      │
│  Browser    │
└──────┬──────┘
       │
       ├─────► Firebase Auth (Email/Password)
       │       ├─ Check: Authorized domains ✓
       │       ├─ Verify: API key referrers ✓
       │       └─ Create: Session cookie (pw_session)
       │
       ├─────► WebAuthn/Passkey (Face ID)
       │       ├─ Client RP_ID: VITE_WEBAUTHN_RP_ID || hostname
       │       ├─ Server RP_ID: WEBAUTHN_RP_ID || 'petwash.co.il'
       │       ├─ Challenge: HMAC-signed cookie
       │       └─ Verify: Origin in ORIGINS[]
       │
       └─────► Wallet Download
               ├─ Apple: PKPass with certificates
               └─ Google: JWT with service account
```

### Domain Authorization Matrix
```
Domain               │ Firebase │ GCloud │ WebAuthn │ CORS
                     │ Console  │ API Key│ RP_IDS   │ ORIGINS
─────────────────────┼──────────┼────────┼──────────┼─────────
petwash.co.il        │    ❌    │   ❌   │    ✅    │   ✅
www.petwash.co.il    │    ❌    │   ❌   │    ✅    │   ✅
*.replit.dev         │    ❌    │   ❌   │    ⚠️    │   ⚠️
localhost            │    ✅    │   ⚠️   │    ✅    │   ✅
```

**Legend:**  
✅ = Configured  
❌ = Missing (CRITICAL)  
⚠️ = Partial/Needs Update

---

## Appendix: Quick Reference

### Environment Variables Checklist

**Frontend (VITE_*):**
```bash
VITE_FIREBASE_API_KEY=AIzaSyDzbXi3-hnitnEtaTOQqakoxOetGvOCP0E
VITE_FIREBASE_AUTH_DOMAIN=signinpetwash.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=signinpetwash
VITE_FIREBASE_APP_ID=1:136197986889:web:51bc2ff5f721d22da67d98
VITE_FIREBASE_MEASUREMENT_ID=G-B30RXHEX6R
VITE_WEBAUTHN_RP_ID=petwash.co.il
VITE_RECAPTCHA_SITE_KEY=<your-site-key>
```

**Backend:**
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=<json-credentials>
WEBAUTHN_RP_ID=petwash.co.il
WEBAUTHN_COOKIE_SECRET=<secure-random-secret>
APPLE_WWDR_CERT=<pem-content>
APPLE_SIGNER_CERT=<pem-content>
APPLE_SIGNER_KEY=<pem-content>
APPLE_PASS_TYPE_ID=pass.com.petwash.vip
APPLE_TEAM_ID=<team-id>
GOOGLE_WALLET_ISSUER_ID=<issuer-id>
GOOGLE_WALLET_SERVICE_ACCOUNT=<json-credentials>
```

### Support Contacts

**Firebase/Google Cloud Issues:**
- Firebase Support: https://firebase.google.com/support
- Stack Overflow: [firebase] [google-cloud-platform]

**WebAuthn/Passkey Issues:**
- SimpleWebAuthn Docs: https://simplewebauthn.dev/
- FIDO Alliance: https://fidoalliance.org/

**Apple Wallet:**
- Apple Developer Support: https://developer.apple.com/support/
- PassKit Documentation: https://developer.apple.com/documentation/passkit

**Google Wallet:**
- Google Wallet Support: https://support.google.com/pay/
- API Documentation: https://developers.google.com/wallet

---

**End of Report**  
**Next Steps:** Execute Priority 1 tasks immediately to unblock production authentication.
