/**
 * Phone-number HMAC lookup key (AUDIT-SMS-14 / #225).
 *
 * `users.phone`, `otp_events.phone_e164`, `sms_evidence.to_phone` and
 * ~15 other tables carry the subscriber's full E.164 phone number
 * unhashed. That is fine for the *sender* — Twilio needs the string
 * to actually text — but it means a DB read grants an attacker the
 * user's real number, and a leaked backup exposes every subscriber's
 * phone. The audit's ask: separate the *lookup key* (what you index
 * on to find "does this number belong to a user?") from the *raw
 * value* (what you hand to Twilio at send-time).
 *
 * This module is the lookup key half:
 *
 *   `phoneLookupHash(e164)` → 64-hex HMAC-SHA-256 of the normalised
 *   phone under a server-side secret (PHONE_HMAC_SECRET, or the
 *   canonical DOCUMENT_ENCRYPTION_KEY as a fallback anchor). Callers
 *   store this in a `phone_hash` column and query on it; a leaked DB
 *   dump gives an attacker only the hash — unusable for reverse
 *   lookup without the secret.
 *
 *   Normalisation: strip everything except digits (drop `+`, spaces,
 *   dashes, parens). That keeps two representations of the same
 *   number (`+972-54-123-4567` vs `+972541234567`) hashing to the
 *   same key. E.164 canonicalisation (leading `+`, country code)
 *   is the caller's responsibility BEFORE hashing — a naked
 *   national-format `0541234567` would hash differently from
 *   `+972541234567`, which is intentional (they are not the same
 *   deliverable target).
 *
 * Secret rotation: swap PHONE_HMAC_SECRET → recompute the column via
 * a backfill script. The migration adds the column nullable so a
 * rotation without downtime is possible (write both under a flag,
 * then flip reads). Not needed for the initial land.
 *
 * Failure semantics: no secret → throws in production, warns in
 * non-prod (same shape as piiFieldCrypto). A caller that ignored
 * the throw and stored `null` would still be safe (the write only
 * lands the raw phone), but the lookup would silently miss — so
 * the throw is the right prod behaviour.
 */
import * as crypto from 'crypto';
import { logger } from './logger';

const PHONE_HMAC_ANCHOR = 'petwash-phone-hmac-v1';

let cachedSecret: string | null = null;
function phoneHmacSecret(): string {
  if (cachedSecret !== null) return cachedSecret;
  const raw = process.env.PHONE_HMAC_SECRET || process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[phoneHmac] PHONE_HMAC_SECRET (or DOCUMENT_ENCRYPTION_KEY as fallback) is required in production',
      );
    }
    logger.warn('[phoneHmac] no PHONE_HMAC_SECRET — using ephemeral anchor (non-production only)');
    cachedSecret = PHONE_HMAC_ANCHOR;
    return cachedSecret;
  }
  cachedSecret = raw;
  return cachedSecret;
}

/**
 * Strip everything except digits so `+972-54-123-4567` and
 * `+972541234567` and `+972 54 123 4567` all hash to the same key.
 */
function normaliseDigits(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Return the 64-hex HMAC-SHA-256 lookup hash for a normalised phone.
 * Callers MUST pass an already-canonical E.164 string (with country
 * code, leading `+`); the helper only strips punctuation.
 *
 * Returns null when the input is falsy or has no digits — a caller
 * writing a nullable phone column should treat null as "no lookup
 * key to store" and skip the write.
 */
export function phoneLookupHash(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = normaliseDigits(e164);
  if (!digits) return null;
  return crypto
    .createHmac('sha256', phoneHmacSecret())
    .update(digits)
    .digest('hex');
}

/**
 * Batch variant — hashes a list of phone strings in one pass. Returns
 * a map so a caller can zip results back to their source rows without
 * a second pass. Skips null / empty entries silently.
 */
export function phoneLookupHashMany(e164s: Array<string | null | undefined>): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of e164s) {
    if (!raw) continue;
    const h = phoneLookupHash(raw);
    if (h) out.set(raw, h);
  }
  return out;
}
