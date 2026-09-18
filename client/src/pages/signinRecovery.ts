/**
 * What to tell someone whose password sign-in just failed — and what to do next.
 *
 * THE BUG THIS EXISTS FOR (2026-09-19, reported by the CEO on his own account)
 * "login via other email field not gmail not working using password".
 *
 * His account was created with Google. A Google account in Firebase has NO
 * password, so signInWithEmailAndPassword can only ever fail on it. Firebase
 * answers `auth/invalid-credential`, and the screen said:
 *
 *     "Wrong email or password. No account yet? Create one…"
 *
 * Both halves of that are false. The password was not wrong — there is no
 * password. And he very much has an account. So the message sent him to create
 * a second account for an email that already had one, which is the worst
 * possible next step: it cannot succeed, and if it did it would split his
 * identity across two records.
 *
 * WHY WE DO NOT JUST LOOK UP THE PROVIDER AND SAY "use Google"
 * That needs a server lookup by email, which turns the sign-in form into an
 * account-existence oracle: anyone could type addresses and learn which ones
 * are registered. Firebase's own client-side fetchSignInMethodsForEmail returns
 * nothing once email-enumeration protection is on, for exactly this reason.
 *
 * So the message names the possibility without confirming anything, and — more
 * useful than any message — the screen flips its primary button to the one-time
 * code path. That path works whether or not the account has a password, so the
 * person gets in on the next tap instead of being told to start over.
 */

export type PasswordFailureKind =
  | 'bad-credentials'   // wrong password, OR no password because it's a social account
  | 'rate-limited'
  | 'unknown';

/** Firebase codes that mean "this email + password did not authenticate". */
const BAD_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',   // modern Firebase; also what a social-only account returns
  'auth/wrong-password',       // legacy
  'auth/user-not-found',       // legacy; suppressed under enumeration protection
  'auth/invalid-login-credentials',
]);

export function classifyPasswordFailure(code: unknown): PasswordFailureKind {
  const c = typeof code === 'string' ? code : '';
  if (BAD_CREDENTIAL_CODES.has(c)) return 'bad-credentials';
  if (c === 'auth/too-many-requests') return 'rate-limited';
  return 'unknown';
}

/**
 * Should the screen switch its primary action to "email me a one-time code"?
 *
 * Only for bad credentials. A rate-limited account must WAIT — flipping it to
 * the code path would just burn the SMS/email budget against the same lockout.
 */
export function shouldOfferOneTimeCode(kind: PasswordFailureKind): boolean {
  return kind === 'bad-credentials';
}

/**
 * The message key the screen should show. Kept as a key rather than text so the
 * Hebrew and English live with the rest of the page's copy.
 */
export function passwordFailureMessageKey(kind: PasswordFailureKind):
  'passwordOrSocial' | 'rateLimited' | 'generic' {
  switch (kind) {
    case 'bad-credentials': return 'passwordOrSocial';
    case 'rate-limited':    return 'rateLimited';
    default:                return 'generic';
  }
}
