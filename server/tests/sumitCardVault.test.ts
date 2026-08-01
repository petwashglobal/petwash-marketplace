import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SumitCardVault, isCardVaultEnabled } from '../services/SumitCardVault';

/**
 * The card vault must be FAIL-CLOSED and FLAG-GATED (CTO P0-2): with CARD_VAULT_ENABLED
 * off it must do NOTHING — no capture, no save, no fake "paid" — and never touch SUMIT or
 * the DB. This is the protection that lets it ship before the live SUMIT verification
 * without any risk of a wrong charge.
 */
describe('SumitCardVault — fail-closed + flag-gated', () => {
  const prev = process.env.CARD_VAULT_ENABLED;
  beforeEach(() => { delete process.env.CARD_VAULT_ENABLED; });
  afterEach(() => { if (prev === undefined) delete process.env.CARD_VAULT_ENABLED; else process.env.CARD_VAULT_ENABLED = prev; });

  it('is disabled by default', () => {
    expect(isCardVaultEnabled()).toBe(false);
  });

  it('captureForBooking never captures when the flag is off (no DB/SUMIT call)', async () => {
    const r = await SumitCardVault.captureForBooking({
      userId: 'u1', amountIls: 450, description: 'Sitter booking', idempotencyKey: 'sitter:TEST',
    });
    expect(r.captured).toBe(false);
    expect(r.reason).toBe('vault_disabled');
  });

  it('saveCard never saves when the flag is off', async () => {
    const r = await SumitCardVault.saveCard({
      userId: 'u1', sumitCustomerId: 123, singlePaymentToken: 'tok_x',
    });
    expect(r.saved).toBe(false);
    expect(r.reason).toBe('vault_disabled');
  });

  it('flag on is respected', () => {
    process.env.CARD_VAULT_ENABLED = 'true';
    expect(isCardVaultEnabled()).toBe(true);
    process.env.CARD_VAULT_ENABLED = 'false';
    expect(isCardVaultEnabled()).toBe(false);
  });
});
