/**
 * PolicyStatusService — §21-§22 status roll-up.
 */
import { describe, it, expect } from 'vitest';
import {
  policyStatusByDomain,
  countUndecided,
} from '../services/marketplace/PolicyStatusService';
import type { BusinessDecision } from '@shared/marketplace/businessDecisionRegistry';

const stub: BusinessDecision[] = [
  { key: 'PRESTIGE_CANCEL_POLICY', status: 'UNDECIDED', question: 'q' },
  { key: 'KYA_DEFAULT_REVIEW_INTERVAL', status: 'UNDECIDED', question: 'q' },
  { key: 'CANCELLATION_FEE_ILS', status: 'APPROVED', question: 'q', approvedValue: 5000 },
  { key: 'REVIEW_MODERATION_WINDOW', status: 'DRAFT', question: 'q' },
  { key: 'PAYOUT_HOLD_DAYS', status: 'APPROVED', question: 'q', approvedValue: 3 },
];

describe('PolicyStatusService', () => {
  it('groups decisions by domain', () => {
    const buckets = policyStatusByDomain(stub);
    const byDomain = Object.fromEntries(buckets.map((b) => [b.domain, b]));
    expect(byDomain.PRESTIGE.undecided).toContain('PRESTIGE_CANCEL_POLICY');
    expect(byDomain.KYA.undecided).toContain('KYA_DEFAULT_REVIEW_INTERVAL');
    expect(byDomain.CANCELLATION.approved).toContain('CANCELLATION_FEE_ILS');
    expect(byDomain.REVIEW.draft).toContain('REVIEW_MODERATION_WINDOW');
    expect(byDomain.PAYOUT.approved).toContain('PAYOUT_HOLD_DAYS');
  });

  it('returns all six domains even when some have no entries', () => {
    const buckets = policyStatusByDomain([]);
    expect(buckets.map((b) => b.domain).sort()).toEqual(
      ['CANCELLATION', 'KYA', 'OTHER', 'PAYOUT', 'PRESTIGE', 'REVIEW'].sort()
    );
  });

  it('countUndecided counts UNDECIDED + DRAFT (anything not APPROVED)', () => {
    expect(countUndecided(stub)).toBe(3);
  });

  it('APPROVED-only registry → 0 undecided', () => {
    expect(countUndecided([
      { key: 'A', status: 'APPROVED', question: 'q' },
      { key: 'B', status: 'APPROVED', question: 'q' },
    ])).toBe(0);
  });

  it('unclassifiable keys land in OTHER', () => {
    const buckets = policyStatusByDomain([{ key: 'MYSTERY_KEY', status: 'UNDECIDED', question: 'q' }]);
    const other = buckets.find((b) => b.domain === 'OTHER')!;
    expect(other.undecided).toContain('MYSTERY_KEY');
  });
});
