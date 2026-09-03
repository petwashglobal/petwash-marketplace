/**
 * PII/PAN Redaction Utilities
 * Ensures sensitive data is not logged or exposed
 */

import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

// Release freeze 2026-09-03 top-up: log-side redactor for arbitrary log
// contexts, wired into ServerLogger.formatLog so every logger.{info,warn,error}
// context is sanitized before it reaches stdout/Sentry. Callers that already
// pass a hand-sanitized shape (e.g. `phone: '***444'`) are safe — the helper
// only touches known sensitive keys and known PII-bearing patterns.

/** Field names whose VALUE is a hard secret and must be dropped. */
const SECRET_KEYS = new Set(
  [
    'password', 'passwd', 'secret', 'apikey', 'api_key',
    'token', 'accesstoken', 'access_token', 'idtoken', 'id_token',
    'refreshtoken', 'refresh_token', 'sessiontoken', 'session_token',
    'bearer', 'authorization', 'cookie', 'setcookie', 'set-cookie',
    'csrf', 'csrftoken', 'csrf_token', 'xcsrftoken', 'x-csrf-token',
    'privatekey', 'private_key', 'clientsecret', 'client_secret',
    'stripekey', 'stripe_key', 'sumitkey', 'sumit_key',
    'signature', 'sig', 'x-signature', 'nayaxsecret', 'nayax_secret',
    'otp', 'otpcode', 'otp_code', 'code', 'verificationcode', 'verification_code',
    'pin', 'pincode', 'pin_code',
    'cvv', 'cvc', 'securitycode', 'security_code',
    'cardnumber', 'card_number', 'pan', 'accountnumber', 'account_number',
  ].map((k) => k.toLowerCase()),
);

/** Field names whose value is a raw email. Redact rather than drop. */
const EMAIL_KEYS = new Set(
  ['email', 'useremail', 'user_email', 'toemail', 'to_email', 'fromemail', 'from_email'].map((k) =>
    k.toLowerCase(),
  ),
);

/** Field names whose value is a raw phone. Redact rather than drop. */
const PHONE_KEYS = new Set(
  ['phone', 'phonenumber', 'phone_number', 'msisdn', 'mobile', 'to', 'from', 'e164', 'phone_e164'].map((k) =>
    k.toLowerCase(),
  ),
);

const REDACTED_SECRET = '[redacted]';
const MAX_STRING_LEN = 512; // trim huge values (e.g. verbatim request bodies)
const MAX_RECURSION = 6;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Sanitize an arbitrary log context object so it can be safely written to
 * stdout / Sentry / any downstream. Non-destructive to the caller's object.
 * Runs recursively with a bounded depth so a pathological cyclic or deep
 * payload cannot pin the logger.
 */
export function redactLogContext<T = unknown>(input: T, depth = 0): T {
  if (input === null || input === undefined) return input;
  if (depth > MAX_RECURSION) return ('[deep]' as unknown) as T;

  if (typeof input === 'string') {
    return (input.length > MAX_STRING_LEN
      ? (input.slice(0, MAX_STRING_LEN) + '…')
      : input) as unknown as T;
  }
  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactLogContext(item, depth + 1)) as unknown as T;
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(input)) {
      const key = rawKey.toLowerCase();
      if (SECRET_KEYS.has(key)) {
        out[rawKey] = REDACTED_SECRET;
        continue;
      }
      if (EMAIL_KEYS.has(key) && typeof value === 'string') {
        out[rawKey] = redactEmail(value);
        continue;
      }
      if (PHONE_KEYS.has(key) && typeof value === 'string') {
        out[rawKey] = redactPhone(value);
        continue;
      }
      out[rawKey] = redactLogContext(value, depth + 1);
    }
    return out as unknown as T;
  }

  // Error / Buffer / non-plain object: stringify defensively, truncated.
  try {
    const s = String(input);
    return (s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) + '…' : s) as unknown as T;
  } catch {
    return ('[unserializable]' as unknown) as T;
  }
}

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
