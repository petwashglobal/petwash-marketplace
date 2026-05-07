/**
 * Issue #153 PR-B — /api/billing admin guard regression pin.
 *
 * BEFORE this fix:
 *   `server/routes.ts:9663` mounted /api/billing with `adminLimiter` only.
 *   No `validateFirebaseToken`, no `requireAdmin`. The file header at
 *   `server/routes/billing.ts:1-15` literally claims
 *     "All routes require admin role (payment events are system-internal)"
 *   but the mount disagreed. POST /payment-captured trusted req.body.grossAgorot
 *   to mint ITA tax invoices. None of the 7 router handlers in billing.ts
 *   carried per-handler auth — they all relied on the mount.
 *
 * AFTER this fix:
 *   The mount is `app.use('/api/billing', validateFirebaseToken, adminLimiter,
 *   requireAdmin, billingRoutes.default)`, mirroring the canonical admin-
 *   surface pattern already used at `/api/admin/coupons` (server/routes.ts
 *   line ~9535). No billing logic, VAT pipeline, allocation logic, refund
 *   math, dispute flow, payment processor, or schema changes.
 *
 * This source-pin test fails if any of the following regresses:
 *   1. The mount on /api/billing carries validateFirebaseToken
 *   2. The mount on /api/billing carries requireAdmin
 *   3. The original adminLimiter is preserved (rate-limit defense in depth)
 *   4. None of the 7 billing handlers were silently moved out of the router
 *      (so the mount-level guard still covers everything)
 *   5. billing.ts header still asserts the admin-role contract
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);
const BILLING_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'billing.ts'),
  'utf8',
);

describe('Issue #153 PR-B — /api/billing admin guard', () => {
  it('mounts /api/billing with validateFirebaseToken + adminLimiter + requireAdmin', () => {
    // Single regex that anchors all three middlewares in the correct order.
    // adminLimiter must remain so the rate-limit + role-guard pair stays
    // canonical. validateFirebaseToken before adminLimiter so unauthenticated
    // requests are rejected before consuming rate-limit budget.
    expect(ROUTES_SRC).toMatch(
      /app\.use\(\s*['"]\/api\/billing['"]\s*,\s*validateFirebaseToken\s*,\s*adminLimiter\s*,\s*requireAdmin\s*,\s*billingRoutes\.default\s*\)/,
    );
  });

  it('does NOT mount /api/billing with adminLimiter alone (the pre-fix shape)', () => {
    // Reject the prior shape: app.use('/api/billing', adminLimiter, billingRoutes.default);
    expect(ROUTES_SRC).not.toMatch(
      /app\.use\(\s*['"]\/api\/billing['"]\s*,\s*adminLimiter\s*,\s*billingRoutes\.default/,
    );
  });

  it('billing.ts header still asserts the admin-role contract', () => {
    expect(BILLING_SRC).toMatch(/All routes require admin role/);
  });

  it('all 7 billing handlers remain inside the same router (mount-level guard covers them)', () => {
    // If a future PR moves a handler out of `router` into a direct app.post,
    // the mount-level guard would no longer apply. Pin the canonical handler
    // names so any reorganisation that loses one is caught.
    expect(BILLING_SRC).toMatch(/router\.post\(\s*["']\/payment-captured["']/);
    expect(BILLING_SRC).toMatch(/router\.post\(\s*["']\/service-completed["']/);
    expect(BILLING_SRC).toMatch(/router\.post\(\s*["']\/refund["']/);
    expect(BILLING_SRC).toMatch(/router\.post\(\s*["']\/dispute["']/);
    expect(BILLING_SRC).toMatch(/router\.get\(\s*["']\/booking\/:bookingId["']/);
    expect(BILLING_SRC).toMatch(/router\.get\(\s*["']\/record\/:recordId["']/);
    expect(BILLING_SRC).toMatch(/router\.get\(\s*["']\/record\/:recordId\/audit["']/);
  });

  it('billing.ts handlers do NOT silently re-enable a public path', () => {
    // No raw `app.use` or `app.post` for /api/billing routes elsewhere in
    // billing.ts (would bypass the new mount guard). The router pattern
    // is the only public surface.
    expect(BILLING_SRC).not.toMatch(/app\.(use|post|get|put|patch|delete)/);
  });

  it('routes.ts comment block above the mount records the rationale', () => {
    // Future agents must see WHY the guard chain looks like this — defense
    // against accidental relaxation in a "cleanup" PR.
    expect(ROUTES_SRC).toMatch(
      /Issue #153 PR-B[\s\S]{0,500}All routes require admin role/,
    );
  });
});
