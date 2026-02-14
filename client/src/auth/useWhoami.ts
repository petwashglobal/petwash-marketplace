import { useQuery } from "@tanstack/react-query";

export type DashboardType = 'member' | 'provider' | 'staff' | 'admin';

export interface WhoamiResponse {
  authenticated: boolean;
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: string;
  accountType: string;
  isSuperAdmin: boolean;
  dashboardsAllowed: DashboardType[];
  mfaRequired: boolean;
  mfaVerified: boolean;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' | 'manual_review' | 'not_required';
  kycAdmin: boolean;
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
