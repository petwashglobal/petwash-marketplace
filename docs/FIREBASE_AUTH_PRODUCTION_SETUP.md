# Firebase Authentication Production Setup Guide

**Enterprise-Grade Configuration for Pet Wash™**

This guide follows Fortune 500 best practices for deploying Firebase Authentication in production.

---

## 🔐 A. Firebase Console Configuration

### A-1. Enable Authentication Providers

**Firebase Console → Authentication → Sign-in Method**

Enable these providers:
- ✅ **Email/Password** - Core authentication
- ✅ **Google** - Primary social login
- ✅ **Apple** - Required for iOS users
- ✅ **Phone** - SMS verification (via Twilio)

---

## 🌐 B. Google Cloud Console (OAuth Configuration)

### B-1. Create OAuth 2.0 Client ID

**Google Cloud Console → APIs & Services → Credentials**

1. Create **Web Application** credentials
2. Configure **Authorized JavaScript origins**:
   ```
   https://petwash.co.il
   https://www.petwash.co.il
   ```

3. Configure **Authorized redirect URIs**:
   ```
   https://petwash.co.il/__/auth/handler
   https://www.petwash.co.il/__/auth/handler
   https://signinpetwash.firebaseapp.com/__/auth/handler
   ```

### B-2. OAuth Consent Screen

**APIs & Services → OAuth consent screen**

- **App name**: `Pet Wash™ Ltd`
- **User support email**: `Support@PetWash.co.il`
- **Logo**: Upload official Pet Wash™ logo
- **Application homepage**: `https://petwash.co.il`
- **Privacy policy**: `https://petwash.co.il/privacy`
- **Terms of service**: `https://petwash.co.il/terms`

**Scopes to add**:
- `userinfo.email`
- `userinfo.profile`

---

## 🍎 C. Apple Developer Console (Apple Sign-In)

### C-1. Create Services ID

**Apple Developer → Certificates, Identifiers & Profiles → Identifiers**

1. Create new **Services ID**
2. Enable **Sign In with Apple**
3. Configure domains and redirect URLs:
   - **Domains**: `petwash.co.il`, `www.petwash.co.il`
   - **Redirect URI**: `https://petwash.co.il/__/auth/handler`

### C-2. Verify Configuration

**CRITICAL**: Redirect URI must EXACTLY match Firebase configuration:
```
https://petwash.co.il/__/auth/handler
```

**Common mistakes**:
- ❌ `https://petwash.co.il/auth/handler` (missing `__`)
- ❌ `https://www.petwash.co.il/__/auth/handler` (wrong subdomain)
- ✅ `https://petwash.co.il/__/auth/handler` (correct)

---

## 🔒 D. Firebase Authorized Domains

### D-1. Add Production Domains

**Firebase Console → Authentication → Settings → Authorized domains**

Add ALL these domains:
```
petwash.co.il
www.petwash.co.il
signinpetwash.firebaseapp.com
```

### D-2. Add Development Domains (Dev Only)

For Replit development:
```
<your-repl-name>.<username>.repl.co
localhost
```

**⚠️ Remove development domains before production launch!**

---

## 🛡️ E. Content Security Policy (CSP) Headers

### E-1. CSP Configuration (Already Implemented)

The server (`server/index.ts`) includes enterprise-grade CSP headers:

**Script Sources**:
```javascript
scriptSrc: [
  "'self'",
  "https://www.google.com",       // Google reCAPTCHA
  "https://apis.google.com",      // Google Identity Services (REQUIRED)
  "https://www.gstatic.com",      // Firebase Auth (REQUIRED)
  "https://www.googleapis.com",   // Firebase Auth APIs (REQUIRED)
  "https://appleid.cdn-apple.com" // Apple Sign-In
]
```

**Connection Sources**:
```javascript
connectSrc: [
  "'self'",
  "https://www.googleapis.com",           // Firebase Auth (CRITICAL)
  "https://securetoken.googleapis.com",   // Auth tokens (REQUIRED)
  "https://identitytoolkit.googleapis.com", // Auth toolkit (REQUIRED)
  "https://appleid.apple.com"             // Apple Sign-In
]
```

**Frame Sources**:
```javascript
frameSrc: [
  "'self'",
  "https://accounts.google.com",  // Google OAuth (REQUIRED)
  "https://appleid.apple.com"     // Apple Sign-In
]
```

### E-2. CSP Testing Checklist

**After CSP changes, test these scenarios**:

**Google Sign-In**:
- [ ] Sign-in popup/redirect opens without CSP errors
- [ ] No `Refused to load` errors in browser console
- [ ] No `Blocked by CSP` warnings
- [ ] User can complete OAuth flow successfully

**Apple Sign-In** (if enabled):
- [ ] Apple sign-in popup/redirect opens
- [ ] No CSP blocking errors
- [ ] OAuth flow completes successfully

**Firebase Auth**:
- [ ] Firebase auth initializes without errors
- [ ] Token refresh works correctly
- [ ] Session persistence works across page reloads

**Browser Console Check**:
```
Open DevTools → Console → Filter by "CSP" or "Content Security Policy"
Expected: No blocking errors for Google/Apple/Firebase domains
```

**Common CSP Errors to Watch For**:
- ❌ `Refused to load script from 'https://apis.google.com'` → Missing in scriptSrc
- ❌ `Refused to connect to 'https://securetoken.googleapis.com'` → Missing in connectSrc
- ❌ `Refused to frame 'https://accounts.google.com'` → Missing in frameSrc

