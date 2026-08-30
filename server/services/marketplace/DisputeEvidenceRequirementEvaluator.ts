/**
 * DisputeEvidenceRequirementEvaluator — CEO PROGRAM 15 (Refund) + 13.
 *
 * Pure evaluator. Given a dispute kind, returns the minimum
 * evidence set the customer / provider must submit before the
 * dispute can advance from OPENED → UNDER_REVIEW. Missing evidence
 * is surfaced as REQUIRED obligations; the caller lifts them into
 * the JourneyState.
 */

export type DisputeKind =
  | 'NO_SHOW'
  | 'DAMAGED_PROPERTY'
  | 'PET_INJURY'
  | 'CANCELLED_MID_SERVICE'
  | 'PRICING_MISMATCH'
  | 'FRAUDULENT_CHARGE'
  | 'OTHER';

export type EvidenceCode =
  | 'PHOTOS'
  | 'VET_REPORT'
  | 'RECEIPT_OR_INVOICE'
  | 'TIMESTAMPED_MESSAGES'
  | 'THIRD_PARTY_STATEMENT'
  | 'BANK_STATEMENT_REDACTED'
  | 'INCIDENT_NARRATIVE';

export interface RequirementSet {
  required: EvidenceCode[];
  recommended: EvidenceCode[];
  reasonCode: string;
}

const NARRATIVE: EvidenceCode = 'INCIDENT_NARRATIVE';

export function requirementsForDispute(kind: DisputeKind): RequirementSet {
  switch (kind) {
    case 'NO_SHOW':
      return {
        required: [NARRATIVE, 'TIMESTAMPED_MESSAGES'],
        recommended: ['THIRD_PARTY_STATEMENT'],
        reasonCode: 'NO_SHOW_EVIDENCE',
      };
    case 'DAMAGED_PROPERTY':
      return {
        required: [NARRATIVE, 'PHOTOS'],
        recommended: ['THIRD_PARTY_STATEMENT'],
        reasonCode: 'PROPERTY_DAMAGE_EVIDENCE',
      };
    case 'PET_INJURY':
      return {
        required: [NARRATIVE, 'VET_REPORT'],
        recommended: ['PHOTOS'],
        reasonCode: 'PET_INJURY_EVIDENCE',
      };
    case 'CANCELLED_MID_SERVICE':
      return {
        required: [NARRATIVE, 'TIMESTAMPED_MESSAGES'],
        recommended: [],
        reasonCode: 'MID_SERVICE_CANCEL_EVIDENCE',
      };
    case 'PRICING_MISMATCH':
      return {
        required: [NARRATIVE, 'RECEIPT_OR_INVOICE'],
        recommended: ['TIMESTAMPED_MESSAGES'],
        reasonCode: 'PRICING_EVIDENCE',
      };
    case 'FRAUDULENT_CHARGE':
      return {
        required: [NARRATIVE, 'BANK_STATEMENT_REDACTED'],
        recommended: [],
        reasonCode: 'FRAUD_EVIDENCE',
      };
    case 'OTHER':
    default:
      return {
        required: [NARRATIVE],
        recommended: [],
        reasonCode: 'GENERIC_DISPUTE',
      };
  }
}

/** Returns the still-missing REQUIRED codes given a submitted set. */
export function missingRequired(kind: DisputeKind, submitted: EvidenceCode[]): EvidenceCode[] {
  const set = new Set(submitted);
  return requirementsForDispute(kind).required.filter((r) => !set.has(r));
}
