/**
 * BookingResponseDispatcher — safety invariants for the deploy-ready
 * shell (CEO 2026-08-26 §23-24). The dispatcher must NEVER move money
 * while the feature flag is off, and the resolver must be a pure
 * function.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock declineSitterBookingCore BEFORE importing the dispatcher, so the
// dispatcher's dynamic import picks up the stub instead of the real
// db-backed function. This lets the dispatcher tests run without a live
// Postgres — the real core is exercised by
// declineSitterBookingCore.regression.test.ts.
const declineSitterMock = vi.fn();
vi.mock('../services/booking-response/declineSitterBookingCore', () => ({
  declineSitterBookingCore: (...a: any[]) => declineSitterMock(...a),
}));

const declineWalkMock = vi.fn();
vi.mock('../services/booking-response/declineWalkBookingCore', () => ({
  declineWalkBookingCore: (...a: any[]) => declineWalkMock(...a),
}));

import {
  resolveBookingSource,
} from '../services/booking-response/bookingSourceResolver';
import {
  dispatchAcceptForSource,
  isDispatcherEnabled,
  observeIntendedDispatch,
  emitLegacyBridgeFailure,
} from '../services/booking-response/BookingResponseDispatcher';

describe('resolveBookingSource — pure function', () => {
  it('sitter mirror → SITTER_SUITE', () => {
    expect(resolveBookingSource({ legacyRef: { table: 'sitter_bookings', id: 'SIT-001' } }))
      .toEqual({ source: 'SITTER_SUITE', legacyBookingId: 'SIT-001', legacyTable: 'sitter_bookings' });
  });
  it('walk mirror → WALK', () => {
    expect(resolveBookingSource({ legacyRef: { table: 'walk_bookings', id: 'WALK-001' } }))
      .toEqual({ source: 'WALK', legacyBookingId: 'WALK-001', legacyTable: 'walk_bookings' });
  });
  it('academy mirror → ACADEMY', () => {
    expect(resolveBookingSource({ legacyRef: { table: 'trainer_bookings', id: 'TRN-001' } }))
      .toEqual({ source: 'ACADEMY', legacyBookingId: 'TRN-001', legacyTable: 'trainer_bookings' });
  });
  it('no legacyRef → UNIFIED_REQUEST', () => {
    expect(resolveBookingSource({})).toEqual({ source: 'UNIFIED_REQUEST' });
    expect(resolveBookingSource(null)).toEqual({ source: 'UNIFIED_REQUEST' });
    expect(resolveBookingSource(undefined)).toEqual({ source: 'UNIFIED_REQUEST' });
  });
  it('unknown legacy table → UNKNOWN_SOURCE (fail-safe, never guess UNIFIED)', () => {
    // CEO §2: a legacyRef PRESENT but malformed/unknown must NOT be
    // silently treated as UNIFIED_REQUEST — that would route unknown
    // money through the wrong pipeline. Refuse to dispatch instead.
    const r1 = resolveBookingSource({ legacyRef: { table: 'garbage', id: 'X' } });
    expect(r1.source).toBe('UNKNOWN_SOURCE');
    expect(r1.unresolvedRef).toEqual({ table: 'garbage', id: 'X' });
    // Missing id → UNKNOWN_SOURCE too.
    const r2 = resolveBookingSource({ legacyRef: { table: 'sitter_bookings' } });
    expect(r2.source).toBe('UNKNOWN_SOURCE');
    expect(r2.unresolvedRef).toEqual({ table: 'sitter_bookings', id: null });
    // Missing table → UNKNOWN_SOURCE.
    const r3 = resolveBookingSource({ legacyRef: { id: 'X' } });
    expect(r3.source).toBe('UNKNOWN_SOURCE');
    expect(r3.unresolvedRef).toEqual({ table: null, id: 'X' });
  });
});

describe('dispatchAcceptForSource — feature-flag safety', () => {
  const original = process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED;
  afterEach(() => { process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = original; });

  it('flag OFF by default in test env', () => {
    delete process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED;
    expect(isDispatcherEnabled()).toBe(false);
  });
  it('flag OFF → returns DISPATCHER_NOT_ENABLED for every source', async () => {
    delete process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED;
    const r = await dispatchAcceptForSource({
      requestId: 'BR-1', providerUid: 'p1',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'SIT-1' } },
      decision: 'accept',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('DISPATCHER_NOT_ENABLED');
  });
  beforeEach(() => { declineSitterMock.mockReset(); declineWalkMock.mockReset(); });

  it('flag ON + sitter + accept → NOT_YET_IMPLEMENTED (money path still gated)', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-2', providerUid: 'p2',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'SIT-2' } },
      decision: 'accept',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_YET_IMPLEMENTED_SITTER');
    // ACCEPT must NEVER reach the decline core — that would be a
    // wrong-branch bug that could silently short-circuit a payment.
    expect(declineSitterMock).not.toHaveBeenCalled();
  });

  it('flag ON + sitter + decline → delegates to declineSitterBookingCore with the legacyBookingId', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    declineSitterMock.mockResolvedValueOnce({ ok: true, status: 'declined', message: 'ok' });
    const r = await dispatchAcceptForSource({
      requestId: 'BR-2D', providerUid: 'p2d',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'SIT-2D' } },
      decision: 'decline',
    });
    expect(r.ok).toBe(true);
    expect(r.source).toBe('SITTER_SUITE');
    expect(r.legacyBookingId).toBe('SIT-2D');
    expect(declineSitterMock).toHaveBeenCalledTimes(1);
    // The dispatcher MUST pass the RESOLVED legacyBookingId (sitter_bookings.bookingId)
    // and the providerUid unchanged — a substitution would let one provider
    // decline another's booking.
    expect(declineSitterMock).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'SIT-2D', providerUid: 'p2d' }),
    );
  });

  it('flag ON + sitter + decline + core returns FORBIDDEN → PIPELINE_ERROR (never masks failure as ok)', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    declineSitterMock.mockResolvedValueOnce({ ok: false, errorCode: 'FORBIDDEN', message: 'Only the assigned provider can respond to this booking' });
    const r = await dispatchAcceptForSource({
      requestId: 'BR-2E', providerUid: 'wrong-p',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'SIT-2E' } },
      decision: 'decline',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('PIPELINE_ERROR');
    expect(r.message).toContain('FORBIDDEN');
  });
  it('flag ON + walk + accept → NOT_YET_IMPLEMENTED (money path still gated, no payment rail)', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-3', providerUid: 'p3',
      quoteBreakdown: { legacyRef: { table: 'walk_bookings', id: 'W-3' } },
      decision: 'accept',
    });
    expect(r.errorCode).toBe('NOT_YET_IMPLEMENTED_WALK');
    expect(declineWalkMock).not.toHaveBeenCalled();
  });

  it('flag ON + walk + decline → delegates to declineWalkBookingCore with the legacyBookingId', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    declineWalkMock.mockResolvedValueOnce({ ok: true, status: 'cancelled', message: 'ok' });
    const r = await dispatchAcceptForSource({
      requestId: 'BR-3D', providerUid: 'p3d',
      quoteBreakdown: { legacyRef: { table: 'walk_bookings', id: 'W-3D' } },
      decision: 'decline',
    });
    expect(r.ok).toBe(true);
    expect(r.source).toBe('WALK');
    expect(r.legacyBookingId).toBe('W-3D');
    expect(declineWalkMock).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'W-3D', providerUid: 'p3d' }),
    );
  });

  it('flag ON + walk + decline + core BOOKING_WRONG_STATE → PIPELINE_ERROR', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    declineWalkMock.mockResolvedValueOnce({ ok: false, errorCode: 'BOOKING_WRONG_STATE', message: 'Booking is already cancelled', currentStatus: 'cancelled' });
    const r = await dispatchAcceptForSource({
      requestId: 'BR-3E', providerUid: 'p3e',
      quoteBreakdown: { legacyRef: { table: 'walk_bookings', id: 'W-3E' } },
      decision: 'decline',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('PIPELINE_ERROR');
    expect(r.message).toContain('BOOKING_WRONG_STATE');
  });
  it('flag ON + academy → SERVICE_NOT_ACTIVE (non-symmetric today; §10)', async () => {
    // Academy is not "not yet implemented" — it has a solo /confirm verb,
    // no accept/decline pair, no atomic status claim, and is wallet-only.
    // The dispatcher REFUSES until the pipeline is unified. This test
    // pins the honest error so a future "just wire it up" PR is forced
    // to unify first.
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-4', providerUid: 'p4',
      quoteBreakdown: { legacyRef: { table: 'trainer_bookings', id: 'T-4' } },
      decision: 'accept',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('SERVICE_NOT_ACTIVE');
  });
  it('flag ON + unified request → ok (the v2 route already handles these)', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-5', providerUid: 'p5',
      quoteBreakdown: {},
      decision: 'accept',
    });
    expect(r.ok).toBe(true);
    expect(r.source).toBe('UNIFIED_REQUEST');
  });
  it('flag ON + unknown source → BOOKING_SOURCE_UNRESOLVED, never dispatch', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-6', providerUid: 'p6',
      quoteBreakdown: { legacyRef: { table: 'unknown_x', id: 'ABC' } },
      decision: 'accept',
    });
    expect(r.ok).toBe(false);
    expect(r.source).toBe('UNKNOWN_SOURCE');
    expect(r.errorCode).toBe('BOOKING_SOURCE_UNRESOLVED');
  });
});

describe('observeIntendedDispatch — pure observation, never mutates', () => {
  it('returns the resolution and does not throw for any shape', () => {
    expect(() => observeIntendedDispatch({
      requestId: 'BR-A', providerUid: 'pa',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'S-A' } },
      decision: 'accept',
    })).not.toThrow();
    expect(() => observeIntendedDispatch({
      requestId: 'BR-B', providerUid: 'pb',
      quoteBreakdown: null as any,
      decision: 'decline',
    })).not.toThrow();
    // Unknown source path also must not throw.
    expect(() => observeIntendedDispatch({
      requestId: 'BR-C', providerUid: 'pc',
      quoteBreakdown: { legacyRef: { table: 'garbage', id: 'X' } },
      decision: 'accept',
    })).not.toThrow();
  });
});

describe('emitLegacyBridgeFailure — split-brain observability (§5)', () => {
  it('does not throw for any input, including a malformed quote', () => {
    expect(() => emitLegacyBridgeFailure({
      requestId: 'BR-D', providerUid: 'pd', decision: 'accept',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'S-D' } },
      errorMessage: 'connection refused',
    })).not.toThrow();
    expect(() => emitLegacyBridgeFailure({
      requestId: 'BR-E', providerUid: 'pe', decision: 'decline',
      quoteBreakdown: null as any,
    })).not.toThrow();
  });
});
