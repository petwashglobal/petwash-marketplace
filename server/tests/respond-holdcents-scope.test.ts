/**
 * POST /:requestId/respond — holdCents must be in scope for the notification body.
 *
 * holdCents was declared with `const` INSIDE the `if (financeState==='hold_active')`
 * block, but referenced OUTSIDE it in the superAppNotifications body strings
 * (`${holdCents > 0 ? ...}`). tsc flagged 4× "Cannot find name 'holdCents'", and
 * at runtime the block-scoped const threw ReferenceError — swallowed by the
 * notification try/catch — so the booking_accepted/declined notification could
 * silently fail to send.
 *
 * Fix: hoist `const holdCents` above the if-block so both the wallet-lifecycle
 * block and the notification body can read it. Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'),
  'utf8',
);

// Isolate the respond handler (other handlers legitimately declare their own holdCents).
function respondHandler(s: string): string {
  const start = s.indexOf("router.post('/:requestId/respond'");
  if (start < 0) throw new Error('respond handler not found');
  const end = s.indexOf('router.post(', start + 10);
  return end < 0 ? s.slice(start) : s.slice(start, end);
}

describe('respond handler — holdCents scope', () => {
  const body = respondHandler(src);

  it('declares holdCents OUTSIDE (before) the hold_active if-block', () => {
    const decl = body.indexOf('const holdCents = Number((booking as any).walletHoldCents) || 0;');
    const ifBlock = body.indexOf("if ((booking as any).financeState === 'hold_active'");
    expect(decl).toBeGreaterThan(-1);
    expect(ifBlock).toBeGreaterThan(-1);
    // The hoisted declaration must come BEFORE the if-block that used to own it.
    expect(decl).toBeLessThan(ifBlock);
  });

  it('declares holdCents exactly once in the respond handler (no redeclare/shadow)', () => {
    const count = (body.match(/const holdCents\s*=/g) || []).length;
    expect(count).toBe(1);
  });

  it('references holdCents in the notification body (the previously-broken spot)', () => {
    expect(body).toMatch(/holdCents > 0 \?/);
  });

  // providerName had the identical scope bug: declared inside the notification
  // try but used in the later accept-email and decline-rebook blocks.
  it('declares providerName before the notification try (in scope for all messaging blocks)', () => {
    const decl = body.indexOf("let providerName = 'הספק';");
    const notifyTry = body.indexOf('// Notify customer via superAppNotifications');
    expect(decl).toBeGreaterThan(-1);
    expect(notifyTry).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(notifyTry);
  });

  it('declares providerName exactly once in the respond handler', () => {
    const count = (body.match(/let providerName =/g) || []).length;
    expect(count).toBe(1);
  });
});
