/**
 * Signup age gate — a child must never be able to open an account, and an adult
 * who gave their date of birth must never be left stuck.
 *
 * HISTORY. 2026-07-24 (CEO: "typed dob tick terms but Gmail not working"): a
 * valid 18+ date of birth did not satisfy a separate checkbox-based gate, so
 * Google sign-in and the phone Send button stayed dead until the user also
 * ticked a redundant box. That was fixed with `ageConfirmed = over18 || isAdult`.
 *
 * 2026-08-16 (MASTER AUTH rebuild) made the gate STRICTER and renamed
 * everything: signup now demands a real 18+ birthday AND an explicit "I am 18+"
 * confirmation AND the Terms. This test still asserted the 2026-07-24 variable
 * names, so it read as "the age gate is gone" when the gate had in fact been
 * strengthened — it sat in the red baseline instead of guarding anything.
 *
 * These pins now follow the invariant, not the variable names.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

describe('signup cannot proceed without a real 18+ birthday', () => {
  it('adulthood is computed from the typed date of birth, not from a tick', () => {
    expect(s).toMatch(/const isAdult = age >= 18;/);
  });

  it('the consent gate demands the birthday, the 18+ confirmation AND the Terms', () => {
    expect(s).toMatch(/const consentOk = dobValid && isAdult && ageConfirmed18Plus && agreedTerms;/);
    // A tick on its own must never be the whole gate.
    expect(s).not.toMatch(/const consentOk = agreedTerms && (over18|ageConfirmed)\b/);
  });

  it('the submit button is gated by that same consent on signup, and never on login', () => {
    expect(s).toMatch(/const readyForSubmit = !busy && hasContact && \(authMode === 'login' \? true : consentOk\);/);
  });

  it('the submit handler refuses an under-18 or missing birthday with a reason', () => {
    const i = s.indexOf('const requireTerms = () => {');
    expect(i).toBeGreaterThan(0);
    const body = s.slice(i, i + 1200);
    expect(body).toContain('if (!dobValid || !isAdult) {');
    expect(body).toContain('if (!ageConfirmed18Plus) {');
    expect(body).toContain('if (!agreedTerms) {');
  });

  it('every social / OTP entry point checks adulthood before creating anything', () => {
    // Google, phone OTP and email paths each re-check isAdult for a signup.
    const guards = s.match(/authMode !== 'login' && [^\n]*!isAdult/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it('consentOk is declared after isAdult (no temporal-dead-zone crash)', () => {
    expect(s.indexOf('const isAdult = age >= 18;'))
      .toBeLessThan(s.indexOf('const consentOk = dobValid && isAdult'));
  });
});
