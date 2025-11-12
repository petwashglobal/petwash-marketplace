import type { Language } from './i18n';

/**
 * Format a number as Israeli Shekel (₪) currency
 * @param amount - The amount to format
 * @param language - The language for locale formatting ('he' or 'en')
 * @returns Formatted currency string
 */
export function formatILS(amount: number, language: Language): string {
  const locale = language === 'he' ? 'he-IL' : 'en-IL';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse a currency string back to a number
 * @param currencyString - String like "₪123.45" or "123.45"
 * @returns Parsed number
 */
export function parseILS(currencyString: string): number {
  // Remove currency symbols, spaces, and commas
  const cleaned = currencyString.replace(/[₪\s,]/g, '');
  return parseFloat(cleaned) || 0;
}
