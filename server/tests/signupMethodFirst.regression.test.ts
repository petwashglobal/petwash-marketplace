/**
 * Signup method-first rebuild (CEO 2026-07-24: "no sense... Rover has sense,
 * easy simple... if press apple/gmail why email field needed"). The form
 * showed social buttons + phone + email + DOB ALL at once. Now: social is a
 * one-tap path (no contact field), and the manual form is hidden behind a
 * phone/email chooser — only the chosen field is ever shown.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

describe('method-first signup', () => {
  it('has a contactMode gate defaulting to choose', () => {
    expect(s).toMatch(/const \[contactMode, setContactMode\] = useState<'choose' \| 'phone' \| 'email'>\('choose'\)/);
  });

  it('phone + email fields are each behind their own method guard', () => {
    const phoneGuard = s.indexOf("contactMode === 'phone'");
    const emailGuard = s.indexOf("contactMode === 'email'");
    expect(phoneGuard).toBeGreaterThan(-1);
    expect(emailGuard).toBeGreaterThan(-1);
    expect(phoneGuard).toBeLessThan(s.indexOf('<PhoneInput'));
    expect(emailGuard).toBeLessThan(s.indexOf('type="email"'));
  });

  it('exactly one PhoneInput and one email input (no duplicate salad)', () => {
    expect((s.match(/<PhoneInput/g) || []).length).toBe(1);
    expect((s.match(/type="email"/g) || []).length).toBe(1);
  });

  it('the chooser offers phone and email as buttons', () => {
    expect(s).toMatch(/setContactMode\('phone'\)/);
    expect(s).toMatch(/setContactMode\('email'\)/);
    expect(s).toMatch(/sl-chooser/);
  });

  it('the send-code CTA is hidden until a method is chosen', () => {
    expect(s).toMatch(/\{!sent && contactMode !== 'choose' && \(/);
  });

  it('a back link returns to the chooser and clears the field', () => {
    expect(s).toMatch(/setContactMode\('choose'\); setPhone\(''\)/);
    expect(s).toMatch(/setContactMode\('choose'\); setEmail\(''\)/);
  });
});
