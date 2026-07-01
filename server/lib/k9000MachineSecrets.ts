/**
 * Per-machine K9000 HMAC secrets — encryption/generation helpers.
 *
 * Closes the 2026-07-01 secrets-audit finding: every K9000 kiosk previously
 * shared ONE global MACHINE_SECRET_KEY for HMAC request signing. A single
 * leaked secret (a technician laptop, a leaked config) would have compromised
 * every station simultaneously. Each kiosk now gets its own randomly-generated
 * secret, stored encrypted at rest in kiosk_machines.hmac_secret_encrypted.
 *
 * Reuses the existing, already-audited DocumentEncryption (AES-256-GCM,
 * PBKDF2-derived key) from document-security-2025.ts rather than introducing
 * a second crypto implementation — "don't duplicate systems" per engineering
 * posture. The master key is the same DOCUMENT_ENCRYPTION_KEY already used for
 * KYC documents; a per-kiosk secret is exactly as sensitive as a KYC file.
 */

import crypto from 'crypto';
import { DocumentEncryption, getMasterEncryptionKey } from '../document-security-2025';

// Matches the constants in document-security-2025.ts — must stay in sync so
// the fixed-length prefix below deserializes correctly.
const SALT_LENGTH = 64;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** Generate a fresh, random per-kiosk HMAC secret. Never logged or returned twice. */
export function generateMachineSecret(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars, 256 bits
}

/**
 * Encrypt a plaintext machine secret for storage in
 * kiosk_machines.hmac_secret_encrypted. Output is a single base64 string:
 * salt(64) || iv(16) || authTag(16) || ciphertext, so decryptMachineSecret
 * doesn't need any side-channel metadata.
 */
export function encryptMachineSecret(plainSecret: string): string {
  const masterKey = getMasterEncryptionKey();
  const { encryptedData, iv, authTag, salt } = DocumentEncryption.encrypt(
    Buffer.from(plainSecret, 'utf8'),
    masterKey,
  );
  return Buffer.concat([salt, iv, authTag, encryptedData]).toString('base64');
}

/** Decrypt a stored hmac_secret_encrypted value back to the plaintext secret. */
export function decryptMachineSecret(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const salt = buf.subarray(0, SALT_LENGTH);
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedData = buf.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const masterKey = getMasterEncryptionKey();
  return DocumentEncryption.decrypt(encryptedData, masterKey, iv, authTag, salt).toString('utf8');
}
