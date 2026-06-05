import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('SignIn invalid credential enumeration guard', () => {
  it('keeps user-not-found on the same generic invalid-credentials path as wrong password', () => {
    const src = read('client/src/pages/SignIn.tsx');
    const catchStart = src.indexOf('logger.error("Email/password sign-in error:"');
    expect(catchStart).toBeGreaterThan(0);

    const block = src.slice(catchStart, src.indexOf('trackAuthError({', catchStart));
    expect(block).toContain("error.code === 'auth/user-not-found'");
    expect(block).toContain("error.code === 'auth/wrong-password'");
    expect(block).toContain("error.code === 'auth/invalid-credential'");
    expect(block).toContain("t('signin.invalidCredentials', language)");
    expect(block).not.toContain('No account found with this email');
    expect(block).not.toContain('Redirecting to sign up');
    expect(block).not.toContain('navigate(`/signup?email=');
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
