/**
 * JobPassport foundation invariants — CEO 2026-08-27.
 *
 * Pins the READ-ONLY foundation that every later platform mapping
 * builds on:
 *   • actor registry naming (§4)
 *   • platform registry entries + honest fulfiller kinds (§5)
 *   • ID namespace: Firebase UID is the ONLY auth authority (§13, §34)
 *   • jobRef generation is DETERMINISTIC and NEVER an auth token (§13)
 *   • allowed-action projection surfaces ONE primary action per state
 *     with the correct verification method (§23, §70)
 *   • customer never sees provider money slots by default (§22)
 */
import { describe, it, expect } from 'vitest';
import {
  ACTOR_KINDS,
  isProviderKind,
  isCustomerKind,
  isMachineKind,
} from '@shared/lib/jobPassport/actorRegistry';
import {
  PLATFORMS,
  PLATFORM_CODES,
  getPlatform,
  platformFromBookingAuthority,
  platformStats,
} from '@shared/lib/jobPassport/platformRegistry';
import {
  ID_DESCRIPTORS,
  generateJobRef,
  parseJobRef,
  truncateUid,
} from '@shared/lib/jobPassport/idNamespace';
import { composeAllowedActions } from '../services/jobPassport/allowedActions';

describe('actor registry — §4', () => {
  it('names the six canonical actor kinds — no more, no fewer', () => {
    expect(ACTOR_KINDS).toEqual([
      'CUSTOMER',
      'PROVIDER',
      'PETWASH_STAFF',
      'PETWASH_MERCHANT',
      'MACHINE',
      'SYSTEM',
    ]);
  });
  it('helpers correctly classify each kind', () => {
    expect(isProviderKind('PROVIDER')).toBe(true);
    expect(isProviderKind('CUSTOMER')).toBe(false);
    expect(isCustomerKind('CUSTOMER')).toBe(true);
    expect(isMachineKind('MACHINE')).toBe(true);
    expect(isMachineKind('PROVIDER')).toBe(false);
  });
});

describe('platform registry — §5', () => {
  it('every platform code has exactly one definition', () => {
    for (const code of PLATFORM_CODES) {
      const defs = PLATFORMS.filter((p) => p.platformCode === code);
      expect(defs, `Platform code ${code} must have exactly one definition`).toHaveLength(1);
    }
  });

  it('fulfiller kinds match the CEO §4 rule — SHOP is MERCHANT, K9000 is MACHINE, EGIFT is MERCHANT', () => {
    expect(getPlatform('SHOP')?.fulfillerKind).toBe('PETWASH_MERCHANT');
    expect(getPlatform('K9000')?.fulfillerKind).toBe('MACHINE');
    expect(getPlatform('EGIFT')?.fulfillerKind).toBe('PETWASH_MERCHANT');
    expect(getPlatform('SITTER_SUITE')?.fulfillerKind).toBe('PROVIDER');
    expect(getPlatform('WALK_MY_PET')?.fulfillerKind).toBe('PROVIDER');
  });

  it('provider-requiring platforms are: SITTER_SUITE, WALK_MY_PET, ACADEMY, PETTREK, UNIFIED_REQUEST', () => {
    const withProvider = PLATFORMS.filter((p) => p.providerRequired).map((p) => p.platformCode);
    expect(withProvider.sort()).toEqual(
      ['ACADEMY', 'PETTREK', 'SITTER_SUITE', 'UNIFIED_REQUEST', 'WALK_MY_PET'].sort(),
    );
  });

  it('live tracking is supported only for WALK_MY_PET and PETTREK', () => {
    const withLive = PLATFORMS.filter((p) => p.liveTrackingSupported).map((p) => p.platformCode);
    expect(withLive.sort()).toEqual(['PETTREK', 'WALK_MY_PET'].sort());
  });

  it('platformFromBookingAuthority reverses to the correct platform for each authority', () => {
    expect(platformFromBookingAuthority('sitter_bookings')?.platformCode).toBe('SITTER_SUITE');
    expect(platformFromBookingAuthority('walk_bookings')?.platformCode).toBe('WALK_MY_PET');
    expect(platformFromBookingAuthority('trainer_bookings')?.platformCode).toBe('ACADEMY');
    expect(platformFromBookingAuthority('shop_orders')?.platformCode).toBe('SHOP');
    expect(platformFromBookingAuthority('k9000_redemptions')?.platformCode).toBe('K9000');
    expect(platformFromBookingAuthority('egift_orders')?.platformCode).toBe('EGIFT');
    expect(platformFromBookingAuthority('booking_requests')?.platformCode).toBe('UNIFIED_REQUEST');
  });

  it('platformStats surface totals honestly', () => {
    const s = platformStats();
    expect(s.total).toBe(PLATFORMS.length);
    expect(s.withProvider).toBe(5);
    expect(s.withMachine).toBe(1);
    expect(s.withMerchant).toBe(2);
    expect(s.withLiveTracking).toBe(2);
    expect(s.byCompletionProof).toHaveProperty('PROVIDER_MARK_THEN_CUSTOMER_CONFIRM');
    expect(s.byCompletionProof).toHaveProperty('STAFF_HANDOFF_CODE');
    expect(s.byCompletionProof).toHaveProperty('MACHINE_CYCLE_COMPLETE');
  });
});

