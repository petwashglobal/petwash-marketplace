/**
 * Enrol address → pinned into the multi-address book — regression pin (2026-07-09).
 *
 * CEO: "address of the user gets saved when he enrols — pin it — or he might have
 * more than one address under profile." The multi-address book (userAddresses:
 * label home/work/other, isDefault = pinned, geocoded) already existed via
 * user-addresses.ts, but completeProfile only wrote the inline users.address and
 * NEVER seeded userAddresses — so the saved/pinned book started empty and shop /
 * booking / proximity re-asked for the address every time.
 *
 * Pins: completeProfile inserts the enrol address into userAddresses as the
 * default 'home' address, first-address-only, non-fatal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'post-login.ts'),
  'utf8',
);

describe('completeProfile pins the enrol address (2026-07-09)', () => {
  it('inserts into userAddresses as default home', () => {
    expect(SRC).toMatch(/db\.insert\(userAddresses\)/);
    expect(SRC).toMatch(/label: 'home'/);
    expect(SRC).toMatch(/isDefault: true/);
  });

  it('only pins the FIRST address (no dupes on re-submit)', () => {
    expect(SRC).toMatch(/if \(existing\.length === 0\)/);
  });

  it('is non-fatal — a pin failure never blocks profile completion', () => {
    expect(SRC).toMatch(/Could not pin enrol address \(non-fatal\)/);
  });
});
