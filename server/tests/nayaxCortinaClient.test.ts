/**
 * Nayax Cortina outbound Start client — DARK-by-default, money-free, token-safe.
 * No-op until NAYAX_CORTINA_ENABLED + integrator + token; never attempts a network
 * call while unwired; never exposes the SecretToken; builds the verified body shape.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, '..', 'services', 'NayaxCortinaClient.ts'), 'utf8');

describe('NayaxCortinaClient — gating + safety', () => {
  beforeEach(() => {
    delete process.env.NAYAX_CORTINA_ENABLED;
    delete process.env.NAYAX_CORTINA_INTEGRATOR_NAME;
    delete process.env.NAYAX_CORTINA_SECRET_TOKEN;
  });

  it('isWired() false + health() dark when unconfigured', async () => {
    const { NayaxCortinaClient } = await import('../services/NayaxCortinaClient');
    expect(NayaxCortinaClient.isWired()).toBe(false);
    const h = NayaxCortinaClient.health();
    expect(h.wired).toBe(false);
    expect(h.secretConfigured).toBe(false);
    expect(h.reason.toLowerCase()).toContain('dark');
  });

  it('startStaticQr no-ops (no network) while unwired', async () => {
    const { NayaxCortinaClient } = await import('../services/NayaxCortinaClient');
    const r = await NayaxCortinaClient.startStaticQr({
      appUserId: 'u1', transactionId: 'TXN-12345678', balance: 55, terminalId: '0456789456789456',
    });
    expect(r.ok).toBe(false);
    expect(r.wired).toBe(false);
    expect(r.httpStatus).toBe(0);          // never attempted
    expect(r.error).toBe('cortina_not_wired');
  });

  it('health() never leaks the token value', async () => {
    process.env.NAYAX_CORTINA_SECRET_TOKEN = 'super-secret-cortina-token-value-1234567890';
    const { NayaxCortinaClient } = await import('../services/NayaxCortinaClient');
    expect(JSON.stringify(NayaxCortinaClient.health())).not.toContain('super-secret-cortina-token-value');
  });

  it('buildStartBody matches the verified Start shape (TerminalId OR UniQR, SecretToken plaintext)', async () => {
    const { NayaxCortinaClient } = await import('../services/NayaxCortinaClient');
    const body: any = NayaxCortinaClient.buildStartBody(
      { appUserId: '19', transactionId: '123456789qwerty', balance: 55, terminalId: '0456789456789456' },
      'THE-64-CHAR-SECRET',
    );
    expect(body.AppUserID).toBe('19');
    expect(body.TransactionId).toBe('123456789qwerty');
    expect(body.SecretToken).toBe('THE-64-CHAR-SECRET');
    expect(body.Balance).toBe(55);
    expect(body.TerminalId).toBe('0456789456789456');
    expect(body.UniQR).toBeUndefined();    // one identifier only
  });
});

describe('NayaxCortinaClient — money-free by construction', () => {
  it('touches NO ledger/refund/payout surface (Start only wakes the device)', () => {
    expect(SRC).not.toMatch(/from ['"][^'"]*(WalletLedger|K9000RedemptionService|EscrowStateMachine)['"]/);
    expect(SRC).not.toMatch(/\b(authorizeRedemption|refundToWallet|reverseEntry|debitAndLog)\s*\(/);
  });
  it('sandbox default; prod only on NAYAX_CORTINA_SANDBOX="false"', () => {
    expect(SRC).toMatch(/qa-lynx\.nayax\.com/);
    expect(SRC).toMatch(/!== 'false'/);
  });
  it('token sent only in the request body, never logged', () => {
    expect(SRC).not.toMatch(/logger\.[a-z]+\([^)]*secretToken/);
  });
});
