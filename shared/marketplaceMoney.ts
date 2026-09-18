/**
 * ONE MONEY MODEL FOR EVERY PET WASH™ MARKETPLACE JOB.
 *
 * CEO decision (2026-09-14, re-confirmed 2026-09-17): the way Rover, Mad Paws and
 * Wolt do it —
 *
 *   customer pays   = the provider's rate  +  the Pet Wash service fee
 *   provider gets   = the provider's rate, in full
 *   Pet Wash keeps  = the service fee (15% of the rate), VAT-inclusive
 *
 * The provider is the legal seller of the service and invoices the customer for
 * the rate. Pet Wash invoices only its own fee, and the 18% VAT Pet Wash owes is
 * inside that fee — never added on top of it, never charged on the provider's
 * money. (docs/finance/00-platform-role-model.md §0.6/§0.7.)
 *
 * Before this file the platform ran two models at once. booking_requests
 * (quoteEngine) put the fee ON TOP. Walk My Pet, Sitter Suite and their payment
 * services took it OUT of the rate — the customer paid ₪1,000 and the sitter
 * got ₪850. Same service, two different receipts, two different VAT bases.
 *
 * Worked example, ₪1,000 rate:
 *   customer pays ₪1,150 · provider gets ₪1,000 · Pet Wash fee ₪150
 *   of which VAT ₪22.88 (18/118) and Pet Wash net ₪127.12.
 *
 * CARD PROCESSING is NOT modelled here: it is charged by the clearing company on
 * whatever the card is charged for (₪1,150 above) and is a Pet Wash cost. Its
 * rate is not recorded in this codebase; see `cardProcessingCostCents` for the
 * arithmetic once the real rate is known.
 */
import { ISRAEL_VAT_RATE } from './israel-compliance-config';

/**
 * The Pet Wash service fee, as a share of the provider's rate.
 * Must equal PETWASH_COMMISSION_RATE in shared/schema.ts — not imported from
 * there because that file is the whole database schema and this one is small
 * enough to ship to the browser. A test pins the two together.
 */
export const MARKETPLACE_SERVICE_FEE_RATE = 0.15;

export interface MarketplaceSplit {
  /** What the provider charges for the job (their published rate), agorot. */
  rateCents: number;
  /** Pet Wash service fee, VAT-inclusive, charged on top. */
  serviceFeeCents: number;
  /** VAT Pet Wash owes — extracted from the fee (18/118), not added. */
  serviceFeeVatCents: number;
  /** Pet Wash's fee before VAT. */
  serviceFeeNetCents: number;
  /** What the customer pays = rate + fee. */
  customerTotalCents: number;
  /** What the provider is owed = the full rate. */
  providerPayoutCents: number;
}

/**
 * The split for one job. `rateCents` is the provider's rate AFTER any discount
 * the provider or a promo gives — the fee is a share of what is actually sold.
 */
export function splitMarketplaceJob(rateCents: number): MarketplaceSplit {
  // Non-finite (NaN, ±Infinity) or negative input prices at zero — a bad number
  // must never turn into a charge.
  const n = Number(rateCents);
  const rate = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  const serviceFeeCents = Math.round(rate * MARKETPLACE_SERVICE_FEE_RATE);
  const serviceFeeVatCents = Math.round(serviceFeeCents * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE)));
  return {
    rateCents: rate,
    serviceFeeCents,
    serviceFeeVatCents,
    serviceFeeNetCents: serviceFeeCents - serviceFeeVatCents,
    customerTotalCents: rate + serviceFeeCents,
    providerPayoutCents: rate,
  };
}

/**
 * Card-clearing cost on a charge, for reporting what Pet Wash actually keeps.
 * `clearingRate` is the clearing company's percentage as a fraction (0.015 for
 * 1.5%). It is charged on the WHOLE amount the card is charged for — including
 * the provider's share — which is why it belongs in Pet Wash's numbers.
 */
export function cardProcessingCostCents(chargedCents: number, clearingRate: number): number {
  if (!(clearingRate > 0)) return 0;
  return Math.round(Math.max(0, chargedCents) * clearingRate);
}

