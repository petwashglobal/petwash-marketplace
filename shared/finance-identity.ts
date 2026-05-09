/**
 * Pet Wash Ltd — canonical LEGAL IDENTITY (PR-G).
 *
 * Single source of truth for the public-facing legal identifiers that
 * appear on every customer-visible invoice, receipt, email footer,
 * SEO JSON-LD, admin audit response, and Hebrew "עוסק מורשה" line.
 *
 * Verified with the Israeli incorporation certificate:
 *   • Legal entity (English): PET WASH LTD
 *   • Legal entity (Hebrew):  פט וואש בע"מ
 *   • Israeli company number: 517145033 (also serves as VAT registration
 *     number for the עוסק מורשה / authorised dealer status)
 *   • Incorporated:           02/04/2025
 *
 * BOUNDARIES — what lives here vs what lives elsewhere
 * ─────────────────────────────────────────────────────
 *  ✓ Lives here  — public legal identifiers (always printed on invoices,
 *                  visible in SEO metadata, used in document headers).
 *                  These are NOT secrets.
 *  ✗ Lives elsewhere — banking identity (account number, IBAN, SWIFT,
 *                  branch). That data is sensitive and encrypted at rest
 *                  via server/services/TreasuryConfigService.ts (AES-256-GCM
 *                  with audit trail per טיוטת הוראות הגנת הפרטיות 5777-2017).
 *                  Never put bank account / IBAN constants in this file.
 *  ✗ Lives elsewhere — provider tax-status snapshots (per-provider authorised
 *                      vs exempt dealer state at payout time). Future Part 1.5
 *                      of the Financial Core Architecture Spec owns that.
 *
 * Hard rule: do NOT hardcode the company tax id (or any of these constants)
 * anywhere else in services/routes/controllers. Read from this module.
 *
 * Historical correction note: prior to PR-G a stale tax id (516788400) was
 * hardcoded across 13 sites. Receipts issued under the wrong identifier
 * require a corrective credit-note path; that strategy is owned by Part 6
 * (Refunds & Credit Notes) of the Financial Core Architecture Spec and
 * is intentionally out of scope for PR-G.
 */

export const COMPANY_TAX_ID = '517145033';

/** Israeli company number is also the VAT registration number for an עוסק מורשה. */
export const COMPANY_VAT_NUMBER = COMPANY_TAX_ID;

export const COMPANY_NAME_EN = 'PET WASH LTD';

export const COMPANY_NAME_HE = 'פט וואש בע"מ';

/** Plain legal-entity-identifier shape used in some accounting exports + JSON-LD. */
export const COMPANY_LEI_CODE = `IL-${COMPANY_TAX_ID}`;

/** Israeli-format authorised-dealer line (Hebrew). Always printed on invoices. */
export function getCompanyVatLineHe(): string {
  return `עוסק מורשה: ${COMPANY_TAX_ID}`;
}

/** Authorised-dealer line (English). Used in English-locale invoices + emails. */
export function getCompanyVatLineEn(): string {
  return `VAT No: ${COMPANY_TAX_ID}`;
}

/** Single-line audit/header label used by admin tools and PDF metadata. */
export function getCompanyAuditLabel(): string {
  return `${COMPANY_NAME_EN} (VAT ${COMPANY_TAX_ID})`;
}

export function getCompanyTaxId(): string {
  return COMPANY_TAX_ID;
}
