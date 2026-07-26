/**
 * Regression pin — customer→provider contact (2026-07-26, task #5).
 *
 * The provider phone is released ONLY to the booking owner, ONLY for an active
 * booking, via a dedicated endpoint — never embedded in the bookings list.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(join(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');
const clientBtn = readFileSync(join(__dirname, '..', '..', 'client', 'src', 'components', 'ProviderContactButton.tsx'), 'utf8');

describe('provider-contact gate', () => {
  it('exposes GET /:requestId/provider-contact', () => {
    expect(route).toMatch(/router\.get\('\/:requestId\/provider-contact'/);
  });
  it('is owner-only', () => {
    const seg = route.slice(route.indexOf("'/:requestId/provider-contact'"));
    expect(seg.slice(0, 900)).toMatch(/booking\.ownerId !== userId/);
  });
  it('refuses non-active bookings (NOT_CONTACTABLE)', () => {
    const seg = route.slice(route.indexOf("'/:requestId/provider-contact'"));
    expect(seg.slice(0, 1200)).toMatch(/NOT_CONTACTABLE/);
    expect(seg.slice(0, 1200)).toMatch(/CONTACTABLE\.has\(String\(booking\.status\)\)/);
  });
  it('client fetches on demand (phone never in the list payload)', () => {
    expect(clientBtn).toMatch(/\/provider-contact/);
    expect(clientBtn).toMatch(/onClick=\{load\}/);
  });
});
