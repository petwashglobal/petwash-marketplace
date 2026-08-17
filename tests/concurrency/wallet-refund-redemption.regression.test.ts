/**
 * Regression pin — WalletService.refundRedemption used to flip
 * redemption_sessions.status='refunded' at the END of the function.
 * Two concurrent refund calls both passed the 'completed' gate at
 * the top and both ran the atomic balance-restore SQL — restoring
 * e-gift / wash packs / loyalty / promo TWICE.
 *
 * Lane B (2026-08-17) does an atomic conditional UPDATE
 * WHERE status='completed' FIRST; the losing caller returns true
 * without touching balances.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'WalletService.ts'),
  'utf8',
);

describe('WalletService.refundRedemption atomic status claim', () => {
  it('flips redemption session status BEFORE any balance restore', () => {
    // Locate refundRedemption body
    const fnStart = src.indexOf('async refundRedemption(');
    expect(fnStart).toBeGreaterThan(-1);
    const body = src.slice(fnStart, fnStart + 6000);

    // The atomic status flip must precede egiftBalanceCents restore.
    const claimAt = body.indexOf("status: 'refunded'");
    const restoreAt = body.indexOf('egiftBalanceCents:');
    expect(claimAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeGreaterThan(-1);
    expect(claimAt).toBeLessThan(restoreAt);
  });

  it("scopes the atomic flip to WHERE status='completed'", () => {
    // A plain UPDATE WHERE sessionId=... would still race — the
    // status='completed' predicate is what makes it single-shot.
    expect(src).toMatch(/eq\(redemptionSessions\.status,\s*['"]completed['"]\)/);
  });

  it('losing race returns success (idempotent-safe UX)', () => {
    // The losing caller must not throw — a double-tapped Refund
    // button surfacing an error confuses admins.
    expect(src).toMatch(/Redemption refund raced[\s\S]{0,200}?return true/);
  });
});
