/**
 * Cortina Start Session — authentication handshake cipher.
 *
 * Used ONLY if Nayax configures our Cortina integration with the Start Session
 * security layer (the StaticQR Start flow can run without it; the TransactionId
 * fields say "Echoes the encrypted ID from /StartSession IF USED"). When it IS
 * used, Nayax sends a Token id + a 27-char Random String; we must:
 *
 *   1. Generate a 36-numeric-char TransactionId.
 *   2. Build ciphertext = `${TransactionId}=${RandomString}`  (64 chars).
 *   3. Derive the key from the LAST 32 chars of the 64-char Secret Token (256-bit).
 *   4. AES-256-ECB encrypt with PKCS5/PKCS7 padding → base64.
 *   5. Return that in the Start Session response; Nayax decrypts + checks the
 *      Random String round-trips.
 *
 * Source: Nayax dev portal → Cortina → Start Session → Authentication Process.
 * Verified against Nayax's own worked example in the unit test (deterministic —
 * no live credentials needed). The Secret Token is read from the environment by
 * the caller and is NEVER logged here.
 *
 * Security note: AES-ECB is Nayax's chosen scheme for this handshake (we do not
 * get to pick it). It is acceptable here because each payload is unique
 * (TransactionId is fresh per session) so ECB's block-repetition weakness does
 * not apply. Do NOT reuse this helper for anything else.
 */
import crypto from 'crypto';

/** The encryption key is the LAST 32 chars of the 64-char Secret Token (256-bit). */
export function startSessionKey(secretToken: string): Buffer {
  const t = (secretToken || '').trim();
  if (t.length < 32) throw new Error('cortina_secret_token_too_short');
  return Buffer.from(t.slice(-32), 'utf8'); // 32 bytes = AES-256 key
}

/** ciphertext input = `${transactionId}=${randomString}` per the spec. */
export function buildStartSessionPlaintext(transactionId: string, randomString: string): string {
  return `${transactionId}=${randomString}`;
}

/**
 * Encrypt the Start Session ciphertext exactly as Nayax expects:
 * AES-256-ECB + PKCS7(PKCS5) padding, base64 output.
 */
export function encryptStartSession(params: {
  secretToken: string;
  transactionId: string;
  randomString: string;
}): string {
  const key = startSessionKey(params.secretToken);
  const plaintext = buildStartSessionPlaintext(params.transactionId, params.randomString);
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  cipher.setAutoPadding(true); // PKCS7 (== PKCS5 for block ciphers)
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64');
}

/**
 * Generate a 36-numeric-character TransactionId (spec requirement). Caller must
 * persist it with a short TTL (spec recommends ≤10 min for Sale/Auth/Inquiry).
 * Uses crypto random digits — no Date.now()/Math.random() dependence on ordering.
 */
export function generateStartSessionTransactionId(): string {
  let s = '';
  while (s.length < 36) {
    // Each random byte → two decimal digits; trim to exactly 36.
    s += crypto.randomInt(0, 1_000_000_000).toString().padStart(9, '0');
  }
  return s.slice(0, 36);
}
