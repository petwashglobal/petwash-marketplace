# PetWash™ Ltd - Customer Mobile App Setup Guide

## 🎯 Overview
Premium React Native (Expo) mobile app for PetWash™ Ltd customers with luxury design and comprehensive OAuth social sign-in.

**Brand:** PetWash™ Ltd | #PetWashLtd  
**Design:** Minimalist luxury with clean white background  
**Social Providers:** Google, Apple, Facebook, TikTok, Microsoft  

---

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **Expo CLI** 
   ```bash
   npm install -g expo-cli
   ```
3. **Expo Go App** (for testing on physical device)
   - iOS: Download from App Store
   - Android: Download from Google Play

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd mobile-app
npm install
```

### 2. Configure Firebase (Use Existing Project)
The app is already configured to use your existing Firebase project:
- Project ID: `signinpetwash`
- Auth Domain: `signinpetwash.firebaseapp.com`

Copy your Firebase web credentials:
```bash
# From web app .env file
cp ../.env .env
```

### 3. Start Development Server
```bash
npm start
```

This will open Expo Dev Tools. Choose:
- **i** - Run on iOS simulator
- **a** - Run on Android emulator  
- **Scan QR code** - Run on physical device with Expo Go

---

## 🔐 OAuth Provider Setup

### Google Sign-In (✅ Priority - with Consent Screen)

1. **Google Cloud Console** (https://console.cloud.google.com)
   - Select project: `signinpetwash`
   - Navigate to: APIs & Services > Credentials

2. **Create OAuth Client ID**
   - Type: **iOS**
   - Bundle ID: `com.petwash.customer`
   - Copy the Client ID

3. **Update Configuration**
   ```typescript
   // mobile-app/src/screens/CustomerAuthScreen.tsx
   const clientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
   ```

4. **Configure Expo**
   ```json
   // app.json
   "ios": {
     "config": {
       "googleSignIn": {
         "reservedClientId": "YOUR_IOS_CLIENT_ID"
       }
     }
   }
   ```

5. **Enable Consent Screen**
   - OAuth consent screen is configured to show on every sign-in
   - Configured in: `src/config/firebase.ts`
   - `prompt: 'consent'` ensures consent screen always appears

---

### Apple Sign-In

1. **Apple Developer Account Required**
   - Sign in to https://developer.apple.com

2. **Register App ID**
   - Identifier: `com.petwash.customer`
   - Enable "Sign in with Apple" capability

3. **Create Services ID**
   - Identifier: `com.petwash.customer.signin`
   - Configure domains and redirect URLs

4. **Update Firebase**
   - Firebase Console > Authentication > Sign-in method
   - Enable Apple provider
   - Add Service ID

---

### Facebook Sign-In

1. **Facebook Developers** (https://developers.facebook.com)
   - Create new app or use existing
   - Add "Facebook Login" product

2. **Configure OAuth Settings**
   ```
   App ID: YOUR_FACEBOOK_APP_ID
   App Secret: YOUR_FACEBOOK_APP_SECRET
   ```

3. **Add Platform**
   - **iOS**: Bundle ID `com.petwash.customer`
   - **Android**: Package name `com.petwash.customer`

4. **Update Code**
   ```typescript
   const clientId = process.env.FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID';
   ```

---

### TikTok Sign-In

1. **TikTok for Developers** (https://developers.tiktok.com)
   - Create application
   - Enable Login Kit

2. **Get Credentials**
   ```
   Client Key: YOUR_TIKTOK_CLIENT_KEY
   Client Secret: YOUR_TIKTOK_CLIENT_SECRET
   ```

3. **Add Redirect URI**
   ```
   petwash://auth
   ```

4. **Update Code**
   ```typescript
   // Already configured in src/config/firebase.ts
   export const tiktokConfig = {
     clientKey: 'YOUR_KEY',
     clientSecret: 'YOUR_SECRET',
     // ...
   };
   ```

---

### Microsoft Sign-In

1. **Azure Portal** (https://portal.azure.com)
   - Azure Active Directory > App registrations
   - New registration

2. **Configure App**
   - Name: PetWash Customer Mobile
   - Supported account types: Personal + Work accounts
   - Redirect URI: `petwash://auth`

