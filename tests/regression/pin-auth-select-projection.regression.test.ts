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

describe('pin-auth.ts users SELECT projection (audit sev 4)', () => {
  it('does not `db.select().from(users)` (untyped SELECT *)', () => {
    // Any whitespace/newlines around the dot/paren are fine.
    expect(SRC).not.toMatch(/db\s*\.\s*select\(\s*\)\s*\.\s*from\(users\)/);
  });

  it('email-lookup projection is scoped to `id` only', () => {
    expect(SRC).toMatch(/\.select\(\{\s*id:\s*users\.id\s*\}\)/);
  });

  it('id-lookup projection is the explicit 5-field allowlist', () => {
    expect(SRC).toMatch(/id:\s*users\.id/);
    expect(SRC).toMatch(/email:\s*users\.email/);
    expect(SRC).toMatch(/firstName:\s*users\.firstName/);
    expect(SRC).toMatch(/lastName:\s*users\.lastName/);
    expect(SRC).toMatch(/loyaltyTier:\s*users\.loyaltyTier/);
  });
});
