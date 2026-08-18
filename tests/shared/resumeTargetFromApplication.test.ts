/**
 * Pure unit tests for resumeTargetFromApplication.
 *
 * Per CEO §35.5 + §8 + §P1-27: BecomeProviderResume routes an
 * authenticated user by SERVER application state. If the routing table
 * ever silently reverses (e.g. sends `approved` back through
 * /provider-onboarding), an existing approved provider would be dragged
 * through the intake wizard again — the exact bug this fix closed.
 * These tests pin the routing table so a future refactor can't
 * regress it.
 */

import { describe, expect, it } from 'vitest';
import { resumeTargetFromApplication } from '@shared/lib/becomeProviderRouting';

describe('resumeTargetFromApplication', () => {
  describe('no application', () => {
    it('null → /provider-onboarding (new draft)', () => {
      expect(resumeTargetFromApplication(null, null)).toBe('/provider-onboarding');
    });

    it('null + type → /provider-onboarding?type=<>', () => {
      expect(resumeTargetFromApplication(null, 'walker')).toBe('/provider-onboarding?type=walker');
    });
  });

  describe('draft', () => {
    it('draft → /provider-onboarding (resume)', () => {
      expect(resumeTargetFromApplication({ status: 'draft' }, null)).toBe('/provider-onboarding');
    });

    it('draft carries type', () => {
      expect(resumeTargetFromApplication({ status: 'draft' }, 'sitter')).toBe('/provider-onboarding?type=sitter');
    });
  });

  describe('pending', () => {
    it('pending_review → /provider/pending', () => {
      expect(resumeTargetFromApplication({ status: 'pending_review' }, null)).toBe('/provider/pending');
    });

    it('under_review → /provider/pending', () => {
      expect(resumeTargetFromApplication({ status: 'under_review' }, null)).toBe('/provider/pending');
    });

    it('under_review IGNORES any type param — no wizard restart', () => {
      expect(resumeTargetFromApplication({ status: 'under_review' }, 'trainer')).toBe('/provider/pending');
    });
  });

  describe('approved', () => {
    it('approved status → /provider/today (CEO benchmark surface)', () => {
      expect(resumeTargetFromApplication({ status: 'approved' }, null)).toBe('/provider/today');
    });

    it('approved via stage field also routes to /provider/today', () => {
      expect(resumeTargetFromApplication({ stage: 'approved' }, null)).toBe('/provider/today');
    });

    it('APPROVED status wins over any type param — no wizard restart', () => {
      expect(resumeTargetFromApplication({ status: 'approved' }, 'walker')).toBe('/provider/today');
    });

    it('approved status wins even if stage disagrees', () => {
      expect(
        resumeTargetFromApplication({ status: 'approved', stage: 'draft' }, null)
      ).toBe('/provider/today');
    });
  });

  describe('rejected', () => {
    it('rejected → /provider/rejected', () => {
      expect(resumeTargetFromApplication({ status: 'rejected' }, null)).toBe('/provider/rejected');
    });

    it('rejected via stage field also routes to /provider/rejected', () => {
      expect(resumeTargetFromApplication({ stage: 'rejected' }, null)).toBe('/provider/rejected');
    });

    it('rejected IGNORES type — no wizard restart', () => {
      expect(resumeTargetFromApplication({ status: 'rejected' }, 'sitter')).toBe('/provider/rejected');
    });
  });

  describe('withdrawn', () => {
    it('withdrawn → /provider-onboarding (reapply)', () => {
      expect(resumeTargetFromApplication({ status: 'withdrawn' }, null)).toBe('/provider-onboarding');
    });

    it('withdrawn carries type on reapply', () => {
      expect(resumeTargetFromApplication({ status: 'withdrawn' }, 'walker'))
        .toBe('/provider-onboarding?type=walker');
    });
  });

  describe('unknown / defensive', () => {
    it('unknown status defaults to /provider-onboarding (safe fallback)', () => {
      expect(resumeTargetFromApplication({ status: 'yolo' }, null)).toBe('/provider-onboarding');
    });

    it('empty status defaults to /provider-onboarding', () => {
      expect(resumeTargetFromApplication({ status: '' }, null)).toBe('/provider-onboarding');
    });

    it('missing status object still routes safely', () => {
      expect(resumeTargetFromApplication({}, null)).toBe('/provider-onboarding');
    });
  });

  describe('case normalization', () => {
    it('APPROVED (uppercase) → /provider/today', () => {
      expect(resumeTargetFromApplication({ status: 'APPROVED' }, null)).toBe('/provider/today');
    });

    it('Under_Review (mixed case) → /provider/pending', () => {
      expect(resumeTargetFromApplication({ status: 'Under_Review' }, null)).toBe('/provider/pending');
    });
  });

  describe('never route an approved provider through onboarding — the ORIGINAL bug', () => {
    // Explicit regression tests for the exact bad behavior we fixed.
    for (const badType of ['walker', 'sitter', 'trainer', 'driver', 'station_operator', 'pet_trek']) {
      it(`approved user tapping "Become Provider" with ?type=${badType} → /provider/today, NOT /provider-onboarding`, () => {
        const target = resumeTargetFromApplication({ status: 'approved' }, badType);
        expect(target).toBe('/provider/today');
        expect(target).not.toContain('/provider-onboarding');
      });
    }
  });
});
