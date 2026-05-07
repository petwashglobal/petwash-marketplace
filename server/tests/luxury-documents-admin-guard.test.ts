/**
 * Issue #153 PR-TAX-1 — /api/luxury-documents requireAdmin regression pin.
 *
 * BEFORE this fix:
 *   `server/routes.ts:10481` mounted /api/luxury-documents with only
 *     validateFirebaseToken + adminLimiter
 *   The handler at server/routes/luxury-documents.ts:18 (POST /send-samples)
 *   had NO per-handler auth middleware. Combined, ANY authenticated Firebase
 *   user could call POST /api/luxury-documents/send-samples with an
 *   arbitrary `email` in the body and have the server email the "luxury
 *   sample document" pack to that address — a data-exfiltration and
 *   brand-abuse vector. Israeli Tax / Invoice / Receipt / Payout audit
 *   (issue #153, comment 4401469403, P0-3) pinned this.
 *
 * AFTER this fix:
 *   The mount is
 *     app.use('/api/luxury-documents',
 *             validateFirebaseToken, adminLimiter, requireAdmin,
 *             luxuryDocumentsRoutes)
 *   matching the canonical admin-document mount pattern used elsewhere in
 *   this file (e.g. /api/admin/coupons, /api/billing). The four-middleware
 *   order is intentional: token first (cheap reject), then rate-limit, then
 *   role guard, then router.
 *
 * This source-pin test fails if any of the five guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);
const LUXURY_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'luxury-documents.ts'),
  'utf8',
);

describe('Issue #153 PR-TAX-1 — /api/luxury-documents admin guard', () => {
  it('mounts /api/luxury-documents with validateFirebaseToken + adminLimiter + requireAdmin', () => {
    expect(ROUTES_SRC).toMatch(
      /app\.use\(\s*['"]\/api\/luxury-documents['"]\s*,\s*validateFirebaseToken\s*,\s*adminLimiter\s*,\s*requireAdmin\s*,\s*luxuryDocumentsRoutes\s*\)/,
    );
  });

  it('does NOT mount /api/luxury-documents with only validateFirebaseToken + adminLimiter (the pre-fix shape)', () => {
    // Reject the prior shape so a future "cleanup" PR cannot silently relax
    // the chain. The negative regex anchors on the old pattern (no
    // requireAdmin between adminLimiter and the router argument).
    expect(ROUTES_SRC).not.toMatch(
      /app\.use\(\s*['"]\/api\/luxury-documents['"]\s*,\s*validateFirebaseToken\s*,\s*adminLimiter\s*,\s*luxuryDocumentsRoutes\s*\)/,
    );
  });

  it('routes.ts comment block above the mount records the audit rationale', () => {
    // Future agents must see WHY the chain looks like this. The audit
    // citation prevents an accidental relaxation.
    expect(ROUTES_SRC).toMatch(
      /Issue #153 PR-TAX-1[\s\S]{0,800}\/api\/luxury-documents/,
    );
    expect(ROUTES_SRC).toMatch(/data exfiltration/);
  });

  it('luxury-documents.ts handlers do NOT introduce a public bypass', () => {
    // The fix relies entirely on the mount-level guard. If a handler is
    // added with a raw app.use / app.post elsewhere, the mount guard would
    // not apply. Pin that the file uses the standard `router` pattern only.
    expect(LUXURY_SRC).not.toMatch(/app\.(use|post|get|put|patch|delete)\b/);
    expect(LUXURY_SRC).toMatch(/^const\s+router\s*=\s*Router\(\)/m);
  });

  it('luxury-documents send-samples handler still exists (no accidental delete)', () => {
    // The audit explicitly identified POST /send-samples as the abuse
    // vector. The fix is to gate it, not delete it. Pin its presence.
    expect(LUXURY_SRC).toMatch(/router\.post\(\s*['"]\/send-samples['"]/);
  });
});
