import { useQuery } from "@tanstack/react-query";

export type DashboardType = 'member' | 'provider' | 'staff' | 'admin';

export interface WhoamiResponse {
  authenticated: boolean;
  uid: string;
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string | null;
  language: string | null;
  displayName: string;
  role: string;
  accountType: string;
  isSuperAdmin: boolean;
  dashboardsAllowed: DashboardType[];
  mfaRequired: boolean;
  mfaVerified: boolean;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' | 'manual_review' | 'not_required';
  kycAdmin: boolean;
  // Account-status projection (read-only, server-derived). Optional so older
  // server builds that don't yet send them don't break typing.
  profileStatus?: 'complete' | 'incomplete';
  providerStatus?: 'none' | 'pending' | 'approved';
  prestigeStatus?: 'none' | 'active';
  activeFlow?: 'prestige' | 'provider' | 'guest' | 'booking' | 'general';
  roles?: string[];
  session: {
    ageSeconds: number;
    maxAgeSeconds: number;
    ip: string;
    createdAt: string | null;
  };
  claims: {
    role: string;
    accountType: string;
    loyaltyMember: boolean;
    loyaltyTier: string;
    program: string | null;
    providerType: string | null;
    department: string | null;
    roleCode: string | null;
    kyc_admin: boolean;
  };
}

export function useWhoami() {
  const query = useQuery<WhoamiResponse>({
    queryKey: ['/api/session/whoami'],
    retry: false,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    whoami: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isAuthenticated: query.data?.authenticated === true,
    role: query.data?.role ?? 'public',
    dashboardsAllowed: query.data?.dashboardsAllowed ?? [],
    mfaRequired: query.data?.mfaRequired ?? false,
    mfaVerified: query.data?.mfaVerified ?? false,
    kycStatus: query.data?.kycStatus ?? 'not_required',
    isSuperAdmin: query.data?.isSuperAdmin ?? false,
    refetch: query.refetch,
  };
}

export function canAccessDashboard(dashboardsAllowed: DashboardType[], dashboard: DashboardType): boolean {
  return dashboardsAllowed.includes(dashboard);
}
