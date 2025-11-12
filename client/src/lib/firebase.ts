import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence,
  browserPopupRedirectResolver
} from "firebase/auth";
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { setLogLevel } from "firebase/app";
import { logger } from './logger';
import type { AppCheck } from 'firebase/app-check';

if (import.meta.env.DEV) {
  setLogLevel('debug');
  console.log('[Firebase] Debug logging enabled in development mode');
}

// PRODUCTION FIX: Use runtime config from server in production
// This solves Vite build-time env var issues in Replit deployments
function getFirebaseConfig() {
  // Check if runtime config is available (production deployment)
  if (typeof window !== 'undefined' && (window as any).__FIREBASE_CONFIG__) {
    console.log('[Firebase] ✅ Using runtime config from server');
    return (window as any).__FIREBASE_CONFIG__;
  }
  
  // Fallback to build-time env vars (development or if runtime config fails)
  // ✅ SECURITY FIX: No hard-coded credentials - all must come from environment
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };
  
  // Validate all required Firebase configuration fields
  const requiredFields = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'VITE_FIREBASE_APP_ID'
  };
  
  const missingFields = Object.entries(requiredFields)
    .filter(([key]) => !config[key as keyof typeof config])
    .map(([, envVar]) => envVar);
  
  if (missingFields.length > 0) {
    throw new Error(
      `Firebase configuration incomplete. Missing required environment variables: ${missingFields.join(', ')}\n` +
      `Please check your .env file or Replit Secrets configuration.`
    );
  }
  
  console.log('[Firebase] ℹ️ Using build-time config (fallback)', {
    hasRuntimeConfig: !!(typeof window !== 'undefined' && (window as any).__FIREBASE_CONFIG__),
    environment: import.meta.env.MODE
  });
  
  return config;
}

const firebaseConfig = getFirebaseConfig();

// Initialize Firebase app immediately (lightweight)
export const app = initializeApp(firebaseConfig);

// CRITICAL FIX: App Check is OPTIONAL and uses separate key
// If VITE_FIREBASE_APPCHECK_SITE_KEY is not provided, App Check is disabled (fail-open)
// This prevents login hangs when App Check key is misconfigured
const APP_CHECK_SITE_KEY = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
let appCheckInstance: AppCheck | null = null;

if (APP_CHECK_SITE_KEY) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    logger.debug('✅ App Check initialized with reCAPTCHA v3');
  } catch (error) {
    logger.warn('⚠️ App Check init failed (fail-open mode)', error);
  }
} else {
  logger.info('ℹ️ App Check disabled (VITE_FIREBASE_APPCHECK_SITE_KEY not set) - fail-open mode');
}

// Initialize Auth with iOS/Safari-safe persistence
// ✅ Fixes iPhone login issues by using IndexedDB + localStorage fallback
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Set Firebase Auth language to match user's device or app preference
// This controls which localized email template Firebase sends (password reset, verification, etc.)
auth.useDeviceLanguage(); // Auto-detects Hebrew on Hebrew devices

// Configure Firestore with bounded memory cache for iOS Safari stability
// 40MB limit prevents unbounded growth and tab crashes during Apple testing
export const db = initializeFirestore(app, {
  cacheSizeBytes: 40 * 1024 * 1024, // 40MB bounded cache (was CACHE_SIZE_UNLIMITED)
  // Use auto-detection instead of forcing - prevents auth token fetch conflicts
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app, 'gs://signinpetwash.firebasestorage.app');

// ✅ WebAuthn / Passkey configuration - Dynamically determined based on environment
// Supports: petwash.co.il (production), Replit preview URLs (development), localhost (dev)
export const RP_ID = import.meta.env.VITE_WEBAUTHN_RP_ID || 
  ((typeof window !== 'undefined' && window.location.hostname.includes('.replit.dev')) 
    ? window.location.hostname.split(':')[0]
    : 'petwash.co.il');

// Get App Check token helper
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) {
    return null;
  }
  
  try {
    const { getToken } = await import('firebase/app-check');
    const { token } = await getToken(appCheckInstance, false);
    return token;
  } catch (error) {
    logger.warn('Failed to get App Check token', error);
    return null;
  }
}

// DIAGNOSTIC: Expose runtime config for debugging (visible in browser console)
if (typeof window !== 'undefined') {
  const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const actualProjectId = firebaseConfig.projectId;
  
  (window as any).__PW_FIREBASE_CONFIG__ = {
    recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY ? '✅ present' : '❌ missing',
    appCheckSiteKey: import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY ? '✅ present' : 'ℹ️ not-used (fail-open)',
    appCheckEnabled: !!appCheckInstance,
    authDomain: firebaseConfig.authDomain,
    projectId: actualProjectId,
    projectIdRaw: rawProjectId,
    projectIdFixed: rawProjectId !== actualProjectId ? '✅ CORRECTED' : 'using env var',
    environment: import.meta.env.DEV ? 'development' : 'production'
  };
  console.log('[Firebase] Runtime Config:', (window as any).__PW_FIREBASE_CONFIG__);
  
  if (rawProjectId && rawProjectId.startsWith('VITE_')) {
    if (import.meta.env.DEV) {
      console.log('[Firebase] ℹ️ INFO: Using fallback Firebase projectId (env var is placeholder)');
    }
  }
}

// Initialize heavy Firebase features AFTER first paint (non-blocking)
const initHeavyFirebaseFeatures = async () => {
  // Skip Firebase Performance Monitoring in development to prevent API permission errors
  if (import.meta.env.DEV) {
    logger.debug('⏭️ Firebase Performance Monitoring skipped in development mode');
    return;
  }
  
  // Lazy load Performance Monitoring (production only)
  try {
    const { getPerformance, trace } = await import('firebase/performance');
    const perfInstance = getPerformance(app);
    
    const initialPaintTrace = trace(perfInstance, 'home_initial_paint');
    initialPaintTrace.start();
    
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              initialPaintTrace.stop();
              observer.disconnect();
            }
          } catch (observerError) {
            logger.debug('PerformanceObserver entry processing failed', observerError);
            setTimeout(() => initialPaintTrace.stop(), 2500);
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (observerError) {
        logger.debug('PerformanceObserver setup failed', observerError);
        setTimeout(() => initialPaintTrace.stop(), 2500);
      }
    } else {
      setTimeout(() => initialPaintTrace.stop(), 2500);
    }
  } catch (error) {
    logger.warn('Firebase Performance init failed (fail-safe mode)', error);
  }
};

// Use requestIdleCallback for best performance
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initHeavyFirebaseFeatures, { timeout: 3000 });
  } else {
    setTimeout(initHeavyFirebaseFeatures, 0);
  }
}
