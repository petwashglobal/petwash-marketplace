/**
 * PII/PAN Redaction Utilities
 * Ensures sensitive data is not logged or exposed
 */

/**
 * Redact Primary Account Number (PAN) - credit card numbers
 * Shows only last 4 digits
 */
export function redactPAN(cardNumber: string | undefined): string {
  if (!cardNumber) return '****';
  
  // Remove all non-digits
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.length < 4) {
    return '****';
  }
  
  // Show only last 4 digits
  const lastFour = digits.slice(-4);
  return `****${lastFour}`;
}

/**
 * Redact email address
 * Shows only first 2 characters and domain
 */
export function redactEmail(email: string | undefined): string {
  if (!email) return '[redacted]';
  
  const parts = email.split('@');
  if (parts.length !== 2) return '[redacted]';
  
  const [local, domain] = parts;
  const redactedLocal = local.length > 2 
    ? `${local.substring(0, 2)}***` 
    : '**';
  
  return `${redactedLocal}@${domain}`;
}

/**
 * Redact phone number
 * Shows only last 3 digits
 */
export function redactPhone(phone: string | undefined): string {
  if (!phone) return '[redacted]';
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 3) return '***';
  
  const lastThree = digits.slice(-3);
  return `***${lastThree}`;
}

/**
 * Redact payment payload for logging
 * Removes sensitive financial data
 */
export function redactPaymentPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const redacted = { ...payload };
  
  // Common PAN field names
  const panFields = [
    'cardNumber',
    'card_number',
    'pan',
    'primary_account_number',
    'accountNumber',
    'account_number'
  ];
  
  // Common CVV field names
  const cvvFields = [
    'cvv',
    'cvc',
    'securityCode',
    'security_code'
  ];
  
  // Redact PAN fields
  panFields.forEach(field => {
    if (redacted[field]) {
      redacted[field] = redactPAN(redacted[field]);
    }
  });
  
  // Completely remove CVV fields
  cvvFields.forEach(field => {
    if (redacted[field]) {
      redacted[field] = '***';
    }
  });
  
  // Redact nested objects
  Object.keys(redacted).forEach(key => {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPaymentPayload(redacted[key]);
    }
  });
  
  return redacted;
}

/**
 * Calculate VAT fields for Israeli transactions
 * Israel VAT rate: 18% (as of Jan 2025, configurable via VAT_RATE env)
 */
export interface VATCalculation {
  grossAmount: number;    // Total including VAT
  vatRate: number;        // From environment (default 0.18)
  vatAmount: number;      // VAT portion
  netAmount: number;      // Amount before VAT
}

export function calculateVAT(grossAmount: number): VATCalculation {
  const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18'); // Israeli VAT rate from env
  
  // Gross = Net + VAT
  // Gross = Net * (1 + VAT_RATE)
  // Net = Gross / (1 + VAT_RATE)
  
  const netAmount = grossAmount / (1 + VAT_RATE);
  const vatAmount = grossAmount - netAmount;
  
  return {
    grossAmount: Number(grossAmount.toFixed(2)),
    vatRate: VAT_RATE,
    vatAmount: Number(vatAmount.toFixed(2)),
    netAmount: Number(netAmount.toFixed(2))
  };
}

/**
 * Format VAT fields for export (CSV/Excel)
 */
export function formatVATForExport(grossAmount: number): {
  'Gross Amount (ILS)': number;
  'VAT Rate (%)': number;
  'VAT Amount (ILS)': number;
  'Net Amount (ILS)': number;
} {
  const vat = calculateVAT(grossAmount);
  
  return {
    'Gross Amount (ILS)': vat.grossAmount,
    'VAT Rate (%)': vat.vatRate * 100,
    'VAT Amount (ILS)': vat.vatAmount,
    'Net Amount (ILS)': vat.netAmount
  };
}
