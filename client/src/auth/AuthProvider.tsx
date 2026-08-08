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

async function ensureServerSession(firebaseUser: User): Promise<void> {
  try {
    let response = await postSession(await firebaseUser.getIdToken());
    // BUGFIX 2026-06-18: a 401/INVALID_TOKEN here used to be swallowed, then the
    // app revealed the user as "logged in" with NO server session — split-brain
    // where every cookie-authed call 401s and guards bounce the user to /signup.
    // On a token-rejection, retry ONCE with a force-refreshed token (handles a
    // stale/expired cached token, the most common cause).
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      logger.warn('[AuthProvider] Session 401/403 — retrying with refreshed token', { status: response.status });
      response = await postSession(await firebaseUser.getIdToken(true));
    }
    if (response.ok) {
      logger.info('[AuthProvider] Server session created', { uid: firebaseUser.uid });
    } else {
      // Do NOT force-signout here: a transient 5xx/offline blip shouldn't kick a
      // returning user. But log loudly so the failure is visible (it used to be silent).
      logger.error('[AuthProvider] Server session creation FAILED after retry', { status: response.status, uid: firebaseUser.uid });
    }
  } catch (err) {
    logger.warn('[AuthProvider] Server session creation network error (non-blocking)', err);
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
            let sessionDone = false;
            await Promise.race([
              ensureServerSession(firebaseUser).then(() => { sessionDone = true; }),
              new Promise<void>((resolve) => setTimeout(resolve, 6000)),
            ]);
            if (sessionDone) {
              sessionCreatedForUid.current = firebaseUser.uid;
            } else {
              // Session didn't confirm within 6s. We still reveal the user below
              // (never trap them on an infinite loader), but the __session cookie
              // may not have landed yet — so a cookie-authed API call in the gap
              // could 401 and bounce the user to /signin ("logged in but kicked
              // out"). Keep re-minting in the BACKGROUND (fire-and-forget, bounded)
              // so the cookie lands ASAP and the window shrinks. ensureServerSession
              // is idempotent. (verification-drift follow-up 2026-08-07)
              const uidAtStart = firebaseUser.uid;
              void (async () => {
                for (let i = 0; i < 4 && sessionCreatedForUid.current !== uidAtStart; i++) {
                  await new Promise((r) => setTimeout(r, 1500));
                  if (auth.currentUser?.uid !== uidAtStart) return; // user changed — abort
                  try {
                    await ensureServerSession(firebaseUser);
                    sessionCreatedForUid.current = uidAtStart;
                  } catch { /* keep retrying up to the bound */ }
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
      try {
        await fetch(getApiUrl('/api/auth/signout'), {
          method: 'POST',
          credentials: 'include',
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
