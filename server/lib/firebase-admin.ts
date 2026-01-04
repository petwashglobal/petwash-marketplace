// Firebase Admin SDK initialization for server-side operations
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'signinpetwash',
        storageBucket: 'signinpetwash.appspot.com'
      });
      console.log('✅ Firebase Admin SDK initialized with service account');
    } catch (error) {
      console.error('❌ Failed to parse Firebase service account key:', error);
      // Fallback to default initialization
      firebaseApp = admin.initializeApp({
        projectId: 'signinpetwash',
        storageBucket: 'signinpetwash.appspot.com'
      });
      console.log('⚠️ Firebase Admin SDK initialized without credentials');
    }
  } else {
    firebaseApp = admin.initializeApp({
      projectId: 'signinpetwash',
      storageBucket: 'signinpetwash.appspot.com'
    });
    console.log('⚠️ Firebase Admin SDK initialized without service account key');
  }
} else {
  firebaseApp = admin.apps[0]!;
  console.log('✅ Firebase Admin SDK already initialized');
}

// Export admin services - ensure they're properly initialized
if (!firebaseApp) {
  throw new Error('Firebase Admin app not initialized - this should never happen');
}

// Use getter function to ensure db is always available
export function getFirestore() {
  const firestore = firebaseApp.firestore();
  return firestore;
}

// Export direct references for convenience (most common pattern)
export const db = getFirestore();
export const storage = firebaseApp.storage();
export const auth = firebaseApp.auth();
// Alias for consistency with some route imports
export const adminAuth = auth;

// Verify db is exported correctly
if (!db) {
  throw new Error('Firestore db not initialized');
}

console.log('✅ Firebase Admin services exported:', {
  hasDb: !!db,
  hasStorage: !!storage,
  hasAuth: !!auth,
  dbType: typeof db,
  dbConstructor: db?.constructor?.name
});

// Note: Biometric storage lifecycle rules are now managed by server/infra/biometricStorage.ts
// This uses Google Cloud Storage SDK directly for better control and error handling

export default admin;
