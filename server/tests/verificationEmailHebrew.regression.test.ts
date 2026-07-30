/**
 * CEO 2026-07-30: the signup verification-code email went out ENGLISH-ONLY in
 * a generic gray template. Pins: Hebrew-first bilingual copy, brand shell, the
 * code rendered prominently, and Hebrew subject by default ('he' market).
 * Render test (per the #1590 lesson) — the builder is EXECUTED, not grepped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent: any[] = [];
vi.mock('../emailService', () => ({
  EmailService: { send: (msg: any) => { sent.push(msg); return Promise.resolve(true); } },
}));

import { sendVerificationEmailCode } from '../services/VerificationEmailDelivery';

describe('verification code email — Hebrew-first, branded', () => {
  beforeEach(() => { sent.length = 0; });

  it('signup email is bilingual with Hebrew heading + code + Hebrew subject by default', async () => {
    await sendVerificationEmailCode({ to: 'x@petwash.co.il', code: '135667', purpose: 'signup' });
    expect(sent).toHaveLength(1);
    const { subject, html } = sent[0];
    expect(subject).toContain('קוד האימות');
    expect(html).toContain('אמתו את האימייל');            // Hebrew verify-your-email
    expect(html).toContain('135667');                      // the code itself
    expect(html).toContain('PetWash™');                    // brand shell
    expect(html).toContain('dir="rtl"');                   // Hebrew section is RTL
    expect(html).toContain('verify your email');           // English still present
  });

  it('explicit English language flips the subject only — body stays bilingual', async () => {
    await sendVerificationEmailCode({ to: 'x@y.com', code: '111222', purpose: 'login', language: 'en' });
    expect(sent[0].subject).toBe('Your PetWash sign-in code');
    expect(sent[0].html).toContain('קוד הכניסה');
  });

  it('every purpose renders Hebrew + the code (no purpose falls back to English-only)', async () => {
    const purposes = ['signup', 'login', 'change_email', 'close_account', 'enable_2fa', 'disable_2fa', 'payout'] as const;
    for (const purpose of purposes) {
      sent.length = 0;
      await sendVerificationEmailCode({ to: 'x@y.com', code: '999888', purpose });
      expect(sent[0].html, purpose).toMatch(/[֐-׿]/); // has Hebrew
      expect(sent[0].html, purpose).toContain('999888');
    }
  });
});
