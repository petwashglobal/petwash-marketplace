import { describe, it, expect } from 'vitest';
import {
  rangesOverlap,
  findConflictingBookings,
  BLOCKING_STATUSES,
} from '../../shared/lib/bookingOverlap';

/**
 * Phase B4 — Booking time-overlap helper tests.
 *
 * Pure-function tests. The DB-level transactional accept gate is wired
 * in server/routes/booking-requests.ts and exercised by the integration
 * suite once a Postgres test instance is available.
 */

const t = (iso: string) => new Date(iso);

describe('rangesOverlap — half-open semantics', () => {
  it('returns true when one range fully contains the other', () => {
    expect(rangesOverlap(
      { start: t('2026-06-01T08:00:00Z'), end: t('2026-06-01T18:00:00Z') },
      { start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T11:00:00Z') },
    )).toBe(true);
  });

  it('returns true when ranges partially overlap (front)', () => {
    expect(rangesOverlap(
      { start: t('2026-06-01T08:00:00Z'), end: t('2026-06-01T10:00:00Z') },
      { start: t('2026-06-01T09:00:00Z'), end: t('2026-06-01T11:00:00Z') },
    )).toBe(true);
  });

  it('returns true when ranges partially overlap (back)', () => {
    expect(rangesOverlap(
      { start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T12:00:00Z') },
      { start: t('2026-06-01T09:00:00Z'), end: t('2026-06-01T11:00:00Z') },
    )).toBe(true);
  });

  it('returns FALSE when ranges touch at a boundary (a.end === b.start)', () => {
    // Provider can finish one booking at 12:00 and start the next at 12:00.
    expect(rangesOverlap(
      { start: t('2026-06-01T08:00:00Z'), end: t('2026-06-01T12:00:00Z') },
      { start: t('2026-06-01T12:00:00Z'), end: t('2026-06-01T14:00:00Z') },
    )).toBe(false);
  });

  it('returns false for non-overlapping ranges', () => {
    expect(rangesOverlap(
      { start: t('2026-06-01T08:00:00Z'), end: t('2026-06-01T09:00:00Z') },
      { start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T11:00:00Z') },
    )).toBe(false);
  });

  it('accepts ISO strings and millisecond numbers', () => {
    expect(rangesOverlap(
      { start: '2026-06-01T09:00:00Z', end: '2026-06-01T11:00:00Z' },
      { start: t('2026-06-01T10:00:00Z').getTime(), end: t('2026-06-01T12:00:00Z').getTime() },
    )).toBe(true);
  });

  it('returns false on invalid dates (defense in depth)', () => {
    expect(rangesOverlap(
      { start: 'not-a-date', end: 'also-bad' },
      { start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T11:00:00Z') },
    )).toBe(false);
  });

  it('returns false on reversed (start >= end) intervals', () => {
    expect(rangesOverlap(
      { start: t('2026-06-01T12:00:00Z'), end: t('2026-06-01T10:00:00Z') }, // reversed
      { start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
    )).toBe(false);
  });
});

describe('BLOCKING_STATUSES — committed bookings only', () => {
  it('lists every status that means "provider is committed to this slot"', () => {
    expect([...BLOCKING_STATUSES].sort()).toEqual([
      'accepted',
      'confirmed',
      'disputed',
      'in_progress',
      'meet_greet_completed',
      'meet_greet_scheduled',
      'payment_pending',
      'provider_marked_complete',
    ]);
  });

  it('does NOT block on pending (provider has not committed yet)', () => {
    expect(BLOCKING_STATUSES).not.toContain('pending');
  });

  it('does NOT block on terminal statuses', () => {
    expect(BLOCKING_STATUSES).not.toContain('cancelled');
    expect(BLOCKING_STATUSES).not.toContain('declined');
    expect(BLOCKING_STATUSES).not.toContain('reviewed');
    expect(BLOCKING_STATUSES).not.toContain('completed');
  });
});

describe('findConflictingBookings — DB-result filter', () => {
  const candidate = {
    start: t('2026-06-01T10:00:00Z'),
    end: t('2026-06-01T12:00:00Z'),
  };

  it('returns the conflicting booking when status is committed and time overlaps', () => {
    const existing = [
      {
        status: 'accepted',
        start: t('2026-06-01T11:00:00Z'),
        end: t('2026-06-01T13:00:00Z'),
      },
    ];
    expect(findConflictingBookings(candidate, existing)).toEqual(existing);
  });

  it('ignores bookings with non-blocking status (pending / cancelled / completed)', () => {
    const existing = [
      { status: 'pending',   start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
      { status: 'cancelled', start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
      { status: 'completed', start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
      { status: 'declined',  start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
    ];
    expect(findConflictingBookings(candidate, existing)).toEqual([]);
  });

  it('ignores back-to-back bookings that touch at the boundary', () => {
    const existing = [
      {
        status: 'accepted',
        start: t('2026-06-01T12:00:00Z'),  // exactly when candidate ends
        end:   t('2026-06-01T14:00:00Z'),
      },
    ];
    expect(findConflictingBookings(candidate, existing)).toEqual([]);
  });

  it('returns multiple conflicts when several overlap', () => {
    const existing = [
      { status: 'accepted',    start: t('2026-06-01T09:00:00Z'), end: t('2026-06-01T11:00:00Z') },
      { status: 'in_progress', start: t('2026-06-01T11:30:00Z'), end: t('2026-06-01T13:00:00Z') },
      { status: 'pending',     start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T12:00:00Z') },
    ];
    const conflicts = findConflictingBookings(candidate, existing);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].status).toBe('accepted');
    expect(conflicts[1].status).toBe('in_progress');
  });

  it('disputed bookings count as blocking (slot is contested)', () => {
    const existing = [
      { status: 'disputed', start: t('2026-06-01T11:00:00Z'), end: t('2026-06-01T13:00:00Z') },
    ];
    expect(findConflictingBookings(candidate, existing)).toHaveLength(1);
  });
});

describe('Real-world scenarios — provider double-booking matrix', () => {
  it('walker has accepted 10:00-11:00 → cannot accept overlapping 10:30-11:30', () => {
    const conflicts = findConflictingBookings(
      { start: t('2026-06-01T10:30:00Z'), end: t('2026-06-01T11:30:00Z') },
      [{ status: 'accepted', start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T11:00:00Z') }],
    );
    expect(conflicts.length).toBe(1);
  });

  it('sitter has overnight booking 18:00-08:00 → cannot accept anything inside that range', () => {
    const conflicts = findConflictingBookings(
      { start: t('2026-06-01T22:00:00Z'), end: t('2026-06-02T03:00:00Z') },
      [{ status: 'in_progress', start: t('2026-06-01T18:00:00Z'), end: t('2026-06-02T08:00:00Z') }],
    );
    expect(conflicts.length).toBe(1);
  });

  it('walker free-and-clear next day → accept succeeds', () => {
    const conflicts = findConflictingBookings(
      { start: t('2026-06-02T10:00:00Z'), end: t('2026-06-02T11:00:00Z') },
      [{ status: 'accepted', start: t('2026-06-01T10:00:00Z'), end: t('2026-06-01T11:00:00Z') }],
    );
    expect(conflicts.length).toBe(0);
  });
});
