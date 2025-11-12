# 📱 Mobile Authentication Integration - Pet Wash™
**iOS & Android Google Sign-In with Biometric OAuth2**
*Implementation Date: October 27, 2025*

---

## 🎯 Overview

Production-grade mobile authentication system for Pet Wash™ iOS and Android apps using Google Sign-In with serverAuthCode flow, enabling secure backend token exchange and biometric authentication.

---

## 🏗️ Architecture

### Flow Diagram
```
┌─────────────┐
│  iOS/Android│
│   Mobile App│
└──────┬──────┘
       │ 1. User taps "Sign in with Google"
       │ 2. Google Sign-In SDK
       ▼
┌─────────────┐
│   Google    │
│  OAuth 2.0  │
└──────┬──────┘
       │ 3. Returns idToken + serverAuthCode
       │
       ▼
┌─────────────┐
│  Mobile App │ POST /api/mobile-auth/google
└──────┬──────┘ { idToken, authCode }
       │
       ▼
┌─────────────┐
│  Pet Wash   │ 4. Verify idToken (security)
│   Backend   │ 5. Exchange authCode for refresh token
│  (Node.js)  │ 6. Create/update Firebase user
└──────┬──────┘ 7. Create Firestore profile (Bronze tier)
       │ 8. Return customToken
       ▼
┌─────────────┐
│  Mobile App │ 9. Sign into Firebase SDK
└──────┬──────┘ 10. Prompt Passkey creation (WebAuthn)
       │
       ▼
    Success!
```

---

## 📱 Mobile Implementation

### iOS (Swift)

**Dependencies:**
```swift
// In your Podfile or SPM:
import GoogleSignIn
import AuthenticationServices
```

**Configuration:**
```swift
// GoogleService-Info.plist required
let IOS_CLIENT_ID = "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
let WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
```

**Sign-In Code:**
```swift
func signInWithGoogle(presenting: UIViewController) {
    let signInConfig = GIDConfiguration(
        clientID: IOS_CLIENT_ID,
        serverClientID: WEB_CLIENT_ID, // Critical: Web client ID
        scopes: ["email", "profile"]
    )
    
    GIDSignIn.sharedInstance.signIn(
        with: signInConfig, 
        presenting: presenting
    ) { user, error in
        guard let user = user, 
              let idToken = user.idToken?.tokenString,
              let authCode = user.serverAuthCode else {
            return
        }
        
        // Send to Pet Wash backend
        PetWashAPI.signIn(idToken: idToken, authCode: authCode)
    }
}
```

### Android (Kotlin)

**Dependencies:**
```kotlin
// build.gradle.kts
implementation("androidx.credentials:credentials:1.3.0")
implementation("com.google.android.libraries.identity.googleid:googleid:1.1.0")
```

**Configuration:**
```xml
<!-- res/values/strings.xml -->
<string name="google_web_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
```

**Sign-In Code:**
```kotlin
suspend fun signInWithGoogle(context: Context) {
    val credentialManager = CredentialManager.create(context)
    
    val googleIdOption = GetGoogleIdOption(
        serverClientId = context.getString(R.string.google_web_client_id),
        requestServerAuthCode = true, // Critical!
        filterByAuthorizedAccounts = false
    )
    
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(googleIdOption)
        .build()
    
    val result = credentialManager.getCredential(context, request)
    val credential = GoogleIdTokenCredential.createFrom(result.credential.data)
    
    // Send to Pet Wash backend
    PetWashAPI.signIn(
        idToken = credential.idToken!!,
        authCode = credential.serverAuthCode!!
    )
}
```

---

## 🖥️ Backend Implementation

### Endpoint: `POST /api/mobile-auth/google`

**File:** `server/routes/mobile-auth.ts`

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "authCode": "4/0AY0e-g7..."
}
```

**Response:**
```json
{
  "success": true,
  "customToken": "eyJhbGciOiJSUzI1NiIs...", // Firebase custom token
  "token": "eyJhbGciOiJIUzI1NiIs...",       // Optional JWT
  "user": {
    "uid": "firebase-uid-123",
    "email": "user@example.com",
    "name": "John Doe",
    "photoURL": "https://...",
    "loyaltyTier": "bronze",
    "role": "customer"
  }
}
```

**Security Features:**
1. ✅ **ID Token Verification** - Ensures token came from Google
2. ✅ **Audience Check** - Validates token is for your app
3. ✅ **Code Exchange** - Server-side only (secure)
4. ✅ **Refresh Token Storage** - For offline Google API access
5. ✅ **Rate Limiting** - Prevents abuse
6. ✅ **Firebase Integration** - Creates/updates user automatically
7. ✅ **Loyalty System** - Auto-assigns Bronze tier to new users

---

## 🔐 Required Environment Variables

Add these secrets to your Replit environment:

```bash
# Google OAuth Credentials
GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_SECRET=YOUR_WEB_CLIENT_SECRET

