/**
 * PetKyaJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=pet.
 *
 * Reads the canonical `pets` row and projects it into the pure
 * PetKya (Know Your Animal) resolver. The freshness policy comes
 * from the caller (§21-§22 discipline: engineers do NOT invent
 * months). This loader passes an empty policy so the resolver
 * returns POLICY_NOT_CONFIGURED — the honest surface until the
 * BusinessDecisionRegistry provides KYA_REVIEW_INTERVAL_MONTHS.
 *
 * Party discipline: pets are owned by exactly one uid (userId).
 * Anyone else is refused NOT_A_PARTY.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { pets } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import { resolvePetKyaJourney } from '../PetKyaJourneyResolver';
import {
  getBusinessDecision,
  isPolicyConfigured,
} from '@shared/marketplace/businessDecisionRegistry';

function extractCoreCareNotes(row: {
  allergies: string | null;
  medications: string | null;
  specialNeeds: string | null;
  notes: string | null;
  medicalShareConsent: boolean | null;
}): boolean {
  // "Core care notes present" means at least one of the actionable
  // care fields is populated AND the owner has shared consent for
  // service providers to see medical data. Without consent, the
  // resolver treats the pet as missing shareable notes even if the
  // owner has filled them in privately.
  if (!row.medicalShareConsent) return false;
  const anyContent = [row.allergies, row.medications, row.specialNeeds, row.notes]
    .some((v) => typeof v === 'string' && v.trim().length > 0);
  return anyContent;
}

export const petKyaJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const rowId = Number.parseInt(id, 10);
    if (!Number.isFinite(rowId) || rowId <= 0) return { code: 'NOT_FOUND' };

    const row = (await db.select().from(pets).where(eq(pets.id, rowId)).limit(1))[0];
    if (!row) return { code: 'NOT_FOUND' };
    if (row.userId !== actorUid) return { code: 'NOT_A_PARTY' };

    // §21-§22 — the resolver refuses to grade freshness under an
    // undecided policy. If BusinessDecisionRegistry has not been
    // configured with KYA_DEFAULT_REVIEW_INTERVAL, we pass an empty
    // policy so the response is honest (POLICY_NOT_CONFIGURED).
    const configured = isPolicyConfigured('KYA_DEFAULT_REVIEW_INTERVAL');
    const approvedValue = configured
      ? getBusinessDecision('KYA_DEFAULT_REVIEW_INTERVAL')?.approvedValue
      : undefined;
    const reviewIntervalMonths =
      typeof approvedValue === 'number' && approvedValue > 0
        ? approvedValue
        : (typeof approvedValue === 'object' && approvedValue !== null && 'months' in (approvedValue as any)
          ? Number((approvedValue as any).months)
          : undefined);

    const journey = resolvePetKyaJourney({
      snapshot: {
        petId: String(row.id),
        ownerUid: row.userId,
        hasCoreCareNotes: extractCoreCareNotes({
          allergies: row.allergies,
          medications: row.medications,
          specialNeeds: row.specialNeeds,
          notes: row.notes,
          medicalShareConsent: row.medicalShareConsent,
        }),
        lastReviewedAt: row.medicalConsentUpdatedAt ? new Date(row.medicalConsentUpdatedAt).toISOString() : undefined,
        medicalDocExpiresAt: row.nextVaccinationDate ? new Date(row.nextVaccinationDate).toISOString() : undefined,
      },
      actorUid,
      policy: reviewIntervalMonths ? { reviewIntervalMonths } : {},
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
