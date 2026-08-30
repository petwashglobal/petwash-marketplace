/**
 * NotificationPriorityService — Program 34 (Quiet Hours / Load).
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateNotification,
  type UserNotificationPreferences,
} from '../services/marketplace/NotificationPriorityService';

const at = (h: number, m = 0) => {
  const d = new Date('2026-08-30T00:00:00');
  d.setHours(h, m, 0, 0);
  return d;
};

const basePrefs: UserNotificationPreferences = {
  marketingConsent: false,
};

describe('NotificationPriorityService', () => {
  it('quiet hours DEFER a MEDIUM booking request', () => {
    const out = evaluateNotification({
      kind: 'BOOKING_REQUEST_NEW',
      journeyPriority: 'MEDIUM',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(23),
      preferences: { ...basePrefs, quietHours: { fromHour: 22, toHour: 7 } },
    });
    expect(out.verdict).toBe('DEFER');
    if (out.verdict !== 'DEFER') throw new Error();
    expect(out.reasonCode).toBe('QUIET_HOURS');
  });

  it('SAFETY_ALERT PUNCHES THROUGH quiet hours', () => {
    const out = evaluateNotification({
      kind: 'SAFETY_ALERT',
      journeyPriority: 'URGENT',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(3),
      preferences: { ...basePrefs, quietHours: { fromHour: 22, toHour: 7 } },
    });
    expect(out.verdict).toBe('DELIVER');
    if (out.verdict !== 'DELIVER') throw new Error();
    expect(out.punchThroughQuietHours).toBe(true);
    expect(out.channels).toContain('SMS');
  });

  it('PAYMENT_UNCERTAIN punches through quiet hours (money uncertainty is high-priority)', () => {
    const out = evaluateNotification({
      kind: 'PAYMENT_UNCERTAIN',
      journeyPriority: 'HIGH',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(2),
      preferences: { ...basePrefs, quietHours: { fromHour: 22, toHour: 7 } },
    });
    expect(out.verdict).toBe('DELIVER');
  });

  it('marketing without consent → DROP', () => {
    const out = evaluateNotification({
      kind: 'MARKETING_OFFER',
      journeyPriority: 'INFO',
      entityRef: { kind: 'user', id: 'sarah' },
      now: at(14),
      preferences: { marketingConsent: false },
    });
    expect(out.verdict).toBe('DROP');
    if (out.verdict !== 'DROP') throw new Error();
    expect(out.reasonCode).toBe('MARKETING_CONSENT_REVOKED');
  });

  it('user-disabled non-safety kind → DROP', () => {
    const out = evaluateNotification({
      kind: 'BOOKING_ACCEPTED',
      journeyPriority: 'INFO',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(14),
      preferences: { ...basePrefs, disabledKinds: ['BOOKING_ACCEPTED'] },
    });
    expect(out.verdict).toBe('DROP');
    if (out.verdict !== 'DROP') throw new Error();
    expect(out.reasonCode).toBe('USER_DISABLED_KIND');
  });

  it('user cannot disable SAFETY_ALERT (safety is not opt-out)', () => {
    const out = evaluateNotification({
      kind: 'SAFETY_ALERT',
      journeyPriority: 'URGENT',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(14),
      preferences: { ...basePrefs, disabledKinds: ['SAFETY_ALERT' as any] },
    });
    expect(out.verdict).toBe('DELIVER');
  });

  it('anti-storm: same kind twice inside delivery floor → second DROP', () => {
    const now = at(14);
    const recent = new Date(now.getTime() - 60 * 1000).toISOString(); // 1 min ago
    const out = evaluateNotification({
      kind: 'BOOKING_REQUEST_NEW',
      journeyPriority: 'HIGH',
      entityRef: { kind: 'booking', id: 'B-1' },
      now,
      lastDeliveredAt: recent,
      preferences: basePrefs,
    });
    expect(out.verdict).toBe('DROP');
    if (out.verdict !== 'DROP') throw new Error();
    expect(out.reasonCode).toBe('DELIVERY_FLOOR');
  });

  it('all channels disabled → DROP with NO_ENABLED_CHANNEL', () => {
    const out = evaluateNotification({
      kind: 'MESSAGE_NEW',
      journeyPriority: 'INFO',
      entityRef: { kind: 'thread', id: 'T-1' },
      now: at(14),
      preferences: { ...basePrefs, disabledChannels: ['PUSH', 'IN_APP', 'EMAIL', 'SMS'] },
    });
    expect(out.verdict).toBe('DROP');
    if (out.verdict !== 'DROP') throw new Error();
    expect(out.reasonCode).toBe('NO_ENABLED_CHANNEL');
  });

  it('URGENT priority always punches through quiet hours', () => {
    const out = evaluateNotification({
      kind: 'INCIDENT_UPDATE',
      journeyPriority: 'URGENT',
      entityRef: { kind: 'booking', id: 'B-1' },
      now: at(3),
      preferences: { ...basePrefs, quietHours: { fromHour: 22, toHour: 7 } },
    });
    expect(out.verdict).toBe('DELIVER');
  });

  it('quiet-hours DEFER computes an ISO deferUntil at the end of the window', () => {
    const out = evaluateNotification({
      kind: 'MESSAGE_NEW',
      journeyPriority: 'MEDIUM',
      entityRef: { kind: 'thread', id: 'T-1' },
      now: at(23, 30),
      preferences: { ...basePrefs, quietHours: { fromHour: 22, toHour: 7 } },
    });
    expect(out.verdict).toBe('DEFER');
    if (out.verdict !== 'DEFER') throw new Error();
    // Should defer until 07:00 next day.
    expect(out.deferUntil.endsWith(':00.000Z') || out.deferUntil.match(/T0[0-9]:00:00/)).toBeTruthy();
  });
});
