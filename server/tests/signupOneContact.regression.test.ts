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
    expect(s).toContain('const readyForSubmit = !busy && hasContact && isAdult;');
    expect(s).not.toContain('phoneValid && emailValid && isAdult');
  });

  it('startSignup still branches phone-first-else-email (gate now matches it)', () => {
    expect(s).toMatch(/if \(phoneValid\) \{ setMethod\('mobile'\); void sendCode\(\); \}\s*\n\s*else if \(emailValid\) \{ setMethod\('email'\); void sendEmailCode\(\); \}/);
  });
});
