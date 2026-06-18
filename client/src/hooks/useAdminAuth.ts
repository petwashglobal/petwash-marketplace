import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from '@/lib/apiConfig';
import { isAdminRole } from "@shared/adminRoles";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  status: string;
  regions: string[];
  lastLogin: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AuthMeResponse {
  ok: boolean;
  user?: AdminUser;
  error?: string;
}

export function useAdminAuth() {
  const { data, isLoading, error, isError } = useQuery<AuthMeResponse>({
    queryKey: ["/api/admin/auth/me"],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // BUGFIX 2026-06-18: this hand-rolled queryFn previously sent ONLY the cookie
      // (credentials:'include') and dropped the Firebase Bearer token. On Safari ITP /
      // any moment the session cookie is stripped, /api/admin/auth/me 401'd and the
      // admin (incl. the CEO) was bounced to /admin/login despite being signed in.
      // Attach the Bearer like the default queryFn does so admin auth survives cookie loss.
      const headers: Record<string, string> = {};
      try {
        const { auth } = await import('@/lib/firebase');
        const token = await auth?.currentUser?.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch { /* fall back to cookie */ }
      const res = await fetch(getApiUrl('/api/admin/auth/me'), { credentials: 'include', headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Authentication failed');
      }
      return res.json();
    }
  });

  const admin = data?.ok && data.user ? data.user : null;
  const hasAdminRole = admin && isAdminRole(admin.role);

  return {
    admin,
    isLoading,
    error,
    isError,
    isAuthenticated: !!admin && admin.isActive && hasAdminRole,
    isAdmin: hasAdminRole,
    role: admin?.role,
  };
}