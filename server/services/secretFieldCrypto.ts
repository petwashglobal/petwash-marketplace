/**
 * secretFieldCrypto — AES-256-GCM Field-Level Encryption for Treasury Secrets
 * ==============================================================================
 * Encrypts sensitive treasury fields (IBAN, account number) before DB write.
 * Decrypts only inside the TreasuryConfigService — never in routes or UI layers.
 *
 * SECURITY RULES:
 *  ▸ Uses AES-256-GCM (authenticated encryption — detects tampering).
 *  ▸ A fresh 16-byte IV is generated per encryption call.
 *  ▸ The auth tag is stored alongside ciphertext to guarantee integrity on decrypt.
 *  ▸ In production, `TREASURY_FIELD_ENCRYPTION_KEY` MUST be set in secrets manager.
 *    If missing in production the process throws immediately (fail-closed).
 *  ▸ In development/test without the key set, a random ephemeral key is used and a
 *    loud warning is logged. Encrypted values from this key cannot be decrypted
 *    after restart — acceptable only in dev, never in production.
 *  ▸ Ciphertext is stored as `<iv_hex>:<authTag_hex>:<cipher_hex>` — all hex,
 *    colon-separated, no base64 ambiguity.
 *  ▸ Never log plaintext values. Never return them from this module.
 *
 * Required env var:
 *   TREASURY_FIELD_ENCRYPTION_KEY — 64 hex chars (= 32 bytes = 256-bit AES key).
 *   Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Israeli regulatory note:
 *  ▸ Encryption at rest of financial account identifiers is required under the
 *    Israeli Privacy Protection Regulations (Data Security) 5777-2017, Article 9
 *    ("Protection of sensitive databases").
 *  ▸ Bank of Israel Cyber Directive 06/2017 requires that account credentials be
 *    encrypted at rest with a modern authenticated cipher.
 */

import crypto from 'crypto';
import { logger } from '../lib/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

// ── Key bootstrap ─────────────────────────────────────────────────────────────

function bootstrapKey(): Buffer {
  const hexKey = process.env.TREASURY_FIELD_ENCRYPTION_KEY;

  if (!hexKey || hexKey.length < KEY_BYTES * 2) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Hard fail in production — payouts should not run without encryption
      const msg =
        '[secretFieldCrypto] FATAL: TREASURY_FIELD_ENCRYPTION_KEY is not set or too short ' +
        'in production. Set a 64-hex-char key in secrets manager. Refusing to start.';
      logger.error(msg);
      throw new Error(msg);
    }

    // Dev / test only: ephemeral random key
    logger.warn(
      '[secretFieldCrypto] TREASURY_FIELD_ENCRYPTION_KEY not set — ' +
        'using ephemeral key. Encrypted treasury fields will NOT survive server restart. ' +
        'Set TREASURY_FIELD_ENCRYPTION_KEY for any persistent environment.',
    );
    return crypto.randomBytes(KEY_BYTES);
  }

  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `[secretFieldCrypto] TREASURY_FIELD_ENCRYPTION_KEY must be exactly ${KEY_BYTES * 2} hex chars (${KEY_BYTES} bytes).`,
    );
  }
  return key;
}

// Lazily initialised so that tests that don't touch treasury can run without the key.
let _keyCache: Buffer | null = null;
function getKey(): Buffer {
  if (!_keyCache) _keyCache = bootstrapKey();
  return _keyCache;
}

// ── Encrypted format ──────────────────────────────────────────────────────────
// Stored as:  <iv_hex>:<authTag_hex>:<cipher_hex>
// All components are lowercase hex strings.

const SEPARATOR = ':';
const ENCRYPTED_PREFIX = 'enc:v1:';   // Version tag — allows future key rotation detection

/**
 * Encrypt a sensitive string field for DB storage.
 * Returns a single opaque string: `enc:v1:<iv_hex>:<authTag_hex>:<cipher_hex>`.
 *
 * @throws if the value is empty.
 */
export function encryptField(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') {
    throw new Error('[secretFieldCrypto] Cannot encrypt empty string');
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();   // 16 bytes, always

  return (
    ENCRYPTED_PREFIX +
    iv.toString('hex') + SEPARATOR +
    authTag.toString('hex') + SEPARATOR +
    encrypted.toString('hex')
  );
}

/**
 * Decrypt a field previously encrypted with `encryptField`.
 * Returns the original plaintext string.
 *
 * @throws if the ciphertext is malformed or the auth tag does not match
 *         (i.e. tampering is detected).
 */
export function decryptField(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('[secretFieldCrypto] Invalid ciphertext format — missing version prefix');
  }

  const body = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const parts = body.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error('[secretFieldCrypto] Invalid ciphertext format — expected iv:authTag:cipher');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuf = Buffer.from(encryptedHex, 'hex');

  // authTagLength: 16 rejects forged shorter tags
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedBuf).toString('utf8') + decipher.final('utf8');
  } catch {
    throw new Error(
      '[secretFieldCrypto] Decryption failed — ciphertext may have been tampered with ' +
        '(AES-GCM auth tag mismatch)',
    );
  }

  return decrypted;
}

/**
 * Returns true if the value appears to be an encrypted token (has the version prefix).
 * Use this to detect already-encrypted values before re-encrypting on update.
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

// ── Display masking helpers ───────────────────────────────────────────────────
// These operate on PLAINTEXT (after decryption) and produce safe display strings.
// They must never be called with ciphertext.

/**
 * Mask an Israeli IBAN for admin display.
 * Input:  'IL410200000082008526526'
 * Output: 'IL41 **** **** **** **** 526'
 */
export function maskIban(iban: string): string {
  if (!iban || iban.length < 8) return '****';
  const clean = iban.replace(/\s/g, '');
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-3);
  const middleLen = Math.max(0, clean.length - 7);
  const groups = Math.ceil(middleLen / 4);
  const masked = Array(groups).fill('****').join(' ');
  return `${prefix} ${masked} ${suffix}`;
}

/**
 * Mask a bank account number — show only last 3 digits.
 * Input:  '082526'
 * Output: '***526'
 */
export function maskAccountNumber(account: string): string {
  if (!account || account.length < 4) return '***';
  return '***' + account.slice(-3);
}

/**
 * Mask a SWIFT/BIC code — show only first 4 chars.
 * Input:  'MIZBILIT'
 * Output: 'MIZB****'
 */
export function maskSwift(swift: string): string {
  if (!swift || swift.length < 5) return '****';
  return swift.slice(0, 4) + '*'.repeat(swift.length - 4);
}
