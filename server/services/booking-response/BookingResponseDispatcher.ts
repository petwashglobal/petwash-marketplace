/**
 * BookingResponseDispatcher — the ONE place a "provider responded to
 * a booking" event will be resolved to the correct native pipeline
 * (Nayax capture / escrow / חשבונית / calendar) once the feature
 * flag is turned on.
 *
 * STATUS 2026-08-26: **SHELL ONLY**. Every native-source method
 * throws `DISPATCHER_NOT_ENABLED`. The v2 provider-response route
 * calls `observeIntendedDispatch()` in SHADOW mode after its
 * existing `applyBridgeDecision` — that logs what the dispatcher
 * WOULD have done so ops can pair legacy writes with intent and
 * observe divergence BEFORE we cut money over. Nothing here moves
 * a shekel today.
 *
 * Deploy-ready package tracker (§23-24):
 *   [x] source resolver (pure function)
 *   [x] dispatcher shell + shadow observability
 *   [x] feature-flag guard (BOOKING_ACCEPT_DISPATCHER_ENABLED=false today)
 *   [x] idempotency contract documented (native routes already
 *       enforce it via atomic status claims; dispatcher inherits)
 *   [ ] acceptSitterBookingCore extracted from sitter-suite.ts:1095
 *   [ ] acceptWalkBookingCore extracted from walk-my-pet.ts:816
 *   [ ] acceptAcademyBookingCore extracted from academy.ts:741
 *   [ ] shadow-vs-actual pairing dashboard
 *   [ ] rollback runbook
 *   [ ] BLOCKED-CEO-ACTIVATION (turn the flag on)
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

import { logger } from '../../lib/logger';
import {
  resolveBookingSource,
  type BookingSource,
  type BookingSourceResolution,
} from './bookingSourceResolver';

/**
 * Feature flag. Off by default. When on, the v2 provider-response
 * route replaces its `applyBridgeDecision` call with
 * `dispatchAcceptForSource()`. Until then, every path stays exactly
 * as today; only the shadow observability records intent.
 */
export function isDispatcherEnabled(): boolean {
  return String(process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED || '').toLowerCase() === 'true';
}

export type DispatchDecision = 'accept' | 'decline';

export interface DispatchInput {
  requestId: string;
  providerUid: string;
  quoteBreakdown: unknown;
  decision: DispatchDecision;
}

export interface DispatchOutcome {
  ok: boolean;
  source: BookingSource;
  legacyBookingId?: string;
  errorCode?:
    | 'DISPATCHER_NOT_ENABLED'
    | 'BOOKING_SOURCE_UNRESOLVED'  // CEO §2: malformed legacyRef — refuse dispatch
    | 'NOT_YET_IMPLEMENTED_SITTER'
    | 'NOT_YET_IMPLEMENTED_WALK'
    | 'SERVICE_NOT_ACTIVE'         // §10: academy today is non-symmetric (no accept/decline pair,
                                    //      no atomic claim, wallet-only) — refuse until unified
    | 'PAYMENT_RAIL_MISSING'       // §24: walk currently accepts w/o a payment rail; a future
                                    //      extracted walk core will use this to make the honest
                                    //      state observable instead of a silent success
    | 'PIPELINE_ERROR';
  message?: string;
}

/**
 * Live dispatch. Off in production today. When on, delegates to the
 * per-source `accept*Core` (each is extracted from the existing
 * inline route code in a follow-up PR and inherits the same atomic
 * status-claim idempotency).
 */
