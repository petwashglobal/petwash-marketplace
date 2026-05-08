/**
 * Issue #153 PR-FINANCE-DASH — read-only finance visibility (Pillar D step 1).
 *
 * CEO-approved scope (locked):
 *   • pending_transfer queue        →  /api/admin/finance/pending-payouts
 *   • wallet drift status           →  /api/admin/finance/wallet-drift
 *   • escrow audit trail            →  /api/admin/finance/escrow-audit
 *   • CSV export                    →  /api/admin/finance/pending-payouts.csv
 *   • no money movement
 *   • no payout execution
 *   • no refund execution
 *   • no bank/Nayax runtime change
 *
 * Lane B-D dependency matrix flagged that even with all 4 absolute
 * blockers obtained (Nayax API, Israeli bank, ITA OAuth, manual UI),
 * finance + ops still need a SEEN-NOT-MOVED layer to monitor the
 * queue. This PR delivers exactly that — pure SELECT, admin-gated,
 * single-revert.
 *
 * Pure source-pin tests. No DB writes, no Express boot. Each handler
 * is anchored on its route literal and inspected in isolation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

/**
 * Helper: extract the body of an Express handler immediately after a
 * given route literal. Pinpoints `app.get('<route>', requireAdmin, async
 * (...) => { ... })` so each test reasons over only that handler.
 */
function extractHandler(route: string): string {
  const startMarker = `app.get('${route}', requireAdmin, async`;
  const idx = routes.indexOf(startMarker);
  if (idx < 0) throw new Error(`Route ${route} not found in routes.ts`);
  // Walk forward until the matching `});` for this handler. The simplest
  // heuristic is to slice a generous window — every handler in the
  // PR-FINANCE-DASH block is ≤ 80 lines.
  return routes.slice(idx, idx + 5000);
}

const ROUTES = {
  pendingPayouts:    '/api/admin/finance/pending-payouts',
  pendingPayoutsCsv: '/api/admin/finance/pending-payouts.csv',
  walletDrift:       '/api/admin/finance/wallet-drift',
  escrowAudit:       '/api/admin/finance/escrow-audit',
} as const;

// ── A. ROUTES REGISTERED + ADMIN-GATED ────────────────────────────────────

describe('PR-FINANCE-DASH — routes registered with requireAdmin', () => {
  for (const [label, route] of Object.entries(ROUTES)) {
    it(`registers ${route} (${label}) behind requireAdmin`, () => {
      const re = new RegExp(`app\\.get\\(\\s*['"]${route.replace(/[.\/]/g, m => '\\' + m)}['"]\\s*,\\s*requireAdmin\\s*,`);
      expect(routes).toMatch(re);
    });
  }
});

// ── B. EVERY HANDLER IS PURE READ — no INSERT / UPDATE / DELETE ───────────

