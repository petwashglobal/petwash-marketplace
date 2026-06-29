/**
 * Provider payout — atomic escrow claim (anti double-payout).
 * On Cloud Run the auto-release cron runs on every instance; the only safe guard
 * is an atomic UPDATE that flips in_escrow→processing in the WHERE clause and only
 * proceeds if a row was actually claimed. Same guard on cancel prevents a
 * release-vs-cancel race (pay AND refund). Source-introspection (DB/AI-bound).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, '..', 'services', 'ProviderPayoutService.ts'), 'utf8');

describe('ProviderPayoutService atomic claim', () => {
  it('uses the status-guarded atomic WHERE for both release and cancel', () => {
    // Both transitions must guard on status='in_escrow' in the WHERE (not id-only).
    const guarded = SRC.match(/\.where\(and\(eq\(superAppPayouts\.id, payoutId\), eq\(superAppPayouts\.status, 'in_escrow'\)\)\)/g) || [];
    expect(guarded.length).toBeGreaterThanOrEqual(2);
    expect(SRC).toMatch(/\.returning\(\{ id: superAppPayouts\.id \}\)/);
  });

  it('aborts when the claim wins 0 rows (concurrent worker already claimed)', () => {
    expect(SRC).toMatch(/if \(claimed\.length === 0\)/);
    expect(SRC).toMatch(/already being processed \(concurrent claim\)/);
    expect(SRC).toMatch(/if \(cancelled\.length === 0\)/);
  });

  it('the release claim is checked before any bank transfer', () => {
    // The abort-on-not-claimed must come BEFORE processIsraeliBankTransfer.
    const claimIdx = SRC.indexOf('already being processed (concurrent claim)');
    const transferIdx = SRC.indexOf('processIsraeliBankTransfer(payout, provider)');
    expect(claimIdx).toBeGreaterThan(0);
    expect(transferIdx).toBeGreaterThan(claimIdx);
  });
});
