/**
 * "Keep on PetWash" reply builder — behavior pins (integrity §45).
 *
 * These lock the tone + category coverage + safeSystemReply flag so the
 * moderation audit + integrity engines never mistake this canned reply
 * for a violation (that would trap a provider trying to stay compliant).
 */
import { describe, it, expect } from 'vitest';
import { buildKeepOnPlatformReply } from '../../shared/marketplace/keepOnPlatformReply';

describe('buildKeepOnPlatformReply — Hebrew primary', () => {
  it('OFF_PLATFORM_BOOKING → Hebrew mentions PetWash + protection', () => {
    const r = buildKeepOnPlatformReply('OFF_PLATFORM_BOOKING');
    expect(r.language).toBe('he');
    expect(r.text).toMatch(/PetWash/);
    expect(r.text).toMatch(/הזמנות/); // "bookings"
    expect(r.systemTag).toBe('KEEP_ON_PETWASH');
    expect(r.safeSystemReply).toBe(true);
    expect(r.reason).toBe('OFF_PLATFORM_BOOKING');
  });

  it('OFF_PLATFORM_PAYMENT → mentions receipt / protection', () => {
    const r = buildKeepOnPlatformReply('OFF_PLATFORM_PAYMENT');
    expect(r.text).toMatch(/תשלום|קבלה/); // "payment" / "receipt"
    expect(r.reason).toBe('OFF_PLATFORM_PAYMENT');
  });

  it('CONTACT_EXCHANGE → asks to stay in PetWash chat, mentions built-in call', () => {
    const r = buildKeepOnPlatformReply('CONTACT_EXCHANGE');
    expect(r.text).toMatch(/צ׳אט של PetWash|כפתור המובנה/);
    expect(r.reason).toBe('CONTACT_EXCHANGE');
  });

  it('EXTERNAL_MESSAGING_APP → tone matches CONTACT_EXCHANGE (also keeps chat here)', () => {
    const r = buildKeepOnPlatformReply('EXTERNAL_MESSAGING_APP');
    expect(r.text).toMatch(/PetWash/);
    expect(r.reason).toBe('EXTERNAL_MESSAGING_APP');
  });

  it('unknown / unrelated category → GENERIC template', () => {
    const r = buildKeepOnPlatformReply(undefined);
    expect(r.reason).toBe('GENERIC');
    expect(r.text).toMatch(/PetWash/);
  });

  it('safety category (THREAT / HATE / SEXUAL) falls back to GENERIC — never emits a specific "keep here" for those', () => {
    // Those categories are not marketplace-integrity violations; they are
    // safety events. A "keep on PetWash" reply would be an inappropriate
    // acknowledgement of a threat. GENERIC surfaces the platform in a
    // neutral way while the safety pipeline handles the real event.
    const r = buildKeepOnPlatformReply('THREAT');
    expect(r.reason).toBe('THREAT');
    expect(r.text).toMatch(/PetWash/);
    // Text is the GENERIC template — no threat acknowledgement, and NOT
    // the OFF_PLATFORM_BOOKING / _PAYMENT / CONTACT_EXCHANGE specific copy.
    expect(r.text).not.toMatch(/עדכון הזמנה|כפתור המובנה/);
  });
});

describe('buildKeepOnPlatformReply — English fallback', () => {
  it('OFF_PLATFORM_BOOKING in English mentions PetWash + calendar/records/support', () => {
    const r = buildKeepOnPlatformReply('OFF_PLATFORM_BOOKING', 'en');
    expect(r.language).toBe('en');
    expect(r.text).toMatch(/PetWash/);
    expect(r.text).toMatch(/calendar|records|support/i);
  });

  it('CONTACT_EXCHANGE in English mentions the built-in call button (after confirmation)', () => {
    const r = buildKeepOnPlatformReply('CONTACT_EXCHANGE', 'en');
    expect(r.text).toMatch(/call button/i);
    expect(r.text).toMatch(/confirmed/i);
  });
});

describe('safe-system-reply invariant', () => {
  it('every reply is flagged safeSystemReply: true', () => {
    for (const cat of [
      'OFF_PLATFORM_BOOKING',
      'OFF_PLATFORM_PAYMENT',
      'CONTACT_EXCHANGE',
      'EXTERNAL_MESSAGING_APP',
      undefined,
    ] as const) {
      const r = buildKeepOnPlatformReply(cat);
      expect(r.safeSystemReply).toBe(true);
      expect(r.systemTag).toBe('KEEP_ON_PETWASH');
    }
  });
});