describe('PR-FINANCE-DASH — every handler is read-only', () => {
  for (const [label, route] of Object.entries(ROUTES)) {
    it(`${route} (${label}) handler contains no db.insert / db.update / db.delete`, () => {
      const handler = extractHandler(route);
      // Inspect only the first ~80 lines of this handler so we don't
      // accidentally pick up a downstream handler's mutations.
      const window_ = handler.slice(0, 4000);
      expect(window_).not.toMatch(/db\.insert\(/);
      expect(window_).not.toMatch(/db\.update\(/);
      expect(window_).not.toMatch(/db\.delete\(/);
    });
  }

  it('no handler reaches into Nayax / bank / payout-execution surfaces', () => {
    // Defensive: pure visibility means we MUST NOT import the live
    // payout/refund services, the Nayax client, or any Tranzila /
    // Masav / bank-transfer module from these handlers.
    for (const route of Object.values(ROUTES)) {
      const handler = extractHandler(route).slice(0, 4000);
      expect(handler).not.toMatch(/ProviderPayoutService/);
      expect(handler).not.toMatch(/NayaxPaymentService/);
      expect(handler).not.toMatch(/processIsraeliBankTransfer/);
      expect(handler).not.toMatch(/MasavGenerator|masav/i);
      expect(handler).not.toMatch(/refundBookingPayment|sendRefund/);
    }
  });
});

// ── C. CONTENT-TYPE + LIMIT CLAMPS + WINDOW SAFETY ────────────────────────

describe('PR-FINANCE-DASH — operational guards', () => {
  it('pending-payouts ?limit clamps to a safe upper bound (≤ 1000)', () => {
    const handler = extractHandler(ROUTES.pendingPayouts);
    expect(handler).toMatch(/Math\.min\(\s*Number\(req\.query\.limit\)[^,]*,\s*1000\s*\)/);
  });

  it('pending-payouts.csv ?limit clamps higher (≤ 5000) and sets correct Content-Type/Disposition', () => {
    const handler = extractHandler(ROUTES.pendingPayoutsCsv);
    expect(handler).toMatch(/Math\.min\(\s*Number\(req\.query\.limit\)[^,]*,\s*5000\s*\)/);
    expect(handler).toMatch(/Content-Type[\s\S]{0,80}text\/csv/);
    expect(handler).toMatch(/Content-Disposition[\s\S]{0,80}attachment/);
  });

  it('escrow-audit query window is bounded (30 days) and ?limit clamps (≤ 1000)', () => {
    const handler = extractHandler(ROUTES.escrowAudit);
    expect(handler).toMatch(/30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(handler).toMatch(/Math\.min\(\s*Number\(req\.query\.limit\)[^,]*,\s*1000\s*\)/);
  });

  it('wallet-drift ?limit clamps (≤ 200)', () => {
    const handler = extractHandler(ROUTES.walletDrift);
    expect(handler).toMatch(/Math\.min\(\s*Number\(req\.query\.limit\)[^,]*,\s*200\s*\)/);
  });
});

// ── D. STATUS / ACTION-TYPE FILTERS PIN THE QUERY SHAPE ───────────────────

describe('PR-FINANCE-DASH — query shape pins', () => {
  it('pending-payouts filters status ∈ {pending_transfer, pending, processing}', () => {
    const handler = extractHandler(ROUTES.pendingPayouts);
    expect(handler).toMatch(/inArray\(\s*superAppPayouts\.status[\s\S]{0,200}'pending_transfer'/);
    expect(handler).toMatch(/'pending'/);
    expect(handler).toMatch(/'processing'/);
  });

  it('escrow-audit filters audit_events.actionType ∈ canonical escrow + payout transitions', () => {
    const handler = extractHandler(ROUTES.escrowAudit);
    expect(handler).toMatch(/'ESCROW_HOLD'/);
    expect(handler).toMatch(/'ESCROW_RELEASE'/);
    expect(handler).toMatch(/'ESCROW_REFUND'/);
    expect(handler).toMatch(/'PAYOUT_CREATED'/);
    expect(handler).toMatch(/'PAYOUT_RELEASED'/);
    expect(handler).toMatch(/'PAYOUT_FAILED'/);
    expect(handler).toMatch(/'PAYOUT_PENDING_TRANSFER'/);
  });

  it('wallet-drift queries walletReconciliationRuns ordered desc by createdAt', () => {
    const handler = extractHandler(ROUTES.walletDrift);
    expect(handler).toMatch(/walletReconciliationRuns/);
    expect(handler).toMatch(/desc\(\s*walletReconciliationRuns\.createdAt\s*\)/);
  });
});

// ── E. CSV ESCAPING + RESPONSE SHAPE PINS ─────────────────────────────────

describe('PR-FINANCE-DASH — CSV escape + response shape', () => {
  it('CSV escape function quotes any cell containing comma / quote / newline', () => {
    const handler = extractHandler(ROUTES.pendingPayoutsCsv);
    // The escape predicate must include comma, double-quote, and newline.
    expect(handler).toMatch(/\/\[",\\n\]\//);
    // Internal quotes are doubled per RFC 4180.
    expect(handler).toMatch(/replace\(\s*\/"\/g\s*,\s*['"]""['"]\s*\)/);
  });

  it('JSON responses include a count for quick ops checks', () => {
    for (const route of [ROUTES.pendingPayouts, ROUTES.escrowAudit]) {
      const handler = extractHandler(route);
      expect(handler).toMatch(/count:\s*rows\.length/);
    }
  });

  it('wallet-drift JSON exposes latest + windowSummary aggregates', () => {
    const handler = extractHandler(ROUTES.walletDrift);
    // `const latest = runs[0] ?? null;` then shorthand `{ latest }` in the JSON.
    expect(handler).toMatch(/const\s+latest\s*=\s*runs\[0\]/);
    expect(handler).toMatch(/windowSummary[\s\S]{0,200}driftedTotal/);
    expect(handler).toMatch(/healedTotal/);
    expect(handler).toMatch(/failedTotal/);
  });
});
