/**
 * useServiceSession — React Query hook wrapping GET /api/service-sessions/:bookingRef.
 *
 * Per CEO 2026-08-18 §12–§16: any client surface that shows "live
 * service" data (the customer's Track Service view, the provider's
 * live-service screen, a "just arrived" push tap-through) reads the
 * canonical ServiceSessionDTO from THIS hook. No client invents its
 * own live-service shape.
 *
 * Polling by default. A future SSE channel (§15) can replace the
 * refetchInterval without changing the consumer contract.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { ServiceSessionDTO } from '@shared/lib/serviceSession';

export interface UseServiceSessionOptions {
  /**
   * Poll interval in ms. Defaults to 30_000. The endpoint is cheap
   * (one-row lookup on the underlying source) so 30s is safe.
   * Set to `false` to disable polling.
   */
  refetchIntervalMs?: number | false;
  /** Extra enabled gate on top of "must be authed + must have a bookingRef". */
  enabled?: boolean;
}

export type ServiceSessionResult =
  | { session: ServiceSessionDTO; error?: undefined }
  | { session: null; error: 'not_found' | 'forbidden' | 'unknown' };

export function serviceSessionQueryKey(bookingRef: string): unknown[] {
  return ['/api/service-sessions', bookingRef];
}

export function useServiceSession(
  bookingRef: string | null | undefined,
  opts: UseServiceSessionOptions = {},
) {
  const { user } = useFirebaseAuth();
  const refetchInterval = opts.refetchIntervalMs === false
    ? false
    : (opts.refetchIntervalMs ?? 30_000);

  const q = useQuery<ServiceSessionResult>({
    queryKey: bookingRef ? serviceSessionQueryKey(bookingRef) : ['/api/service-sessions', 'none'],
    queryFn: async (): Promise<ServiceSessionResult> => {
      if (!bookingRef) return { session: null, error: 'not_found' };
      const res = await apiRequest('GET', `/api/service-sessions/${encodeURIComponent(bookingRef)}`);
      if (res.status === 404) return { session: null, error: 'not_found' };
      if (res.status === 403) return { session: null, error: 'forbidden' };
      if (!res.ok) return { session: null, error: 'unknown' };
      const body = await res.json();
      const session: ServiceSessionDTO | undefined = body?.session;
      return session ? { session } : { session: null, error: 'unknown' };
    },
    enabled: !!user && !!bookingRef && opts.enabled !== false,
    staleTime: 15_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });

  return {
    session: q.data && 'session' in q.data ? q.data.session : null,
    error: q.data && 'error' in q.data ? q.data.error : undefined,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    refetch: q.refetch,
  };
}
