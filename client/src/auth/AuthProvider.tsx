import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { auth } from "../lib/firebase";
import {
  onAuthStateChanged,
  getRedirectResult,
  User,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";
import { trackLogout } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { getApiUrl } from "@/lib/apiConfig";
import { queryClient } from "@/lib/queryClient";
import {
  invalidatePostLoginCache,
  registerPostLoginResolvedHandler,
} from "@/lib/postLoginCoordinator";

/** All localStorage keys that are user-session-specific and must be wiped on logout. */
export const AUTH_LOCAL_STORAGE_KEYS = [
  'petwash_lang',
  'pw_admin_pending_email',
  'emailForSignIn',
  'signup_intent',
] as const;

// Mirror of `shared/adminRoles.ts` ADMIN_ROLES on the client. The literal must
// include every role the server may mint as a Firebase custom claim — otherwise
// `(c.role as UserRole) || 'public'` silently downgrades real admin roles
// (ceo, hr, finance, ops) to 'public' and routes them to /my-account.
// See P0 audit (PR #86) Bug 1.
export type UserRole =
  | 'public'
  | 'provider'
  | 'franchise_owner'
  | 'staff'
  | 'admin'
  | 'management'
  | 'super_admin'
  | 'ceo'
  | 'hr'
  | 'finance'
  | 'ops';

export interface UserClaims {
  role: UserRole;
  accountType?: string;
  loyaltyTier?: string;
  loyaltyMember?: boolean;
  program?: string;
  authProvider?: string;
}

const DEFAULT_CLAIMS: UserClaims = { role: 'public' };

type AuthContextType = { 
  user: User | null; 
  loading: boolean;
  claims: UserClaims;
  claimsLoading: boolean;
  logout: () => Promise<void>;
  isDevMode: boolean;
  enableDevMode: () => void;
  disableDevMode: () => void;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  claims: DEFAULT_CLAIMS,
  claimsLoading: true,
  logout: async () => {},
  isDevMode: false,
  enableDevMode: () => {},
  disableDevMode: () => {}
});

export const useFirebaseAuth = () => useContext(AuthContext);

const DEV_USER_KEY = 'petwash_dev_mode';

const createDevUser = (): Partial<User> => ({
  uid: 'dev-user-12345',
  email: 'dev@petwash.co.il',
  displayName: 'Dev User (Test Mode)',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString()
  } as any,
  providerData: [],
  providerId: 'dev',
  refreshToken: '',
  tenantId: null,
  phoneNumber: null,
  delete: async () => {},
  getIdToken: async () => 'dev-token',
  getIdTokenResult: async () => ({ token: 'dev-token', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '', signInProvider: 'dev', signInSecondFactor: null }),
  reload: async () => {},
  toJSON: () => ({})
});

