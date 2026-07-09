/**
 * Dead customer-facing route links — regression pin (2026-07-09).
 *
 * A 3-agent section sweep found four navigation targets that fall through to the
 * NotFound catch-all (guaranteed 404 for a real customer):
 *  - PrestigeHome "5 Wash Package · Buy Now" → /buy-package  (only /packages exists)
 *  - PrestigeHome "Next Booking" card        → /my-bookings  (only /bookings exists)
 *  - PetPassportHome "Medical records" tile  → /pet-documents (only /documents exists)
 *  - PetPassportHome "Documents" bottom-nav  → /pet-documents (only /documents exists)
 * All four now point at the real, registered routes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const pagesDir = path.resolve(__dirname, '..', 'pages');
const PRESTIGE = fs.readFileSync(path.join(pagesDir, 'PrestigeHome.tsx'), 'utf8');
const PASSPORT = fs.readFileSync(path.join(pagesDir, 'PetPassportHome.tsx'), 'utf8');
const APP = fs.readFileSync(path.resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('no customer nav points at unrouted (404) targets (2026-07-09)', () => {
  it('PrestigeHome dead links are gone', () => {
    expect(PRESTIGE).not.toMatch(/['"]\/buy-package['"]/);
    expect(PRESTIGE).not.toMatch(/['"]\/my-bookings['"]/);
  });

  it('PetPassportHome dead link is gone', () => {
    expect(PASSPORT).not.toMatch(/\/pet-documents/);
  });

  it('the replacement routes actually exist in App.tsx', () => {
    expect(APP).toMatch(/path="\/packages"/);
    expect(APP).toMatch(/path="\/bookings"/);
    expect(APP).toMatch(/path="\/documents"/);
  });
});
