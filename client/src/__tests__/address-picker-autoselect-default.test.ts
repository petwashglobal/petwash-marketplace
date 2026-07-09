/**
 * AddressPicker auto-selects the pinned default — regression pin (2026-07-09).
 *
 * The saved multi-address book (userAddresses, isDefault = pinned) now gets an
 * address at enrol (#1346), but AddressPicker only LISTED saved addresses and made
 * the user tap one — booking/shop re-asked every time. Now the picker pre-fills the
 * default address once (Rover/Uber behaviour), without bumping usageCount, only
 * when the parent has no value yet. Fixing it in the shared component flows to
 * every consumer (sitter + walk booking flows today).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'ui', 'address-picker.tsx'),
  'utf8',
);

describe('AddressPicker pre-fills the pinned default address (2026-07-09)', () => {
  it('finds and selects the isDefault saved address', () => {
    expect(SRC).toMatch(/savedAddresses\.find\(\(a\) => a\.isDefault\)/);
    expect(SRC).toMatch(/onChange\(def\.address, place\)/);
  });

  it('only auto-selects once and never when the parent already has a value', () => {
    expect(SRC).toMatch(/autoSelectedRef/);
    expect(SRC).toMatch(/if \(value\) \{ autoSelectedRef\.current = true; return; \}/);
  });
});
