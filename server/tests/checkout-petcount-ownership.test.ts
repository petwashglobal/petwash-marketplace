/**
 * Marketplace /checkout: quote must be owned by the caller, and petIds must
 * match the priced petCount.
 *
 * The checkout charged/escrowed `quote.totalCents` (priced from `quote.petCount`,
 * taken from the body at /quote time) but created the booking from `petIds` in
 * the checkout body — with NO check that they agree and NO check that the quote
 * belongs to the caller. So a user could (a) check out against someone else's
 * quoteId, and (b) pay for 1 pet while booking many (escrow gross, booking total
 * and receipt all diverge).
 *
 * Fix: reject when quote.customerId !== caller (non-anonymous), and reject when
 * petIds.length !== quote.petCount. Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'marketplace-bookings.ts'),
  'utf8',
);

describe('marketplace /checkout — quote ownership + pet-count integrity', () => {
  it('rejects a quote owned by a different account', () => {
    expect(src).toMatch(/quote\.customerId !== 'anonymous' && quote\.customerId !== userId/);
    expect(src).toMatch(/different account/);
  });

  it('rejects when submitted petIds count != quoted petCount', () => {
    expect(src).toMatch(/submittedPetCount !== \(quote\.petCount \?\? 1\)/);
    expect(src).toMatch(/PET_COUNT_MISMATCH/);
  });

  it('derives submitted pet count from petIds (not trusted blindly)', () => {
    expect(src).toMatch(/submittedPetCount = Array\.isArray\(petIds\) \? petIds\.length : 0/);
  });
});
