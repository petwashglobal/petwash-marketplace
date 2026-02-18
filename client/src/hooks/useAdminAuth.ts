import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from '@/lib/apiConfig';

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
      const res = await fetch(getApiUrl('/api/admin/auth/me'), { credentials: 'include' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Authentication failed');
      }
      return res.json();
    }
  });

  const admin = data?.ok && data.user ? data.user : null;
  const allowedRoles = ['admin', 'ops', 'super_admin', 'management', 'staff'];
  const hasAdminRole = admin && allowedRoles.includes(admin.role);

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