# Optional: JWT signing (if not using Firebase tokens exclusively)
MOBILE_LINK_SECRET=your-secure-jwt-secret-key
```

**Note:** `VITE_GOOGLE_CLIENT_ID` is already available for web OAuth.

---

## 🔧 Google Cloud Console Setup

### 1. Create OAuth 2.0 Credentials

**Three Client IDs Required:**

1. **Web Application** (Backend)
   - Type: Web application
   - Authorized redirect URIs: `postmessage`
   - Use: Backend token exchange
   - Scope: `GOOGLE_WEB_CLIENT_ID`

2. **iOS Application**
   - Type: iOS
   - Bundle ID: `com.petwash.app`
   - Use: iOS app authentication
   - Scope: Mobile app only

3. **Android Application**
   - Type: Android
   - Package name: `com.petwash.app`
   - SHA-1 certificate: `your-keystore-sha1`
   - Use: Android app authentication
   - Scope: Mobile app only

### 2. Enable Required APIs
- ✅ Google+ API (for profile data)
- ✅ Google Identity Toolkit API
- ✅ Cloud Resource Manager API

---

## 🧪 Testing

### Mobile API Test (cURL)
```bash
curl -X POST https://petwash.co.il/api/mobile-auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_ID_TOKEN",
    "authCode": "YOUR_AUTH_CODE"
  }'
```

### Token Verification Test
```bash
curl -X POST https://petwash.co.il/api/mobile-auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_JWT_TOKEN"}'
```

---

## 📊 Integration with Pet Wash Features

### 1. Loyalty System
- New users automatically assigned **Bronze tier**
- Stored in Firestore: `/users/{uid}/profile/data`
- Syncs with existing loyalty routes: `/api/loyalty/*`

### 2. Firebase Authentication
- Creates Firebase user if not exists
- Sets display name and photo from Google
- Marks email as verified if Google confirms

### 3. Firestore Profile
```
users/{uid}/
  ├── email, name, photoURL, role, loyaltyTier
  ├── profile/data/
  │   └── firstName, lastName, phoneNumber, etc.
  └── private/tokens/
      └── googleRefreshToken (encrypted)
```

### 4. Passkey Integration (Next Step)
After successful OAuth:
```swift
// iOS
PetWashPasskeyManager.registerNewPasskey()

// Android
promptUserToCreatePasskey(context)
```

---

## 🚨 Security Best Practices

### Mobile App
1. **Never hardcode** client secrets in apps
2. **Always use** serverAuthCode flow (not legacy auth flow)
3. **Validate** serverClientID matches your backend
4. **Implement** certificate pinning for API calls
5. **Store tokens** in iOS Keychain / Android EncryptedSharedPreferences

### Backend
1. **Always verify** ID token before trusting user
2. **Check audience** matches your client ID
3. **Use HTTPS** only for token exchange
4. **Rate limit** authentication endpoints
5. **Log security events** to Sentry/Winston
6. **Rotate secrets** every 90 days

---

## 🔄 Migration from Legacy Auth

If you have existing users with email/password:

```typescript
// Link Google account to existing user
const existingUser = await auth.getUserByEmail(email);
await auth.updateUser(existingUser.uid, {
  providerData: [{
    providerId: 'google.com',
    uid: googleId
  }]
});
```

---

## 📱 Mobile SDK Examples

### iOS Complete Flow
```swift
// 1. Google Sign-In
signInWithGoogle(presenting: self)

// 2. API Call (in callback)
PetWashAPI.signIn(idToken: idToken, authCode: authCode) { result in
    switch result {
    case .success(let response):
        // 3. Sign into Firebase
        Auth.auth().signIn(withCustomToken: response.customToken) { user, error in
            // 4. Navigate to home screen
            self.showHomeScreen()
            
            // 5. Prompt for Passkey
            PetWashPasskeyManager.registerNewPasskey()
        }
    case .failure(let error):
        print("Auth failed: \(error)")
    }
}
```

### Android Complete Flow
```kotlin
// 1. Google Sign-In
val result = signInWithGoogle(context)

// 2. API Call
val response = PetWashAPI.signIn(
    idToken = result.idToken,
    authCode = result.authCode
)

// 3. Sign into Firebase
FirebaseAuth.getInstance()
    .signInWithCustomToken(response.customToken)
    .addOnSuccessListener {
        // 4. Navigate to home
        startActivity(Intent(this, HomeActivity::class.java))
        
        // 5. Prompt for Passkey
        promptUserToCreatePasskey(context)
    }
```

---

## 📈 Monitoring & Analytics

### Success Metrics
- Track via logger: `[Mobile Auth] Successful login: ${email}`
- Firebase Analytics: `mobile_sign_in_success`
- Loyalty tier distribution: Bronze users from mobile

### Error Tracking
- Sentry alerts for OAuth failures
- Rate limit violations logged
- Invalid token attempts flagged

---

## 🔗 Related Documentation

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Google Sign-In iOS](https://developers.google.com/identity/sign-in/ios)
- [Google Sign-In Android](https://developers.google.com/identity/sign-in/android)
- [OAuth 2.0 for Mobile Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

---

## 🎯 Next Steps

1. ✅ Backend endpoint implemented (`/api/mobile-auth/google`)
2. ✅ Route registered in Express app
3. ⏳ Add `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_WEB_CLIENT_SECRET` to secrets
4. ⏳ Configure Google Cloud Console OAuth credentials
5. ⏳ Implement iOS mobile app client
6. ⏳ Implement Android mobile app client
7. ⏳ Integrate Passkey creation after OAuth
8. ⏳ Production testing with real devices

---

**Pet Wash™ - Banking-Grade Mobile Authentication** 🐾
