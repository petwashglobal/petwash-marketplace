# 🔐 Firebase OAuth Setup - CRITICAL for Gmail Login

## ⚠️ REQUIRED: Add OAuth Redirect URI to Google Console

Your Firebase Project: **signinpetwash**

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select project: **signinpetwash**
3. Navigate to: **APIs & Services** → **Credentials**

### Step 2: Find Your OAuth 2.0 Client ID
Look for: **Web client (auto created by Google Service)**

### Step 3: Add Authorized Redirect URIs
Click "Edit" and add these EXACT URLs:

```
https://signinpetwash.firebaseapp.com/__/auth/handler
```

**Auth Domain:**
```
signinpetwash.firebaseapp.com
```

### Step 4: Save Changes
Click **"Save"** at the bottom

---

## ✅ Current Configuration Status

**Firebase Config (Already Set):**
- ✅ API Key: Configured
- ✅ Project ID: `signinpetwash`
- ✅ Auth Domain: `signinpetwash.firebaseapp.com`

**What Was Fixed:**
- ✅ Rate limiting added to login endpoint (5 attempts/5 minutes)
- ✅ Failed attempt tracking with LRU cache
- ✅ Credential stuffing protection
- ✅ Advanced login security implemented

---

## 🚨 Common Errors & Solutions

### Error: "auth/unauthorized-domain"
**Solution:** Add your Replit domain to Firebase Console:
1. Firebase Console → Authentication → Settings → Authorized domains
2. Add: `your-replit-url.replit.dev`

### Error: "auth/popup-blocked"
**Solution:** Tell user to allow popups in browser settings

### Error: "auth/popup-closed-by-user"
**Solution:** User closed the Google consent screen (not an error)

---

## 🔒 Security Features Now Active

1. **Login Rate Limiting:**
   - Max 5 failed attempts per email
   - 5-minute lockout after exceeding limit
   - LRU cache (1000 users max)

2. **Failed Attempt Tracking:**
   - Records every failed login
   - Clears on successful login
   - Privacy-safe logging (email masked)

3. **Credential Stuffing Protection:**
   - IP-based + email-based limiting
   - Automatic temporary blocks
   - Clear error messages with retry time
