/**
 * Frontend price helper — the ONE marketplace money model
 * (shared/marketplaceMoney.ts, CEO 2026-09-17, the Rover / Mad Paws way):
 *
 *   customer pays  = provider's price + 15% Pet Wash service fee
 *   provider gets  = their price, in full
 *   VAT (18%)      = inside the fee (18/118), never added on top
 *
 * Example — trainer at ₪100/hour:
 *   grossCollectedILS = ₪115.00   commission = ₪15.00
 *   vatOnCommission   = ₪2.29     netToProvider = ₪100.00
 *
 * (Until 2026-09-17 this took the fee OUT of the price: ₪100 → trainer ₪85.)
 */
import { splitMarketplaceJob, MARKETPLACE_SERVICE_FEE_RATE } from '@shared/marketplaceMoney';

export const ISRAELI_VAT_RATE = 0.18;
export const PLATFORM_COMMISSION_RATE = MARKETPLACE_SERVICE_FEE_RATE;

export interface VATCalculation {
  /** What the customer pays = provider's price + fee */
  grossCollectedILS: number;
  /** Pet Wash service fee, added on top of the price (VAT inside) */
  commission: number;
  /**
   * VAT embedded inside the commission, owed by PetWash to ITA.
   * Calculated as commission × 18/118 (extraction, not addition).
   */
  vatOnCommission: number;
  /** Provider's payout = their whole price */
  netToProvider: number;

  // ── backward-compat aliases used in booking payloads ──────────────────────
  /** @deprecated alias for grossCollectedILS */
  totalCharged: number;
  /** The provider's price (before the fee) */
  baseAmount: number;
  /** @deprecated alias for vatOnCommission */
  vatAmount: number;
}

export class VATCalculator {
  /**
   * Compute marketplace VAT breakdown.
   * @param listedPriceILS  The price the provider set; the fee goes on top.
   */
  calculateVAT(listedPriceILS: number): VATCalculation {
    const s = splitMarketplaceJob(Math.round(listedPriceILS * 100));
    return {
      grossCollectedILS: s.customerTotalCents / 100,
      commission: s.serviceFeeCents / 100,
      vatOnCommission: s.serviceFeeVatCents / 100,
      netToProvider: s.providerPayoutCents / 100,
      totalCharged: s.customerTotalCents / 100,
      baseAmount: s.rateCents / 100,
      vatAmount: s.serviceFeeVatCents / 100,
    };
  }

  /** Returns the VAT rate as a percentage integer (18). */
  getCurrentRate(): number {
    return ISRAELI_VAT_RATE * 100;
  }

  roundToCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /** VAT inside the fee on a provider's price. */
  calculateVATAmount(listedPriceILS: number): number {
    return this.calculateVAT(listedPriceILS).vatOnCommission;
  }

  /** Total charged to the customer = price + fee. */
  calculateTotalWithVAT(listedPriceILS: number): number {
    return this.calculateVAT(listedPriceILS).totalCharged;
  }
}

export const vatCalculator = new VATCalculator();