export async function dispatchAcceptForSource(input: DispatchInput): Promise<DispatchOutcome> {
  if (!isDispatcherEnabled()) {
    return {
      ok: false, source: 'UNIFIED_REQUEST',
      errorCode: 'DISPATCHER_NOT_ENABLED',
      message: 'BOOKING_ACCEPT_DISPATCHER_ENABLED is false — legacy path handles this event.',
    };
  }
  const res = resolveBookingSource(input.quoteBreakdown);
  switch (res.source) {
    case 'SITTER_SUITE':
      return { ok: false, source: res.source, legacyBookingId: res.legacyBookingId,
        errorCode: 'NOT_YET_IMPLEMENTED_SITTER',
        message: 'acceptSitterBookingCore extraction pending — see design note.' };
    case 'WALK':
      return { ok: false, source: res.source, legacyBookingId: res.legacyBookingId,
        errorCode: 'NOT_YET_IMPLEMENTED_WALK',
        message: 'acceptWalkBookingCore extraction pending — see design note.' };
    case 'ACADEMY':
      // §10: Academy is non-symmetric today — solo /confirm verb, no
      // accept/decline pair, no atomic status claim, wallet-only. The
      // dispatcher must refuse to move money through this pipeline until
      // it's been unified with the sitter/walk contract. This is NOT a
      // "not-yet-implemented" — it's a policy refusal.
      return { ok: false, source: res.source, legacyBookingId: res.legacyBookingId,
        errorCode: 'SERVICE_NOT_ACTIVE',
        message: 'Academy uses solo /confirm verb, no atomic claim, wallet-only; dispatcher refuses until unified.' };
    case 'UNIFIED_REQUEST':
      // The current v2 route handles unified requests correctly today;
      // the dispatcher explicitly does NOT intercept them.
      return { ok: true, source: res.source };
    case 'UNKNOWN_SOURCE':
      // CEO §2: NEVER dispatch an unknown source. Never move money.
      // Emit the reconciliation signal so ops can chase the malformed
      // legacyRef down.
      emitUnknownSourceSignal(input, res);
      return {
        ok: false, source: res.source,
        errorCode: 'BOOKING_SOURCE_UNRESOLVED',
        message: 'Malformed legacyRef — dispatch refused. Reconciliation signal emitted.',
      };
  }
}

/**
 * BOOKING_SOURCE_UNRESOLVED observability. Never dispatches, never
 * mutates. Non-PII: logs the raw legacy table/id we couldn't
 * resolve but not the full quote_breakdown (which may carry pricing
 * detail we don't want in log-search).
 */
function emitUnknownSourceSignal(input: DispatchInput, res: import('./bookingSourceResolver').BookingSourceResolution) {
  logger.error('BOOKING_SOURCE_UNRESOLVED', {
    signal: 'BOOKING_SOURCE_UNRESOLVED',
    requestId: input.requestId,
    providerUidTail: input.providerUid.slice(-6),
    decision: input.decision,
    unresolvedTable: res.unresolvedRef?.table ?? null,
    unresolvedId: res.unresolvedRef?.id ?? null,
  });
  // Admin-alert surface (Lane D §D8). Malformed legacyRef means we
  // WOULD have moved money down an unknown pipeline — never silent.
  // Dedup keys the specific unresolved (table, id) pair so a stuck
  // row shows exactly once; ops resolves the underlying booking_requests
  // row and the alert stays resolved unless a NEW malformed ref appears.
  void (async () => {
    try {
      const { createOrUpdateAlert } = await import('../AlertEngine');
      await createOrUpdateAlert({
        dedupeKey: `booking_source_unresolved:${res.unresolvedRef?.table ?? 'null'}:${res.unresolvedRef?.id ?? 'null'}:${input.requestId}`,
        category: 'system',
        severity: 'critical',
        title: 'Booking source unresolved — money-safe refusal',
        message: `Dispatcher refused to route booking ${input.requestId}: legacyRef table=${res.unresolvedRef?.table ?? 'null'} id=${res.unresolvedRef?.id ?? 'null'} does not match any known pipeline. Inspect booking_requests.quote_breakdown.legacyRef and correct the mirror.`,
        linkedEntityType: 'booking_request',
        linkedEntityId: input.requestId,
        source: 'auto_sweep',
        metadata: {
          signal: 'BOOKING_SOURCE_UNRESOLVED',
          decision: input.decision,
          unresolvedTable: res.unresolvedRef?.table ?? null,
          unresolvedId: res.unresolvedRef?.id ?? null,
        },
      });
    } catch (alertErr: any) {
      logger.warn('[BookingResponseDispatcher] Alert wiring for unresolved source failed', {
        errorMessage: alertErr?.message ?? String(alertErr),
      });
    }
  })();
}

