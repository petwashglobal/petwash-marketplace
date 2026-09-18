/**
 * Task 14 — CEO fire order 101-140.
 *
 * BOOKING CANCEL notifications must not double-send. The event-bus
 * subscribe callback in NotificationEventHandlers now claims the
 * canonical idempotency key `booking_cancelled:{bookingId}:{userId}`
 * (documented in server/lib/eventMatrix.ts) BEFORE calling
 * NotificationService.sendNotification. If the claim already exists,
 * the handler skips.
 *
 * No change to eventPublisher, the domain event enum, cancel
 * endpoint behaviour, or the notification template itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

/**
 * 2026-09-18 — RETARGETED, same reason as bookingCompleteIdempotent: the
 * inline `claimIdempotencyKey` helper (a racey SELECT-then-INSERT that wrote
 * 'idempotency-marker' rows into notification_logs) was replaced by the ONE
 * canonical atomic helper, server/lib/eventNotificationIdempotency.ts. These
 * three cases demanded the racey version and so failed the improvement.
 */
describe('booking.cancelled notification handler is idempotent', () => {
  const SRC = R('services/events/NotificationEventHandlers.ts');
  const sub = SRC.indexOf("eventBus.subscribe('booking.cancelled'");
  const window = SRC.slice(sub, sub + 3000);

  it('claims a per-booking, per-user key and SENDS INSIDE the claim', () => {
    expect(sub).toBeGreaterThan(-1);
    expect(window).toContain('notif:booking_cancelled:');
    expect(window).toContain('${event.data.bookingId}:${event.userId}`');
    const claimPos = window.indexOf('dispatchOnce');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeGreaterThan(-1);
    expect(sendPos).toBeGreaterThan(-1);
    expect(claimPos).toBeLessThan(sendPos);
    expect(window).toMatch(/skipped by idempotency/);
  });

  it('the claim is atomic and leaves no fake row in notification_logs', () => {
    const IDEM = R('lib/eventNotificationIdempotency.ts');
    expect(IDEM).toMatch(/ON CONFLICT\s*\(\s*key\s*\)\s*DO NOTHING/i);
    // The old marker rows masqueraded as sends in dashboards. They are gone,
    // and the claim now lives in idempotency_keys, not notification_logs.
    expect(SRC).not.toContain("templateKey: 'idempotency-marker'");
    expect(IDEM).toMatch(/idempotency_keys/);
  });

  it('fails OPEN on DB errors rather than dropping a cancellation notice', () => {
    const IDEM = R('lib/eventNotificationIdempotency.ts');
    // A cancel notice the customer never gets is worse than a rare duplicate.
    expect(IDEM).toMatch(/'DB_ERROR'/);
    expect(IDEM).toMatch(/fail-open/i);
    // …but money must never inherit that policy.
    expect(IDEM).toMatch(/Money-side callers MUST NOT reuse this fail-open/);
  });
});

describe('booking.cancelled dispatch chain still intact', () => {
  it('DomainEventType.BOOKING_CANCELLED still maps to `booking.cancelled`', () => {
    const src = R('../shared/events.ts');
    expect(src).toMatch(/BOOKING_CANCELLED\s*=\s*['"]booking\.cancelled['"]/);
  });

  it('booking-requests cancel handler still publishes BOOKING_CANCELLED', () => {
    const src = R('routes/booking-requests.ts');
    expect(src).toContain('DomainEventType.BOOKING_CANCELLED');
    expect(src).toContain("source: 'booking-requests/cancel'");
  });

  it('eventMatrix key format matches what the handler claims', () => {
    const src = R('lib/eventMatrix.ts');
    // The doc field spelled: `booking_cancelled:{bookingId}:{userId}`
    expect(src).toContain("idempotencyKeyFormat: 'booking_cancelled:{bookingId}:{userId}'");
  });

  it('cancel notification template still declares in-app / push / email surface', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    // The channels-override list on this handler.
    const sub = src.indexOf("eventBus.subscribe('booking.cancelled'");
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain("channelsOverride: ['email', 'push', 'in_app']");
    expect(window).toContain("templateKey: 'booking_cancelled'");
  });
});
