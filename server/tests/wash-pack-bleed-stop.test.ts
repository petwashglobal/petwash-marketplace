/**
 * PR-W10 — wash-pack bleed stop.
 *
 * Pre-PR-W10, two server routes wrote wash credits to LEGACY columns that
 * the K9000 kiosk does not read:
 *
 *   server/routes/nayax-webhooks.ts  →  users.washBalance
 *   server/routes.ts (POST /api/wash-history)  →  customers.washBalance
 *
 * The kiosk reads ONLY walletAccounts.washPackageCredits
 * (server/services/K9000RedemptionService.ts wash_package case). So
 * customers paid for packs they could not redeem.
 *
 * This test pins the fix in place by reading the source files at test
 * time. Any future writer that re-introduces a legacy-column increment
 * on those code paths fails this test loudly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const NAYAX_WEBHOOKS = path.join(SERVER, 'routes', 'nayax-webhooks.ts');
const ROUTES         = path.join(SERVER, 'routes.ts');
const K9000          = path.join(SERVER, 'services', 'K9000RedemptionService.ts');

const nayaxText = fs.readFileSync(NAYAX_WEBHOOKS, 'utf8');
const routesText = fs.readFileSync(ROUTES, 'utf8');
const k9000Text  = fs.readFileSync(K9000, 'utf8');

/**
 * Slice the body of `app.post('/api/wash-history', ...)` so the assertions
 * below only inspect that handler — not unrelated wash-history reads.
 */
function sliceWashHistoryHandler(src: string): string {
  const start = src.indexOf("app.post('/api/wash-history'");
  if (start < 0) throw new Error('POST /api/wash-history handler not found');
  // Take a generous window — handler is < 100 lines.
  return src.slice(start, start + 4000);
}

/**
 * Slice the `payment.success` branch INSIDE the checkout-payment webhook.
 * The file has three `payment.success` branches (terminal, checkout,
 * mobile); we want only the checkout one — anchored by the
 * `washHistoryId` variable that lives only in that handler.
 */
function sliceCheckoutPaymentSuccess(src: string): string {
  const handlerStart = src.indexOf('/nayax/checkout-payment');
  if (handlerStart < 0) throw new Error('/nayax/checkout-payment handler not found');
  const branchOffset = src.indexOf("payload.event === 'payment.success'", handlerStart);
  if (branchOffset < 0) throw new Error("payment.success branch not found in checkout handler");
  return src.slice(branchOffset, branchOffset + 4000);
}

