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

export type UserRole = 'public' | 'provider' | 'franchise_owner' | 'staff' | 'admin' | 'management' | 'super_admin';

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

async function ensureServerSession(firebaseUser: User): Promise<void> {
  try {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(getApiUrl('/api/auth/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    if (response.ok) {
      logger.info('[AuthProvider] Server session created', { uid: firebaseUser.uid });
    } else {
      logger.warn('[AuthProvider] Server session creation returned non-OK', { status: response.status });
    }
  } catch (err) {
    logger.warn('[AuthProvider] Server session creation failed (non-blocking)', err);
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
        if (firebaseUser) {
          // Ensure server session is created BEFORE marking auth as ready,
          // so API calls using session cookies don't race ahead of the cookie.
          if (sessionCreatedForUid.current !== firebaseUser.uid) {
            await ensureServerSession(firebaseUser);
            sessionCreatedForUid.current = firebaseUser.uid;
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
      if (unsubscribe) unsubscribe();
    };
  }, [isDevMode]);

  const logout = async () => {
    try {
      const userId = user?.uid;
      
      if (isDevMode) {
        disableDevMode();
        return;
      }
      
      try {
        await fetch(getApiUrl('/api/auth/signout'), {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        logger.debug("Server signout call failed (non-blocking)", e);
      }
      
      await signOut(auth);
      sessionCreatedForUid.current = null;
      
      localStorage.removeItem('petwash_lang');
      sessionStorage.clear();
      
      if (userId) {
        trackLogout(userId);
      }
      
      logger.info("Logout successful", { userId });
    } catch (error) {
      logger.error("Logout failed:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, claims, claimsLoading, logout, isDevMode, enableDevMode, disableDevMode }}>
      {children}
    </AuthContext.Provider>
  );
}
