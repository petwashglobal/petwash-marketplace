/**
 * useUserCapabilities — client hook for the canonical capabilities shape.
 *
 * Per CEO 2026-08-18 §35.4 + §6: the client reads capabilities from the
 * server — never invents them. This hook queries GET /api/me/capabilities
 * and returns the canonical UserCapabilities shape from
 * shared/lib/userCapabilities.ts.
 *
 * Enabled only when a Firebase auth user exists; otherwise returns the
 * empty-capabilities shape (least privilege) without hitting the network.
 *
 * Consumers:
 *   • Customer ↔ Provider mode switch (CEO §7)
 *   • Become Provider router (CEO §8)
 *   • ProviderPending / provider-active branching
 *   • Any UI branch that today invents a check from user.role or a
 *     client-side flag — replace with a capability read.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import {
  emptyCapabilities,
  type UserCapabilities,
} from '@shared/lib/userCapabilities';

export const USER_CAPABILITIES_QUERY_KEY = ['/api/me/capabilities'] as const;

export function useUserCapabilities() {
  const { user } = useFirebaseAuth();

  const q = useQuery<UserCapabilities>({
    queryKey: USER_CAPABILITIES_QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/capabilities');
      // Release-blocker B8 (CEO 2026-09-02): distinguish INFRA FAILURE
      // (503 with `unavailable:true`) from a legit unauthenticated read.
      //   - 401  → user really is signed out; least-privilege is honest.
      //   - 503  → the server cannot compute capabilities; THROW so
      //            react-query flags isError and retries on its own
      //            cadence, and the UI can surface "please retry."
      //            Silently returning emptyCapabilities would demote a
      //            provider/admin to member-only during a DB blip.
      //   - other non-ok → also throw so the caller sees the error.
      if (res.status === 401) {
        return emptyCapabilities(user?.uid || '');
      }
      if (!res.ok) {
        throw new Error(`capabilities_unavailable:${res.status}`);
      }
      const body = (await res.json()) as UserCapabilities;
      return body;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Automatic retry with exponential backoff on infra failure.
    retry: (failureCount, err) => {
      if (failureCount >= 3) return false;
      return String(err?.message || '').startsWith('capabilities_unavailable');
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // While loading / signed out, callers still get the empty-capabilities
  // shape so they can render least-privilege UI without null-checks.
  // On isError the caller SHOULD render an error/retry surface and MUST
  // fail privileged actions closed (they already do — every privileged
  // API is gated server-side).
  const capabilities: UserCapabilities = q.data ?? emptyCapabilities(user?.uid || '');

  return {
    capabilities,
    isLoading: q.isLoading,
    isError: q.isError,
    isUnavailable: q.isError,
    refetch: q.refetch,
  };
}
