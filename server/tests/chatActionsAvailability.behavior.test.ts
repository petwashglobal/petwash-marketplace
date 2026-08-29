/**
 * Structured chat action availability — behavior pins
 * (business doctrine §7.4, §10.9, §11.1, §14.6, §32–§34, §57–§58, §62 +
 *  integrity doctrine §6.13, §66).
 *
 * The single source of truth for "which action surfaces in which phase
 * to which participant". Every chat render site consumes this rule.
 * A regression that shows Cancel on a COMPLETED booking, or Accept to
 * a customer, or Call before the booking confirms — trips a pin here
 * before the UI ships.
 */
import { describe, it, expect } from 'vitest';
import { availabilityFor } from '../../shared/marketplace/chatActions';

const bookingCtx = (overrides = {}) => ({
  threadType: 'BOOKING' as const,
  participantRole: 'BOOKER' as const,
  bookingPhase: 'CONFIRMED' as const,
  ...overrides,
});

describe('CALL — progressive contact reveal ladder (doctrine §11.1)', () => {
  it('PRE_REQUEST → not visible', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'PRE_REQUEST' }));
    expect(r.visible).toBe(false);
  });

  it('REQUESTED → not visible', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'REQUESTED' }));
    expect(r.visible).toBe(false);
  });

  it('ACCEPTED → visible + enabled', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'ACCEPTED' }));
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('CONFIRMED → visible + enabled', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'CONFIRMED' }));
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('IN_PROGRESS → prominent (still visible + enabled)', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'IN_PROGRESS' }));
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
    expect(r.reason).toMatch(/prominent/);
  });

  it('COMPLETED → visible but disabled (window expired)', () => {
    const r = availabilityFor('CALL', bookingCtx({ bookingPhase: 'COMPLETED' }));
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });

  it('SUPPORT thread never renders CALL', () => {
    const r = availabilityFor('CALL', { threadType: 'SUPPORT', participantRole: 'BOOKER' });
    expect(r.visible).toBe(false);
  });
});

describe('ACCEPT_BOOKING — only PROVIDER + only REQUESTED/QUOTED', () => {
  it('provider on REQUESTED → allowed', () => {
    const r = availabilityFor(
      'ACCEPT_BOOKING',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'REQUESTED' }),
    );
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('provider on QUOTED → allowed', () => {
    const r = availabilityFor(
      'ACCEPT_BOOKING',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'QUOTED' }),
    );
    expect(r.visible).toBe(true);
  });

  it('BOOKER cannot accept — hidden entirely', () => {
    const r = availabilityFor(
      'ACCEPT_BOOKING',
      bookingCtx({ participantRole: 'BOOKER', bookingPhase: 'REQUESTED' }),
    );
    expect(r.visible).toBe(false);
  });

  it('already CONFIRMED → hidden', () => {
    const r = availabilityFor(
      'ACCEPT_BOOKING',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'CONFIRMED' }),
    );
    expect(r.visible).toBe(false);
  });
});

describe('SEND_REVISED_QUOTE — provider only, before CONFIRMED', () => {
  it('provider on ACCEPTED → allowed', () => {
    const r = availabilityFor(
      'SEND_REVISED_QUOTE',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'ACCEPTED' }),
    );
    expect(r.visible).toBe(true);
  });

  it('provider on CONFIRMED → hidden (customer already locked the price)', () => {
    const r = availabilityFor(
      'SEND_REVISED_QUOTE',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'CONFIRMED' }),
    );
    expect(r.visible).toBe(false);
  });

  it('BOOKER cannot send a revised quote', () => {
    const r = availabilityFor(
      'SEND_REVISED_QUOTE',
      bookingCtx({ participantRole: 'BOOKER', bookingPhase: 'ACCEPTED' }),
    );
    expect(r.visible).toBe(false);
  });
});

describe('SUGGEST_CHANGE / ADD_PET / EXTEND_BOOKING — CONFIRMED or IN_PROGRESS only', () => {
  const kinds = ['SUGGEST_CHANGE', 'ADD_PET', 'EXTEND_BOOKING'] as const;

  it('all three surface during CONFIRMED', () => {
    for (const k of kinds) {
      const r = availabilityFor(k, bookingCtx({ bookingPhase: 'CONFIRMED' }));
      expect(r.visible).toBe(true);
      expect(r.enabled).toBe(true);
    }
  });

  it('all three surface during IN_PROGRESS', () => {
    for (const k of kinds) {
      const r = availabilityFor(k, bookingCtx({ bookingPhase: 'IN_PROGRESS' }));
      expect(r.visible).toBe(true);
    }
  });

  it('none surface during REQUESTED (nothing to change yet)', () => {
    for (const k of kinds) {
      const r = availabilityFor(k, bookingCtx({ bookingPhase: 'REQUESTED' }));
      expect(r.visible).toBe(false);
    }
  });

  it('none surface after COMPLETED', () => {
    for (const k of kinds) {
      const r = availabilityFor(k, bookingCtx({ bookingPhase: 'COMPLETED' }));
      expect(r.visible).toBe(false);
    }
  });
});

