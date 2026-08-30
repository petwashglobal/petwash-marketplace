/**
 * CompleteJobPolicy — Program 27.
 */
import { describe, it, expect } from 'vitest';
import { canComplete } from '../services/marketplace/CompleteJobPolicy';

describe('CompleteJobPolicy — service-specific completion', () => {
  it('WALK needs start + end + PET_RETURNED (trackedRoute optional — GPS may drop)', () => {
    const ok = canComplete('WALK', {
      sessionStartedAt: '2026-08-30T09:00:00Z',
      sessionEndedAt: '2026-08-30T09:30:00Z',
      petReturnedAcknowledged: true,
      trackedRoute: false,   // GPS dropped — still OK
    });
    expect(ok.code).toBe('COMPLETE_ALLOWED');
  });

  it('WALK missing PET_RETURNED → BLOCKED with PET_RETURNED', () => {
    const out = canComplete('WALK', {
      sessionStartedAt: '2026-08-30T09:00:00Z',
      sessionEndedAt: '2026-08-30T09:30:00Z',
    });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.missingSignals).toContain('PET_RETURNED');
  });

  it('SITTING needs CARE_TASKS + HANDOFF_RETURN_VERIFIED', () => {
    const missing = canComplete('SITTING', { careTasksCompleted: true });
    expect(missing.code).toBe('BLOCKED');
    if (missing.code !== 'BLOCKED') throw new Error();
    expect(missing.missingSignals).toContain('HANDOFF_RETURN_VERIFIED');
    const ok = canComplete('SITTING', { careTasksCompleted: true, handoffReturnVerified: true });
    expect(ok.code).toBe('COMPLETE_ALLOWED');
  });

  it('DAYCARE only needs PICKUP acknowledged', () => {
    expect(canComplete('DAYCARE', { pickupAcknowledged: true }).code).toBe('COMPLETE_ALLOWED');
    expect(canComplete('DAYCARE', {}).code).toBe('BLOCKED');
  });

  it('TRANSPORT needs both PICKUP and DROPOFF', () => {
    expect(canComplete('TRANSPORT', { pickupAcknowledged: true }).code).toBe('BLOCKED');
    expect(canComplete('TRANSPORT', { pickupAcknowledged: true, dropoffAcknowledged: true }).code).toBe('COMPLETE_ALLOWED');
  });

  it('TRAINING needs start + end + CARE_TASKS', () => {
    const ok = canComplete('TRAINING', {
      sessionStartedAt: '2026-08-30T09:00:00Z',
      sessionEndedAt: '2026-08-30T10:00:00Z',
      careTasksCompleted: true,
    });
    expect(ok.code).toBe('COMPLETE_ALLOWED');
  });

  it('GROOMING needs SESSION_END + PET_RETURNED', () => {
    expect(canComplete('GROOMING', { sessionEndedAt: '2026-08-30T09:30:00Z' }).code).toBe('BLOCKED');
    expect(canComplete('GROOMING', { sessionEndedAt: '2026-08-30T09:30:00Z', petReturnedAcknowledged: true }).code).toBe('COMPLETE_ALLOWED');
  });
});
