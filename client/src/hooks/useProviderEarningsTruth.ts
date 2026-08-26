/**
 * useProviderEarningsTruth — read the canonical expected/pending/
 * available/paid buckets for a provider (CEO 2026-08-26 §17, §31).
 */

import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import {
  emptyProviderEarningsTruth,
  type ProviderEarningsTruth,
} from '@shared/lib/providerEarnings';

export function useProviderEarningsTruth() {
  const { user } = useFirebaseAuth();
  const query = useQuery<ProviderEarningsTruth>({
    queryKey: ['/api/provider/earnings-truth'],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 120_000,
    queryFn: async () => {
      const token = await user?.getIdToken().catch(() => undefined);
      const res = await fetch(getApiUrl('/api/provider/earnings-truth'), {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`earnings-truth ${res.status}`);
      const data = await res.json();
      return (data?.earnings as ProviderEarningsTruth) ?? emptyProviderEarningsTruth();
    },
  });
  return {
    earnings: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
