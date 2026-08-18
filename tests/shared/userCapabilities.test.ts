/**
 * Pure unit tests for shared/lib/userCapabilities predicates.
 *
 * Per CEO §6 (Rover-quality multi-role) + §P1-27 (BEHAVIORAL-VERIFIED).
 * These predicates gate UI branches — a false positive here means
 * showing a Provider button to a non-provider; a false negative means
 * hiding a legitimate capability from a real user. Pin the truth
 * table with tests.
 */

import { describe, expect, it } from 'vitest';
import {
  emptyCapabilities,
  hasApplicantCapability,
  hasCustomerCapability,
  hasPrestigeCapability,
  hasProviderCapability,
  hasSitterCapability,
  hasTrainerCapability,
  hasWalkerCapability,
  type UserCapabilities,
} from '@shared/lib/userCapabilities';

function withActivation(caps: UserCapabilities, activated: boolean): UserCapabilities {
  return {
    ...caps,
    identity: {
      emailVerified: activated,
      mobileVerified: activated,
      activated,
    },
  };
}

function withProvider(
  caps: UserCapabilities,
  active: boolean,
  services: string[] = [],
): UserCapabilities {
  return {
    ...caps,
    provider: {
      applicant: !active,
      active,
      applicationStatus: active ? 'approved' : 'pending_review',
      services: services as any,
    },
  };
}

describe('emptyCapabilities', () => {
  it('returns least-privilege shape', () => {
    const caps = emptyCapabilities();
    expect(caps.userId).toBe('');
    expect(caps.identity).toEqual({ emailVerified: false, mobileVerified: false, activated: false });
    expect(caps.prestige).toEqual({ enrolled: false, tier: null, memberId: null });
    expect(caps.provider).toEqual({ applicant: false, active: false, applicationStatus: null, services: [] });
    expect(caps.admin).toEqual({ admin: false, superAdmin: false });
  });

  it('carries userId when passed', () => {
    expect(emptyCapabilities('firebase-uid-123').userId).toBe('firebase-uid-123');
  });

  it('every predicate returns false on empty', () => {
    const caps = emptyCapabilities();
    expect(hasCustomerCapability(caps)).toBe(false);
    expect(hasPrestigeCapability(caps)).toBe(false);
    expect(hasProviderCapability(caps)).toBe(false);
    expect(hasApplicantCapability(caps)).toBe(false);
    expect(hasWalkerCapability(caps)).toBe(false);
    expect(hasSitterCapability(caps)).toBe(false);
    expect(hasTrainerCapability(caps)).toBe(false);
  });
});

describe('hasCustomerCapability', () => {
  it('true ONLY when both identity contacts are verified (PR-AUTH-IDENTITY-1)', () => {
    const caps = emptyCapabilities();
    expect(hasCustomerCapability(withActivation(caps, false))).toBe(false);
    expect(hasCustomerCapability(withActivation(caps, true))).toBe(true);
  });

  it('false when only one contact is verified', () => {
    const caps: UserCapabilities = {
      ...emptyCapabilities(),
      identity: { emailVerified: true, mobileVerified: false, activated: false },
    };
    expect(hasCustomerCapability(caps)).toBe(false);
  });
});

describe('hasPrestigeCapability', () => {
  it('true ONLY when enrolled (not from age, not from tier alone)', () => {
    const caps = emptyCapabilities();
    expect(hasPrestigeCapability(caps)).toBe(false);
    caps.prestige = { enrolled: true, tier: 'gold', memberId: 'PM-2024-001' };
    expect(hasPrestigeCapability(caps)).toBe(true);
  });

  it('false when tier set but enrolled=false (defensive against stale data)', () => {
    const caps = emptyCapabilities();
    caps.prestige = { enrolled: false, tier: 'gold', memberId: 'PM-XXX' };
    expect(hasPrestigeCapability(caps)).toBe(false);
  });
});

describe('hasProviderCapability', () => {
  it('true ONLY when provider.active is true', () => {
    const caps = emptyCapabilities();
    expect(hasProviderCapability(withProvider(caps, false))).toBe(false);
    expect(hasProviderCapability(withProvider(caps, true))).toBe(true);
  });

  it('false when only applicant', () => {
    const caps = emptyCapabilities();
    caps.provider.applicant = true;
    caps.provider.active = false;
    caps.provider.applicationStatus = 'pending_review';
    expect(hasProviderCapability(caps)).toBe(false);
  });
});

describe('hasApplicantCapability', () => {
  it('true when provider.applicant', () => {
    const caps = emptyCapabilities();
    caps.provider.applicant = true;
    expect(hasApplicantCapability(caps)).toBe(true);
  });

  it('false when neither applicant nor active', () => {
    expect(hasApplicantCapability(emptyCapabilities())).toBe(false);
  });
});

describe('walker / sitter / trainer service predicates', () => {
  it('walker: requires active AND dog_walking in services', () => {
    const caps = withProvider(emptyCapabilities(), true, ['dog_walking']);
    expect(hasWalkerCapability(caps)).toBe(true);
    expect(hasSitterCapability(caps)).toBe(false);
    expect(hasTrainerCapability(caps)).toBe(false);
  });

  it('sitter: requires active AND pet_sitting in services', () => {
    const caps = withProvider(emptyCapabilities(), true, ['pet_sitting']);
    expect(hasSitterCapability(caps)).toBe(true);
    expect(hasWalkerCapability(caps)).toBe(false);
    expect(hasTrainerCapability(caps)).toBe(false);
  });

  it('trainer: requires active AND training in services', () => {
    const caps = withProvider(emptyCapabilities(), true, ['training']);
    expect(hasTrainerCapability(caps)).toBe(true);
    expect(hasWalkerCapability(caps)).toBe(false);
    expect(hasSitterCapability(caps)).toBe(false);
  });

  it('service in the list but provider NOT active → false (no capability)', () => {
    const caps: UserCapabilities = {
      ...emptyCapabilities(),
      // Deliberately mismatched: services present but active=false.
      provider: {
        applicant: false,
        active: false,
        applicationStatus: 'rejected',
        services: ['dog_walking', 'pet_sitting'] as any,
      },
    };
    expect(hasWalkerCapability(caps)).toBe(false);
    expect(hasSitterCapability(caps)).toBe(false);
  });

  it('multiple approved services → all matching predicates true', () => {
    const caps = withProvider(emptyCapabilities(), true, ['dog_walking', 'pet_sitting', 'training']);
    expect(hasWalkerCapability(caps)).toBe(true);
    expect(hasSitterCapability(caps)).toBe(true);
    expect(hasTrainerCapability(caps)).toBe(true);
  });
});

describe('multi-role user (customer + provider + prestige) — the CEO §6 scenario', () => {
  it('all three capabilities can co-exist and each predicate reads independently', () => {
    const caps: UserCapabilities = {
      ...emptyCapabilities('multi-role-uid'),
      identity: { emailVerified: true, mobileVerified: true, activated: true },
      prestige: { enrolled: true, tier: 'gold', memberId: 'PM-2024-001' },
      provider: { applicant: false, active: true, applicationStatus: 'approved', services: ['dog_walking'] as any },
    };
    expect(hasCustomerCapability(caps)).toBe(true);
    expect(hasPrestigeCapability(caps)).toBe(true);
    expect(hasProviderCapability(caps)).toBe(true);
    expect(hasWalkerCapability(caps)).toBe(true);
    // Non-matching service still false — additive per §6.
    expect(hasSitterCapability(caps)).toBe(false);
  });
});
