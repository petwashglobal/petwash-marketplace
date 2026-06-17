/**
 * AES-256-GCM encryption for home access details (keys, codes, addresses).
 *
 * Fail-closed: sensitive access instructions are NEVER stored as plaintext. If
 * HOME_ACCESS_ENC_KEY is not configured, encrypt() throws — the caller must not
 * fall back to plaintext. Output format: base64( iv(12) || ciphertext || tag(16) ).
 *
 * HOME_ACCESS_ENC_KEY = 32-byte key as 64 hex chars or base64.
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function loadKey(): Buffer | null {
  const raw = process.env.HOME_ACCESS_ENC_KEY;
  if (!raw) return null;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

export function isHomeAccessEncryptionReady(): boolean {
  return loadKey() !== null;
}

export function encryptAccess(plaintext: string): string {
  const key = loadKey();
  if (!key) throw new Error('HOME_ACCESS_ENC_KEY missing/invalid — refusing to store access details in plaintext');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptAccess(blob: string): string {
  const key = loadKey();
  if (!key) throw new Error('HOME_ACCESS_ENC_KEY missing/invalid — cannot decrypt access details');
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
