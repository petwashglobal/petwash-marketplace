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

  // UPDATED for the #240 migration. These two assertions used to demand the
  // bare `isSuperAdmin(` shape. That shape is the audit-199 DEFECT: a match
  // on the email STRING alone, which an unverified Firebase account under an
  // unclaimed allowlisted address clears. admin-loyalty.ts was migrated to
  // isSuperAdminVerified (allowlist AND email_verified === true), so the pin
  // began FAILING AGAINST THE FIXED CODE — it was pinning the vulnerability
  // in place and telling the next agent to restore it. Re-pointed at the
  // correct shape; the guarantee (the local requireAdmin still gates on the
  // canonical rbac super-admin primitive) is unchanged.
  it('still defines the local requireAdmin (verified super-admin check)', () => {
    expect(SRC).toMatch(/function requireAdmin\([^)]*\)\s*\{[\s\S]*isSuperAdminVerified\(/);
  });

  it('still uses isSuperAdminVerified from middleware/rbac (super-admin contract preserved)', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*isSuperAdminVerified\s*\}\s*from\s*['"]\.\.\/middleware\/rbac['"]/,
    );
  });

  it('does NOT fall back to the bare allowlist primitive', () => {
    expect(SRC).not.toMatch(/[^A-Za-z]isSuperAdmin\s*\(/);
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
