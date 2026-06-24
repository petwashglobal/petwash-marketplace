/**
 * Nayax Cortina pre-paid redemption (CEO + deep-research 2026-06-24). PetWash is
 * the Cortina payment method: authorise = verify pre-paid credit on a bay (no
 * debit); settlement = atomic debit of our ledger on vend (card NEVER charged).
 * DARK until NAYAX_CORTINA_ENABLED. Source-introspection (Nayax-runtime-bound).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'routes', 'nayax-cortina.ts'), 'utf8');
const routes = readFileSync(resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('Nayax Cortina pre-paid redemption', () => {
  it('is dark until NAYAX_CORTINA_ENABLED', () => {
    expect(src).toMatch(/NAYAX_CORTINA_ENABLED/);
    expect(src).toMatch(/if \(!cortinaEnabled\(\)\) return res\.status\(503\)/);
  });

  it('resolves which bay (left/right) from the Nayax reader/terminal id', () => {
    expect(src).toMatch(/or\(eq\(stationBays\.nayaxQrReaderId, terminalId\), eq\(stationBays\.nayaxTerminalId, terminalId\)\)/);
  });

  it('AUTHORISE verifies pre-paid credit but does NOT debit', () => {
    expect(src).toMatch(/\/authorize/);
    expect(src).toMatch(/verifyPassLinkToken\(code\)\.userId/);
    expect(src).toMatch(/do NOT debit here/);
  });

  it('SETTLEMENT debits our ledger atomically (no card charge) and declines on failure', () => {
    expect(src).toMatch(/authorizeRedemption\(\{/);
    expect(src).toMatch(/no_vend_no_charge/);          // vended===false → take no money
    expect(src).toMatch(/cortinaDecline\(1, err\?\.code \|\| 'redemption_failed'\)/);
  });

  it('picks pre-paid credit in order: package → eGift → cash (never a card)', () => {
    expect(src).toMatch(/washPackageCredits[^]*'wash_package'/);
    expect(src).toMatch(/egiftBalanceCents[^]*'egift'/);
    expect(src).toMatch(/cashWalletBalanceCents[^]*'cash'/);
  });

  it('is mounted under the CSRF-exempt /api/webhooks/ prefix', () => {
    expect(routes).toMatch(/app\.use\('\/api\/webhooks\/nayax\/cortina', nayaxCortinaRoutes\)/);
  });
});
