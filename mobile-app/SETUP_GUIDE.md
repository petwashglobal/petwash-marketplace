# 🚀 PetWash Mobile - Complete Setup Guide

## Prerequisites Checklist

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Expo Go app on your iOS/Android device
- ✅ Firebase project created (signinpetwash)
- ✅ Google Cloud Console project with required APIs enabled

---

## Step 1: Enable Google APIs

### 1.1 Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `signinpetwash`

### 1.2 Enable Required APIs
Navigate to **APIs & Services > Library** and enable:

- ✅ **Google Places API** (for address autocomplete)
- ✅ **Maps JavaScript API** (optional, for map display)
- ✅ **Geocoding API** (for address validation)

### 1.3 Verify API Status
Run this command to check:
```bash
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Tel%20Aviv&key=YOUR_API_KEY"
```

Expected response: JSON with predictions (not an error about API not enabled)

---

## Step 2: Configure API Keys

### 2.1 Get Google Places API Key
1. In Google Cloud Console, go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. **Restrict the API Key** (Important for security):
   - Application restrictions: **HTTP referrers** or **None** (for testing only)
   - API restrictions: Select **Google Places API**
4. Copy the API key

### 2.2 Create .env File
```bash
cd mobile-app
cp .env.example .env
```

### 2.3 Edit .env File
```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDRu4QaGIgKTlYN5nALBWvJHTLYg3fJQYM
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=signinpetwash.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=signinpetwash
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=signinpetwash.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_actual_app_id

# Google Sign-In OAuth (from Google Cloud Console)
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your_expo_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id

# Backend API
EXPO_PUBLIC_API_BASE_URL=https://petwash.co.il/api

# Google Places API (PASTE YOUR KEY HERE)
EXPO_PUBLIC_GOOGLE_PLACES_KEY=AIza...your_actual_key_here
```

---

## Step 3: Install Dependencies

```bash
cd mobile-app
npm install
```

This will install:
- Expo SDK 50
- React Navigation
- Firebase SDK
- Google Places Autocomplete
- QR Code generator
- And all other dependencies

---

## Step 4: Start Development Server

```bash
npm start
```

