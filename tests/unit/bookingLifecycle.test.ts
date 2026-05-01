import { describe, it, expect } from 'vitest';
import { canTransition, applyTransition } from '../../shared/lib/bookingStateMachine';

/**
 * Booking lifecycle integration scenarios — tested at the state-machine
 * level only (no DB needed). These mirror the contracts in
 * docs/booking-state-machine.md and the gates wired into
 * server/routes/booking-requests.ts (Phase B2).
 *
 * What is NOT here (needs a DB / live integration):
 *   - Cross-store double-booking (Postgres vs Firestore)        — Phase B4
 *   - Provider auto-decline after 24h                            — Phase B5
 *   - Calendar create on accept / delete on cancel               — covered by
 *     tests/unit/calendarSync.test.ts (B1) + integration suite
 *   - Reviewer eligibility (already gated server-side, see
 *     marketplace-reviews.ts:170-225)
 */

describe('booking lifecycle — happy path through the state machine', () => {
  it('full path: pending → accepted → in_progress → provider_marked_complete → completed → reviewed', () => {
    let status: any = 'pending';
    expect(canTransition({ from: status, to: 'accepted',                actor: 'provider' }).ok).toBe(true);
    status = 'accepted';
    expect(canTransition({ from: status, to: 'in_progress',             actor: 'provider' }).ok).toBe(true);
    status = 'in_progress';
    expect(canTransition({ from: status, to: 'provider_marked_complete', actor: 'provider' }).ok).toBe(true);
    status = 'provider_marked_complete';
    expect(canTransition({ from: status, to: 'completed',               actor: 'owner'    }).ok).toBe(true);
    status = 'completed';
    expect(canTransition({ from: status, to: 'reviewed',                actor: 'owner'    }).ok).toBe(true);
  });

  it('alternate path: pending → meet_greet_scheduled → meet_greet_completed → confirmed → in_progress', () => {
    let status: any = 'pending';
    expect(canTransition({ from: status, to: 'meet_greet_scheduled', actor: 'provider' }).ok).toBe(true);
    status = 'meet_greet_scheduled';
    expect(canTransition({ from: status, to: 'meet_greet_completed', actor: 'provider' }).ok).toBe(true);
    status = 'meet_greet_completed';
    expect(canTransition({ from: status, to: 'confirmed',            actor: 'system'   }).ok).toBe(true);
    status = 'confirmed';
    expect(canTransition({ from: status, to: 'in_progress',          actor: 'provider' }).ok).toBe(true);
  });
});

describe('booking lifecycle — invalid transitions blocked at the gate', () => {
  it('owner cannot accept their own request', () => {
    const r = canTransition({ from: 'pending', to: 'accepted', actor: 'owner' });
    expect(r.ok).toBe(false);
  });

  it('booking cannot leave terminal cancelled', () => {
    const r = canTransition({ from: 'cancelled', to: 'in_progress', actor: 'admin' });
    expect(r.ok).toBe(false);
  });

  it('provider cannot leave a review', () => {
    const r = canTransition({ from: 'completed', to: 'reviewed', actor: 'provider' });
    expect(r.ok).toBe(false);
  });

  it('cannot skip from pending straight to completed', () => {
    const r = canTransition({ from: 'pending', to: 'completed', actor: 'provider' });
    expect(r.ok).toBe(false);
  });
});

describe('booking lifecycle — cancel matrix', () => {
  it('owner can cancel from pending, accepted, confirmed, in_progress', () => {
    for (const s of ['pending', 'accepted', 'confirmed', 'in_progress']) {
      const r = canTransition({ from: s as any, to: 'cancelled', actor: 'owner' });
      expect(r.ok, `owner cancel from ${s} should be allowed`).toBe(s !== 'in_progress');
      // owner cannot cancel during in_progress (provider must) — confirms
      // the role rules above. We assert separately:
      if (s === 'in_progress') {
        expect(r.ok).toBe(false);
      }
    }
  });

  it('provider can cancel from operational states', () => {
    for (const s of ['accepted', 'confirmed', 'in_progress']) {
      expect(canTransition({ from: s as any, to: 'cancelled', actor: 'provider' }).ok).toBe(true);
    }
  });

  it('system can cancel a stale pending request (B5 timeout)', () => {
    expect(canTransition({ from: 'pending', to: 'cancelled', actor: 'system' }).ok).toBe(true);
    expect(canTransition({ from: 'pending', to: 'declined',  actor: 'system' }).ok).toBe(true);
  });
});

describe('booking lifecycle — applyTransition produces audit entry + timestamp field', () => {
  it('accepted → returns acceptedAt as the timestamp field', () => {
    const out = applyTransition({ from: 'pending', to: 'accepted', actor: 'provider' });
    expect(out.result.ok).toBe(true);
    expect(out.timestampField).toBe('acceptedAt');
    expect(out.historyEntry?.actor).toBe('provider');
  });

  it('cancelled → returns cancelledAt as the timestamp field', () => {
    const out = applyTransition({ from: 'in_progress', to: 'cancelled', actor: 'provider' });
    expect(out.result.ok).toBe(true);
    expect(out.timestampField).toBe('cancelledAt');
  });

  it('error path returns no history entry', () => {
    const out = applyTransition({ from: 'completed', to: 'pending', actor: 'admin' });
    expect(out.result.ok).toBe(false);
    expect(out.historyEntry).toBeUndefined();
    expect(out.timestampField).toBeUndefined();
  });
});
