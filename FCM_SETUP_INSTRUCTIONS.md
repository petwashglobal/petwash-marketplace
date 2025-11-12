# 🔔 Firebase Cloud Messaging (FCM) Push Notifications Setup

## ✅ Implementation Complete!

Your Pet Wash™ platform now has **Firebase Cloud Messaging** (FCM) for browser push notifications!

## 📋 What's Been Implemented

### Frontend:
- ✅ **FCM Notification Service** (`client/src/lib/fcm-notifications.ts`)
  - Token registration
  - Permission requests
  - Foreground message handling
  
- ✅ **React Hook** (`client/src/hooks/useFCMNotifications.ts`)
  - Auto-registers FCM token after user login
  - Manages token lifecycle
  - Integrated into App.tsx

- ✅ **Service Workers**:
  - `/service-worker.js` - PWA offline support
  - `/firebase-messaging-sw.js` - FCM background notifications

### Backend:
- ✅ **Push Notification API** (`server/routes/push-notifications.ts`)
  - `POST /api/push-notifications/send` - Send to user(s)
  - `POST /api/push-notifications/test` - Test notification
  - `GET /api/push-notifications/status` - Check registration

- ✅ **Firestore Schema** (`shared/firestore-fcm.ts`)
  - FCM tokens stored in `fcmTokens` collection
  - Automatic cleanup of invalid tokens

---

## 🔧 Setup Required (URGENT!)

### **Step 1: Get VAPID Key from Firebase Console**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **signinpetwash**
3. Click ⚙️ **Settings** → **Project Settings**
4. Go to **Cloud Messaging** tab
5. Scroll down to **Web Push certificates**
6. Click **Generate key pair** (if not already generated)
7. Copy the **Key pair** value (starts with `B...`)

### **Step 2: Add VAPID Key to Replit Secrets**

1. In Replit, click **🔒 Secrets** (left sidebar)
2. Click **+ New Secret**
3. Add:
   - **Key**: `VITE_FIREBASE_VAPID_KEY`
   - **Value**: [paste your VAPID key from step 1]
4. Click **Add Secret**
5. **Restart the server** (workflow will auto-restart)

---

## 🧪 How to Test

### **Test 1: Automatic Token Registration**

1. **Login** to your account at `/login`
2. **Check browser console** (F12)
3. You should see:
   ```
   [FCM] Firebase Cloud Messaging initialized successfully
   [FCM] Notification permission granted
   [FCM] Token saved to Firestore successfully
   ```

### **Test 2: Send Test Notification**

After logging in, run this in browser console:

```javascript
fetch('/api/push-notifications/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log);
```

You should see a push notification appear! 🎉

### **Test 3: Send Custom Notification**

```javascript
fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'YOUR_USER_ID',
    title: '🐾 Pet Wash™',
    body: 'Your appointment is in 30 minutes!',
    url: '/dashboard',
  })
}).then(r => r.json()).then(console.log);
```

---

## 📱 User Experience Flow

1. **User logs in** → FCM automatically asks for notification permission
2. **User accepts** → Token saved to Firestore
3. **Backend sends notification** → User receives push notification
4. **User clicks notification** → Opens Pet Wash™ dashboard

---

## 🎯 Use Cases

### 1. **Appointment Reminders**
```javascript
await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.uid,
    title: '🐕 Upcoming Appointment',
    body: 'Your pet wash appointment is in 1 hour at Tel Aviv station',
    url: '/dashboard',
  })
});
```

### 2. **Birthday Discounts**
```javascript
await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.uid,
    title: '🎉 Happy Birthday!',
    body: 'Get 20% off today! Tap to claim your birthday gift 🎁',
    url: '/loyalty',
  })
});
```

### 3. **Low Stock Alerts (Admin)**
```javascript
await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userIds: adminUserIds, // Array of admin UIDs
    title: '⚠️ Low Stock Alert',
    body: 'Shampoo running low at Haifa station',
    url: '/admin/inventory',
  })
});
```

---

## 🔐 Security

- ✅ **Authentication required** - All endpoints require Firebase Auth
- ✅ **Admin-only broadcasting** - Sending to multiple users requires admin role
- ✅ **Token validation** - Invalid tokens automatically removed
- ✅ **Rate limiting** - API endpoints are rate-limited

---

## 📊 Monitoring

### Check FCM Token Status:
```javascript
fetch('/api/push-notifications/status')
  .then(r => r.json())
  .then(console.log);
```

Response:
```json
{
  "registered": true,
  "updatedAt": "2025-10-24T03:00:00.000Z",
  "browser": "Mozilla/5.0...",
  "platform": "MacIntel"
}
```

---

## ✨ Already Working Features

### **Google Sign-In** ✅
Your app already has Google OAuth working!

```javascript
// SignIn.tsx - Line 440
const userCredential = await signInWithPopup(auth, googleProvider);
```

Test it: Visit `/login` and click the **Google** button!

---

## 🚨 Troubleshooting

### **Issue: "VAPID key not configured"**
→ Add `VITE_FIREBASE_VAPID_KEY` to Replit Secrets (see Step 2 above)

### **Issue: "Notification permission denied"**
→ User clicked "Block". They must manually enable in browser settings.

### **Issue: "No FCM token found"**
→ User hasn't logged in yet or permission was denied.

### **Issue: Service worker failed to register**
→ Check browser console for errors. Service workers require HTTPS (or localhost).

---

## 🎉 You're All Set!

Once you add the VAPID key, push notifications will work automatically!

**Questions?** Check the Firebase Console or browser console for debug logs.
