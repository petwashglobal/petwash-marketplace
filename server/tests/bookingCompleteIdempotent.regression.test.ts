/**
 * Task 15 — CEO fire order 101-140.
 *
 * BOOKING CONFIRMED and BOOKING COMPLETED notifications must not
 * double-send.
 *
 * 2026-09-18 — RETARGETED. This pinned three inline `claimIdempotencyKey`
 * helpers (SELECT-then-INSERT against notification_logs). CEO review later
 * flagged that shape as racey — two workers could both read "not sent" and
 * both send — and it was replaced by ONE canonical, atomic helper,
 * server/lib/eventNotificationIdempotency.ts `dispatchOnce`:
 * INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key, with a lease that a
 * stuck worker cannot hold forever and a release-on-failure so a redelivered
 * event can retry.
 *
 * The pin kept demanding the racey version, so five of its six cases failed
 * and the file sat in the red baseline. One of them was worse than stale: it
 * asserted `reviewUrl: https://petwash.co.il/review/…`, the URL that 404s.
 * The handler was fixed to the routed `/marketplace/review/:bookingId`, and
 * this pin had been failing the FIX and passing the bug.
 *
 * What it guards now is the same promise, against the current mechanism:
 * claim before send, one key per (event, booking, user), and the customer
 * still gets a review link that resolves.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const HANDLERS = R('services/events/NotificationEventHandlers.ts');
const IDEM = R('lib/eventNotificationIdempotency.ts');
const APP = readFileSync(resolve(__dirname, '..', '..', 'client', 'src', 'App.tsx'), 'utf8');

/** The handler body for one event-bus subscription. */
function handlerFor(eventName: string): string {
  const at = HANDLERS.indexOf(`eventBus.subscribe('${eventName}'`);
  expect(at).toBeGreaterThan(-1);
  return HANDLERS.slice(at, at + 3000);
}

describe('the claim is ONE canonical atomic helper, not a per-handler race', () => {
  it('handlers import dispatchOnce and declare no inline claim helper of their own', () => {
    expect(HANDLERS).toMatch(/import\s*\{\s*dispatchOnce\s*\}\s*from\s*['"][^'"]*eventNotificationIdempotency['"]/);
    // The three inline helpers this file used to carry. A reintroduced one is
    // how the race comes back.
    expect(HANDLERS).not.toContain('async function claimIdempotencyKey');
  });

  it('the claim is atomic — insert-or-nothing, never read-then-write', () => {
    expect(IDEM).toMatch(/ON CONFLICT\s*\(\s*key\s*\)\s*DO NOTHING/i);
    expect(IDEM).toMatch(/RETURNING/i);
  });

  it('a stuck worker cannot suppress the notification forever', () => {
    // A 'pending' claim is only trusted for its lease; after that another
    // worker may steal it, and the whole key ages out on a TTL.
    expect(IDEM).toMatch(/leaseMs/);
    expect(IDEM).toMatch(/INTERVAL '24 hours'/);
  });

  it('a failed send RELEASES the claim so a redelivery can retry', () => {
    // The permanent-suppression risk: marking "sent" before knowing it sent.
    expect(IDEM).toMatch(/finalizeEventNotification\(key,\s*false\)/);
  });

  it('lifecycle handlers fail OPEN, and money is told not to reuse that', () => {
    expect(IDEM).toMatch(/fail-open/i);
    expect(IDEM).toMatch(/Money-side callers MUST NOT reuse this fail-open/);
  });
});

describe('booking.confirmed / booking.completed claim BEFORE they send', () => {
  for (const [event, key] of [
    ['booking.confirmed', 'notif:booking_confirmed:'],
    ['booking.completed', 'notif:booking_completed:'],
  ] as const) {
    it(`${event} claims a per-booking, per-user key before sendNotification`, () => {
      const h = handlerFor(event);
      expect(h).toContain('${event.data.bookingId}:${event.userId}`');
      expect(h).toContain(key);
      const claimPos = h.indexOf('dispatchOnce');
      const sendPos = h.indexOf('NotificationService.sendNotification');
      expect(claimPos).toBeGreaterThan(-1);
      expect(sendPos).toBeGreaterThan(-1);
      // The send is INSIDE the claim, which is stronger than merely "after".
      expect(claimPos).toBeLessThan(sendPos);
    });

    it(`${event} says so in the log when a duplicate is skipped`, () => {
      expect(handlerFor(event)).toMatch(/skipped by idempotency/);
    });
  }
});

describe('booking lifecycle handler surface unchanged', () => {
  it('booking.confirmed still targets email/push/in_app', () => {
    const h = handlerFor('booking.confirmed');
    expect(h).toContain("channelsOverride: ['email', 'push', 'in_app']");
    expect(h).toContain("templateKey: 'booking_confirmed'");
  });

  it('booking.completed still surfaces a review URL that actually RESOLVES', () => {
    const h = handlerFor('booking.completed');
    expect(h).toContain("channelsOverride: ['email', 'push', 'in_app']");
    expect(h).toContain("templateKey: 'booking_completed'");
    // The bare /review/:id this pin used to demand is a 404 — reviews are
    // routed under /marketplace. Assert against the router, so the two cannot
    // drift apart again.
    expect(h).toMatch(/reviewUrl: `https:\/\/petwash\.co\.il\/marketplace\/review\/\$\{event\.data\.bookingId\}`/);
    expect(APP).toContain('<Route path="/marketplace/review/:bookingId">');
  });
});
