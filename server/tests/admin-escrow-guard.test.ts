/**
 * Issue #148 / #153 P5 (admin-escrow mount) — regression pin.
 *
 * Before:
 *   - The /api/admin/escrow mount in routes.ts ran only `adminLimiter`.
 *     No `validateFirebaseToken`, so `req.firebaseUser` and the bridged
 *     `req.user.{uid,id,email}` were never populated.
 *   - The single mutation `POST /reconciliation/sync/:escrowId` writes to
 *     escrow_holdings (a money-path table) but emitted no canonical
 *     audit_events row.
 *
 * After:
 *   - The mount now runs `validateFirebaseToken` first, matching every
 *     other /api/admin/* mount in routes.ts.
 *   - The sync mutation emits ESCROW_RECONCILIATION_SYNC_CREATE or
 *     ESCROW_RECONCILIATION_SYNC_UPDATE depending on which path executes.
 *     Money math is untouched — only observation is added.
 *
 * Source-pin tests fail if either guarantee regresses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);
const ESCROW_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-escrow-reconciliation.ts'),
  'utf8',
);

describe('admin-escrow — Issue #148/#153 P5 regression pin', () => {
  it('mount applies validateFirebaseToken before adminLimiter', () => {
    expect(ROUTES_SRC).toMatch(
      /app\.use\(\s*['"]\/api\/admin\/escrow['"]\s*,\s*validateFirebaseToken\s*,\s*adminLimiter\s*,/,
    );
  });

  it('admin-escrow-reconciliation.ts imports logAuditEvent', () => {
    expect(ESCROW_SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('emits audit on the create branch of the sync mutation', () => {
    expect(ESCROW_SRC).toMatch(
      /actionType:\s*['"]ESCROW_RECONCILIATION_SYNC_CREATE['"]/,
    );
  });

  it('emits audit on the update branch of the sync mutation', () => {
    expect(ESCROW_SRC).toMatch(
      /actionType:\s*['"]ESCROW_RECONCILIATION_SYNC_UPDATE['"]/,
    );
  });

  it('audit emissions target escrow_holding domain', () => {
    expect(ESCROW_SRC).toMatch(/targetType:\s*['"]escrow_holding['"]/);
  });

  it('audit emissions use setImmediate fire-and-forget pattern', () => {
    const matches = ESCROW_SRC.match(
      /setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*?logAuditEvent\(/g,
    );
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT modify the existing escrow money math (commission/VAT formulas preserved)', () => {
    // Spot-check: the existing constants must remain.
    expect(ESCROW_SRC).toMatch(/const commissionPct = 0\.15/);
    expect(ESCROW_SRC).toMatch(/Math\.round\(platformFeeCents \* 0\.18\)/);
  });

  it('does NOT change the downgrade-protected status guard', () => {
    expect(ESCROW_SRC).toMatch(/DOWNGRADE_PROTECTED.*released.*refunded/s);
  });
});
