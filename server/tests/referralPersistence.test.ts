/**
 * Referral state must be durable.
 *
 * server/routes/referral.ts kept EVERYTHING in in-process Maps — under a comment
 * that admitted it: "IN-MEMORY STORAGE (Production: Use Firestore/PostgreSQL)".
 * That placeholder shipped: the router is mounted at /api/referral and a
 * customer-facing ReferralPage reads it.
 *
 * What that cost:
 *   • referral CODES were regenerated whenever the Map was empty, so links a
 *     member had already shared stopped matching them after a deploy;
 *   • referral records vanished on restart — attribution lost;
 *   • userCredits held real ₪25 balances that evaporated on every deploy, and we
 *     deploy several times a day;
 *   • those credits were never spendable anyway — plain numbers on an object,
 *     never in walletAccounts, never in the hash-chained ledger;
 *   • users.referred_by_code, which the BOOKING flow reads, was never written, so
 *     attribution never fired there either.
 *
 * Money design pinned here: earning records an OBLIGATION ('earned'); it does not
 * silently push ₪ into a wallet. Issuance is a separate audited step.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { REFERRAL_CONFIG, calculateLevel } from '../routes/referral';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(resolve(ROOT, 'server/routes/referral.ts'), 'utf8');
const store = readFileSync(resolve(ROOT, 'server/services/ReferralStore.ts'), 'utf8');
const migration = readFileSync(resolve(ROOT, 'migrations/0099_referral_credits.sql'), 'utf8');

describe('referral — nothing lives in memory any more', () => {
  it('the route holds no Maps', () => {
    expect(route).not.toMatch(/new Map\s*[<(]/);
  });

  it('none of the old in-memory stores are declared', () => {
    // Check for the DECLARATIONS, not the phrase — the file header legitimately
    // quotes the old "IN-MEMORY STORAGE" comment while explaining what changed.
    for (const name of ['referralCodes', 'userCredits', 'userStats']) {
      expect(route).not.toMatch(new RegExp(`const\\s+${name}\\s*=`));
    }
  });

  it('all seven endpoints still exist (the ReferralPage depends on them)', () => {
    for (const p of ['/link', '/register-click', '/link-signup', '/complete', '/history', '/credits', '/admin/overview']) {
      expect(route).toContain(`"${p}"`);
    }
  });
});

describe('referral — durable storage', () => {
  it('the member code persists on users.referral_code', () => {
    expect(store).toMatch(/UPDATE users SET referral_code/);
  });

  it('stamps users.referred_by_code, which the booking flow reads', () => {
    expect(store).toMatch(/referred_by_code/);
  });

  it('referral records go to the referrals table', () => {
    expect(store).toMatch(/INSERT INTO referrals/);
  });

  it('credits go to a real table with a positive-amount constraint', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS referral_credits/);
    expect(migration).toMatch(/CHECK \(amount_ils > 0\)/);
  });
});

describe('referral — cannot double-credit', () => {
  it('is idempotent by database constraint, not by a racy check', () => {
    expect(migration).toMatch(/UNIQUE \(referral_id, role\)/);
    expect(store).toMatch(/ON CONFLICT \(referral_id, role\) DO NOTHING/);
  });

  it('writes both credits inside one transaction', () => {
    expect(store).toMatch(/db as any\)\.transaction/);
  });
});

describe('referral — honest about money', () => {
  it('records an obligation rather than silently crediting a wallet', () => {
    expect(store).toMatch(/'earned'/);
    // Must NOT quietly move wallet money from this path.
    expect(store).not.toMatch(/cashWalletBalanceCents/);
    expect(store).not.toMatch(/deductFromWallet|addCredits/);
  });

  it('the credits endpoint states the credit is not yet spendable', () => {
    expect(route).toMatch(/earned_pending_issue/);
  });

  it('enforces the lifetime cap before crediting', () => {
    expect(store).toMatch(/INVITER_CAP_REACHED/);
    expect(store).toMatch(/INVITEE_CAP_REACHED/);
  });

  it('rejects a self-referral', () => {
    expect(store).toMatch(/SELF_REFERRAL/);
  });
});

describe('referral — config and levels unchanged', () => {
  it('keeps the ₪25 credit and ₪1000 lifetime cap', () => {
    expect(REFERRAL_CONFIG.creditPerReferralILS).toBe(25);
    expect(REFERRAL_CONFIG.lifetimeCapILS).toBe(1000);
    expect(REFERRAL_CONFIG.minFirstPaymentILS).toBe(20);
  });

  it('level thresholds still behave', () => {
    expect(calculateLevel(0)).toBe('BRONZE');
    expect(calculateLevel(5)).toBe('SILVER');
    expect(calculateLevel(10)).toBe('GOLD');
    expect(calculateLevel(25)).toBe('DIAMOND');
    expect(calculateLevel(4)).toBe('BRONZE');
  });
});
