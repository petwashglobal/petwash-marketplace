/**
 * ProviderAvailabilityService — Program 23.
 *
 * Per-service availability; declared schedule can be overridden by
 * a date exception; confirmed commitments always block.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAvailability,
  type WeeklySlot,
} from '../services/marketplace/ProviderAvailabilityService';

// A "walker" schedule: Mon-Fri (weekday 1..5) 09:00-17:00
const walkerSchedule: WeeklySlot[] = [1, 2, 3, 4, 5].map((wd) => ({
  weekday: wd as any,
  startTime: '09:00',
  endTime: '17:00',
}));

describe('ProviderAvailabilityService', () => {
  it('within weekly schedule + no conflict → AVAILABLE', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      requested: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T11:00:00Z' }, // Tue 10-11 UTC
    });
    expect(out.code).toBe('AVAILABLE');
  });

  it('weekday not in schedule → OUTSIDE_WEEKLY_SCHEDULE (Sat)', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      requested: { startAt: '2026-09-05T10:00:00Z', endAt: '2026-09-05T11:00:00Z' }, // Sat
    });
    expect(out.code).toBe('OUTSIDE_WEEKLY_SCHEDULE');
  });

  it('inside weekday but outside daily range → OUTSIDE_WEEKLY_SCHEDULE', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      requested: { startAt: '2026-09-01T08:00:00Z', endAt: '2026-09-01T09:30:00Z' },
    });
    expect(out.code).toBe('OUTSIDE_WEEKLY_SCHEDULE');
  });

  it('date CLOSED exception overrides weekly schedule', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      exceptions: [{ date: '2026-09-01', kind: 'CLOSED' }],
      requested: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T11:00:00Z' },
    });
    expect(out.code).toBe('DATE_CLOSED');
  });

  it('REPLACE exception allows an out-of-weekly window', () => {
    // Saturday would normally be closed; provider added Sat 08:00-12:00.
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      exceptions: [{ date: '2026-09-05', kind: 'REPLACE', ranges: [{ startTime: '08:00', endTime: '12:00' }] }],
      requested: { startAt: '2026-09-05T08:30:00Z', endAt: '2026-09-05T09:30:00Z' },
    });
    expect(out.code).toBe('AVAILABLE');
  });

  it('REPLACE exception with request outside the replaced hours → OUTSIDE_REPLACED_HOURS', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      exceptions: [{ date: '2026-09-05', kind: 'REPLACE', ranges: [{ startTime: '08:00', endTime: '12:00' }] }],
      requested: { startAt: '2026-09-05T13:00:00Z', endAt: '2026-09-05T14:00:00Z' },
    });
    expect(out.code).toBe('OUTSIDE_REPLACED_HOURS');
  });

  it('existing confirmed booking overlapping the request → CONFLICT_EXISTING_BOOKING with its id', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      commitments: [{ bookingId: 'B-EXISTING', startAt: '2026-09-01T10:30:00Z', endAt: '2026-09-01T11:15:00Z' }],
      requested: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T11:00:00Z' },
    });
    expect(out.code).toBe('CONFLICT_EXISTING_BOOKING');
    if (out.code !== 'CONFLICT_EXISTING_BOOKING') throw new Error();
    expect(out.conflictBookingId).toBe('B-EXISTING');
  });

  it('adjacent (not overlapping) existing booking → AVAILABLE', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      commitments: [{ bookingId: 'B-EXISTING', startAt: '2026-09-01T11:00:00Z', endAt: '2026-09-01T12:00:00Z' }],
      requested: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T11:00:00Z' },
    });
    expect(out.code).toBe('AVAILABLE');
  });

  it('end-before-start request → INVALID_INPUT with REQUESTED_END_BEFORE_START', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      requested: { startAt: '2026-09-01T11:00:00Z', endAt: '2026-09-01T10:00:00Z' },
    });
    expect(out.code).toBe('INVALID_INPUT');
    if (out.code !== 'INVALID_INPUT') throw new Error();
    expect(out.reasonCode).toBe('REQUESTED_END_BEFORE_START');
  });

  it('cross-midnight-UTC request refused → callers must use per-night flow', () => {
    const out = evaluateAvailability({
      weeklySchedule: walkerSchedule,
      requested: { startAt: '2026-09-01T23:30:00Z', endAt: '2026-09-02T00:30:00Z' },
    });
    expect(out.code).toBe('INVALID_INPUT');
    if (out.code !== 'INVALID_INPUT') throw new Error();
    expect(out.reasonCode).toBe('REQUEST_CROSSES_MIDNIGHT_UTC');
  });
});
