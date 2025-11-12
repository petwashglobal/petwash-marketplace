# Apple Integration Setup Guide for Pet Wash™

## Overview
This guide covers the complete setup for Apple Sign-in and MapKit JS integration for the Pet Wash platform.

**Apple Developer Account**: Pet Wash Ltd (D-U-N-S: 517145033)

---

## 1. Apple Sign-in with Firebase Authentication

### Prerequisites
- ✅ Apple Developer Account (Active)
- [ ] Sign in with Apple - Services ID
- [ ] Sign in with Apple - Private Key (.p8 file)
- [ ] Team ID, Key ID from Apple Developer Portal

### Step 1: Apple Developer Portal Configuration

1. **Go to Apple Developer Portal** → Certificates, Identifiers & Profiles
2. **Create an App ID** (if not already created):
   - Name: `Pet Wash`
   - Bundle ID: `com.petwash.app` (or your preferred identifier)
   - Capabilities: Enable **Sign in with Apple**

3. **Create a Services ID**:
   - Click **Identifiers** → **+** → **Services IDs**
   - Description: `Pet Wash Web Authentication`
   - Identifier: `com.petwash.signin` (save this - it's your **APPLE_SERVICES_ID**)
   - Enable **Sign in with Apple**
   - Click **Configure**:
     - Primary App ID: Select the App ID you created above
     - Web Domain: `petwash.co.il`
     - Return URLs: 
       - `https://petwash.co.il/__/auth/handler`
       - `https://www.petwash.co.il/__/auth/handler`
       - `https://signinpetwash.firebaseapp.com/__/auth/handler`
   - Save and Continue

4. **Create a Private Key (.p8)**:
   - Click **Keys** → **+**
   - Key Name: `Pet Wash Sign in with Apple Key`
   - Enable **Sign in with Apple**
   - Click **Configure** → Select your Primary App ID
   - Click **Continue** → **Register**
   - **Download the .p8 file** (you can only download once!)
   - Note the **Key ID** (e.g., `ABC123XYZ`) - save this as **APPLE_KEY_ID**

5. **Get your Team ID**:
   - Go to Apple Developer **Membership** page
   - Copy your **Team ID** (e.g., `XYZ123ABC`) - save this as **APPLE_TEAM_ID**

### Step 2: Firebase Console Configuration

1. **Go to Firebase Console** → Authentication → Sign-in method
2. Click **Apple** → **Enable**
3. Enter your credentials:
   - **Services ID**: `com.petwash.signin` (from Step 1.3)
   - **Team ID**: Your Team ID from Step 1.5
   - **Key ID**: Your Key ID from Step 1.4
   - **Private Key**: Open the .p8 file and copy the entire contents (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
4. **Copy the OAuth redirect URI** from Firebase (e.g., `https://signinpetwash.firebaseapp.com/__/auth/handler`)
5. Go back to Apple Developer Portal → Services ID → Configure → Add this redirect URI if not already added
6. **Add authorized domains** in Firebase Authentication → Settings:
   - `petwash.co.il`
   - `www.petwash.co.il`
   - `localhost`
   - Your Replit domain
7. Click **Save**

### Step 3: Replit Environment Secrets

Once you receive your Apple credentials, add them as environment secrets in Replit:

```bash
# Apple Sign-in Credentials (for reference/backup - Firebase handles the auth)
APPLE_TEAM_ID=ABC123XYZ          # Your Team ID from Apple Developer
APPLE_KEY_ID=XYZ789ABC           # Key ID from the .p8 key
APPLE_SERVICES_ID=com.petwash.signin  # Services ID you created
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
-----END PRIVATE KEY-----        # Contents of .p8 file (multi-line)
```

**Note**: Firebase handles the actual OAuth flow, so these secrets are primarily for backup and potential direct API calls.

### Step 4: Testing Apple Sign-in

1. **Desktop Safari or iOS**: Click "Sign in with Apple" button
2. **Expected flow**:
   - Apple authentication popup appears
   - User authenticates with Face ID/Touch ID/password
   - User grants permission for email sharing
   - Redirects back to Pet Wash dashboard
3. **Verify** user profile is created in Firestore at `users/{uid}`

---

## 2. MapKit JS Integration

### Prerequisites
- ✅ Apple Developer Account (Active)
- [ ] MapKit JS Key

### Step 1: Create MapKit JS Key

1. **Go to Apple Developer Portal** → Certificates, Identifiers & Profiles → Keys
2. Click **+** to create a new key
3. **Key Name**: `Pet Wash MapKit JS`
4. Enable **MapKit JS**
5. Click **Continue** → **Register**
6. **Copy the Key ID** and **download the .p8 file**
7. **Get your Team ID** (same as Sign in with Apple)

### Step 2: Replit Environment Secrets

Add the MapKit credentials to Replit Secrets:

```bash
MAPKIT_JS_KEY_ID=DEF456GHI        # MapKit Key ID
MAPKIT_JS_TEAM_ID=ABC123XYZ       # Same Team ID as before
MAPKIT_JS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----         # Contents of MapKit .p8 file
```

### Step 3: Backend API Endpoints

The backend provides two endpoints for MapKit integration:

**`GET /api/maps/token`**: Generates JWT tokens with:
- Signed with your MapKit private key using ES256 algorithm
- Includes `origin` claim bound to the requesting domain (required by Apple)
- Valid for 30 minutes (1800 seconds)
- Origin validation against allowed domains list
- Returns: `{ success: true, token: "...", origin: "https://petwash.co.il", expiresIn: 1800 }`

**`GET /api/maps/config`**: Returns complete MapKit configuration:
- Fresh JWT token bound to requesting origin
- Language and color scheme settings
- Returns: `{ available: true, token: "...", language: "he", colorScheme: "light", origin: "..." }`

**Security**: The backend automatically validates that requests come from authorized origins:
- `https://petwash.co.il` (production)
- `https://www.petwash.co.il` (production)
- `http://localhost:5000` (development)
- `http://localhost:3000` (development)
- Replit preview domains (auto-detected in development)

**Custom Origins**: You can override the allowed origins list using the `MAPKIT_ALLOWED_ORIGINS` environment variable:
```bash
MAPKIT_ALLOWED_ORIGINS=https://petwash.co.il,https://www.petwash.co.il,https://staging.petwash.co.il
```

Requests from unauthorized origins receive HTTP 403 with error details showing both the requested origin and the allowed origins list.

### Step 4: Frontend Integration

Apple Maps will be available for:
- **Station Locator**: Find nearest Pet Wash stations
- **Service Area Map**: Display coverage zones
- **Navigation**: Get directions to stations
- **Live Station Status**: Real-time availability on map

---

## 3. Quick Reference

### When Apple Activates Your Account

**Send these items to Replit Secrets:**

1. **Sign in with Apple**:
   - Services ID (e.g., `com.petwash.signin`)
   - Team ID (e.g., `ABC123XYZ`)
   - Key ID (e.g., `XYZ789ABC`)
   - Private Key (.p8 file contents)

2. **MapKit JS**:
   - MapKit Key ID
   - Team ID (same as above)
   - MapKit Private Key (.p8 file contents)

### Firebase Console Checklist

- [ ] Enable Apple provider in Authentication → Sign-in method
- [ ] Add Services ID, Team ID, Key ID, Private Key
- [ ] Add authorized domains: `petwash.co.il`, `www.petwash.co.il`, `localhost`
- [ ] Copy OAuth redirect URI to Apple Developer Portal
- [ ] Test Apple Sign-in from production domain

### Testing Checklist

- [ ] Apple Sign-in works on iOS Safari
- [ ] Apple Sign-in works on macOS Safari
- [ ] Email is properly captured and stored in Firestore
- [ ] Session cookie is created after Apple login
- [ ] User redirects to dashboard after successful auth
- [ ] MapKit JS loads and displays maps correctly
- [ ] Station locations appear on Apple Maps

---

## 4. Architecture Notes

### Apple Sign-in Flow
```
User clicks "Sign in with Apple"
  ↓
Firebase Auth triggers Apple OAuth popup
  ↓
User authenticates with Apple ID
  ↓
Apple returns ID token to Firebase
  ↓
Frontend receives Firebase user credential
  ↓
Frontend calls /api/auth/session with ID token
  ↓
Backend creates pw_session cookie (5-day expiry)
  ↓
User redirects to /dashboard
```

### MapKit JS Flow
```
Frontend loads map component
  ↓
Frontend calls /api/maps/token or /api/maps/config
  ↓
Backend extracts origin from request headers (https://petwash.co.il)
  ↓
Backend validates origin is in allowed list
  ↓
Backend generates JWT with ES256 signature including origin claim
  ↓
JWT payload: { iss: TEAM_ID, iat: timestamp, exp: timestamp+1800, origin: "https://petwash.co.il" }
  ↓
Frontend receives token and initializes Apple Maps
  ↓
Apple Maps validates JWT signature and origin claim
  ↓
Map displays Pet Wash station locations
```

**Critical**: The `origin` claim in the JWT must match:
1. The domain making the request
2. The origin configured in Apple Developer Portal for your MapKit key
3. The origin Apple Maps validates against

Without the `origin` claim, Apple will reject the token with `MKErrorDomain error 7`.

---

## 5. Support & Troubleshooting

### Common Issues

**"Invalid Services ID"**
- Verify Services ID matches exactly in Firebase Console and Apple Developer Portal
- Check that Sign in with Apple is enabled for the Services ID

**"Invalid redirect URI"**
- Ensure Firebase OAuth redirect URI is added to Apple Services ID configuration
- Check for typos in the redirect URL

**"Invalid private key"**
- Ensure entire .p8 file contents are copied (including BEGIN/END markers)
- Check for extra spaces or line breaks

**Apple Sign-in button doesn't appear**
- Check browser console for errors
- Verify Firebase configuration is loaded correctly
- Test in Safari (Chrome may have compatibility issues)

### Additional Resources

- [Apple Developer Documentation - Sign in with Apple](https://developer.apple.com/sign-in-with-apple/)
- [Firebase Documentation - Apple Sign-in](https://firebase.google.com/docs/auth/web/apple)
- [MapKit JS Documentation](https://developer.apple.com/documentation/mapkitjs)

---

**Last Updated**: October 20, 2025
**Account**: Pet Wash Ltd (D-U-N-S: 517145033)
**Status**: ⏳ Awaiting Apple Developer Program activation
