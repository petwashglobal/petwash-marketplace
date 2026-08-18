/**
 * Pure unit tests for the SERVER-side lifecycle-bucket + jsonb-parse
 * helpers in `server/lib/serviceSessionAdapter.ts`.
 *
 * The DB-hitting resolvers (`resolveFromBookingRequests` etc.) are NOT
 * covered here — those need a Postgres fixture. This file only tests
 * the pure functions that lift status enums into the 5-bucket
 * ServiceSessionStatus + parse jsonb GPS blobs into ServiceLocation.
 *
 * Per CEO §12 (booking = commercial, session = execution) + §16 (never
 * fake a location marker) + §P1-27 (BEHAVIORAL-VERIFIED).
 */

import { describe, expect, it } from 'vitest';
import {
  bucketBookingStatus,
  bucketWalkStatus,
  bucketPettrekStatus,
  jsonbToLocation,
} from '../../server/lib/serviceSessionAdapter';

describe('bucketBookingStatus — canonical booking → lifecycle bucket', () => {
  it('in_progress → in_progress', () => {
    expect(bucketBookingStatus('in_progress')).toBe('in_progress');
  });

  it('provider_marked_complete → awaiting_report', () => {
    expect(bucketBookingStatus('provider_marked_complete')).toBe('awaiting_report');
  });

  it('completed → completed', () => {
    expect(bucketBookingStatus('completed')).toBe('completed');
  });

  it('reviewed → completed (final)', () => {
    expect(bucketBookingStatus('reviewed')).toBe('completed');
  });

  it('cancelled → cancelled', () => {
    expect(bucketBookingStatus('cancelled')).toBe('cancelled');
  });

  it('declined → cancelled', () => {
    expect(bucketBookingStatus('declined')).toBe('cancelled');
  });

  it('every pre-service state → scheduled', () => {
    for (const s of [
      'pending', 'accepted', 'meet_greet_requested',
      'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending',
      'confirmed',
    ]) {
      expect(bucketBookingStatus(s), `status=${s}`).toBe('scheduled');
    }
  });

  it('null / undefined / empty → scheduled (safe default)', () => {
    expect(bucketBookingStatus(null)).toBe('scheduled');
    expect(bucketBookingStatus(undefined)).toBe('scheduled');
    expect(bucketBookingStatus('')).toBe('scheduled');
  });

  it('case normalization', () => {
    expect(bucketBookingStatus('IN_PROGRESS')).toBe('in_progress');
    expect(bucketBookingStatus('Provider_Marked_Complete')).toBe('awaiting_report');
  });
});

describe('bucketWalkStatus — walk_bookings lifecycle', () => {
  it('in_progress → in_progress', () => {
    expect(bucketWalkStatus('in_progress', null)).toBe('in_progress');
  });

  it('completed with actualEndTime → completed', () => {
    expect(bucketWalkStatus('completed', new Date())).toBe('completed');
  });

  it('completed WITHOUT actualEndTime → awaiting_report (data-integrity signal)', () => {
    expect(bucketWalkStatus('completed', null)).toBe('awaiting_report');
  });

  it('cancelled → cancelled', () => {
    expect(bucketWalkStatus('cancelled', null)).toBe('cancelled');
  });

  it('pending / confirmed / unknown → scheduled', () => {
    for (const s of ['pending', 'confirmed', 'yolo', '', null, undefined]) {
      expect(bucketWalkStatus(s as any, null), `status=${s}`).toBe('scheduled');
    }
  });
});

describe('bucketPettrekStatus — pettrek_trips lifecycle (US + UK spelling)', () => {
  it('in_progress → in_progress', () => {
    expect(bucketPettrekStatus('in_progress')).toBe('in_progress');
  });

  it('completed → completed', () => {
    expect(bucketPettrekStatus('completed')).toBe('completed');
  });

  it('canceled (US) → cancelled', () => {
    expect(bucketPettrekStatus('canceled')).toBe('cancelled');
  });

  it('cancelled (UK) → cancelled', () => {
    expect(bucketPettrekStatus('cancelled')).toBe('cancelled');
  });

  it('every pre-service state → scheduled', () => {
    for (const s of ['requested', 'dispatched', 'accepted']) {
      expect(bucketPettrekStatus(s), `status=${s}`).toBe('scheduled');
    }
  });
});

describe('jsonbToLocation — parse walk_bookings.lastKnownLocation blob', () => {
  it('valid blob → ServiceLocation', () => {
    const loc = jsonbToLocation({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 8,
      timestamp: '2026-08-18T12:00:00Z',
    });
    expect(loc).not.toBeNull();
    expect(loc!.latitude).toBeCloseTo(32.0853);
    expect(loc!.longitude).toBeCloseTo(34.7818);
    expect(loc!.accuracyM).toBe(8);
    expect(loc!.recordedAt).toBe('2026-08-18T12:00:00Z');
  });

  it('string coords are coerced to number', () => {
    const loc = jsonbToLocation({
      latitude: '32.0',
      longitude: '34.7',
      accuracy: '15',
      timestamp: '2026-08-18T12:00:00Z',
    });
    expect(loc).not.toBeNull();
    expect(loc!.latitude).toBe(32.0);
    expect(loc!.longitude).toBe(34.7);
    expect(loc!.accuracyM).toBe(15);
  });

  it('missing accuracy → null', () => {
    const loc = jsonbToLocation({
      latitude: 32,
      longitude: 34,
      timestamp: '2026-08-18T12:00:00Z',
    });
    expect(loc!.accuracyM).toBeNull();
  });

  it('missing timestamp → epoch fallback (never null recordedAt)', () => {
    const loc = jsonbToLocation({ latitude: 32, longitude: 34 });
    expect(loc).not.toBeNull();
    expect(loc!.recordedAt).toBe(new Date(0).toISOString());
  });

  it('null / undefined / non-object → null (CEO §16: never fake a marker)', () => {
    expect(jsonbToLocation(null)).toBeNull();
    expect(jsonbToLocation(undefined)).toBeNull();
    expect(jsonbToLocation('string')).toBeNull();
    expect(jsonbToLocation(42)).toBeNull();
  });

  it('NaN / non-numeric lat|lng → null (defense against garbage jsonb)', () => {
    expect(jsonbToLocation({ latitude: NaN, longitude: 34 })).toBeNull();
    expect(jsonbToLocation({ latitude: 32, longitude: 'not-a-number' })).toBeNull();
    expect(jsonbToLocation({ latitude: 'garbage', longitude: 'garbage' })).toBeNull();
    // Missing keys entirely
    expect(jsonbToLocation({})).toBeNull();
  });
});
