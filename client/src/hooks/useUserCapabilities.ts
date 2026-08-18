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
      if (!res.ok) {
        // Fail-soft: unauthenticated / server error → least-privilege shape.
        return emptyCapabilities(user?.uid || '');
      }
      const body = (await res.json()) as UserCapabilities;
      return body;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Return the empty-capabilities shape while loading / signed out, so
  // callers can render least-privilege UI without extra null-checks.
  const capabilities: UserCapabilities = q.data ?? emptyCapabilities(user?.uid || '');

  return {
    capabilities,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
