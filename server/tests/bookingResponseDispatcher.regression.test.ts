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
  it('unknown legacy table → UNIFIED_REQUEST (fail-safe, never guess)', () => {
    expect(resolveBookingSource({ legacyRef: { table: 'garbage', id: 'X' } }))
      .toEqual({ source: 'UNIFIED_REQUEST' });
    // Missing id → UNIFIED_REQUEST (also fail-safe).
    expect(resolveBookingSource({ legacyRef: { table: 'sitter_bookings' } }))
      .toEqual({ source: 'UNIFIED_REQUEST' });
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
});

describe('observeIntendedDispatch — pure observation, never mutates', () => {
  it('returns the resolution and does not throw for any shape', () => {
    // No matter what the caller passes, observability must be
    // side-effect-safe: never crash a live provider-response.
    expect(() => observeIntendedDispatch({
      requestId: 'BR-6', providerUid: 'p6',
      quoteBreakdown: { legacyRef: { table: 'sitter_bookings', id: 'S-6' } },
      decision: 'accept',
    })).not.toThrow();
    expect(() => observeIntendedDispatch({
      requestId: 'BR-7', providerUid: 'p7',
      quoteBreakdown: null as any,
      decision: 'decline',
    })).not.toThrow();
  });
});
