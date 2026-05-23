# 🐾 Pet Wash™ Mobile Staff App

Enterprise-grade React Native mobile app with **biometric authentication**, **auto-lock on inactivity**, and **high-risk action protection**.

---

## 🚀 Features

✅ **Secure Login** - Email/password authentication with JWT tokens  
✅ **Biometric Unlock** - Face ID (iOS) & Fingerprint/Face (Android)  
✅ **Auto-Lock** - 10-minute inactivity timeout  
✅ **Token Refresh** - Silent background token renewal  
✅ **High-Risk Protection** - Re-authenticate for sensitive operations  
✅ **Future-Proof** - Automatically stays compatible with new iOS/Android firmware  

---

## 📦 Quick Start

### 1. Install Dependencies
```bash
cd mobile-app
npm install
```

### 2. Configure Backend API
`App.tsx` reads `EXPO_PUBLIC_API_BASE` at build time and falls back to
`https://api.petwash.co.il` if unset.

```bash
# Local dev against staging:
EXPO_PUBLIC_API_BASE=https://staging.petwash.co.il npm start

# Production build (default — no env needed):
eas build --platform ios --profile production
```

The `EXPO_PUBLIC_` prefix is required so Expo inlines the value into the
JS bundle. Anything not prefixed is stripped at build time.

### 3. Run the App
```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Start Expo Dev Server
npm start
```

---

## 🔐 How Authentication Works

### Login Flow
1. User enters email/password
2. App calls `POST /auth/login`
3. Backend returns `accessToken`, `refreshToken`, and `user` object
4. App stores `refreshToken` in iOS Keychain / Android Keystore
5. App prompts user to enable Face ID / fingerprint

### Biometric Unlock Flow
1. User opens app
2. App checks if biometrics are enabled
3. Shows Face ID / fingerprint prompt
4. On success, uses stored `refreshToken` to get new `accessToken`
5. User is logged in without typing password

### Auto-Lock on Inactivity
- Timer resets on every user interaction
- After 10 minutes of inactivity, app locks
- User must unlock with biometrics or re-login

### High-Risk Actions
For sensitive operations (delete station, change revenue share):
```typescript
const { requireBiometricAuth } = useAuth();

const handleDeleteStation = async (stationId: string) => {
  // Require biometric re-authentication
  const confirmed = await requireBiometricAuth("Delete K9000 Station");
  
  if (confirmed) {
    await api.delete(`/stations/${stationId}`);
    Alert.alert("Success", "Station deleted");
  } else {
    Alert.alert("Canceled", "Action not approved");
  }
};
```

---

## 🛡️ Security Features

### Token Security
- **Access Token**: Stored in memory only (never persisted)
- **Refresh Token**: Stored in iOS Keychain / Android Keystore
- **Token Rotation**: New refresh token on every use
- **Auto-Invalidation**: Refresh tokens invalidated on logout

### Biometric Security
- Uses native iOS Face ID and Android BiometricPrompt APIs
- Fallback to password if biometrics unavailable
- No biometric data leaves the device

### Network Security
- HTTPS only (no HTTP allowed)
- JWT tokens with HMAC-SHA256 signing
- Authorization header on all protected endpoints

---

## 📱 How This Stays Up-to-Date with iOS & Android

### The Secret: Official Libraries
This app uses **actively maintained Expo libraries** that track OS changes:

1. **expo-local-authentication**
   - Wraps iOS Face ID and Android BiometricPrompt APIs
   - When Apple or Google update firmware, Expo updates this package
   - You run `npm update` → biometrics keep working

2. **expo-secure-store**
   - Uses iOS Keychain and Android Keystore
   - Same logic: Expo tracks OS changes

3. **Auth Logic**
   - Written in TypeScript
   - Doesn't depend on OS-specific code
   - As long as backend keeps the contract, it works

### Upgrade Process
```bash
# Upgrade Expo and dependencies
npx expo upgrade

# Update all packages
npm update

# Rebuild the app
npm run ios    # or npm run android

# Biometrics now work with latest iOS/Android firmware 🎉
```

**No manual firmware-specific code required!**

---

## 🔧 Backend API Requirements

Your backend must implement these endpoints:

### POST /auth/login
```json
Request:
{
  "email": "staff@petwash.co.il",
  "password": "SecurePassword123!"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "usr_123",
    "email": "staff@petwash.co.il",
    "firstName": "David",
    "lastName": "Cohen",
    "roles": ["staff", "technician"],
    "permissions": ["stations.view", "stations.service"]
  }
}
```

### POST /auth/refresh
```json
Request:
{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",  // New refresh token (rotation)
  "user": { ... }
}
```

### POST /auth/logout
```json
Request:
{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Full API spec:** See `docs/BACKEND_API_SPEC.md`

---

## 📚 Usage Examples

### Using the Global API Client
```typescript
import { api } from "./App";

// GET request (automatically includes Authorization header)
const stations = await api.get("/stations");

// POST request
const newTask = await api.post("/tasks", {
  stationId: "st_123",
  type: "service",
  description: "Replace filter",
});

// DELETE with high-risk protection
const { requireBiometricAuth } = useAuth();

const deleteStation = async (id: string) => {
  const confirmed = await requireBiometricAuth("Delete Station");
  if (confirmed) {
    await api.delete(`/stations/${id}`);
  }
};
```

### Reading Auth State in Components
```typescript
import { useAuth } from "./App";

