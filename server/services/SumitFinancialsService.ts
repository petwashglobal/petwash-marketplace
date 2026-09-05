/**
 * SumitFinancialsService — Item 8 of the CEO 2026-08-16 SUMIT Phase 2 lane.
 *
 * "One place PetWash asks SUMIT what a customer has on file."
 *
 * Given an authenticated PetWash uid, resolve the SUMIT CustomerID via the
 * sumit_customers mapping table, then call SumitClient.getForCustomer (saved
 * payment methods) and SumitClient.listDocumentsForCustomer (fiscal docs).
 *
 * Design ref: docs/design/2026-08-16-sumit-full-service-adoption.md
 *             docs/design/2026-08-16-sumit-transaction-matrix.md §7
 *
 * SAFETY CONTRACT:
 *  - The caller MUST supply the AUTHENTICATED uid — never a browser-supplied
 *    userId. The Express route derives uid from the Firebase session/token.
 *  - No sumit_customer_id or CustomerHistoryURL is ever returned in the shape
 *    below. The mapping row stays server-side, AND every array element is
 *    projected through an explicit allowlist (projectSavedMethod /
 *    projectDocument) — raw SUMIT item objects never reach the browser.
 *  - Fail-quiet:
 *      * SUMIT dormant (SUMIT_ENABLED unset or credentials missing) → returns
 *        { available:false, savedMethods:[], documents:[] } — no throw.
 *      * No sumit_customers row for this uid (customer sync hasn't fired yet) →
 *        returns { available:false, savedMethods:[], documents:[] } — no throw.
 *      * SUMIT returns non-2xx → returns whatever slice succeeded, empty array
 *        for the slice that failed, no throw.
 *  - READ-ONLY. Never touches money-side state (totalSpent, loyaltyPoints,
 *    walletAccounts.*). This is a display adapter only.
 */
import { getSumitCustomerId } from './SumitCustomerService';
import { SumitClient } from './SumitClient';
import { logger } from '../lib/logger';

const client = new SumitClient();

/** The ONLY payment-method fields that may reach the browser. */
export interface SumitSavedMethod {
  id: string;
  last4?: string;
  brand?: string;
  expiry?: string;
}

/** The ONLY document fields that may reach the browser. */
export interface SumitDocumentSummary {
  id: string;
  number?: string;
  type?: string;
  date?: string;
  amount?: number;
  url?: string;
}

export interface SumitFinancialsSummary {
  /** Whether SUMIT was reachable AND a mapping row existed. When false the two arrays are always empty. */
  available: boolean;
  savedMethods: SumitSavedMethod[];
  documents: SumitDocumentSummary[];
  /** Diagnostic reason surfaced to logs — never rendered to the customer. */
  reason?: string;
}

/**
 * Allowlist projections — SUMIT's raw item objects must never be forwarded.
 *
 * These arrays used to be typed unknown[] and returned verbatim, so every
 * field SUMIT chose to include on a payment method or document went straight
 * to the browser. That silently broke this file's own contract (see the header:
 * "No sumit_customer_id or CustomerHistoryURL is ever returned") — the promise
 * held for the top-level envelope, but not for anything nested inside an item.
 *
 * The field-name fallbacks mirror the client's former normalisers exactly, so
 * the rendered UI is unchanged; the difference is that an unrecognised field
 * is now DROPPED instead of forwarded. New SUMIT fields must be added here
 * deliberately.
 */
function projectSavedMethod(raw: any): SumitSavedMethod {
  return {
    id: String(raw?.PaymentMethodID ?? raw?.PaymentMethodId ?? raw?.ID ?? raw?.Id ?? raw?.id ?? ''),
    last4:  raw?.Last4Digits ?? raw?.Last4 ?? raw?.last4 ?? undefined,
    brand:  raw?.CardBrand ?? raw?.Brand ?? raw?.brand ?? undefined,
    expiry: raw?.Expiration ?? raw?.Expiry ?? raw?.expiration ?? raw?.expiry ?? undefined,
  };
}

function projectDocument(raw: any): SumitDocumentSummary {
  const amount = typeof raw?.TotalAmount === 'number' ? raw.TotalAmount
    : typeof raw?.Amount === 'number' ? raw.Amount
    : typeof raw?.amount === 'number' ? raw.amount
    : undefined;
  return {
    id:     String(raw?.DocumentID ?? raw?.ID ?? raw?.DocumentNumber ?? raw?.Number ?? raw?.id ?? ''),
    number: raw?.DocumentNumber ?? raw?.Number ?? raw?.number ?? undefined,
    type:   raw?.DocumentType ?? raw?.Type ?? raw?.type ?? undefined,
    date:   raw?.IssueDate ?? raw?.Date ?? raw?.CreatedAt ?? raw?.date ?? undefined,
    amount,
    // Per-document PDF link only. A customer-level history URL is never a
    // per-document field and cannot arrive here.
    url:    raw?.DocumentURL ?? raw?.URL ?? raw?.PdfURL ?? raw?.url ?? undefined,
  };
}

/**
 * @param uid  Firebase UID — must come from an authenticated request. Never
 *             accept from the browser's body/query/params.
 */
export async function getFinancialsSummary(uid: string): Promise<SumitFinancialsSummary> {
  if (!uid) {
    return { available: false, savedMethods: [], documents: [], reason: 'missing uid' };
  }

  // Fail-quiet when SUMIT is dormant. Health() reads env on every call.
  if (!client.isWired()) {
    return { available: false, savedMethods: [], documents: [], reason: 'sumit_not_wired' };
  }

  let sumitCustomerId: string | null;
  try {
    sumitCustomerId = await getSumitCustomerId(uid);
  } catch (err: any) {
    logger.warn('[SumitFinancials] mapping lookup failed', { uid, err: err?.message });
    return { available: false, savedMethods: [], documents: [], reason: 'mapping_lookup_failed' };
  }

  // No mapping row yet — customer sync hasn't fired for this uid. Empty arrays,
  // not a 500. The UI renders empty states honestly.
  if (!sumitCustomerId) {
    return { available: false, savedMethods: [], documents: [], reason: 'not_synced' };
  }

  // Fire both reads in parallel. Any failure yields an empty slice, never a
  // throw, so a docs-endpoint hiccup does not block the saved-methods view.
  const [methodsRes, docsRes] = await Promise.all([
    client.getForCustomer(sumitCustomerId).catch((err) => {
      logger.warn('[SumitFinancials] getForCustomer threw (unexpected)', { uid, err: err?.message });
      return { wired: false, items: [] as unknown[], reason: 'threw' };
    }),
    client.listDocumentsForCustomer(sumitCustomerId).catch((err) => {
      logger.warn('[SumitFinancials] listDocumentsForCustomer threw (unexpected)', { uid, err: err?.message });
      return { wired: false, items: [] as unknown[], reason: 'threw' };
    }),
  ]);

  return {
    available: true,
    savedMethods: (methodsRes.items || []).map(projectSavedMethod),
    documents:    (docsRes.items    || []).map(projectDocument),
  };
}
