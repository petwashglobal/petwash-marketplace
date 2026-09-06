/**
 * Nayax refund → SUMIT credit document: authority, recovery and over-credit rules.
 *
 * PURE decision functions. Nothing here performs I/O, so every rule below is
 * testable without touching SUMIT.
 */

/** Where a claim about the reversed sale came from. Provenance IS the safety. */
export const ORIGINAL_RESOLUTION_SOURCE = {
  /** Nayax itself named the parent (Lynx / Dispatcher / SQS). Authoritative. */
  NAYAX_AUTHORITATIVE: 'NAYAX_AUTHORITATIVE',
  /** A person decided, on the record. Authoritative. */
  HUMAN_RESOLVED: 'HUMAN_RESOLVED',
  /**
   * A matcher's candidate. NEVER authoritative — not even when it returns exactly
   * one. Measured on the 2026 export: 23.6% of card sales are not uniquely
   * identified by (card, machine, amount) and 41 pairs are mutually ambiguous
   * inside ±4 days, so "one candidate" is an artefact of the window, not proof.
   * For a review screen only.
   */
  HEURISTIC_SUGGESTION: 'HEURISTIC_SUGGESTION',
} as const;
export type OriginalResolutionSource =
  (typeof ORIGINAL_RESOLUTION_SOURCE)[keyof typeof ORIGINAL_RESOLUTION_SOURCE];

/** Only these may authorise a fiscal credit document. */
const AUTHORITATIVE: readonly string[] = [
  ORIGINAL_RESOLUTION_SOURCE.NAYAX_AUTHORITATIVE,
  ORIGINAL_RESOLUTION_SOURCE.HUMAN_RESOLVED,
];

export const REFUND_STATE = {
  OBSERVED: 'OBSERVED',
  AWAITING_ORIGINAL: 'AWAITING_ORIGINAL',
  READY: 'READY',
  CLAIMED: 'CLAIMED',
  PENDING_LOOKUP: 'PENDING_LOOKUP',
  ISSUED: 'ISSUED',
  NEEDS_RECONCILIATION: 'NEEDS_RECONCILIATION',
} as const;
export type RefundState = (typeof REFUND_STATE)[keyof typeof REFUND_STATE];

/** Deterministic SUMIT reference — keyed on the REFUND EVENT, never the sale. */
export function refundExternalReference(refundTransactionId: string): string {
  return `nayax-credit:${refundTransactionId}`;
}

export interface RefundEventView {
  refundTransactionId: string;
  machineId?: string;
  amountMinor: number;
  currency: string;
  originalTransactionId?: string | null;
  originalResolutionSource?: string | null;
  /** The original's own fiscal document, from nayax_fiscal_document_links. */
  originalFiscalDocumentId?: string | null;
  originalAmountMinor?: number | null;
  /** Sum of credits already CONFIRMED against the original, in minor units. */
  confirmedCreditedMinor?: number;
  /** Whether Nayax reports the reversal as final rather than merely attempted. */
  reversalIsFinal?: boolean;
}

export const REFUND_BLOCKER = {
  NO_ORIGINAL: 'NO_ORIGINAL',
  ORIGINAL_NOT_AUTHORITATIVE: 'ORIGINAL_NOT_AUTHORITATIVE',
  NO_ORIGINAL_FISCAL_DOCUMENT: 'NO_ORIGINAL_FISCAL_DOCUMENT',
  REVERSAL_NOT_FINAL: 'REVERSAL_NOT_FINAL',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  NON_POSITIVE_AMOUNT: 'NON_POSITIVE_AMOUNT',
  EXCEEDS_REMAINING: 'EXCEEDS_REMAINING',
  UNKNOWN_MACHINE: 'UNKNOWN_MACHINE',
  NO_REFUND_IDENTITY: 'NO_REFUND_IDENTITY',
} as const;
export type RefundBlocker = (typeof REFUND_BLOCKER)[keyof typeof REFUND_BLOCKER];

/**
 * How much of the original may still be credited, in minor units.
 *
 * From AMOUNTS, never from a count of link rows: nayax_fiscal_document_links
 * records that credits exist, not how large they were. Returns null when the
 * inputs cannot support the calculation — the caller must then reconcile rather
 * than assume headroom.
 */
export function remainingCreditableMinor(
  originalAmountMinor: number | null | undefined,
  confirmedCreditedMinor: number | null | undefined,
): number | null {
  if (typeof originalAmountMinor !== 'number' || !(originalAmountMinor > 0)) return null;
  const credited = confirmedCreditedMinor ?? 0;
  if (typeof credited !== 'number' || credited < 0) return null;
  return Math.max(0, originalAmountMinor - credited);
}