This will:
1. Start the Expo development server
2. Display a QR code in your terminal
3. Open Expo DevTools in your browser (http://localhost:19002)

---

## Step 5: Test on Your Device

### Option A: Expo Go (Recommended for Testing)

#### iOS:
1. Install **Expo Go** from App Store
2. Open Camera app
3. Scan the QR code from terminal
4. App will open in Expo Go

#### Android:
1. Install **Expo Go** from Play Store
2. Open Expo Go app
3. Scan the QR code from terminal
4. App will load

### Option B: Simulators

#### iOS Simulator:
```bash
npm run ios
```

#### Android Emulator:
```bash
npm run android
```

---

## Step 6: Test Address Autocomplete

### 6.1 Sign In
1. Open the app
2. Sign in with any of the 5 authentication methods:
   - Google
   - Apple (requires Apple Developer account)
   - Facebook (requires Facebook App ID)
   - GitHub (requires GitHub OAuth app)
   - Email/Password

### 6.2 Test Address Lookup
1. Navigate to Dashboard
2. Scroll to **"📍 Delivery Address"** section
3. Start typing an address (e.g., "Tel Aviv")
4. You should see autocomplete suggestions appear
5. Click a suggestion
6. Address details (full address, lat/lon) should display

### Expected Behavior:
- ✅ Suggestions appear as you type
- ✅ Selected address shows in green box
- ✅ Coordinates display below address
- ✅ "Address Saved" alert appears

### Troubleshooting:
❌ **No suggestions appear**:
- Check that `EXPO_PUBLIC_GOOGLE_PLACES_KEY` is set in .env
- Verify Google Places API is enabled
- Check network connectivity
- Open browser console for errors

❌ **"API key not valid" error**:
- Verify API key is correct
- Check API key restrictions in Google Cloud Console
- Ensure Google Places API is enabled for this key

---

## Step 7: Verify API Integration

### Test the API Key Manually:
```bash
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Tel%20Aviv&key=YOUR_API_KEY"
```

Expected response:
```json
{
  "predictions": [
    {
      "description": "Tel Aviv-Yafo, Israel",
      "place_id": "ChIJ...",
      ...
    }
  ],
  "status": "OK"
}
```

Error responses and fixes:
- `REQUEST_DENIED` → API key invalid or API not enabled
- `INVALID_REQUEST` → Missing required parameters
- `OVER_QUERY_LIMIT` → Exceeded API quota

---

## Step 8: Test Full User Flow

### Complete Testing Checklist:
- [ ] Sign in with Google
- [ ] Dashboard loads with user name
- [ ] Address Lookup component appears
- [ ] Type "Tel Aviv" in address field
- [ ] Autocomplete suggestions appear
- [ ] Click a suggestion
- [ ] Address fills instantly
- [ ] Coordinates display correctly
- [ ] "Address Saved" alert appears
- [ ] Address persists in summary box
- [ ] Can clear address and search again
- [ ] Generate Nayax QR code
- [ ] Sign out successfully

---

## Architecture Overview

### Address Autocomplete Data Flow

```
User types address
       ↓
AddressLookup.tsx component
       ↓
Google Places API
(via EXPO_PUBLIC_GOOGLE_PLACES_KEY)
       ↓
Returns predictions with:
- formatted_address
- latitude
- longitude
- place_id
       ↓
User selects prediction
       ↓
DashboardScreen receives:
{
  fullAddress: "123 Main St, Tel Aviv",
  latitude: 32.0853,
  longitude: 34.7818,
  placeId: "ChIJ..."
}
       ↓
Saved to deliveryAddress state
       ↓
Can be used for:
- Order delivery
- Store locator
- Wash station finder
```

---

## Security Best Practices

### ⚠️ Important Security Notes:

1. **API Key Restrictions**:
   - Never commit .env files to git
   - Always restrict API keys in Google Cloud Console
   - Use separate keys for dev/staging/production

2. **Production Deployment**:
   For production, consider proxying Google Places API through your backend:
   ```typescript
   // Instead of direct client-side call:
   // GooglePlacesAutocomplete with API key
   
   // Use backend proxy:
   const response = await fetch('https://petwash.co.il/api/places/autocomplete?input=Tel Aviv');
   ```

3. **Rate Limiting**:
   - Google Places API has usage limits
   - Monitor usage in Google Cloud Console
   - Consider caching frequently-searched addresses

---

## File Structure

```
mobile-app/
├── src/
│   ├── components/
│   │   ├── AddressLookup.tsx        ← Address autocomplete component
│   │   └── NayaxQRCode.tsx          ← QR code generator
│   ├── screens/
│   │   ├── DashboardScreen.tsx      ← Uses AddressLookup
│   │   ├── LoginScreen.tsx          ← 5-provider auth
│   │   └── ProfileScreen.tsx
│   ├── services/
│   │   └── nayaxService.ts          ← Nayax API integration
│   └── config/
│       └── firebase.ts              ← Firebase config
├── .env                             ← Your secrets (DO NOT COMMIT)
├── .env.example                     ← Template for .env
├── package.json                     ← Dependencies
└── README.md                        ← Quick start guide
```

---

## Troubleshooting Common Issues

### Issue: "Expo Go won't open the app"
**Solution**: 
- Ensure device and computer are on same WiFi
- Try scanning QR code again
- Check Expo CLI version: `npm install -g expo-cli@latest`

### Issue: "Firebase authentication failed"
**Solution**:
- Verify Firebase config in .env
- Check Firebase project settings
- Ensure authentication providers are enabled

### Issue: "Address autocomplete not working"
**Solution**:
1. Check .env file has correct API key
2. Verify Google Places API is enabled
3. Check API key restrictions
4. Look for errors in console: `expo start --dev-client`

### Issue: "App crashes on Android"
**Solution**:
- Clear Metro bundler cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Android emulator is running

---

## Next Steps

After successful setup:

1. **Configure Backend Integration**:
   - Set up Nayax redemption endpoints
   - Implement package purchase API
   - Add user address storage

2. **Enhance Address Features**:
   - Add map view with selected address marker
   - Store multiple delivery addresses
   - Validate address is within service area

3. **Production Deployment**:
   - Build production APK/IPA
   - Submit to App Store / Play Store
   - Configure production API keys

---

## Support Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Google Places API Docs](https://developers.google.com/maps/documentation/places/web-service/overview)
- [React Navigation Docs](https://reactnavigation.org/)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)

---

## API Key Security Checklist

Before deploying to production:

- [ ] API keys restricted in Google Cloud Console
- [ ] Separate keys for dev/staging/production
- [ ] .env file in .gitignore
- [ ] No API keys in source code
- [ ] Backend proxy endpoint created (recommended)
- [ ] Usage monitoring enabled
- [ ] Budget alerts configured

---

**Need Help?**
- Check the logs: `expo start --dev-client`
- Review Firebase console for auth issues
- Test API key with curl commands above
- Check Google Cloud Console API usage

---

© 2025 PetWash™ Mobile - All Rights Reserved
