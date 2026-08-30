/**
 * DocumentIndex — CEO Business Doctrine §12, §46, §47, §91.
 *
 * The PetWash-side INDEX of fiscal + receipt + agreement documents.
 * SUMIT remains the fiscal authority (§46) — this module tracks
 * document handles + status so the app can say "Receipt available"
 * without pretending it generated the official document.
 *
 * Two customer-facing surfaces consume this:
 *   Pet Parent → Documents & Receipts (§12.1)
 *   Provider   → Earnings & Payouts (§12.3)
 *
 * §47 discipline: a customer receipt NEVER surfaces in provider
 * earnings even when the human is both.
 */

export type DocumentDomain =
  | 'BOOKING'
  | 'SHOP'
  | 'K9000'
  | 'EGIFT'
  | 'REFUND'
  | 'PROVIDER_EARNINGS'
  | 'AGREEMENT';

export type FiscalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'ISSUED'
  | 'FAILED'
  | 'CREDIT_PENDING'
  | 'CREDIT_ISSUED';

export type OfficialProvider = 'SUMIT' | 'INTERNAL';

export interface DocumentIndexEntry {
  documentId: string;                  // internal handle (uuid-ish)
  transactionId: string;
  jobRef: string;                      // PW-XXX-YYYY
  domain: DocumentDomain;
  ownerUid: string;                    // party the document belongs to (buyer/provider)
  documentStatus: FiscalStatus;
  issuedAt?: string;                   // ISO — set on ISSUED / CREDIT_ISSUED
  amountCents: number;
  currency: 'ILS';
  officialProvider: OfficialProvider;
  externalDocumentRef?: string;        // SUMIT document id
  externalDocumentUrl?: string;        // customer-facing SUMIT portal URL
}

// ── Customer / Provider filter surfaces (§12.1, §12.3) ───────────────

export type CustomerDocumentFilter =
  | 'ALL'
  | 'BOOKINGS'
  | 'SHOP'
  | 'K9000'
  | 'EGIFT'
  | 'REFUNDS';

export type ProviderDocumentFilter = 'ALL' | 'EARNINGS' | 'PAYOUTS' | 'DOCUMENTS';

export function categoryForCustomer(domain: DocumentDomain): CustomerDocumentFilter {
  switch (domain) {
    case 'BOOKING':
      return 'BOOKINGS';
    case 'SHOP':
      return 'SHOP';
    case 'K9000':
      return 'K9000';
    case 'EGIFT':
      return 'EGIFT';
    case 'REFUND':
      return 'REFUNDS';
    default:
      return 'ALL';
  }
}

/**
 * §47 discipline: a customer receipt NEVER surfaces in provider
 * earnings — even when the human is both. The filter refuses to
 * return non-earnings entries in a provider-earnings request.
 */
export function filterCustomerDocuments(
  entries: DocumentIndexEntry[],
  ownerUid: string,
  category: CustomerDocumentFilter,
): DocumentIndexEntry[] {
  const mine = entries.filter(
    (e) => e.ownerUid === ownerUid && e.domain !== 'PROVIDER_EARNINGS',
  );
  if (category === 'ALL') return mine;
  return mine.filter((e) => categoryForCustomer(e.domain) === category);
}

export function filterProviderDocuments(
  entries: DocumentIndexEntry[],
  providerUid: string,
): DocumentIndexEntry[] {
  return entries.filter(
    (e) => e.ownerUid === providerUid && e.domain === 'PROVIDER_EARNINGS',
  );
}

// ── Status derivation (§12.2) ─────────────────────────────────────────

/**
 * "Receipt available" gate the UI uses to decide whether to link out
 * to SUMIT. The app can show "Receipt available" only when the fiscal
 * engine actually issued.
 */
export function isReceiptAvailable(entry: DocumentIndexEntry): boolean {
  return (
    (entry.documentStatus === 'ISSUED' ||
      entry.documentStatus === 'CREDIT_ISSUED') &&
    Boolean(entry.externalDocumentRef)
  );
}

/**
 * Human-friendly status label. Never expose raw enum text to the UI —
 * always map through this helper so translations + accessibility copy
 * live in one place.
 */
export function labelForStatus(status: FiscalStatus): string {
  switch (status) {
    case 'NOT_REQUIRED':
      return 'No document required';
    case 'PENDING':
      return 'Receipt being prepared';
    case 'ISSUED':
      return 'Receipt available';
    case 'FAILED':
      return 'Receipt issue — support notified';
    case 'CREDIT_PENDING':
      return 'Credit note being prepared';
    case 'CREDIT_ISSUED':
      return 'Credit note available';
  }
}

/**
 * §46 discipline: the app must NOT generate an official document; it
 * only INDEXES the one SUMIT (or another approved provider) issued.
 * This guard refuses to persist an ISSUED entry that carries no
 * externalDocumentRef — a placeholder receipt is a defect.
 */
export function isPersistable(entry: DocumentIndexEntry): boolean {
  if (
    (entry.documentStatus === 'ISSUED' ||
      entry.documentStatus === 'CREDIT_ISSUED') &&
    !entry.externalDocumentRef
  ) {
    return false;
  }
  return true;
}
