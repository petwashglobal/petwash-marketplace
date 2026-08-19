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
 *    below — only aggregated arrays. The mapping row stays server-side.
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

export interface SumitFinancialsSummary {
  /** Whether SUMIT was reachable AND a mapping row existed. When false the two arrays are always empty. */
  available: boolean;
  savedMethods: unknown[];
  documents: unknown[];
  /** Diagnostic reason surfaced to logs — never rendered to the customer. */
  reason?: string;
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
    savedMethods: methodsRes.items || [],
    documents: docsRes.items || [],
  };
}
