/**
 * Lynx prepaid-card mint — irreversible-flag and body-shape pins.
 *
 * 1) RevalueCashBit MUST be set at creation.
 *    Nayax's "revalue" is a second store of value on a card, and it is the rail
 *    used for machine refunds and cashback — i.e. exactly how a Monyx member
 *    receives a free-wash credit or a refund. Per the sandbox-verified
 *    nayax-lynx-prepaid-cards skill the flag CANNOT be enabled after creation:
 *    a card minted without it returns 400 "This Card is not defined as Revalue"
 *    on every revalue call, for the life of that card.
 *
 *    Our mint previously omitted it entirely (zero occurrences in the file), so
 *    every card we issued was permanently incapable of refunds/cashback. That is
 *    unrecoverable per card, which is why it is pinned here rather than left to
 *    review.
 *
 * 2) The /v2/cards body shape had two conflicting authoritative sources (the
 *    skill documents FLAT, the official docs show NESTED) and live mints were
 *    blocked pending a manual sandbox test that never happened. The mint now
 *    tries flat, then falls back to nested. The retry is safe ONLY on HTTP 400
 *    (validation → no card created); retrying a 409/5xx/timeout could mint a
 *    duplicate card, so that must never be added.
 *
 * Source-pin test — no live API calls.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/services/LynxCardService.ts'), 'utf8');

describe('LynxCardService — prepaid card mint invariants', () => {
  it('sets RevalueCashBit: true at creation (cannot be enabled later)', () => {
    expect(src).toMatch(/RevalueCashBit\s*:\s*true/);
  });

  it('keeps the single-use anti-replay flag', () => {
    expect(src).toMatch(/CreditSingleUseBit\s*:\s*true/);
  });

  it('sends CountryID (Nayax internal, resolved — never the ISO value)', () => {
    // 376 is Israel's ISO numeric; card endpoints must use Nayax's own CountryID.
    expect(src).toMatch(/CountryID\s*:\s*countryId/);
    expect(src).not.toMatch(/CountryID\s*:\s*376/);
  });

  it('fails closed when the CountryID cannot be resolved', () => {
    expect(src).toMatch(/country_id_unresolved/);
  });

  it('retries the alternate body shape ONLY on HTTP 400', () => {
    expect(src).toMatch(/r\.status === 400/);
    // Guard against someone widening the retry to statuses where a card may exist.
    expect(src).not.toMatch(/r\.status >= 400/);
    expect(src).not.toMatch(/r\.status === 500/);
  });

  it('records which body shape the live API accepted', () => {
    expect(src).toMatch(/shapeUsed/);
  });
});
