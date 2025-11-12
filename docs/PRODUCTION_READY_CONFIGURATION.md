# Production-Ready Configuration Guide

**Pet Wash™ - Copy-Paste Ready Setup**

This guide provides exact values for production deployment.

---

## 🔐 A. Firebase OAuth Configuration

### A-1. Google Cloud Console - OAuth 2.0 Client ID

**Location**: Google Cloud Console → APIs & Services → Credentials

**Authorized JavaScript origins** (copy-paste these exactly):
```
https://petwash.co.il
https://www.petwash.co.il
```

**Authorized redirect URIs** (copy-paste these exactly):
```
https://petwash.co.il/__/auth/handler
https://www.petwash.co.il/__/auth/handler
https://signinpetwash.firebaseapp.com/__/auth/handler
```

**OAuth Consent Screen**:
- **App name**: `Pet Wash™ Ltd`
- **User support email**: `Support@PetWash.co.il`
- **Developer contact**: `Support@PetWash.co.il`
- **Application homepage**: `https://petwash.co.il`
- **Privacy policy**: `https://petwash.co.il/privacy`
- **Terms of service**: `https://petwash.co.il/terms`

---

## 🍎 B. Apple Sign-In Configuration

### B-1. Apple Developer Console

**Services ID**: `co.il.petwash.signin`

**Domains and Subdomains**:
```
petwash.co.il
www.petwash.co.il
```

**Return URLs** (EXACT match required):
```
https://petwash.co.il/__/auth/handler
```

**⚠️ CRITICAL**: URL must be EXACTLY `https://petwash.co.il/__/auth/handler`
- Must include `__` (double underscore)
- Must be `petwash.co.il` (not `www.petwash.co.il`)
- Must end with `/handler` (no trailing slash)

---

## 🌐 C. Firebase Authorized Domains

### C-1. Production Domains

**Firebase Console → Authentication → Settings → Authorized domains**

Add these domains (copy-paste):
```
petwash.co.il
www.petwash.co.il
signinpetwash.firebaseapp.com
```

### C-2. Replit Development Domain

**For development only** (remove before production):
```
<your-repl-name>.<username>.repl.co
localhost
```

---

## 📧 D. DNS Records for Email Authentication

### D-1. SPF Record

**Type**: `TXT`  
**Name**: `@` (or `petwash.co.il`)  
**Value** (copy-paste exactly):
```
v=spf1 include:_spf.google.com ~all
```

**TTL**: `3600` (1 hour)

---

### D-2. DKIM Record

**Step 1**: Get DKIM key from Google Admin Console:
1. Go to **Apps → Google Workspace → Gmail → Authenticate email**
2. Click **Generate new record**
3. Select **2048-bit key**
4. Copy the TXT record value

**Step 2**: Add to DNS:

**Type**: `TXT`  
**Name**: `google._domainkey`  
**Value**: (Paste the long string from Google Admin)

Example format:
```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
```

**TTL**: `3600`

**Step 3**: Activate in Google Admin:
1. Return to **Authenticate email**
2. Click **Start authentication**

---

### D-3. DMARC Record (Monitoring Mode)

**Use this initially for 2-4 weeks**:

**Type**: `TXT`  
**Name**: `_dmarc`  
**Value** (copy-paste exactly):
```
v=DMARC1; p=none; rua=mailto:dmarc@petwash.co.il; fo=1
```

**TTL**: `3600`

---

### D-4. DMARC Record (Production Mode)

**Upgrade to this after monitoring period**:

**Type**: `TXT`  
**Name**: `_dmarc`  
**Value** (copy-paste exactly):
```
v=DMARC1; p=reject; rua=mailto:dmarc@petwash.co.il; pct=100; fo=1
```

**TTL**: `3600`

---

## 🛡️ E. Content Security Policy (CSP)

### E-1. Already Implemented ✅

The server (`server/index.ts`) includes production-ready CSP headers:

**scriptSrc** includes:
```
https://www.google.com
https://apis.google.com (CRITICAL - Google Identity Services)
https://www.gstatic.com
https://www.googleapis.com
https://appleid.cdn-apple.com
```

**connectSrc** includes:
```
https://www.googleapis.com
https://securetoken.googleapis.com
https://identitytoolkit.googleapis.com
https://appleid.apple.com
```

**frameSrc** includes:
```
https://accounts.google.com
https://appleid.apple.com
```

**No action required** - CSP is already configured!

---

## 📱 F. iOS Safari Auth Configuration

### F-1. Already Implemented ✅

Files created:
- ✅ `client/src/lib/iosAuthHandler.ts` - Auto-detects iOS and uses redirect auth
- ✅ `client/src/lib/authErrorHandler.ts` - User-friendly error messages

**Integration example**:
```typescript
import { signInWithBestMethod } from '@/lib/iosAuthHandler';
import { getAuthErrorMessage } from '@/lib/authErrorHandler';

try {
  await signInWithBestMethod(auth, googleProvider);
} catch (error) {
  const { userMessage } = getAuthErrorMessage(error, 'en');
  toast.error(userMessage);
}
```

---

## 🔄 G. Domain Redirects

### G-1. Canonical Domain Strategy

**Primary domain**: `https://petwash.co.il`

**Redirect rules** (configure in Cloudflare or hosting):

1. **HTTP to HTTPS**:
   ```
   http://petwash.co.il → https://petwash.co.il
   http://www.petwash.co.il → https://petwash.co.il
   ```

2. **WWW to non-WWW**:
   ```
   https://www.petwash.co.il → https://petwash.co.il
   ```

