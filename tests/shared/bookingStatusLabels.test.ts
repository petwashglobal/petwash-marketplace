/**
 * Pure unit tests for shared/lib/bookingStatusLabels.
 *
 * Per CEO §1 (canonical vocab must not become another state machine)
 * + §P1-27 (BEHAVIORAL-VERIFIED). Pins the invariant that:
 *   - every canonical BookingStatus has a HE + EN label + tone.
 *   - bookingStatusLabel returns the correct language.
 *   - non-canonical inputs never crash, always return a visible label.
 *   - bookingStatusBadgeClasses always returns a non-empty string.
 *
 * The `Record<BookingStatus, ...>` types in the source already give
 * BUILD-TIME coverage — a new status added to bookingStateMachine.ts
 * fails tsc here. These tests give RUNTIME coverage: shape stability,
 * bilingual completeness, defensive fallbacks.
 */

import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUS_BADGE_CLASSES,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  bookingStatusBadgeClasses,
  bookingStatusLabel,
  bookingStatusTone,
} from '@shared/lib/bookingStatusLabels';
import { ALL_BOOKING_STATUSES } from '@shared/lib/bookingStateMachine';

describe('bookingStatusLabels — canonical vocab coverage', () => {
  it('BOOKING_STATUS_LABELS covers every ALL_BOOKING_STATUSES entry with non-empty HE + EN', () => {
    for (const s of ALL_BOOKING_STATUSES) {
      const pair = BOOKING_STATUS_LABELS[s];
      expect(pair, `missing labels for status "${s}"`).toBeDefined();
      expect(pair.en.length, `empty EN label for "${s}"`).toBeGreaterThan(0);
      expect(pair.he.length, `empty HE label for "${s}"`).toBeGreaterThan(0);
    }
  });

  it('BOOKING_STATUS_TONE covers every canonical status with a valid tone', () => {
    const validTones = new Set(['neutral', 'positive', 'warning', 'negative', 'inflight']);
    for (const s of ALL_BOOKING_STATUSES) {
      const tone = BOOKING_STATUS_TONE[s];
      expect(tone, `missing tone for status "${s}"`).toBeDefined();
      expect(validTones.has(tone), `invalid tone "${tone}" for status "${s}"`).toBe(true);
    }
  });

  it('BOOKING_STATUS_BADGE_CLASSES has a class string for every tone', () => {
    for (const tone of ['neutral', 'positive', 'warning', 'negative', 'inflight'] as const) {
      const cls = BOOKING_STATUS_BADGE_CLASSES[tone];
      expect(cls, `missing classes for tone "${tone}"`).toBeDefined();
      expect(cls.length).toBeGreaterThan(0);
    }
  });
});

describe('bookingStatusLabel — canonical inputs', () => {
  it('returns the EN label when language is en', () => {
    expect(bookingStatusLabel('pending', 'en')).toBe('Pending');
    expect(bookingStatusLabel('in_progress', 'en')).toBe('In progress');
    expect(bookingStatusLabel('completed', 'en')).toBe('Completed');
    expect(bookingStatusLabel('meet_greet_scheduled', 'en')).toBe('Meet & Greet scheduled');
  });

  it('returns the HE label when language is he', () => {
    expect(bookingStatusLabel('pending', 'he')).toBe('ממתין');
    expect(bookingStatusLabel('in_progress', 'he')).toBe('בתהליך');
    expect(bookingStatusLabel('completed', 'he')).toBe('הושלם');
  });

  it('falls back to EN for any non-he language', () => {
    // arabic, russian, french, etc. — bilingual product ships EN as
    // the neutral default.
    expect(bookingStatusLabel('confirmed', 'ar')).toBe('Confirmed');
    expect(bookingStatusLabel('confirmed', 'fr')).toBe('Confirmed');
    expect(bookingStatusLabel('confirmed', '')).toBe('Confirmed');
  });

  it('every canonical status returns a NON-EMPTY string in both languages', () => {
    for (const s of ALL_BOOKING_STATUSES) {
      expect(bookingStatusLabel(s, 'he').length, `he label for "${s}"`).toBeGreaterThan(0);
      expect(bookingStatusLabel(s, 'en').length, `en label for "${s}"`).toBeGreaterThan(0);
    }
  });
});

describe('bookingStatusLabel — non-canonical / defensive inputs', () => {
  it('non-canonical string falls back to raw uppercased with underscores replaced', () => {
    expect(bookingStatusLabel('quote_sent', 'en')).toBe('QUOTE SENT');
    expect(bookingStatusLabel('pending_provider', 'en')).toBe('PENDING PROVIDER');
    expect(bookingStatusLabel('yolo', 'en')).toBe('YOLO');
  });

  it('null / undefined / non-string inputs never crash — return em-dash', () => {
    expect(bookingStatusLabel(null, 'en')).toBe('—');
    expect(bookingStatusLabel(undefined, 'en')).toBe('—');
    expect(bookingStatusLabel(42, 'en')).toBe('—');
    expect(bookingStatusLabel({}, 'en')).toBe('—');
  });

  it('empty-string input returns em-dash', () => {
    expect(bookingStatusLabel('', 'he')).toBe('—');
  });
});

describe('bookingStatusTone', () => {
  it('canonical status → mapped tone', () => {
    expect(bookingStatusTone('pending')).toBe('warning');
    expect(bookingStatusTone('confirmed')).toBe('positive');
    expect(bookingStatusTone('in_progress')).toBe('inflight');
    expect(bookingStatusTone('completed')).toBe('positive');
    expect(bookingStatusTone('cancelled')).toBe('negative');
    expect(bookingStatusTone('reviewed')).toBe('neutral');
  });

  it('non-canonical / null inputs → neutral (never destructive)', () => {
    expect(bookingStatusTone(null)).toBe('neutral');
    expect(bookingStatusTone(undefined)).toBe('neutral');
    expect(bookingStatusTone('yolo')).toBe('neutral');
    expect(bookingStatusTone(42)).toBe('neutral');
  });
});

describe('bookingStatusBadgeClasses', () => {
  it('always returns a NON-EMPTY class string for every canonical status', () => {
    for (const s of ALL_BOOKING_STATUSES) {
      const cls = bookingStatusBadgeClasses(s);
      expect(cls, `empty classes for "${s}"`).toBeTruthy();
      expect(cls.split(/\s+/).length, `single-token classes for "${s}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('non-canonical input still returns valid neutral classes', () => {
    const cls = bookingStatusBadgeClasses('yolo');
    expect(cls).toBe(BOOKING_STATUS_BADGE_CLASSES['neutral']);
    expect(cls.length).toBeGreaterThan(0);
  });
});
