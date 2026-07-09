/**
 * Shop delivery form pre-fills the pinned location — regression pin (2026-07-09).
 *
 * The shop keeps its OWN delivery-address book (shop_delivery_addresses) because
 * shipping needs recipient name + phone + notes that the location book
 * (userAddresses) doesn't carry — so this is NOT a table merge (that would lose
 * shipping data). Instead the "add address" form pre-fills the LOCATION
 * (street/city/zip) from the user's pinned default userAddress, so the customer
 * doesn't re-type where they live; they still add name + phone for the courier.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'ShopStore.tsx'),
  'utf8',
);

describe('ShopStore pre-fills the pinned address location (2026-07-09)', () => {
  it('reads the saved address book and keeps the default', () => {
    expect(SRC).toMatch(/\/api\/user\/addresses/);
    expect(SRC).toMatch(/rows\.find\(\(a: any\) => a\.isDefault\)/);
  });

  it('pre-fills only empty street/city from the pinned address', () => {
    expect(SRC).toMatch(/if \(!addingAddress \|\| !pinnedAddr\) return/);
    expect(SRC).toMatch(/\(v\.street \|\| v\.city\) \? v :/);
  });
});
