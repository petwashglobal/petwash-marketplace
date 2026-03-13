/**
 * Frontend VAT Calculator Helper — Israeli Marketplace (Wolt) Model
 * Aligns with server/services/VATCalculatorService.ts Mode B
 *
 * Israeli VAT: 18% (effective Jan 1, 2025)
 *
 * MARKETPLACE MODEL (Sitter Suite, Walk My Pet, Academy, PetTrek):
 *   • Customer pays the provider's listed price — no surcharges added on top
 *   • PetWash commission (15%) is extracted FROM the gross, not added on top
 *   • VAT (18%) is embedded inside the commission (18/118 extraction, not additive)
 *   • Provider nets: gross − commission
 *
 * Example — sitter listed at ₪150/night:
 *   grossCollectedILS  = ₪150.00  (customer pays this)
 *   commission         = ₪ 22.50  (15% extracted from gross)
 *   vatOnCommission    = ₪  3.43  (18/118 of ₪22.50 — owed to ITA)
 *   netToProvider      = ₪127.50  (gross − commission)
 *
 * WRONG (old additive):  totalCharged = ₪150 + ₪22.50 + ₪4.05 = ₪176.55 ← overcharges
 * CORRECT (Wolt model):  totalCharged = ₪150.00                            ← listed price
 */

export const ISRAELI_VAT_RATE = 0.18;
export const PLATFORM_COMMISSION_RATE = 0.15;

export interface VATCalculation {
  /** Gross the customer pays — equals the provider's listed price */
  grossCollectedILS: number;
  /** Platform commission extracted from the gross (not added on top) */
  commission: number;
  /**
   * VAT embedded inside the commission, owed by PetWash to ITA.
   * Calculated as commission × 18/118 (extraction, not addition).
   */
  vatOnCommission: number;
  /** Provider's net payout = gross − commission */
  netToProvider: number;

  // ── backward-compat aliases used in booking payloads ──────────────────────
  /** @deprecated alias for grossCollectedILS */
  totalCharged: number;
  /** @deprecated alias for grossCollectedILS — base IS the gross in Wolt model */
  baseAmount: number;
  /** @deprecated alias for vatOnCommission */
  vatAmount: number;
}

export class VATCalculator {
  /**
   * Compute marketplace VAT breakdown.
   * @param listedPriceILS  The price the provider set; this IS what the customer pays.
   * @param commissionRate  Platform cut (default 15%).
   */
  calculateVAT(
    listedPriceILS: number,
    commissionRate: number = PLATFORM_COMMISSION_RATE,
  ): VATCalculation {
    const gross = this.roundToCurrency(listedPriceILS);
    const commission = this.roundToCurrency(gross * commissionRate);
    // VAT is embedded inside the commission — extract at 18/118 (not additive 18%)
    const vatOnCommission = this.roundToCurrency(
      commission * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)),
    );
    const netToProvider = this.roundToCurrency(gross - commission);

    return {
      grossCollectedILS: gross,
      commission,
      vatOnCommission,
      netToProvider,
      // backward-compat aliases
      totalCharged: gross,
      baseAmount: gross,
      vatAmount: vatOnCommission,
    };
  }

  /** Returns the VAT rate as a percentage integer (18). */
  getCurrentRate(): number {
    return ISRAELI_VAT_RATE * 100;
  }

  roundToCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /** VAT embedded in the commission for a given gross amount. */
  calculateVATAmount(grossAmount: number): number {
    const commission = grossAmount * PLATFORM_COMMISSION_RATE;
    return this.roundToCurrency(commission * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));
  }

  /**
   * Total charged to the customer.
   * In the Wolt model this equals the listed price — nothing is added on top.
   */
  calculateTotalWithVAT(listedPriceILS: number): number {
    return this.roundToCurrency(listedPriceILS);
  }
}

export const vatCalculator = new VATCalculator();
