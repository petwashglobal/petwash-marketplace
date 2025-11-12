# 📱 Pet Wash™ Employee Mobile App
**React Native iOS & Android App for Station Management & Task Tracking**

---

## 🎯 Overview

Premium mobile application for Pet Wash™ employees to manage K9000 smart washing stations, track daily tasks, and document pet washes. Integrates seamlessly with your existing Pet Wash backend.

### Key Features

- ✅ **Google Sign-In** - Uses your existing `/api/mobile-auth/google` endpoint
- ✅ **Station Control** - Real-time K9000 station management (based on user's code!)
- ✅ **Biometric Auth** - Face ID / Fingerprint support
- ✅ **QR Code Scanner** - Station check-in
- ✅ **Task Management** - Daily wash assignments
- ✅ **Photo Upload** - Before/after documentation
- ✅ **Push Notifications** - Firebase Cloud Messaging
- ✅ **Offline Mode** - Local storage with sync queue
- ✅ **Audit Logging** - Integrates with blockchain audit trail

---

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native 0.73
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State**: React Hooks + AsyncStorage
- **API**: Axios with interceptors
- **Auth**: Firebase Authentication
- **Push**: Firebase Cloud Messaging
- **Camera**: React Native Vision Camera
- **QR**: React Native QR Code Scanner
- **Biometric**: React Native Biometrics

### Backend Integration

All API calls go to your existing Pet Wash backend:

| Feature | Endpoint | Status |
|---------|----------|--------|
| **Google Sign-In** | `POST /api/mobile-auth/google` | ✅ Ready |
| **Employee Profile** | `GET /api/employees/:uid` | ✅ Ready |
| **Station List** | `GET /api/admin/stations` | ✅ Ready |
| **Station Control** | `POST /api/admin/stations/:id/status` | ✅ Ready |
| **Audit Trail** | `POST /api/audit` | ✅ Ready |

---

## 📁 Project Structure

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx           # Google Sign-In
│   │   ├── DashboardScreen.tsx       # Home screen
│   │   ├── StationControlScreen.tsx  # Station management ⭐
│   │   └── ...
│   │
│   ├── components/
│   │   ├── QRScanner.tsx            # QR code scanner
│   │   └── ...
│   │
│   ├── api/
│   │   └── petWashApi.ts            # Backend API client ⭐
│   │
│   ├── types/
│   │   └── index.ts                 # Shared TypeScript types ⭐
│   │
│   └── utils/
│       └── ...
│
├── android/                          # Android native code
├── ios/                              # iOS native code
├── App.tsx                           # Main app entry ⭐
├── package.json                      # Dependencies
└── README.md                         # This file
```

---

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)
- CocoaPods (for iOS dependencies)

### 1. Install Dependencies

```bash
cd mobile-app
npm install

# iOS only
cd ios && pod install && cd ..
```

### 2. Configure Firebase

Create `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from Firebase Console.

Place them in:
- Android: `android/app/google-services.json`
- iOS: `ios/GoogleService-Info.plist`

### 3. Configure Google Sign-In

Edit `src/screens/LoginScreen.tsx`:

```typescript
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',  // Backend Web Client ID
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',  // iOS Client ID
});
```

Get these from [Google Cloud Console](https://console.cloud.google.com/).

### 4. Configure API Base URL

Edit `src/api/petWashApi.ts`:

```typescript
const BASE_URL = __DEV__ 
  ? 'http://localhost:5000'            // Development
  : 'https://petwash.co.il';           // Production
```

### 5. Run the App

```bash
# iOS
npm run ios

# Android
npm run android
```

---

## 📱 Features Breakdown

### 1. Authentication Flow

```
1. User taps "Sign in with Google"
2. Google SDK returns idToken + serverAuthCode
3. App sends to: POST /api/mobile-auth/google
4. Backend verifies, returns customToken
5. App signs into Firebase with customToken
6. Prompt for biometric setup
7. Success → Navigate to Dashboard
```

**Implementation**: `src/screens/LoginScreen.tsx`

### 2. Station Control (Based on User's Code!)

```
1. Load stations from: GET /api/admin/stations
2. Display with Switch (user's exact code!)
3. Toggle status: POST /api/admin/stations/:id/status
4. Log to audit: POST /api/audit
5. Real-time updates every 30s
```

**Implementation**: `src/screens/StationControlScreen.tsx`

### 3. Task Management

```
1. Load today's tasks: GET /api/employees/:uid/tasks/today
2. Display in dashboard
3. Start task: POST /api/tasks/:id/start
4. Upload photos: POST /api/upload/task-photo
5. Complete task: POST /api/tasks/:id/complete
```

**Implementation**: `src/screens/DashboardScreen.tsx`

### 4. QR Code Scanner

```
1. Scan station QR code (format: petwash://station/:id)
2. Validate format
3. Check in: POST /api/admin/stations/:id/check-in
4. Log to audit trail
```

**Implementation**: `src/components/QRScanner.tsx`

### 5. Biometric Authentication

```
1. Check sensor availability (Face ID / Touch ID / Fingerprint)
2. Create biometric keys
3. Store encrypted credentials
4. Quick login on next use
```

**Implementation**: `src/screens/LoginScreen.tsx`

---

## 🔒 Security Features

### 1. Token Management

- **Storage**: AsyncStorage (encrypted on device)
- **Refresh**: Automatic token refresh
- **Expiry**: Handled by backend
- **Logout**: Clears all local data

### 2. Biometric Auth

- **iOS**: Face ID / Touch ID
- **Android**: Fingerprint / Face unlock
- **Fallback**: Google Sign-In
- **Keys**: Stored in Secure Enclave / Keystore

### 3. API Security

- **Headers**: Authorization Bearer token
- **Interceptors**: Auto-attach auth token
- **Retry**: Auto-retry on 401 (token expired)
- **Timeout**: 15 second request timeout

---

## 📊 API Client Documentation

### `petWashApi.ts`

All methods return Promises and throw errors on failure.

#### Authentication

```typescript
// Sign in with Google
await petWashApi.signInWithGoogle(idToken, authCode);

// Sign out
await petWashApi.signOut();
```

#### Employee

```typescript
// Get employee profile
const employee = await petWashApi.getEmployee(uid);

// List all employees (admin only)
const employees = await petWashApi.getEmployees();
```

#### Stations

```typescript
// Get all stations
const stations = await petWashApi.getStations();

// Get specific station
const station = await petWashApi.getStation(stationId);

// Update station status
await petWashApi.updateStationStatus(stationId, 'operational');

// Check in to station
await petWashApi.checkInToStation(stationId, employeeUid);
```

#### Tasks

```typescript
// Get today's tasks
const tasks = await petWashApi.getTodaysTasks(employeeUid);

// Start task
await petWashApi.startTask(taskId);

// Complete task
await petWashApi.completeTask(taskId, beforePhotoUrl, afterPhotoUrl, notes);
```

#### Audit

```typescript
// Log audit event
await petWashApi.logAuditEvent(
  'station_status_change',
  'station',
  stationId,
  { previousStatus: 'maintenance', newStatus: 'operational' }
);
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login with Google
- [ ] Biometric setup prompt appears
- [ ] Dashboard loads with tasks
- [ ] Station list loads
- [ ] Toggle station status (operational ↔ maintenance)
- [ ] QR code scanner opens
- [ ] Scan valid QR code
- [ ] Check in to station
- [ ] View task details
- [ ] Start task
- [ ] Upload before/after photos
- [ ] Complete task
- [ ] Push notification received
- [ ] Logout

### API Testing

```bash
# Test backend connectivity
curl https://petwash.co.il/api/health

# Test authentication
curl -X POST https://petwash.co.il/api/mobile-auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "...", "authCode": "..."}'
```

---

## 📲 Build & Release

### iOS

```bash
# Build for testing
npm run ios --configuration Release

# Create archive (Xcode)
# Product → Archive → Upload to App Store
```

### Android

```bash
# Build APK
cd android && ./gradlew assembleRelease

# Build AAB (for Google Play)
cd android && ./gradlew bundleRelease
```

---

## 🐛 Troubleshooting

### "Cannot connect to backend"

1. Check BASE_URL in `petWashApi.ts`
2. Ensure backend is running
3. Check network connectivity
4. Verify API endpoints exist

### "Google Sign-In failed"

1. Verify `webClientId` and `iosClientId` are correct
2. Check Firebase project configuration
3. Ensure OAuth consent screen is published
4. Verify redirect URIs in Google Cloud Console

### "Biometric not available"

1. Check device supports Face ID / Touch ID / Fingerprint
2. Verify biometric is enrolled in device settings
3. Grant biometric permission to app

---

## 🔄 Updates & Maintenance

### Update Dependencies

```bash
npm update
cd ios && pod update && cd ..
```

### Add New Feature

1. Create new screen in `src/screens/`
2. Add route in `App.tsx`
3. Update navigation types
4. Test on both iOS and Android

### Backend API Changes

1. Update types in `src/types/index.ts`
2. Update API client in `src/api/petWashApi.ts`
3. Update affected screens
4. Test integration

---

## 📚 Resources

- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase React Native](https://rnfirebase.io/)
- [Google Sign-In React Native](https://github.com/react-native-google-signin/google-signin)
- [Pet Wash Backend API](https://petwash.co.il/api-docs)

---

## 👥 Team

- **Backend**: Integrated with existing Pet Wash™ TypeScript/Node.js backend
- **Mobile**: React Native (TypeScript)
- **Design**: iOS Human Interface Guidelines + Material Design

---

## 📄 License

© 2025 Pet Wash™. All rights reserved.

---

**Pet Wash™ Employee App v1.0.0** 🐾