/** EVERY reason this refund may not become a credit document. PURE. */
export function refundBlockers(
  e: RefundEventView,
  knownMachine: (machineId: string | undefined) => boolean,
): RefundBlocker[] {
  const out: RefundBlocker[] = [];
  if (!e.refundTransactionId) out.push(REFUND_BLOCKER.NO_REFUND_IDENTITY);
  if (!knownMachine(e.machineId)) out.push(REFUND_BLOCKER.UNKNOWN_MACHINE);
  if (!e.originalTransactionId) out.push(REFUND_BLOCKER.NO_ORIGINAL);
  else if (!AUTHORITATIVE.includes(String(e.originalResolutionSource))) {
    // Includes the single-heuristic-candidate case, deliberately.
    out.push(REFUND_BLOCKER.ORIGINAL_NOT_AUTHORITATIVE);
  }
  if (!e.originalFiscalDocumentId) out.push(REFUND_BLOCKER.NO_ORIGINAL_FISCAL_DOCUMENT);
  if (e.reversalIsFinal !== true) out.push(REFUND_BLOCKER.REVERSAL_NOT_FINAL);
  if (!(e.amountMinor > 0)) out.push(REFUND_BLOCKER.NON_POSITIVE_AMOUNT);

  const remaining = remainingCreditableMinor(e.originalAmountMinor, e.confirmedCreditedMinor);
  // An unreadable remaining balance is not headroom.
  if (remaining === null || e.amountMinor > remaining) out.push(REFUND_BLOCKER.EXCEEDS_REMAINING);
  return out;
}

export function mayIssueCredit(
  e: RefundEventView,
  knownMachine: (machineId: string | undefined) => boolean,
): boolean {
  return refundBlockers(e, knownMachine).length === 0;
}

/**
 * Recovery transition for a claim whose create outcome is unknown, given what a
 * read-by-ExternalReference found.
 *
 * The forbidden move is a second ambiguous create. Only a definitive ABSENT,
 * on the first recovery pass, permits one recreate.
 */
export function recoveryDecision(
  lookup: { outcome: 'FOUND' | 'FOUND_MISMATCH' | 'ABSENT' | 'INCONCLUSIVE' },
  attemptCount: number,
  maxRecreates = 1,
): { state: RefundState; recreate: boolean; reason: string } {
  switch (lookup.outcome) {
    case 'FOUND':
      return { state: REFUND_STATE.ISSUED, recreate: false, reason: 'document_found_link_it' };
    case 'FOUND_MISMATCH':
      // The reference exists, just not where expected. Never recreate on this.
      return {
        state: REFUND_STATE.NEEDS_RECONCILIATION, recreate: false,
        reason: 'reference_exists_under_unexpected_type',
      };
    case 'ABSENT':
      return attemptCount > maxRecreates
        ? { state: REFUND_STATE.NEEDS_RECONCILIATION, recreate: false, reason: 'recreate_budget_exhausted' }
        : { state: REFUND_STATE.READY, recreate: true, reason: 'definitively_absent_one_safe_retry' };
    case 'INCONCLUSIVE':
    default:
      return {
        state: REFUND_STATE.NEEDS_RECONCILIATION, recreate: false,
        reason: 'lookup_inconclusive_never_create',
      };
  }
}

/**
 * Interpret a createCreditDocument() result.
 *
 * SumitClient.createCreditDocument NEVER THROWS — by design, so a SUMIT hiccup
 * cannot block a refund the customer is already owed. Correct for the refund
 * service, lethal here: "no exception" is not evidence a credit document exists.
 * Only a returned document id is.
 */
export function interpretCreditResult(
  result: { wired?: boolean; sumitDocumentId?: string | null; reason?: string } | null | undefined,
): { state: RefundState; documentId?: string; reason: string } {
  if (!result) return { state: REFUND_STATE.PENDING_LOOKUP, reason: 'no_result' };
  if (result.wired === false) return { state: REFUND_STATE.PENDING_LOOKUP, reason: 'not_wired' };
  if (!result.sumitDocumentId) {
    return { state: REFUND_STATE.PENDING_LOOKUP, reason: result.reason || 'no_document_id_returned' };
  }
  return { state: REFUND_STATE.ISSUED, documentId: result.sumitDocumentId, reason: 'confirmed' };
}
