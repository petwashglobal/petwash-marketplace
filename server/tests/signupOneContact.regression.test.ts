/**
 * "Sign up not easy" (CEO 2026-07-24): the enable-gate demanded phone AND
 * email AND dob together, but startSignup() branches phone-else-email and the
 * design intent is "type whichever they like". Filling only email left the
 * Continue button dead with no reason. Gate now needs ONE contact + 18+.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

describe('signup one-contact gate', () => {
  it('readyForSubmit needs (phone OR email) + adult, not both contacts', () => {
    expect(s).toContain('const hasContact = phoneValid || emailValid;');
    // 2026-09-18: the gate grew past `&& isAdult`. It now reads
    //   !busy && hasContact && (authMode === 'login' ? true : consentOk)
    // — a RETURNING user signing in is not re-asked their date of birth, and a
    // new user must clear the whole consent set (valid DOB, 18+, the 18+ tick,
    // and the terms tick), not just an age flag. See signupAgeGate. The
    // one-contact promise this file exists for is unchanged, so pin that.
    expect(s).toContain('const readyForSubmit = !busy && hasContact && (authMode === \'login\' ? true : consentOk);');
    // The original bug: demanding BOTH contacts left Continue dead for anyone
    // who typed only an email. `phoneValid && emailValid` DOES still exist —
    // as `bothContacts`, for the separate JOIN contract (CEO 2026-07-31: a
    // real account with a password needs both) — so assert the one-contact
    // gate does not depend on it, rather than banning the text outright.
    const gate = s.slice(s.indexOf('const readyForSubmit ='), s.indexOf('const readyForSubmit =') + 200);
    expect(gate).not.toContain('bothContacts');
    expect(gate).not.toContain('phoneValid && emailValid');
    expect(s).toMatch(/const joinReady = [^\n]*bothContacts/);
  });

  it('startSignup still branches phone-first-else-email (gate now matches it)', () => {
    expect(s).toMatch(/if \(phoneValid\) \{ setMethod\('mobile'\); void sendCode\(\); \}\s*\n\s*else if \(emailValid\) \{ setMethod\('email'\); void sendEmailCode\(\); \}/);
  });
});
