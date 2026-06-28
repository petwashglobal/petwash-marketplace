/**
 * Nayax Lynx client — DARK-by-default, money-free, token-safe.
 * The client must be a no-op until LYNX_ENABLED=true + LYNX_USER_TOKEN set, must
 * never attempt a network call while unwired, and must never expose the token.
 * Admin route is super-admin gated and read-only / audited ops. No money paths.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const clientSrc = readFileSync(resolve(ROOT, 'server/services/LynxClient.ts'), 'utf8');
const routeSrc = readFileSync(resolve(ROOT, 'server/routes/admin-lynx.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

describe('LynxClient — runtime gating (no token → no call)', () => {
  beforeEach(() => {
    delete process.env.LYNX_ENABLED;
    delete process.env.LYNX_USER_TOKEN;
    delete process.env.LYNX_TEST_MACHINE_ID;
  });

  it('isWired() is false and health() reports dark when unconfigured', async () => {
    const { LynxClient } = await import('../services/LynxClient');
    expect(LynxClient.isWired()).toBe(false);
    const h = LynxClient.health();
    expect(h.wired).toBe(false);
    expect(h.tokenConfigured).toBe(false);
    expect(h.reason.toLowerCase()).toContain('dark');
  });

  it('health() never leaks the token value (only booleans)', () => {
    process.env.LYNX_USER_TOKEN = 'super-secret-token-value';
    return import('../services/LynxClient').then(({ LynxClient }) => {
      const h = LynxClient.health();
      expect(JSON.stringify(h)).not.toContain('super-secret-token-value');
      expect(typeof h.tokenConfigured).toBe('boolean');
    });
  });

  it('read/ops calls no-op (no network) while unwired', async () => {
    const { LynxClient } = await import('../services/LynxClient');
    for (const r of [
      await LynxClient.getMachineProducts('123'),
      await LynxClient.getDevice('456'),
      await LynxClient.generatePickList('123'),
      await LynxClient.connectionTest(),
    ]) {
      expect(r.ok).toBe(false);
      expect(r.wired).toBe(false);
      expect(r.status).toBe(0);            // 0 = never attempted
      expect(r.error).toBe('lynx_not_wired');
    }
  });
});

describe('LynxClient — money-free + token-safe by construction', () => {
  it('the client touches NO money/ledger/refund/payout surface (no imports/calls)', () => {
    // Check real code (imports + calls), not docstring prose.
    expect(clientSrc).not.toMatch(/from ['"][^'"]*(WalletLedger|K9000RedemptionService|EscrowStateMachine|BillingLedger)['"]/);
    expect(clientSrc).not.toMatch(/\b(authorizeRedemption|refundToWallet|reverseEntry|debitAndLog)\s*\(/);
    expect(clientSrc).not.toMatch(/\bcreditTransactions\b/);
  });
  it('the token is sent only as a Bearer header, never logged', () => {
    expect(clientSrc).toMatch(/Authorization: `Bearer \$\{e\.token\}`/);
    // No logger line interpolates the token.
    expect(clientSrc).not.toMatch(/logger\.[a-z]+\([^)]*e\.token/);
  });
  it('sandbox is the default; only LYNX_SANDBOX="false" opts into prod', () => {
    expect(clientSrc).toMatch(/qa-lynx\.nayax\.com/);
    expect(clientSrc).toMatch(/!== 'false'/);
  });
});

describe('admin-lynx route — super-admin, read-only, mounted', () => {
  it('is super-admin gated (404 to lower privilege) and mounted', () => {
    expect(routeSrc).toMatch(/isSuperAdminVerified/);
    expect(routeSrc).toMatch(/checkAccessLevel\(8\)/);
    expect(routeSrc).toMatch(/return res\.status\(404\)/);
    expect(routes).toMatch(/app\.use\('\/api\/admin\/lynx', adminLynxRoutes\)/);
  });
  it('env endpoint exposes presence booleans only — never the token', () => {
    expect(routeSrc).toMatch(/lynxUserToken: Boolean\(process\.env\.LYNX_USER_TOKEN\)/);
    expect(routeSrc).not.toMatch(/process\.env\.LYNX_USER_TOKEN\b(?!\))/); // never returned raw
  });
  it('the ops action (pick-list) is audited', () => {
    expect(routeSrc).toMatch(/audit\(req, 'lynx\.pick_list_generate'/);
    expect(routeSrc).toMatch(/audit\(req, 'lynx\.connection_test'/);
  });
});
