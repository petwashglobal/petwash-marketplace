# Pet Wash™ Administrator Help Guide

**Version**: 1.0  
**Last Updated**: October 20, 2025  
**Audience**: Platform Administrators & System Maintainers

---

## 📋 Table of Contents

1. [Authentication Architecture Overview](#authentication-architecture-overview)
2. [Admin vs Customer Login Flows](#admin-vs-customer-login-flows)
3. [Common Administrative Tasks](#common-administrative-tasks)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Firebase Console Configuration](#firebase-console-configuration)
6. [Runtime Diagnostics](#runtime-diagnostics)
7. [Security Best Practices](#security-best-practices)
8. [Contact & Escalation](#contact--escalation)

---

## 🏗️ Authentication Architecture Overview

### Core Technologies

Pet Wash™ uses a **dual-layer authentication system**:

1. **Firebase Authentication** (Identity Provider)
   - Handles user authentication (email/password, Google OAuth, passkeys)
   - Provides ID tokens for session creation
   - Manages user profiles in Firestore

2. **Session Cookie System** (Server-Side Auth)
   - Name: `pw_session`
   - Domain: `.petwash.co.il`
   - Expiry: 5 days (432,000,000ms)
   - Attributes: `httpOnly`, `Secure`, `SameSite=None`
   - Server validates cookie on every request

3. **WebAuthn/Passkeys** (Biometric Auth)
   - Face ID, Touch ID, Windows Hello support
   - Credentials stored in Firestore (`users/{uid}/webauthnCredentials`, `employees/{uid}/webauthnCredentials`)
   - Challenge-based authentication with 2-minute expiry
   - Auto-creates session cookie on successful auth

4. **App Check** (Optional Security Layer)
   - Status: **Currently DISABLED** (fail-open mode)
   - Purpose: Prevent abuse from bots/scrapers
   - Uses reCAPTCHA v3 when enabled
   - Separate from Firebase Auth reCAPTCHA

5. **reCAPTCHA v3** (Bot Protection)
   - Used by Firebase Auth for phone authentication
   - Key stored in: `VITE_RECAPTCHA_SITE_KEY`
   - **NOT** the same as App Check key

### Data Storage

| Data Type | Storage Location | Purpose |
|-----------|-----------------|---------|
| Customer Profiles | Firestore: `users/{uid}` | Email, name, pets, loyalty tier |
| Employee Profiles | Firestore: `employees/{uid}` | Role, status, regions, permissions |
| Employee Mirror | Firestore: `users/{uid}/employee/profile` | Backward compatibility |
| WebAuthn Credentials | Firestore: `users/{uid}/webauthnCredentials`, `employees/{uid}/webauthnCredentials` | Passkey public keys |
| Session Tokens | Server Memory (Express Session) | Active session tracking |
| CRM Data | HubSpot | Marketing, contact sync |

### Authentication Flow Diagram

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ├─ 1. Login (email/password, OAuth, or passkey)
         ↓
┌─────────────────────────┐
│  Firebase Auth Client   │
│  (client/src/lib/firebase.ts) │
└────────┬────────────────┘
         │
         ├─ 2. Get ID Token
         ↓
┌─────────────────────────┐
│  POST /api/auth/session │
│  (server/routes.ts)     │
└────────┬────────────────┘
         │
         ├─ 3. Verify ID Token → Create Session Cookie
         ↓
┌─────────────────────────┐
│  Set-Cookie: pw_session │
│  Domain: .petwash.co.il │
└────────┬────────────────┘
         │
         ├─ 4. Redirect to Dashboard/Admin
         ↓
┌─────────────────────────┐
│  GET /api/auth/me       │
│  (validates cookie)     │
└─────────────────────────┘
```

---

## 🔐 Admin vs Customer Login Flows

### Customer Login (`/signin`)

**Supported Methods**:
- ✅ Email/Password
- ✅ Google OAuth
- ✅ Passkey (Face ID, Touch ID, Windows Hello)

**Flow**:
1. User visits `https://petwash.co.il/signin`
2. Chooses authentication method
3. Firebase authenticates user
4. Frontend sends ID token to `/api/auth/session`
5. Backend creates `pw_session` cookie
6. User redirected to `/dashboard`

**User Data**:
- Stored in Firestore: `users/{uid}`
- Fields: `email`, `firstName`, `lastName`, `phoneNumber`, `pets`, `loyaltyTier`, `totalSpent`
- No `role` field (customers don't have roles)

### Admin Login (`/admin/login`)

**Supported Methods**:
- ✅ Email/Password
- ✅ Passkey (Face ID, Touch ID, Windows Hello)
- ❌ Google OAuth (admin-only, not available)

**Flow**:
1. Admin visits `https://petwash.co.il/admin/login`
2. Authenticates with email/password or passkey
3. Firebase authenticates user
4. Frontend sends ID token to `/api/auth/session`
5. Backend creates `pw_session` cookie
6. **CRITICAL**: `GET /api/auth/me` checks employee profile in Firestore
7. **Role Verification**: Only `admin` and `ops` roles allowed
8. Admin redirected to `/admin/users`

**Employee Data**:
- Stored in Firestore: `employees/{uid}`
- Fields: `email`, `firstName`, `lastName`, `role`, `isActive`, `status`, `regions`, `lastLogin`, `createdAt`, `updatedAt`
- **Roles**: `admin` (full access), `ops` (operations manager)
- Mirrored to: `users/{uid}/employee/profile` for backward compatibility

### Key Differences

| Feature | Customer | Admin |
|---------|----------|-------|
| **Login Page** | `/signin` | `/admin/login` |
| **Firestore Collection** | `users/{uid}` | `employees/{uid}` |
| **Role Check** | None | Required (`admin` or `ops`) |
| **OAuth** | Google available | Not available |
| **Dashboard** | `/dashboard` | `/admin/users` |
| **Session Expiry** | 5 days | 5 days |
| **Route Guard** | `RequireAuth` | `AdminRouteGuard` |

---

## 🛠️ Common Administrative Tasks

### 1. Add a New Employee

**Steps**:
1. Navigate to `https://petwash.co.il/admin/users`
2. Click "Add Employee" button
3. Fill in the form:
   - Email address (must be unique)
   - First name, Last name
   - Role: `admin` or `ops`
   - Regions: Select applicable regions (e.g., `IL` for Israel)
4. Click "Create Employee"
5. System automatically:
   - Creates employee profile in Firestore (`employees/{uid}`)
   - Mirrors profile to `users/{uid}/employee/profile`
   - Sets `isActive: true`, `status: 'active'`
   - Records `createdAt` timestamp

**Post-Creation**:
- Employee receives Firebase Auth registration email
- They must set their password via the reset link
- Once logged in, they can set up passkey authentication

### 2. Reset Employee Password

**Method 1: Firebase Console (Recommended)**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `signinpetwash`
3. Navigate to **Authentication** → **Users**
4. Find the employee by email
5. Click the three-dot menu → **Reset password**
6. Employee receives password reset email

**Method 2: Programmatic Reset**
1. Use the `/api/auth/reset-password` endpoint
2. POST request with employee email
3. Firebase sends reset link to email

**Important**: Password resets work for both employees and customers. The email address determines which account gets reset.

### 3. Issue One-Tap Mobile Login Links

**Purpose**: Allow field technicians to log in quickly without typing passwords.

**Steps**:
1. Navigate to `/admin/employees`
2. Find the employee
3. Click "Generate Mobile Login Link"
4. System creates a magic link with:
   - Short-lived token (expires in 15 minutes)
   - Device binding (optional)
   - Auto-login on tap
5. Share link via SMS or messaging app
6. Employee taps link → instantly logged in

**Security Notes**:
- Links expire after 15 minutes
- One-time use only
- Requires HTTPS (production only)
- Mobile device fingerprinting enabled

### 4. Deactivate/Reactivate Employee

**Deactivate**:
1. Go to `/admin/users`
2. Find employee
3. Click "Deactivate"
4. Updates Firestore: `isActive: false`, `status: 'inactive'`
5. Employee cannot log in (sessions invalidated)

**Reactivate**:
1. Go to `/admin/users`
2. Find inactive employee
3. Click "Reactivate"
4. Updates Firestore: `isActive: true`, `status: 'active'`
5. Employee can log in again

### 5. Manage WebAuthn/Passkey Credentials

**View Registered Devices**:
1. Employee logs in
2. Navigates to `/my-devices`
3. Sees list of all registered passkeys (device name, last used, created date)

**Revoke a Device**:
1. On `/my-devices`, click "Revoke" next to device
2. System deletes credential from Firestore
3. Device can no longer be used for biometric login
4. Employee must re-register if they want to use passkey again

**Register New Device**:
1. On login page, click "Sign in with Passkey"
2. If no credential exists, system prompts to register
3. Browser shows Face ID/Touch ID/Windows Hello prompt
4. Credential saved to Firestore (`users/{uid}/webauthnCredentials` or `employees/{uid}/webauthnCredentials`)

---

## 🔧 Troubleshooting Guide

### Issue 1: "Verifying admin access..." Infinite Loop

**Symptoms**:
- Admin login hangs after password/passkey success
- Spinner shows "Verifying admin access..." forever
- Page never redirects to `/admin/users`

**Root Causes**:
1. ❌ Employee role is not `admin` or `ops` (e.g., set to `customer` or `employee`)
2. ❌ Session cookie (`pw_session`) not set or wrong domain
3. ❌ Employee profile missing in Firestore (`employees/{uid}`)
4. ❌ `isActive: false` in employee profile

**Fix Steps**:
1. **Check Firestore Employee Profile**:
   - Go to Firebase Console → Firestore → `employees/{uid}`
   - Verify fields:
     - `role`: Must be `"admin"` or `"ops"` (lowercase)
     - `isActive`: Must be `true`
     - `status`: Must be `"active"`

2. **Check Session Cookie**:
   - Open browser DevTools → Application → Cookies
   - Look for `pw_session` cookie
   - Verify:
     - Domain: `.petwash.co.il` (with leading dot)
     - Secure: ✅ Yes
     - HttpOnly: ✅ Yes
     - SameSite: None

3. **Test API Directly**:
   ```javascript
   // In browser console (after login attempt):
   await fetch('/api/auth/me', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log);
   
   // Expected output:
   {
     ok: true,
     user: {
       email: "admin@example.com",
       role: "admin", // Must be "admin" or "ops"
       isActive: true,
       status: "active",
       ...
     }
   }
   ```

4. **Check Frontend Role Check**:
   - Files: `client/src/components/AdminRouteGuard.tsx`, `client/src/hooks/useAdminAuth.ts`
   - Allowed roles: `['admin', 'ops']` (NOT `'ops_manager'` or other variants)

### Issue 2: CAPTCHA Blocked / Not Loading

**Symptoms**:
- Login button doesn't work
- Console shows CSP errors: "Refused to load script from 'https://www.google.com/recaptcha/...'"
- reCAPTCHA badge doesn't appear

**Root Causes**:
1. ❌ Content Security Policy (CSP) blocking reCAPTCHA domains
2. ❌ Ad blocker or VPN blocking Google domains
3. ❌ Missing reCAPTCHA site key in environment variables

**Fix Steps**:
1. **Check CSP in `client/index.html`**:
   ```html
   <meta http-equiv="Content-Security-Policy" content="
     ...
     script-src 'self' ... www.google.com www.gstatic.com www.recaptcha.net;
     connect-src 'self' ... www.google.com www.recaptcha.net;
     frame-src 'self' ... www.google.com www.recaptcha.net;
     ...
   " />
   ```
   Ensure `www.google.com`, `www.gstatic.com`, and `www.recaptcha.net` are present.

2. **Check Environment Variable**:
   - Replit Secrets → `VITE_RECAPTCHA_SITE_KEY`
   - Should be set to Firebase Auth reCAPTCHA key (if using phone auth)
   - **Note**: This is NOT the App Check key

3. **Check Runtime Config**:
   ```javascript
   // In browser console:
   console.log(window.__PW_FIREBASE_CONFIG__);
   
   // Expected:
   {
     recaptchaSiteKey: "✅ present", // or "❌ missing"
     appCheckSiteKey: "ℹ️ not-used (fail-open)",
     appCheckEnabled: false,
     ...
   }
   ```

4. **Test Without Ad Blocker**:
   - Temporarily disable ad blocker/VPN
   - Try login again
   - If it works, the issue is client-side blocking

### Issue 3: Session Cookie Not Set

**Symptoms**:
- Login appears successful (no errors)
- Immediate redirect to login page
- `/api/auth/me` returns `401 Unauthorized`

**Root Causes**:
1. ❌ CORS misconfiguration (origin not allowed)
2. ❌ Cookie domain mismatch (`petwash.co.il` vs `.petwash.co.il`)
3. ❌ `SameSite=None` without `Secure` flag
4. ❌ Browser blocking third-party cookies

**Fix Steps**:
1. **Check CORS Settings** (in `server/routes.ts` or `server/index.ts`):
   ```javascript
   app.use(cors({
     origin: [
       'https://petwash.co.il',
       'https://www.petwash.co.il'
     ],
     credentials: true
   }));
   ```

2. **Check Cookie Creation** (in `POST /api/auth/session`):
   ```javascript
   res.cookie('pw_session', sessionCookie, {
     maxAge: 432000000, // 5 days
     httpOnly: true,
     secure: true, // Required for SameSite=None
     sameSite: 'none',
     domain: '.petwash.co.il' // Note the leading dot
   });
   ```

3. **Test in Incognito/Private Browsing**:
   - Rules out browser cache issues
   - Ensures cookies work in clean state

4. **Check Browser Settings**:
   - Safari: Settings → Privacy → Block All Cookies (should be OFF)
   - Chrome: Settings → Privacy → Cookies → Allow all cookies

### Issue 4: Passkey Authentication Fails

**Symptoms**:
- "Sign in with Passkey" button doesn't work
- Face ID/Touch ID prompt doesn't appear
- Console error: `NotAllowedError` or `NotSupportedError`

**Root Causes**:
1. ❌ Browser doesn't support WebAuthn (very rare)
2. ❌ rpID mismatch (configured for wrong domain)
3. ❌ HTTPS required (doesn't work on HTTP)
4. ❌ User canceled biometric prompt

**Fix Steps**:
1. **Check Browser Support**:
   ```javascript
   // In browser console:
   console.log('WebAuthn supported:', window.PublicKeyCredential !== undefined);
   // Should be: true
   ```

2. **Check rpID Configuration** (in `server/webauthn/service.ts`):
   ```javascript
   rpID: 'petwash.co.il', // Must match production domain
   rpName: 'Pet Wash™',
   ```

3. **Verify HTTPS**:
   - WebAuthn requires HTTPS in production
   - Localhost is allowed for development

4. **Test Credential Exists**:
   ```javascript
   // In browser console:
   await fetch('/api/webauthn/credentials', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log);
   
   // Should return list of registered passkeys
   ```

### Issue 5: App Check Blocking Requests

**Symptoms**:
- All API requests return `403 Forbidden`
- Console error: "App Check token is invalid"
- Login works on desktop but not mobile

**Current Status**: 
- App Check is **DISABLED** (fail-open mode)
- This issue should NOT occur unless App Check is manually enabled

**Fix Steps** (if App Check is enabled):
1. **Disable App Check**:
   - Remove `VITE_FIREBASE_APPCHECK_SITE_KEY` from environment
   - Restart server
   - Verify: `window.__PW_FIREBASE_CONFIG__.appCheckEnabled === false`

2. **Or Configure App Check Properly**:
   - Go to Firebase Console → App Check
   - Register web app with reCAPTCHA v3
   - Get App Check site key (different from Auth reCAPTCHA key)
   - Set `VITE_FIREBASE_APPCHECK_SITE_KEY` in Replit Secrets
   - Add app check domains to CSP

**Recommendation**: Keep App Check **disabled** until authentication is 100% stable. It adds security but increases complexity.

---

## ⚙️ Firebase Console Configuration

### Required Setup Checklist

#### 1. Authorized Domains
**Location**: Firebase Console → Authentication → Settings → Authorized domains

**Add these domains**:
- ✅ `petwash.co.il`
- ✅ `www.petwash.co.il`
- ✅ `localhost` (for development)

**Why**: Firebase Auth only allows authentication from these domains. Requests from other domains will fail.

#### 2. Sign-In Providers
**Location**: Firebase Console → Authentication → Sign-in method

**Enable these providers**:

| Provider | Status | Configuration Required |
|----------|--------|----------------------|
| **Email/Password** | ✅ Enabled | None |
| **Google** | ✅ Enabled | OAuth consent screen configured |
| **Phone** | ⚠️ Optional | Requires reCAPTCHA v3 key |
| **Apple** | ⚠️ Optional | Apple Developer account + service ID |
| **Microsoft** | ⚠️ Optional | Azure AD app registration |

**For Google OAuth**:
1. Click "Google" → "Enable"
2. Set project name: "Pet Wash™"
3. Set project support email
4. Add authorized domains: `petwash.co.il`, `www.petwash.co.il`
5. Configure OAuth consent screen in Google Cloud Console

#### 3. reCAPTCHA Settings (if using Phone Auth)
**Location**: Firebase Console → Authentication → Settings → reCAPTCHA

**Steps**:
1. If Phone Auth is enabled, Firebase requires reCAPTCHA
2. Get reCAPTCHA v3 site key from [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
3. Add domains: `petwash.co.il`, `www.petwash.co.il`
4. Set `VITE_RECAPTCHA_SITE_KEY` in Replit Secrets
5. **Important**: This is for Firebase Auth, NOT App Check

#### 4. App Check (Optional)
**Location**: Firebase Console → App Check → Web Apps

**Current Status**: **DISABLED** (fail-open mode)

**To Enable** (not recommended until auth is stable):
1. Click "Add App" → Select web app
2. Choose "reCAPTCHA v3"
3. Get App Check site key (different from Auth reCAPTCHA)
4. Set `VITE_FIREBASE_APPCHECK_SITE_KEY` in Replit Secrets
5. Update CSP to allow App Check domains
6. Test thoroughly before production

#### 5. Session Cookie Duration
**Location**: Firebase Console → Authentication → Settings → Session management

**Current Settings**:
- Session duration: 5 days (432,000,000ms)
- Auto-refresh: Enabled
- Revocation check: On admin logout

**How to Change**:
1. Update `maxAge` in `POST /api/auth/session` endpoint
2. Update frontend session refresh logic
3. Test thoroughly (affects user experience)

#### 6. CORS Configuration
**Location**: Server code (`server/index.ts` or `server/routes.ts`)

**Current Settings**:
```javascript
app.use(cors({
  origin: [
    'https://petwash.co.il',
    'https://www.petwash.co.il'
  ],
  credentials: true
}));
```

**To Add New Domain**:
1. Add domain to `origin` array
2. Add domain to Firebase Authorized domains
3. Restart server
4. Test authentication from new domain

---

## 🔍 Runtime Diagnostics

### Browser Console Diagnostics

**Check Firebase Configuration**:
```javascript
// In browser console (any page):
console.log(window.__PW_FIREBASE_CONFIG__);

// Expected output:
{
  recaptchaSiteKey: "✅ present",           // VITE_RECAPTCHA_SITE_KEY exists
  appCheckSiteKey: "ℹ️ not-used (fail-open)", // App Check disabled
  appCheckEnabled: false,                    // App Check not active
  authDomain: "signinpetwash.firebaseapp.com",
  projectId: "signinpetwash",
  environment: "production"                  // or "development"
}
```

**Test Authentication Endpoints**:
```javascript
// Health check:
await fetch('/api/auth/health').then(r => r.text());
// Expected: "OK" or { ok: true }

// Current user (requires active session):
await fetch('/api/auth/me', { credentials: 'include' })
  .then(r => r.json());
// Expected: { ok: true, user: {...} }

// WebAuthn credentials:
await fetch('/api/webauthn/credentials', { credentials: 'include' })
  .then(r => r.json());
// Expected: [{ id: "...", deviceName: "...", ... }]
```

**Check Session Cookie**:
```javascript
// Get all cookies:
document.cookie.split(';').forEach(c => console.log(c.trim()));

// Should see:
// "pw_session=..." (if logged in)
```

**Monitor Authentication Events**:
```javascript
// In browser console:
import { auth } from '/src/lib/firebase.ts';
auth.onAuthStateChanged(user => {
  console.log('[Auth State]', user ? `Logged in: ${user.email}` : 'Logged out');
});
```

### Server-Side Diagnostics

**Check Logs for Authentication Events**:
```bash
# In Replit console:
grep "auth" /tmp/logs/Start_application_*.log

# Look for:
# - "POST /api/auth/session" → Session created
# - "GET /api/auth/me" → User profile fetched
# - "POST /api/webauthn/login/verify" → Passkey login
```

**Test Firebase Admin Connection**:
```javascript
// Create a test endpoint (admin only):
GET /api/auth/firebase-admin-test

// Should return:
{
  ok: true,
  message: "Firebase Admin SDK connected",
  projectId: "signinpetwash"
}
```

**Monitor Session Store**:
```javascript
// In server code (development only):
console.log('Active sessions:', sessionStore.length());
```

---

## 🔒 Security Best Practices

### 1. Password Management
- ✅ Use Firebase Auth password reset (never store passwords)
- ✅ Enforce strong password policy (min 8 chars, Firebase default)
- ✅ Enable multi-factor authentication for high-privilege accounts (future)
- ❌ Never share admin credentials via email/Slack
- ❌ Never log passwords or ID tokens

### 2. Session Management
- ✅ Session cookies are `httpOnly` (JavaScript can't access)
- ✅ Session cookies are `Secure` (HTTPS only)
- ✅ Session cookies use `SameSite=None` (cross-domain support)
- ✅ Sessions expire after 5 days (configurable)
- ✅ Admin logout revokes session immediately

### 3. Role-Based Access Control (RBAC)
- ✅ Only `admin` and `ops` roles can access admin routes
- ✅ Frontend and backend both enforce role checks
- ✅ `AdminRouteGuard` component protects admin pages
- ✅ API endpoints validate user role on every request

### 4. API Security
- ✅ Rate limiting enabled (200 req/15min for admin routes)
- ✅ CORS restricted to `petwash.co.il` and `www.petwash.co.il`
- ✅ Helmet.js sets security headers
- ✅ Sentry monitors errors and security issues
- ✅ Debug endpoints protected (require admin auth in production)

### 5. WebAuthn/Passkey Security
- ✅ User verification required (PIN/biometric)
- ✅ Platform authenticator preferred (device-bound)
- ✅ Challenge expires after 2 minutes
- ✅ Credentials stored encrypted in Firestore
- ✅ One credential per device (revokable)

### 6. Data Privacy
- ✅ GDPR-compliant (EU users can request data deletion)
- ✅ Israeli Privacy Protection Law 1981 compliant
- ✅ User interaction tracking redacts sensitive data
- ✅ No sensitive data in client-side logs
- ✅ Firestore rules enforce read/write permissions

---

## 📞 Contact & Escalation

### Internal Support

**For general admin questions**:
- 📧 Email: admin@petwash.co.il
- 📱 Admin Hotline: [To be configured]

**For technical issues**:
- 🔧 System Administrator: [Name]
- 📧 Email: tech@petwash.co.il

### Firebase Support

**Firebase Console Access**:
- URL: https://console.firebase.google.com/
- Project: `signinpetwash`
- Access: Request from system administrator

**Firebase Support Channels**:
- 📚 Documentation: https://firebase.google.com/docs
- 💬 Community: https://stackoverflow.com/questions/tagged/firebase
- 🎫 Paid Support: Firebase Blaze plan (if enabled)

### Emergency Procedures

**Critical System Outage** (all users can't log in):
1. Check Firebase Status: https://status.firebase.google.com/
2. Check Replit Status: https://status.replit.com/
3. Review server logs: `/tmp/logs/Start_application_*.log`
4. Contact system administrator immediately

**Security Incident** (unauthorized access, data breach):
1. Immediately revoke all admin sessions
2. Check Firebase Auth logs for suspicious activity
3. Review Firestore security rules
4. Contact security team
5. Document incident for compliance

**Data Loss** (Firestore/database corruption):
1. DO NOT make changes
2. Check GCS backups (daily Firestore exports)
3. Contact system administrator
4. Restore from latest backup if necessary

---

## 📚 Additional Resources

### Documentation
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [WebAuthn Guide](https://webauthn.guide/)
- [Express Session Docs](https://github.com/expressjs/session)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Internal Guides
- `docs/WEBAUTHN_DEPLOYMENT.md` - WebAuthn production deployment
- `docs/CAPTCHA_FIREBASE_AUTH_FIXES.md` - Recent auth fixes
- `docs/MOBILE_HEADER_AND_FIREBASE_AUTH_FIXES.md` - Mobile optimizations
- `docs/ADMIN_QUICK_START_GUIDE.md` - Quick start for new admins

### Change Log
- **2025-10-20**: Added App Check documentation, reCAPTCHA troubleshooting
- **2025-10-20**: Added WebAuthn/Passkey management section
- **2025-10-20**: Initial admin help guide created

---

**Need more help?** Contact your system administrator or email tech@petwash.co.il
