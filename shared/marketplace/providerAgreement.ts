/**
 * Provider Agreement — CEO Integrity Doctrine §2.1, §12, §64, §65.
 *
 * The Provider Agreement is COUNSEL-APPROVED text; PetWash MUST NOT ship
 * production-active non-circumvention penalties without Israeli counsel
 * sign-off. This module supplies the SHAPES + VERSIONING primitives so
 * the framework can land while the text stays under review.
 *
 * Rules:
 *   • Every acceptance is stored append-only. Never overwrite prior
 *     evidence (§2.1). A regenerated agreement version yields a NEW
 *     acceptance record, not a mutation.
 *   • Acceptance is scoped to (providerUid, agreementVersion). A single
 *     provider may hold multiple historical acceptances across versions.
 *   • Duration + penalty magnitude are POLICY-CONFIGURED (§65). Never
 *     hard-code 12 / 24-month restrictions here.
 */

export type AgreementLanguage = 'he' | 'en';

export type AgreementStatus = 'DRAFT' | 'COUNSEL_REVIEW' | 'ACTIVE' | 'SUPERSEDED';

/**
 * Metadata about a specific published Provider Agreement version. Text
 * itself lives out-of-band (a signed PDF blob addressable by
 * documentHash), so this record is small and safe to load per session.
 */
export interface ProviderAgreementVersion {
  agreementVersion: string;         // stable id like 'pw-provider-2026-08'
  status: AgreementStatus;
  language: AgreementLanguage;
  publishedAt: string;              // ISO
  documentHash: string;             // sha256 of the counsel-approved text
  documentUrl?: string;             // where the reader can fetch the text
  supersedes?: string;              // previous version id, if any
}

/**
 * The evidence record for ONE provider accepting ONE version. Stored
 * append-only in whatever eventual table lands (privacy review pending).
 */
export interface ProviderAgreementAcceptance {
  providerUid: string;
  agreementVersion: string;
  language: AgreementLanguage;
  acceptedAt: string;               // ISO
  method: 'electronic';
  documentHash: string;             // must equal ProviderAgreementVersion.documentHash
  ipMeta?: string;                  // hashed / masked per privacy review
  deviceMeta?: string;              // e.g. "iOS 17.6 · Chrome 128"
}

/**
 * Guard: is this provider currently bound by an ACTIVE version?
 * A regression that let a provider hold only SUPERSEDED acceptances flip
 * the answer to false — the doctrine requires re-acceptance when the
 * ACTIVE version changes (§4).
 */
export function isAcceptedActiveVersion(
  acceptances: ProviderAgreementAcceptance[],
  activeVersion: ProviderAgreementVersion,
): boolean {
  if (activeVersion.status !== 'ACTIVE') return false;
  return acceptances.some(
    (a) =>
      a.agreementVersion === activeVersion.agreementVersion &&
      a.documentHash === activeVersion.documentHash,
  );
}

/**
 * Given a provider's acceptance history + the currently ACTIVE version,
 * decide whether the provider must be re-prompted for acceptance BEFORE
 * being allowed to send further messages / accept new requests.
 *
 * This is the ONLY function the enforcement layer consults — do not
 * inline the check across sites.
 */
export function needsReacceptance(
  acceptances: ProviderAgreementAcceptance[],
  activeVersion: ProviderAgreementVersion,
): boolean {
  return !isAcceptedActiveVersion(acceptances, activeVersion);
}

/**
 * Build an acceptance record with defaults. Callers still supply real
 * IP / device metadata per privacy review. Pure helper — no I/O.
 */
export function buildAcceptance(
  providerUid: string,
  version: ProviderAgreementVersion,
  now: string = new Date().toISOString(),
  metadata: Partial<Pick<ProviderAgreementAcceptance, 'ipMeta' | 'deviceMeta'>> = {},
): ProviderAgreementAcceptance {
  if (version.status !== 'ACTIVE') {
    throw new Error(`cannot accept a version whose status is ${version.status}`);
  }
  return {
    providerUid,
    agreementVersion: version.agreementVersion,
    language: version.language,
    acceptedAt: now,
    method: 'electronic',
    documentHash: version.documentHash,
    ...metadata,
  };
}

/**
 * Order acceptances newest-first. The append-only store returns
 * whichever ordering the caller asked for; this helper is provided so
 * every read site agrees on the shape presented to counsel / support.
 */
export function sortNewestFirst(
  acceptances: ProviderAgreementAcceptance[],
): ProviderAgreementAcceptance[] {
  return [...acceptances].sort(
    (a, b) => (a.acceptedAt < b.acceptedAt ? 1 : a.acceptedAt > b.acceptedAt ? -1 : 0),
  );
}

/**
 * Version status transitions. Enforced by the version publisher; the
 * transition table lives here so drift is impossible.
 *
 * DRAFT → COUNSEL_REVIEW → ACTIVE → SUPERSEDED
 *
 * DRAFT and COUNSEL_REVIEW can be discarded (deleted) instead of
 * transitioning further. Once ACTIVE, only SUPERSEDED is legal — a
 * version that reached ACTIVE stays evidentially recoverable forever.
 */
const AGREEMENT_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  DRAFT: ['COUNSEL_REVIEW'],
  COUNSEL_REVIEW: ['ACTIVE', 'DRAFT'],   // may go back to DRAFT on counsel feedback
  ACTIVE: ['SUPERSEDED'],
  SUPERSEDED: [],                        // terminal
};

export function canTransitionAgreement(
  from: AgreementStatus,
  to: AgreementStatus,
): boolean {
  return AGREEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
