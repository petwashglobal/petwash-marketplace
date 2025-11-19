# 🚀 Pet Wash™ Mobile App - Complete Integration Guide

## Overview
This guide walks you through integrating the Pet Wash™ mobile app with your existing backend infrastructure.

---

## 📋 Prerequisites

### Development Environment
- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode 14+ (macOS only)
- Android: Android Studio with SDK 33+

### Backend Requirements
- RESTful API with HTTPS
- JWT authentication support
- Refresh token rotation capability
- CORS enabled for mobile origins

---

## 🏗️ Step-by-Step Integration

### Step 1: Clone or Copy Mobile App
```bash
# Copy the mobile-app directory to your project
cp -r mobile-app /path/to/your/petwash-mobile

cd /path/to/your/petwash-mobile
```

### Step 2: Install Dependencies
```bash
npm install
```

**Dependencies Installed:**
- `expo` - React Native framework
- `expo-local-authentication` - Face ID & fingerprint APIs
- `expo-secure-store` - iOS Keychain & Android Keystore
- `axios` - HTTP client
- `react` & `react-native` - UI framework
- `typescript` - Type safety

### Step 3: Configure Backend URL
Update `App.tsx`:
```typescript
// Line 15
const API_BASE = "https://api.petwash.co.il"; // Your production API

// For development
// const API_BASE = "http://localhost:5000"; // Local backend
```

### Step 4: Implement Backend Auth Endpoints
Your backend must implement these routes:

#### POST /auth/login
```typescript
// server/routes/auth.ts
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate credentials
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "30m" }
  );

  const refreshToken = jwt.sign(
    { sub: user.id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "30d" }
  );

  // Store refresh token in database
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      permissions: user.permissions,
    },
  });
});
```

#### POST /auth/refresh
```typescript
router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    // Check if refresh token exists in database
    const tokenRecord = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.userId, decoded.sub),
        eq(refreshTokens.token, refreshToken),
        gt(refreshTokens.expiresAt, new Date())
      ),
    });

    if (!tokenRecord) {
      return res.status(401).json({
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token expired or invalid",
      });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
    });

    // Generate new tokens
    const newAccessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "30m" }
    );

    const newRefreshToken = jwt.sign(
      { sub: user.id, type: "refresh" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "30d" }
    );

    // Rotate refresh token (delete old, insert new)
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id));
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    res.status(401).json({
      error: "INVALID_REFRESH_TOKEN",
      message: "Refresh token expired or invalid",
    });
  }
});
```

#### POST /auth/logout
```typescript
router.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body;

  try {
    // Delete refresh token from database
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  } catch (err) {
    // Even if token doesn't exist, return success
  }

  res.json({ success: true, message: "Logged out successfully" });
});
```

### Step 5: Add Refresh Token Table to Database
```typescript
// server/db/schema.ts
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Run migration:
```bash
npm run db:push
```

### Step 6: Test the Mobile App
```bash
# Start Expo dev server
npm start

# Scan QR code with Expo Go app (iOS/Android)
# Or press 'i' for iOS simulator
# Or press 'a' for Android emulator
```

### Step 7: Test Login Flow
1. Enter email and password
2. Tap "Login"
3. App should show main screen
4. Close app and reopen
5. Biometric prompt should appear
6. Authenticate → app unlocks

---

## 🔐 Security Checklist

### Backend Security
- [ ] Use HTTPS only (no HTTP in production)
- [ ] Set `JWT_SECRET` and `JWT_REFRESH_SECRET` as strong random strings
- [ ] Enable CORS for mobile app origin
- [ ] Implement rate limiting on `/auth/login` (5 req/15min per IP)
- [ ] Rotate refresh tokens on every use
- [ ] Store refresh tokens in database for revocation
- [ ] Hash refresh tokens before storing (optional but recommended)

### Mobile App Security
- [ ] Update `API_BASE` to production URL
- [ ] Test on real iOS and Android devices
- [ ] Verify biometrics work on different devices
- [ ] Test auto-lock after 10 minutes
- [ ] Test high-risk action re-authentication
- [ ] Enable App Transport Security (iOS)
- [ ] Enable ProGuard obfuscation (Android)

---

## 🧪 Testing on Real Devices

### iOS (Requires macOS)
```bash
# Install on physical iPhone
expo run:ios --device

# Or use Expo Go app
npm start
# Scan QR code with iPhone camera
```

### Android
```bash
# Install on physical Android device
expo run:android --device

# Or use Expo Go app
npm start
# Scan QR code with Expo Go app
```

### Test Biometrics
**iOS:** Face ID or Touch ID must be enrolled in Settings  
**Android:** Fingerprint or Face Unlock must be enrolled in Settings

---

## 📦 Building for Production

### iOS App Store
```bash
# 1. Create EAS account
npm install -g eas-cli
eas login

# 2. Configure build
eas build:configure

# 3. Build for iOS
eas build --platform ios

# 4. Submit to App Store
eas submit --platform ios
```

### Google Play Store
```bash
# 1. Build for Android
eas build --platform android

# 2. Submit to Google Play
eas submit --platform android
```

---

## 🔧 Customization

### Change App Name
```json
// app.json
{
  "expo": {
    "name": "Pet Wash Staff",
    "slug": "petwash-staff"
  }
}
```

### Change App Icon
1. Add icon.png (1024x1024) to project root
2. Update `app.json`:
```json
{
  "expo": {
    "icon": "./icon.png"
  }
}
```

### Change Splash Screen
1. Add splash.png (1284x2778) to project root
2. Update `app.json`:
```json
{
  "expo": {
    "splash": {
      "image": "./splash.png",
      "backgroundColor": "#0f172a"
    }
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue: Biometrics Not Working
**Solution:** Test on real device. Biometrics don't work in simulators.

### Issue: "Network request failed"
**Solution:** 
- iOS Simulator: Use `http://localhost:5000` for local backend
- Android Emulator: Use `http://10.0.2.2:5000` for local backend
- Real Device: Use your computer's IP address

### Issue: Token refresh loop
**Solution:** Check backend `/auth/refresh` returns new `refreshToken`

### Issue: App crashes on startup
**Solution:** Run `expo start -c` to clear cache

---

## 📊 Monitoring & Analytics

### Add Firebase Analytics
```bash
expo install @react-native-firebase/app @react-native-firebase/analytics
```

### Track Events
```typescript
import analytics from "@react-native-firebase/analytics";

// Track login
await analytics().logLogin({ method: "email" });

// Track high-risk action
await analytics().logEvent("high_risk_action", {
  action: "delete_station",
  approved: true,
});
```

---

## 🚀 Next Steps

After successful integration:
1. Add push notifications (Firebase Cloud Messaging)
2. Add offline mode (React Query persistent cache)
3. Add crash reporting (Sentry, Bugsnag)
4. Add A/B testing (Firebase Remote Config)
5. Add deep linking (for station QR codes)

---

## 📞 Support

For integration help:
- **API Spec:** See `docs/BACKEND_API_SPEC.md`
- **High-Risk Actions:** See `docs/HIGH_RISK_ACTIONS_GUIDE.md`
- **General Questions:** See `README.md`

---

© 2025 Pet Wash™. All rights reserved.
