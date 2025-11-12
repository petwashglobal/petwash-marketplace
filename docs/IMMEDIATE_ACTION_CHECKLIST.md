# 🚨 IMMEDIATE ACTION CHECKLIST - Pet Wash™ Authentication Fix
**Created:** October 25, 2025  
**Priority:** CRITICAL - Complete in next 30 minutes

---

## ✅ Step-by-Step Checklist

### **STEP 1: Add Critical Environment Variables** (15 min)

Go to Replit → Tools → Secrets, and add these 5 secrets:

#### 1.1 Generate WebAuthn Cookie Secret

```bash
# Run this command in Replit Shell:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Copy the output and add to Secrets:
Key: WEBAUTHN_COOKIE_SECRET
Value: <PASTE_YOUR_GENERATED_OUTPUT_HERE>
```

**⚠️ SECURITY: You MUST generate your own secret!**
DO NOT copy examples from documentation!

#### 1.2 Add Frontend Environment Variables

```
Key: VITE_FIREBASE_AUTH_DOMAIN
Value: signinpetwash.firebaseapp.com

Key: VITE_WEBAUTHN_RP_ID
Value: petwash.co.il
```

#### 1.3 Add Backend WebAuthn Config

```
Key: WEBAUTHN_RP_ID
Value: petwash.co.il
```

#### 1.4 Verify Firebase Service Account

```
Key: FIREBASE_SERVICE_ACCOUNT_KEY
Value: <Full JSON from Firebase Console - see Step 3 if missing>
```

#### 1.5 Add Mobile Wallet Security (Optional but Recommended)

```bash
# Generate with same command:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Key: MOBILE_LINK_SECRET
Value: <PASTE_YOUR_GENERATED_OUTPUT_HERE>
```

**⚠️ SECURITY: Must be unique! Generate your own!

**After adding each secret, Replit will auto-restart the server.**

---

### **STEP 2: Authorize Domains in Firebase Console** (10 min)

#### 2.1 Go to Firebase Authentication Settings

