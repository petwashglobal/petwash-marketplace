/**
 * Israel Compliance Configuration — 2026
 * ========================================
 * Central source of truth for all Israeli tax and legal compliance constants.
 *
 * ── CERTAIN (sourced from official ITA / government publications) ──────────────
 * The constants below are derived from:
 *   • ITA circular — VAT rate 18% effective 1.1.2025 (was 17%)
 *   • ITA Digital Invoice Law — SHAAM allocation threshold schedule
 *   • ITA Osek Patur ceiling 2026 — ₪122,833 (updated annually by CPI)
 *   • Income Tax Ordinance §164 — withholding tax mechanism
 *
 * ── POLICY SWITCHES (requires CPA sign-off) ──────────────────────────────────
 * Three decisions are NOT yet final and are represented as read-only policy
 * objects that can be updated without touching business logic:
 *
 *   AGENT_MODEL_POLICY       — disclosed vs undisclosed agent (VAT attribution model)
 *   OSEK_PATUR_VAT_POLICY    — whether Osek Patur status changes platform VAT liability
 *   WITHHOLDING_RATE_POLICY  — default withholding rate and fallback rules
 *
 * IMPORTANT: Do NOT hard-code any of the three policy values anywhere else in the
 * codebase. Import them from this file so a single change here propagates everywhere.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CERTAIN CONSTANTS (official sources, safe to hard-code)
// ─────────────────────────────────────────────────────────────────────────────

/** Israeli VAT rate (מע"מ) — 18% effective 1 January 2025 (ITA circular) */
export const ISRAEL_VAT_RATE = 0.18;

/** Osek Patur annual turnover ceiling for 2026 — ₪122,833 */
export const OSEK_PATUR_CEILING_ILS_2026 = 122_833;

// SHAAM Allocation Number thresholds — ITA Digital Invoice Law 2026
// Required on all tax invoices and credit notes whose ex-VAT amount exceeds
// the applicable threshold. Applies to both sides of a marketplace transaction.

/** Date from which the ₪10,000 threshold applies (Phase 1) */
export const SHAAM_PHASE1_START = new Date('2026-01-01T00:00:00Z');
/** Date from which the ₪5,000 threshold applies (Phase 2) */
export const SHAAM_PHASE2_START = new Date('2026-06-01T00:00:00Z');
/** Ex-VAT threshold in Phase 1 */
export const SHAAM_THRESHOLD_PHASE1_ILS = 10_000;
/** Ex-VAT threshold in Phase 2 */
export const SHAAM_THRESHOLD_PHASE2_ILS = 5_000;

/** PetWash Ltd company tax ID (ח.פ) */
export const COMPANY_TAX_ID = '517145033';
/** PetWash Ltd company name (English) */
export const COMPANY_NAME_EN = 'PET WASH LTD';
/** PetWash Ltd company name (Hebrew) */
export const COMPANY_NAME_HE = 'פט וואש בע"מ';

// ─────────────────────────────────────────────────────────────────────────────
// POLICY SWITCHES  (⚠️ pending CPA approval — do not finalise unilaterally)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POLICY 1 — Agent model
 *
 * 'disclosed'    — Platform acts as a named agent on behalf of the provider.
 *                  The provider is the legally-identified seller. Platform's VAT
 *                  obligation is limited to its commission margin.
 *
 * 'undisclosed'  — Platform is the legal seller from the customer's perspective.
 *                  Platform owes VAT on the full customer payment; it then
 *                  purchases the service from the provider and reclaims input VAT.
 *
 * ⚠️ THIS CHOICE MUST BE CONFIRMED BY A CPA / TAX LAWYER.
 * It has material impact on VAT reporting and on how provider invoices are handled.
 */
export type AgentModel = 'disclosed' | 'undisclosed';

export const AGENT_MODEL_POLICY: {
  readonly model: AgentModel;
  /** True while CPA sign-off is still pending. Prevents the engine from treating
   *  this as a finalised value in reconciliation reports. */
  readonly pendingCpaSignoff: boolean;
  readonly notes: string;
} = {
  model: 'undisclosed',          // current working assumption — matches VATCalculatorService comment
  pendingCpaSignoff: true,
  notes:
    'Working assumption: undisclosed agent (סוכן בלתי מגולה). ' +
    'VAT currently calculated on platform commission only. ' +
    'CPA must confirm whether this is the correct model before end of Q2-2026.',
};