**HTTP Status Code**: `301` (permanent redirect)

---

## 📊 H. Testing Checklist

### H-1. Email Authentication Tests

**SPF Test**:
1. Go to: [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx)
2. Enter: `petwash.co.il`
3. ✅ Expected: "SPF record published"

**DKIM Test**:
1. Go to: [mxtoolbox.com/dkim.aspx](https://mxtoolbox.com/dkim.aspx)
2. Selector: `google`
3. Domain: `petwash.co.il`
4. ✅ Expected: "DKIM signature valid"

**DMARC Test**:
1. Go to: [mxtoolbox.com/dmarc.aspx](https://mxtoolbox.com/dmarc.aspx)
2. Enter: `petwash.co.il`
3. ✅ Expected: "DMARC record found"

**Full Email Test**:
1. Send email to: [mail-tester.com](https://www.mail-tester.com/)
2. ✅ Expected score: **10/10**

---

### H-2. Firebase Auth Tests

**Desktop Browser (Chrome/Firefox)**:
- [ ] Google Sign-In works (popup)
- [ ] No errors in console
- [ ] User redirected to dashboard after sign-in

**iOS Safari / iPad**:
- [ ] Google Sign-In works (redirect, not popup)
- [ ] No `auth/internal-error`
- [ ] User redirected to dashboard after sign-in
- [ ] Apple Sign-In works (if configured)

**Android Chrome**:
- [ ] Google Sign-In works (popup)
- [ ] No errors in console

---

## 🚀 I. Production Deployment Timeline

### Week 1: Email Setup
**Day 1-2**:
- [ ] Sign up for Google Workspace
- [ ] Create email addresses (`hello@`, `no-reply@`, `dmarc@`)
- [ ] Add SPF record to DNS
- [ ] Generate and add DKIM record
- [ ] Add DMARC record (monitoring mode)

**Day 3-4**:
- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Test SPF/DKIM/DMARC at MXToolbox
- [ ] Send test emails to Gmail, Outlook, Yahoo

**Day 5-7**:
- [ ] Verify emails landing in inbox (not spam)
- [ ] Check DMARC reports
- [ ] Monitor for any delivery issues

---

### Week 2-3: Firebase Auth Setup
**Day 1-3**:
- [ ] Configure Google OAuth in Cloud Console
- [ ] Add authorized origins and redirect URIs
- [ ] Complete OAuth consent screen
- [ ] Test Google Sign-In on desktop

**Day 4-5**:
- [ ] Configure Apple Sign-In (if using)
- [ ] Add domains and redirect URI
- [ ] Test Apple Sign-In on iOS

**Day 6-7**:
- [ ] Add production domains to Firebase authorized domains
- [ ] Test auth on all platforms (desktop, iOS, Android)
- [ ] Verify CSP headers not blocking auth

---

### Week 4: DMARC Production Mode
**After 2-4 weeks of monitoring**:
- [ ] Review DMARC aggregate reports
- [ ] Confirm SPF/DKIM passing rate >95%
- [ ] Upgrade DMARC to `p=reject`
- [ ] Monitor for any false positives

---

## 📞 J. Support Contacts

### J-1. Technical Support

**Firebase Auth Issues**:
- [Firebase Support](https://firebase.google.com/support)
- [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase)

**Email Deliverability Issues**:
- [Google Workspace Support](https://support.google.com/a)
- [SendGrid Support](https://support.sendgrid.com/)

**DNS Issues**:
- Your domain registrar support
- Cloudflare support (if using)

---

## 📚 K. Quick Reference

### K-1. Important URLs

**Testing Tools**:
- SPF Checker: [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx)
- DKIM Checker: [mxtoolbox.com/dkim.aspx](https://mxtoolbox.com/dkim.aspx)
- DMARC Checker: [mxtoolbox.com/dmarc.aspx](https://mxtoolbox.com/dmarc.aspx)
- Email Tester: [mail-tester.com](https://www.mail-tester.com/)

**Configuration Consoles**:
- Google Cloud Console: [console.cloud.google.com](https://console.cloud.google.com)
- Firebase Console: [console.firebase.google.com](https://console.firebase.google.com)
- Apple Developer: [developer.apple.com](https://developer.apple.com)
- Google Workspace Admin: [admin.google.com](https://admin.google.com)

---

## ✅ L. Final Production Checklist

### Before Going Live:

**Email Authentication**:
- [ ] Google Workspace configured
- [ ] SPF record added and verified
- [ ] DKIM generated and verified
- [ ] DMARC monitoring mode active
- [ ] Test score 10/10 on mail-tester.com

**Firebase Auth**:
- [ ] Google OAuth configured
- [ ] Apple Sign-In configured (optional)
- [ ] Production domains added to authorized domains
- [ ] Development domains removed
- [ ] Tested on all platforms (desktop, iOS, Android)

**Code**:
- [ ] CSP headers configured (✅ already done)
- [ ] iOS auth handler integrated (✅ already done)
- [ ] Error messages user-friendly (✅ already done)

**Domain**:
- [ ] Canonical domain selected (`petwash.co.il`)
- [ ] HTTP → HTTPS redirect configured
- [ ] WWW → non-WWW redirect configured
- [ ] SSL certificate valid

**Testing**:
- [ ] All auth flows tested
- [ ] All emails tested
- [ ] No spam folder issues
- [ ] No auth errors on any platform

---

**Last Updated**: November 2025  
**Ready for Production**: YES ✅
