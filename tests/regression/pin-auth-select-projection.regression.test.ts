import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'pin-auth.ts'),
  'utf8',
);

// Regression pin for audit finding (2026-08-18, sev 4): pin-auth.ts read
// `db.select().from(users)` on an authentication path, pulling all sensitive
// user columns (phone, passwordHash, MFA secrets) into memory when only a
// tiny subset was ever consumed.

describe('pin-auth.ts users/customers SELECT projection (audit sev 4, re-applied 2026-09-13)', () => {
  it('never does an untyped SELECT * on users or customers', () => {
    expect(SRC).not.toMatch(/db\s*\.\s*select\(\s*\)\s*\.\s*from\((users|customers)\)/);
  });

  it('identity lookups project only id (+ email where compared)', () => {
    expect(SRC).toMatch(/select\(\{ id: users\.id, email: users\.email \}\)\.from\(users\)\.where\(eq\(users\.id, uid\)\)/);
    expect(SRC).toMatch(/select\(\{ id: users\.id \}\)\.from\(users\)\.where\(eq\(users\.email, email\)\)/);
  });

  it('the login response profile is the explicit 5-field allowlist', () => {
    for (const f of ['id: users.id', 'email: users.email', 'firstName: users.firstName', 'lastName: users.lastName', 'loyaltyTier: users.loyaltyTier']) {
      expect(SRC).toContain(f);
    }
  });
});
