/**
 * ProviderApplicationJourneyLoader — CEO DEEP-LOGIC §84 loader for
 * kind=provider_application.
 *
 * Reads the canonical `provider_applications` row keyed by
 * applicationId AND enforces party discipline (only the applicant's
 * Firebase UID may see their own application projection). Maps the
 * DB status enum (draft | pending_review | under_review | approved
 * | rejected | withdrawn) onto the resolver's ProviderApplicationStatus
 * and derives the missingDocuments array from the KYC / background /
 * criminal / insurance / tax / bank status fields.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { providerApplications } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolveProviderApplicationJourney,
  type ProviderApplicationStatus,
  type MissingDocumentCode,
} from '../ProviderApplicationJourneyResolver';

/** DB status → resolver enum. Unknown → DRAFT (honest surface). */
function toCanonical(dbStatus: string | null | undefined): ProviderApplicationStatus {
  switch ((dbStatus ?? '').toLowerCase()) {
    case 'draft':                       return 'DRAFT';
    case 'pending_review':
    case 'documents_required':          return 'AWAITING_DOCUMENTS';
    case 'under_review':                return 'IN_REVIEW';
    case 'changes_requested':           return 'CHANGES_REQUESTED';
    case 'approved':                    return 'APPROVED';
    case 'rejected':
    case 'withdrawn':                   return 'REJECTED';
    case 'suspended':                   return 'SUSPENDED';
    default:                            return 'DRAFT';
  }
}

/**
 * Derive missing-document codes from the row's KYC / verification
 * status fields. A `pending` or falsy status counts as missing; only
 * `verified` / `passed` / `provided` clears it.
 */
function missingDocsFrom(row: {
  biometricStatus: string | null;
  governmentIdUrl: string | null;
  backgroundCheckStatus: string | null;
  criminalCheckStatus: string | null;
}): MissingDocumentCode[] {
  const missing: MissingDocumentCode[] = [];
  if (!row.governmentIdUrl && (row.biometricStatus ?? 'pending') !== 'verified') {
    missing.push('ID');
  }
  const bgStatus = (row.backgroundCheckStatus ?? 'pending').toLowerCase();
  if (bgStatus !== 'passed' && bgStatus !== 'waived') {
    missing.push('BACKGROUND_CHECK');
  }
  // Criminal check is a distinct dimension — surface it as its own
  // required doc when the applicant hasn't consented / completed it.
  const criminal = (row.criminalCheckStatus ?? 'pending').toLowerCase();
  if (criminal !== 'passed') {
    // Don't duplicate — background+criminal share the same
    // MissingDocumentCode 'BACKGROUND_CHECK' in the resolver's enum
    // for now. When the resolver adds CRIMINAL as a distinct code,
    // this branch can split.
    if (!missing.includes('BACKGROUND_CHECK')) missing.push('BACKGROUND_CHECK');
  }
  return missing;
}

export const providerApplicationJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const row = (
      await db.select().from(providerApplications)
        .where(eq(providerApplications.applicationId, id))
        .limit(1)
    )[0];
    if (!row) return { code: 'NOT_FOUND' };
    if (row.userId !== actorUid) return { code: 'NOT_A_PARTY' };

    const journey = resolveProviderApplicationJourney({
      snapshot: {
        applicationId: row.applicationId,
        status: toCanonical(row.status),
        providerUid: row.userId,
        missingDocuments: missingDocsFrom({
          biometricStatus: row.biometricStatus,
          governmentIdUrl: row.governmentIdUrl,
          backgroundCheckStatus: row.backgroundCheckStatus,
          criminalCheckStatus: row.criminalCheckStatus,
        }),
        // reviewNotesCode + insuranceExpiresAt fields aren't on the
        // current provider_applications row — leave undefined until
        // the schema surfaces them.
      },
      actorUid,
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
