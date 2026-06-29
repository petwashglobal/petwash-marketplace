/**
 * Walk-My-Pet escrow must FAIL CLOSED. If the escrow hold throws on walker-accept,
 * the booking must NOT be confirmed, must NOT write a PAYMENT_CAPTURED ledger, and
 * must NOT issue an Israeli tax receipt — else a free walk + a real tax doc results.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('walk-my-pet escrow fail-closed', () => {
  it('returns an error from the escrow catch instead of swallowing it', () => {
    expect(SRC).toMatch(/catch \(escrowErr: any\) \{[^]*?ESCROW_HOLD_FAILED/);
    expect(SRC).toMatch(/return res\.status\(502\)/);
  });
  it('no longer just console.errors and continues to confirm', () => {
    expect(SRC).not.toMatch(/console\.error\('\[Walk My Pet\] Escrow confirmation failed for bookingId:'/);
  });
});
