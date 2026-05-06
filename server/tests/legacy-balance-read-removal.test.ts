/**
 * PR-W15 — legacy balance reads removed from customer + admin surfaces.
 *
 * Pre-PR-W15:
 *   /api/loyalty/user-profile read user.giftCardBalance and surfaced
 *   it as `giftBalance` to the customer UI — even though the K9000
 *   and marketplace can no longer spend from that legacy column.
 *
 *   /api/admin/customer-analytics scored engagement from
 *   user.washBalance — also legacy, also returns 0 for every wash-
 *   pack purchase since PR-W10.
 *
 * PR-W15 switches BOTH reads to walletAccounts.* (the single source
 * the kiosk + marketplace actually spend from).
 *
 * Source-pin only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W15 — /api/loyalty/user-profile reads walletAccounts.egiftBalanceCents', () => {
  function sliceHandler(): string {
    const idx = text.indexOf("app.get('/api/loyalty/user-profile'");
    if (idx < 0) throw new Error('user-profile route not found');
    // Slice forward to the next route registration.
    const next = text.indexOf("\n  app.", idx + 10);
    return next > 0 ? text.slice(idx, next) : text.slice(idx, idx + 5000);
  }
  const handler = sliceHandler();

  it('does NOT read user.giftCardBalance', () => {
    expect(handler).not.toMatch(/user\.giftCardBalance/);
    expect(handler).not.toMatch(/parseFloat\(user\.giftCardBalance/);
  });

  it('reads via walletService.getWalletSummary(userId)', () => {
    expect(handler).toMatch(/walletService\.getWalletSummary\(userId\)/);
  });

  it('converts egiftBalanceCents → ILS for the giftBalance field', () => {
    expect(handler).toMatch(/summary\.egiftBalanceCents[^]{0,40}\/\s*100/);
  });

  it('falls back to 0 if the wallet lookup fails (best-effort, never crash profile)', () => {
    expect(handler).toMatch(/let giftBalance\s*=\s*0/);
    expect(handler).toMatch(/Wallet summary unavailable/);
  });

  it('still emits the same response shape (giftBalance is still in loyaltyProfile)', () => {
    expect(handler).toMatch(/giftBalance,/);
  });
});

describe('PR-W15 — admin engagement scoring reads walletAccounts.washPackageCredits', () => {
  function sliceHandler(): string {
    // The engagement code lives inside an admin analytics handler
    // (around routes.ts:7053). Find the unique reduce signature.
    const anchor = text.indexOf('Customer satisfaction calculated from real user engagement');
    if (anchor < 0) throw new Error('engagement block not found');
    return text.slice(anchor - 500, anchor + 1500);
  }
  const block = sliceHandler();

  it('does NOT read user.washBalance', () => {
    expect(block).not.toMatch(/user\.washBalance/);
  });

  it('builds a Map<userId, washPackageCredits> from walletAccounts (single bulk SELECT)', () => {
    expect(block).toMatch(/walletAccounts\.userId/);
    expect(block).toMatch(/walletAccounts\.washPackageCredits/);
    expect(block).toMatch(/new Map<string, number>/);
  });

  it('does NOT call walletService.getOrCreateWallet for each user (no read-side wallet creation)', () => {
    // Bulk SELECT only — the helper function getOrCreateWallet would
    // create empty rows as a side-effect of analytics.
    expect(block).not.toMatch(/getOrCreateWallet/);
  });

  it('engagement uses washCreditsByUser.get(user.id) ?? 0', () => {
    expect(block).toMatch(/washCreditsByUser\.get\(user\.id\)\s*\?\?\s*0/);
  });
});

describe('PR-W15 — global guard: legacy column reads sealed', () => {
  // The two PR-W14 medium-risk reads must STAY sealed. If a future
  // PR re-introduces user.giftCardBalance or user.washBalance in
  // these specific contexts the test fails.
  it('routes.ts no longer reads user.giftCardBalance via parseFloat in user-profile', () => {
    expect(text).not.toMatch(/giftBalance\s*=\s*user\s*\?\s*parseFloat\(user\.giftCardBalance/);
  });

  it('routes.ts no longer scores engagement off user.washBalance', () => {
    // Match the reduce body shape that was the bug:
    //   const washCount = user.washBalance || 0;
    expect(text).not.toMatch(/const washCount\s*=\s*user\.washBalance\s*\|\|\s*0/);
  });
});
