import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - uses existing Pet Wash™ Firebase project
// ✅ FIXED: Use EXPO_PUBLIC_ prefix for Expo environment variables (not VITE_)
// Note: EXPO_PUBLIC_ vars are embedded at build time and accessible in the app
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate all required Firebase configuration fields
const requiredFields = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID'
};

const missingFields = Object.entries(requiredFields)
  .filter(([key]) => !firebaseConfig[key as keyof typeof firebaseConfig])
  .map(([, envVar]) => envVar);

if (missingFields.length > 0) {
  console.error('❌ Firebase configuration error: Missing required fields');
  console.error('Missing:', missingFields.join(', '));
  throw new Error(
    `Firebase configuration incomplete. Missing: ${missingFields.join(', ')}\n` +
    `Please configure these in your .env file (see mobile-app/.env.example)`
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// ==================== OAuth Provider Configuration ====================

// Google OAuth - Always show consent screen (like Replit example)
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.setCustomParameters({
  prompt: 'consent', // ✅ ALWAYS SHOW CONSENT SCREEN
  access_type: 'offline',
  hd: '*', // Allow any Google account
});

// Apple OAuth
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
appleProvider.setCustomParameters({
  locale: 'en' // Default language for Apple consent screen
});

// Facebook OAuth
export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');
facebookProvider.setCustomParameters({
  display: 'popup',
  auth_type: 'rerequest' // Re-request declined permissions
});

// Microsoft OAuth
export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.addScope('openid');
microsoftProvider.addScope('email');
microsoftProvider.addScope('profile');
microsoftProvider.addScope('User.Read');
microsoftProvider.setCustomParameters({
  prompt: 'consent',
  tenant: 'common' // Support personal + work accounts
});

// TikTok OAuth Configuration (Custom implementation required)
export const tiktokConfig = {
  clientKey: process.env.EXPO_PUBLIC_TIKTOK_CLIENT_KEY,
  clientSecret: process.env.EXPO_PUBLIC_TIKTOK_CLIENT_SECRET,
  authUrl: 'https://www.tiktok.com/v2/auth/authorize',
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
  scopes: ['user.info.basic', 'user.info.profile'],
};

export default app;
