/**
 * useJourneyCheckpoint — Lane C.3 (post-release 2026-09-03).
 *
 * Client-side hook that gives a resumable wizard three things:
 *
 *   • `hydrate()`     — hits GET /api/journey/checkpoint/:domain once
 *                        on mount, returns the payload (or null).
 *                        Failure = null; the wizard just starts fresh.
 *   • `save(payload)` — POSTs the current step state. Debounced so a
 *                        typing user doesn't hammer the endpoint.
 *   • `clear()`       — hits DELETE /api/journey/checkpoint/:domain
 *                        after a successful submit so the resume-hint
 *                        card on home stops showing.
 *
 * Safety rules baked into the hook:
 *
 *   • The domain is a compile-time literal — no dynamic route
 *     construction that could reach an unmounted endpoint.
 *   • The payload is opaque JSON. NEVER put finalised payment state
 *     (chargeId, paidAt, refundId, fiscalDocumentNumber, etc.) into
 *     it — the server refuses those keys and the hook mirrors the
 *     rejection so a caller cannot silently defeat the rule.
 *   • Every network call is best-effort: a save that fails logs and
 *     resolves quietly. The wizard's REAL money / permission gate is
 *     the submit-time server call, not the checkpoint save.
 *   • Debounce collapses rapid saves; the final call still fires
 *     after `flushMs` of quiet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type JourneyCheckpointDomain =
  | 'walk_book'
  | 'sitter_book'
  | 'marketplace_book'
  | 'shop_checkout'
  | 'egift'
  | 'provider_apply';

/** Mirrors server FORBIDDEN_PAYLOAD_KEYS — save() throws if any key hits. */
export const FORBIDDEN_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'chargeId',
  'chargeid',
  'paidAt',
  'paidat',
  'paymentReceived',
  'settlementId',
  'settlementid',
  'refundId',
  'refundid',
  'fiscalDocumentNumber',
]);

export interface UseJourneyCheckpointOptions {
  /** Milliseconds of debounce quiet before a save actually fires. Default 800. */
  flushMs?: number;
  /** Skip the initial hydrate() call. Useful when a query param overrides state. */
  skipHydrate?: boolean;
  /** Save is a no-op unless enabled. Default true. */
  enabled?: boolean;
}

export interface JourneyCheckpointHandle<TPayload extends Record<string, unknown>> {
  /** true until the hydrate() call resolves (success OR failure). */
  hydrating: boolean;
  /** The payload returned by hydrate(), or null. Never a stale copy. */
  initial: TPayload | null;
  /** Debounced save. Rejects the promise if any FORBIDDEN key is present. */
  save: (payload: TPayload) => Promise<void>;
  /** Immediately clear on server. Call after successful wizard submit. */
  clear: () => Promise<void>;
}

function assertNoForbiddenKeys(payload: Record<string, unknown>): void {
  for (const k of Object.keys(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(k)) {
      throw new Error(
        `useJourneyCheckpoint: refusing to save reserved payment-truth key "${k}". The wizard's submit-time endpoint owns payment state, not the checkpoint.`,
      );
    }
  }
}

export function useJourneyCheckpoint<TPayload extends Record<string, unknown>>(
  domain: JourneyCheckpointDomain,
  opts: UseJourneyCheckpointOptions = {},
): JourneyCheckpointHandle<TPayload> {
  const { flushMs = 800, skipHydrate = false, enabled = true } = opts;

  const [hydrating, setHydrating] = useState<boolean>(!skipHydrate);
  const [initial, setInitial] = useState<TPayload | null>(null);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayload = useRef<TPayload | null>(null);

  // Hydrate once on mount.
  useEffect(() => {
    if (skipHydrate || !enabled) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest('GET', `/api/journey/checkpoint/${domain}`);
        if (cancelled) return;
        if (r.status === 200) {
          const body = await r.json();
          setInitial((body?.payload ?? null) as TPayload | null);
        } else {
          setInitial(null);
        }
      } catch {
        // Best-effort — a hydrate failure just means "start fresh".
        if (!cancelled) setInitial(null);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, skipHydrate, enabled]);

  const flush = useCallback(async () => {
    const payload = pendingPayload.current;
    pendingPayload.current = null;
    if (!payload) return;
    try {
      await apiRequest('POST', '/api/journey/checkpoint', {
        domain,
        payload,
      });
    } catch {
      // A save failure is not user-visible — the wizard already has
      // the state in memory. Next debounced save will retry.
    }
  }, [domain]);

  const save = useCallback(
    async (payload: TPayload) => {
      if (!enabled) return;
      // Runs BEFORE we schedule the timer so a bad payload never
      // reaches the network.
      assertNoForbiddenKeys(payload);
      pendingPayload.current = payload;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        void flush();
      }, flushMs);
    },
    [enabled, flush, flushMs],
  );

  const clear = useCallback(async () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    pendingPayload.current = null;
    try {
      await apiRequest('DELETE', `/api/journey/checkpoint/${domain}`);
    } catch {
      // Server-side pruner will collect the row on its own; a failed
      // clear is not a correctness bug.
    }
  }, [domain]);

  // Unmount → flush anything still queued.
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
        void flush();
      }
    };
  }, [flush]);

  return { hydrating, initial, save, clear };
}
