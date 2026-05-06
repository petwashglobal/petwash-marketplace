/**
 * Issue #148 P5 (admin-loyalty mount) — regression pin.
 *
 * Before: 16 handlers each repeated `requireAdmin` as an inline middleware
 * arg. Any future handler added without that arg silently bypassed the
 * super-admin email check. The audit middleware was also already in place
 * but ran AFTER role rejection due to its status-code filter.
 *
 * After:
 *   - `router.use(requireAdmin)` applies the super-admin guard at router
 *     level; future handlers are protected by default.
 *   - The 16 inline args were removed (no behaviour change; same fn now
 *     called once at router level instead of 16 times).
 *   - The existing `adminLoyaltyAuditMiddleware` still emits canonical
 *     audit_events on all mutations (PR-W34d coverage preserved).
 *
 * Source-pin tests fail if any guarantee regresses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-loyalty.ts'),
  'utf8',
);

describe('admin-loyalty — Issue #148 P5 regression pin', () => {
  it('applies requireAdmin as router-level middleware', () => {
    expect(SRC).toMatch(/router\.use\(\s*requireAdmin\s*\)/);
  });

  it('does NOT pass requireAdmin per handler', () => {
    expect(SRC).not.toMatch(/router\.(get|post|put|patch|delete)\([^)]+,\s*requireAdmin\s*,/);
  });

  it('still defines the local requireAdmin (super-admin email check)', () => {
    expect(SRC).toMatch(/function requireAdmin\([^)]*\)\s*\{[\s\S]*isSuperAdmin\(/);
  });

  it('still uses isSuperAdmin from middleware/rbac (super-admin contract preserved)', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*isSuperAdmin\s*\}\s*from\s*['"]\.\.\/middleware\/rbac['"]/,
    );
  });

  it('still mounts adminLoyaltyAuditMiddleware (PR-W34d audit coverage preserved)', () => {
    expect(SRC).toMatch(/router\.use\(\s*adminLoyaltyAuditMiddleware\s*\)/);
  });

  it('still imports logAuditEvent (canonical audit sink)', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });
});
