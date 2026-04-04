export function isUnauthorizedError(error: Error): boolean {
  return /^401:/.test(error.message);
}

/**
 * Normalize a phone number to E.164 format.
 * Matches Israeli local format: 05XXXXXXXX (10 digits starting with 0)
 * e.g. 0501234567 → +972501234567, 050123456 → +97250123456
 * Strings that are already E.164 (+...) are returned unchanged.
 */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim();
  if (/^0[1-9]\d{7,8}$/.test(trimmed)) {
    return '+972' + trimmed.slice(1);
  }
  return trimmed;
}
