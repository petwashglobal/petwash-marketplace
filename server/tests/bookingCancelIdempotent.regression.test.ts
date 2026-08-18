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

describe('booking.cancelled notification handler is idempotent', () => {
  it('booking.cancelled handler claims idempotency BEFORE sendNotification', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('booking.cancelled'");
    expect(sub).toBeGreaterThan(-1);
    // Slice from the subscribe callback to its closing }, 5); marker.
    const window = src.slice(sub, sub + 3000);
    // Canonical key format from eventMatrix.
    expect(window).toContain('const idempotencyKey = `booking_cancelled:${event.data.bookingId}:${event.userId}`');
    expect(window).toContain('claimIdempotencyKey(idempotencyKey)');
    // The claim() call comes BEFORE sendNotification.
    const claimPos = window.indexOf('claimIdempotencyKey');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeGreaterThan(-1);
    expect(sendPos).toBeGreaterThan(-1);
    expect(claimPos).toBeLessThan(sendPos);
    // Skip path when the key is already claimed.
    expect(window).toContain('already dispatched — skipping');
  });

  it('claimIdempotencyKey writes an atomic marker to notification_logs', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    // Marker row uses distinct channel/template so it never masquerades
    // as a real send in dashboards.
    expect(src).toContain("templateKey: 'idempotency-marker'");
    expect(src).toContain("channel: 'idempotency-marker'");
    expect(src).toContain("eventType: 'idempotency-marker'");
    // Read-then-insert against notification_logs.idempotencyKey.
    expect(src).toMatch(/notificationLogs\.idempotencyKey/);
  });

  it('claim helper fails OPEN on DB errors (rather than dropping a cancel notice)', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const helperIdx = src.indexOf('async function claimIdempotencyKey');
    expect(helperIdx).toBeGreaterThan(-1);
    const helper = src.slice(helperIdx, helperIdx + 1500);
    // On error: warn + return true (proceed with send).
    expect(helper).toMatch(/Idempotency claim failed/);
    expect(helper).toMatch(/return true;\s*\}\s*\}/);
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
