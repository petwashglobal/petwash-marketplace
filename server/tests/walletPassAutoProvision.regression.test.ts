/**
 * Wallet pass auto-provision — fixes "wallet id still has issues": members had no
 * petwash_pass_accounts row, so the Wallet URL was always null. ensurePassAccount
 * get-or-creates the pass so the URL + in-app QR card work. Source-introspection
 * (DB-runtime-bound), per repo convention.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'routes', 'prestige-pass.ts'), 'utf8');

describe('wallet pass auto-provision', () => {
  it('defines a get-or-create ensurePassAccount', () => {
    expect(src).toMatch(/async function ensurePassAccount\(userId: string\)/);
    expect(src).toMatch(/if \(existing\?\.passId\) return existing/); // get
    expect(src).toMatch(/db\.insert\(petwashPassAccounts\)\.values\(/);   // create
  });

  it('fills the NOT-NULL pass fields (passId, ownerName, appleSerialNumber, googleObjectId)', () => {
    expect(src).toMatch(/passId, userId, ownerName, ownerEmail/);
    expect(src).toMatch(/appleSerialNumber/);
    expect(src).toMatch(/googleObjectId/);
  });

  it('is idempotent + collision-safe (onConflictDoNothing + re-select by userId)', () => {
    expect(src).toMatch(/\.onConflictDoNothing\(\)/);
    expect(src).toMatch(/Re-select by userId/);
  });

  it('the wallet URL builder uses it (no more null for members)', () => {
    expect(src).toMatch(/const acc = await ensurePassAccount\(userId\)/);
  });
});
