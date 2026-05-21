// Firebase Admin SDK initialization for server-side operations
import admin from 'firebase-admin';

// Read project config from environment — never hardcode
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'signinpetwash';
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || `${FIREBASE_PROJECT_ID}.firebasestorage.app`;

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
        storageBucket: FIREBASE_STORAGE_BUCKET,
      });
      console.log('✅ Firebase Admin SDK initialized with service account');
    } catch (error) {
      // PR-STARTUP-FIX-5: never crash production startup on malformed
      // FIREBASE_SERVICE_ACCOUNT_KEY. Fall through to Application Default
      // Credentials (Cloud Run service account). The bug #9 cycle was:
      // CI workflow injects key → secret manager value is malformed →
      // JSON.parse throws → production boot dies at loading_routes phase.
      // ADC works on Cloud Run via the runtime service account.
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', (error as Error).message);
      console.warn(
        '⚠️ Falling back to Application Default Credentials. ' +
        'Verify Cloud Run service account has Firebase Admin SDK IAM roles. ' +
        'To eliminate this warning: fix or unset FIREBASE_SERVICE_ACCOUNT_KEY.'
      );
      firebaseApp = admin.initializeApp({
        projectId: FIREBASE_PROJECT_ID,
        storageBucket: FIREBASE_STORAGE_BUCKET,
      });
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      // In production, Google Cloud Run provides Application Default Credentials via service account
      // Ensure the Cloud Run service account has the correct IAM roles (firebase-adminsdk)
      console.log('ℹ️ Production: using Application Default Credentials (Cloud Run service account)');
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase Admin SDK using ambient ADC (dev/emulator mode)');
    }
    firebaseApp = admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  }
} else {
  firebaseApp = admin.apps[0]!;
  console.log('✅ Firebase Admin SDK already initialized');
}

// Export admin services - ensure they're properly initialized
if (!firebaseApp) {
  throw new Error('Firebase Admin app not initialized - this should never happen');
}

// Firestore.settings() may be called at most once per underlying instance.
// firebaseApp.firestore() returns a persistent singleton that survives module
// re-imports (e.g. Vitest re-evaluating this module between test files) even
// though module scope is reset — so the "already applied" guard must live on
// the instance via a global symbol, not in a module-level boolean. Without this
// a second import re-runs settings() and throws "settings() can only be called once".
const FIRESTORE_SETTINGS_APPLIED = Symbol.for('petwash.firebaseAdmin.firestoreSettingsApplied');

// Use getter function to ensure db is always available
export function getFirestore() {
  const firestore = firebaseApp.firestore();
  const marker = firestore as unknown as Record<symbol, boolean>;
  if (!marker[FIRESTORE_SETTINGS_APPLIED]) {
    firestore.settings({ ignoreUndefinedProperties: true });
    marker[FIRESTORE_SETTINGS_APPLIED] = true;
  }
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
