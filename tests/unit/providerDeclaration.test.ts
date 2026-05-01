import { describe, it, expect } from 'vitest';
import {
  ENHANCED_VERIFICATION_REASONS,
  ENHANCED_REASON_LABELS,
  PROVIDER_DECLARATION_TEXT,
  defaultReasonsForProviderTypes,
  requiresEnhancedVerification,
} from '../../shared/legal/providerDeclaration';

/**
 * Israel-safe provider self-declaration (2026 spec).
 *
 * These tests cover the SHARED helper logic. Route-level integration
 * (POST /api/provider-onboarding/apply enforces the checkbox) and
 * AdminProviderReviewService.approveApplication conditional gate are
 * verified by the integration test suite (live-booking.test.ts) once
 * a database is available — they cannot run in this isolated unit
 * test environment.
 */
describe('shared/legal/providerDeclaration', () => {
  it('exposes the four canonical high-risk reasons', () => {
    expect([...ENHANCED_VERIFICATION_REASONS].sort()).toEqual([
      'home_access',
      'key_holding',
      'overnight_sitting',
      'pet_transport',
    ]);
  });

  it('every reason has Hebrew + English labels', () => {
    for (const reason of ENHANCED_VERIFICATION_REASONS) {
      const labels = ENHANCED_REASON_LABELS[reason];
      expect(labels.he).toBeTruthy();
      expect(labels.en).toBeTruthy();
      expect(labels.he).not.toEqual(labels.en);
    }
  });

  it('declaration text is bilingual and non-empty', () => {
    expect(PROVIDER_DECLARATION_TEXT.he.title).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.he.body).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.he.checkboxLabel).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.he.enhancedNotice).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.he.idRequiredNotice).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.en.title).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.en.body).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.en.checkboxLabel).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.en.enhancedNotice).toBeTruthy();
    expect(PROVIDER_DECLARATION_TEXT.en.idRequiredNotice).toBeTruthy();
  });

  it('mentions ID, convictions, and platform risk in the En body', () => {
    const body = PROVIDER_DECLARATION_TEXT.en.body.toLowerCase();
    expect(body).toContain('criminal convictions');
    expect(body).toContain('legal matters');
    expect(body).toContain('platform');
    expect(PROVIDER_DECLARATION_TEXT.en.idRequiredNotice.toLowerCase()).toContain('id');
  });

  describe('defaultReasonsForProviderTypes — no auto-defaults policy', () => {
    // PetWash 2026 spec: no provider type triggers enhanced verification
    // automatically. Police clearance is only required when the provider
    // explicitly opts into one of the four high-risk service categories
    // (home_access, overnight_sitting, key_holding, pet_transport) via
    // the dedicated checkboxes in the onboarding form.

    it('returns empty for sitter (no auto-default)', () => {
      expect(defaultReasonsForProviderTypes(['sitter'])).toEqual([]);
    });

    it('returns empty for driver / pettrek (no auto-default)', () => {
      expect(defaultReasonsForProviderTypes(['driver'])).toEqual([]);
      expect(defaultReasonsForProviderTypes(['pettrek'])).toEqual([]);
    });

    it('returns empty for walker', () => {
      expect(defaultReasonsForProviderTypes(['walker'])).toEqual([]);
    });

    it('returns empty for trainer', () => {
      expect(defaultReasonsForProviderTypes(['trainer'])).toEqual([]);
    });

    it('returns empty for station_operator', () => {
      expect(defaultReasonsForProviderTypes(['station_operator'])).toEqual([]);
    });

    it('returns empty for any combination of provider types', () => {
      expect(defaultReasonsForProviderTypes(['sitter', 'driver'])).toEqual([]);
      expect(defaultReasonsForProviderTypes(['walker', 'trainer'])).toEqual([]);
    });
  });

  describe('requiresEnhancedVerification', () => {
    it('returns false for an empty array', () => {
      expect(requiresEnhancedVerification([])).toBe(false);
    });

    it('returns true for any single canonical reason', () => {
      expect(requiresEnhancedVerification(['home_access'])).toBe(true);
      expect(requiresEnhancedVerification(['overnight_sitting'])).toBe(true);
      expect(requiresEnhancedVerification(['key_holding'])).toBe(true);
      expect(requiresEnhancedVerification(['pet_transport'])).toBe(true);
    });

    it('returns false for an unknown / non-canonical reason', () => {
      expect(requiresEnhancedVerification(['something_else'])).toBe(false);
    });

    it('returns true if at least one reason is canonical', () => {
      expect(requiresEnhancedVerification(['something_else', 'pet_transport'])).toBe(true);
    });
  });
});