describe('ID namespace — §13, §34', () => {
  it('FIREBASE_UID is the ONLY id kind flagged as an auth authority', () => {
    const auth = ID_DESCRIPTORS.filter((d) => d.isAuthAuthority).map((d) => d.kind);
    expect(auth).toEqual(['FIREBASE_UID']);
  });

  it('JOB_REF is publicly displayable but NEVER auth', () => {
    const jobRef = ID_DESCRIPTORS.find((d) => d.kind === 'JOB_REF')!;
    expect(jobRef.publiclyDisplayable).toBe(true);
    expect(jobRef.isAuthAuthority).toBe(false);
  });

  it('PROVIDER_PUBLIC_ID is publicly displayable but NEVER auth', () => {
    const pid = ID_DESCRIPTORS.find((d) => d.kind === 'PROVIDER_PUBLIC_ID')!;
    expect(pid.publiclyDisplayable).toBe(true);
    expect(pid.isAuthAuthority).toBe(false);
  });

  it('SUMIT / Nayax / payout ids are not publicly displayable', () => {
    for (const kind of ['SUMIT_DOC_ID', 'NAYAX_TX_ID', 'PAYOUT_ID', 'FIREBASE_UID'] as const) {
      const d = ID_DESCRIPTORS.find((x) => x.kind === kind)!;
      expect(d.publiclyDisplayable, `${kind} must NOT be publicly displayable`).toBe(false);
    }
  });
});

describe('jobRef generation — §2, §13', () => {
  it('deterministic — same input → same output', () => {
    const a = generateJobRef({ platform: 'WALK_MY_PET', stableId: 'walk:WALK-123' });
    const b = generateJobRef({ platform: 'WALK_MY_PET', stableId: 'walk:WALK-123' });
    expect(a).toBe(b);
  });

  it('platform hint is embedded as a single letter after PW-', () => {
    const walk = generateJobRef({ platform: 'WALK_MY_PET', stableId: 'walk:X' });
    const shop = generateJobRef({ platform: 'SHOP', stableId: 'shop:X' });
    const k9 = generateJobRef({ platform: 'K9000', stableId: 'k9:X' });
    expect(walk).toMatch(/^PW-W/);
    expect(shop).toMatch(/^PW-S/);
    expect(k9).toMatch(/^PW-K/);
  });

  it('parseJobRef round-trips the platform letter', () => {
    const jr = generateJobRef({ platform: 'SITTER_SUITE', stableId: 'sitter:X' });
    const parsed = parseJobRef(jr);
    expect(parsed?.platform.platformCode).toBe('SITTER_SUITE');
  });

  it('parseJobRef rejects garbage input safely (never throws)', () => {
    expect(parseJobRef('not-a-jobref')).toBeNull();
    expect(parseJobRef('PW-')).toBeNull();
    expect(parseJobRef('PW-ZZZZZZ')).toBeNull(); // Z isn't a real platform letter
    expect(parseJobRef('')).toBeNull();
  });

  it('uses an unambiguous alphabet — no 0/O/1/I/U/V collisions', () => {
    for (let i = 0; i < 30; i++) {
      const jr = generateJobRef({ platform: 'WALK_MY_PET', stableId: `walk:X${i}` });
      const suffix = jr.slice(4); // after PW-W
      expect(suffix).not.toMatch(/[01IOUV]/);
    }
  });

  it('truncateUid returns the last 6 chars, empty for null', () => {
    expect(truncateUid('abcdefghij')).toBe('efghij');
    expect(truncateUid(null)).toBe('');
    expect(truncateUid(undefined)).toBe('');
  });
});

