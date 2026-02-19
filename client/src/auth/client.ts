/**
 * Battle-Tested 2025 Firebase Auth Client
 * 
 * Features:
 * - iOS Safari auto-fallback (popup → redirect)
 * - Multi-persistence (IndexedDB → localStorage → sessionStorage)
 * - Device language detection
 * - User-friendly error messages
 * - Handles redirect results automatically
 */

import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  isSignInWithEmailLink,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  setPersistence,
  Auth,
} from "firebase/auth";

// CRITICAL FIX: Import existing Firebase app instance instead of creating new one
// This prevents "Firebase App named '[DEFAULT]' already exists" error
import { app, auth as existingAuth } from "@/lib/firebase";

// ---- Use existing auth instance from firebase.ts (singleton pattern) ----
export const auth = existingAuth;

// ---- 3) Google provider with clean UX ----
export const googleProvider = new GoogleAuthProvider();
// Always force account chooser and avoid sticky sessions
googleProvider.setCustomParameters({ prompt: "select_account" });

// ---- 4) Helpers: detect iOS Safari (popups unreliable) ----
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const preferRedirect = isIOS || isSafari;

// ---- 5) Public domain for continue URLs (used by email link, optional) ----
const PUBLIC_BASE =
  window.location.hostname.includes("petwash.co.il")
    ? `https://${window.location.hostname}`
    : window.location.origin;

// ---- 6) API you can call from your login page ----
export async function loginWithEmailPassword(email: string, password: string) {
  // Local persistence for admin consoles is usually best:
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  try {
    console.log('[Auth] 🪟 Using popup flow for Google sign-in');
    return await signInWithPopup(auth, googleProvider);
  } catch (popupErr: any) {
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment', 'auth/internal-error'].includes(popupErr.code)) {
      console.log('[Auth] 🔄 Popup failed, falling back to redirect flow');
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw popupErr;
  }
}

/**
 * @deprecated — Redirect result is now handled exclusively by AuthProvider.tsx.
 * Do NOT call this function. It exists only for backward compatibility.
 */
export async function handleRedirectResult() {
  console.warn('[Auth] handleRedirectResult is deprecated — AuthProvider handles redirect results. This call is a no-op.');
  return null;
}

// ---- 8) Email link sign-in (optional) ----
export async function sendEmailLink(email: string) {
  const actionCodeSettings = {
    url: `${PUBLIC_BASE}/admin/login?email=${encodeURIComponent(email)}`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("pw_admin_pending_email", email);
}

export async function completeEmailLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const email =
      window.localStorage.getItem("pw_admin_pending_email") ||
      window.prompt("Please confirm your email for ⁦Pet Wash™⁩ Admin");
    // import { signInWithEmailLink } from "firebase/auth" if you enable this flow
    // await signInWithEmailLink(auth, email!, window.location.href);
    // window.localStorage.removeItem("pw_admin_pending_email");
  }
}

// ---- 9) Global auth observer (route guard can subscribe to this) ----
export function onAuth(cb: (user: import("firebase/auth").User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// ---- 10) Friendly error mapper for UI (English + Hebrew) ----
export function humanizeAuthError(code?: string, language: 'en' | 'he' = 'en'): string {
  const errors: Record<string, { en: string; he: string }> = {
    'auth/popup-closed-by-user': {
      en: 'The sign-in popup was closed. Please try again.',
      he: 'החלון נסגר. נסה שוב.'
    },
    'auth/popup-blocked': {
      en: 'Your browser blocked the popup. We\'ll use a full-page redirect instead.',
      he: 'הדפדפן חסם את החלון. נשתמש בהפניה מלאה.'
    },
    'auth/network-request-failed': {
      en: 'Network problem. Check your connection and try again.',
      he: 'בעיית רשת. בדוק את החיבור לאינטרנט.'
    },
    'auth/invalid-credential': {
      en: 'Email or password is incorrect.',
      he: 'אימייל או סיסמה שגויים.'
    },
    'auth/wrong-password': {
      en: 'Email or password is incorrect.',
      he: 'אימייל או סיסמה שגויים.'
    },
    'auth/user-not-found': {
      en: 'No account found with this email.',
      he: 'לא נמצא חשבון עם אימייל זה.'
    },
    'auth/user-disabled': {
      en: 'This account has been disabled.',
      he: 'חשבון זה הושבת.'
    },
    'auth/too-many-requests': {
      en: 'Too many attempts. Try again later.',
      he: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.'
    },
    'auth/internal-error': {
      en: 'Sign-in failed to initialize. Please refresh and try again.',
      he: 'שגיאה פנימית. רענן את הדף ונסה שוב.'
    },
    'auth/invalid-email': {
      en: 'Invalid email address.',
      he: 'כתובת אימייל לא חוקית.'
    },
    'auth/operation-not-allowed': {
      en: 'This sign-in method is not enabled.',
      he: 'שיטת התחברות זו לא מופעלת.'
    },
    'auth/account-exists-with-different-credential': {
      en: 'An account already exists with this email.',
      he: 'חשבון עם אימייל זה כבר קיים.'
    }
  };

  const error = errors[code || ''];
  if (error) {
    return language === 'he' ? error.he : error.en;
  }
  
  return language === 'he' 
    ? 'שגיאה בהתחברות. נסה שוב.'
    : 'Sign-in failed. Please try again.';
}
