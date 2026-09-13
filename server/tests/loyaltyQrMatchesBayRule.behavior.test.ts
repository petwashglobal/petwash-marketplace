/**
 * The loyalty-wash QR is minted by the SAME rule the bay enforces (2026-09-13).
 *
 * /api/k9000/generate-qr had its own inline LOYALTY_WASH_COST_POINTS = 200 and no
 * tier check; K9000RedemptionService requires gold+ AND 500 points. A member with
 * 200–499 points (or any silver/bronze member) got a QR the bay then refused with
 * 402/403 — a dead end at the machine. The balance could not go negative (the
 * debit is conditional), so this was a broken promise, not a money loss.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { LOYALTY_QUALIFYING_TIERS, LOYALTY_WASH_COST_POINTS, loyaltyWashEligible } from '../services/K9000RedemptionService';

describe('loyaltyWashEligible — the one rule', () => {
  it('bay cost is 500 points, gold and above', () => {
    expect(LOYALTY_WASH_COST_POINTS).toBe(500);
    expect(LOYALTY_QUALIFYING_TIERS).toEqual(['gold', 'platinum', 'diamond', 'elite', 'vip']);
  });
  it.each([
    [{ loyaltyTier: 'gold', loyaltyPointsBalance: 500 }, true],
    [{ loyaltyTier: 'vip', loyaltyPointsBalance: 9000 }, true],
    [{ loyaltyTier: 'gold', loyaltyPointsBalance: 200 }, false],   // the old mint said yes
    [{ loyaltyTier: 'gold', loyaltyPointsBalance: 499 }, false],
    [{ loyaltyTier: 'silver', loyaltyPointsBalance: 5000 }, false], // the old mint said yes
    [{ loyaltyTier: null, loyaltyPointsBalance: 5000 }, false],
    [{ loyaltyTier: 'gold', loyaltyPointsBalance: null }, false],
  ])('%j → %s', (wallet, expected) => {
    expect(loyaltyWashEligible(wallet as any)).toBe(expected);
  });
});

describe('the QR mint uses it', () => {
  const src = readFileSync(join(__dirname, '..', 'routes.ts'), 'utf8');
  it('no private 200-point constant; loyalty case calls loyaltyWashEligible; tier is selected', () => {
    expect(src).not.toMatch(/LOYALTY_WASH_COST_POINTS\s*=\s*200/);
    expect(src).toContain("case 'loyalty_benefit': return loyaltyWashEligible(wallet);");
    expect(src).toContain('loyaltyTier:           walletAccountsTable.loyaltyTier,');
    expect(src).toContain("loyaltyWashEligible } = await import('./services/K9000RedemptionService');");
  });
});