**Quick CSP Validation**:
1. Open app in browser
2. Open DevTools (F12)
3. Try Google Sign-In
4. Check console for any red CSP errors
5. If errors appear, add missing domain to appropriate CSP directive

---

## 📱 F. iOS Safari Compatibility

### F-1. The Problem

iOS Safari blocks third-party cookies by default, causing:
```
Firebase: Error (auth/internal-error)
```

### F-2. The Solution (Already Implemented)

**File**: `client/src/lib/iosAuthHandler.ts`

Automatically detects iOS Safari and uses **redirect-based auth** instead of popup:

```typescript
import { signInWithBestMethod } from '@/lib/iosAuthHandler';

// Automatically selects best method for platform
await signInWithBestMethod(auth, googleProvider);
```

### F-3. User Instructions (Temporary Workaround)

If issues persist on iPad/iPhone:
1. **Settings → Safari**
2. Turn **OFF** "Prevent Cross-Site Tracking"
3. Try sign-in again

---

## 🎯 G. User-Friendly Error Messages

### G-1. Implementation (Already Completed)

**File**: `client/src/lib/authErrorHandler.ts`

Provides bilingual (Hebrew/English) error messages:

```typescript
import { getAuthErrorMessage } from '@/lib/authErrorHandler';

try {
  await signInWithPopup(auth, provider);
} catch (error) {
  const { userMessage } = getAuthErrorMessage(error, language);
  toast.error(userMessage); // User-friendly message
}
```

### G-2. Supported Errors

- ✅ Popup closed by user
- ✅ Network failures
- ✅ Internal errors (with helpful context)
- ✅ Invalid credentials
- ✅ Account already exists
- ✅ Too many attempts
- ✅ And 15+ more...

---

## 🌐 H. Domain Configuration

### H-1. Canonical Domain Strategy

**Primary domain**: `https://petwash.co.il`

**Redirect** all traffic from:
- `http://petwash.co.il` → `https://petwash.co.il` (HTTP to HTTPS)
- `https://www.petwash.co.il` → `https://petwash.co.il` (WWW to non-WWW)

### H-2. Why This Matters

Safari treats `petwash.co.il` and `www.petwash.co.il` as **different origins**.

If auth starts on `www` but redirect lands on non-`www`, Safari blocks it.

**Solution**: Pick ONE canonical domain and redirect everything to it.

---

## ⏰ I. Clock Skew Protection

### I-1. The Issue

If user's device time is wrong, Firebase auth fails:
```
auth/invalid-id-token
```

### I-2. Prevention

Ensure system time is accurate:
- **iOS**: Settings → General → Date & Time → Set Automatically
- **Android**: Settings → System → Date & time → Automatic
- **Desktop**: Enable automatic time sync

---

## 📊 J. Testing Checklist

### J-1. Before Production Launch

Test on ALL platforms:
- ✅ Desktop Chrome (popup auth)
- ✅ Desktop Safari (popup auth)
- ✅ Desktop Firefox (popup auth)
- ✅ iPhone Safari (redirect auth)
- ✅ iPad Safari (redirect auth)
- ✅ Android Chrome (popup auth)

### J-2. Test Scenarios

For each platform:
1. ✅ Google Sign-In
2. ✅ Apple Sign-In (iOS only)
3. ✅ Email/Password Sign-In
4. ✅ Sign-out and re-auth
5. ✅ Multiple account switching

---

## 🚀 K. Production Deployment Steps

### Step 1: Firebase Console
- [ ] Enable all providers (Google, Apple, Email)
- [ ] Add production domains to authorized domains
- [ ] Remove development domains

### Step 2: Google Cloud Console
- [ ] Create OAuth client ID
- [ ] Configure authorized origins and redirect URIs
- [ ] Complete OAuth consent screen with brand info

### Step 3: Apple Developer (if using Apple Sign-In)
- [ ] Create Services ID
- [ ] Configure domains and redirect URI
- [ ] Verify exact URL match with Firebase

### Step 4: DNS/Hosting
- [ ] Ensure `petwash.co.il` points to hosting
- [ ] Set up HTTP → HTTPS redirect
- [ ] Set up WWW → non-WWW redirect (or vice versa)

### Step 5: Code Deployment
- [ ] CSP headers configured (already done ✅)
- [ ] iOS auth handler integrated (already done ✅)
- [ ] Error handling implemented (already done ✅)

### Step 6: Testing
- [ ] Test on all platforms (see checklist above)
- [ ] Verify error messages are user-friendly
- [ ] Confirm redirect flow works on iOS Safari

---

## 🆘 L. Troubleshooting Guide

### Issue: `auth/internal-error` on iPad Safari

**Cause**: Third-party cookies blocked

**Solutions**:
1. Implement redirect-based auth (✅ already done)
2. User temporarily disables "Prevent Cross-Site Tracking"
3. Verify all domains in Firebase authorized domains

### Issue: `auth/popup-closed-by-user`

**Cause**: User closed popup before completing sign-in

**Solution**: User-friendly error message (✅ already implemented)

### Issue: `auth/network-request-failed`

**Cause**: Network connectivity issue

**Solution**: Ask user to check internet connection

### Issue: OAuth redirect not working

**Causes**:
- Wrong redirect URI in OAuth console
- Domain not in Firebase authorized domains
- WWW vs non-WWW mismatch

**Solution**: Verify exact URL match across all configs

---

## 📚 M. Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Google OAuth Configuration](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [iOS Safari Third-Party Cookie Policy](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)

---

**Last Updated**: November 2025  
**Maintained By**: Pet Wash™ Engineering Team
