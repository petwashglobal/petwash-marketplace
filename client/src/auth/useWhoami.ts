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
  // activeFlow — origin surface, not identity. 'prestige' was the legacy
  // customer-flow value; renamed to 'customer' (CEO 2026-08-26 role
  // model — Prestige is a membership, not a flow). Server continues to
  // accept legacy 'prestige' input and normalises to 'customer' so old
  // sessions keep working; new emissions use 'customer' only.
  activeFlow?: 'customer' | 'provider' | 'guest' | 'booking' | 'general';
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
    // BUGFIX 2026-06-18: was retry:false, so a SINGLE transient whoami failure
    // (cold start, 503, token-refresh race) made guards treat the user as logged
    // out and bounce them to /signin. Retry transient failures so blips self-heal.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
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
