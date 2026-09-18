/**
 * Task 16 — CEO fire order 101-140.
 *
 * Provider application lifecycle notifications must not double-send.
 * Both provider.approved and provider.rejected event handlers now
 * claim an idempotency key BEFORE calling
 * NotificationService.sendNotification, using the same fail-open
 * pattern as the booking lifecycle handlers.
 *
 * Key formats:
 *   - provider_approved:{providerId}:{userId}
 *   - provider_rejected:{providerId}:{userId}
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

/**
 * 2026-09-18 — RETARGETED, same as the booking handlers: the inline
 * `claimIdempotencyKey` helper (a racey SELECT-then-INSERT that wrote
 * 'idempotency-marker' rows into notification_logs) was replaced by the ONE
 * canonical atomic helper, server/lib/eventNotificationIdempotency.ts. These
 * four cases demanded the racey version back.
 *
 * It matters more here than for a booking notice: provider.approved is the
 * message that tells someone they may start working, and provider.rejected is
 * the one that tells them they may not. Sending either twice, or dropping one
 * permanently because a claim was marked "sent" before it was, is the visible
 * failure.
 */
describe('provider.approved / provider.rejected handlers are idempotent', () => {
  const SRC = R('services/events/NotificationEventHandlers.ts');
  const IDEM = R('lib/eventNotificationIdempotency.ts');

  it('handlers use the ONE canonical atomic claim, not a helper of their own', () => {
    expect(SRC).toMatch(/import\s*\{\s*dispatchOnce\s*\}\s*from\s*['"][^'"]*eventNotificationIdempotency['"]/);
    expect(SRC).not.toContain('async function claimIdempotencyKey');
    expect(IDEM).toMatch(/ON CONFLICT\s*\(\s*key\s*\)\s*DO NOTHING/i);
  });

  it('a failed send releases the claim — an approval is never lost to a marker', () => {
    expect(IDEM).toMatch(/finalizeEventNotification\(key,\s*false\)/);
  });

  for (const [event, key] of [
    ['provider.approved', 'notif:provider_approved:'],
    ['provider.rejected', 'notif:provider_rejected:'],
  ] as const) {
    it(`${event} claims a per-provider key and SENDS INSIDE the claim`, () => {
      const at = SRC.indexOf(`eventBus.subscribe('${event}'`);
      expect(at).toBeGreaterThan(-1);
      const window = SRC.slice(at, at + 3000);
      expect(window).toContain(key);
      expect(window).toContain('${event.data.providerId}:${event.userId}`');
      const claimPos = window.indexOf('dispatchOnce');
      const sendPos = window.indexOf('NotificationService.sendNotification');
      expect(claimPos).toBeGreaterThan(-1);
      expect(sendPos).toBeGreaterThan(-1);
      expect(claimPos).toBeLessThan(sendPos);
      expect(window).toMatch(/skipped by idempotency/);
    });
  }
});
