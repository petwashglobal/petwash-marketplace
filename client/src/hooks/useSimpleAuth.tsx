/**
 * @deprecated — DEAD CODE. This hook and its provider are not imported by any file.
 *
 * The signup() method called /api/simple-auth/signup (a real endpoint), but the
 * canonical registration path is:
 *   Firebase Auth (email / Google / Apple / phone)
 *   → POST /api/auth/session
 *   → POST /api/users/create-profile
 *
 * Do NOT add new imports of SimpleAuthProvider or useSimpleAuth.
 * /api/simple-auth/me and /api/simple-auth/login are still live for the SignIn
 * session-verification flow (publicAuthRouter) but are called directly, not through
 * this hook.
 *
 * This file is kept only to preserve git history. It will be fully deleted in the
 * next major cleanup pass.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { getApiUrl } from '@/lib/apiConfig';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  loyaltyTier?: string;
  washBalance?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  termsAccepted: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(getApiUrl('/api/simple-auth/me'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      logger.error('Failed to check auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest(getApiUrl('/api/simple-auth/login'), {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
  };

  const signup = async (signupData: SignupData) => {
    const response = await apiRequest(getApiUrl('/api/simple-auth/signup'), {
      method: 'POST',
      body: JSON.stringify(signupData),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Signup failed');
    }

    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    await apiRequest(getApiUrl('/api/simple-auth/logout'), {
      method: 'POST',
    });
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSimpleAuth must be used within SimpleAuthProvider');
  }
  return context;
}