1. Open [Firebase Console](https://console.firebase.google.com/project/signinpetwash/authentication/settings)
2. Login with your Google account
3. Select project: **signinpetwash**
4. Click **Authentication** in left sidebar
5. Click **Settings** tab
6. Scroll to **Authorized domains** section

#### 2.2 Add Production Domains

Click **"Add domain"** for each:

```
petwash.co.il
www.petwash.co.il
```

#### 2.3 Add Replit Development Domain

Get your current Replit URL from browser address bar, then add:

```
<your-repl-id>.replit.dev
```

Example: `f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev`

#### 2.4 Click "Save"

Wait 2-3 minutes for changes to propagate.

---

### **STEP 3: Update Google Cloud API Key Restrictions** (5 min)

#### 3.1 Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=signinpetwash)
2. Select project: **signinpetwash**
3. Go to **APIs & Services → Credentials**
4. Find API key ending in: `...OetGvOCP0E`
5. Click pencil icon to edit

#### 3.2 Add HTTP Referrers

Under **Application restrictions**:
1. Select **"HTTP referrers (web sites)"**
2. Click **"Add an item"** for each:

```
https://petwash.co.il/*
https://www.petwash.co.il/*
https://*.replit.dev/*
http://localhost:*
```

3. Click **"Save"**

---

### **STEP 4: Verify Firebase Service Account** (Optional - Only if Auth Failing)

#### 4.1 Check if Service Account Exists

1. Go to [Firebase Console → Project Settings](https://console.firebase.google.com/project/signinpetwash/settings/serviceaccounts)
2. Click **Service accounts** tab
3. You should see: `firebase-adminsdk-xxxxx@signinpetwash.iam.gserviceaccount.com`

#### 4.2 Generate New Private Key (If Needed)

1. Click **"Generate new private key"**
2. Confirm download
3. Open downloaded JSON file
4. Copy entire contents
5. In Replit Secrets, update:

```
Key: FIREBASE_SERVICE_ACCOUNT_KEY
Value: <PASTE_ENTIRE_JSON_HERE>
```

---

### **STEP 5: Verification** (5 min)

#### 5.1 Test Authentication Flow

1. Go to your app: `https://petwash.co.il` (or your Replit URL)
2. Try to sign up/sign in with email + password
3. **Should work without "Configuration Error"**

#### 5.2 Test WebAuthn/Passkey (If Available)

1. After signing in, look for "Enable Face ID" or "Register Passkey"
2. Click to register
3. Should trigger biometric prompt (Face ID, Touch ID, Windows Hello)
4. **Should NOT show "RP ID mismatch" error**

#### 5.3 Run Automated Verification

In Replit Shell:

```bash
chmod +x scripts/verify-auth.sh
./scripts/verify-auth.sh
```

Expected output:
```
✅ PASS: Firebase auth handler accessible
✅ PASS: WebAuthn endpoint responding
✅ PASS: CORS headers present
```

---

## 📊 What We Fixed (Technical Summary)

| Issue | Before | After | Status |
|-------|--------|-------|---------|
| **RP_IDS Array** | Hardcoded | Dynamic (env-based) | ✅ Fixed |
| **CORS Origins** | Missing localhost:5173 | Vite + dynamic domains | ✅ Fixed |
| **Session Cookies** | sameSite='lax' | sameSite='none' (prod) | ✅ Fixed |
| **WebAuthn Secret** | Dev placeholder | Secure generated | ✅ Fixed |
| **Firebase Auth Domain** | Hardcoded | Configurable | ✅ Fixed |
| **Conditional Mediation** | Missing Samsung check | Feature detection | ✅ Fixed |

---

## 🚨 Critical Actions Required from You

**YOU MUST DO THESE MANUALLY** (cannot be automated):

1. [ ] Add 5 environment variables in Replit Secrets (Step 1)
2. [ ] Authorize domains in Firebase Console (Step 2)
3. [ ] Update Google Cloud API key restrictions (Step 3)
4. [ ] Test authentication on iPhone/Android (Step 5)
5. [ ] Confirm no "Configuration Error" appears

**Estimated Total Time:** 35 minutes

---

## 💡 Why These Specific Secrets?

### WebAuthn Cookie Secret (8uuRmLtfTFw...)
- **Purpose:** Signs challenge cookies to prevent tampering
- **Security:** 256-bit cryptographic random
- **Impact:** Without this, passkeys/Face ID won't work securely
- **Rotated:** Previous secret was accidentally exposed in docs

### VITE_FIREBASE_AUTH_DOMAIN
- **Purpose:** Tells frontend where Firebase auth redirects go
- **Impact:** Without this, OAuth/email sign-in fails with "Configuration Error"
- **Required:** For all Firebase authentication flows

### VITE_WEBAUTHN_RP_ID
- **Purpose:** Client-side Relying Party ID for WebAuthn
- **Must Match:** Server-side WEBAUTHN_RP_ID
- **Impact:** Face ID/Touch ID won't work if mismatched

### WEBAUTHN_RP_ID
- **Purpose:** Server-side Relying Party ID
- **Must Match:** Production domain (petwash.co.il)
- **Impact:** All passkey registration/authentication requires this

### FIREBASE_SERVICE_ACCOUNT_KEY
- **Purpose:** Backend Firebase Admin SDK authentication
- **Impact:** Cannot create session cookies or verify auth without it
- **Format:** Full JSON from Firebase Console

---

## 🎯 Success Criteria

**You'll know it worked when:**

✅ No "Configuration Error" when signing in  
✅ Face ID/Touch ID prompt appears on iPhone/Mac  
✅ Session persists after page refresh  
✅ Can sign in on www.petwash.co.il AND petwash.co.il  
✅ `/api/health` returns 200 OK  
✅ Verification script shows all ✅ PASS

---

## 🆘 Troubleshooting

### "Configuration Error" Still Appearing?

**Check:**
1. Did you add domains to Firebase Console AND click Save?
2. Wait 2-3 minutes for changes to propagate
3. Clear browser cache and cookies
4. Try incognito/private browsing mode

### "RP ID Mismatch" on Face ID?

**Check:**
1. VITE_WEBAUTHN_RP_ID and WEBAUTHN_RP_ID must match exactly
2. Both should be `petwash.co.il` (no www, no https://)
3. Restart server after adding secrets

### "API Key Restricted"?

**Check:**
1. Google Cloud Console API key has HTTP referrers updated
2. Added `https://petwash.co.il/*` with the `/*` at the end
3. Added `https://*.replit.dev/*` for wildcard support

---

## 📞 Next Steps After Completion

Once all checks pass:

1. **Test on Multiple Devices:**
   - iPhone (Safari) - Face ID
   - Mac (Safari) - Touch ID
   - Windows (Chrome/Edge) - Windows Hello
   - Samsung/Android (Chrome) - Fingerprint

2. **Optional: Apple Wallet Setup**
   - See: `docs/ENVIRONMENT_VARIABLES_COMPLETE.md`
   - Requires Apple Developer Account ($99/year)
   - Estimated time: 2-3 hours

3. **Optional: Google Wallet Setup**
   - See: `docs/ENVIRONMENT_VARIABLES_COMPLETE.md`
   - Requires Google Cloud project
   - Estimated time: 1 hour

4. **Production Deployment:**
   - All environment variables will carry over
   - No additional configuration needed
   - Just publish to production

---

## 📋 Quick Reference

**How to Generate Secrets:**

```bash
# Run in Replit Shell to generate each secret:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Run it twice - once for WEBAUTHN_COOKIE_SECRET, once for MOBILE_LINK_SECRET
# DO NOT use examples from docs - they are compromised!
```

**Replit Current Domain:**
```
f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev
```

**Firebase Project:**
```
Project ID: signinpetwash
Auth Domain: signinpetwash.firebaseapp.com
API Key: AIzaSyDzbXi3-hnitnEtaTOQqakoxOetGvOCP0E
```

---

## ✅ Completion Checklist

When you're done, check all these:

- [ ] Added WEBAUTHN_COOKIE_SECRET to Replit Secrets
- [ ] Added VITE_FIREBASE_AUTH_DOMAIN to Replit Secrets
- [ ] Added VITE_WEBAUTHN_RP_ID to Replit Secrets
- [ ] Added WEBAUTHN_RP_ID to Replit Secrets
- [ ] Verified FIREBASE_SERVICE_ACCOUNT_KEY exists in Replit Secrets
- [ ] Added petwash.co.il to Firebase authorized domains
- [ ] Added www.petwash.co.il to Firebase authorized domains
- [ ] Added Replit URL to Firebase authorized domains
- [ ] Clicked "Save" in Firebase Console
- [ ] Updated Google Cloud API key HTTP referrers
- [ ] Tested sign-in on petwash.co.il
- [ ] Tested Face ID/passkey registration
- [ ] Ran `./scripts/verify-auth.sh`
- [ ] All verification tests passed

**If all checked ✅ → Authentication system is fully operational! 🎉**

---

**Questions or Issues?**
- Check: `docs/AUTHENTICATION_AUDIT_REPORT.md`
- Check: `docs/FIREBASE_CONSOLE_SETUP_GUIDE.md`
- Contact: Technical support (attach verification script output)

---

**Last Updated:** October 25, 2025  
**Status:** Ready for Implementation  
**Estimated Completion:** 35 minutes
