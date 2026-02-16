import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { trackLogout } from "@/lib/analytics";
import { logger } from "@/lib/logger";

export type UserRole = 'public' | 'provider' | 'staff' | 'admin' | 'management' | 'super_admin';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<UserClaims>(DEFAULT_CLAIMS);
  const [claimsLoading, setClaimsLoading] = useState(true);
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
      return;
    }

    // Set explicit Firebase persistence (local = persists even after browser closes)
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      logger.error("Failed to set persistence:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
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
      } else {
        setClaims(DEFAULT_CLAIMS);
        setClaimsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isDevMode]);

  const logout = async () => {
    try {
      const userId = user?.uid;
      
      if (isDevMode) {
        disableDevMode();
        return;
      }
      
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        logger.debug("Server signout call failed (non-blocking)", e);
      }
      
      await signOut(auth);
      
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
