/**
 * PR-EGIFT-COMING-SOON-SERVICES — /egift no longer advertises
 * redemption on services that are not live.
 *
 * Fire-order item 5. The /egift service-toggle strip listed PetTrek
 * as a selectable redemption target, but the homepage labels
 * PetTrek "coming soon". Advertising redemption on a service that
 * cannot accept vouchers is dishonest and creates a support burden.
 *
 * Fix: an optional `comingSoon` flag on each platformServices entry.
 * The toggle button:
 *   - visually marks the service "Coming soon" / "בקרוב"
 *   - is disabled (aria-disabled + disabled attr)
 *   - cannot enter `selectedServices` (onClick early-returns)
 * The redeemable-at chip strip also filters out coming-soon services
 * as belt-and-braces defence against persisted / URL / default state
 * that already carries a coming-soon id.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-EGIFT-COMING-SOON-SERVICES', () => {
  const src = read(EGIFT);

  it('A1. platformServices entries can carry an optional comingSoon flag', () => {
    // The type annotation on the array pins the shape so a future
    // author can't forget the flag when adding a new service.
    expect(/const\s+platformServices\s*:\s*Array<\{[^}]*comingSoon\?\s*:\s*boolean[^}]*\}>/.test(src)).toBe(true);
  });

  it('A2. PetTrek is currently flagged comingSoon (matches homepage labelling)', () => {
    expect(/id:\s*['"]trek['"][^}]*comingSoon:\s*true/.test(src)).toBe(true);
  });

  it('A3. no other service is flagged comingSoon (only trek was called out)', () => {
    // Count total comingSoon:true — must be exactly 1.
    const count = (src.match(/comingSoon:\s*true/g) || []).length;
    expect(count).toBe(1);
  });

  it('A4. the toggle button is disabled + aria-disabled for a coming-soon service', () => {
    expect(/disabled=\{isComingSoon\}/.test(src)).toBe(true);
    expect(/aria-disabled=\{isComingSoon\}/.test(src)).toBe(true);
  });

  it('A5. clicking a disabled toggle does NOT enter selectedServices (early return)', () => {
    // The onClick guard: if (!isComingSoon) toggleService(service.id).
    expect(/onClick=\{[^}]*if\s*\(\s*!isComingSoon\s*\)\s*toggleService\(\s*service\.id\s*\)/.test(src)).toBe(true);
  });

  it('A6. selected state cannot be true for a coming-soon service', () => {
    // Even if selectedServices.includes(id) is true (persisted state),
    // isSelected must be gated on !service.comingSoon so the button
    // does not render as the "selected/active" style.
    expect(/const\s+isSelected\s*=\s*selectedServices\.includes\(\s*service\.id\s*\)\s*&&\s*!service\.comingSoon/.test(src)).toBe(true);
  });

  it('A7. the "Coming soon" tag renders (both languages, data-testid pin)', () => {
    expect(src).toContain('data-testid={`service-coming-soon-${service.id}`}');
    expect(src.includes('Coming soon')).toBe(true);
    expect(src.includes('בקרוב')).toBe(true);
  });

  it('A8. redeemable-at chip strip filters out coming-soon services (belt-and-braces)', () => {
    expect(/platformServices\.filter\(\s*s\s*=>\s*selectedServices\.includes\(\s*s\.id\s*\)\s*&&\s*!s\.comingSoon\s*\)/.test(src)).toBe(true);
  });
});
