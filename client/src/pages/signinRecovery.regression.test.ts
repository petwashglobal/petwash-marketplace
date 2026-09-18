/**
 * Sign-in must not tell a Google user their password is wrong and send them to
 * create a second account. Regression pin — 2026-09-19.
 *
 * REPORTED BY THE CEO, ON HIS OWN ACCOUNT
 * "login via other email field not gmail not working using password".
 *
 * His account was created with Google. A Google account in Firebase has NO
 * password, so signInWithEmailAndPassword can only ever fail on it — Firebase
 * answers `auth/invalid-credential`, exactly as it does for a genuinely wrong
 * password. The screen then said:
 *
 *     "Wrong email or password. No account yet? Create one, or use a one-time code."
 *
 * Both halves are false. The password was not wrong — there is no password. And
 * he has an account. The message pointed him at creating a SECOND account for
 * an email that already had one: it cannot succeed, and if it somehow did it
 * would split his identity across two records.
 *
 * WHAT IS PINNED
 *   1. every Firebase code that means "did not authenticate" is treated the
 *      same, including the modern `auth/invalid-credential` a social-only
 *      account returns and the legacy codes still emitted by older SDKs;
 *   2. that case flips the screen to the one-time-code path, which works
 *      whether or not the account has a password — so the next tap gets them in;
 *   3. a RATE-LIMITED account does NOT flip. It has to wait; sending a code
 *      would burn SMS/email budget against the same lockout;
 *   4. the copy names the social possibility and no longer claims there is no
 *      account.
 *
 * Deliberately NOT pinned: looking the email's provider up and saying "use
 * Google". That needs a server lookup by address, which turns the sign-in form
 * into an account-existence oracle — the reason Firebase's own
 * fetchSignInMethodsForEmail returns nothing once enumeration protection is on.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  classifyPasswordFailure,
  shouldOfferOneTimeCode,
  passwordFailureMessageKey,
} from './signinRecovery';

const PAGE = readFileSync(
  path.join(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),
    'client/src/pages/SignUpLuxury.tsx',
  ),
  'utf8',
);

describe('classifyPasswordFailure', () => {
  it('treats the code a GOOGLE-ONLY account returns as bad credentials', () => {
    // This is the CEO's exact case. Modern Firebase collapses "no password on
    // this account" into invalid-credential.
    expect(classifyPasswordFailure('auth/invalid-credential')).toBe('bad-credentials');
  });

  it('covers every legacy and modern non-authenticating code', () => {
    for (const code of [
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-login-credentials',
    ]) {
      expect(classifyPasswordFailure(code), code).toBe('bad-credentials');
    }
  });

  it('separates rate limiting from bad credentials', () => {
    expect(classifyPasswordFailure('auth/too-many-requests')).toBe('rate-limited');
  });

  it('does not silently classify an unrelated failure as bad credentials', () => {
    for (const code of ['auth/network-request-failed', 'auth/internal-error', 'auth/user-disabled']) {
      expect(classifyPasswordFailure(code), code).toBe('unknown');
    }
  });

  it('survives a missing or non-string code without throwing', () => {
    for (const bad of [undefined, null, '', 0, {}, []]) {
      expect(classifyPasswordFailure(bad as unknown)).toBe('unknown');
    }
  });
});

describe('shouldOfferOneTimeCode — the tap that actually gets them in', () => {
  it('offers the code path for bad credentials', () => {
    expect(shouldOfferOneTimeCode('bad-credentials')).toBe(true);
  });

  it('does NOT offer it while rate limited — that would burn budget on a lockout', () => {
    expect(shouldOfferOneTimeCode('rate-limited')).toBe(false);
  });

  it('does not offer it for an unknown failure', () => {
    expect(shouldOfferOneTimeCode('unknown')).toBe(false);
  });
});

describe('passwordFailureMessageKey', () => {
  it('maps each kind to its own message, with no collisions', () => {
    const keys = (['bad-credentials', 'rate-limited', 'unknown'] as const)
      .map(passwordFailureMessageKey);
    expect(keys).toEqual(['passwordOrSocial', 'rateLimited', 'generic']);
    expect(new Set(keys).size).toBe(3);
  });
});

describe('the login screen uses it, and the false copy is gone', () => {
  it('no longer tells an existing user there is no account', () => {
    expect(PAGE).not.toContain('No account yet? Create one, or use a one-time code.');
    expect(PAGE).not.toContain('אימייל או סיסמה שגויים. אין עדיין חשבון?');
  });

  it('names the Google / Apple possibility instead of blaming the password', () => {
    expect(PAGE).toContain('If you joined with Google or Apple, your account has no password');
  });

  it('routes the failure through the classifier rather than inline code checks', () => {
    expect(PAGE).toMatch(/const kind = classifyPasswordFailure\(code\)/);
    expect(PAGE).toMatch(/if \(shouldOfferOneTimeCode\(kind\)\) setUsePassword\(false\)/);
  });

  it('mobile sign-in is a first-class button on login, not a buried text link', () => {
    expect(PAGE).toContain('data-testid="button-login-with-mobile"');
    // …and the old grey link that nobody found is gone as UI COPY, so there is
    // exactly one way in. Matching on the Hebrew avoids tripping over the
    // English phrase where it still appears in an explanatory comment.
    expect(PAGE).not.toContain("L('התחבר/י עם מספר נייד במקום'");
  });

  it('the JOIN screen stops blaming a password it never checked', () => {
    // "new vs exist also not smart" (CEO, 2026-09-19): creating an account with
    // an email that already had one answered "Email or password is incorrect."
    // Nothing of theirs was being checked, so it reads as a broken form and
    // people retype the same details.
    expect(PAGE).not.toContain("fail(L('אימייל או סיסמה שגויים', 'Email or password is incorrect.')); return; }");
    expect(PAGE).toContain("If you already have one, sign in instead");
  });

  it('still refuses to confirm whether an email is registered', () => {
    // The enumeration guard is the reason the old copy was generic in the first
    // place. The new copy must stay a POSSIBILITY ("if you already have one"),
    // never a statement, and must not auto-switch the screen to login — doing
    // that only-when-the-email-exists would itself be the oracle.
    expect(PAGE).not.toMatch(/email-already-in-use'\)[\s\S]{0,400}setAuthMode\('login'\)/);
    expect(PAGE).toContain('If you already have one');
    expect(PAGE).not.toContain('That email is already registered — sign in');
  });
});
