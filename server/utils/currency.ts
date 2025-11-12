/**
 * Currency Minor Units Utility
 * 
 * Handles conversion of decimal amounts to minor currency units (cents, agora, yen, etc.)
 * for payment gateway integration across multiple countries.
 * 
 * ISO 4217 Standard Support:
 * - 2 decimal places: ILS, USD, EUR, GBP, CAD, AUD (most currencies)
 * - 0 decimal places: JPY, KRW (Japanese Yen, Korean Won)
 * - 3 decimal places: BHD, KWD, OMR, JOD (some Middle Eastern currencies)
 * 
 * Usage:
 * ```typescript
 * // Israeli Shekel (2 decimals)
 * toMinorUnit(50.00, 'ILS') // 5000 agora
 * 
 * // Japanese Yen (0 decimals)
 * toMinorUnit(5000, 'JPY') // 5000 yen
 * 
 * // Kuwaiti Dinar (3 decimals)
 * toMinorUnit(10.500, 'KWD') // 10500 fils
 * ```
 */

/**
 * ISO 4217 currency minor unit definitions
 * 
 * Key: ISO currency code
 * Value: Number of decimal places
 */
const CURRENCY_MINOR_UNITS: Record<string, number> = {
  // Zero decimal currencies (whole units only)
  JPY: 0, // Japanese Yen
  KRW: 0, // Korean Won
  VND: 0, // Vietnamese Dong
  CLP: 0, // Chilean Peso
  ISK: 0, // Icelandic Króna
  
  // Two decimal currencies (standard)
  ILS: 2, // Israeli New Shekel
  USD: 2, // US Dollar
  EUR: 2, // Euro
  GBP: 2, // British Pound
  CAD: 2, // Canadian Dollar
  AUD: 2, // Australian Dollar
  NZD: 2, // New Zealand Dollar
  CHF: 2, // Swiss Franc
  SEK: 2, // Swedish Krona
  NOK: 2, // Norwegian Krone
  DKK: 2, // Danish Krone
  PLN: 2, // Polish Złoty
  CZK: 2, // Czech Koruna
  HUF: 2, // Hungarian Forint
  RUB: 2, // Russian Ruble
  TRY: 2, // Turkish Lira
  ZAR: 2, // South African Rand
  BRL: 2, // Brazilian Real
  MXN: 2, // Mexican Peso
  INR: 2, // Indian Rupee
  CNY: 2, // Chinese Yuan
  HKD: 2, // Hong Kong Dollar
  SGD: 2, // Singapore Dollar
  MYR: 2, // Malaysian Ringgit
  THB: 2, // Thai Baht
  PHP: 2, // Philippine Peso
  IDR: 2, // Indonesian Rupiah
  
  // Three decimal currencies (rare)
  BHD: 3, // Bahraini Dinar
  KWD: 3, // Kuwaiti Dinar
  OMR: 3, // Omani Rial
  JOD: 3, // Jordanian Dinar
  TND: 3, // Tunisian Dinar
  LYD: 3, // Libyan Dinar
};

/**
 * Convert decimal amount to minor currency units (cents, agora, etc.)
 * 
 * @param amountDecimal - Amount in major currency units (e.g., 50.00 shekels)
 * @param currency - ISO 4217 currency code (e.g., 'ILS', 'USD', 'JPY')
 * @returns Amount in minor currency units (e.g., 5000 agora)
 * @throws Error if amount is invalid or NaN
 * 
 * @example
 * // Israeli Shekel
 * toMinorUnit(50.00, 'ILS') // 5000 agora
 * toMinorUnit('50.00', 'ILS') // 5000 agora
 * 
 * // US Dollar
 * toMinorUnit(99.99, 'USD') // 9999 cents
 * 
 * // Japanese Yen (no decimals)
 * toMinorUnit(5000, 'JPY') // 5000 yen
 */
export function toMinorUnit(
  amountDecimal: string | number,
  currency: string = 'ILS'
): number {
  // Get minor units for currency (default to 2 if unknown)
  const minorUnits = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 2;
  
  // Parse amount (handles both string and number)
  const amount = typeof amountDecimal === 'string' 
    ? parseFloat(amountDecimal) 
    : amountDecimal;
  
  // Validate amount
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid amount: "${amountDecimal}" is not a valid number`);
  }
  
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount: "${amountDecimal}" must be finite`);
  }
  
  if (amount < 0) {
    throw new Error(`Invalid amount: "${amountDecimal}" must be non-negative`);
  }
  
  // Convert to minor units
  const multiplier = Math.pow(10, minorUnits);
  const minorAmount = Math.round(amount * multiplier);
  
  return minorAmount;
}

/**
 * Convert minor currency units back to decimal amount
 * 
 * @param amountMinor - Amount in minor currency units (e.g., 5000 agora)
 * @param currency - ISO 4217 currency code (e.g., 'ILS', 'USD', 'JPY')
 * @returns Amount in major currency units (e.g., 50.00 shekels)
 * 
 * @example
 * // Israeli Shekel
 * fromMinorUnit(5000, 'ILS') // 50.00
 * 
 * // US Dollar
 * fromMinorUnit(9999, 'USD') // 99.99
 * 
 * // Japanese Yen (no decimals)
 * fromMinorUnit(5000, 'JPY') // 5000
 */
export function fromMinorUnit(
  amountMinor: number,
  currency: string = 'ILS'
): number {
  // Get minor units for currency (default to 2 if unknown)
  const minorUnits = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 2;
  
  // Validate amount
  if (Number.isNaN(amountMinor)) {
    throw new Error(`Invalid amount: "${amountMinor}" is not a valid number`);
  }
  
  if (!Number.isFinite(amountMinor)) {
    throw new Error(`Invalid amount: "${amountMinor}" must be finite`);
  }
  
  // Convert to major units
  const divisor = Math.pow(10, minorUnits);
  const majorAmount = amountMinor / divisor;
  
  return majorAmount;
}

/**
 * Format amount in minor units for display
 * 
 * @param amountMinor - Amount in minor currency units
 * @param currency - ISO 4217 currency code
 * @param locale - Locale for formatting (defaults to 'en-US')
 * @returns Formatted currency string
 * 
 * @example
 * formatMinorUnit(5000, 'ILS', 'he-IL') // '₪50.00'
 * formatMinorUnit(9999, 'USD', 'en-US') // '$99.99'
 * formatMinorUnit(5000, 'JPY', 'ja-JP') // '¥5,000'
 */
export function formatMinorUnit(
  amountMinor: number,
  currency: string = 'ILS',
  locale: string = 'en-US'
): string {
  const majorAmount = fromMinorUnit(amountMinor, currency);
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(majorAmount);
}

/**
 * Get the number of decimal places for a currency
 * 
 * @param currency - ISO 4217 currency code
 * @returns Number of decimal places (0, 2, or 3)
 */
export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 2;
}
