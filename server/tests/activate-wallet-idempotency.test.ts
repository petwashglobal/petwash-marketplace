/**
 * PR-W44 — gift-card activate-wallet replay-safe idempotency.
 *
 * Pre-PR-W44, the atomic UPDATE-WHERE-status was the ONLY replay
 * protection on POST /api/gift-cards/:voucherId/activate-wallet. A
 * mobile retry from a flaky network hit the empty-result branch and
 * returned 400 "already activated" — even though the wallet HAD been
 * credited on the first request.
 *
 * PR-W44 wraps the handler with `runWithIdempotency`. Same caller +
 * same voucher = same cached payload, no double-credit.
 *
 * Source-pin only (helper unit tests live in escrow-idempotency.test.ts).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = path.resolve(__dirname, '..', 'routes', 'gift-cards.ts');
const text = fs.readFileSync(FILE, 'utf8');

describe('PR-W44 — activate-wallet replay-safe idempotency', () => {
  it('imports runWithIdempotency from lib/idempotency-helper', () => {
    expect(text).toMatch(
      /import\s*\{\s*runWithIdempotency\s*\}\s*from\s*['"]\.\.\/lib\/idempotency-helper['"]/,
    );
  });

  describe('handler wiring', () => {
    function sliceHandler(): string {
      const idx = text.indexOf("router.post('/:voucherId/activate-wallet'");
      if (idx < 0) throw new Error('activate-wallet route not found');
      // activate-wallet is the LAST mutator in this file; slice to
      // `export default router` (or end of file).
      const end = text.indexOf('export default router', idx);
      return end > 0 ? text.slice(idx, end) : text.slice(idx);
    }

    const handler = sliceHandler();

    it('uses endpoint label "gift-cards:activate-wallet"', () => {
      expect(handler).toMatch(/endpoint:\s*['"]gift-cards:activate-wallet['"]/);
    });

    it('honours the Idempotency-Key header', () => {
      expect(handler).toMatch(/headerKey:\s*req\.headers\['idempotency-key'\]/);
    });

    it('fingerprint = voucherId:userId (same caller, same gift)', () => {
      expect(handler).toMatch(
        /bodyFingerprint:[\s\S]*?\$\{voucherId\}:\$\{userId\}/,
      );
    });

    it('does NOT cache 400 errors — operation throws on not-found / expired / already-redeemed', () => {
      // The throw with statusCode:400 forces the helper to roll back
      // the lock so a subsequent legitimate request still re-evaluates.
      expect(handler).toMatch(/throw\s+Object\.assign\(\s*new Error\(reason\)/);
      expect(handler).toMatch(/statusCode:\s*400/);
    });

    it('caches the SUCCESS payload (atomic UPDATE + walletService.addCredits inside operation)', () => {
      // Both the UPDATE and addCredits must live inside the operation
      // closure so they execute exactly once per fresh request.
      const opStart = handler.indexOf('operation:');
      expect(opStart).toBeGreaterThan(0);
      const beforeOp = handler.slice(0, opStart);
      const fromOp = handler.slice(opStart);

      // Neither the UPDATE nor the addCredits call should appear before
      // the operation closure (i.e. they must run inside it). drizzle
      // chains are usually `db\n  .update(eVouchers)` — match the
      // `.update(eVouchers)` token directly so newlines don't matter.
      expect(beforeOp).not.toMatch(/\.update\(eVouchers\)/);
      expect(beforeOp).not.toMatch(/walletService\.addCredits/);
      expect(fromOp).toMatch(/\.update\(eVouchers\)/);
      expect(fromOp).toMatch(/walletService\.addCredits/);
    });

    it('returns 409 IDEMPOTENCY_IN_FLIGHT when first request still running', () => {
      expect(handler).toMatch(/in_flight[^]{0,50}status\(409\)/);
      expect(handler).toMatch(/IDEMPOTENCY_IN_FLIGHT/);
    });

    it('logs replay-cache hits ("no double-credit")', () => {
      expect(handler).toMatch(/replay-cache hit/i);
      expect(handler).toMatch(/no double-credit/i);
    });

    it('preserves PR-W11 inArray("ISSUED","ACTIVE") status guard', () => {
      // PR-W11 added ACTIVE as a legacy fallback; PR-W44 must not lose it.
      expect(handler).toMatch(/inArray\(\s*eVouchers\.status\s*,\s*\[\s*['"]ISSUED['"]\s*,\s*['"]ACTIVE['"]\s*\]/);
    });

    it('preserves PR-W11 atomic UPDATE → REDEEMED', () => {
      expect(handler).toMatch(/status:\s*['"]REDEEMED['"]/);
    });
  });

  describe('regression — first-call error mapping', () => {
    function sliceHandler(): string {
      const idx = text.indexOf("router.post('/:voucherId/activate-wallet'");
      const end = text.indexOf('export default router', idx);
      return end > 0 ? text.slice(idx, end) : text.slice(idx);
    }
    const handler = sliceHandler();

    it('still returns 400 for "Gift card not found"', () => {
      expect(handler).toMatch(/'Gift card not found'/);
      expect(handler).toMatch(/statusCode:\s*400/);
    });

    it('still returns 400 for "already been activated"', () => {
      expect(handler).toMatch(/'This gift card has already been activated'/);
    });

    it('still returns 400 for "expired or invalid"', () => {
      expect(handler).toMatch(/'Gift card is expired or invalid'/);
    });

    it('still returns 401 when Authorization header missing', () => {
      expect(handler).toMatch(/'Authentication required'/);
      expect(handler).toMatch(/status\(401\)/);
    });

    it('falls back to 500 on unexpected errors', () => {
      expect(handler).toMatch(/'Failed to activate gift card'/);
      expect(handler).toMatch(/status\(500\)/);
    });
  });
});
