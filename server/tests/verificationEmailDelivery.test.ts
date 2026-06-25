import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture EmailService.send calls.
const sent: Array<{ to: string; subject: string; html: string }> = [];
vi.mock('../emailService', () => ({
  EmailService: {
    send: vi.fn(async (p: { to: string; subject: string; html: string }) => { sent.push(p); return true; }),
  },
}));
vi.mock('@shared/support-contact', () => ({ SUPPORT_EMAIL: 'support@petwash.co.il' }));

import { sendVerificationEmailCode } from '../services/VerificationEmailDelivery';

describe('sendVerificationEmailCode — signup / login (email-code OTP)', () => {
  beforeEach(() => { sent.length = 0; });

  it('sends a signup code with the join subject and the code in the body', async () => {
    const ok = await sendVerificationEmailCode({ to: 'a@b.com', code: '123456', purpose: 'signup' });
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('a@b.com');
    expect(sent[0].subject).toBe('Your PetWash verification code');
    expect(sent[0].html).toContain('123456');
    expect(sent[0].html).toMatch(/join the PetWash family/i);
  });

  it('sends a login code with the sign-in wording', async () => {
    const ok = await sendVerificationEmailCode({ to: 'a@b.com', code: '654321', purpose: 'login' });
    expect(ok).toBe(true);
    expect(sent[0].html).toContain('654321');
    expect(sent[0].html).toMatch(/sign in to PetWash/i);
  });
});
