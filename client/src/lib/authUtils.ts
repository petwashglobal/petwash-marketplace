export function isUnauthorizedError(error: Error): boolean {
  return /^401:/.test(error.message);
}

/**
 * Normalise a phone number to E.164 format.
 * Accepts Israeli local format (05XXXXXXXX) and converts to +97250XXXXXXX.
 * Strings that are already E.164 (+...) are returned unchanged.
 */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim();
  if (/^0[1-9]\d{7,8}$/.test(trimmed)) {
    return '+972' + trimmed.slice(1);
  }
  return trimmed;
}
