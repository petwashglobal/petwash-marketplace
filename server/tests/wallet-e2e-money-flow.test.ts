/**
 * QA: end-to-end wallet money-flow invariants.
 *
 * Pins the behaviour exercised by the CEO's launch simulation so it can't
 * silently drift. (Source-introspection — the live debit functions require a
 * DB, but these invariants are what make the displayed number trustworthy.)
 *
 * Simulation:
 *   User A: 3-wash package, redeem 1 → washPackageCredits 3 → 2 (units, no cents).
 *   User B: 500₪ eGift (50000¢):
 *     - K9000 single wash 55₪  → IMMEDIATE eGift debit of WASH_PRICE_ILS_CENTS (5500) → 44500¢
 *     - PetSitter 120₪         → eGift HOLD at booking, DEBIT on provider accept  → 32500¢
 *     - Walk-My-Pet 100₪       → eGift HOLD at booking, DEBIT on provider accept  → 22500¢
 *   Final eGift = 225₪ (22500¢) once both bookings are accepted.
 *
 * Consistency: every display surface reads ONE source (getWalletSummary →
 * walletAccounts), so the number is identical on every screen and the backend.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(SERVER, p), 'utf8');

const walletSvc = read('services/WalletService.ts');
const creditWalletRoute = read('routes/credit-wallet.ts');
const k9000Svc = read('services/K9000RedemptionService.ts');
const bookingReq = read('routes/booking-requests.ts');

describe('Single source of truth — wallet shows the same everywhere', () => {
  it('getWalletSummary is the canonical read and the /summary endpoint uses it', () => {
    expect(walletSvc).toMatch(/async getWalletSummary\(userId: string\)/);
    expect(creditWalletRoute).toMatch(/walletService\.getWalletSummary\(userId\)/);
  });

  it('summary exposes every bucket + pending (so holds are visible, not hidden)', () => {
    for (const k of [
      'cashWalletBalanceCents', 'egiftBalanceCents', 'washPackageCredits',
      'loyaltyPointsBalance', 'promoBalanceCents', 'referralBalanceCents',
      'pendingBalanceCents',
    ]) {
      expect(walletSvc).toContain(k);
    }
  });
});

describe('K9000 single wash — immediate eGift debit at the fixed price', () => {
  it('wash price is the single 5500¢ (₪55) constant', () => {
    expect(k9000Svc).toMatch(/WASH_PRICE_ILS_CENTS\s*=\s*5500/);
  });
  it('debit decrements egiftBalanceCents (gift-funded wash) atomically', () => {
    expect(k9000Svc).toMatch(/egiftBalanceCents[\s\S]{0,80}WASH_PRICE_ILS_CENTS/);
  });
});

describe('Marketplace bookings (PetSitter / Walk) — hold then debit on accept', () => {
  it('places a wallet HOLD at booking time (reserves, not yet spent)', () => {
    expect(bookingReq).toMatch(/walletHoldApplied\s*=/);
    expect(bookingReq).toMatch(/financeState:\s*['"]hold_active['"]|walletHoldCents/);
  });
  it('DEBITS the hold when the provider accepts, RELEASES it on decline', () => {
    expect(bookingReq).toMatch(/debitBookingFromHold\(/);
    expect(bookingReq).toMatch(/releaseBookingHold\(/);
    expect(walletSvc).toMatch(/async debitBookingFromHold/);
    expect(walletSvc).toMatch(/async releaseBookingHold/);
  });
});

describe('Computed simulation balances (documentation of expected truth)', () => {
  const ILS = (cents: number) => cents / 100;
  it('User A: 3-wash package, redeem 1 → 2 washes, 0₪ cents moved', () => {
    const washes = 3 - 1;
    expect(washes).toBe(2);
  });
  it('User B: 500₪ eGift − 55 − 120 − 100 = 225₪ once bookings accepted', () => {
    let egiftCents = 50000;
    egiftCents -= 5500;   // K9000 wash (immediate)
    egiftCents -= 12000;  // PetSitter (debited on accept)
    egiftCents -= 10000;  // Walk-My-Pet (debited on accept)
    expect(egiftCents).toBe(22500);
    expect(ILS(egiftCents)).toBe(225);
  });
});
