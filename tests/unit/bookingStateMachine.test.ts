import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyTransition,
  buildHistoryEntry,
  timestampFieldFor,
  ALL_BOOKING_STATUSES,
  TERMINAL_STATUSES,
} from '../../shared/lib/bookingStateMachine';

describe('booking state machine — happy paths', () => {
  it('owner creates a request → status starts at pending (implicit)', () => {
    // The status machine asserts transitions; "create" itself is
    // outside the machine. Initial status is documented as 'pending'.
    expect(ALL_BOOKING_STATUSES).toContain('pending');
  });

  it('provider can accept a pending request', () => {
    expect(canTransition({ from: 'pending', to: 'accepted', actor: 'provider' })).toEqual({ ok: true });
  });

  it('provider can decline a pending request', () => {
    expect(canTransition({ from: 'pending', to: 'declined', actor: 'provider' })).toEqual({ ok: true });
  });

  it('provider can schedule a meet & greet from pending', () => {
    expect(canTransition({ from: 'pending', to: 'meet_greet_scheduled', actor: 'provider' })).toEqual({ ok: true });
  });

  it('provider can mark booking in_progress from accepted', () => {
    expect(canTransition({ from: 'accepted', to: 'in_progress', actor: 'provider' })).toEqual({ ok: true });
  });

  it('provider can mark service complete', () => {
    expect(canTransition({ from: 'in_progress', to: 'provider_marked_complete', actor: 'provider' })).toEqual({ ok: true });
  });

  it('owner can confirm completion (releases escrow)', () => {
    expect(canTransition({ from: 'provider_marked_complete', to: 'completed', actor: 'owner' })).toEqual({ ok: true });
  });

  it('owner can leave a review on a completed booking', () => {
    expect(canTransition({ from: 'completed', to: 'reviewed', actor: 'owner' })).toEqual({ ok: true });
  });

  it('owner can open a dispute during the approval window', () => {
    expect(canTransition({ from: 'provider_marked_complete', to: 'disputed', actor: 'owner' })).toEqual({ ok: true });
    expect(canTransition({ from: 'completed', to: 'disputed', actor: 'owner' })).toEqual({ ok: true });
  });

  it('admin resolves a dispute → completed or cancelled', () => {
    expect(canTransition({ from: 'disputed', to: 'completed', actor: 'admin' })).toEqual({ ok: true });
    expect(canTransition({ from: 'disputed', to: 'cancelled', actor: 'admin' })).toEqual({ ok: true });
  });
});

