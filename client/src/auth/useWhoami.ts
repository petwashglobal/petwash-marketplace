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

/**
 * Retry a failed whoami only when the failure can heal: network errors, 5xx,
 * cold-start 503. A 4xx is the server's ANSWER ("not signed in", "forbidden")
 * — retrying it just repeats the question. With retry: 2 every signed-out page
 * view asked three times, and for a signed-in browser whose cookie had lapsed
 * each attempt also force-refreshed the Google token (queryClient's one-shot
 * 401 retry): 13 whoami calls in a row in the CEO's browser, 2026-09-17.
 */
export function whoamiRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function useWhoami() {
  const query = useQuery<WhoamiResponse>({
    queryKey: ['/api/session/whoami'],
    // BUGFIX 2026-06-18: was retry:false, so a SINGLE transient whoami failure
    // (cold start, 503, token-refresh race) made guards treat the user as logged
    // out and bounce them to /signin. Retry transient failures so blips self-heal.
    retry: whoamiRetry,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    // 2026-09-19: this was an unconditional 5-minute poll, so EVERY open tab
    // asked "who am I" forever — including a visitor who is not signed in and
    // never signs in during that visit. Production logs for the preceding 24h:
    // /api/session/whoami 401 x654, the single most frequent line in the whole
    // service. Each one is a Cloud Run invocation that also keeps the instance
    // from scaling to zero, which is what the min-instances=0 cost cut
    // (CEO, 2026-08-01) was for.
    //
    // The poll exists to catch a role escalation (customer -> provider,
    // customer -> admin) on a signed-in session. A signed-OUT session cannot
    // change role without a login, and AuthProvider already invalidates this
    // query on every auth-state change — so polling while signed out can never
    // learn anything. Poll only once we know there is somebody to poll about.
    refetchInterval: (query) =>
      query.state.data?.authenticated === true ? 5 * 60 * 1000 : false,
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
