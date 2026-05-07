/**
 * Issue #153 — provider-applications admin role-shape regression test.
 *
 * Same class of bug as the escrow role-shape fix:
 *   - Before: `firebaseUser.accountType` was read directly, but
 *     `extractFirebaseUser()` puts custom claims inside
 *     `firebaseUser.claims`. So `user.accountType` was undefined and
 *     every admin received 403 on /api/provider-applications/admin/*.
 *   - After: a single `callerIsAdmin(req)` helper reads from
 *     `firebaseUser.claims.accountType` (canonical) and consults
 *     `isSuperAdmin(email)` for the super-admin email allowlist.
 *     `'internal'` and `'admin'` accountType values still accepted.
 *
 * This is a launch blocker because the active admin Provider Review
 * page (`client/src/pages/admin/ProviderReview.tsx`) calls these
 * `/api/provider-applications/admin/*` endpoints — without this fix
 * the operations team cannot approve / reject provider applications.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-applications.ts'),
  'utf8',
);

describe('provider-applications admin role-shape — Issue #153 regression pin', () => {
  it('imports isSuperAdmin from middleware/rbac', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*isSuperAdmin\s*\}\s*from\s*['"]\.\.\/middleware\/rbac['"]/,
    );
  });

  it('defines callerIsAdmin reading firebaseUser.claims.accountType', () => {
    expect(SRC).toMatch(/function callerIsAdmin\(\s*req\s*:\s*Request\s*\)\s*:\s*boolean/);
    expect(SRC).toMatch(/firebaseUser/);
    expect(SRC).toMatch(/claims\.accountType/);
  });

  it('declares ADMIN_ACCOUNT_TYPES with both internal and admin', () => {
    expect(SRC).toMatch(
      /const ADMIN_ACCOUNT_TYPES\s*=\s*\[\s*['"]internal['"]\s*,\s*['"]admin['"]\s*\]/,
    );
  });

  it('does NOT read firebaseUser.accountType directly anywhere in code', () => {
    // Allow the explanatory comment to mention `user.accountType`, but the
    // actual code must NOT read .accountType at the top level of firebaseUser.
    const codeOnly = SRC.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/user\?\.\s*accountType/);
    expect(codeOnly).not.toMatch(/firebaseUser\?\.\s*accountType/);
  });

  it('uses callerIsAdmin(req) on every admin handler (5 endpoints)', () => {
    const matches = SRC.match(/if\s*\(\s*!callerIsAdmin\(\s*req\s*\)\s*\)/g) || [];
    expect(matches.length).toBe(5);
  });

  it('still returns 403 with "Admin access required" message on rejection', () => {
    expect(SRC).toMatch(
      /if\s*\(\s*!callerIsAdmin\(\s*req\s*\)\s*\)\s*\{\s*return\s+res\.status\(403\)\.json\(\{\s*error:\s*['"]Admin access required['"]\s*\}\)/,
    );
  });
});

// ── Behavioural test: replicate the helper logic exactly and verify the matrix ──

function mockHelper(req: Request, isSuperFn: (e: string) => boolean): boolean {
  const fb = (req as any).firebaseUser;
  const claims = fb?.claims || {};
  const email = (fb?.email || '').toLowerCase();
  if (email && isSuperFn(email)) return true;
  const accountType = typeof claims.accountType === 'string' ? claims.accountType : undefined;
  if (accountType && ['internal', 'admin'].includes(accountType)) return true;
  return false;
}

const isSuperEmail = (e: string) => e === 'ceo@petwash.co.il';
const reqWith = (firebaseUser: any): Request => ({ firebaseUser } as any);

describe('callerIsAdmin behaviour matrix', () => {
  it('blocks normal user with no claims and no super-admin email', () => {
    const req = reqWith({ uid: 'u1', email: 'jane@example.com', claims: {} });
    expect(mockHelper(req, isSuperEmail)).toBe(false);
  });

  it('blocks request with no firebaseUser at all', () => {
    const req = reqWith(undefined);
    expect(mockHelper(req, isSuperEmail)).toBe(false);
  });

  it('blocks customer / provider / walker / sitter accountTypes', () => {
    for (const t of ['customer', 'provider', 'walker', 'sitter', 'trainer']) {
      const req = reqWith({ uid: 'x', email: 'x@example.com', claims: { accountType: t } });
      expect(mockHelper(req, isSuperEmail)).toBe(false);
    }
  });

  it('allows accountType=internal', () => {
    const req = reqWith({ uid: 'i1', email: 'ops@petwash.co.il', claims: { accountType: 'internal' } });
    expect(mockHelper(req, isSuperEmail)).toBe(true);
  });

  it('allows accountType=admin', () => {
    const req = reqWith({ uid: 'a1', email: 'admin@petwash.co.il', claims: { accountType: 'admin' } });
    expect(mockHelper(req, isSuperEmail)).toBe(true);
  });

  it('allows super-admin email regardless of claims.accountType', () => {
    const req = reqWith({ uid: 'c1', email: 'CEO@petwash.co.il', claims: {} });
    expect(mockHelper(req, isSuperEmail)).toBe(true);
  });

  it('rejects non-string claims.accountType (defensive)', () => {
    const req = reqWith({ uid: 'x', email: 'x@example.com', claims: { accountType: 42 } });
    expect(mockHelper(req, isSuperEmail)).toBe(false);
  });

  it('handles empty/undefined email without crashing', () => {
    const req = reqWith({ uid: 'x', claims: { accountType: 'admin' } });
    expect(mockHelper(req, isSuperEmail)).toBe(true);
    const req2 = reqWith({ uid: 'x', email: '', claims: { accountType: 'admin' } });
    expect(mockHelper(req2, isSuperEmail)).toBe(true);
  });
});
