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

describe('provider.approved / provider.rejected handlers are idempotent', () => {
  it('claimIdempotencyKey helper is defined', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    expect(src).toContain('async function claimIdempotencyKey');
    expect(src).toMatch(/notificationLogs\.idempotencyKey/);
    expect(src).toContain("templateKey: 'idempotency-marker'");
  });

  it('helper fails OPEN on DB errors', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const helperIdx = src.indexOf('async function claimIdempotencyKey');
    const helper = src.slice(helperIdx, helperIdx + 1500);
    expect(helper).toMatch(/Idempotency claim failed/);
    expect(helper).toMatch(/return true;\s*\}\s*\}/);
  });

  it('provider.approved handler claims BEFORE sendNotification', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('provider.approved'");
    expect(sub).toBeGreaterThan(-1);
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain('const idempotencyKey = `provider_approved:${event.data.providerId}:${event.userId}`');
    const claimPos = window.indexOf('claimIdempotencyKey');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeGreaterThan(-1);
    expect(sendPos).toBeGreaterThan(-1);
    expect(claimPos).toBeLessThan(sendPos);
    expect(window).toContain('provider_approved already dispatched — skipping');
  });

  it('provider.rejected handler claims BEFORE sendNotification', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const sub = src.indexOf("eventBus.subscribe('provider.rejected'");
    expect(sub).toBeGreaterThan(-1);
    const window = src.slice(sub, sub + 3000);
    expect(window).toContain('const idempotencyKey = `provider_rejected:${event.data.providerId}:${event.userId}`');
    const claimPos = window.indexOf('claimIdempotencyKey');
    const sendPos = window.indexOf('NotificationService.sendNotification');
    expect(claimPos).toBeLessThan(sendPos);
    expect(window).toContain('provider_rejected already dispatched — skipping');
  });

  it('provider handler surface unchanged (channels + reason field intact)', () => {
    const src = R('services/events/NotificationEventHandlers.ts');
    const approvedIdx = src.indexOf("eventBus.subscribe('provider.approved'");
    const approvedWindow = src.slice(approvedIdx, approvedIdx + 3000);
    expect(approvedWindow).toContain("channelsOverride: ['email', 'push']");
    expect(approvedWindow).toContain("templateKey: 'provider_approved'");

    const rejectedIdx = src.indexOf("eventBus.subscribe('provider.rejected'");
    const rejectedWindow = src.slice(rejectedIdx, rejectedIdx + 3000);
    expect(rejectedWindow).toContain("channelsOverride: ['email', 'push']");
    expect(rejectedWindow).toContain("templateKey: 'provider_rejected'");
    expect(rejectedWindow).toContain('reason:');
  });
});
