# 🚀 Pet Wash™ Ltd - 7-Star Production Deployment Checklist

## 🎯 DEPLOYMENT SIZE OPTIMIZATION (November 6, 2025)

### ✅ Size Reduction Fixes Applied
**Problem:** Image size exceeded 8 GiB limit for Reserved VM Deployments

**Solutions Implemented:**
- ✅ Created `.dockerignore` to exclude ~2.3 GB of unnecessary files
- ✅ Created `scripts/optimize-deployment.sh` for automated optimization
- ✅ Created `.replit.deploy` with production-only build configuration
- ✅ Documented all optimizations in `DEPLOYMENT_SIZE_OPTIMIZATION.md`

**Expected Result:** Deployment image reduced to < 6 GiB (well under 8 GiB limit)

**Files Excluded from Deployment:**
- Development dependencies (node_modules/.cache, .vite)
- Test files (*.test.ts, *.spec.ts, coverage/)
- Documentation (docs/, most *.md files)
- Source maps (*.map files)
- Service account files (using env vars instead)
- Large media files (attached_assets/stock_images/)

---

## 🚨 CRITICAL SECURITY UPDATE (November 6, 2025)

### ✅ Security Vulnerability Fixed
- ✅ **Removed `gcs-service-account.json` credential file from repository**
- ✅ **Updated GCS backup service to use environment variables ONLY**
- ✅ **No file fallback - production-ready security**

### 🔴 REQUIRED ACTION BEFORE DEPLOYMENT
**You MUST add Google Cloud Storage credentials to Replit Secrets:**

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create or download your service account key (JSON format)
3. In Replit: Secrets tab → Add new secret
   - **Name**: `GOOGLE_APPLICATION_CREDENTIALS`
   - **Value**: Paste the entire JSON content from the service account key
4. Verify with: `tsx scripts/pre-deployment-check.ts`

**Without this secret, automated backups will FAIL!**

---

## ✅ Critical Security Fixes (COMPLETED)

### Environment Variables
- ✅ Removed hard-coded Firebase credentials from `client/src/lib/firebase.ts`
- ✅ Added validation for required Firebase config keys
- ✅ Fixed mobile app to use `EXPO_PUBLIC_` prefix instead of `VITE_`
- ✅ Removed OAuth placeholder values (`YOUR_CLIENT_ID`)
- ✅ Added proper error handling when OAuth credentials missing
- ✅ Created `.env.example` for web app
- ✅ Created `mobile-app/.env.example` for mobile app

### Security Audit
- ✅ `.env` file is in `.gitignore` (verified)
- ✅ No secrets hard-coded in source files
- ✅ OAuth providers configured with proper validation

---

## ⚠️ Required Secret Configuration

### Critical Issue Found
**VITE_RECAPTCHA_SITE_KEY in .env has invalid format**
- Current: `442273760 6LcQcOcrAAAAACVGFDzQEKNUJfn-RZoVSJEca2mH`
- Should be: `6LcQcOcrAAAAACVGFDzQEKNUJfn-RZoVSJEca2mH`
- Action: User must manually fix this (system prevents automated editing for security)

### Required Secrets (Must be configured via Replit Secrets)

#### Firebase (Web App - VITE_ prefix)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

