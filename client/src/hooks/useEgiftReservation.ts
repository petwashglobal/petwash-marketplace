/**
 * useEgiftReservation — CEO §7, §22-24 pre-activation.
 *
 * Headless hook every commercial flow (K9000, Shop, marketplace)
 * calls to atomically reserve eGift value BEFORE the machine
 * authorises / the shop order activates / the marketplace booking
 * commits. Consumes POST /api/egift/:egiftId/reservations,
 * POST /api/egift/:egiftId/reservations/:reservationId/commit,
 * POST /api/egift/:egiftId/reservations/:reservationId/release.
 *
 * §22-23 discipline enforced server-side: pre-check via projection,
 * in-transaction race guard, deterministic reservation ids on
 * idempotencyKey. This hook only shepherds the UX around it.
 *
 * §28 vs §29 distinction preserved: release() = value never committed,
 * NOT a refund. Callers must use release() for cancel/decline/expiry;
 * refunds after commit go through the separate refund flow.
 *
 * PRE-ACTIVATION safety: this hook only talks to the reservation
 * service and the balance projection. It NEVER writes to the
 * commercial event, the fiscal document, or any money-moving path.
 * Individual commercial flows call it (via a wrapper) at their own
 * reserve/commit points behind their own feature flags.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type ReservationInstrumentIntent =
  | 'K9000_WASH' | 'SHOP_ITEM'
  | 'PROVIDER_BOOKING_SITTER' | 'PROVIDER_BOOKING_WALK'
  | 'PROVIDER_BOOKING_ACADEMY' | 'PROVIDER_BOOKING_PETTREK';

export type ReservationErrorCode =
  | 'EGIFT_NOT_FOUND' | 'INSUFFICIENT_AVAILABLE' | 'INVALID_AMOUNT'
  | 'RESERVATION_NOT_FOUND' | 'RESERVATION_NOT_ACTIVE'
  | 'EGIFT_FROZEN' | 'RACE_CONDITION' | 'NETWORK';

interface ReservationHandle {
  reservationId: string;
  egiftId: string;
  amountCents: number;
  currency: 'ILS';
  intendedCommercial: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  reservedAt: string;
  expiresAt: string;
}

interface BalanceProjection {
  egiftId: string;
  currency: 'ILS';
  originalCents: number;
  availableCents: number;
  reservedCents: number;
  redeemedCents: number;
  restoredCents: number;
  frozen: boolean;
  openReservations: Array<{
    reservationId: string; amountCents: number; intendedCommercial: string;
    reservedAt: string; expiresAt: string;
  }>;
  hasOrphanRefundWarning: boolean;
}

export interface UseEgiftReservationOptions {
  /** The eGift the flow wants to spend from. */
  egiftId: string;
  /** Which commercial event is being funded. Server records this on
   *  the reservation row so admin can see WHICH SHOP/K9000/WALK
   *  reservation is holding the money. */
  intendedCommercial: ReservationInstrumentIntent;
  /** Optional lineage — the specific commercial object. */
  intendedSourceType?: string;
  intendedSourceId?: string;
  /** Live-updates callback so the widget can render 'committed' /
   *  'released' after the caller flips state. */
  onStateChange?: (state: 'idle' | 'reserved' | 'committed' | 'released' | 'error') => void;
}

export function useEgiftReservation(opts: UseEgiftReservationOptions) {
  const queryClient = useQueryClient();
  const [handle, setHandle] = useState<ReservationHandle | null>(null);
  const [errorCode, setErrorCode] = useState<ReservationErrorCode | null>(null);

  const balance = useQuery<{ ok: boolean; projection: BalanceProjection }>({
    queryKey: [`/api/egift/${opts.egiftId}/balance`],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/egift/${opts.egiftId}/balance`);
      return r.json();
    },
    enabled: !!opts.egiftId,
  });

  const invalidateBalance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/egift/${opts.egiftId}/balance`] });
  }, [queryClient, opts.egiftId]);

  const reserveMutation = useMutation<
    { ok: boolean; reservation?: ReservationHandle; errorCode?: string },
    Error,
    { amountCents: number; idempotencyKey?: string }
  >({
    mutationFn: async (input) => {
      const body = {
        amountCents: input.amountCents,
        intendedCommercial: opts.intendedCommercial,
        intendedSourceType: opts.intendedSourceType,
        intendedSourceId: opts.intendedSourceId,
        idempotencyKey: input.idempotencyKey,
      };
      const r = await apiRequest('POST', `/api/egift/${opts.egiftId}/reservations`, body);
      return r.json();
    },
    onSuccess: (body) => {
      if (body.ok && body.reservation) {
        setHandle(body.reservation);
        setErrorCode(null);
        opts.onStateChange?.('reserved');
      } else {
        const code = (body.errorCode ?? 'RACE_CONDITION') as ReservationErrorCode;
        setErrorCode(code);
        opts.onStateChange?.('error');
      }
      invalidateBalance();
    },
    onError: () => {
      setErrorCode('NETWORK');
      opts.onStateChange?.('error');
    },
  });

  const commitMutation = useMutation<
    { ok: boolean; reservation?: ReservationHandle; errorCode?: string },
    Error,
    { externalRef?: string }
  >({
    mutationFn: async (input) => {
      if (!handle) throw new Error('NO_ACTIVE_RESERVATION');
      const r = await apiRequest(
        'POST',
        `/api/egift/${opts.egiftId}/reservations/${handle.reservationId}/commit`,
        { externalRef: input.externalRef },
      );
      return r.json();
    },
    onSuccess: (body) => {
      if (body.ok && body.reservation) {
        setHandle(body.reservation);
        opts.onStateChange?.('committed');
      }
      invalidateBalance();
    },
    onError: () => {
      setErrorCode('NETWORK');
      opts.onStateChange?.('error');
    },
  });

  const releaseMutation = useMutation<
    { ok: boolean; reservation?: ReservationHandle; errorCode?: string }
  >({
    mutationFn: async () => {
      if (!handle) throw new Error('NO_ACTIVE_RESERVATION');
      const r = await apiRequest(
        'POST',
        `/api/egift/${opts.egiftId}/reservations/${handle.reservationId}/release`,
        {},
      );
      return r.json();
    },
    onSuccess: (body) => {
      if (body.ok && body.reservation) {
        setHandle(body.reservation);
        opts.onStateChange?.('released');
      }
      invalidateBalance();
    },
    onError: () => {
      setErrorCode('NETWORK');
    },
  });

  return {
    balance: balance.data?.projection,
    balanceLoading: balance.isLoading,
    handle,
    errorCode,
    /** Atomic AVAILABLE → RESERVED. */
    reserve: reserveMutation.mutate,
    isReserving: reserveMutation.isPending,
    /** RESERVED → COMMITTED. Call after commercial event succeeded. */
    commit: commitMutation.mutate,
    isCommitting: commitMutation.isPending,
    /** RESERVED → RELEASED (§28: NEVER a refund — value was never committed). */
    release: releaseMutation.mutate,
    isReleasing: releaseMutation.isPending,
    /** Clears local state without touching the server — for
     *  post-release / post-commit UI resets. */
    reset: () => { setHandle(null); setErrorCode(null); },
  };
}
