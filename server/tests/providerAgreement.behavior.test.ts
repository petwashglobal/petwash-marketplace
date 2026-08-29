/**
 * Provider Agreement — behavior pins
 * (integrity doctrine §2.1, §4, §12, §64, §65).
 *
 * Locks:
 *   • version state machine (DRAFT → COUNSEL_REVIEW → ACTIVE → SUPERSEDED)
 *   • append-only acceptance semantics (no mutation)
 *   • re-acceptance gate when the ACTIVE version changes
 *   • never issue an acceptance for a non-ACTIVE version
 */
import { describe, it, expect } from 'vitest';
import {
  buildAcceptance,
  canTransitionAgreement,
  isAcceptedActiveVersion,
  needsReacceptance,
  sortNewestFirst,
  type ProviderAgreementAcceptance,
  type ProviderAgreementVersion,
} from '../../shared/marketplace/providerAgreement';

const V1: ProviderAgreementVersion = {
  agreementVersion: 'pw-provider-2026-06',
  status: 'SUPERSEDED',
  language: 'he',
  publishedAt: '2026-06-01T00:00:00Z',
  documentHash: 'hash-v1',
  supersedes: undefined,
};

const V2: ProviderAgreementVersion = {
  agreementVersion: 'pw-provider-2026-08',
  status: 'ACTIVE',
  language: 'he',
  publishedAt: '2026-08-15T00:00:00Z',
  documentHash: 'hash-v2',
  supersedes: 'pw-provider-2026-06',
};

describe('version state machine (integrity §12)', () => {
  it('DRAFT → COUNSEL_REVIEW allowed', () => {
    expect(canTransitionAgreement('DRAFT', 'COUNSEL_REVIEW')).toBe(true);
  });

  it('COUNSEL_REVIEW → ACTIVE allowed', () => {
    expect(canTransitionAgreement('COUNSEL_REVIEW', 'ACTIVE')).toBe(true);
  });

  it('COUNSEL_REVIEW → DRAFT allowed (return to author on feedback)', () => {
    expect(canTransitionAgreement('COUNSEL_REVIEW', 'DRAFT')).toBe(true);
  });

  it('ACTIVE → SUPERSEDED allowed', () => {
    expect(canTransitionAgreement('ACTIVE', 'SUPERSEDED')).toBe(true);
  });

  it('DRAFT cannot skip to ACTIVE', () => {
    expect(canTransitionAgreement('DRAFT', 'ACTIVE')).toBe(false);
  });

  it('SUPERSEDED is terminal — no transitions out', () => {
    expect(canTransitionAgreement('SUPERSEDED', 'ACTIVE')).toBe(false);
    expect(canTransitionAgreement('SUPERSEDED', 'DRAFT')).toBe(false);
  });

  it('ACTIVE cannot go back to DRAFT (evidence discipline §2.1)', () => {
    expect(canTransitionAgreement('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransitionAgreement('ACTIVE', 'COUNSEL_REVIEW')).toBe(false);
  });
});

describe('buildAcceptance', () => {
  it('returns a valid record for an ACTIVE version', () => {
    const rec = buildAcceptance('provider_maya', V2, '2026-08-29T12:00:00Z', {
      ipMeta: 'sha256:masked',
      deviceMeta: 'iOS 17.6 · Safari',
    });
    expect(rec.providerUid).toBe('provider_maya');
    expect(rec.agreementVersion).toBe(V2.agreementVersion);
    expect(rec.documentHash).toBe(V2.documentHash);
    expect(rec.method).toBe('electronic');
    expect(rec.language).toBe('he');
    expect(rec.acceptedAt).toBe('2026-08-29T12:00:00Z');
  });

  it('refuses to build an acceptance for a non-ACTIVE version', () => {
    expect(() => buildAcceptance('provider_maya', V1)).toThrow(/status is SUPERSEDED/);
    const draft: ProviderAgreementVersion = { ...V2, status: 'DRAFT' };
    expect(() => buildAcceptance('provider_maya', draft)).toThrow(/status is DRAFT/);
    const review: ProviderAgreementVersion = { ...V2, status: 'COUNSEL_REVIEW' };
    expect(() => buildAcceptance('provider_maya', review)).toThrow(/COUNSEL_REVIEW/);
  });
});

describe('acceptance status against the ACTIVE version', () => {
  const acceptedV2: ProviderAgreementAcceptance = {
    providerUid: 'p1',
    agreementVersion: 'pw-provider-2026-08',
    language: 'he',
    acceptedAt: '2026-08-20T00:00:00Z',
    method: 'electronic',
    documentHash: 'hash-v2',
  };

  const acceptedV1Only: ProviderAgreementAcceptance = {
    providerUid: 'p1',
    agreementVersion: 'pw-provider-2026-06',
    language: 'he',
    acceptedAt: '2026-06-05T00:00:00Z',
    method: 'electronic',
    documentHash: 'hash-v1',
  };

  it('provider that accepted the ACTIVE version → isAcceptedActiveVersion true', () => {
    expect(isAcceptedActiveVersion([acceptedV2], V2)).toBe(true);
    expect(needsReacceptance([acceptedV2], V2)).toBe(false);
  });

  it('provider that only accepted a SUPERSEDED prior version → needs re-acceptance', () => {
    expect(isAcceptedActiveVersion([acceptedV1Only], V2)).toBe(false);
    expect(needsReacceptance([acceptedV1Only], V2)).toBe(true);
  });

  it('empty history → needs acceptance', () => {
    expect(needsReacceptance([], V2)).toBe(true);
  });

  it('a version that is not ACTIVE cannot be "accepted" — always needs re-acceptance when it becomes ACTIVE', () => {
    // §2.1: evidence records are append-only. If activeVersion.status
    // is not ACTIVE (e.g. still under counsel review), no acceptance
    // has satisfied it yet.
    const inReview: ProviderAgreementVersion = { ...V2, status: 'COUNSEL_REVIEW' };
    expect(isAcceptedActiveVersion([acceptedV2], inReview)).toBe(false);
  });

  it('mismatched documentHash → treated as NOT accepted (regeneration invalidates prior acceptance)', () => {
    const forgedHash: ProviderAgreementAcceptance = {
      ...acceptedV2,
      documentHash: 'hash-forged',
    };
    expect(isAcceptedActiveVersion([forgedHash], V2)).toBe(false);
  });
});

describe('sortNewestFirst — read presentation only, does not mutate', () => {
  it('sorts acceptances by acceptedAt desc without mutating input', () => {
    const raw: ProviderAgreementAcceptance[] = [
      { providerUid: 'p', agreementVersion: 'a', language: 'he', acceptedAt: '2026-06-01T00:00:00Z', method: 'electronic', documentHash: 'h1' },
      { providerUid: 'p', agreementVersion: 'b', language: 'he', acceptedAt: '2026-08-01T00:00:00Z', method: 'electronic', documentHash: 'h2' },
      { providerUid: 'p', agreementVersion: 'c', language: 'he', acceptedAt: '2026-07-01T00:00:00Z', method: 'electronic', documentHash: 'h3' },
    ];
    const sorted = sortNewestFirst(raw);
    expect(sorted.map((r) => r.agreementVersion)).toEqual(['b', 'c', 'a']);
    // Input array is unchanged (append-only mindset).
    expect(raw.map((r) => r.agreementVersion)).toEqual(['a', 'b', 'c']);
  });
});
