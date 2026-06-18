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
  // International prefix typed as "00" (e.g. 00972…) → +…
  if (digits.startsWith('00')) {
    return '+' + digits.slice(2);
  }
  // Israeli country code typed without "+" (e.g. 972501234567) → +972…
  if (/^972\d{8,9}$/.test(digits)) {
    return '+' + digits;
  }
  // Israeli local format with leading 0: 0[1-9] + 7-8 digits (9-10 total)
  if (/^0[1-9]\d{7,8}$/.test(digits)) {
    return '+972' + digits.slice(1);
  }
  // Israeli MOBILE typed WITHOUT the leading 0: 5X + 7 digits (9 total).
  // BUGFIX 2026-06-18: previously this returned bare "5XXXXXXXX", the server
  // prepended "+" → "+5XXXXXXXX" which Twilio routed to the WRONG country and
  // the code never arrived (silent failure). Israeli mobile prefixes are 05[0-9].
  if (/^5\d{8}$/.test(digits)) {
    return '+972' + digits;
  }
  // Return the separator-stripped form so downstream validation gets clean digits
  return digits || trimmed;
}