#### Firebase (Mobile App - EXPO_PUBLIC_ prefix)
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
```

#### OAuth Providers (Mobile App)
```
EXPO_PUBLIC_GOOGLE_CLIENT_ID
EXPO_PUBLIC_FACEBOOK_APP_ID
EXPO_PUBLIC_TIKTOK_CLIENT_KEY
EXPO_PUBLIC_TIKTOK_CLIENT_SECRET
EXPO_PUBLIC_MICROSOFT_CLIENT_ID
```

---

## 📋 Pre-Deployment Tasks

### 1. Environment Configuration
- [ ] Fix `VITE_RECAPTCHA_SITE_KEY` format in .env (remove leading number and space)
- [ ] Verify all Firebase secrets are properly set in Replit Secrets
- [ ] Configure OAuth provider credentials for mobile app
- [ ] Test that app runs without hard-coded fallbacks

### 2. Translation Completeness
**Status:** 884 incomplete translations detected

Priority translations to complete:
- [ ] Authentication screens (Sign In, Sign Up, Forgot Password)
- [ ] Navigation menus (Header, Footer, Sidebar)
- [ ] Common UI elements (buttons, forms, errors)
- [ ] Critical user flows (booking, payment, profile)

Current coverage:
- ✅ Core sections: auth, navigation, hero, common, register, technology, features, organic
- ⏳ Pending: dashboard, CRM, admin, loyalty, packages sections

### 3. RTL/LTR Layout Verification
- [ ] Test Hebrew (RTL) layout across all pages
- [ ] Test Arabic (RTL) layout across all pages
- [ ] Verify hamburger menu stays in top-right on all languages
- [ ] Confirm mobile sheet slides from right in all languages
- [ ] Test social media icons positioning consistency

### 4. Code Quality
- [ ] Review console.log statements (web app uses logger for production)
- [ ] Verify error handling completeness
- [ ] Check for deprecated code patterns
- [ ] Remove unused imports and dead code

### 5. Mobile App Setup (If deploying mobile)
- [ ] Configure Google Cloud OAuth credentials for iOS
- [ ] Set up Apple Developer Services ID
- [ ] Configure Facebook App for mobile platforms
- [ ] Register TikTok mobile app
- [ ] Set up Microsoft Azure app registration
- [ ] Test each OAuth flow end-to-end

### 6. Security Hardening
- [ ] Enable Firebase App Check for production
- [ ] Verify rate limiters are properly configured
- [ ] Test authentication flows (email/password, social, passkey)
- [ ] Review API endpoint access controls
- [ ] Verify WebAuthn/Passkey configuration

### 7. Performance Optimization
- [ ] Test Redis caching (or verify in-memory fallback works)
- [ ] Check Google Translation API quota
- [ ] Verify Gemini AI API limits
- [ ] Monitor database connection pooling

### 8. Monitoring & Logging
- [ ] Verify Sentry error tracking is configured
- [ ] Test Slack alert webhooks
- [ ] Confirm 7-year log retention is active
- [ ] Review AI monitoring alerts

---

## 🔍 Known Issues & Warnings

### Translation Gaps (AI Monitor Warning)
```
Found 884 incomplete translations
Priority files with inline ternaries (should use t() function):
- client/src/pages/AdminGuide.tsx: 10 instances
- client/src/pages/AdminHelpGuide.tsx: 6 instances  
- client/src/pages/AdminInbox.tsx: 23 instances
- client/src/pages/AdminTeamInvitations.tsx: 28 instances
```

**Recommendation:** Complete critical customer-facing translations before launch

### Google Translation API Status
- ✅ Infrastructure complete and initialized
- ⚠️ Authentication errors detected (needs API key verification)
- ⚠️ REDIS_URL not configured (using in-memory fallback)

**Recommendation:** Configure production Redis for cost optimization

### Currency Exchange Rates
```
AI Monitor detected suspicious rates:
- EUR: Unusual rate 0.2656
- USD: Unusual rate 0.3074
```

**Recommendation:** Verify exchange rate API configuration

---

## ✅ Production Readiness Verification

### Web Application
- ✅ Luxury glassmorphism login screen implemented
- ✅ Firebase authentication configured (runtime config)
- ✅ Email/Password, Social (Google/Apple/Facebook/TikTok/Microsoft), Passkey auth
- ✅ 6-language support (EN, HE, AR, RU, FR, ES)
- ✅ Progressive Web App (PWA) ready
- ✅ Rate limiting configured (100 req/15min general, specialized limits)
- ✅ Security monitoring with 7-year retention
- ✅ Blockchain-style audit trail
- ✅ K9000 IoT wash station integration
- ✅ Payment processing (Nayax)
- ✅ Loyalty program with Apple Wallet

### Mobile Application (React Native/Expo)
- ✅ Premium luxury customer authentication screen
- ✅ Email/Password sign-in and registration
- ✅ Google OAuth with consent screen (✅ Priority)
- ✅ Apple Sign-In (native)
- ✅ Facebook Login
- ✅ TikTok Login  
- ✅ Microsoft Sign-In
- ✅ Sign Up and Forgot Password screens
- ✅ Firebase integration (matching web app)
- ⏳ Requires OAuth provider configuration
- ⏳ Main app screens (post-auth) to be implemented

---

## 🚨 BLOCKING ISSUES (Must fix before deployment)

### CRITICAL
1. **Fix VITE_RECAPTCHA_SITE_KEY format**
   - Location: `.env` file
   - Issue: Has invalid space and prefix number
   - Fix: User must manually edit to remove `442273760 ` prefix

### HIGH PRIORITY
2. **Complete critical translations**
   - 884 translations pending
   - Focus on customer-facing screens first

3. **Configure mobile OAuth credentials**
   - All 5 providers need proper client IDs/keys
   - Without these, mobile auth will fail

---

## 📝 Deployment Steps

### Web App (Replit Deployment)
1. Fix VITE_RECAPTCHA_SITE_KEY in .env
2. Verify all secrets in Replit Secrets panel
3. Test application locally
4. Click "Publish" button in Replit
5. Verify custom domain (www.petwash.co.il) configuration
6. Test production deployment

### Mobile App (Expo/EAS Build)
1. Complete OAuth provider setup
2. Configure environment variables in `mobile-app/.env`
3. Test locally with `expo start`
4. Build for iOS: `eas build --platform ios`
5. Build for Android: `eas build --platform android`
6. Submit to App Store / Google Play

---

## 📞 Support & Resources

- **Documentation:** See `.env.example` and `mobile-app/.env.example`
- **Mobile Setup:** See `mobile-app/CUSTOMER_APP_SETUP.md`
- **Firebase Console:** https://console.firebase.google.com
- **Google Cloud Console:** https://console.cloud.google.com
- **Replit Secrets:** Project Settings > Secrets

---

## ✅ Sign-Off Checklist

Before deploying to production, confirm:

- [ ] All critical security issues resolved
- [ ] VITE_RECAPTCHA_SITE_KEY format fixed
- [ ] Firebase secrets properly configured
- [ ] OAuth providers tested (at minimum Google for web)
- [ ] Translation coverage acceptable for launch
- [ ] RTL/LTR layouts verified
- [ ] Error monitoring active (Sentry)
- [ ] Backup system configured
- [ ] Rate limiters tested
- [ ] Custom domain DNS configured
- [ ] SSL/TLS certificates active
- [ ] Tested on multiple devices and browsers

---

**Deployment Authority:** Should be approved by technical lead and product owner

**Last Updated:** October 31, 2025

© 2025 Pet Wash™ Ltd (ח.פ. 517145033)