3. **Get Credentials**
   ```
   Application (client) ID: YOUR_MICROSOFT_CLIENT_ID
   ```

4. **Update Code**
   ```typescript
   const clientId = 'YOUR_MICROSOFT_CLIENT_ID';
   ```

---

## 🎨 Features

### Implemented
✅ Premium luxury UI design  
✅ Email/Password authentication  
✅ Google OAuth (with consent screen)  
✅ Apple Sign-In  
✅ Facebook Login  
✅ TikTok Login  
✅ Microsoft Sign-In  
✅ Sign Up screen  
✅ Forgot Password screen  
✅ Firebase integration  
✅ Navigation structure  

### To Be Implemented
⏳ Home screen (post-authentication)  
⏳ Pet profile management  
⏳ Booking system  
⏳ Loyalty rewards  
⏳ Payment integration  

---

## 📱 Testing

### iOS Simulator
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Physical Device
1. Install **Expo Go** app
2. Run `npm start`
3. Scan QR code with camera (iOS) or Expo Go app (Android)

---

## 🔧 Environment Variables

Create `.env` file in mobile-app directory:
```env
# Firebase (from existing web app)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_PROJECT_ID=signinpetwash
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# OAuth Providers
GOOGLE_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
FACEBOOK_APP_ID=YOUR_FACEBOOK_APP_ID
TIKTOK_CLIENT_KEY=YOUR_TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET=YOUR_TIKTOK_CLIENT_SECRET
MICROSOFT_CLIENT_ID=YOUR_MICROSOFT_CLIENT_ID
```

---

## 📦 Building for Production

### iOS (App Store)
```bash
expo build:ios
```

### Android (Google Play)
```bash
expo build:android
```

### Using EAS Build (Recommended)
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

---

## 🎯 Key Files

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── CustomerAuthScreen.tsx     # Main sign-in (Google/Apple/FB/TikTok/MS)
│   │   ├── SignUpScreen.tsx           # Account creation
│   │   └── ForgotPasswordScreen.tsx   # Password reset
│   ├── config/
│   │   └── firebase.ts                # Firebase & OAuth config
│   └── navigation/
├── CustomerApp.tsx                    # App entry point
├── app.json                          # Expo configuration
└── CUSTOMER_APP_SETUP.md            # This file
```

---

## 🔐 Security Notes

1. **Never commit credentials** to Git
2. Use **.env.local** for local development
3. Store production secrets in **Expo Secrets** or **EAS Build Secrets**
4. Enable **App Check** in Firebase for production
5. All OAuth flows use **PKCE** for enhanced security

---

## 🆘 Troubleshooting

### Google Sign-In not working
- Verify iOS Client ID in `app.json`
- Check Bundle ID matches in Google Cloud Console
- Ensure `prompt: 'consent'` is set for consent screen

### Apple Sign-In fails
- Check Apple Developer account has capability enabled
- Verify Services ID is correctly configured
- Test on real device (simulator may have limitations)

### Facebook Login issues
- Confirm App ID in Facebook Developers console
- Check platform configurations (iOS/Android Bundle IDs)
- Enable "Client OAuth Login" in dashboard

### TikTok authorization fails
- Verify Client Key and redirect URI
- Check application is approved by TikTok
- Review scopes requested

### Microsoft Sign-In problems
- Confirm redirect URI matches exactly
- Check tenant configuration (use 'common' for all accounts)
- Verify API permissions are granted

---

## 📞 Support

**Email:** support@petwash.co.il  
**Website:** www.petwash.co.il  
**Hashtag:** #PetWashLtd  

---

© 2025 PetWash™ Ltd. All rights reserved.
