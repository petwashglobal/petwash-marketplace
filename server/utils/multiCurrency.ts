/**
 * 🏆 AIRWALLEX-STYLE MULTI-CURRENCY OPERATIONS
 * Real-time FX conversion, multi-currency wallets, API-first collections
 * Adopted from Airwallex's global payment infrastructure
 */

export type SupportedCurrency = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface CurrencyConversionRate {
  from: SupportedCurrency;
  to: SupportedCurrency;
  rate: number;
  lastUpdated: Date;
  provider: 'ECB' | 'BOI' | 'internal';
}

export interface MultiCurrencyWallet {
  userId: string;
  balances: {
    [K in SupportedCurrency]?: number;
  };
  preferredCurrency: SupportedCurrency;
  totalValueILS: number;
}

/**
 * Real-time FX rates (updated daily)
 * In production, fetch from ECB API or Airwallex
 */
export const FX_RATES: Record<SupportedCurrency, number> = {
  ILS: 1.0,      // Base currency
  USD: 0.27,     // $1 = ₪3.70
  EUR: 0.25,     // €1 = ₪4.00
  GBP: 0.21,     // £1 = ₪4.76
  CAD: 0.37,     // C$1 = ₪2.70
  AUD: 0.41,     // A$1 = ₪2.44
};

/**
 * Convert amount between currencies
 * Airwallex-style real-time conversion
 */
export function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): number {
  if (from === to) return amount;

  // Convert to ILS first (base currency)
  const amountInILS = amount / FX_RATES[from];

  // Convert from ILS to target currency
  const convertedAmount = amountInILS * FX_RATES[to];

  return Math.round(convertedAmount * 100) / 100;
}

/**
 * Display price in user's preferred currency
 * Show savings compared to traditional bank rates
 */
export function displayPriceInCurrency(
  baseAmountILS: number,
  targetCurrency: SupportedCurrency,
  options?: {
    showSavings?: boolean;
    bankFxMarkup?: number; // Traditional banks charge 3-5% markup
  }
): {
  amount: number;
  currency: SupportedCurrency;
  formatted: string;
  savingsVsBank?: string;
} {
  const converted = convertCurrency(baseAmountILS, 'ILS', targetCurrency);

  const symbols: Record<SupportedCurrency, string> = {
    ILS: '₪',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
  };

  const result = {
    amount: converted,
    currency: targetCurrency,
    formatted: `${symbols[targetCurrency]}${converted.toFixed(2)}`,
  };

  if (options?.showSavings && options.bankFxMarkup) {
    const bankAmount = converted * (1 + options.bankFxMarkup / 100);
    const savings = bankAmount - converted;
    return {
      ...result,
      savingsVsBank: `Save ${symbols[targetCurrency]}${savings.toFixed(2)} vs bank rates`,
    };
  }

  return result;
}

/**
 * Get virtual local bank account details
 * Airwallex provides local IBANs, routing numbers, etc.
 */
export function getVirtualBankAccount(
  userId: string,
  currency: SupportedCurrency
): {
  accountNumber: string;
  routingCode: string;
  swiftBic: string;
  currency: SupportedCurrency;
  accountName: string;
} {
  // In production, integrate with Airwallex API
  const mockAccounts = {
    USD: {
      accountNumber: `PW${userId.slice(0, 10)}US`,
      routingCode: '026009593', // US routing number
      swiftBic: 'AIRWUS33XXX',
      currency: 'USD' as SupportedCurrency,
      accountName: 'Pet Wash Ltd - USD Account',
    },
    EUR: {
      accountNumber: `IL${userId.slice(0, 18)}`,
      routingCode: 'IBAN',
      swiftBic: 'AIRWGB2LXXX',
      currency: 'EUR' as SupportedCurrency,
      accountName: 'Pet Wash Ltd - EUR Account',
    },
    GBP: {
      accountNumber: `PW${userId.slice(0, 8)}`,
      routingCode: '040004', // UK sort code
      swiftBic: 'AIRWGB21XXX',
      currency: 'GBP' as SupportedCurrency,
      accountName: 'Pet Wash Ltd - GBP Account',
    },
  };

  return mockAccounts[currency as 'USD' | 'EUR' | 'GBP'] || mockAccounts.USD;
}

/**
 * Calculate cross-border transaction fees
 * Transparent pricing like Airwallex
 */
export function calculateInternationalFees(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency
): {
  originalAmount: number;
  conversionFee: number;
  fxRate: number;
  finalAmount: number;
  savings: string;
} {
  const AIRWALLEX_FEE_RATE = 0.004; // 0.4% (vs 3-5% for traditional banks)
  const conversionFee = amount * AIRWALLEX_FEE_RATE;
  const amountAfterFee = amount - conversionFee;
  const finalAmount = convertCurrency(amountAfterFee, fromCurrency, toCurrency);

  // Traditional bank would charge 3% markup
  const traditionalBankFee = amount * 0.03;
  const savings = `Save ${((traditionalBankFee - conversionFee) / amount * 100).toFixed(1)}% vs banks`;

  return {
    originalAmount: amount,
    conversionFee,
    fxRate: FX_RATES[toCurrency] / FX_RATES[fromCurrency],
    finalAmount,
    savings,
  };
}
