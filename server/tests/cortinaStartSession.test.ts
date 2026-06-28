/**
 * Cortina Start Session cipher — proven against Nayax's OWN worked example
 * (dev portal → Cortina → Start Session → Authentication Process). If our AES
 * output matches Nayax's published expected ciphertext byte-for-byte, Nayax's
 * servers will be able to decrypt our handshake. Deterministic — no live creds.
 */
import { describe, it, expect } from 'vitest';
import {
  startSessionKey,
  buildStartSessionPlaintext,
  encryptStartSession,
  generateStartSessionTransactionId,
} from '../lib/cortinaStartSession';

// Verbatim from the Nayax documentation worked example.
const SECRET_TOKEN   = 'mrV3U3nsgGFrE3w5-wnBo_WCLPce-pZ1awRvTVTkungMIKThTVbj_fiXdfoGclhn0';
const RANDOM_STRING  = '123456789qwertyuioasdfghjkl';                    // 27 chars
const TRANSACTION_ID = '123456789012345678901234567890123456';          // 36 numeric
const EXPECTED_KEY   = 'wRvTVTkungMIKThTVbj_fiXdfoGclhn0';              // last 32 chars
const EXPECTED_PLAINTEXT = '123456789012345678901234567890123456=123456789qwertyuioasdfghjkl';
const EXPECTED_CIPHER = 'a0Qnxm4fWMskzFXiMivn8BDiQVSL6be/NXIICC9HBoAiry6DUdKYPQh/YS1G8nObE6/0o9N4MFuYA7CTAxAnphuNJwBEjgBzKhhgpJ5ggnw=';

describe('Cortina Start Session cipher (vs Nayax worked example)', () => {
  it('key = last 32 chars of the secret token (256-bit)', () => {
    const k = startSessionKey(SECRET_TOKEN);
    expect(k.toString('utf8')).toBe(EXPECTED_KEY);
    expect(k.length).toBe(32);
  });

  it('plaintext = `${TransactionId}=${RandomString}` (64 chars)', () => {
    const p = buildStartSessionPlaintext(TRANSACTION_ID, RANDOM_STRING);
    expect(p).toBe(EXPECTED_PLAINTEXT);
    expect(p.length).toBe(64);
  });

  it('AES-256-ECB/PKCS7 output matches Nayax exactly', () => {
    const cipher = encryptStartSession({
      secretToken: SECRET_TOKEN,
      transactionId: TRANSACTION_ID,
      randomString: RANDOM_STRING,
    });
    expect(cipher).toBe(EXPECTED_CIPHER);
  });

  it('rejects a too-short secret token', () => {
    expect(() => startSessionKey('short')).toThrow(/too_short/);
  });

  it('generates a 36-numeric-char TransactionId', () => {
    const id = generateStartSessionTransactionId();
    expect(id).toMatch(/^\d{36}$/);
  });
});
