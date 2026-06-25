import { describe, it, expect } from 'vitest';
import { computeRiskFlags, scoreFromFlags, ageFromDob } from '../services/applicationRiskEngine';

const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
};

describe('ageFromDob', () => {
  it('computes whole years', () => {
    expect(ageFromDob(yearsAgo(30))).toBe(30);
  });
  it('returns null for missing/invalid', () => {
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob('not-a-date')).toBeNull();
  });
});

describe('computeRiskFlags', () => {
  it('flags UNDER_18 as critical (provider)', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: 16, status: 'pending_review' });
    expect(flags.find((f) => f.code === 'UNDER_18')?.severity).toBe('critical');
    expect(scoreFromFlags(flags)).toBe('critical');
  });

  it('flags senior discount with age < 65 (high)', () => {
    const flags = computeRiskFlags({ kind: 'discount', discountType: 'senior', age: 60, status: 'pending_review' });
    expect(flags.some((f) => f.code === 'SENIOR_AGE_MISMATCH')).toBe(true);
    expect(scoreFromFlags(flags)).toBe('high');
  });

  it('does NOT flag senior age mismatch at 65+', () => {
    const flags = computeRiskFlags({ kind: 'discount', discountType: 'senior', age: 70, status: 'pending_review' });
    expect(flags.some((f) => f.code === 'SENIOR_AGE_MISMATCH')).toBe(false);
  });

  it('flags provider payout intent without tax status (medium)', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: 30, wantsPayout: true, taxStatus: null, status: 'pending_review' });
    expect(flags.some((f) => f.code === 'PAYOUT_NO_TAX')).toBe(true);
  });

  it('does NOT flag payout-no-tax when tax status present', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: 30, wantsPayout: true, taxStatus: 'osek_patur', status: 'pending_review' });
    expect(flags.some((f) => f.code === 'PAYOUT_NO_TAX')).toBe(false);
  });

  it('flags duplicate email + phone (high)', () => {
    const flags = computeRiskFlags({ kind: 'discount', age: 70, discountType: 'senior', duplicateEmailCount: 1, duplicatePhoneCount: 2, status: 'pending_review' });
    expect(flags.some((f) => f.code === 'DUPLICATE_EMAIL')).toBe(true);
    expect(flags.some((f) => f.code === 'DUPLICATE_PHONE')).toBe(true);
    expect(scoreFromFlags(flags)).toBe('high');
  });

  it('flags PENDING_TOO_LONG past the SLA (discount 3 days)', () => {
    const flags = computeRiskFlags({ kind: 'discount', age: 70, discountType: 'senior', status: 'pending_review', submittedAt: new Date(Date.now() - 5 * 86_400_000) });
    expect(flags.some((f) => f.code === 'PENDING_TOO_LONG')).toBe(true);
  });

  it('does NOT flag overdue within SLA', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: 30, taxStatus: 'osek_patur', status: 'pending_review', submittedAt: new Date(Date.now() - 1 * 86_400_000) });
    expect(flags.some((f) => f.code === 'PENDING_TOO_LONG')).toBe(false);
  });

  it('clean application scores low', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: 35, taxStatus: 'osek_murshe', status: 'pending_review', submittedAt: new Date() });
    expect(scoreFromFlags(flags)).toBe('low');
    expect(flags).toHaveLength(0);
  });

  it('flags AGE_UNVERIFIED for provider with no DOB', () => {
    const flags = computeRiskFlags({ kind: 'provider', age: null, taxStatus: 'osek_patur', status: 'pending_review' });
    expect(flags.some((f) => f.code === 'AGE_UNVERIFIED')).toBe(true);
  });
});
