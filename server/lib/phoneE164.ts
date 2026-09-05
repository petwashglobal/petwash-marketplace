/**
 * Canonical server-side E.164 phone normalisation.
 *
 * WHY THIS FILE EXISTS (auth/identity sprint 2026-09-05):
 * The normaliser used to live as a private function inside
 * `server/routes/auth-sms.ts`, so every OTHER server path that writes
 * `users.phone` (the generic profile PATCH, provider onboarding, the
 * booking-contact first-set) stored whatever string the client sent.
 * That produced two live inconsistencies:
 *
 *   1. `users.phone` is UNIQUE. `0541234567` and `+972541234567` are the
 *      same subscriber but two distinct rows — the unique index does not
 *      dedupe them, so the same human can hold two accounts.
 *   2. `users.phone_hash` (phoneLookupHash) hashes the string as given.
 *      A national-format write hashes differently from the E.164 write
 *      the SMS-login path computes, so the OTP-login lookup silently
 *      misses and the user "has no account".
 *
 * One normaliser, imported by every writer, is the fix. `auth-sms.ts`
 * delegates here so the login path and the profile path can never drift.
 *
 * Rules (Israel-first, international-safe):
 *   +<digits>        → kept as-is (already E.164)
 *   00<digits>       → +<digits>            (international access prefix)
 *   972XXXXXXXX(X)   → +972XXXXXXXX(X)      (country code, no plus)
 *   0XXXXXXXX(X)     → +972XXXXXXXX(X)      (Israeli national format)
 *   5XXXXXXXX        → +9725XXXXXXXX        (Israeli mobile, no leading 0)
 *   anything else    → returned unchanged (caller decides whether to reject)
 */

/** Strip formatting characters without touching digits or a leading `+`. */
function stripFormatting(raw: string): string {
  return raw.trim().replace(/[\s\-().]/g, '');
}

/**
 * Normalise a user-supplied phone string to E.164 where we can recognise it.
 * Never throws. Returns the input (formatting stripped) when the shape is
 * unrecognised — use {@link isE164} to decide whether to accept it.
 */
export function normalizePhoneE164(raw: string): string {
  const digits = stripFormatting(raw);
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (/^972\d{8,9}$/.test(digits)) return '+' + digits;
  if (/^0[1-9]\d{7,8}$/.test(digits)) return '+972' + digits.slice(1); // 0X… Israeli local
  if (/^5\d{8}$/.test(digits)) return '+972' + digits;                 // 5X… Israeli mobile w/o 0
  return digits || raw;
}

/** True when the value is a syntactically valid E.164 string. */
export function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
