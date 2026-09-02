/**
 * Behaviour + regression pin — phone-HMAC lookup helper
 * (AUDIT-SMS-14 / #225 slice 1).
 *
 * Locks in the properties the callers depend on:
 *   • normalisation strips punctuation but not digits, so the same
 *     number in `+972-54-123-4567` and `+972541234567` shape hashes
 *     to the same key;
 *   • naked-national form (`0541234567`) hashes DIFFERENTLY from the
 *     E.164 form — they are not the same deliverable target, and
 *     conflating them would let an attacker probe both spaces with
 *     one hash;
 *   • null / empty input returns null (callers with a nullable
 *     phone column skip the write);
 *   • the hash is stable across calls in the same process with the
 *     same secret (a query written against yesterday's hash still
 *     matches today's write);
 *   • the hash is a 64-hex string (fits the varchar(64) column
 *     defined in migration 0140).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('AUDIT-SMS-14 / #225 — phoneLookupHash', () => {
  const originalSecret = process.env.PHONE_HMAC_SECRET;
  const originalDoc = process.env.DOCUMENT_ENCRYPTION_KEY;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Pin a known secret so the module's cache is deterministic
    // across tests.
    process.env.PHONE_HMAC_SECRET = 'test-secret-do-not-use-in-prod';
    delete process.env.DOCUMENT_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.PHONE_HMAC_SECRET = originalSecret;
    process.env.DOCUMENT_ENCRYPTION_KEY = originalDoc;
    process.env.NODE_ENV = originalEnv;
  });

  it('returns a 64-hex string for a canonical E.164 phone', async () => {
    const { phoneLookupHash } = await import('../lib/phoneHmac');
    const h = phoneLookupHash('+972541234567');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalises punctuation — same digits hash to the same key', async () => {
    const { phoneLookupHash } = await import('../lib/phoneHmac');
    expect(phoneLookupHash('+972541234567')).toBe(phoneLookupHash('+972-54-123-4567'));
    expect(phoneLookupHash('+972541234567')).toBe(phoneLookupHash('+972 54 123 4567'));
    expect(phoneLookupHash('+972541234567')).toBe(phoneLookupHash('(+972) 54 123 4567'));
  });

  it('naked-national form hashes DIFFERENTLY from E.164 — they are not the same target', async () => {
    const { phoneLookupHash } = await import('../lib/phoneHmac');
    const national = phoneLookupHash('0541234567');
    const e164 = phoneLookupHash('+972541234567');
    expect(national).not.toBe(e164);
  });

  it('returns null for null / undefined / empty / digit-less input', async () => {
    const { phoneLookupHash } = await import('../lib/phoneHmac');
    expect(phoneLookupHash(null)).toBeNull();
    expect(phoneLookupHash(undefined)).toBeNull();
    expect(phoneLookupHash('')).toBeNull();
    expect(phoneLookupHash('   ')).toBeNull();
    expect(phoneLookupHash('---')).toBeNull();
  });

  it('is stable within the process for the same secret', async () => {
    const { phoneLookupHash } = await import('../lib/phoneHmac');
    const a = phoneLookupHash('+972541234567');
    const b = phoneLookupHash('+972541234567');
    expect(a).toBe(b);
  });

  it('phoneLookupHashMany returns a map keyed by the raw string (skips nulls)', async () => {
    const { phoneLookupHashMany, phoneLookupHash } = await import('../lib/phoneHmac');
    const m = phoneLookupHashMany(['+972541234567', null, '', '+15551112222']);
    expect(m.size).toBe(2);
    expect(m.get('+972541234567')).toBe(phoneLookupHash('+972541234567'));
    expect(m.get('+15551112222')).toBe(phoneLookupHash('+15551112222'));
  });
});

describe('AUDIT-SMS-14 / #225 — write-path mirror wiring', () => {
  it('users schema exposes the phone_hash column at varchar(64)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const schema = readFileSync(
      join(__dirname, '..', '..', 'shared', 'schema.ts'),
      'utf8',
    );
    expect(schema).toMatch(/phoneHash:\s*varchar\("phone_hash",\s*\{\s*length:\s*64\s*\}\)/);
  });

  it('migration 0140 adds phone_hash + index and is idempotent', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(
      join(__dirname, '..', '..', 'migrations', '0140_users_phone_hash_2026_09_02.sql'),
      'utf8',
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS phone_hash/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_users_phone_hash/i);
  });

  it('storage.upsertUser + updateUser mirror phone → phone_hash on writes', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(__dirname, '..', '..', 'server', 'storage.ts'),
      'utf8',
    );
    expect(src).toMatch(/import\s*\{\s*phoneLookupHash\s*\}\s*from\s*['"]\.\/lib\/phoneHmac['"]/);
    // Both writers gate the mirror on the presence of 'phone' in the
    // input so a call that doesn't touch the phone stays a no-op.
    const mirrorPattern = /if\s*\('phone'\s*in\s*[a-zA-Z]+\)\s*\{\s*[a-zA-Z]+\.phoneHash\s*=\s*phoneLookupHash/g;
    const mirrors = src.match(mirrorPattern) || [];
    expect(mirrors.length).toBeGreaterThanOrEqual(3);
  });

  it('profile-settings phone-verified confirm write mirrors phone → phone_hash', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(__dirname, '..', '..', 'server', 'routes', 'profile-settings.ts'),
      'utf8',
    );
    expect(src).toMatch(/import\s*\{\s*phoneLookupHash\s*\}\s*from\s*['"]\.\.\/lib\/phoneHmac['"]/);
    expect(src).toMatch(/phoneHash:\s*phoneLookupHash\(firebaseUser\.phoneNumber\)/);
  });
});
