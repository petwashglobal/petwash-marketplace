// Firebase Admin SDK initialization for server-side operations
import admin from 'firebase-admin';
import { verifyIdTokenResilient } from './resilientVerify';

// Read project config from environment — never hardcode
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'signinpetwash';
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || `${FIREBASE_PROJECT_ID}.firebasestorage.app`;

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;

if (!admin.apps.length) {
  // ROOT-CAUSE FIX (2026-06-14): the admin Google sign-in failed with HTTP 401
  // "INVALID_TOKEN". The token was valid — but PR-STARTUP-FIX-5 stopped syncing
  // FIREBASE_SERVICE_ACCOUNT_KEY, leaving Firebase Admin on ambient ADC that
  // CANNOT run verifyIdToken(idToken, /*checkRevoked*/ true) — which every
  // privileged sign-in path uses (routes.ts session create, claims, websocket,
  // franchise). So all owner/admin logins were rejected.
  // The project's real service account IS mounted to Cloud Run as
  // GOOGLE_APPLICATION_CREDENTIALS_JSON (= GOOGLE_SERVICE_ACCOUNT_JSON). Load it
  // here. JSON.parse is try/caught below, so a malformed value safely falls
  // through to ADC — startup can never crash on this.
  const serviceAccountKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

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

// ──────────────────────────────────────────────────────────────────────────
// RESILIENT verifyIdToken (ROOT-CAUSE FIX 2026-06-18)
// ──────────────────────────────────────────────────────────────────────────
// Symptom (CONFIRMED by CEO, repeatedly): Google/Apple/email sign-in completes
// on Google's side, then the app shows "Server rejected the sign-in
// (INVALID_TOKEN) [HTTP 401]" and bounces to signup — on BOTH the admin site
// and the apps.
//
// Why the previous "fix" was a mirage: every privileged path calls
// verifyIdToken(idToken, /*checkRevoked*/ true). The `true` forces the Admin
// SDK to make an Identity-Toolkit NETWORK lookup (getAccountInfo) to read the
// user's tokensValidAfterTime. That lookup needs API/IAM access on the runtime
// service account. But our health probe used createCustomToken(), which signs a
// JWT LOCALLY with the private key — zero network, zero IAM. So canSignTokens
// could be `true` (key loaded) while the revocation lookup silently fails with
// an infra error (auth/internal-error / insufficient-permission / network) —
// which verifyIdToken surfaces, and the caller maps to INVALID_TOKEN. Result:
// EVERY login and EVERY Bearer API call 401'd, while signing-health stayed green.
//
// The fix below verifies the token CRYPTOGRAPHICALLY on every call (signature,
// aud, iss, exp via Google's public certs — no SA API needed, always works).
// Only the revocation *check* degrades gracefully: if it fails for an infra
// reason, we re-verify WITHOUT checkRevoked and accept. Genuinely bad tokens
// (expired / wrong-project / malformed / explicitly-revoked / disabled user)
// stay REJECTED. The only thing we forgo, and only while the lookup is broken,
// is rejecting a still-unexpired token that was explicitly revoked — an
// acceptable trade vs. locking every user out. Because admin.auth(),
// getAuth(), and this `auth` export all resolve to the SAME default-app Auth
// instance, wrapping the method here covers all ~80 call sites at once.
const __rawVerifyIdToken = auth.verifyIdToken.bind(auth);
(auth as any).verifyIdToken = (idToken: string, checkRevoked?: boolean) =>
  verifyIdTokenResilient(__rawVerifyIdToken, idToken, checkRevoked, (code) => {
    console.warn(
      '[firebase-admin] verifyIdToken: revocation lookup unavailable (' + code +
      ') — token verified cryptographically WITHOUT checkRevoked. Grant the ' +
      'runtime service account Identity-Toolkit access (Firebase Authentication ' +
      'Admin) to restore revocation checks.'
    );
  });

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
