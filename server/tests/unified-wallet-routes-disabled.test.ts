/**
 * PR-W47 — /api/unified/wallet/{add-funds, deduct-funds} are disabled.
 *
 * Both routes used to allow an authenticated user to credit/debit their
 * own wallet with no payment proof, no booking source, no ledger row,
 * and no idempotency. Grep over client/ + server/ proved they had zero
 * live callers, so PR-W47 returns 410 GONE on both.
 *
 * This test pins:
 *   1. Each handler returns HTTP 410.
 *   2. The response carries a structured error code we can grep for in logs.
 *   3. Auth middleware order is preserved (requireAuth + requireActive
 *      run before the 410 — no anonymous probing).
 *   4. The handlers do not call walletService / unifiedWallet internally
 *      (static check on the source).
 *
 * No DB. No HTTP server. Source-pin assertions only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const FILE = path.join(SERVER, 'routes', 'unified-platform.ts');
const text = fs.readFileSync(FILE, 'utf8');

function sliceHandler(routePath: string): string {
  const idx = text.indexOf(`router.post('${routePath}'`);
  if (idx < 0) throw new Error(`route ${routePath} not found`);
  return text.slice(idx, idx + 1500);
}

describe('PR-W47 — /api/unified/wallet/add-funds', () => {
  const handler = sliceHandler('/wallet/add-funds');

  it('returns HTTP 410 GONE', () => {
    expect(handler).toMatch(/res\.status\(410\)/);
  });

  it('emits the structured error code UNIFIED_WALLET_ADD_FUNDS_DISABLED', () => {
    expect(handler).toMatch(/UNIFIED_WALLET_ADD_FUNDS_DISABLED/);
  });

  it('keeps auth middleware (requireAuth + requireActive)', () => {
    expect(handler).toMatch(/requireAuth\s*,\s*requireActive/);
  });

  it('does NOT call unifiedWallet.addFunds / walletService / addCredits', () => {
    expect(handler).not.toMatch(/unifiedWallet\.addFunds\s*\(/);
    expect(handler).not.toMatch(/walletService\./);
    expect(handler).not.toMatch(/addCredits/);
  });

  it('points the caller at the correct replacement (Nayax topup)', () => {
    expect(handler).toMatch(/\/api\/credit-wallet\/topup/);
  });
});

describe('PR-W47 — /api/unified/wallet/deduct-funds', () => {
  const handler = sliceHandler('/wallet/deduct-funds');

  it('returns HTTP 410 GONE', () => {
    expect(handler).toMatch(/res\.status\(410\)/);
  });

  it('emits the structured error code UNIFIED_WALLET_DEDUCT_FUNDS_DISABLED', () => {
    expect(handler).toMatch(/UNIFIED_WALLET_DEDUCT_FUNDS_DISABLED/);
  });

  it('keeps auth middleware (requireAuth + requireActive)', () => {
    expect(handler).toMatch(/requireAuth\s*,\s*requireActive/);
  });

  it('does NOT call unifiedWallet.deductFunds / walletAccounts UPDATE / addCredits', () => {
    expect(handler).not.toMatch(/unifiedWallet\.deductFunds\s*\(/);
    expect(handler).not.toMatch(/db\.update\(walletAccounts\)/);
    expect(handler).not.toMatch(/addCredits/);
  });

  it('points the caller at the correct replacement path', () => {
    expect(handler).toMatch(/booking|voucher|K9000|kiosk redemption/i);
  });
});

describe('PR-W47 — UnifiedWalletService class is left intact (no breaking imports)', () => {
  const svcText = fs.readFileSync(
    path.join(SERVER, 'services', 'UnifiedWalletService.ts'),
    'utf8',
  );

  it('still exports the class', () => {
    expect(svcText).toMatch(/export class UnifiedWalletService/);
  });

  it('still exports the singleton', () => {
    expect(svcText).toMatch(/export const unifiedWallet\s*=/);
  });

  it('still defines addFunds and deductFunds methods', () => {
    // The class methods stay so internal callers (e.g. transferFunds) keep
    // working. Only the HTTP routes are 410.
    expect(svcText).toMatch(/async addFunds\s*\(/);
    expect(svcText).toMatch(/async deductFunds\s*\(/);
  });
});
