/**
 * CEO MASTER §3 §4 §5 §16 (2026-08-29 correction pass) — pins for
 * the BecomeProviderResume canonical upgrade.
 *
 * These are source-anchored regression pins. The Lane E URL emitter
 * writes `?requestedService=<canonical code>` and every provider
 * CTA is expected to route through this component; if a refactor
 * silently drops the canonical reader, or replaces the safe
 * return-to with a bare `/provider-onboarding`, this suite trips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resumeTargetFromApplication, legacyProviderTypeFor } from '../../client/src/pages/becomeProviderResume.helpers';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'BecomeProviderResume.tsx'),
  'utf8',
);
const HELPERS = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'becomeProviderResume.helpers.ts'),
  'utf8',
);

describe('BecomeProviderResume — CEO §3 canonical vocabulary reader', () => {
  it('imports the shared normaliser (not a local ?type= whitelist)', () => {
    expect(SRC).toMatch(/from '@shared\/lib\/providerServiceVocabulary'/);
    expect(SRC).toMatch(/normaliseToProviderServiceCode/);
    // The old local whitelist must be gone.
    expect(SRC).not.toMatch(/PROVIDER_TYPE_WHITELIST/);
  });

  it('reads `requestedService` FIRST, then legacy `type` and `role`', () => {
    // Ensures the canonical URL vocabulary wins when both are present.
    expect(SRC).toMatch(/for \(const key of \['requestedService', 'type', 'role'\]\)/);
  });

  it('emits the canonical query key on the onboarding href (helpers module)', () => {
    // Direct onboarding URL — for signed-in users with no draft.
    expect(HELPERS).toMatch(/`\/provider-onboarding\?requestedService=\$\{encodeURIComponent\(service\)\}`/);
    // The legacy short-form `?type=<alias>` emitter must NOT be here.
    expect(HELPERS).not.toMatch(/`\/provider-onboarding\?type=/);
    expect(SRC).not.toMatch(/`\/provider-onboarding\?type=/);
  });
});

describe('BecomeProviderResume — CEO §4 preserve return-to', () => {
  it('bounces anonymous users to /sign-in with the FULL canonical URL as `redirect`', () => {
    // The bounce URL is built by `canonicalBecomeProviderUrl(service, attribution)`,
    // ensuring the service AND every whitelisted attribution key survive
    // the sign-in round-trip.
    expect(SRC).toMatch(/canonicalBecomeProviderUrl\(service, attribution\)/);
    expect(SRC).toMatch(/setTarget\(`\/sign-in\?redirect=\$\{encodeURIComponent\(safe\)\}`\)/);
  });

  it('the CEO-approved attribution allowlist lives in the helpers module (single source)', () => {
    // Extra query params outside utm_*/campaignId/referrer must not
    // survive — this is the same discipline the ctaActions emitter
    // uses on the outbound side.
    expect(HELPERS).toMatch(
      /export const ATTRIBUTION_KEYS = \[\s*'utm_source', 'utm_medium', 'utm_campaign',\s*'utm_content', 'utm_term', 'campaignId', 'referrer',\s*\] as const;/,
    );
    // The .tsx pulls the same allowlist from helpers — no duplicate.
    expect(SRC).toMatch(/ATTRIBUTION_KEYS,[\s\S]*from '\.\/becomeProviderResume\.helpers'/);
  });

  it('validates the return-to path with safeInternalReturnTo (§5)', () => {
    // Even the internally-constructed URL runs through the guard —
    // belt and braces. Prevents ever emitting `/sign-in?redirect=`
    // pointing at an absolute URL if a refactor introduces one.
    expect(SRC).toMatch(/safeInternalReturnTo\(back\)/);
    expect(SRC).toMatch(/from '@\/lib\/ctaActions'/);
  });
});

describe('BecomeProviderResume — application state → resume target', () => {
  it('no application → onboarding href with canonical requestedService', () => {
    expect(resumeTargetFromApplication(null, 'pet_sitting'))
      .toBe('/provider-onboarding?requestedService=pet_sitting');
    expect(resumeTargetFromApplication(null, null)).toBe('/provider-onboarding');
  });

  it('approved (status or stage) → /provider/today', () => {
    expect(resumeTargetFromApplication({ status: 'approved' }, 'pet_sitting')).toBe('/provider/today');
    expect(resumeTargetFromApplication({ stage: 'approved' }, 'pet_sitting')).toBe('/provider/today');
  });

  it('rejected (status or stage) → /provider/rejected', () => {
    expect(resumeTargetFromApplication({ status: 'rejected' }, 'pet_sitting')).toBe('/provider/rejected');
    expect(resumeTargetFromApplication({ stage: 'rejected' }, 'pet_sitting')).toBe('/provider/rejected');
  });

  it('pending shapes → /provider/pending', () => {
    for (const status of ['pending', 'pending_review', 'under_review', 'processing', 'pending_resubmission']) {
      expect(resumeTargetFromApplication({ status }, 'pet_sitting')).toBe('/provider/pending');
    }
  });

  it('withdrawn → onboarding (reapply) preserving the intent', () => {
    expect(resumeTargetFromApplication({ status: 'withdrawn' }, 'dog_walking'))
      .toBe('/provider-onboarding?requestedService=dog_walking');
  });

  it('unknown status → onboarding (safe default) preserving the intent', () => {
    expect(resumeTargetFromApplication({ status: 'anything_new' }, 'training'))
      .toBe('/provider-onboarding?requestedService=training');
  });
});

describe('legacyProviderTypeFor — thin mirror for adjacent legacy surfaces', () => {
  it('returns the legacy short-form for every canonical code', () => {
    expect(legacyProviderTypeFor('pet_sitting')).toBe('sitter');
    expect(legacyProviderTypeFor('dog_walking')).toBe('walker');
    expect(legacyProviderTypeFor('training')).toBe('trainer');
    expect(legacyProviderTypeFor('pet_transport')).toBe('driver');
    expect(legacyProviderTypeFor('station_operator')).toBe('station_operator');
    expect(legacyProviderTypeFor(null)).toBeNull();
  });
});
