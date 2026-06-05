import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/identity-service.ts'), 'utf8');

function standardLoginBlock(): string {
  const start = src.indexOf('router.post("/login/standard"');
  expect(start).toBeGreaterThan(-1);

  const nextRoute = src.indexOf('\n/**\n * POST /auth/login/google', start);
  expect(nextRoute).toBeGreaterThan(start);
  return src.slice(start, nextRoute);
}

describe('identity standard login enumeration guard', () => {
  it('uses one generic invalid-login response for user-not-found and wrong-password paths', () => {
    const block = standardLoginBlock();
    const genericUses = block.match(/INVALID_LOGIN_RESPONSE/g) || [];

    expect(src).toMatch(/const\s+INVALID_LOGIN_RESPONSE\s*=/);
    expect(genericUses.length).toBeGreaterThanOrEqual(4);
  });

  it('does not expose account-existence or password-specific miss messages', () => {
    const block = standardLoginBlock();

    expect(block).not.toContain('No account found with this email address');
    expect(block).not.toContain('Incorrect password');
  });

  it('keeps rate-limit and disabled-account responses distinct', () => {
    const block = standardLoginBlock();

    expect(block).toContain('Too many failed login attempts');
    expect(block).toContain('This account has been disabled');
  });
});
