# Firebase Authentication Setup Guide

**CRITICAL**: You must complete these steps in Firebase Console for authentication to work.

## Step 1: Enable Email/Password Authentication

1. Go to Firebase Console: https://console.firebase.google.com/project/signinpetwash/authentication/providers
2. Click on **"Email/Password"** in the Sign-in providers list
3. Toggle **Enable** to ON
4. Click **Save**

## Step 2: Enable Google Sign-In

1. Stay on the same page (Sign-in providers)
2. Click on **"Google"** in the list
3. Toggle **Enable** to ON
4. Enter **Project support email**: `info@petwash.co.il`
5. Click **Save**

## Step 3: Authorize Your Domains

1. Go to: https://console.firebase.google.com/project/signinpetwash/authentication/settings
2. Scroll down to **"Authorized domains"**
3. Click **"Add domain"** and add these one by one:
   - `petwash.co.il`
   - `www.petwash.co.il`
   - `pet-wash-nl-nirhadad1.replit.app`
   - `localhost` (if not already there)
4. Click **Save** after each

## Step 4: Verify It Works

### Test Email/Password Login:
1. Go to `/signin` page
2. Enter email and password
3. Should redirect to dashboard

### Test Google Sign-In:
1. Go to `/signin` or `/admin-login`
2. Click "Sign in with Google" button
3. Choose your Google account
4. Should redirect to dashboard

### Test Face ID/Touch ID (if you have a passkey-enabled device):
1. After logging in with email/password once
2. Click "Enable Face ID" when prompted
3. Next login, tap email field → Face ID should auto-trigger
4. Or click "Sign in with Face ID" button

## What Each Authentication Method Does:

- **Email/Password**: Standard login with username and password
- **Google Sign-In**: One-click login using Google account  
- **Face ID/Touch ID/Passkeys**: Biometric authentication (most secure, no password needed)

## Troubleshooting:

### "auth/internal-error" error:
- **Cause**: Domain not authorized in Firebase Console
- **Fix**: Complete Step 3 above

### Google button shows popup then closes immediately:
- **Cause**: Google provider not enabled
- **Fix**: Complete Step 2 above

### Email/Password login doesn't work:
- **Cause**: Email/Password provider not enabled
- **Fix**: Complete Step 1 above

### Face ID doesn't work:
- **Cause**: You need to login with email/password first to register your device
- **Fix**: Login normally once, then enable biometric when prompted

## Current Status:

✅ Backend routes configured  
✅ Frontend forms ready  
✅ Session cookies working  
⏳ **WAITING FOR YOU:** Enable providers in Firebase Console (Steps 1-3 above)

**Once you complete Steps 1-3, authentication will work immediately!**
