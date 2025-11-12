# 📱 PetWash™ Mobile App - Expo Go

Premium mobile application for PetWash™ customers with 5-provider social authentication and Nayax K9000 station QR code redemption.

## 🎯 Features

### ✅ 5-Provider Social Authentication
- **Google Sign-In** - OAuth 2.0 with Firebase
- **Apple Sign-In** - Apple ID authentication
- **Facebook Login** - Facebook OAuth integration
- **GitHub OAuth** - Developer-friendly authentication
- **Email/Password** - Traditional authentication method

### 🎫 Nayax Station Redemption
- Generate QR codes for K9000 wash station redemption
- Secure, time-limited redemption codes (5-minute expiry)
- Integration with Nayax Cortina API
- One-time use codes for security
- Real-time validation at wash stations

### 📦 Wash Package Management
- View active wash packages
- Track remaining wash credits
- Purchase new packages
- Real-time balance updates

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required credentials:
- Firebase configuration (from Firebase Console)
- Google OAuth client IDs (from Google Cloud Console)
- Backend API URL

### 3. Start Expo Development Server

```bash
npm start
```

This will:
- Start the Expo development server
- Generate a QR code in your terminal
- Open Expo DevTools in your browser

### 4. Test on Your Device

#### Option A: Expo Go App (Recommended)
1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in terminal with:
   - **iOS**: Camera app
   - **Android**: Expo Go app
3. App will load on your device

#### Option B: iOS Simulator
```bash
npm run ios
```

#### Option C: Android Emulator
```bash
npm run android
```

## 📁 Project Structure

```
mobile-app/
├── App.tsx                          # Main app entry point
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx          # 5-provider authentication
│   │   ├── DashboardScreen.tsx      # QR code redemption & packages
│   │   └── ProfileScreen.tsx        # User profile & settings
│   ├── components/
│   │   └── NayaxQRCode.tsx          # QR code generator component
│   ├── services/
│   │   └── nayaxService.ts          # Nayax API integration
│   └── config/
│       └── firebase.ts              # Firebase configuration
├── assets/                          # App icons & splash screens
├── app.json                         # Expo configuration
└── package.json                     # Dependencies
```

## 🔐 Authentication Flow

### Google Sign-In
```typescript
1. User taps "Continue with Google"
2. expo-auth-session opens Google OAuth flow
3. User authorizes the app
4. Receive idToken and accessToken
5. Sign into Firebase with GoogleAuthProvider
6. Redirect to Dashboard
```

### Email/Password
```typescript
1. User enters email and password
2. Firebase Authentication validates credentials
3. Creates account if user doesn't exist
4. Signs in and redirects to Dashboard
```

## 🎫 Nayax Redemption Flow

### Mobile App (Customer Side)
```typescript
1. User taps "Generate QR Code"
2. App calls backend: POST /api/nayax/redemption/generate
3. Backend validates user has available credits
4. Backend generates time-limited redemption code
5. App displays QR code to user
6. Code expires after 5 minutes
```

### K9000 Station (Wash Station Side)
```typescript
1. Station scans customer's QR code
2. Station sends code to backend: POST /api/nayax/redemption/verify
3. Backend validates:
   - Code exists and hasn't expired
   - Code hasn't been used
   - User has remaining wash credits
4. Backend deducts 1 wash from user's balance
5. Backend returns success to station
6. Station activates wash cycle
```

## 🛠️ Backend Integration

The mobile app communicates with your PetWash™ backend at:
- **Development**: `http://localhost:5000/api`
- **Production**: `https://petwash.co.il/api`

### Required Backend Endpoints

#### Nayax Redemption
```typescript
POST /api/nayax/redemption/generate
Body: { userId: string }
Response: { success: boolean, redemptionCode: string }

POST /api/nayax/redemption/verify
Body: { code: string, stationId: string }
Response: { success: boolean, message: string }
```

#### Package Management
```typescript
GET /api/packages/user/:userId
Response: { packages: Package[] }
```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication providers:
   - Google
   - Apple (iOS only)
   - Facebook
   - GitHub
   - Email/Password
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
4. Add Firebase config to `.env`

### Google Sign-In Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials:
   - **Expo Client ID**: For Expo Go testing
   - **iOS Client ID**: For iOS app
   - **Android Client ID**: For Android app
   - **Web Client ID**: For backend verification
3. Add all client IDs to `.env`

## 📱 Testing

### Manual Testing Checklist
- [ ] Sign in with Google
- [ ] Sign in with Email/Password
- [ ] View user profile
- [ ] Generate Nayax QR code
- [ ] QR code displays correctly
- [ ] View wash packages
- [ ] Sign out

### QR Code Testing
1. Generate QR code in app
2. Screenshot the QR code
3. Use QR scanner app to verify data format
4. Expected format: `nayax://redeem/{redemptionCode}`

## 🚢 Deployment

### Build for iOS
```bash
eas build --platform ios
```

### Build for Android
```bash
eas build --platform android
```

### Publish Updates (OTA)
```bash
expo publish
```

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Check `EXPO_PUBLIC_API_BASE_URL` in `.env`
- Ensure backend is running on correct port
- Try accessing API directly in browser

### "Google Sign-In failed"
- Verify all Google OAuth client IDs are correct
- Check redirect URIs in Google Cloud Console
- Ensure Firebase Google provider is enabled

### "QR Code won't generate"
- Check user authentication status
- Verify backend `/api/nayax/redemption/generate` endpoint exists
- Check network connectivity
- Review backend logs for errors

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Nayax Cortina API](https://developer.nayax.com/)

## 👥 Support

For technical support or questions:
- Check the troubleshooting section
- Review backend logs
- Test API endpoints with curl/Postman

---

**PetWash™ Mobile v1.0.0** 🐾  
© 2025 Pet Wash Ltd. All rights reserved.
