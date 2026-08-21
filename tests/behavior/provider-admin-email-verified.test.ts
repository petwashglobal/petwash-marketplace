/**
 * Regression pin — callerIsAdmin in provider-applications.ts must gate the
 * super-admin email allowlist on Firebase-verified email.
 *
 * Evil-hunt 2026-08-20: an attacker who registers an account with an email
 * matching SUPER_ADMIN_EMAILS but does NOT verify it could otherwise
 * approve/reject any provider application (routes at admin/approve,
 * admin/reject, admin/advance-stage, admin/service-approve).
 *
 * The full behavioral proof lives in server/tests for the
 * `isSuperAdminVerified` helper itself (rbac.ts). This test pins that
 * the provider-applications caller uses THAT helper, not the raw
 * `isSuperAdmin(email)` primitive that skips email_verified.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server/routes/provider-applications.ts'),
  'utf8',
);

describe('provider-applications callerIsAdmin — email_verified required for allowlist', () => {
  it('imports isSuperAdminVerified from middleware/rbac', () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\bisSuperAdminVerified\b[^}]*\}\s*from\s*['"][^'"]*middleware\/rbac['"]/,
    );
  });

  it('callerIsAdmin body calls isSuperAdminVerified(req), not raw isSuperAdmin(email)', () => {
    const m = src.match(/function callerIsAdmin\(req: Request\): boolean \{([\s\S]*?)^}/m);
    expect(m, 'callerIsAdmin must exist').toBeTruthy();
    const body = m![1];
    // The verified check must be present.
    expect(body).toMatch(/isSuperAdminVerified\(\s*req\s*\)/);
    // The raw allowlist-only check must NOT be present on an email string in
    // the function body (that's the bug).
    // Allow the string "isSuperAdmin(email)" only inside comments (line 1115
    // docstring). Body must not have the CALL form.
    const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/isSuperAdmin\(\s*email\s*\)/);
  });

  it('accountType custom-claim path is preserved (server-controlled claims stay valid)', () => {
    const m = src.match(/function callerIsAdmin\(req: Request\): boolean \{([\s\S]*?)^}/m);
    const body = m![1];
    expect(body).toMatch(/ADMIN_ACCOUNT_TYPES/);
    expect(body).toMatch(/claims\.accountType/);
  });
});
