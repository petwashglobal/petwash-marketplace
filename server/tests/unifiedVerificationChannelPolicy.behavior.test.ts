/**
 * Behavioural pins for the unified verification CHANNEL POLICY and the
 * masked-destination wire contract.
 *
 * The rule these enforce (CEO 2026-09-06): "High-risk financial/security
 * action → server decides required step-up based on policy; UI must not
 * choose weaker security itself." A policy that lives only in the React
 * component is not a policy — anyone can edit a request body. So the
 * enforcement point is the service, and this is where that is proven.
 */
import { describe, expect, it } from 'vitest';
import {
  unifiedVerificationPurposeRegistry,
  type VerificationChannel,
} from '../services/UnifiedVerificationService';
import {
  maskDestinationForOwner,
  maskEmailForOwner,
  maskPhoneForOwner,
} from '../../shared/auth/verificationDestination';

describe('channel policy — the registry is the authority', () => {
  const purposes = Object.values(unifiedVerificationPurposeRegistry);

  it('every purpose declares a channel policy', () => {
    for (const p of purposes) {
      expect(Array.isArray(p.allowedChannels), p.purpose).toBe(true);
      expect(p.allowedChannels.length, p.purpose).toBeGreaterThan(0);
      expect(typeof p.recommendedChannel, p.purpose).toBe('string');
      expect(typeof p.provesDestinationOwnership, p.purpose).toBe('boolean');
    }
  });

  it('the recommended channel is always one of the allowed channels', () => {
    for (const p of purposes) {
      expect(p.allowedChannels, p.purpose).toContain(p.recommendedChannel);
    }
  });

  it('EMAIL-FIRST ECONOMICS: every purpose that permits email recommends it', () => {
    // SMS costs real money per send; email does not. Anywhere email is
    // sufficient it must be the default the UI offers first.
    for (const p of purposes) {
      if (p.allowedChannels.includes('email' as VerificationChannel)) {
        expect(p.recommendedChannel, `${p.purpose} permits email but does not recommend it`).toBe('email');
      }
    }
    // …and the converse: a purpose that does NOT permit email must have a
    // stated reason, i.e. it proves ownership of a non-email destination.
    for (const p of purposes) {
      if (!p.allowedChannels.includes('email' as VerificationChannel)) {
        expect(p.provesDestinationOwnership, `${p.purpose} forgoes free email delivery for no stated reason`).toBe(true);
      }
    }
  });

  it('change_email can ONLY go to email — anything else proves nothing', () => {
    const p = unifiedVerificationPurposeRegistry.change_email;
    expect([...p.allowedChannels]).toEqual(['email']);
    expect(p.provesDestinationOwnership).toBe(true);
  });

  it('a purpose that proves destination ownership never mixes destination KINDS', () => {
    /**
     * The rule is not "exactly one channel" — sms and whatsapp both deliver to
     * the same phone number, so either one proves control of that number, and
     * change_phone legitimately allows both.
     *
     * The rule is that the allowed channels must all address the SAME KIND of
     * destination. The moment a prove-ownership purpose accepts both an email
     * channel and a phone channel, the code can be sent somewhere that says
     * nothing about the thing being claimed, and the verification becomes
     * decorative. That is what this catches.
     */
    const kindOf = (c: string) => (c === 'email' ? 'email' : c === 'push' ? 'push' : 'phone');
    for (const p of purposes) {
      if (!p.provesDestinationOwnership) continue;
      const kinds = new Set(p.allowedChannels.map(kindOf));
      expect([...kinds], `${p.purpose} mixes destination kinds`).toHaveLength(1);
    }
  });

  it('change_phone can ONLY go to the new handset — email would prove nothing', () => {
    const p = unifiedVerificationPurposeRegistry.change_phone;
    expect([...p.allowedChannels].sort()).toEqual(['sms', 'whatsapp']);
    expect(p.allowedChannels).not.toContain('email');
    expect(p.recommendedChannel).toBe('sms');
    expect(p.provesDestinationOwnership).toBe(true);
    expect(p.requiresSession).toBe(true);
    expect(p.sensitive).toBe(true);
    expect(p.ttlSeconds).toBe(300);
    expect(p.maxAttempts).toBe(5);
  });

  it('change_phone hands the proven number back for the caller to apply, and writes nothing itself', async () => {
    const result = await unifiedVerificationPurposeRegistry.change_phone.execute(
      { channel: 'sms', destination: '+972501233360', userId: 'u1', payload: {} } as any,
      {} as any,
    );
    expect((result.metadata as any).action).toBe('change_phone');
    expect((result.metadata as any).newPhoneE164).toBe('+972501233360');
  });

  it('sensitive purposes keep a non-email fallback so an email lockout is not an account lockout', () => {
    for (const p of purposes) {
      if (!p.sensitive) continue;
      if (p.provesDestinationOwnership) continue; // change_email / change_phone are legitimately single-kind
      const hasPhoneFallback = p.allowedChannels.some((c) => c === 'sms' || c === 'whatsapp');
      expect(hasPhoneFallback, `${p.purpose} would strand a customer locked out of email`).toBe(true);
    }
  });

  it('every sensitive purpose requires a signed-in session', () => {
    for (const p of purposes) {
      if (p.sensitive) expect(p.requiresSession, p.purpose).toBe(true);
    }
  });
});

