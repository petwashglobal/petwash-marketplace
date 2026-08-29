/**
 * MarketplaceMessagePolicyEngine — behavior pins (integrity doctrine §16).
 *
 * These lock the 16 E2E policy scenarios from
 *   docs/architecture/petwash-marketplace-integrity-and-communications-2026.md
 * so a regression to categorisation or context handling surfaces in vitest.
 *
 * Failing legitimate pet-care language (I4) is treated as a P0 quality bar:
 * a filter that flags "in heat" or "not spayed" is broken.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateMessage,
  CURRENT_POLICY_VERSION,
  type MessageEvalInput,
} from '../../shared/marketplace/policyEngine';
import { isRateUnitValidFor, validRateUnitsFor } from '../../shared/marketplace/actors';

function base(overrides: Partial<MessageEvalInput> = {}): MessageEvalInput {
  return {
    text: '',
    threadType: 'BOOKING',
    bookingPhase: 'REQUESTED',
    senderRole: 'BOOKER',
    recipientRole: 'PROVIDER',
    policyVersion: CURRENT_POLICY_VERSION,
    ...overrides,
  };
}

describe('I1 — pre-book contact exchange BLOCKS', () => {
  it('phone number pre-request → CONTACT_EXCHANGE BLOCK', () => {
    const r = evaluateMessage(base({ text: 'call me on 050-1234567' }));
    expect(r.outcome).toBe('BLOCK');
    expect(r.matches.some((m) => m.category === 'CONTACT_EXCHANGE')).toBe(true);
  });

  it('email pre-request → CONTACT_EXCHANGE BLOCK', () => {
    const r = evaluateMessage(base({ text: 'email me at nir@example.com' }));
    expect(r.outcome).toBe('BLOCK');
  });
});

describe('I2 — direct payment attempt BLOCKS', () => {
  it('IBAN in message → OFF_PLATFORM_PAYMENT BLOCK', () => {
    const r = evaluateMessage(base({ text: 'transfer to IL620108000000099999999' }));
    expect(['BLOCK', 'BLOCK_AND_REVIEW']).toContain(r.outcome);
    expect(r.matches.some((m) => m.category === 'OFF_PLATFORM_PAYMENT')).toBe(true);
  });

  it('paypal handle → OFF_PLATFORM_PAYMENT BLOCK', () => {
    const r = evaluateMessage(base({ text: 'paypal me instead' }));
    expect(r.outcome).toBe('BLOCK');
  });

  it('off-platform booking intent phrase → BLOCK', () => {
    const r = evaluateMessage(base({ text: "cancel this and I'll do it privately in cash" }));
    expect(r.outcome).toBe('BLOCK');
    expect(r.matches.some((m) => m.category === 'OFF_PLATFORM_BOOKING')).toBe(true);
  });
});

describe('I3 — sexual solicitation BLOCKS AND REVIEWS', () => {
  it('explicit sexual proposition → BLOCK_AND_REVIEW', () => {
    const r = evaluateMessage(base({ text: 'come over for sex tonight' }));
    expect(r.outcome).toBe('BLOCK_AND_REVIEW');
    expect(r.primaryCategory).toBe('SEXUAL_SOLICITATION');
  });

  it('request for nudes → BLOCK_AND_REVIEW', () => {
    const r = evaluateMessage(base({ text: 'send me nudes' }));
    expect(r.outcome).toBe('BLOCK_AND_REVIEW');
  });
});

describe('I4 — pet medical context ALLOWS (no keyword false positive)', () => {
  it('"in heat" ALLOWS', () => {
    const r = evaluateMessage(base({ text: 'My dog Bella is in heat this week.' }));
    expect(r.outcome).toBe('ALLOW');
    expect(r.matches.filter((m) => m.category === 'SEXUAL_SOLICITATION')).toHaveLength(0);
  });

  it('"not spayed" ALLOWS', () => {
    const r = evaluateMessage(base({ text: 'She is not spayed. Please keep her away from other dogs.' }));
    expect(r.outcome).toBe('ALLOW');
  });

  it('"male, neutered" ALLOWS', () => {
    const r = evaluateMessage(base({ text: 'Bruno is male, neutered, and friendly.' }));
    expect(r.outcome).toBe('ALLOW');
  });
});

describe('I5–I8 — abuse ladder differentiates', () => {
  it('casual profanity does NOT reach threat/hate outcomes', () => {
    const r = evaluateMessage(base({ text: 'shit, traffic is terrible' }));
    expect(['ALLOW', 'ALLOW_WITH_NOTICE', 'WARN_BEFORE_SEND']).toContain(r.outcome);
    expect(r.matches.filter((m) => m.category === 'THREAT' || m.category === 'HATE_OR_SLUR')).toHaveLength(0);
  });

  it('explicit threat → BLOCK_AND_REVIEW', () => {
    const r = evaluateMessage(base({ text: "I'll find you and hurt you" }));
    expect(r.outcome).toBe('BLOCK_AND_REVIEW');
    expect(r.primaryCategory).toBe('THREAT');
  });

  it('classifier can raise ABUSIVE_LANGUAGE without deterministic hit', () => {
    const r = evaluateMessage(
      base({
        text: 'you are so incompetent',
        classifier: { ABUSIVE_LANGUAGE: 0.8 },
      }),
    );
    expect(['BLOCK', 'WARN_BEFORE_SEND']).toContain(r.outcome);
  });
});

describe('I9–I12 — context awareness (legitimate contact / medical / structured)', () => {
  it('vet phone number during CONFIRMED booking → ALLOW (legitimate contact phase)', () => {
    const r = evaluateMessage(
      base({
        threadType: 'BOOKING',
        bookingPhase: 'CONFIRMED',
        text: "Bruno's vet is Dr. Cohen 050-9876543 in case of emergency",
      }),
    );
    expect(r.outcome).toBe('ALLOW');
    expect(r.matches.filter((m) => m.category === 'CONTACT_EXCHANGE')).toHaveLength(0);
  });

  it('vet phone during PRE-REQUEST → BLOCK (not yet legitimate)', () => {
    const r = evaluateMessage(
      base({
        threadType: 'BOOKING',
        bookingPhase: 'PRE_REQUEST',
        text: "Here's my vet 050-9876543 in case",
      }),
    );
    expect(r.outcome).toBe('BLOCK');
  });

  it('SUPPORT thread mentioning WhatsApp is lower-signal than booking', () => {
    const supp = evaluateMessage(base({ threadType: 'SUPPORT', text: 'Can I get updates on WhatsApp?' }));
    const bkg = evaluateMessage(base({ threadType: 'BOOKING', text: 'text me on WhatsApp' }));
    expect(['WARN_BEFORE_SEND', 'ALLOW_WITH_NOTICE', 'ALLOW']).toContain(supp.outcome);
    expect(bkg.outcome).toBe('BLOCK');
  });
});

describe('classifier hook (§11)', () => {
  it('classifier confidence below 0.5 is ignored', () => {
    const r = evaluateMessage(
      base({ text: 'Bruno is a good dog', classifier: { SEXUAL_HARASSMENT: 0.4 } }),
    );
    expect(r.outcome).toBe('ALLOW');
  });

  it('deterministic BLOCK wins over lower-severity classifier notice', () => {
    const r = evaluateMessage(
      base({
        text: 'paypal me directly',
        classifier: { EXTERNAL_LINK: 0.6 },
      }),
    );
    expect(r.outcome).toBe('BLOCK');
  });
});

describe('policyVersion is passed through unchanged (audit stamping §6.12)', () => {
  it('policyVersion is stamped on the result', () => {
    const r = evaluateMessage(base({ text: 'hello', policyVersion: 'mpe-2026-08-29' }));
    expect(r.policyVersion).toBe('mpe-2026-08-29');
  });
});

describe('rate-unit compatibility (business doctrine §4.3)', () => {
  it('DOG_WALKING accepts PER_WALK and PER_DURATION only', () => {
    expect(isRateUnitValidFor('DOG_WALKING', 'PER_WALK')).toBe(true);
    expect(isRateUnitValidFor('DOG_WALKING', 'PER_DURATION')).toBe(true);
    expect(isRateUnitValidFor('DOG_WALKING', 'PER_DAY')).toBe(false);
    expect(isRateUnitValidFor('DOG_WALKING', 'PER_NIGHT')).toBe(false);
  });

  it('PET_SITTING accepts PER_NIGHT and PER_24H only', () => {
    expect(isRateUnitValidFor('PET_SITTING', 'PER_NIGHT')).toBe(true);
    expect(isRateUnitValidFor('PET_SITTING', 'PER_24H')).toBe(true);
    expect(isRateUnitValidFor('PET_SITTING', 'PER_WALK')).toBe(false);
  });

  it('validRateUnitsFor is stable + non-empty for every service in the catalog', () => {
    for (const svc of [
      'PET_SITTING',
      'DOG_WALKING',
      'DAYCARE',
      'HOME_VISIT',
      'TRAINING',
      'PET_TRANSPORT',
    ] as const) {
      const units = validRateUnitsFor(svc);
      expect(units.length).toBeGreaterThan(0);
    }
  });
});
