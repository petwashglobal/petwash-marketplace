/**
 * PII/PAN Redaction Utilities
 * Ensures sensitive data is not logged or exposed
 */

import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

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
 * P0-AUDIT-LOG-STRATEGIC (task #208): the field-name allowlist the
 * ServerLogger.formatLog runs every context value through before
 * emitting to stdout/Sentry. A field whose (case-insensitive) name
 * matches any pattern is replaced with '[REDACTED]' — no substring
 * of the original leaks. Applied recursively; arrays walked
 * element-by-element.
 *
 * Distinct from payment-payload redaction (which only touches PAN /
 * CVV). This is the broader spec covering auth secrets, OTPs,
 * tokens, cookies, and identity ids.
 */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^password$/i,
  /^new_?password$/i,
  /^old_?password$/i,
  /^password_?hash$/i,
  /^otp$/i,
  /^otp_?code$/i,
  /^verification_?code$/i,
  /^code$/i,                                              // OTP short form
  /^token$/i,
  /^id_?token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^auth_?token$/i,
  /^bearer_?token$/i,
  /^session_?cookie$/i,
  /^custom_?token$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^api_?key$/i,
  /^secret$/i,
  /^client_?secret$/i,
  /^webhook_?secret$/i,
  /^id_?number$/i,                                        // Teudat Zehut
  /^national_?id$/i,
  /^teudat_?zehut$/i,
  /^iban$/i,
  /^bank_?account$/i,
  /^bank_?account_?number$/i,
  /^routing_?number$/i,
  /^card_?number$/i,
  /^cvv$/i,
  /^cvc$/i,
  /^pin$/i,
  /^pin_?code$/i,
];

/** Fields whose value is an email/phone but where we still want to keep
 * a masked form in logs (not delete outright, so operators can correlate
 * on last-4 / domain). */
const EMAIL_KEY_PATTERNS: readonly RegExp[] = [
  /^email$/i, /^new_?email$/i, /^old_?email$/i, /^recipient_?email$/i,
  /^sender_?email$/i, /^destination(_?email)?$/i, /^to(_?email)?$/i,
];
const PHONE_KEY_PATTERNS: readonly RegExp[] = [
  /^phone$/i, /^phone_?number$/i, /^phone_?e164$/i, /^mobile$/i,
  /^new_?phone$/i, /^old_?phone$/i, /^to_?phone$/i, /^recipient_?phone$/i,
];

function keyMatches(patterns: readonly RegExp[], key: string): boolean {
  for (const p of patterns) if (p.test(key)) return true;
  return false;
}

const REDACTOR_MAX_DEPTH = 6;

/**
 * Recursively scrub sensitive fields from a log context object.
 * NEVER mutates the input. Depth-capped so a pathological ref-cycle
 * or a giant nested object can't hang the logger.
 */
export function redactLogContext(value: unknown, depth = 0): unknown {
  if (depth > REDACTOR_MAX_DEPTH) return '[REDACTED_MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof Error) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactLogContext(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keyMatches(SENSITIVE_KEY_PATTERNS, k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (keyMatches(EMAIL_KEY_PATTERNS, k) && typeof v === 'string') {
      out[k] = redactEmail(v);
      continue;
    }
    if (keyMatches(PHONE_KEY_PATTERNS, k) && typeof v === 'string') {
      out[k] = redactPhone(v);
      continue;
    }
    out[k] = redactLogContext(v, depth + 1);
  }
  return out;
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
  const VAT_RATE = parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE)); // Israeli VAT rate from env
  
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