/**
 * SHADOW observability — the safe half of the deploy-ready package.
 * Callers pass the same input they would give the live dispatcher;
 * this records WHAT WOULD HAVE HAPPENED at info level so ops can
 * pair the log line with the legacy write's audit trail and confirm
 * they agree BEFORE the flag flips.
 *
 * Non-PII: never logs snapshotText/IP/user-agent. Redacts nothing
 * that isn't already in server logs today.
 */
export function observeIntendedDispatch(input: DispatchInput): BookingSourceResolution {
  const res = resolveBookingSource(input.quoteBreakdown);
  logger.info('BOOKING_ACCEPT_DISPATCH_SHADOW', {
    signal: 'BOOKING_ACCEPT_DISPATCH_SHADOW',
    requestId: input.requestId,
    providerUidTail: input.providerUid.slice(-6),
    decision: input.decision,
    resolvedSource: res.source,
    legacyBookingId: res.legacyBookingId ?? null,
    dispatcherEnabled: isDispatcherEnabled(),
  });
  return res;
}

/**
 * Record a legacy-bridge write failure with a structured signal so a
 * silent-catch doesn't hide a split-brain state where canonical says
 * accepted but the native row didn't change (CEO 2026-08-26
 * correction pass #3 §5). Non-PII: no snapshot, no full quote,
 * providerUid truncated.
 *
 * The caller's primary flow (customer-facing success) MUST NOT depend
 * on this signal — this is observability only. The reconciliation
 * cron and admin dashboards read the resulting log line.
 */
export function emitLegacyBridgeFailure(input: {
  requestId: string;
  providerUid: string;
  decision: DispatchDecision;
  quoteBreakdown: unknown;
  errorMessage?: string;
}): void {
  const res = resolveBookingSource(input.quoteBreakdown);
  logger.error('LEGACY_BRIDGE_WRITE_FAILED', {
    signal: 'LEGACY_BRIDGE_WRITE_FAILED',
    requestId: input.requestId,
    providerUidTail: input.providerUid.slice(-6),
    decision: input.decision,
    resolvedSource: res.source,
    legacyBookingId: res.legacyBookingId ?? null,
    errorMessage: input.errorMessage ?? null,
  });
  // Admin-alert surface (Lane D §D8). A legacy-bridge write failure
  // means canonical booking_requests says "accepted" but the native
  // sitter/walk/academy row didn't flip — split-brain. Dedup keys
  // (requestId, resolvedSource, legacyBookingId) so the same stuck
  // pairing shows exactly once; ops fixes it and the alert stays
  // resolved unless the native row diverges from canonical again.
  void (async () => {
    try {
      const { createOrUpdateAlert } = await import('../AlertEngine');
      await createOrUpdateAlert({
        dedupeKey: `legacy_bridge_write_failed:${input.requestId}:${res.source}:${res.legacyBookingId ?? 'null'}`,
        category: 'system',
        severity: 'critical',
        title: `Legacy bridge write failed (${res.source})`,
        message: `Canonical booking_requests ${input.requestId} decided '${input.decision}' but the ${res.source} mirror (${res.legacyBookingId ?? 'unknown id'}) did not update. Reconcile the native row before customer-visible state diverges further.`,
        linkedEntityType: 'booking_request',
        linkedEntityId: input.requestId,
        source: 'auto_sweep',
        metadata: {
          signal: 'LEGACY_BRIDGE_WRITE_FAILED',
          decision: input.decision,
          resolvedSource: res.source,
          legacyBookingId: res.legacyBookingId ?? null,
          errorMessage: input.errorMessage ?? null,
        },
      });
    } catch (alertErr: any) {
      logger.warn('[BookingResponseDispatcher] Alert wiring for bridge failure failed', {
        errorMessage: alertErr?.message ?? String(alertErr),
      });
    }
  })();
}