describe('PR-W10 — wash-pack bleed stop (writer side)', () => {
  describe('server/routes/nayax-webhooks.ts → checkout-payment success branch', () => {
    const branch = sliceCheckoutPaymentSuccess(nayaxText);

    it('does NOT increment users.washBalance', () => {
      // Patterns that would resurface the bleed:
      //   washBalance: sql`... + ${washCount}`
      //   washBalance: ... washBalance + ...
      //   washBalance: newWashBalance,
      expect(branch).not.toMatch(/washBalance\s*:\s*sql`[^`]*washBalance[^`]*\+/i);
      expect(branch).not.toMatch(/washBalance\s*:\s*[^,}\n]*washBalance\s*\+/i);
      expect(branch).not.toMatch(/washBalance\s*:\s*newWashBalance/i);
    });

    it('credits walletAccounts.washPackageCredits via walletService.addCredits', () => {
      expect(branch).toMatch(/walletService\.addCredits\s*\(/);
      expect(branch).toMatch(/['"]wash_package['"]/);
    });

    it('passes washCount as the credit amount (not finalPrice cents)', () => {
      // The amount argument must be `washCount` — not the shekel price,
      // not pointsEarned, not finalPrice. The 3rd positional arg of
      // walletService.addCredits(userId, creditType, amount, ...).
      expect(branch).toMatch(
        /walletService\.addCredits\s*\(\s*userId\s*,\s*['"]wash_package['"]\s*,\s*washCount\s*,/s,
      );
    });
  });

  describe('server/routes.ts → POST /api/wash-history handler', () => {
    const handler = sliceWashHistoryHandler(routesText);

    it('does NOT update customers.washBalance', () => {
      // Patterns:
      //   washBalance: newWashBalance,
      //   washBalance: customer.washBalance + pkg.washCount,
      expect(handler).not.toMatch(/washBalance\s*:\s*newWashBalance/i);
      expect(handler).not.toMatch(/washBalance\s*:\s*[^,}\n]*\+\s*pkg\.washCount/i);
      // Stronger: the handler must not call updateCustomer with a
      // washBalance field at all.
      expect(handler).not.toMatch(/updateCustomer\s*\([^)]*washBalance/i);
    });

    // SECURITY re-point (2026-07-08, matches routes.ts comment + fix #1325):
    // POST /api/wash-history previously called walletService.addCredits(...)
    // and bumped totalSpent/loyaltyTier with NO payment verification — a
    // SELF-MINT hole (any authenticated caller minted free K9000 wash-package
    // credits and inflated their own tier). The fix REMOVED all crediting
    // from this route, made it requireAdmin, and moved wash-package credit
    // grants to the payment-verified Nayax checkout webhook (asserted by the
    // checkout-payment describe block above). The original tests below pinned
    // the now-DELETED crediting path; they are re-pointed to lock the
    // no-economic-benefit posture that closed the vulnerability.
    // The source documents the fix in a provenance COMMENT that names the
    // removed calls ("previously called walletService.addCredits(...) and
    // bumped totalSpent/loyaltyTier"). Strip //-comments before asserting so
    // the guard checks LIVE CODE only, not the historical note.
    const liveHandler = handler
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');

    it('grants NO wash-package credit from this route (self-mint closed — crediting moved to the paid webhook)', () => {
      expect(liveHandler).not.toMatch(/walletService\.addCredits\s*\(/);
      expect(liveHandler).not.toMatch(/['"]wash_package['"]/);
    });

    it('does not mutate loyalty/spend economics (no totalSpent / loyaltyTier writes)', () => {
      expect(liveHandler).not.toMatch(/totalSpent/i);
      expect(liveHandler).not.toMatch(/loyaltyTier/i);
    });

    it('is admin-only (requireAdmin) — not reachable by an ordinary authenticated caller', () => {
      // The gate is on the route declaration itself; assert it on the source.
      expect(routesText).toMatch(/app\.post\('\/api\/wash-history',\s*requireAdmin\b/);
    });
  });
});

describe('PR-W10 — K9000 redeem path (read side, regression guard)', () => {
  it('wash_package redeem branch decrements walletAccounts.washPackageCredits by 1', () => {
    // K9000RedemptionService has THREE `case 'wash_package':` sites:
    //   precheck (validates balance), debit (the actual UPDATE), and
    //   refund/reversal. The debit branch opens its own block, so it
    //   alone matches `case 'wash_package': {`.
    const idx = k9000Text.indexOf("case 'wash_package': {");
    expect(idx).toBeGreaterThan(0);
    const block = k9000Text.slice(idx, idx + 1500);
    // The decrement must target washPackageCredits and subtract 1.
    expect(block).toMatch(/washPackageCredits\s*:\s*sql`[^`]*washPackageCredits[^`]*-\s*1/);
    // Must guard against negative balance (concurrency).
    expect(block).toMatch(/gt\s*\(\s*walletAccounts\.washPackageCredits\s*,\s*0\s*\)/);
  });

  it('wash_package redeem branch does NOT touch users.washBalance / customers.washBalance', () => {
    const idx = k9000Text.indexOf("case 'wash_package': {");
    const block = k9000Text.slice(idx, idx + 1500);
    // Legacy column names — must not appear inside the redeem branch.
    expect(block).not.toMatch(/users\.washBalance/);
    expect(block).not.toMatch(/customers\.washBalance/);
  });
});

describe('PR-W10 — global guard (no surprise legacy writers)', () => {
  it('the only files that increment users.washBalance / customers.washBalance live OUTSIDE the writer paths fixed by PR-W10', () => {
    // The audit identified exactly two writer sites; the fix removed
    // both. No NEW writer should appear in those two files.
    // We check by counting occurrences of an increment pattern.
    const incrementRegex = /washBalance\s*:\s*[^,}\n]*(\+|sql`[^`]*\+)/g;
    expect(nayaxText.match(incrementRegex) || []).toHaveLength(0);
    expect(routesText.match(incrementRegex) || []).toHaveLength(0);
  });
});
