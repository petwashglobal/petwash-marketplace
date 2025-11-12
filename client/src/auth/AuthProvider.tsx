import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { trackLogout } from "@/lib/analytics";
import { logger } from "@/lib/logger";

type AuthContextType = { 
  user: User | null; 
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  logout: async () => {}
});

export const useFirebaseAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set explicit Firebase persistence (local = persists even after browser closes)
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      logger.error("Failed to set persistence:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      const userId = user?.uid;
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear storage
      localStorage.removeItem('petwash_lang');
      sessionStorage.clear();
      
      // Track logout event
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
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
