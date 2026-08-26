/**
 * BookingResponseDispatcher — safety invariants for the deploy-ready
 * shell (CEO 2026-08-26 §23-24). The dispatcher must NEVER move money
 * while the feature flag is off, and the resolver must be a pure
 * function.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  it('flag ON + sitter → NOT_YET_IMPLEMENTED (money-safe until extraction lands)', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-2', providerUid: 'p2',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'SIT-2' } },
      decision: 'accept',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_YET_IMPLEMENTED_SITTER');
  });
  it('flag ON + walk → NOT_YET_IMPLEMENTED', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-3', providerUid: 'p3',
      quoteBreakdown: { legacyRef: { table: 'walk_bookings', id: 'W-3' } },
      decision: 'accept',
    });
    expect(r.errorCode).toBe('NOT_YET_IMPLEMENTED_WALK');
  });
  it('flag ON + academy → NOT_YET_IMPLEMENTED', async () => {
    process.env.BOOKING_ACCEPT_DISPATCHER_ENABLED = 'true';
    const r = await dispatchAcceptForSource({
      requestId: 'BR-4', providerUid: 'p4',
      quoteBreakdown: { legacyRef: { table: 'trainer_bookings', id: 'T-4' } },
      decision: 'accept',
    });
    expect(r.errorCode).toBe('NOT_YET_IMPLEMENTED_ACADEMY');
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