describe('CANCEL — both parties, active phases only (§14.6)', () => {
  it('BOOKER can cancel REQUESTED → IN_PROGRESS', () => {
    for (const phase of ['REQUESTED', 'QUOTED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] as const) {
      const r = availabilityFor('CANCEL', bookingCtx({ bookingPhase: phase }));
      expect(r.visible).toBe(true);
    }
  });

  it('PROVIDER can cancel from the same set of phases', () => {
    const r = availabilityFor(
      'CANCEL',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'CONFIRMED' }),
    );
    expect(r.visible).toBe(true);
  });

  it('cannot cancel COMPLETED / CANCELLED / DISPUTED', () => {
    for (const phase of ['COMPLETED', 'CANCELLED', 'DISPUTED'] as const) {
      const r = availabilityFor('CANCEL', bookingCtx({ bookingPhase: phase }));
      expect(r.visible).toBe(false);
    }
  });
});

describe('SCHEDULE_MEET_AND_GREET — only before confirmation', () => {
  it('PRE_REQUEST → allowed', () => {
    const r = availabilityFor(
      'SCHEDULE_MEET_AND_GREET',
      bookingCtx({ bookingPhase: 'PRE_REQUEST' }),
    );
    expect(r.visible).toBe(true);
  });

  it('CONFIRMED → hidden (use ADD_PET / SUGGEST_CHANGE instead)', () => {
    const r = availabilityFor(
      'SCHEDULE_MEET_AND_GREET',
      bookingCtx({ bookingPhase: 'CONFIRMED' }),
    );
    expect(r.visible).toBe(false);
  });
});

describe('REPORT + CONTACT_SUPPORT — always available (safety escape hatch)', () => {
  it('REPORT visible even in SUPPORT threads', () => {
    const r = availabilityFor('REPORT', { threadType: 'SUPPORT', participantRole: 'BOOKER' });
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('CONTACT_SUPPORT visible even in CANCELLED bookings', () => {
    const r = availabilityFor('CONTACT_SUPPORT', bookingCtx({ bookingPhase: 'CANCELLED' }));
    expect(r.visible).toBe(true);
  });
});

describe('KEEP_ON_PETWASH — never disabled once surfaced (integrity §45)', () => {
  it('BOOKING thread → visible + enabled', () => {
    const r = availabilityFor('KEEP_ON_PETWASH', bookingCtx({ bookingPhase: 'REQUESTED' }));
    expect(r.visible).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('MEET_AND_GREET thread → visible + enabled', () => {
    const r = availabilityFor('KEEP_ON_PETWASH', {
      threadType: 'MEET_AND_GREET',
      participantRole: 'PROVIDER',
    });
    expect(r.visible).toBe(true);
  });

  it('non-marketplace thread (SUPPORT / SHOP_ORDER) → hidden', () => {
    const r = availabilityFor('KEEP_ON_PETWASH', { threadType: 'SUPPORT', participantRole: 'BOOKER' });
    expect(r.visible).toBe(false);
  });
});

describe('REQUEST_BOOKING — only BOOKER + only before a booking exists', () => {
  it('BOOKER on PRE_REQUEST → allowed', () => {
    const r = availabilityFor('REQUEST_BOOKING', bookingCtx({ bookingPhase: 'PRE_REQUEST' }));
    expect(r.visible).toBe(true);
  });

  it('PROVIDER cannot open a booking on the customer\'s behalf', () => {
    const r = availabilityFor(
      'REQUEST_BOOKING',
      bookingCtx({ participantRole: 'PROVIDER', bookingPhase: 'PRE_REQUEST' }),
    );
    expect(r.visible).toBe(false);
  });

  it('BOOKER on already-existing REQUESTED booking → hidden', () => {
    const r = availabilityFor(
      'REQUEST_BOOKING',
      bookingCtx({ bookingPhase: 'REQUESTED' }),
    );
    expect(r.visible).toBe(false);
  });
});
