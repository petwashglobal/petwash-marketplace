/**
 * ContactMaskingService — CEO PROGRAM 41 + doctrine PII discipline.
 *
 * Pure evaluator. Given a raw contact (email / phone / national id
 * / bank last4), returns a masked projection safe for display.
 * NEVER exposes raw contact detail through this projection.
 *
 * Callers use this whenever an actor is presented in a surface
 * where the other party MUST see who they're dealing with (booking
 * card, thread header, admin table) but MUST NOT see the raw
 * email/phone.
 */

/** Masks the local part of an email: alice@example.com → a•••e@example.com */
export function maskEmail(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const at = raw.indexOf('@');
  if (at < 1) return '';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (local.length <= 2) return `${local[0]}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}

/**
 * Masks an Israeli phone number to national format keeping the
 * carrier prefix + last two digits only: +972 50 123 4567 → 05• ••• •• 67
 */
export function maskIlPhone(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '';
  const last2 = digits.slice(-2);
  return `05• ••• •• ${last2}`;
}

/** Masks the account number keeping last 4. */
export function maskAccountNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  if (raw.length <= 4) return raw.padStart(4, '•');
  return `•••• •••• ${raw.slice(-4)}`;
}

/** Masks the Israeli national id keeping last 3 digits. */
export function maskNationalId(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `••••• ${digits.slice(-3)}`;
}

export interface MaskedContactBundle {
  emailMasked?: string;
  phoneMasked?: string;
  accountLast4Masked?: string;
  nationalIdMasked?: string;
}

export function maskContactBundle(input: {
  email?: string; phone?: string; accountNumber?: string; nationalId?: string;
}): MaskedContactBundle {
  return {
    emailMasked: input.email ? maskEmail(input.email) : undefined,
    phoneMasked: input.phone ? maskIlPhone(input.phone) : undefined,
    accountLast4Masked: input.accountNumber ? maskAccountNumber(input.accountNumber) : undefined,
    nationalIdMasked: input.nationalId ? maskNationalId(input.nationalId) : undefined,
  };
}
