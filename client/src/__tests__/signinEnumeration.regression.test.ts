import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('SignIn invalid credential enumeration guard', () => {
  it('email auth does not leak whether an account exists (enumeration guard)', () => {
    // Unified login is SignUpLuxury (old SignIn.tsx retired 2026-06-28). A wrong
    // password on an existing account must read the SAME as any other bad
    // credential — never confirm an email is registered.
    const src = read('client/src/pages/SignUpLuxury.tsx');
    expect(src).toContain('Email or password is incorrect.');
    expect(src).not.toContain('Account exists — please check your password');
    expect(src).not.toContain('Wrong password.');
    expect(src).not.toContain('No account found');
    expect(src).not.toContain('navigate(`/signup?email=');
  });

  it('keeps shared Firebase auth helpers generic for user-not-found and wrong-password', () => {
    const handler = read('client/src/lib/authErrorHandler.ts');
    const userNotFound = handler.slice(
      handler.indexOf("'auth/user-not-found'"),
      handler.indexOf("'auth/email-already-in-use'"),
    );

    expect(userNotFound).toContain('Invalid sign-in credentials');
    expect(userNotFound).not.toContain('No account found');
    expect(userNotFound).not.toContain('Incorrect password');

    const client = read('client/src/auth/client.ts');
    const humanizer = client.slice(
      client.indexOf("'auth/invalid-credential'"),
      client.indexOf("'auth/user-disabled'"),
    );

    expect(humanizer).toContain("'auth/user-not-found'");
    expect(humanizer).toContain('Email or password is incorrect.');
    expect(humanizer).not.toContain('No account found');
  });
});
