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
  // Nayax's own worked example is 65 chars and the key is its LAST 32, so the
  // only hard rule is "at least 32". (An exact-64 check was tried 2026-09-12 and
  // broke the proven worked-example test — do not reintroduce it.)
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

// ─────────────────────────────────────────────────────────────────────────────
// Stateless StartSession TransactionId (issue + verify)
//
// The spec (devzone.nayax.com → Cortina → Start Session → Authentication
// Process, re-read 2026-09-12) makes the integrator validate that the
// TransactionId on a later /Authorization or /Sale "was created in a previous
// Start Session request and is still valid" (≤ 10 minutes recommended). Nothing
// else authenticates those callbacks: the Secret Token is used ONLY as the AES
// key and is never sent in a request body.
//
// We do that WITHOUT a table. The 36 numeric characters are laid out as
//
//     [10] unix seconds  [6] random nonce  [20] HMAC-SHA256(secret, ts|nonce) as digits
//
// so verification is a recompute-and-compare: no DB row, no sweep, nothing to
// leak. The HMAC keys on the full 64-char secret (the AES key uses its last 32
// chars — a different derivation, deliberately). Two bays scanning in the same
// second get different ids because of the nonce.
// ─────────────────────────────────────────────────────────────────────────────

export const START_SESSION_TXN_TTL_MS = 10 * 60 * 1000; // spec: "no longer than 10 minutes"
const TXN_TS_LEN = 10;
const TXN_NONCE_LEN = 6;
const TXN_MAC_LEN = 20;

function txnMac(secretToken: string, ts: string, nonce: string): string {
  const mac = crypto.createHmac('sha256', Buffer.from((secretToken || '').trim(), 'utf8'))
    .update(`${ts}|${nonce}`, 'utf8')
    .digest();
  // Fold the 32 MAC bytes into a 20-digit decimal string: read as a big integer
  // and take the low 20 digits. BigInt keeps it exact — no float rounding.
  const asDigits = BigInt('0x' + mac.toString('hex')).toString(10);
  return asDigits.slice(-TXN_MAC_LEN).padStart(TXN_MAC_LEN, '0');
}

/**
 * Mint a fresh 36-numeric TransactionId for a StartSession response. The
 * caller encrypts it with encryptStartSession(); Nayax decrypts and echoes it
 * as BasicInfo.TransactionId on the following Authorization / Sale.
 */
export function issueStartSessionTransactionId(secretToken: string, nowMs: number = Date.now()): string {
  if ((secretToken || '').trim().length < 32) throw new Error('cortina_secret_token_too_short');
  const ts = Math.floor(nowMs / 1000).toString().padStart(TXN_TS_LEN, '0').slice(-TXN_TS_LEN);
  const nonce = crypto.randomInt(0, 1_000_000).toString().padStart(TXN_NONCE_LEN, '0');
  const id = ts + nonce + txnMac(secretToken, ts, nonce);
  if (id.length !== 36) throw new Error('cortina_txn_id_layout_error');
  return id;
}

export type StartSessionTxnVerdict =
  | { ok: true; issuedAtMs: number }
  | { ok: false; reason: 'malformed' | 'bad_mac' | 'expired' | 'future' };

/**
 * Verify that a TransactionId presented on /Authorization or /Sale was minted
 * by issueStartSessionTransactionId() with OUR secret, and is still inside the
 * 10-minute window. Constant-time on the MAC compare.
 */
export function verifyStartSessionTransactionId(
  secretToken: string,
  transactionId: string,
  nowMs: number = Date.now(),
  ttlMs: number = START_SESSION_TXN_TTL_MS,
): StartSessionTxnVerdict {
  const id = String(transactionId || '').trim();
  if (!/^\d{36}$/.test(id) || (secretToken || '').trim().length < 32) return { ok: false, reason: 'malformed' };
  const ts = id.slice(0, TXN_TS_LEN);
  const nonce = id.slice(TXN_TS_LEN, TXN_TS_LEN + TXN_NONCE_LEN);
  const mac = id.slice(TXN_TS_LEN + TXN_NONCE_LEN);
  const expected = txnMac(secretToken, ts, nonce);
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad_mac' };
  const issuedAtMs = Number(ts) * 1000;
  if (issuedAtMs > nowMs + 60_000) return { ok: false, reason: 'future' }; // clock skew tolerance: 60s
  if (nowMs - issuedAtMs > ttlMs) return { ok: false, reason: 'expired' };
  return { ok: true, issuedAtMs };
}
