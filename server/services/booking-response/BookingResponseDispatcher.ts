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
    | 'NOT_YET_IMPLEMENTED_SITTER'
    | 'NOT_YET_IMPLEMENTED_WALK'
    | 'NOT_YET_IMPLEMENTED_ACADEMY'
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
      return { ok: false, source: res.source, legacyBookingId: res.legacyBookingId,
        errorCode: 'NOT_YET_IMPLEMENTED_ACADEMY',
        message: 'acceptAcademyBookingCore extraction pending — see design note.' };
    case 'UNIFIED_REQUEST':
      // The current v2 route handles unified requests correctly today;
      // the dispatcher explicitly does NOT intercept them.
      return { ok: true, source: res.source };
  }
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