function MyComponent() {
  const { state } = useAuth();

  if (!state.user) return <Text>Not logged in</Text>;

  return (
    <View>
      <Text>Email: {state.user.email}</Text>
      <Text>Roles: {state.user.roles.join(", ")}</Text>
    </View>
  );
}
```

---

## 🎨 Customization

### Change Inactivity Timeout
```typescript
// In App.tsx, line 20
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
```

### Change API Base URL
Set `EXPO_PUBLIC_API_BASE` at build/run time (see "Configure Backend API"
above). No source edit needed.

### Change Brand Colors
```typescript
// In App.tsx, styles section
button: {
  backgroundColor: "#22c55e", // Change to your brand color
  // ...
}
```

---

## 🧪 Testing

### Test Login Flow
1. Open app
2. Enter email and password
3. Tap "Login"
4. App should show main screen

### Test Biometric Unlock
1. Login once
2. Close app
3. Reopen app
4. Face ID / fingerprint prompt should appear
5. Authenticate → app unlocks

### Test Auto-Lock
1. Login
2. Wait 10 minutes without touching the screen
3. App should lock automatically
4. Unlock with biometrics

### Test High-Risk Action
1. In `MainAppNavigator`, tap "High-Risk Action"
2. Biometric prompt should appear
3. Authenticate → action approved
4. Cancel → action denied

---

## 📋 Production Checklist

Before deploying to production:

- [ ] Update `API_BASE` to production URL
- [ ] Enable HTTPS only (no HTTP)
- [ ] Set up backend refresh token rotation
- [ ] Implement backend rate limiting
- [ ] Test on real iOS and Android devices
- [ ] Test biometrics on different devices (iPhone, Samsung, Pixel)
- [ ] Set up error tracking (Sentry, Bugsnag)
- [ ] Set up analytics (Firebase Analytics, Mixpanel)
- [ ] Add push notifications (for task assignments)
- [ ] Submit to App Store and Google Play (see next section)

---

## 🛫 App Store / Play Store submission

This project now ships with the Expo submission scaffold:

- `app.json` — bundle ID `il.co.petwash.staff`, NSFaceIDUsageDescription,
  Apple Privacy Manifest, Android biometric permissions.
- `eas.json` — `development`, `preview`, `production` build profiles
  plus `submit` profile.
- `.gitignore` — excludes prebuilt `ios/` and `android/`, signing assets,
  service-account keys, secrets.
- `assets/README.md` — exact icon / splash / screenshot specs.

### One-time setup (Apple developer)

1. Install EAS CLI: `npm i -g eas-cli` and `eas login`.
2. From `mobile-app/`, run `eas init` — this fills the `extra.eas.projectId`
   field in `app.json`. Commit that change.
3. Drop real PNG assets into `mobile-app/assets/` per `assets/README.md`.
4. In `eas.json`, replace the three `REPLACE_WITH_*` fields under
   `submit.production.ios` with your Apple ID, App Store Connect app ID,
   and Apple Team ID.
5. Create the app shell in App Store Connect (name "PetWash Staff",
   bundle ID `il.co.petwash.staff`) and in Google Play Console.

### Build & submit

```bash
# TestFlight build (signed)
eas build --platform ios --profile production
eas submit --platform ios --latest

# Play Store internal track (AAB)
eas build --platform android --profile production
eas submit --platform android --latest
```

### Store listing assets (uploaded in the consoles, NOT in this repo)

- App Store: 3+ screenshots at 6.7" (1290 × 2796) and 6.5"
  (1242 × 2688 or 1284 × 2778); iPad 12.9" required since
  `supportsTablet: true`.
- Play Store: 512 × 512 icon, 1024 × 500 feature graphic, 2+ phone
  screenshots, privacy policy URL.

### Still TODO before App Review will approve

- [ ] Real icon / splash / adaptive icon (placeholder paths exist; binaries do not).
- [ ] Privacy policy URL hosted on petwash.co.il.
- [ ] Demo staff credentials for App Review reviewer (Apple requires login).
- [ ] App Store screenshots taken on real device / simulator.
- [ ] `API_BASE` in `App.tsx` confirmed against production backend.

---

## 🐛 Troubleshooting

### Biometrics Not Working
1. **Simulator/Emulator**: Biometrics don't work in simulators. Test on real device.
2. **No Hardware**: Device must have Face ID or fingerprint sensor.
3. **Not Enrolled**: User must have Face ID or fingerprint enrolled in device settings.

### Token Refresh Failing
1. Check backend `/auth/refresh` endpoint
2. Ensure backend returns new `refreshToken` (rotation)
3. Check backend logs for expired tokens

### App Keeps Locking
1. Check `INACTIVITY_TIMEOUT_MS` setting
2. Ensure user interactions reset the timer
3. Check console for timer-related errors

---

## 📞 Support

For technical support or questions about the mobile app:
- **Backend API Issues**: Check `docs/BACKEND_API_SPEC.md`
- **Biometric Issues**: Ensure device has Face ID/fingerprint enrolled
- **General Questions**: Contact Pet Wash™ development team

---

## 📄 License

© 2025 Pet Wash™. All rights reserved.