/**
 * POLICY 2 — Osek Patur / platform VAT liability
 *
 * When a provider is an עוסק פטור (annual revenue < OSEK_PATUR_CEILING):
 *   - They cannot issue a חשבונית מס (tax invoice) to the platform.
 *   - Under certain interpretations this means the platform CANNOT reclaim
 *     the input-VAT embedded in the provider's portion of the customer price.
 *   - Under other interpretations it does not change the platform's VAT liability
 *     because the platform is the disclosed/undisclosed seller and the provider
 *     relationship is a separate service-purchase arrangement.
 *
 * ⚠️ BOTH the rule and its downstream monetary impact MUST be confirmed by a CPA.
 */
export const OSEK_PATUR_VAT_POLICY: {
  readonly platformCannotReclaimInputVatFromOsekPatur: boolean;
  readonly pendingCpaSignoff: boolean;
  readonly notes: string;
} = {
  platformCannotReclaimInputVatFromOsekPatur: true,  // conservative default
  pendingCpaSignoff: true,
  notes:
    'Conservative assumption: when provider is Osek Patur, platform treats the ' +
    "provider's share as not generating claimable input-VAT. " +
    'This may result in over-remittance of VAT. CPA must confirm exact treatment.',
};

/**
 * POLICY 3 — Default withholding tax rate (ניכוי מס במקור)
 *
 * In the absence of a valid Form 2542 certificate, the platform must deduct
 * withholding tax from provider payments. The statutory rate from Income Tax
 * Ordinance §164(a) can vary by payment type. The exact default applicable to
 * our marketplace model must be confirmed.
 *
 * Current working value: 20% — a common default for service payments.
 * Possible alternatives: 25%, 30%, or 0% (if exempt class applies).
 *
 * ⚠️ THIS RATE MUST BE CONFIRMED BY A CPA.
 */
export const WITHHOLDING_RATE_POLICY: {
  /** Default rate (0–1) applied when no valid Form 2542 cert is on file */
  readonly defaultRate: number;
  /** Rate applied when provider provides a valid Form 2542 cert (overridden per-cert) */
  readonly certOverrideEnabled: boolean;
  /** Whether to apply withholding to Osek Patur providers (some interpretations exempt them) */
  readonly applyToOsekPatur: boolean;
  readonly pendingCpaSignoff: boolean;
  readonly notes: string;
} = {
  defaultRate: 0.20,
  certOverrideEnabled: true,
  applyToOsekPatur: true,   // conservative: withhold until CPA says otherwise
  pendingCpaSignoff: true,
  notes:
    'Working default: 20%. ' +
    'Statutory alternatives are 25% (services) or 30% (some categories). ' +
    'CPA must confirm the exact category for marketplace sub-contractor payments. ' +
    'applyToOsekPatur=true is the conservative choice; confirm if Osek Patur are exempt.',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — compute SHAAM requirement given an ex-VAT amount and a date
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when a SHAAM allocation number is required for a document.
 * @param exVatAmountILS  The ex-VAT (before VAT) amount in ILS
 * @param invoiceDate     The date the document is issued (defaults to now)
 */
export function isShaamAllocationRequired(
  exVatAmountILS: number,
  invoiceDate: Date = new Date(),
): boolean {
  const abs = Math.abs(exVatAmountILS); // credit notes have negative amounts
  if (invoiceDate >= SHAAM_PHASE2_START) return abs > SHAAM_THRESHOLD_PHASE2_ILS;
  if (invoiceDate >= SHAAM_PHASE1_START) return abs > SHAAM_THRESHOLD_PHASE1_ILS;
  return false;
}

/**
 * Returns the quarterly period string "YYYY-QN" for Form 856 (withholding report).
 * @param date  Date within the period (defaults to now)
 */
export function getWithholdingPeriod(date: Date = new Date()): string {
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Resolve the effective withholding rate for a provider.
 * Checks Form 2542 certificate validity first; falls back to policy default.
 *
 * @param certExpiryDate   Expiry date stored in providerTaxCompliance.withholdingCertExpiryDate
 * @param certRate         Certified reduced rate (0–100, e.g. 5 for 5%) from providerTaxCompliance.withholdingCertRate
 * @param asOf             The date at which validity is checked (defaults to now)
 * @returns                Effective rate as a fraction (0–1)
 */
export function resolveWithholdingRate(
  certExpiryDate: Date | null | undefined,
  certRate: number | null | undefined,
  asOf: Date = new Date(),
): { rate: number; source: 'certificate' | 'policy_default'; certExpired: boolean } {
  const certIsValid =
    certExpiryDate != null &&
    certRate != null &&
    asOf <= certExpiryDate;

  if (certIsValid && certRate !== null && certRate !== undefined) {
    return { rate: certRate / 100, source: 'certificate', certExpired: false };
  }

  return {
    rate: WITHHOLDING_RATE_POLICY.defaultRate,
    source: 'policy_default',
    certExpired: certExpiryDate != null && asOf > certExpiryDate,
  };
}