describe('booking state machine — illegal transitions', () => {
  it('rejects an unknown source status', () => {
    const r = canTransition({ from: 'made_up', to: 'accepted', actor: 'provider' });
    expect(r).toEqual({
      ok: false,
      code: 'UNKNOWN_STATUS',
      statusCode: 400,
      error: expect.stringContaining('Unknown source status'),
    });
  });

  it('rejects an unknown target status', () => {
    const r = canTransition({ from: 'pending', to: 'flying' as any, actor: 'provider' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('UNKNOWN_STATUS');
      expect(r.statusCode).toBe(400);
    }
  });

  it('rejects backward transitions (completed → pending)', () => {
    const r = canTransition({ from: 'completed', to: 'pending', actor: 'admin' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TRANSITION');
  });

  it('rejects skipping ahead (pending → completed)', () => {
    const r = canTransition({ from: 'pending', to: 'completed', actor: 'provider' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TRANSITION');
  });

  it('rejects transitions out of terminal cancelled', () => {
    const r = canTransition({ from: 'cancelled', to: 'in_progress', actor: 'admin' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('TERMINAL_STATE');
      expect(r.statusCode).toBe(409);
    }
  });

  it('rejects transitions out of terminal declined', () => {
    const r = canTransition({ from: 'declined', to: 'accepted', actor: 'provider' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TERMINAL_STATE');
  });

  it('rejects transitions out of terminal reviewed', () => {
    const r = canTransition({ from: 'reviewed', to: 'completed', actor: 'admin' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TERMINAL_STATE');
  });
});

describe('booking state machine — actor permissions', () => {
  it('owner CANNOT mark a booking accepted (only provider can)', () => {
    const r = canTransition({ from: 'pending', to: 'accepted', actor: 'owner' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('FORBIDDEN_ACTOR');
      expect(r.statusCode).toBe(403);
    }
  });

  it('owner CANNOT mark service in_progress', () => {
    const r = canTransition({ from: 'accepted', to: 'in_progress', actor: 'owner' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN_ACTOR');
  });

  it('provider CANNOT confirm completion (must be owner or system)', () => {
    const r = canTransition({ from: 'provider_marked_complete', to: 'completed', actor: 'provider' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN_ACTOR');
  });

  it('provider CANNOT leave a review (only owner can)', () => {
    const r = canTransition({ from: 'completed', to: 'reviewed', actor: 'provider' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN_ACTOR');
  });

  it('owner can cancel from many states', () => {
    expect(canTransition({ from: 'pending', to: 'cancelled', actor: 'owner' }).ok).toBe(true);
    expect(canTransition({ from: 'accepted', to: 'cancelled', actor: 'owner' }).ok).toBe(true);
    expect(canTransition({ from: 'confirmed', to: 'cancelled', actor: 'owner' }).ok).toBe(true);
  });

  it('provider can cancel from operational states (not from confirmed-only states)', () => {
    expect(canTransition({ from: 'accepted', to: 'cancelled', actor: 'provider' }).ok).toBe(true);
    expect(canTransition({ from: 'in_progress', to: 'cancelled', actor: 'provider' }).ok).toBe(true);
  });

  it('only admin can resolve a dispute', () => {
    expect(canTransition({ from: 'disputed', to: 'completed', actor: 'admin' }).ok).toBe(true);
    expect(canTransition({ from: 'disputed', to: 'completed', actor: 'owner' }).ok).toBe(false);
    expect(canTransition({ from: 'disputed', to: 'completed', actor: 'provider' }).ok).toBe(false);
    expect(canTransition({ from: 'disputed', to: 'completed', actor: 'system' }).ok).toBe(false);
  });

  it('system can auto-decline a stale pending request (B5 timeout)', () => {
    expect(canTransition({ from: 'pending', to: 'declined', actor: 'system' }).ok).toBe(true);
  });
});

describe('booking state machine — terminal-status registry', () => {
  it('lists exactly the 3 dead-end statuses', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['cancelled', 'declined', 'reviewed']);
  });

  it('every terminal status has zero allowed forward transitions', () => {
    for (const t of TERMINAL_STATUSES) {
      // Try to leave the terminal state — should always fail.
      const r = canTransition({ from: t, to: 'accepted', actor: 'admin' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('TERMINAL_STATE');
    }
  });
});

describe('buildHistoryEntry', () => {
  it('produces a structured audit entry with ISO timestamp', () => {
    const entry = buildHistoryEntry({
      status: 'accepted',
      actor: 'provider',
      actorId: 'provider-uid-123',
      note: 'Looking forward!',
    });
    expect(entry.status).toBe('accepted');
    expect(entry.actor).toBe('provider');
    expect(entry.actorId).toBe('provider-uid-123');
    expect(entry.note).toBe('Looking forward!');
    expect(typeof entry.timestamp).toBe('string');
    expect(() => new Date(entry.timestamp)).not.toThrow();
  });

  it('coalesces missing actorId/note to null (never undefined)', () => {
    const entry = buildHistoryEntry({ status: 'cancelled', actor: 'system' });
    expect(entry.actorId).toBeNull();
    expect(entry.note).toBeNull();
  });
});

describe('timestampFieldFor', () => {
  it('maps each operational status to its DB column', () => {
    expect(timestampFieldFor('accepted')).toBe('acceptedAt');
    expect(timestampFieldFor('cancelled')).toBe('cancelledAt');
    expect(timestampFieldFor('in_progress')).toBe('serviceStartedAt');
    expect(timestampFieldFor('provider_marked_complete')).toBe('serviceCompletedAt');
    expect(timestampFieldFor('completed')).toBe('ownerConfirmedAt');
    expect(timestampFieldFor('disputed')).toBe('disputeOpenedAt');
  });

  it('returns null when the status is tracked off-row', () => {
    expect(timestampFieldFor('reviewed')).toBeNull();
  });
});

describe('applyTransition — combined helper', () => {
  it('returns history entry + timestamp field on success', () => {
    const out = applyTransition({
      from: 'pending',
      to: 'accepted',
      actor: 'provider',
      actorId: 'provider-uid',
      note: 'I can take it',
    });
    expect(out.result.ok).toBe(true);
    expect(out.historyEntry?.status).toBe('accepted');
    expect(out.timestampField).toBe('acceptedAt');
  });

  it('returns no history entry when the transition is rejected', () => {
    const out = applyTransition({
      from: 'completed',
      to: 'pending',
      actor: 'admin',
    });
    expect(out.result.ok).toBe(false);
    expect(out.historyEntry).toBeUndefined();
    expect(out.timestampField).toBeUndefined();
  });
});