describe('login/signup execute() must not assert a phone it never verified', () => {
  /**
   * The token minted here is { phone, type: "sms-verified" }, and its consumer
   * calls fbAdminAuth.updateUser(uid, { phoneNumber }). Minting it from an
   * EMAIL challenge would assert an email address is a verified phone number.
   */
  const fakeChallenge = (channel: string, destination: string) =>
    ({ channel, destination, userId: 'u1', payload: {} }) as any;

  it('an email-channel login mints NO phone verification token', async () => {
    const result = await unifiedVerificationPurposeRegistry.login.execute(
      fakeChallenge('email', 'someone@example.com'),
      {} as any,
    );
    expect(result.verificationToken).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.emailVerified).toBe(true);
  });

  it('an email-channel signup carries NO phoneE164', async () => {
    const result = await unifiedVerificationPurposeRegistry.signup.execute(
      fakeChallenge('email', 'someone@example.com'),
      {} as any,
    );
    expect((result.metadata as any).phoneE164).toBeUndefined();
    expect((result.metadata as any).emailVerified).toBe('someone@example.com');
  });

  it('a phone-channel signup still carries phoneE164 — the fix must not break the SMS path', async () => {
    const result = await unifiedVerificationPurposeRegistry.signup.execute(
      fakeChallenge('sms', '+972501233360'),
      {} as any,
    );
    expect((result.metadata as any).phoneE164).toBe('+972501233360');
  });
});

describe('destination masking — the customer learns which inbox, not the address', () => {
  it('keeps the domain so the customer knows where to look', () => {
    expect(maskEmailForOwner('nirhadad1@gmail.com')).toBe('n•••••••1@gmail.com');
  });

  it('never returns the raw value', () => {
    for (const raw of ['nirhadad1@gmail.com', 'a@b.com', 'ab@x.co.il']) {
      expect(maskEmailForOwner(raw)).not.toBe(raw);
    }
  });

  it('a two-character local part does not reveal itself', () => {
    // "ab@x.co.il" must not come back as "ab@x.co.il" with both chars intact.
    const masked = maskEmailForOwner('ab@x.co.il');
    expect(masked).toBe('a••@x.co.il');
    expect(masked).not.toContain('ab@');
  });

  it('keeps the country prefix and last 4 of a phone', () => {
    expect(maskPhoneForOwner('+972501233360')).toBe('+972 ••• 3360');
  });

  it('routes by channel', () => {
    expect(maskDestinationForOwner('email', 'x@y.com')).toContain('@y.com');
    expect(maskDestinationForOwner('sms', '+972501233360')).toContain('3360');
    expect(maskDestinationForOwner('push', 'anything')).toBe('•••');
  });

  it('degrades safely on junk rather than echoing it', () => {
    expect(maskEmailForOwner('not-an-email')).toBe('•••');
    expect(maskPhoneForOwner('12')).toBe('•••');
    expect(maskDestinationForOwner('email', '')).toBe('•••');
  });
});
