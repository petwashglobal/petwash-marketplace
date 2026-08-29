/**
 * CEO MASTER DIRECTIVE 2026-08-28 §28 §29 §30 §31 §32 §33 §70 —
 * Failure recovery invariants.
 *
 * A dead battery, a lost GPS, a delayed webhook must NEVER cause an
 * automatic cancellation, a fake "job complete", or a double
 * charge. The server exposes honest state; the client renders it.
 *
 * NO fake GPS interpolation presented as truth. NO invented ETA.
 * NO invented cancellation fee. NO "Pay again" without proof.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveFailureRecoveryState,
  paymentResolutionCopy,
  GPS_LIVE_WINDOW_SECONDS,
  GPS_STALE_WINDOW_SECONDS,
  PROVIDER_HEARTBEAT_WINDOW_SECONDS,
  type ServiceSessionState,
} from '@shared/lib/failureRecovery';

const now = '2026-08-28T20:00:00.000Z';
const nowMs = new Date(now).getTime();
const secAgo = (s: number) => new Date(nowMs - s * 1000).toISOString();

describe('deriveFailureRecoveryState — GPS liveness (CEO §29 §31)', () => {
  it('never_started → not_started, no invented age', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'scheduled',
      lastGpsAtIso: null,
      lastProviderHeartbeatIso: null,
      nowIso: now,
    });
    expect(state.gpsLiveness).toBe('not_started');
    expect(state.lastGpsAgeSeconds).toBeNull();
  });

  it('recent ping ≤ live window → live', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'in_progress',
      lastGpsAtIso: secAgo(GPS_LIVE_WINDOW_SECONDS),
      lastProviderHeartbeatIso: secAgo(5),
      nowIso: now,
    });
    expect(state.gpsLiveness).toBe('live');
  });

  it('ping between live and stale windows → stale', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'in_progress',
      lastGpsAtIso: secAgo(120),
      lastProviderHeartbeatIso: secAgo(5),
      nowIso: now,
    });
    expect(state.gpsLiveness).toBe('stale');
    // Session state stays in_progress — a stale ping does NOT
    // flip to gps_unavailable.
    expect(state.sessionState).toBe('in_progress');
  });

  it('ping beyond stale window → unavailable + session flips to gps_unavailable', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'in_progress',
      lastGpsAtIso: secAgo(GPS_STALE_WINDOW_SECONDS + 60),
      lastProviderHeartbeatIso: secAgo(30),
      nowIso: now,
    });
    expect(state.gpsLiveness).toBe('unavailable');
    expect(state.sessionState).toBe('gps_unavailable');
    // Reason must be the SAFE customer-facing "temporarily
    // unavailable" copy — never "walk ended" (CEO §29).
    expect(state.reasonEn).toMatch(/Live location temporarily unavailable/);
    expect(state.reasonHe).toMatch(/מיקום בזמן אמת אינו זמין/);
  });
});

describe('deriveFailureRecoveryState — provider offline (CEO §33)', () => {
  it('provider heartbeat past window → session flips to provider_offline (in_progress)', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'in_progress',
      lastGpsAtIso: secAgo(10),
      lastProviderHeartbeatIso: secAgo(PROVIDER_HEARTBEAT_WINDOW_SECONDS + 30),
      nowIso: now,
    });
    expect(state.sessionState).toBe('provider_offline');
    // Copy explicitly reassures the customer that the service is
    // still ACTIVE. NEVER "service ended" or "walk completed".
    expect(state.reasonEn).toContain('The provider is temporarily offline');
    expect(state.reasonEn).toContain('still active');
  });

  it('provider offline while GPS is also unavailable → provider_offline WINS (priority)', () => {
    // A cascading failure must not silently downgrade — the more
    // informative state wins.
    const state = deriveFailureRecoveryState({
      storedSessionState: 'in_progress',
      lastGpsAtIso: secAgo(GPS_STALE_WINDOW_SECONDS + 60),
      lastProviderHeartbeatIso: secAgo(PROVIDER_HEARTBEAT_WINDOW_SECONDS + 30),
      nowIso: now,
    });
    expect(state.sessionState).toBe('provider_offline');
  });

  it('storedSessionState=completed is NEVER downgraded by GPS/heartbeat rules', () => {
    const state = deriveFailureRecoveryState({
      storedSessionState: 'completed',
      lastGpsAtIso: secAgo(9999),
      lastProviderHeartbeatIso: secAgo(9999),
      nowIso: now,
    });
    expect(state.sessionState).toBe('completed');
  });
});

describe('deriveFailureRecoveryState — copy discipline (CEO §29 §70)', () => {
  it('never emits fake ETA / invented location / "walk ended" phrasing', () => {
    for (const s of [
      'scheduled',
      'in_progress',
      'gps_unavailable',
      'provider_offline',
      'completed_pending_customer',
      'completed',
      'cancelled',
      'suspended_review',
    ] as ServiceSessionState[]) {
      const state = deriveFailureRecoveryState({
        storedSessionState: s,
        lastGpsAtIso: secAgo(10),
        lastProviderHeartbeatIso: secAgo(5),
        nowIso: now,
      });
      expect(state.reasonEn).not.toMatch(/ETA/i);
      expect(state.reasonEn).not.toMatch(/walk ended/i);
      expect(state.reasonEn).not.toMatch(/at position/i);
    }
  });

  it('every state pair carries HE + EN reason copy', () => {
    for (const s of [
      'scheduled', 'in_progress', 'gps_unavailable', 'provider_offline',
      'completed_pending_customer', 'completed', 'cancelled', 'suspended_review',
    ] as ServiceSessionState[]) {
      const state = deriveFailureRecoveryState({
        storedSessionState: s,
        lastGpsAtIso: secAgo(10),
        lastProviderHeartbeatIso: secAgo(5),
        nowIso: now,
      });
      expect(state.reasonEn.length).toBeGreaterThan(0);
      expect(state.reasonHe.length).toBeGreaterThan(0);
    }
  });
});

describe('paymentResolutionCopy (CEO §12 §70)', () => {
  it('payment_pending copy explicitly reassures no need to pay again', () => {
    const copy = paymentResolutionCopy('payment_pending');
    expect(copy.en).toContain('You do not need to pay again');
    expect(copy.he).toContain('אין צורך לשלם שוב');
  });

  it('payment_confirmed copy positively confirms — never "pending"', () => {
    const copy = paymentResolutionCopy('payment_confirmed');
    expect(copy.en).toContain('confirmed');
    expect(copy.en).not.toContain('pending');
    expect(copy.he).toContain('מאושרת');
  });

  it('no_payment copy is neutral — never accuses the customer of failing to pay', () => {
    const copy = paymentResolutionCopy('no_payment');
    expect(copy.en).not.toMatch(/fail|declined|error/i);
    expect(copy.he).not.toMatch(/כשל|שגיאה|נכשל/);
  });
});
