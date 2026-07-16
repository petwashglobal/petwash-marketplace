/**
 * Gift a Moment (#16) — unit tests for the pure gift helpers.
 *
 * Locks the contract: gifting NEVER changes the money path (that is enforced
 * by construction — these helpers only validate input, format the audit note,
 * and build the delivery email), recipient input is strictly validated, and
 * the email contains only true statements (reward, code, expiry — no discount
 * or benefit claims).
 */
import { describe, it, expect } from 'vitest';
import { validateGift, giftNoteLine, buildGiftEmail } from '../services/giftAMoment';

const GOOD = { recipientName: 'Dana Levi', recipientEmail: 'Dana@Example.com', message: 'מזל טוב!' };

describe('validateGift', () => {
  it('accepts a valid gift and normalizes the email to lowercase', () => {
    const r = validateGift(GOOD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gift.recipientEmail).toBe('dana@example.com');
    expect(r.gift.recipientName).toBe('Dana Levi');
    expect(r.gift.message).toBe('מזל טוב!');
  });

  it('rejects a missing or empty recipient name', () => {
    expect(validateGift({ ...GOOD, recipientName: '' }).ok).toBe(false);
    expect(validateGift({ ...GOOD, recipientName: '   ' }).ok).toBe(false);
    const { recipientName: _n, ...rest } = GOOD;
    expect(validateGift(rest).ok).toBe(false);
  });

  it('rejects a name over 80 chars', () => {
    expect(validateGift({ ...GOOD, recipientName: 'x'.repeat(81) }).ok).toBe(false);
  });

  it.each(['not-an-email', 'a@b', 'a b@c.com', '@x.com', 'a@.com'])('rejects bad email %s', (email) => {
    expect(validateGift({ ...GOOD, recipientEmail: email }).ok).toBe(false);
  });

  it('truncates the message to 280 chars and drops an empty one', () => {
    const long = validateGift({ ...GOOD, message: 'y'.repeat(500) });
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.gift.message!.length).toBe(280);
    const empty = validateGift({ ...GOOD, message: '   ' });
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.gift.message).toBeUndefined();
  });

  it('rejects non-object payloads', () => {
    expect(validateGift(null).ok).toBe(false);
    expect(validateGift('gift').ok).toBe(false);
    expect(validateGift(42).ok).toBe(false);
  });
});

describe('giftNoteLine', () => {
  it('formats the admin-visible gift note', () => {
    expect(giftNoteLine({ recipientName: 'Dana', recipientEmail: 'd@x.co' }))
      .toBe('GIFT → Dana <d@x.co>');
  });
  it('includes the personal message when present', () => {
    expect(giftNoteLine({ recipientName: 'Dana', recipientEmail: 'd@x.co', message: 'happy birthday' }))
      .toBe('GIFT → Dana <d@x.co> — "happy birthday"');
  });
});

describe('buildGiftEmail', () => {
  const params = {
    gift: { recipientName: 'Dana', recipientEmail: 'd@x.co', message: 'be-well <3' },
    senderName: 'Nir H',
    rewardName: 'Free K9000 Wash',
    voucherCode: 'REWARD-123-ABCDE',
    expiresAt: new Date('2026-08-15T00:00:00Z'),
  };

  it('contains the voucher code, reward, sender and recipient', () => {
    const { subject, html } = buildGiftEmail(params);
    expect(subject).toContain('Nir H');
    expect(html).toContain('REWARD-123-ABCDE');
    expect(html).toContain('Free K9000 Wash');
    expect(html).toContain('Dana');
  });

  it('escapes HTML in user-supplied fields', () => {
    const { html } = buildGiftEmail({
      ...params,
      gift: { recipientName: '<script>x</script>', recipientEmail: 'd@x.co' },
      senderName: 'a<b>&c',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a&lt;b&gt;&amp;c');
  });

  it('renders expiry when present and omits it when null', () => {
    const withExpiry = buildGiftEmail(params).html;
    expect(withExpiry).toContain('בתוקף עד');
    const noExpiry = buildGiftEmail({ ...params, expiresAt: null }).html;
    expect(noExpiry).not.toContain('בתוקף עד');
    expect(noExpiry).not.toContain('Valid until');
  });

  it('makes no discount or benefit claims (truth rule)', () => {
    const { html } = buildGiftEmail(params);
    for (const banned of ['%', 'discount', 'הנחה', 'free wash', 'guarantee']) {
      // reward NAME may legitimately contain words; check outside of it
      const stripped = html.replace(/Free K9000 Wash/g, '');
      expect(stripped.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
