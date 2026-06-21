import { describe, it, expect } from 'vitest';
import { creditTypeToServiceTag } from '@shared/serviceDivisions';

describe('creditTypeToServiceTag — every wallet credit names its service', () => {
  it('a wash_package credit is unambiguously a K9000 credit', () => {
    expect(creditTypeToServiceTag('wash_package')).toBe('k9000');
  });

  it('maps each credit type to a distinct service tag', () => {
    expect(creditTypeToServiceTag('egift')).toBe('egift');
    expect(creditTypeToServiceTag('loyalty_points')).toBe('loyalty');
    expect(creditTypeToServiceTag('promo_credit')).toBe('promo');
    expect(creditTypeToServiceTag('referral_credit')).toBe('referral');
  });

  it('falls back to account_credit for anything else (never null/ambiguous)', () => {
    expect(creditTypeToServiceTag('something_new')).toBe('account_credit');
    expect(creditTypeToServiceTag('')).toBe('account_credit');
  });

  it('tags are non-empty for every known credit type', () => {
    for (const t of ['egift', 'wash_package', 'loyalty_points', 'promo_credit', 'referral_credit']) {
      expect(creditTypeToServiceTag(t).length).toBeGreaterThan(0);
    }
  });
});
