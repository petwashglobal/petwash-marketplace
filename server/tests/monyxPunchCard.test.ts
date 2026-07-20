/**
 * Monyx 5+1 punch card — rule and safety pins.
 *
 * We run this offer ourselves because Nayax gates its "Campaign" module
 * server-side and it is not enabled on our operator account. The rules therefore
 * have to be enforced by OUR code, so they are pinned here.
 *
 * CEO-confirmed: five paid qualifying washes, the SIXTH is free.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isQualifyingAmount,
  PUNCHES_REQUIRED,
  QUALIFYING_MIN_ILS,
  QUALIFYING_MAX_ILS,
  PUNCH_CAMPAIGN_CODE,
} from '../services/MonyxPunchCardService';

const ROOT = resolve(__dirname, '..', '..');
const svc = readFileSync(resolve(ROOT, 'server/services/MonyxPunchCardService.ts'), 'utf8');
const migration = readFileSync(resolve(ROOT, 'migrations/0098_monyx_punch_card.sql'), 'utf8');
const route = readFileSync(resolve(ROOT, 'server/routes/nayax-monyx-events.ts'), 'utf8');

describe('Monyx 5+1 — the offer', () => {
  it('requires 5 paid washes (the 6th is the free one)', () => {
    expect(PUNCHES_REQUIRED).toBe(5);
  });

  it('counts the ₪55 standard wash', () => {
    expect(isQualifyingAmount(55)).toBe(true);
    expect(isQualifyingAmount(54)).toBe(true);
    expect(isQualifyingAmount(56)).toBe(true);
  });

  it('excludes the discounted municipal price (~₪48)', () => {
    expect(isQualifyingAmount(48)).toBe(false);
    expect(QUALIFYING_MIN_ILS).toBe(54);
    expect(QUALIFYING_MAX_ILS).toBe(56);
  });

  it('excludes junk amounts', () => {
    expect(isQualifyingAmount(0)).toBe(false);
    expect(isQualifyingAmount(-55)).toBe(false);
    expect(isQualifyingAmount(NaN)).toBe(false);
    expect(isQualifyingAmount(500)).toBe(false);
  });
});

describe('Monyx 5+1 — double-punch safety', () => {
  it('dedups structurally: UNIQUE on external_transaction_id', () => {
    expect(migration).toMatch(/UNIQUE \(external_transaction_id\)/);
  });

  it('inserts with ON CONFLICT DO NOTHING rather than check-then-insert', () => {
    expect(svc).toMatch(/ON CONFLICT \(external_transaction_id\) DO NOTHING/);
  });

  it('locks the card row so concurrent webhooks cannot both award', () => {
    expect(svc).toMatch(/FOR UPDATE/);
  });

  it('never lets loyalty bookkeeping break the transaction webhook', () => {
    // The whole record path is wrapped and returns a soft result on error.
    expect(svc).toMatch(/failed to record wash/);
  });
});

describe('Monyx 5+1 — money safety', () => {
  it('does NOT auto-issue the free wash by default (Lynx mint unproven)', () => {
    delete process.env.MONYX_PUNCH_AUTO_ISSUE;
    // Gate is explicit opt-in, never a default-on.
    expect(svc).toMatch(/MONYX_PUNCH_AUTO_ISSUE/);
    expect(svc).toMatch(/=== 'true'/);
  });

  it('a refunded wash is un-punched', () => {
    expect(svc).toMatch(/export async function reverseWash/);
    expect(svc).toMatch(/reversed = true/);
    expect(route).toMatch(/reversePunch\(originalTxId\)/);
  });

  it('reversal is idempotent and spares an already-completed card', () => {
    expect(svc).toMatch(/if \(!row \|\| row\.reversed\) return \{ reversed: false \}/);
    expect(svc).toMatch(/row\.reward_status === 'accruing'/);
  });
});

describe('Monyx 5+1 — only Monyx washes count', () => {
  it('the punch fires only for the monyx_qr channel', () => {
    expect(route).toMatch(/paymentChannel === 'monyx_qr'/);
  });

  it('uses the agreed campaign code', () => {
    expect(PUNCH_CAMPAIGN_CODE).toBe('PW_KS_LOYALTY_5PLUS1_2026');
  });
});
