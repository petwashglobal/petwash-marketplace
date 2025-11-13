/**
 * Frontend VAT Calculator Helper
 * Matches server/services/VATCalculatorService.ts logic for display purposes
 * Israeli VAT: 18% (effective Jan 1, 2025)
 * Applied ONLY to platform commission (15%), NOT to base service rate
 */

export const ISRAELI_VAT_RATE = 0.18;
export const PLATFORM_COMMISSION_RATE = 0.15;

export interface VATCalculation {
  baseAmount: number;
  commission: number;
  vatOnCommission: number;
  totalCharged: number;
  netToProvider: number;
}

export class VATCalculator {
  calculateVAT(baseAmount: number, commissionRate: number = PLATFORM_COMMISSION_RATE): VATCalculation {
    const commission = baseAmount * commissionRate;
    const vatOnCommission = commission * ISRAELI_VAT_RATE;
    const totalCharged = baseAmount + commission + vatOnCommission;
    const netToProvider = baseAmount;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      vatOnCommission: Math.round(vatOnCommission * 100) / 100,
      totalCharged: Math.round(totalCharged * 100) / 100,
      netToProvider: Math.round(netToProvider * 100) / 100,
    };
  }

  getCurrentRate(): number {
    return ISRAELI_VAT_RATE * 100; // Return as percentage (18)
  }

  roundToCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  calculateVATAmount(netAmount: number): number {
    const commission = netAmount * PLATFORM_COMMISSION_RATE;
    return Math.round(commission * ISRAELI_VAT_RATE * 100) / 100;
  }

  calculateTotalWithVAT(netAmount: number): number {
    const commission = netAmount * PLATFORM_COMMISSION_RATE;
    const vat = commission * ISRAELI_VAT_RATE;
    return Math.round((netAmount + commission + vat) * 100) / 100;
  }
}

export const vatCalculator = new VATCalculator();
