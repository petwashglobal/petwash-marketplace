/**
 * NotificationComposer — Program 33 composition.
 */
import { describe, it, expect } from 'vitest';
import { composeNotification } from '../services/marketplace/NotificationComposer';

const at = (h: number) => {
  const d = new Date('2026-08-30T00:00:00');
  d.setHours(h, 0, 0, 0);
  return d;
};

describe('NotificationComposer', () => {
  it('normal delivery → verdict DELIVER + channels + deep link + slugs', () => {
    const out = composeNotification({
      kind: 'BOOKING_ACCEPTED',
      journeyPriority: 'HIGH',
      entityRef: { kind: 'booking', id: 'B-1' },
      preferences: { marketingConsent: true },
      now: at(14),
    });
    expect(out.verdict).toBe('DELIVER');
    expect(out.headlineCode).toBe('NOTIFY_BOOKING_ACCEPTED');
    expect(out.bodyCode).toBe('NOTIFY_BOOKING_ACCEPTED_BODY');
    expect(out.deepLink).toBe('/bookings/B-1');
    expect(out.channels).toBeDefined();
  });

  it('quiet hours defer → verdict DEFER + deferUntil + still carries deep link', () => {
    const out = composeNotification({
      kind: 'MESSAGE_NEW',
      journeyPriority: 'MEDIUM',
      entityRef: { kind: 'thread', id: 'T-1' },
      preferences: { marketingConsent: true, quietHours: { fromHour: 22, toHour: 7 } },
      now: at(23),
    });
    expect(out.verdict).toBe('DEFER');
    expect(out.reasonCode).toBe('QUIET_HOURS');
    expect(out.deferUntil).toBeDefined();
    expect(out.deepLink).toBe('/inbox/threads/T-1');
  });

  it('SAFETY_ALERT during quiet hours → DELIVER (punch-through), SMS included', () => {
    const out = composeNotification({
      kind: 'SAFETY_ALERT',
      journeyPriority: 'URGENT',
      entityRef: { kind: 'support_case', id: 'SC-1' },
      preferences: { marketingConsent: false, quietHours: { fromHour: 22, toHour: 7 } },
      now: at(3),
    });
    expect(out.verdict).toBe('DELIVER');
    expect(out.punchThroughQuietHours).toBe(true);
    expect(out.channels).toContain('SMS');
    expect(out.deepLink).toBe('/support/SC-1');
  });

  it('marketing without consent → DROP + reasonCode MARKETING_CONSENT_REVOKED', () => {
    const out = composeNotification({
      kind: 'MARKETING_OFFER',
      journeyPriority: 'INFO',
      entityRef: { kind: 'promo', id: 'P-1' },
      preferences: { marketingConsent: false },
      now: at(14),
    });
    expect(out.verdict).toBe('DROP');
    expect(out.reasonCode).toBe('MARKETING_CONSENT_REVOKED');
  });

  it('PAYMENT_UNCERTAIN deep link goes to STATUS surface (§12 discipline)', () => {
    const out = composeNotification({
      kind: 'PAYMENT_UNCERTAIN',
      journeyPriority: 'HIGH',
      entityRef: { kind: 'booking', id: 'B-1' },
      preferences: { marketingConsent: true },
      now: at(14),
    });
    expect(out.deepLink).toBe('/bookings/B-1/payment-status');
    expect(out.deepLink.endsWith('/pay')).toBe(false);
  });

  it('WALLET_TOPUP_STATUS deep link goes to status (§12 — never "top up again")', () => {
    const out = composeNotification({
      kind: 'WALLET_TOPUP_STATUS',
      journeyPriority: 'MEDIUM',
      entityRef: { kind: 'wallet_topup', id: 'W-1' },
      preferences: { marketingConsent: true },
      now: at(14),
    });
    expect(out.deepLink).toBe('/wallet/topup/W-1/status');
  });
});
