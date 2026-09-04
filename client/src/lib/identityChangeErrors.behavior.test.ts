/**
 * Behavioral tests for the identity-change error mapper.
 *
 * The regression these pin: MyAccount's email-change handler tested
 * `error?.code`, but `apiRequest` throws an `ApiError` carrying the server code
 * at `error.body.code`. The re-auth branch was therefore dead, and the fallback
 * displayed `error.message` — the literal string "403: Re-authentication
 * required" — to a customer.
 */
import { describe, it, expect } from 'vitest';
import {
  identityErrorCode,
  identityErrorMessage,
  isReauthRequired,
} from './identityChangeErrors';

/** The exact shape client/src/lib/queryClient.ts throws. */
function apiError(status: number, body: any) {
  const serverMsg = body?.message || body?.error || '';
  const e: any = new Error(`${status}: ${serverMsg || 'Request failed'}`);
  e.status = status;
  e.body = body;
  e.userMessage = status === 403 ? 'Not authorized.' : 'Something went wrong. Please try again.';
  return e;
}

describe('identityErrorCode', () => {
  it('reads the code out of ApiError.body, which is where it actually lives', () => {
    const err = apiError(403, { error: 'Re-authentication required', code: 'REAUTH_REQUIRED' });
    expect(err.code).toBeUndefined(); // the bug: nothing to read at the top level
    expect(identityErrorCode(err)).toBe('REAUTH_REQUIRED');
  });

  it('still accepts a plain { code } object so non-fetch callers work', () => {
    expect(identityErrorCode({ code: 'EMAIL_ALREADY_IN_USE' })).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('returns null rather than guessing when there is no code', () => {
    expect(identityErrorCode(apiError(500, { error: 'boom' }))).toBeNull();
    expect(identityErrorCode(new Error('network'))).toBeNull();
    expect(identityErrorCode(undefined)).toBeNull();
  });
});

describe('isReauthRequired', () => {
  it('detects the re-auth demand that the old `error?.code` test always missed', () => {
    expect(isReauthRequired(apiError(403, { code: 'REAUTH_REQUIRED' }))).toBe(true);
  });
  it('does not misread an unrelated failure as a re-auth demand', () => {
    expect(isReauthRequired(apiError(409, { code: 'EMAIL_ALREADY_IN_USE' }))).toBe(false);
    expect(isReauthRequired(apiError(500, {}))).toBe(false);
  });
});

describe('identityErrorMessage', () => {
  const cases = [
    'REAUTH_REQUIRED',
    'EMAIL_ALREADY_IN_USE',
    'EMAIL_UNCHANGED',
    'INVALID_EMAIL',
    'INVALID_CODE',
    'CODE_EXPIRED',
    'TOO_MANY_ATTEMPTS',
    'TOO_MANY_REQUESTS',
    'CANONICAL_ROW_MISSING',
    'MOBILE_CHANGE_REQUIRES_VERIFICATION',
    'PHONE_ALREADY_IN_USE',
    'INVALID_PHONE',
    'NO_PHONE_LINKED',
    'VERIFICATION_CHALLENGE_REQUIRED',
    'IDENTITY_UPDATE_FAILED',
  ] as const;

  it('has real, DIFFERENT copy in both languages for every code', () => {
    for (const code of cases) {
      const err = apiError(400, { code });
      const he = identityErrorMessage(err, true, 'FALLBACK');
      const en = identityErrorMessage(err, false, 'FALLBACK');
      expect(he, code).not.toBe('FALLBACK');
      expect(en, code).not.toBe('FALLBACK');
      expect(he, code).not.toBe(en);
      // Hebrew copy must actually contain Hebrew characters, not English text
      // that somebody forgot to translate.
      expect(/[֐-׿]/.test(he), `${code} HE`).toBe(true);
      expect(/[֐-׿]/.test(en), `${code} EN`).toBe(false);
    }
  });

  it('NEVER surfaces the raw "<status>: <msg>" Error.message to the user', () => {
    const err = apiError(403, { error: 'Re-authentication required', code: 'REAUTH_REQUIRED' });
    expect(err.message).toBe('403: Re-authentication required');
    for (const isHebrew of [true, false]) {
      const shown = identityErrorMessage(err, isHebrew, 'FALLBACK');
      expect(shown).not.toContain('403');
      expect(shown).not.toBe(err.message);
    }
  });

  it('falls back to the sanitised userMessage, then to the caller default', () => {
    expect(identityErrorMessage(apiError(500, { error: 'x' }), false, 'FALLBACK')).toBe(
      'Something went wrong. Please try again.',
    );
    expect(identityErrorMessage(new Error('offline'), false, 'FALLBACK')).toBe('FALLBACK');
  });
});
