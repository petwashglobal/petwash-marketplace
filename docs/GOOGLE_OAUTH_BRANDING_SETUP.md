# Google OAuth Branding Setup Guide
## Fix "petwashproject..." Name on Google Sign-In Prompt

This guide walks you through setting up proper branding for your Google OAuth consent screen. After completing these steps, users will see **"Pet Wash™"** with your logo instead of a generic project name.

---

## 📋 Prerequisites

- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Access to [Firebase Console](https://console.firebase.google.com/)
- Your Pet Wash™ logo (square PNG, transparent background, 512x512px recommended)
- Admin access to petwash.co.il domain

---

## 🎨 Step 1: Update OAuth Consent Screen

**Goal:** Make Google show "Pet Wash™ Admin" with your logo

### 1.1 Navigate to OAuth Consent Screen
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (e.g., "petwash-admin")
3. Click **APIs & Services** → **OAuth consent screen**

### 1.2 Configure Branding
Update these fields:

| Field | Value |
|-------|-------|
| **App name** | `Pet Wash™ Admin` |
| **App logo** | Upload `/brand/petwash-logo-official.png` (square, 512x512px) |
| **User support email** | `Support@PetWash.co.il` or `Support@PetWash.co.il` |
| **Application home page** | `https://petwash.co.il` |
| **Application privacy policy link** | `https://petwash.co.il/privacy` |
| **Application terms of service** | `https://petwash.co.il/terms` |
| **Authorized domains** | `petwash.co.il` |
| **Developer contact** | `Support@PetWash.co.il` |

### 1.3 Publish Consent Screen
- If status is "Testing": Click **PUBLISH APP** → **Confirm**
- This allows all users (not just test users) to sign in

---

## 🌐 Step 2: Verify Domain Ownership

**Goal:** Show verified checkmark in Google OAuth prompt

### 2.1 Verify in Google Search Console
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **Add Property** → Enter `https://petwash.co.il`
3. Follow verification steps:
   - **Recommended:** Upload HTML file to your domain
   - **Alternative:** Add DNS TXT record

### 2.2 Link Domain in Cloud Console
1. Back in **Google Cloud Console** → **OAuth consent screen**
2. Scroll to **Authorized domains**
3. Add: `petwash.co.il`
4. Click **Save**

---

## 🔐 Step 3: Update Web OAuth Client

**Goal:** Allow sign-in from all your domains (production + development)

### 3.1 Find Your Web Client
1. **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Find your **OAuth 2.0 Client ID** (type: Web application)
   - Name usually contains "Web client" or "Firebase"
3. Click **Edit** (pencil icon)

### 3.2 Configure Authorized JavaScript Origins
Add these URLs:

```
https://petwash.co.il
https://www.petwash.co.il
https://pet-wash-il-nirhadad1.replit.app
http://localhost:5000
```

### 3.3 Configure Authorized Redirect URIs
Firebase automatically handles redirects, but add these for safety:

```
https://petwash.co.il/__/auth/handler
https://www.petwash.co.il/__/auth/handler
https://pet-wash-il-nirhadad1.replit.app/__/auth/handler
http://localhost:5000/__/auth/handler
```

### 3.4 Save Changes
- Click **SAVE**
- Wait 5 minutes for changes to propagate

---

## 🔥 Step 4: Update Firebase Public Name

**Goal:** Ensure Firebase auth emails show correct branding

### 4.1 Update Project Settings
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **⚙️ (Settings)** → **Project settings**

### 4.2 Configure Public-Facing Info
Update these fields:

| Field | Value |
|-------|-------|
| **Public-facing name** | `Pet Wash™ Admin` |
| **Support email** | `Support@PetWash.co.il` |

### 4.3 Save
- Click **Save**
- This affects password reset emails, verification emails, etc.

---

## ✅ Step 5: Verify Setup

### 5.1 Test Google Sign-In
1. Open your app: `https://petwash.co.il/fast-signin`
2. Click **"Continue with Gmail"**
3. You should see:
   - ✅ **"Pet Wash™ Admin"** (not "petwashproject...")
   - ✅ Your logo
   - ✅ "Verified" badge (if domain verified)
   - ✅ No "unverified app" warning

### 5.2 Test on iOS Safari
1. Open on iPhone: `https://petwash.co.il/fast-signin`
2. Click **"Continue with Gmail"**
3. Should automatically redirect (popup blocked on iOS)
4. Sign in completes successfully

### 5.3 Test on Android Chrome
1. Open on Android: `https://petwash.co.il/fast-signin`
2. Click **"Continue with Gmail"**
3. Should show popup or redirect
4. Sign in completes successfully

---

## 🚨 Troubleshooting

### ❌ Still seeing "petwashproject..."
**Solution:** 
- Clear browser cache and cookies
- Wait 10 minutes for Google OAuth changes to propagate
- Check you selected the correct Google Cloud project

### ❌ "Error: redirect_uri_mismatch"
**Solution:**
- Verify all redirect URIs are added to OAuth client
- Make sure Firebase authDomain matches
- Check for typos in URLs

### ❌ "This app isn't verified"
**Solution:**
- Publish OAuth consent screen (Step 1.3)
- Verify domain ownership (Step 2)
- Request verification from Google if needed

### ❌ iOS Safari popup blocked
**Solution:**
- This is expected! Our auth client automatically falls back to redirect
- No action needed - working as designed

---

## 📝 Checklist

Use this checklist to verify everything is configured:

- [ ] OAuth consent screen shows "Pet Wash™ Admin"
- [ ] Logo uploaded (512x512px square PNG)
- [ ] Support email set to Support@PetWash.co.il
- [ ] Consent screen published (not in Testing mode)
- [ ] Domain petwash.co.il verified in Search Console
- [ ] Authorized domains include petwash.co.il
- [ ] Web OAuth client has all JavaScript origins
- [ ] Web OAuth client has all redirect URIs
- [ ] Firebase public-facing name is "Pet Wash™ Admin"
- [ ] Firebase support email is Support@PetWash.co.il
- [ ] Tested sign-in on desktop Chrome ✅
- [ ] Tested sign-in on iOS Safari ✅
- [ ] Tested sign-in on Android Chrome ✅

---

## 🎯 Expected Result

After completing all steps, your Google OAuth prompt should look like:

```
┌─────────────────────────────────────┐
│  [Pet Wash™ Logo]                   │
│                                      │
│  Pet Wash™ Admin                    │
│  petwash.co.il ✓ Verified          │
│                                      │
│  wants to access your Google Account│
│                                      │
│  [Google Account Chooser]           │
│                                      │
│  ☑ View your email address          │
│  ☑ View your basic profile info     │
│                                      │
│  [Continue]         [Cancel]         │
└─────────────────────────────────────┘
```

---

## 📚 Additional Resources

- [Google OAuth Consent Screen Guide](https://support.google.com/cloud/answer/10311615)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Domain Verification](https://support.google.com/webmasters/answer/9008080)

---

**Last Updated:** November 5, 2025  
**Maintained By:** Pet Wash™ Engineering Team
