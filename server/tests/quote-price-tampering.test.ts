/**
 * Booking price-tampering: the server must NEVER charge a client-supplied total.
 *
 * POST /api/booking-requests accepted `finalQuote` (schema: z.any()) and, for a
 * quote younger than 10 minutes, charged `fq.totals.totalCents` VERBATIM with no
 * server recompute. A client could POST `totals.totalCents: 1` with a fresh
 * `quotedAt` and book a multi-day, multi-pet sitting for ₪0.01.
 *
 * Fix: always re-run calculateQuote server-side and use ITS totals; the client
 * total is display-only (used only to detect divergence → 409). Source-
 * introspection guard so the trust-the-client regression can't come back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'),
  'utf8',
);

describe('booking-requests — never trust client quote totals', () => {
  it('assigns the charged totals from the SERVER recompute (freshQuote.totals)', () => {
    expect(src).toMatch(/subtotalCents = freshQuote\.totals\.subtotalCents/);
    expect(src).toMatch(/totalCents = freshQuote\.totals\.totalCents/);
  });

  it('no longer assigns the charged totals from the client quote (fq.totals)', () => {
    // The forgery vector: charging fq.totals directly. Must be gone.
    expect(src).not.toMatch(/subtotalCents = fq\.totals\.subtotalCents/);
    expect(src).not.toMatch(/totalCents = fq\.totals\.totalCents\s*;/);
  });

  it('rejects when the client total diverges from the server recompute', () => {
    expect(src).toMatch(/QUOTE_PRICE_CHANGED/);
    expect(src).toMatch(/Math\.abs\(freshQuote\.totals\.totalCents - fq\.totals\.totalCents\)/);
  });

  it('fails closed if the server recompute itself fails (no silent fallback)', () => {
    expect(src).toMatch(/QUOTE_RECOMPUTE_FAILED/);
  });
});
