/**
 * PR-UNIFIED-VOUCHERS-MY-PROJECTION — fire-order item 103.
 *
 * GET /api/unified-vouchers/my previously returned the full voucher
 * row via `getVoucherWithBalance` which spreads `...voucher`. That
 * leaked:
 *   signedJws        — ES256 JWS redemption secret (offline forge risk)
 *   immutableHash    — internal integrity fingerprint
 *   purchasedByEmail — buyer PII to gift recipient
 *   purchasedByUserId nayaxTxId purchaseOrderId walletPassId
 *   ownerUserId svgTemplateKey cancelReason recipientEmail
 *   recipientPhone metadata updatedAt
 *
 * Fix: `toSafeVoucherView()` helper — explicit allow-list of 21 fields
 * every /my voucher entry is stripped through before returning.
 * signedJws in particular is the most critical: leaking it would let
 * a caller verify or forge redemption payloads offline against the
 * voucher's immutable-fields hash.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/unified-vouchers.ts';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-UNIFIED-VOUCHERS-MY-PROJECTION', () => {
  const src = read(ROUTE);

  it('A1. toSafeVoucherView helper is defined', () => {
    expect(/function\s+toSafeVoucherView\s*\(\s*v\s*:\s*any\s*\)\s*:\s*SafeVoucherView/.test(src)).toBe(true);
  });

  it('A2. SafeVoucherView type is defined and does NOT include any forbidden field', () => {
    const typeBlock = src.match(/type\s+SafeVoucherView\s*=\s*\{([\s\S]*?)\}\s*;/)?.[1] || '';
    expect(typeBlock.length).toBeGreaterThan(0);
    const forbidden = [
      'signedJws', 'immutableHash',
      'purchasedByEmail', 'purchasedByUserId', 'ownerUserId',
      'nayaxTxId', 'purchaseOrderId', 'walletPassId', 'svgTemplateKey',
      'cancelReason', 'recipientEmail', 'recipientPhone', 'metadata',
      'updatedAt',
    ];
    for (const f of forbidden) {
      // Match key at the start of a line (avoid substring hits).
      const re = new RegExp(`^\\s*${f}\\s*:`, 'm');
      if (re.test(typeBlock)) {
        throw new Error(`SafeVoucherView contains forbidden field "${f}" — must not leak via /my`);
      }
    }
  });

  it('A3. toSafeVoucherView body references ONLY allow-listed fields via v.<field>', () => {
    const body = src.match(/function\s+toSafeVoucherView\s*\([\s\S]*?\)\s*:\s*SafeVoucherView\s*\{([\s\S]*?)\}\s*\n/)?.[1] || '';
    expect(body.length).toBeGreaterThan(0);
    const forbidden = [
      'v.signedJws', 'v.immutableHash',
      'v.purchasedByEmail', 'v.purchasedByUserId', 'v.ownerUserId',
      'v.nayaxTxId', 'v.purchaseOrderId', 'v.walletPassId', 'v.svgTemplateKey',
      'v.cancelReason', 'v.recipientEmail', 'v.recipientPhone', 'v.metadata',
      'v.updatedAt',
    ];
    for (const f of forbidden) {
      expect(body.includes(f)).toBe(false);
    }
    // Positive: the critical safety-check for signedJws — must not
    // appear ANYWHERE in the helper body.
    expect(body.includes('signedJws')).toBe(false);
    expect(body.includes('immutableHash')).toBe(false);
  });

  it('A4. /my handler runs every voucher through toSafeVoucherView', () => {
    const myBlock = src.match(/router\.get\(\s*['"]\/my['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';
    expect(myBlock.length).toBeGreaterThan(0);
    // Both success and fallback paths must project.
    expect(/return\s+toSafeVoucherView\(\s*details\s*\)/.test(myBlock)).toBe(true);
    expect(/return\s+toSafeVoucherView\(\s*\{\s*\.\.\.v/.test(myBlock)).toBe(true);
    // Nothing raw should leak — the pre-fix `return details` +
    // `return { ...v, ledgerBalance...}` patterns must be gone.
    expect(/return\s+details\s*;\s*\n\s*\}\s*catch/.test(myBlock)).toBe(false);
  });

  it('A5. WHERE clause scopes to authenticated uid via ownerUserId OR purchasedByUserId', () => {
    const myBlock = src.match(/router\.get\(\s*['"]\/my['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';
    expect(/or\(\s*eq\(\s*unifiedVouchers\.ownerUserId\s*,\s*uid\s*\)[\s\S]{0,80}eq\(\s*unifiedVouchers\.purchasedByUserId\s*,\s*uid\s*\)/.test(myBlock)).toBe(true);
    // requireAuth middleware is present.
    expect(/router\.get\(\s*['"]\/my['"]\s*,\s*requireAuth\s*,/.test(src)).toBe(true);
  });
});
