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
    // ── AGENT-14 privacy lane (2026-09-05) additions ────────────────────────
    // Every key below was reachable via `{ body: req.body }` and passed
    // straight through the old key sets into stdout AND Sentry.
    // Identity documents (Israeli national ID / passport / licence).
    'nationalid', 'national_id', 'nationalidnumber', 'idnumber', 'id_number',
    'teudatzehut', 'teudat_zehut', 'passportnumber', 'passport_number',
    'licensenumber', 'license_number', 'driverslicense', 'drivers_license',
    // Bank / payout rails.
    'iban', 'bankaccount', 'bank_account', 'bankaccountnumber',
    'bank_account_number', 'routingnumber', 'routing_number', 'swift',
    'bic', 'sortcode', 'sort_code', 'branchnumber', 'branch_number',
    // Session / auth material beyond the generic 'token'.
    'sessioncookie', 'session_cookie', '__session', 'sessionid', 'session_id',
    'firebasetoken', 'firebase_token', 'customtoken', 'custom_token',
    'passkey', 'credentialid', 'credential_id', 'attestation', 'assertion',
    // Second factor / recovery.
    'mfasecret', 'mfa_secret', 'totp', 'totpsecret', 'totp_secret',
    'recoverycode', 'recovery_code', 'backupcode', 'backup_code',
    'resettoken', 'reset_token', 'magiclink', 'magic_link',
    // Redemption / hardware secrets.
    'qrtoken', 'qr_token', 'secrettoken', 'secret_token', 'signedjws',
    'machinesecret', 'machine_secret', 'terminalsecret', 'terminal_secret',
  ].map((k) => k.toLowerCase()),
);

/**
 * Field names that carry PII we still want to SEE in a shape (so operators can
 * correlate) but never in full. Masked, not dropped.
 */
const MASK_KEYS = new Set(
  [
    'address', 'address1', 'address2', 'addressline1', 'addressline2',
    'address_line_1', 'address_line_2', 'street', 'streetaddress',
    'street_address', 'homeaddress', 'home_address', 'fulladdress',
    'dob', 'dateofbirth', 'date_of_birth', 'birthdate', 'birth_date',
  ].map((k) => k.toLowerCase()),
);

/** Mask a free-text PII value down to a length hint. */
function maskValue(v: string): string {
  const t = v.trim();
  if (!t) return '[redacted]';
  return `${t.slice(0, 1)}***(${t.length})`;
}

/* ── Value-level scrubbing ──────────────────────────────────────────────────
 * Key-based redaction alone is not enough: the single most common real leak
 * is a STRING that happens to contain PII — above all `errorMessage`, where
 * Postgres writes
 *   duplicate key value violates unique constraint "users_email_key"
 *   DETAIL: Key (email)=(alice@example.co.il) already exists
 * That string was written verbatim to stdout and forwarded to Sentry.
 * These three patterns are deliberately narrow (very low false-positive rate)
 * and are applied to EVERY string value the logger sees.
 * ────────────────────────────────────────────────────────────────────────── */
const JWT_VALUE_RE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)?/g;
const EMAIL_VALUE_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** 13-19 digit run = card PAN / long account number (not a timestamp). */
const PAN_VALUE_RE = /\b\d{13,19}\b/g;
/** Israeli MSISDN in any of the shapes we store it. */
const IL_PHONE_VALUE_RE = /\+?972[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}\b/g;

/**
 * Scrub PII patterns out of a free-text string. Never throws; returns the
 * input unchanged when nothing matches (so ordinary log lines are untouched).
 */
export function scrubSensitiveText(input: string): string {
  if (!input) return input;
  try {
    return input
      .replace(JWT_VALUE_RE, '[jwt]')
      .replace(EMAIL_VALUE_RE, (m) => redactEmail(m))
      .replace(PAN_VALUE_RE, (m) => `****${m.slice(-4)}`)
      .replace(IL_PHONE_VALUE_RE, (m) => `+972***${m.replace(/\D/g, '').slice(-2)}`);
  } catch {
    return '[redacted]';
  }
}

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
    const scrubbed = scrubSensitiveText(input);
    return (scrubbed.length > MAX_STRING_LEN
      ? (scrubbed.slice(0, MAX_STRING_LEN) + '…')
      : scrubbed) as unknown as T;
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
      if (MASK_KEYS.has(key) && typeof value === 'string') {
        out[rawKey] = maskValue(value);
        continue;
      }
      out[rawKey] = redactLogContext(value, depth + 1);
    }
    return out as unknown as T;
  }

  // Error / Buffer / non-plain object: stringify defensively, truncated.
  try {
    const s = scrubSensitiveText(String(input));
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