async function postSession(idToken: string): Promise<Response> {
  return fetch(getApiUrl('/api/auth/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
}

/**
 * Mint the server session cookie for a Firebase user.
 *
 * Returns TRUE only when the server actually accepted the token and set
 * __session. Any failure (5xx, CORS block, network error, still-401 after
 * a refreshed retry) returns FALSE. Never throws.
 *
 * WHY THIS SIGNATURE MATTERS: the caller sits behind a Promise.race + 6s
 * watchdog and uses the outcome to decide whether to (a) mark the user
 * "session-ready" for cookie-authed /api/* calls, or (b) kick a background
 * retry loop until the cookie lands. The old `Promise<void>` return let
 * `.then(() => sessionDone = true)` fire on error too — so the retry loop
 * was skipped and every follow-up API call 401'd. That's the recurring
 * "signed in then kicked out" symptom the CEO kept flagging.
 * (Evil-hunt 2026-08-20 SEV-1 #1.)
 */
async function ensureServerSession(firebaseUser: User): Promise<boolean> {
  try {
    let response = await postSession(await firebaseUser.getIdToken());
    // A 401/INVALID_TOKEN often means the cached idToken was stale. Retry
    // ONCE with a force-refreshed token before giving up.
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      logger.warn('[AuthProvider] Session 401/403 — retrying with refreshed token', { status: response.status });
      response = await postSession(await firebaseUser.getIdToken(true));
    }
    if (response.ok) {
      logger.info('[AuthProvider] Server session created', { uid: firebaseUser.uid });
      return true;
    }
    // Do NOT force-signout here: a transient 5xx/offline blip shouldn't kick
    // a returning user. But return FALSE so the caller runs the retry loop
    // until the cookie actually lands.
    logger.error('[AuthProvider] Server session creation FAILED after retry', { status: response.status, uid: firebaseUser.uid });
    return false;
  } catch (err) {
    logger.warn('[AuthProvider] Server session creation network error (non-blocking)', err);
    return false;
  }
}

async function setPersistenceWithFallback(): Promise<void> {
  const strategies = [
    { name: 'indexedDB', persistence: indexedDBLocalPersistence },
    { name: 'localStorage', persistence: browserLocalPersistence },
    { name: 'sessionStorage', persistence: browserSessionPersistence },
  ];

  for (const { name, persistence } of strategies) {
    try {
      await setPersistence(auth, persistence);
      logger.info(`[AuthProvider] Persistence set: ${name}`);
      return;
    } catch (err) {
      logger.warn(`[AuthProvider] Persistence ${name} failed, trying next`, err);
    }
  }
  logger.error('[AuthProvider] All persistence strategies failed — auth may not persist across reloads');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<UserClaims>(DEFAULT_CLAIMS);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const sessionCreatedForUid = useRef<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(() => {
    if (!import.meta.env.DEV) return false;
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DEV_USER_KEY) === 'true';
    }
    return false;
  });

  const enableDevMode = () => {
    if (!import.meta.env.DEV) {
      logger.warn("Dev mode is only available in development environment");
      return;
    }
    localStorage.setItem(DEV_USER_KEY, 'true');
    setIsDevMode(true);
    setUser(createDevUser() as User);
    logger.info("Dev mode enabled - using test user");
  };

  const disableDevMode = () => {
    localStorage.removeItem(DEV_USER_KEY);
    setIsDevMode(false);
    setUser(null);
    logger.info("Dev mode disabled");
  };

  // PR-FRES-5: After every successful POST /api/auth/post-login, invalidate
  // /api/session/whoami so role escalations (customer → provider, customer →
  // staff approval) propagate immediately. Without this, useWhoami's 2 min
  // staleTime leaves the freshly-promoted user seeing stale role chrome.
  useEffect(() => {
    registerPostLoginResolvedHandler(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/session/whoami'] });
    });
    return () => registerPostLoginResolvedHandler(null);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV && isDevMode) {
      disableDevMode();
      return;
    }
    if (isDevMode) {
      setUser(createDevUser() as User);
      setLoading(false);
      setClaimsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    // RESILIENCE (2026-06-24): never let the app hang on a blank "Loading…".
    // If Firebase auth never resolves on native (init failure, no network, or a
    // hung server-session call), force-reveal the app (signed-out) after a few
    // seconds instead of spinning forever. This NEVER grants access — a real
    // user still signs in normally; it only kills the infinite loader.
    const revealWatchdog = setTimeout(() => {
      logger.warn('[AuthProvider] auth unresolved after 8s — revealing app to avoid infinite loader');
      setLoading(false);
      setClaimsLoading(false);
    }, 8000);

    (async () => {
      await setPersistenceWithFallback();

      // Handle iOS Safari redirect-based sign-in completion.
      // After signInWithRedirect, the user is sent to Google and returns here.
      // getRedirectResult resolves the pending result — onAuthStateChanged fires
      // automatically afterwards with the signed-in user.
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          logger.info('[AuthProvider] Redirect sign-in completed', { uid: redirectResult.user.uid });
        }
      } catch (err) {
        logger.warn('[AuthProvider] getRedirectResult error (non-fatal)', err);
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(revealWatchdog); // auth resolved — cancel the infinite-loader backstop
        if (firebaseUser) {
          // Ensure server session is created BEFORE marking auth as ready,
          // so API calls using session cookies don't race ahead of the cookie.
          if (sessionCreatedForUid.current !== firebaseUser.uid) {
            // Don't let a hung server-session call block the reveal forever
            // (native __session cookie / network). Cap at 6s; only mark done if
            // it actually completed, so a later auth event (and whoami) can retry.
            // sessionOk is set to true ONLY when the server actually accepted the
            // token — NOT on 5xx/CORS/network failure. Previously the `.then()`
            // fired unconditionally, so the retry loop was skipped and every
            // follow-up /api call 401'd. (Evil-hunt 2026-08-20 SEV-1 #1.)
            let sessionOk = false;
            await Promise.race([
              ensureServerSession(firebaseUser).then((ok) => { sessionOk = ok; }),
              new Promise<void>((resolve) => setTimeout(resolve, 6000)),
            ]);
            if (sessionOk) {
              sessionCreatedForUid.current = firebaseUser.uid;
            } else {
              // Either the 6s watchdog fired first, OR ensureServerSession returned
              // false (server rejected / errored). Reveal the user below (never
              // trap them on an infinite loader), but keep re-minting in the
              // BACKGROUND (fire-and-forget, bounded) so the cookie lands ASAP
              // and the "logged in but 401" window shrinks. ensureServerSession
              // is idempotent.
              const uidAtStart = firebaseUser.uid;
              void (async () => {
                for (let i = 0; i < 4 && sessionCreatedForUid.current !== uidAtStart; i++) {
                  await new Promise((r) => setTimeout(r, 1500));
                  if (auth.currentUser?.uid !== uidAtStart) return; // user changed — abort
                  const ok = await ensureServerSession(firebaseUser);
                  if (ok) {
                    sessionCreatedForUid.current = uidAtStart;
                    return;
                  }
                }
              })();
            }
          }

          try {
            const tokenResult = await firebaseUser.getIdTokenResult(true);
            const c = tokenResult.claims;
            setClaims({
              role: (c.role as UserRole) || 'public',
              accountType: c.accountType as string,
              loyaltyTier: c.loyaltyTier as string,
              loyaltyMember: c.loyaltyMember as boolean,
              program: c.program as string,
              authProvider: c.authProvider as string,
            });
          } catch (err) {
            logger.warn('Failed to fetch user claims', err);
            setClaims(DEFAULT_CLAIMS);
          }
          setClaimsLoading(false);
          // Now that session + claims are ready, reveal the user to the app
          setUser(firebaseUser);
          setLoading(false);
        } else {
          sessionCreatedForUid.current = null;
          setClaims(DEFAULT_CLAIMS);
          setClaimsLoading(false);
          setUser(null);
          setLoading(false);
        }
      });

    })();

    return () => {
      clearTimeout(revealWatchdog);
      if (unsubscribe) unsubscribe();
    };
  }, [isDevMode]);

  const logout = async () => {
    // Always clear the React Query cache first, regardless of mode, so no
    // cached user data survives the logout even if subsequent steps fail.
    // PR-FRES-5: also clear the postLoginCoordinator (#182) module-level
    // cache so the next user on this device cannot inherit the previous
    // user's nextUrl. The React Query clear below does not reach the
    // coordinator's module-level Maps.
    invalidatePostLoginCache();
    queryClient.clear();

    // Dev-mode: just toggle off the fake user, no server calls or redirect needed.
    if (isDevMode) {
      disableDevMode();
      return;
    }

    const userId = user?.uid;
    try {
      // 2. Destroy the server-side session cookie.
      //
      // CSRF: /api/auth/signout is INTENTIONALLY not on the AUTH_CSRF_EXEMPT
      // allowlist (a malicious page shouldn't be able to force-log people out).
      // But this client call has no CSRF-token plumbing, so the double-submit
      // gate returned 403 EBADCSRFTOKEN, the outer catch swallowed it, and
      // __session stuck on the device for its full 14-day life — the next
      // user on that browser inherited the previous session on load.
      // (Evil-hunt 2026-08-20 SEV-2 #7.)
      //
      // Fix: attach the Firebase idToken as Bearer. The server's Bearer-CSRF
      // skip fires before the double-submit gate — signout succeeds, cookie
      // clears, and the CSRF property (only the real user can trigger signout)
      // is preserved because only the real user can produce a valid idToken.
      try {
        let idToken: string | undefined;
        try { idToken = await auth.currentUser?.getIdToken(); } catch { /* best-effort */ }
        await fetch(getApiUrl('/api/auth/signout'), {
          method: 'POST',
          credentials: 'include',
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
        });
      } catch (e) {
        logger.debug("Server signout call failed (non-blocking)", e);
      }

      // 3. Sign out of Firebase (fires onAuthStateChanged → null).
      await signOut(auth);
      sessionCreatedForUid.current = null;

      // 4. Clear client-side storage keys.
      AUTH_LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();

      if (userId) {
        trackLogout(userId);
      }

      logger.info("Logout successful", { userId });
    } catch (error) {
      logger.error("Logout failed:", error);
      // Ensure both caches are cleared even when the signout throws.
      invalidatePostLoginCache();
      queryClient.clear();
    } finally {
      // 5. Hard-redirect to root. Using window.location.replace ensures a full
      //    page reload that wipes ALL in-memory React state (including any stale
      //    context/component-local state that survived the cache clear).
      //    replace() is used instead of assign() so the protected page is removed
      //    from the browser history — pressing Back cannot return to it.
      window.location.replace('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, claims, claimsLoading, logout, isDevMode, enableDevMode, disableDevMode }}>
      {children}
    </AuthContext.Provider>
  );
}
