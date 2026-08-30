/**
 * useEntityJourneyState — client hook for the doctrine's per-entity
 * JourneyState projection (§84-§87).
 *
 * Reads GET /api/marketplace/journey/:kind/:id and returns the
 * server-computed JourneyState so any card / focus surface / AI
 * concierge tile can render the actor's projection without knowing
 * the underlying schema.
 *
 * Kept SEPARATE from the legacy `useJourneyState` (funnel state) —
 * that hook is a coarse visitor→booked funnel used by the marketing
 * shell. This one is the surgical read model for a specific booking,
 * shop order, gift, etc.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { JourneyState } from '@shared/marketplace/journeyState';

export type EntityJourneyKind =
  | 'booking'
  | 'shop_order'
  | 'gift'
  | 'wallet_topup'
  | 'refund'
  | 'support_case'
  | 'provider_application'
  | 'prestige_member'
  | 'k9000_session'
  | 'pet'
  | 'payout';

export type EntityJourneyOutcome =
  | { status: 'ok'; journey: JourneyState }
  | { status: 'not_found' }
  | { status: 'not_a_party' }
  | { status: 'not_implemented'; kind: EntityJourneyKind }
  | { status: 'error' };

interface UseEntityJourneyStateOptions {
  enabled?: boolean;
  /** How stale the projection may be before a refetch is triggered. */
  staleTimeMs?: number;
}

export function useEntityJourneyState(
  kind: EntityJourneyKind | null | undefined,
  id: string | null | undefined,
  opts: UseEntityJourneyStateOptions = {},
) {
  const enabled = Boolean(opts.enabled ?? true) && !!kind && !!id;
  const q = useQuery<EntityJourneyOutcome>({
    queryKey: ['/api/marketplace/journey', kind, id],
    enabled,
    retry: false,
    staleTime: opts.staleTimeMs ?? 20_000,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/marketplace/journey/${kind}/${encodeURIComponent(id!)}`);
        const body: unknown = await (res as Response).json();
        if (body && typeof body === 'object' && 'journey' in body) {
          return { status: 'ok', journey: (body as { journey: JourneyState }).journey };
        }
        return { status: 'error' };
      } catch (err: any) {
        const code = err?.status ?? err?.response?.status;
        if (code === 404) return { status: 'not_found' };
        if (code === 403) return { status: 'not_a_party' };
        if (code === 501) return { status: 'not_implemented', kind: kind as EntityJourneyKind };
        return { status: 'error' };
      }
    },
  });

  return {
    outcome: q.data,
    journey: q.data?.status === 'ok' ? q.data.journey : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
