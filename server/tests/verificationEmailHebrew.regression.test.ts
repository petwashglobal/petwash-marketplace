/**
 * CEO 2026-07-30: the signup verification-code email went out ENGLISH-ONLY in
 * a generic gray template. Pins: Hebrew-first bilingual copy, brand shell, the
 * code rendered prominently, and Hebrew subject by default ('he' market).
 * Render test (per the #1590 lesson) — the builder is EXECUTED, not grepped.
 */
import fs from 'node:fs';
import path from 'node:path';
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

/**
 * No emoji on the security-email brand mark — regression pin (2026-09-07).
 *
 * The verification email shipped with "\u{1F43E} PetWash\u2122" as its header. Two rules
 * it broke: the CEO hard rule "No emojis" on professional surfaces
 * (docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md), and the logo rule —
 * a real asset or nothing, never a drawn or emoji stand-in.
 *
 * It matters most on THIS email specifically. A one-time-code email is the
 * surface users are trained to inspect for phishing, and a cartoon paw where
 * the brand mark belongs is exactly the tell they are taught to distrust.
 */
describe('verification email carries no emoji (2026-09-07)', () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'VerificationEmailDelivery.ts'), 'utf8');

  it('has no emoji anywhere in the template', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    expect(SRC).not.toMatch(emoji);
  });

  it('still renders the wordmark', () => {
    expect(SRC).toMatch(/PetWash&#8482;|PetWash\u2122/);
  });
});
