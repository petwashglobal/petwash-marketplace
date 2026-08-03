import { initializeApp, getApps, getApp } from "firebase/app";
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
  logger.debug('[Firebase] Debug logging enabled in development mode');
}

// PRODUCTION FIX: Use runtime config from server in production
// This solves Vite build-time env var issues in Replit deployments
function getFirebaseConfig() {
  // Check if runtime config is available (production deployment)
  if (typeof window !== 'undefined' && (window as any).__FIREBASE_CONFIG__) {
    logger.debug('[Firebase] Using runtime config from server');
    return (window as any).__FIREBASE_CONFIG__;
  }
  
  // Fallback to build-time env vars (development or if runtime config fails)
  // ✅ SECURITY FIX: No hard-coded credentials - all must come from environment
  //
  // authDomain MUST be petwash.co.il in production builds — never signinpetwash.firebaseapp.com.
  // Safari ITP treats signinpetwash.firebaseapp.com as a cross-origin tracker and blocks the
  // storage read that Firebase needs after signInWithRedirect. getRedirectResult() returns null
  // and every iPhone/iPad Safari Gmail login silently fails.
  //
  // import.meta.env.PROD is true in any Vite production build (NODE_ENV=production).
  // In development, use the VITE_FIREBASE_AUTH_DOMAIN env var so localhost auth still works.
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.PROD
      ? 'petwash.co.il'
      : (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'signinpetwash.firebaseapp.com'),
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
    console.warn(
      `[Firebase] ⚠️ Configuration incomplete (fail-open mode). Missing: ${missingFields.join(', ')}\n` +
      `Authentication and Firebase features will be disabled until configured.\n` +
      `Please check your .env file or Replit Secrets configuration.`
    );
    
    // Return safe placeholder config to allow app to render
    // Firebase features will be disabled but UI will load
    return {
      apiKey: 'placeholder-api-key',
      authDomain: 'placeholder.firebaseapp.com',
      projectId: 'placeholder-project',
      storageBucket: 'placeholder.appspot.com',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:placeholder',
      measurementId: 'G-PLACEHOLDER'
    };
  }
  
  if (import.meta.env.DEV) {
    logger.debug('[Firebase] Using build-time config (fallback)', {
      hasRuntimeConfig: !!(typeof window !== 'undefined' && (window as any).__FIREBASE_CONFIG__),
      environment: import.meta.env.MODE
    });
  }
  

  return config;
}

const firebaseConfig = getFirebaseConfig();

// Initialize Firebase app as singleton (prevent duplicate initialization)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Ticket 02 social-auth hardening: keep the fix default-on, with an explicit
// rollback flag and an explicit opt-in before Firebase Performance starts.
const SOCIAL_AUTH_FIXES_ENABLED = import.meta.env.VITE_FEATURE_SOCIAL_AUTH_FIXES !== 'false';
const FIREBASE_PERFORMANCE_ENABLED = import.meta.env.VITE_FIREBASE_PERFORMANCE_ENABLED === 'true';

// App Check (reCAPTCHA v3) is a NATIVE-app concern here. The only endpoints that
// REQUIRE a valid App Check token are the native biometric routes
// (/api/mobile/biometric/*, /api/biometric-certificates/*). NO web signup / auth /
// profile / provider / loyalty endpoint enforces it (verified 2026-08-03 audit).
//
// On the plain web the reCAPTCHA-v3 provider throws `appCheck/recaptcha-error` on
// petwash.co.il (the key isn't registered for App Check on this domain). Because
// Firebase Auth auto-attaches the App Check token, that error BLOCKED every
// Google/Apple sign-in — while protecting nothing the website relies on. So we only
// initialize App Check inside the native (Capacitor) app; on the web it's skipped.
// Force it back on for web with VITE_APP_CHECK_WEB=true once the reCAPTCHA key is
// properly registered for App Check on the domain. (CEO 2026-08-03: unblock signup.)
// NOTE: init is fail-OPEN — getAppCheckToken() returns null on error and never blocks.
const APP_CHECK_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const IS_NATIVE_APP =
  typeof window !== "undefined" &&
  typeof (window as any).Capacitor?.isNativePlatform === "function" &&
  (window as any).Capacitor.isNativePlatform();
const FORCE_APP_CHECK_ON_WEB = import.meta.env.VITE_APP_CHECK_WEB === "true";
const SHOULD_INIT_APP_CHECK = IS_NATIVE_APP || FORCE_APP_CHECK_ON_WEB;
let appCheckInstance: AppCheck | null = null;

if (typeof window !== "undefined" && APP_CHECK_SITE_KEY && SHOULD_INIT_APP_CHECK) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error('[App Check] Initialization failed:', error);
  }
} else if (typeof window !== "undefined") {
  logger.info('[App Check] Skipped on web (native-only). Set VITE_APP_CHECK_WEB=true to force-enable on web.');
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

// Use the configured storage bucket from env var. Fallback to the known production bucket
// so existing deployments that don't yet have VITE_FIREBASE_STORAGE_BUCKET set continue to work.
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'signinpetwash.firebasestorage.app';
export const storage = getStorage(app, `gs://${storageBucket}`);

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


// DIAGNOSTIC: Expose runtime config for debugging in development only
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const actualProjectId = firebaseConfig.projectId;
  
  (window as any).__PW_FIREBASE_CONFIG__ = {
    recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY ? '✅ present' : '❌ missing',
    appCheckSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY ? '✅ present (v3)' : '❌ missing',
    appCheckEnabled: !!appCheckInstance,
    authDomain: firebaseConfig.authDomain,
    projectId: actualProjectId,
    projectIdRaw: rawProjectId,
    projectIdFixed: rawProjectId !== actualProjectId ? '✅ CORRECTED' : 'using env var',
    environment: import.meta.env.DEV ? 'development' : 'production'
  };
  logger.debug('[Firebase] Runtime Config', (window as any).__PW_FIREBASE_CONFIG__);

  if (rawProjectId && rawProjectId.startsWith('VITE_')) {
    logger.debug('[Firebase] Using fallback Firebase projectId (env var is placeholder)');
  }
}


// Initialize heavy Firebase features AFTER first paint (non-blocking)
const initHeavyFirebaseFeatures = async () => {
  // Skip Firebase Performance Monitoring in development to prevent API permission errors
  if (import.meta.env.DEV) {
    logger.debug('⏭️ Firebase Performance Monitoring skipped in development mode');
    return;
  }

  if (SOCIAL_AUTH_FIXES_ENABLED && !FIREBASE_PERFORMANCE_ENABLED) {
    logger.debug('[Firebase] Performance Monitoring skipped; set VITE_FIREBASE_PERFORMANCE_ENABLED=true after Firebase Performance is verified.');
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
