/**
 * Regression pin — P1-6 (X-ray 2026-07-25): national ID must never be stored
 * plaintext by the self-service profile endpoint, and the identity-dedup lookup
 * must match on the one-way blind index, not the plaintext column.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const profile = readFileSync(join(__dirname, '..', 'routes', 'user-profile.ts'), 'utf8');
const storage = readFileSync(join(__dirname, '..', 'storage.ts'), 'utf8');

describe('national ID encryption (P1-6)', () => {
  it('profile write encrypts the ID and stores a blind index — never plaintext', () => {
    expect(profile).toMatch(/idNumberEnc\s*=\s*encryptField\(/);
    expect(profile).toMatch(/idNumberHash\s*=\s*blindIndex\(/);
    // The old plaintext write must be gone.
    expect(profile).not.toMatch(/updateData\.idNumber\s*=\s*idNumber/);
  });

  it('identity-dedup lookup matches on the blind-index hash, not plaintext idNumber', () => {
    const fn = storage.slice(storage.indexOf('async findUsersByIdAndDob'));
    const body = fn.slice(0, 600);
    expect(body).toMatch(/blindIndex\(idNumber\)/);
    expect(body).toMatch(/users\.idNumberHash/);
    expect(body).not.toMatch(/eq\(users\.idNumber,\s*idNumber\)/);
  });
});
