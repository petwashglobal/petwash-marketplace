/**
 * WalletLedgerAuthorityService — Program 18.
 */
import { describe, it, expect } from 'vitest';
import {
  projectWalletBalance,
  type LedgerEntry,
} from '../services/marketplace/WalletLedgerAuthorityService';

const mk = (kind: LedgerEntry['kind'], amountCents: number, id = String(Math.random()), currency: LedgerEntry['currency'] = 'ILS'): LedgerEntry => ({
  entryId: id,
  kind,
  amountCents,
  currency,
  createdAt: '2026-08-30T10:00:00Z',
});

describe('WalletLedgerAuthorityService', () => {
  it('empty ledger → 0 available, 0 held', () => {
    const out = projectWalletBalance([]);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.projection.availableCents).toBe(0);
    expect(out.projection.heldCents).toBe(0);
  });

  it('CREDIT + DEBIT arithmetic', () => {
    const out = projectWalletBalance([mk('CREDIT', 10000), mk('DEBIT', 3000)]);
    if (out.code !== 'OK') throw new Error();
    expect(out.projection.availableCents).toBe(7000);
  });

  it('HOLD reduces available and increases held; RELEASE reverses it', () => {
    const held = projectWalletBalance([mk('CREDIT', 10000), mk('HOLD', 4000)]);
    if (held.code !== 'OK') throw new Error();
    expect(held.projection.availableCents).toBe(6000);
    expect(held.projection.heldCents).toBe(4000);

    const released = projectWalletBalance([mk('CREDIT', 10000), mk('HOLD', 4000), mk('RELEASE', 4000)]);
    if (released.code !== 'OK') throw new Error();
    expect(released.projection.availableCents).toBe(10000);
    expect(released.projection.heldCents).toBe(0);
  });

  it('adjustments (+/-) apply', () => {
    const out = projectWalletBalance([mk('ADJUSTMENT_POSITIVE', 500), mk('ADJUSTMENT_NEGATIVE', 200)]);
    if (out.code !== 'OK') throw new Error();
    expect(out.projection.availableCents).toBe(300);
  });

  it('currency mismatch → CURRENCY_MISMATCH with offending entry id', () => {
    const bad = { ...mk('CREDIT', 100, 'E-BAD'), currency: 'USD' as any };
    const out = projectWalletBalance([bad]);
    expect(out.code).toBe('CURRENCY_MISMATCH');
    if (out.code !== 'CURRENCY_MISMATCH') throw new Error();
    expect(out.offendingEntryId).toBe('E-BAD');
  });

  it('unknown kind → LEDGER_INTEGRITY_UNKNOWN_KIND (never guesses)', () => {
    const rogue = { ...mk('CREDIT' as any, 100, 'E-X'), kind: 'REWARD' as any };
    const out = projectWalletBalance([rogue as any]);
    expect(out.code).toBe('LEDGER_INTEGRITY_UNKNOWN_KIND');
  });
});
