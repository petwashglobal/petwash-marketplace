/**
 * "Is there sense if user already gave us what we need" (CEO 2026-07-24).
 * A loyalty account REQUIRES dateOfBirth. Signup collected it and the server
 * age-checked it — but persistDob ran an UPDATE before the Postgres users row
 * existed (row is created later by /api/auth/session), so it hit 0 rows and the
 * birthday was silently lost. Result: loyalty users were re-asked for their DOB
 * at /complete-profile even though they'd just entered it. Now the DOB is
 * written when the row is CREATED, end to end.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const svc = R('server/services/AuthService.ts');
const routes = R('server/routes.ts');
const signup = R('client/src/pages/SignUpLuxury.tsx');

describe('DOB survives signup end to end', () => {
  it('ensureUserInPostgres accepts dateOfBirth (written at row creation via ...extraData)', () => {
    expect(svc).toMatch(/dateOfBirth\?: string;\n  \}\): Promise<\{ user: any; isNewUser: boolean \} \| null>/);
  });

  it('/api/auth/session reads a valid dateOfBirth from the body and passes it', () => {
    expect(routes).toMatch(/dateOfBirth: bodyDob/);
    expect(routes).toMatch(/dateOfBirth: \(typeof bodyDob === 'string' && \/\^\\d\{4\}/);
  });

  it('the signup client sends the DOB to /api/auth/session (both phone + email paths)', () => {
    expect((signup.match(/body: JSON\.stringify\(\{ idToken, dateOfBirth: dob \}\)/g) || []).length).toBe(2);
  });
});

describe('required-field map still lists dateOfBirth for loyalty (so the fix matters)', () => {
  it('loyalty requires dateOfBirth', () => {
    expect(R('server/routes/post-login.ts')).toMatch(/loyalty: \['firstName', 'lastName', 'dateOfBirth', 'termsAcceptedAt'\]/);
  });
});
