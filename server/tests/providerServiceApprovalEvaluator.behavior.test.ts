/**
 * ProviderServiceApprovalEvaluator — Program 21.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateProviderServiceApprovals,
  isServiceBookable,
  type ProviderServiceApproval,
} from '../services/marketplace/ProviderServiceApprovalEvaluator';

const approvals: ProviderServiceApproval[] = [
  { providerId: 'maya', serviceCode: 'DOG_WALK', status: 'APPROVED' },
  { providerId: 'maya', serviceCode: 'PET_SITTING', status: 'APPROVED' },
  { providerId: 'maya', serviceCode: 'DAYCARE', status: 'IN_REVIEW' },
  { providerId: 'maya', serviceCode: 'TRAINING', status: 'REJECTED' },
  { providerId: 'other-provider', serviceCode: 'DOG_WALK', status: 'APPROVED' },
];

describe('ProviderServiceApprovalEvaluator', () => {
  it('customer view exposes only APPROVED services', () => {
    const out = evaluateProviderServiceApprovals({ providerId: 'maya', approvals, viewerIsProvider: false });
    expect(out.bookableServices).toEqual(['DOG_WALK', 'PET_SITTING']);
    expect(out.pendingServices).toEqual([]);
    expect(out.rejectedServices).toEqual([]);
  });

  it('provider view exposes pending + rejected too', () => {
    const out = evaluateProviderServiceApprovals({ providerId: 'maya', approvals, viewerIsProvider: true });
    expect(out.bookableServices.sort()).toEqual(['DOG_WALK', 'PET_SITTING']);
    expect(out.pendingServices).toEqual(['DAYCARE']);
    expect(out.rejectedServices).toEqual(['TRAINING']);
  });

  it('provider view treats SUSPENDED as rejected (not bookable, visible to provider)', () => {
    const list = [...approvals, { providerId: 'maya', serviceCode: 'GROOMING', status: 'SUSPENDED' as const }];
    const out = evaluateProviderServiceApprovals({ providerId: 'maya', approvals: list, viewerIsProvider: true });
    expect(out.rejectedServices).toContain('GROOMING');
    expect(out.bookableServices).not.toContain('GROOMING');
  });

  it('cross-provider rows do not leak into this provider\'s buckets', () => {
    const out = evaluateProviderServiceApprovals({ providerId: 'maya', approvals, viewerIsProvider: true });
    expect(out.bookableServices).not.toContain('OTHER_PROVIDER');
  });

  it('isServiceBookable true only when APPROVED', () => {
    expect(isServiceBookable({ providerId: 'maya', serviceCode: 'DOG_WALK', approvals })).toBe(true);
    expect(isServiceBookable({ providerId: 'maya', serviceCode: 'DAYCARE', approvals })).toBe(false);
    expect(isServiceBookable({ providerId: 'maya', serviceCode: 'TRAINING', approvals })).toBe(false);
    expect(isServiceBookable({ providerId: 'someone-else', serviceCode: 'DOG_WALK', approvals })).toBe(false);
  });
});
