/**
 * Task 15 — CEO fire order 101-140.
 *
 * BOOKING CONFIRMED and BOOKING COMPLETED notifications must not
 * double-send. Both handlers now claim an idempotency key BEFORE
 * calling NotificationService.sendNotification, using the same
 * fail-open pattern as the booking_cancelled handler.
 *
 * Key formats:
 *   - booking_confirmed:{bookingId}:{userId}
 *   - booking_completed:{bookingId}:{userId}
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('booking.confirmed and booking.completed handlers are idempotent', () => {
  it('claimIdempotencyKey helper is defined', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    expect(src).toContain('async function claimIdempotencyKey');
    // Read-then-insert against notification_logs.idempotencyKey.
    expect(src).toMatch(/notificationLogs\.idempotencyKey/);
    // Marker distinguishes from real sends.
    expect(src).toContain("templateKey: 'idempotency-marker'");
    expect(src).toContain("channel: 'idempotency-marker'");
    expect(src).toContain("eventType: 'idempotency-marker'");
  });

  it('helper fails OPEN on DB errors', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const helperIdx = src.indexOf('async function claimIdempotencyKey');
    expect(helperIdx).toBeGreaterThan(-1);
    const helper = src.slice(helperIdx, helperIdx + 1500);
    expect(helper).toMatch(/Idempotency claim failed/);
    expect(helper).toMatch(/return true;\s*\}\s*\}/);
  });

  it('booking.confirmed handler claims BEFORE sendNotification', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('booking.confirmed'");
    expect(sub).toBeGreaterThan(-1);
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain('const idempotencyKey = `booking_confirmed:${event.data.bookingId}:${event.userId}`');
    expect(window).toContain('claimIdempotencyKey(idempotencyKey)');
    const claimPos = window.indexOf('claimIdempotencyKey');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeGreaterThan(-1);
    expect(sendPos).toBeGreaterThan(-1);
    expect(claimPos).toBeLessThan(sendPos);
    expect(window).toContain('booking_confirmed already dispatched — skipping');
  });

  it('booking.completed handler claims BEFORE sendNotification', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('booking.completed'");
    expect(sub).toBeGreaterThan(-1);
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain('const idempotencyKey = `booking_completed:${event.data.bookingId}:${event.userId}`');
    expect(window).toContain('claimIdempotencyKey(idempotencyKey)');
    const claimPos = window.indexOf('claimIdempotencyKey');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeLessThan(sendPos);
    expect(window).toContain('booking_completed already dispatched — skipping');
  });
});

describe('booking lifecycle handler surface unchanged', () => {
  it('booking.confirmed handler still targets email/push/in_app', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('booking.confirmed'");
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain("channelsOverride: ['email', 'push', 'in_app']");
    expect(window).toContain("templateKey: 'booking_confirmed'");
  });

  it('booking.completed handler still surfaces review URL to the customer', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('booking.completed'");
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain("channelsOverride: ['email', 'push', 'in_app']");
    expect(window).toContain("templateKey: 'booking_completed'");
    expect(window).toContain('reviewUrl: `https://petwash.co.il/review/');
  });
});
