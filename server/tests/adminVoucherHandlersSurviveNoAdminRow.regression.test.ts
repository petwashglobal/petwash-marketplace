import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19: voiding a voucher told the operator it FAILED, after it had
 * already succeeded.
 *
 *   await storage.updateEVoucher(voucherId, { status: 'CANCELLED' });  // lands
 *   logger.info('Admin: Voucher voided', { admin: req.adminUser.email }); // throws
 *   -> catch -> 500 "Failed to void voucher"
 *
 * `req.adminUser` is declared optional and is populated only when
 * storage.getAdminUser(uid) finds a row in admin_users. Nothing in the repo
 * ever inserts one: storage.createAdminUser has ZERO callers and no migration
 * contains an INSERT INTO admin_users. Admin identity here is Firebase
 * claim / allowlist based, so req.adminUser is undefined for a real admin.
 *
 * The handlers are typed (req: any, res), so TypeScript never checked it.
 *
 * The neighbouring handlers in the same file already used `req.adminUser?.` —
 * the absence case was known; these four lines simply missed it.
 *
 * Consequences before the fix:
 *   POST /vouchers/:id/void          voucher IS cancelled, operator sees 500
 *   POST /vouchers/generate-test     always 500
 *   GET  /vouchers/export            throws after res.send -> HEADERS_SENT
 */
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'server', 'routes.ts'), 'utf8');

describe('admin voucher handlers survive an admin with no admin_users row', () => {
  it('no handler dereferences req.adminUser without a guard', () => {
    const lines = src.split('\n');
    const bad = lines
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => /req\.adminUser\.(id|email|name)/.test(l))
      // a dereference inside `if (req.adminUser) { … }` is already safe
      .filter(({ n }) => !lines.slice(Math.max(0, n - 6), n - 1)
        .some((prev) => /if\s*\(\s*req\.adminUser\s*\)/.test(prev)));
    expect(
      bad.map(({ n, l }) => `routes.ts:${n} ${l.trim()}`),
      'req.adminUser is undefined for a real admin — this throws',
    ).toEqual([]);
  });

  it('the void handler logs after the write, so it must not be able to throw', () => {
    const i = src.indexOf("Admin: Voucher voided");
    expect(i).toBeGreaterThan(0);
    const block = src.slice(i - 400, i + 300);
    // the cancel really does land before the log line
    expect(block).toContain("updateEVoucher(voucherId, { status: 'CANCELLED' })");
    expect(block).toMatch(/req\.adminUser\?\./);
  });

  it('admin_users is still never populated — the guard is load-bearing', () => {
    // if someone starts inserting admin rows this test should be revisited,
    // but the guard stays correct either way
    const storage = fs.readFileSync(path.join(ROOT, 'server', 'storage.ts'), 'utf8');
    expect(storage).toContain('async createAdminUser');
    const callers = src.includes('createAdminUser(');
    expect(callers, 'routes.ts now calls createAdminUser — re-check this').toBe(false);
  });
});
