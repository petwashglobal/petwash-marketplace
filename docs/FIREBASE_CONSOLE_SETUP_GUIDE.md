# Firebase Console Setup Guide
**Critical Priority - Do This First**

This guide provides exact steps with screenshots/paths to authorize domains in Firebase Console.

---

## Step 1: Authorize Domains in Firebase Authentication

### Navigate to Settings
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **signinpetwash**
3. Click **Authentication** in left sidebar
4. Click **Settings** tab (top navigation)
5. Scroll to **Authorized domains** section

### Add Production Domains
Click **"Add domain"** button and add each of these:

```
petwash.co.il
www.petwash.co.il
```

### Add Development Domains
Find your Replit preview URL (check browser address bar) and add it:
```
<your-repl-name>-<username>.replit.dev
```

Example: `pet-wash-nl-nirhadad1.replit.dev`

### Verify
After adding, you should see:
- ✅ `petwash.co.il`
- ✅ `www.petwash.co.il`
- ✅ `<your-replit-url>.replit.dev`
- ✅ `signinpetwash.firebaseapp.com` (default)
- ✅ `localhost` (default)

Click **Save**.

---

## Step 2: Update Google Cloud API Key Restrictions

### Navigate to Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **signinpetwash**
3. Go to **APIs & Services → Credentials**
4. Find API key: **Browser key (auto created by Firebase)** or key ending in `...OetGvOCP0E`
5. Click the pencil icon to edit

### Update HTTP Referrers
Under **Application restrictions**:
1. Select **"HTTP referrers (web sites)"**
2. Click **"Add an item"** for each domain:

```
https://petwash.co.il/*
https://www.petwash.co.il/*
https://*.replit.dev/*
http://localhost:*
```

3. Click **Save**

### Verify API Key
Test the API key is working:
```bash
curl "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyDzbXi3-hnitnEtaTOQqakoxOetGvOCP0E"
```

Should return `400 INVALID_ARGUMENT` (not `403 FORBIDDEN`) - this means the key is accessible.

---

## Step 3: Verify Firebase Service Account

### Check Service Account Permissions
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service accounts** tab
3. Verify you see: **firebase-adminsdk-xxxxx@signinpetwash.iam.gserviceaccount.com**
4. Click **"Generate new private key"** button
5. Download the JSON file
6. **IMPORTANT:** Store this JSON in Replit Secrets:
   - Name: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Value: Paste the entire JSON content (including curly braces)

---

## Step 4: Test Authentication

### Test Firebase Auth
1. Go to `https://petwash.co.il`
2. Try to sign up/sign in with email/password
3. Should work without "Configuration Error"

### Test WebAuthn/Passkey
1. Go to `https://petwash.co.il`
2. After logging in, try to register a passkey/Face ID
3. Should trigger biometric prompt (no RP ID mismatch error)

---

## Troubleshooting

### Still Getting "Configuration Error"?
**Check:**
1. Did you add the EXACT domain (no https:// prefix in Firebase Console)
2. Did you click **Save** in Firebase Console?
3. Wait 2-3 minutes for changes to propagate
4. Clear browser cache and cookies
5. Try incognito mode

### WebAuthn "RP ID Mismatch"?
**Check:**
1. Environment variable `VITE_WEBAUTHN_RP_ID` matches your domain
2. Server environment variable `WEBAUTHN_RP_ID` matches
3. Both should be `petwash.co.il` for production

### API Key Returns 403?
**Check:**
1. Google Cloud Console API key HTTP referrer restrictions include your domain
2. API key is not deleted or disabled
3. Firebase Authentication API is enabled in Google Cloud Console

---

## Quick Verification Checklist

After completing all steps:

- [ ] Firebase Console → Authentication → Settings → Authorized domains: Added `petwash.co.il`, `www.petwash.co.il`, Replit URL
- [ ] Google Cloud Console → API Keys → HTTP referrers: Added same domains with `/*` suffix
- [ ] Replit Secrets: `FIREBASE_SERVICE_ACCOUNT_KEY` contains full JSON
- [ ] Tested sign-in on production domain: Works without errors
- [ ] Tested passkey registration: Face ID/Touch ID triggers successfully

---

## Next Steps

Once domains are authorized:
1. Set remaining environment variables (see main audit report)
2. Run verification script: `./scripts/verify-auth.sh`
3. Test on iPhone (Face ID), Mac (Touch ID), Windows (Hello), Android (Fingerprint)
4. Proceed to Apple/Google Wallet certificate setup

---

**Support:** If you encounter issues, check the main audit report (`docs/AUTHENTICATION_AUDIT_REPORT.md`) for detailed troubleshooting.
