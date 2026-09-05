/**
 * PATCH /api/user/addresses/:id — default-address swap safety.
 *
 * TWO defects, one shipped in this PR and one found reviewing it.
 *
 * 1. (fixed by this PR) The handler cleared isDefault on ALL of the caller's
 *    addresses BEFORE checking whether `id` belonged to them or existed. A
 *    bogus id — stale after a delete, a double-tap race, a client bug — still
 *    404'd, but only AFTER the caller's real default had been wiped. The user
 *    was left with no default and no error explaining it.
 *
 * 2. (found in review, 2026-09-06) Even with the ownership pre-check, the swap
 *    was two independent statements: clear-all, then set-one. If the second
 *    failed after the first committed, the address book again ended with NO
 *    default. Both statements now run in one transaction.
 *
 * The invariant both defects violate: a request that does not succeed must
 * leave the address book EXACTLY as it was.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'user-addresses.ts'),
  'utf8',
);

/** The PATCH /:id handler body, so assertions can't be satisfied by another route. */
const PATCH_HANDLER = (() => {
  const start = SRC.indexOf('router.patch("/:id"');
  expect(start).toBeGreaterThan(-1);
  const next = SRC.indexOf('router.', start + 10);
  return SRC.slice(start, next === -1 ? SRC.length : next);
})();

describe('default-address swap — ownership is checked before anything destructive', () => {
  it('the ownership SELECT appears before the clear-all UPDATE', () => {
    const ownershipCheck = PATCH_HANDLER.indexOf('.select({ id: userAddresses.id })');
    const clearAll = PATCH_HANDLER.indexOf('set({ isDefault: false })');
    expect(ownershipCheck).toBeGreaterThan(-1);
    expect(clearAll).toBeGreaterThan(-1);
    expect(ownershipCheck).toBeLessThan(clearAll);
  });

  it('a non-owned / missing id short-circuits without clearing anything', () => {
    // The guard must sit between the SELECT and the clear-all.
    const guard = PATCH_HANDLER.indexOf('if (!owned)');
    const clearAll = PATCH_HANDLER.indexOf('set({ isDefault: false })');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(clearAll);
  });
});

describe('default-address swap — clear and set are atomic', () => {
  it('the swap runs inside db.transaction', () => {
    expect(PATCH_HANDLER).toMatch(/await db\.transaction\(async \(tx\) => \{/);
  });

  it('BOTH the clear and the set use the transaction handle, not the pool', () => {
    // A statement left on `db` inside the transaction block would commit
    // independently — the exact failure mode this guards against.
    const txBlock = PATCH_HANDLER.slice(PATCH_HANDLER.indexOf('db.transaction'));
    expect(txBlock).toMatch(/tx\.update\(userAddresses\)\.set\(\{ isDefault: false \}\)/);
    expect(txBlock).toMatch(/tx\s*\.update\(userAddresses\)\s*\.set\(data\)/);
    // No bare `await db.update(` may remain inside the transaction body.
    const bodyEnd = txBlock.indexOf('});');
    expect(txBlock.slice(0, bodyEnd)).not.toMatch(/await db\.update\(/);
  });

  it('still 404s when the row is not the caller\'s', () => {
    expect(PATCH_HANDLER).toMatch(/if \(!updated\) return res\.status\(404\)/);
  });
});