describe('allowed-action projection — §23, §70', () => {
  const customer = { kind: 'CUSTOMER' as const, uid: 'cust-1' };
  const provider = { kind: 'PROVIDER' as const, uid: 'prov-1' };
  const staff = { kind: 'PETWASH_STAFF' as const, uid: 'staff-1' };

  it('customer with PAYMENT_REQUIRED sees PAY as the primary action', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'NOT_STARTED',
      moneyState: 'PAYMENT_REQUIRED',
      viewer: customer, isOwner: true, isFulfiller: false,
    });
    const pay = actions.find((a) => a.code === 'PAY');
    expect(pay?.enabled).toBe(true);
    // No START_SERVICE — that would be the wrong actor's action.
    expect(actions.find((a) => a.code === 'START_SERVICE')).toBeUndefined();
  });

  it('provider on REQUESTED sees RESPOND as the primary action, never START', () => {
    const actions = composeAllowedActions({
      platform: 'SITTER_SUITE',
      bookingState: 'REQUESTED',
      fulfillmentState: 'NOT_STARTED',
      moneyState: 'NOT_REQUIRED',
      viewer: provider, isOwner: false, isFulfiller: true,
    });
    expect(actions.find((a) => a.code === 'RESPOND')?.enabled).toBe(true);
    expect(actions.find((a) => a.code === 'START_SERVICE')).toBeUndefined();
  });

  it('provider CONFIRMED + payment still pending → WAIT_FOR_PAYMENT, not START_SERVICE (§53 cross-check)', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'NOT_STARTED',
      moneyState: 'PAYMENT_PENDING',
      viewer: provider, isOwner: false, isFulfiller: true,
    });
    expect(actions.find((a) => a.code === 'WAIT_FOR_PAYMENT')?.enabled).toBe(false);
    expect(actions.find((a) => a.code === 'START_SERVICE')).toBeUndefined();
  });

  it('provider CONFIRMED + paid → START_SERVICE with PIN verification for walk', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'NOT_STARTED',
      moneyState: 'PAID',
      viewer: provider, isOwner: false, isFulfiller: true,
    });
    const start = actions.find((a) => a.code === 'START_SERVICE');
    expect(start?.enabled).toBe(true);
    expect(start?.requiresVerification).toBe(true);
    expect(start?.verificationMethod).toBe('PIN');
  });

  it('provider PROVIDER_COMPLETED sees WAIT_FOR_CUSTOMER, never a duplicate FINISH', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'PROVIDER_COMPLETED',
      moneyState: 'PAID',
      viewer: provider, isOwner: false, isFulfiller: true,
    });
    expect(actions.find((a) => a.code === 'WAIT_FOR_CUSTOMER')?.enabled).toBe(false);
    expect(actions.find((a) => a.code === 'FINISH_SERVICE')).toBeUndefined();
  });

  it('customer PROVIDER_COMPLETED → CONFIRM_COMPLETION with customer-confirmation verification', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'PROVIDER_COMPLETED',
      moneyState: 'PAID',
      viewer: customer, isOwner: true, isFulfiller: false,
    });
    const confirm = actions.find((a) => a.code === 'CONFIRM_COMPLETION');
    expect(confirm?.enabled).toBe(true);
    expect(confirm?.verificationMethod).toBe('CUSTOMER_CONFIRMATION');
  });

  it('customer CUSTOMER_CONFIRMED (or booking COMPLETED) → REVIEW is the primary action', () => {
    const actions = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'COMPLETED',
      fulfillmentState: 'CUSTOMER_CONFIRMED',
      moneyState: 'PAID',
      viewer: customer, isOwner: true, isFulfiller: false,
    });
    expect(actions.find((a) => a.code === 'REVIEW')?.enabled).toBe(true);
  });

  it('admin viewer sees only VIEW_DETAILS — operational actions live in the admin explorer', () => {
    const actions = composeAllowedActions({
      platform: 'SITTER_SUITE',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'IN_PROGRESS',
      moneyState: 'PAID',
      viewer: staff, isOwner: false, isFulfiller: false,
    });
    expect(actions.map((a) => a.code)).toEqual(['VIEW_DETAILS']);
  });

  it('customer TRACK is only enabled on live-tracking platforms', () => {
    const walk = composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'IN_PROGRESS',
      moneyState: 'PAID',
      viewer: customer, isOwner: true, isFulfiller: false,
    });
    const sit = composeAllowedActions({
      platform: 'SITTER_SUITE',
      bookingState: 'CONFIRMED',
      fulfillmentState: 'IN_PROGRESS',
      moneyState: 'PAID',
      viewer: customer, isOwner: true, isFulfiller: false,
    });
    expect(walk.find((a) => a.code === 'TRACK')?.enabled).toBe(true);
    expect(sit.find((a) => a.code === 'TRACK')?.enabled).toBe(false);
  });
});
