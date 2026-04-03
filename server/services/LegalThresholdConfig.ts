/**
 * PetWash™ Legal Threshold Configuration
 *
 * Israeli Tax Authority (ITA / רשות המסים) mandatory electronic invoicing
 * thresholds for B2B transactions.
 *
 * Source: Government of Israel, Digital Invoice Law (חוק חשבוניות דיגיטליות)
 * Reference: https://www.gov.il/he/departments/topics/digital-invoices
 *
 * SCHEDULE (all amounts are BEFORE VAT, in NIS):
 *   From 1 Jan 2026  → threshold = ₪10,000 before VAT
 *   From 1 Jun 2026  → threshold = ₪5,000  before VAT
 *   From 1 Jan 2027  → threshold = ₪0      (all B2B require allocation number)
 *
 * When a B2B transaction amount before VAT EXCEEDS the threshold in force on
 * the invoice issue date, the platform MUST obtain an allocation number
 * (מספר הקצאה) from the ITA before issuing the tax invoice.
 *
 * Without the allocation number, the buyer cannot deduct input VAT.
 */

export interface ThresholdRule {
  effectiveFrom: Date;
  thresholdNIS: number;       // Amount before VAT in NIS (not agorot)
  description: string;
}

const THRESHOLD_SCHEDULE: ThresholdRule[] = [
  {
    effectiveFrom: new Date("2026-01-01T00:00:00+02:00"),
    thresholdNIS: 10_000,
    description: "₪10,000 before VAT — effective 1 Jan 2026",
  },
  {
    effectiveFrom: new Date("2026-06-01T00:00:00+03:00"),
    thresholdNIS: 5_000,
    description: "₪5,000 before VAT — effective 1 Jun 2026",
  },
  {
    effectiveFrom: new Date("2027-01-01T00:00:00+02:00"),
    thresholdNIS: 0,
    description: "₪0 — all B2B require allocation number from 1 Jan 2027",
  },
];

/**
 * Returns the threshold (in NIS, before VAT) that applies on a given date.
 * Returns Infinity if mandatory electronic invoicing has not yet started
 * (before 1 Jan 2026).
 */
export function getThresholdOnDate(date: Date): number {
  const applicable = THRESHOLD_SCHEDULE
    .filter(r => date >= r.effectiveFrom)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

  if (applicable.length === 0) return Infinity;
  return applicable[0].thresholdNIS;
}

/**
 * Determines whether a B2B transaction requires an ITA allocation number
 * (מספר הקצאה) before the tax invoice may be issued.
 *
 * @param amountBeforeVatNIS  Transaction amount BEFORE VAT in NIS (not agorot)
 * @param isB2B               true if customer is a registered business (has tax ID)
 * @param issueDate           Date the invoice will be issued (defaults to now)
 */
export function requiresAllocationNumber(
  amountBeforeVatNIS: number,
  isB2B: boolean,
  issueDate: Date = new Date()
): boolean {
  if (!isB2B) return false;
  const threshold = getThresholdOnDate(issueDate);
  if (threshold === Infinity) return false;
  return amountBeforeVatNIS > threshold;
}

/**
 * Same as requiresAllocationNumber but accepts agorot (ILS × 100) for
 * consistency with internal ledger columns.
 */
export function requiresAllocationNumberFromAgorot(
  subtotalAgorot: number,
  isB2B: boolean,
  issueDate: Date = new Date()
): boolean {
  return requiresAllocationNumber(subtotalAgorot / 100, isB2B, issueDate);
}

export const ISRAELI_VAT_RATE = 0.18;

/**
 * Calculate VAT and totals from a gross amount (ILS × 100 agorot).
 * Rounds to the nearest agora.
 */
export function calcVatFromGrossAgorot(grossAgorot: number): {
  subtotalAgorot: number;
  vatAgorot: number;
  totalAgorot: number;
} {
  const subtotalAgorot = Math.round(grossAgorot / (1 + ISRAELI_VAT_RATE));
  const vatAgorot = grossAgorot - subtotalAgorot;
  return { subtotalAgorot, vatAgorot, totalAgorot: grossAgorot };
}

/**
 * Calculate VAT and totals from a net (before VAT) amount in agorot.
 */
export function calcVatFromNetAgorot(netAgorot: number): {
  subtotalAgorot: number;
  vatAgorot: number;
  totalAgorot: number;
} {
  const vatAgorot = Math.round(netAgorot * ISRAELI_VAT_RATE);
  return { subtotalAgorot: netAgorot, vatAgorot, totalAgorot: netAgorot + vatAgorot };
}