/**
 * What the acquirer actually costs Pet Wash on one charge — and what is left.
 *
 * WHY THIS IS NOT JUST `amount * rate` (2026-09-18):
 *
 * 1. Acquirer pricing is a PERCENTAGE PLUS A FIXED FEE per transaction. A
 *    percentage alone understates every small charge — on a ₪30 wash a fixed
 *    ₪0.50 is worth more than the percentage.
 * 2. The fee carries VAT, and Pet Wash RECLAIMS that VAT as input tax. The real
 *    expense is the fee NET of VAT. Booking the VAT-inclusive number as the cost
 *    overstates the expense and under-claims the input VAT — the accountant
 *    needs both figures separately.
 * 3. THE FEE IS CHARGED ON THE WHOLE AMOUNT THE CARD IS CHARGED, including the
 *    provider's share, but Pet Wash's income is only its service fee. So the
 *    clearing cost must be compared against the FEE, not against the total —
 *    which is the number that shows how much of the margin it eats.
 *
 * `netToPetWashCents` is therefore the honest bottom line of a marketplace job:
 * the service fee, less its own VAT, less the net clearing cost on the whole
 * charge.
 *
 * UNKNOWN IS A REAL ANSWER. Pet Wash's contract rate with the acquirer is not
 * published and is not recorded anywhere in this codebase, and SUMIT's clearing
 * reports do not carry a fee column at all (verified against SUMIT's own help
 * centre, 2026-09-18) — the deduction shows up on the acquirer's statement and
 * in the bank deposit. So when no rate is configured this returns
 * `known: false` with zero cost, and callers must SAY so rather than print a
 * guessed number in front of a bookkeeper.
 */
export interface AcquirerPricing {
  /** Percentage of the charge, as a fraction: 0.011 for 1.1%. */
  rate: number;
  /** Fixed per-transaction fee in agorot, before VAT. 0 when there is none. */
  fixedCents?: number;
  /** Whether the quoted rate/fixed fee already includes VAT. Israeli acquirers usually quote EX-VAT. */
  vatIncluded?: boolean;
}

export interface ClearingCost {
  /** false when no contract rate is configured — the caller must not invent one. */
  known: boolean;
  chargedCents: number;
  /** Total the acquirer deducts, VAT included. */
  feeCents: number;
  /** VAT inside that fee — reclaimable input tax, NOT an expense. */
  feeVatCents: number;
  /** The real expense: the fee net of its VAT. */
  feeNetCents: number;
  /** Pet Wash's fee, net of its own VAT, less the net clearing cost. */
  netToPetWashCents: number;
  /** Share of Pet Wash's net fee eaten by clearing, 0..1. Null when unknown. */
  shareOfFeeConsumed: number | null;
}

export function clearingCost(
  split: MarketplaceSplit,
  pricing: AcquirerPricing | null | undefined,
): ClearingCost {
  const charged = Math.max(0, Math.round(Number(split.customerTotalCents) || 0));
  const feeNetOfVat = split.serviceFeeNetCents;

  const rate = Number(pricing?.rate);
  const fixed = Math.max(0, Math.round(Number(pricing?.fixedCents) || 0));
  if (!pricing || !Number.isFinite(rate) || rate < 0 || (rate === 0 && fixed === 0)) {
    return {
      known: false,
      chargedCents: charged,
      feeCents: 0,
      feeVatCents: 0,
      feeNetCents: 0,
      netToPetWashCents: feeNetOfVat,
      shareOfFeeConsumed: null,
    };
  }

  const quoted = Math.round(charged * rate) + fixed;
  // Israeli acquirers quote ex-VAT; normalise both ways to one gross figure.
  const feeCents = pricing.vatIncluded === true
    ? quoted
    : Math.round(quoted * (1 + ISRAEL_VAT_RATE));
  const feeNetCents = Math.round(feeCents / (1 + ISRAEL_VAT_RATE));
  const feeVatCents = feeCents - feeNetCents;

  return {
    known: true,
    chargedCents: charged,
    feeCents,
    feeVatCents,
    feeNetCents,
    netToPetWashCents: feeNetOfVat - feeNetCents,
    shareOfFeeConsumed: feeNetOfVat > 0 ? feeNetCents / feeNetOfVat : null,
  };
}
