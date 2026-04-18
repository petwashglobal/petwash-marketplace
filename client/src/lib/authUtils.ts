export function isUnauthorizedError(error: Error): boolean {
  return /^401:/.test(error.message);
}

/**
 * Normalize a phone number to E.164 format.
 * Handles Israeli local format: 05XXXXXXXX (10 digits starting with 0)
 * e.g. 0501234567 → +972501234567, 050-123-4567 → +972501234567
 * Strips common separators (dashes, spaces, dots, parentheses) before matching.
 * Strings already in E.164 (+...) are returned with separators stripped only.
 */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim();
  // Strip separators: dashes, spaces, dots, parentheses
  const digits = trimmed.replace(/[\s\-().]/g, '');
  // Already E.164 with + prefix — return cleaned form
  if (digits.startsWith('+')) {
    return digits;
  }
  // Israeli local format: 0[1-9] followed by 7-8 more digits (9-10 total)
  if (/^0[1-9]\d{7,8}$/.test(digits)) {
    return '+972' + digits.slice(1);
  }
  // Return the separator-stripped form so downstream validation gets clean digits
  return digits || trimmed;
}
