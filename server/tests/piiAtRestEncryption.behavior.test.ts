/**
 * PII / secrets at rest (2026-09-13 deep audit).
 *
 * Written in PLAINTEXT before this change:
 *   - provider_applicants.national_id          (provider-applications.ts)
 *   - passport_verifications.passport_number   (schema literally said "ENCRYPT IN PRODUCTION")
 *   - mfa_enrollments.totp_secret              (a DB read = a permanent second factor)
 *   - provider_applications.bank_iban / bank_branch_code
 *
 * All now go through server/lib/piiFieldCrypto (AES-256-GCM, DOCUMENT_ENCRYPTION_KEY,
 * already mapped into production). No data migration: decryptPII passes legacy
 * plaintext rows through, so existing providers and enrolled 2FA users keep working.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../db', () => ({ db: {} }));

import { decryptPII, encryptPII, isEncryptedPII, maskPII } from '../lib/piiFieldCrypto';
import { TOTPService } from '../services/TOTPService';

const saved = { ...process.env };
beforeEach(() => { process.env.DOCUMENT_ENCRYPTION_KEY = 'k'.repeat(64); });
afterEach(() => { process.env = { ...saved }; });

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

/** RFC 6238 code for `base32` at `now`, computed independently of TOTPService. */
function totpNow(base32: string, now = Date.now()): string {
  const crypto = require('node:crypto');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b: string) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = crypto.createHmac('sha1', bytes).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

describe('the helper keeps legacy rows readable', () => {
  it('ciphertext round-trips and never contains the value', () => {
    const enc = encryptPII('IL620108000000099999999');
    expect(isEncryptedPII(enc)).toBe(true);
    expect(enc).not.toContain('99999999');
    expect(decryptPII(enc)).toBe('IL620108000000099999999');
  });

  it('a legacy plaintext row passes through unchanged', () => {
    expect(decryptPII('IL620108000000099999999')).toBe('IL620108000000099999999');
    expect(maskPII('123456782')).toBe('••••6782');
    expect(maskPII(encryptPII('123456782'))).toBe('••••6782');
  });

  it('a tampered ciphertext reads as empty, never as garbage', () => {
    const enc = encryptPII('123456782');
    const parts = enc.split(':');
    parts[3] = Buffer.from('xxxxxxxxx').toString('base64');
    expect(decryptPII(parts.join(':'))).toBe('');
  });
});

describe('TOTP: an encrypted seed still verifies; a legacy plaintext seed still verifies', () => {
  const svc = new TOTPService();
  it('both stored forms accept the current code', () => {
    const { base32 } = svc.generateSecret();
    const code = totpNow(base32);
    expect(svc.verifyCode(decryptPII(encryptPII(base32)), code).valid).toBe(true);
    expect(svc.verifyCode(decryptPII(base32), code).valid).toBe(true);
  });

  it('an undecryptable seed fails closed', () => {
    const { base32 } = svc.generateSecret();
    const enc = encryptPII(base32);
    process.env.DOCUMENT_ENCRYPTION_KEY = 'z'.repeat(64); // rotated / wrong key
    expect(svc.verifyCode(decryptPII(enc), totpNow(base32)).valid).toBe(false);
  });
});

describe('write sites encrypt, read sites decrypt or mask', () => {
  it('TOTPService: stores encryptPII(seed); every verify decrypts first; the pending re-show decrypts', () => {
    const src = read('services/TOTPService.ts');
    expect(src).toContain('totpSecret: totpSecret ? encryptPII(totpSecret) : null,');
    expect(src.match(/this\.verifyCode\(decryptPII\(enrollment\.totpSecret\)/g)).toHaveLength(2);
    expect(src).not.toMatch(/this\.verifyCode\(enrollment\.totpSecret/);
    expect(src).toContain('decryptPII(existing[0].totpSecret)');
  });

  it('provider applications: national ID encrypted on write, masked on the admin read, not in the content hash', () => {
    const src = read('routes/provider-applications.ts');
    expect(src).toContain('nationalId: formData.nationalId ? encryptPII(String(formData.nationalId)) : null,');
    expect(src).toContain('nationalId: maskPII(application.nationalId),');
    expect(src).not.toContain('nationalId: application.nationalId,');
    expect(src).toContain('const contentHash = sha256(JSON.stringify(hashableForm));');
  });

  it('passport verification: passport number encrypted on write', () => {
    expect(read('routes/passport.ts')).toContain('passportNumber: passportData.passportNumber ? encryptPII(String(passportData.passportNumber))');
  });

  it('provider bank details: IBAN + branch encrypted on write; last-4 and the audited full read decrypt', () => {
    const src = read('routes/provider-onboarding.ts');
    expect(src).toContain('bankIban: bankIban ? encryptPII(bankIban) : bankIban,');
    expect(src).toContain('bankBranchCode: bankBranchCode ? encryptPII(bankBranchCode) : bankBranchCode,');
    expect(src).toContain('const ibanFull = (app as any).bankIban ? decryptPII((app as any).bankIban as string) : null;');
    expect(src).toMatch(/bankIban:\s+ibanFull,/);
  });
});
