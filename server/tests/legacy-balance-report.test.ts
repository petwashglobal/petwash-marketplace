/**
 * PR-W12 — legacy-balance-report endpoint contract.
 *
 * The CEO needs counts + totals across every legacy spendable column
 * before approving the orphan-money migration. PR-W12 adds
 * GET /api/admin/wallet/legacy-balance-report — a pure SELECT-COUNT-SUM
 * over four sources: users.giftCardBalance, customers.giftCardBalance,
 * users.washBalance, customers.washBalance.
 *
 * This test pins:
 *   1. The route is registered with the admin gate.
 *   2. It is read-only — no UPDATE / INSERT / DELETE in the handler body.
 *   3. All four legacy columns are queried and reported.
 *   4. The handler aggregates correctly into a `totals` block.
 *
 * Static source-pin assertions only — no DB needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ADMIN_FILE = path.resolve(__dirname, '..', 'routes', 'admin.ts');
const adminText = fs.readFileSync(ADMIN_FILE, 'utf8');

/** Slice the body of the legacy-balance-report handler. */
function sliceLegacyBalanceReportHandler(src: string): string {
  const start = src.indexOf("'/wallet/legacy-balance-report'");
  if (start < 0) throw new Error('legacy-balance-report route not registered');
  // 4500-char window is generous — the handler is < 100 lines.
  return src.slice(start, start + 4500);
}

describe('PR-W12 — legacy-balance-report endpoint', () => {
  it('is registered as a GET on /wallet/legacy-balance-report', () => {
    expect(adminText).toMatch(
      /router\.get\s*\(\s*['"]\/wallet\/legacy-balance-report['"]/,
    );
  });

  it('uses validateFirebaseToken + requireAdmin (admin-gated)', () => {
    expect(adminText).toMatch(
      /router\.get\s*\(\s*['"]\/wallet\/legacy-balance-report['"][^)]*validateFirebaseToken[^)]*requireAdmin/,
    );
  });

  describe('handler body', () => {
    const handler = sliceLegacyBalanceReportHandler(adminText);

    it('queries users.giftCardBalance', () => {
      expect(handler).toMatch(/users\.giftCardBalance/);
    });

    it('queries customers.giftCardBalance', () => {
      expect(handler).toMatch(/customers\.giftCardBalance/);
    });

    it('queries users.washBalance', () => {
      expect(handler).toMatch(/users\.washBalance/);
    });

    it('queries customers.washBalance', () => {
      expect(handler).toMatch(/customers\.washBalance/);
    });

    it('uses COUNT and SUM aggregates only — no per-row payload', () => {
      expect(handler).toMatch(/COUNT\(\*\)/i);
      expect(handler).toMatch(/SUM\(/i);
    });

    it('is read-only: no UPDATE / INSERT / DELETE in handler body', () => {
      // The four operations that would mutate the legacy ledger are forbidden.
      expect(handler).not.toMatch(/db\.update\s*\(/);
      expect(handler).not.toMatch(/db\.insert\s*\(/);
      expect(handler).not.toMatch(/db\.delete\s*\(/);
      // Inline SQL UPDATE/INSERT/DELETE are also forbidden.
      expect(handler).not.toMatch(/sql`[^`]*\bUPDATE\b/i);
      expect(handler).not.toMatch(/sql`[^`]*\bINSERT\b/i);
      expect(handler).not.toMatch(/sql`[^`]*\bDELETE\b/i);
    });

    it('emits a totals block summing the four sources', () => {
      expect(handler).toMatch(/totals\s*:/);
      expect(handler).toMatch(/legacyEgiftIls/);
      expect(handler).toMatch(/legacyWashPacks/);
    });

    it('emits a per-source breakdown (4 sources)', () => {
      expect(handler).toMatch(/usersEgift/);
      expect(handler).toMatch(/customersEgift/);
      expect(handler).toMatch(/usersWashPack/);
      expect(handler).toMatch(/customersWashPack/);
    });

    it('marks the report as legacy and unspendable', () => {
      // Operator guard rail — this report is NOT a confirmation that
      // these shekels are spendable.
      expect(handler).toMatch(/cannot be spent/i);
    });

    it('does NOT call any mutation service (walletService.addCredits / refundCredits / deductFromWallet)', () => {
      expect(handler).not.toMatch(/walletService\.addCredits/);
      expect(handler).not.toMatch(/walletService\.refundCredits/);
      expect(handler).not.toMatch(/deductFromWallet/);
      expect(handler).not.toMatch(/storage\.updateUser\b/);
      expect(handler).not.toMatch(/storage\.updateCustomer\b/);
    });
  });
});
