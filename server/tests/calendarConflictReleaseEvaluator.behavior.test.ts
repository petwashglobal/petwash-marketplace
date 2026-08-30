/**
 * CalendarConflictReleaseEvaluator — calendar release rules.
 */
import { describe, it, expect } from 'vitest';
import { evaluateCalendarRelease } from '../services/marketplace/CalendarConflictReleaseEvaluator';

const base = {
  bookingId: 'B-1',
  startAt: '2026-08-30T10:00:00Z',
  endAt: '2026-08-30T11:00:00Z',
};

describe('CalendarConflictReleaseEvaluator', () => {
  it('CUSTOMER_CANCELLED → release the original slot', () => {
    const out = evaluateCalendarRelease({ ...base, trigger: 'CUSTOMER_CANCELLED' });
    expect(out.releaseSlot).toBe(true);
    expect(out.slotStartAt).toBe(base.startAt);
    expect(out.slotEndAt).toBe(base.endAt);
  });

  it('PROVIDER_CANCELLED → release the original slot', () => {
    expect(evaluateCalendarRelease({ ...base, trigger: 'PROVIDER_CANCELLED' }).releaseSlot).toBe(true);
  });

  it('BOOKING_EXPIRED → release', () => {
    expect(evaluateCalendarRelease({ ...base, trigger: 'BOOKING_EXPIRED' }).releaseSlot).toBe(true);
  });

  it('CUSTOMER_DECLINED_QUOTE → release', () => {
    expect(evaluateCalendarRelease({ ...base, trigger: 'CUSTOMER_DECLINED_QUOTE' }).releaseSlot).toBe(true);
  });

  it('PROPOSAL_EXPIRED → release the PROPOSED slot (not the original)', () => {
    const out = evaluateCalendarRelease({
      ...base,
      trigger: 'PROPOSAL_EXPIRED',
      proposedStartAt: '2026-08-30T14:00:00Z',
      proposedEndAt: '2026-08-30T15:00:00Z',
    });
    expect(out.releaseSlot).toBe(true);
    expect(out.slotStartAt).toBe('2026-08-30T14:00:00Z');
    expect(out.slotEndAt).toBe('2026-08-30T15:00:00Z');
  });

  it('keepBlocked=true → NO release regardless of trigger', () => {
    const out = evaluateCalendarRelease({ ...base, trigger: 'CUSTOMER_CANCELLED', keepBlocked: true });
    expect(out.releaseSlot).toBe(false);
    expect(out.reasonCode).toBe('PROVIDER_KEEPS_SLOT_BLOCKED');
  });
});
