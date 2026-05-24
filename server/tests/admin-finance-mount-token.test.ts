/**
 * Issue #153 PR-TAX-2 — /api/admin/finance/* validateFirebaseToken at mount.
 *
 * BEFORE this fix:
 *   server/routes.ts had five /api/admin/finance/* mounts running with
 *   `adminLimiter` only. The inner role checks (requireAdmin in
 *   tranzila-admin.ts, ['super_admin','finance'] in manual-adjustment.ts,
 *   isAdmin() in payout-reconciliation.ts and israel-compliance.ts,
 *   requireTreasuryRole in treasury-settings.ts) all read req.user?.role.
 *   Without validateFirebaseToken at the mount, req.user is not reliably
 *   populated before those inner checks fire. Israeli Tax/Invoice/Receipt/
 *   Payout audit (issue #153, comment 4401469403, P0-4) pinned this.
 *
 * AFTER this fix:
 *   Each of the five mounts is now
 *     app.use('/api/admin/finance/<route>',
 *             validateFirebaseToken, adminLimiter, <router>)
 *   matching the canonical admin-mount pattern used elsewhere in this
 *   file. The middleware order is intentional: token-validation first
 *   (cheap reject + req.user population), then rate-limit, then router.
 *   Inner role checks are PRESERVED — guard-only PR.
 *
 * This source-pin test fails if any of the eight guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

// /api/admin/finance/tranzila was DELETED 2026-05-24 with the Tranzila
// Option A kill. The remaining 4 mounts still carry the
// validateFirebaseToken + adminLimiter contract from Issue #153 PR-TAX-2.
const FINANCE_MOUNTS = [
  { path: '/api/admin/finance/adjustment',              router: 'manualAdjustmentRoutes' },
  { path: '/api/admin/finance/payout-reconciliation',   router: 'payoutReconciliationRoutes' },
  { path: '/api/admin/finance/israel-compliance',       router: 'israelComplianceRoutes' },
  { path: '/api/admin/finance/treasury',                router: 'treasurySettingsRoutes' },
] as const;

describe('Issue #153 PR-TAX-2 — /api/admin/finance/* validateFirebaseToken at mount', () => {
  for (const { path: mountPath, router } of FINANCE_MOUNTS) {
    it(`mounts ${mountPath} with validateFirebaseToken + adminLimiter + ${router}`, () => {
      // Pin the exact middleware order. Token-validation must run BEFORE
      // adminLimiter so unauthenticated requests are rejected before
      // burning rate-limit budget. The router argument anchors the mount
      // to the right handler module.
      const escaped = mountPath.replace(/\//g, '\\/');
      const re = new RegExp(
        `app\\.use\\(\\s*['"]${escaped}['"]\\s*,\\s*validateFirebaseToken\\s*,\\s*adminLimiter\\s*,\\s*${router}\\s*\\)`,
      );
      expect(ROUTES_SRC).toMatch(re);
    });

    it(`does NOT mount ${mountPath} with only adminLimiter (the pre-fix shape)`, () => {
      // Negative regex — protects against a future "cleanup" PR silently
      // dropping validateFirebaseToken from the chain.
      const escaped = mountPath.replace(/\//g, '\\/');
      const reBad = new RegExp(
        `app\\.use\\(\\s*['"]${escaped}['"]\\s*,\\s*adminLimiter\\s*,\\s*${router}\\s*\\)`,
      );
      expect(ROUTES_SRC).not.toMatch(reBad);
    });
  }

  it('routes.ts records the audit rationale above the cluster of /api/admin/finance/* mounts', () => {
    // Future agents must see WHY the chain looks like this. Anchor on the
    // PR ID and the audit citation.
    expect(ROUTES_SRC).toMatch(
      /Issue #153 PR-TAX-2[\s\S]{0,800}validateFirebaseToken at mount/,
    );
  });

  it('preserves the existing inner role-check pattern (guard-only PR)', () => {
    // The inner routers must continue to enforce role themselves; this PR
    // only adds the token-validation middleware. Pin that the routers are
    // still imported and referenced — no scope creep removing them.
    const FINANCE_IMPORTS = [
      // tranzilaAdminRoutes removed 2026-05-24 (Tranzila Option A kill)
      `manualAdjustmentRoutes from "./routes/finance/manual-adjustment"`,
      `payoutReconciliationRoutes from "./routes/finance/payout-reconciliation"`,
      `israelComplianceRoutes from "./routes/finance/israel-compliance"`,
      `treasurySettingsRoutes from "./routes/finance/treasury-settings"`,
    ];
    for (const sig of FINANCE_IMPORTS) {
      expect(ROUTES_SRC).toContain(sig);
    }
  });

  it('does NOT introduce any new direct app.post/app.get inside the cluster (no scope creep)', () => {
    // Find the rationale comment block, grab the cluster window, and prove
    // there is no raw app.post/app.get for /api/admin/finance/* paths added
    // alongside the mounts. Mount-only changes per the CEO directive.
    const cluster = ROUTES_SRC.match(
      /Issue #153 PR-TAX-2[\s\S]{0,2500}\/api\/admin\/finance\/treasury['"][^)]+\)/,
    )?.[0] ?? '';
    expect(cluster).not.toMatch(/app\.(post|get|put|patch|delete)\(\s*['"]\/api\/admin\/finance/);
  });
});
