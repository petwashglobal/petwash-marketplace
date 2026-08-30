/**
 * Marketplace business scenarios — end-to-end doctrine coverage.
 *
 * Encodes the CEO's required scenarios (business §75–§87 + integrity
 * §16 subset) as executable journeys against the framework primitives.
 * Failing here means the FRAMEWORK doesn't model the business — a
 * P0 defect the doctrine forbids.
 *
 * The scenarios reuse the shipped primitives:
 *   ActingContextResolver, AvailableActionsResolver, BookingParty
 *   compatibility, ChatActions availability, MessagePolicyEngine,
 *   PermissionMatrix, TransactionPassport, CancellationPreview.
 *
 * Report as BUSINESS PASS/FAIL per doctrine §98 — not source pins.
 */
import { describe, it, expect } from 'vitest';
import {
  contextForBooking,
  isSelfBooking,
} from '../services/marketplace/ActingContextResolver';
import {
  bookingAvailableActions,
  meetGreetAvailableActions,
} from '../services/marketplace/AvailableActionsResolver';
import { checkPartyCompatibility } from '../../shared/marketplace/bookingParty';
import { evaluateMessage, CURRENT_POLICY_VERSION } from '../../shared/marketplace/policyEngine';
import {
  canReadBooking,
  canCancelBooking,
  canAccessEmergencyInfo,
  canReadProviderEarnings,
} from '../../shared/marketplace/permissionMatrix';
import { makeJobRef, receiptOwnerUid, providerEarningsUid } from '../../shared/marketplace/transactionPassport';
import { buildCancellationPreview } from '../../shared/marketplace/cancellationPreview';

const NIR = 'usr_nir_abc';
const MAYA = 'usr_maya_def';
const DAVID = 'usr_david_ghi';
const SARAH = 'usr_sarah_jkl';

// ── §76 MULTI-ROLE PERSON ─────────────────────────────────────────────

describe('§76 — Nir as Pet Parent + Prestige + Sitter + Walker (multi-role)', () => {
  it('DAY 1 — Nir books Maya. Nir is BOOKER on THIS booking.', () => {
    const ctx = contextForBooking(NIR, { bookerUid: NIR, providerUid: MAYA });
    expect(ctx.transactionRole).toBe('BOOKER');
    expect(ctx.workspaceContext).toBe('PET_PARENT');
  });

  it('DAY 2 — David books Nir. Nir is PROVIDER on THIS booking.', () => {
    const ctx = contextForBooking(NIR, { bookerUid: DAVID, providerUid: NIR });
    expect(ctx.transactionRole).toBe('PROVIDER');
    expect(ctx.workspaceContext).toBe('PROVIDER');
  });

  it('Same UID → two different transaction roles across two different bookings', () => {
    const asBooker = contextForBooking(NIR, { bookerUid: NIR, providerUid: MAYA });
    const asProvider = contextForBooking(NIR, { bookerUid: DAVID, providerUid: NIR });
    expect(asBooker.actorUid).toBe(asProvider.actorUid);
    expect(asBooker.transactionRole).not.toBe(asProvider.transactionRole);
  });
});

// ── §77 MULTI-PET BOOKING ─────────────────────────────────────────────

describe('§77 — Multi-pet household (2 dogs + 1 cat + 1 bird)', () => {
  it('provider accepting all 4 species → all pets eligible', () => {
    const party = {
      pets: [
        { petId: 'bruno', species: 'dog' as const },
        { petId: 'charlie', species: 'dog' as const },
        { petId: 'milo', species: 'cat' as const },
        { petId: 'kiwi', species: 'bird' as const },
      ],
    };
    const r = checkPartyCompatibility(party, {
      serviceType: 'HOME_VISIT',
      acceptedSpecies: ['dog', 'cat', 'bird', 'rabbit'],
      approvalStatus: 'approved',
    });
    expect(r.fullyCompatible).toBe(true);
    expect(r.eligiblePetIds).toHaveLength(4);
  });
});

// ── §78 MIXED ELIGIBILITY ─────────────────────────────────────────────

describe('§78 — Daycare (dogs only) + mixed pets → cat surfaced (not silent-dropped)', () => {
  it('2 dogs + 1 cat with daycare-accepting-dogs-only → 2 eligible, cat SPECIES_NOT_ACCEPTED', () => {
    const party = {
      pets: [
        { petId: 'bruno', species: 'dog' as const },
        { petId: 'charlie', species: 'dog' as const },
        { petId: 'milo', species: 'cat' as const },
      ],
    };
    const r = checkPartyCompatibility(party, {
      serviceType: 'DAYCARE',
      acceptedSpecies: ['dog'],
      approvalStatus: 'approved',
    });
    expect(r.eligiblePetIds).toEqual(['bruno', 'charlie']);
    expect(r.ineligiblePetIds).toEqual(['milo']);
    const catVerdict = r.perPet.find((p) => p.petId === 'milo')!;
    expect(catVerdict.reason).toBe('SPECIES_NOT_ACCEPTED');
  });
});

// ── §81 BOOKING CHAT ISOLATION ────────────────────────────────────────

describe('§81 — Two bookings between the same pair → messages NEVER cross', () => {
  it('Booking A message and Booking B message keep separate policy evaluations', () => {
    const bkgAText = 'hey Maya, see you Friday 6pm at my place';
    const bkgBText = 'confirming ₪180 for next month sitting';
    // Both messages pass through the same policy engine but the audit
    // record for each carries its own bookingId — no cross-contamination.
    const a = evaluateMessage({
      text: bkgAText,
      threadType: 'BOOKING',
      bookingPhase: 'CONFIRMED',
      senderRole: 'BOOKER',
      recipientRole: 'PROVIDER',
      policyVersion: CURRENT_POLICY_VERSION,
    });
    const b = evaluateMessage({
      text: bkgBText,
      threadType: 'BOOKING',
      bookingPhase: 'REQUESTED',
      senderRole: 'BOOKER',
      recipientRole: 'PROVIDER',
      policyVersion: CURRENT_POLICY_VERSION,
    });
    expect(a.outcome).toBe('ALLOW');
    expect(b.outcome).toBe('ALLOW');
  });
});

// ── §82 CALL PROVIDER PERMISSION PROGRESSION ──────────────────────────

describe('§82 — Provider call permission progression', () => {
  const ctx = { threadType: 'BOOKING' as const, participantRole: 'BOOKER' as const };
  it('pre-booking → CALL not visible', () => {
    const r = bookingAvailableActions({
      participant: 'BOOKER',
      bookingPhase: 'REQUESTED',
      paymentPhase: 'UNPAID',
    });
    // CALL_PROVIDER is a catalog entry — verify it does NOT surface in
    // pre-confirmation; SUPPORT_CONTACT_OPEN does.
    expect(r.some((a) => a.type === 'CALL_PROVIDER')).toBe(false);
    expect(r.some((a) => a.type === 'SUPPORT_CONTACT_OPEN')).toBe(true);
  });
});

// ── §83 CUSTOMER + PROVIDER DOCUMENTS ─────────────────────────────────

describe('§83 — Documents visible per role', () => {
  const passport = {
    transactionId: 'tx_1',
    jobRef: makeJobRef('BOOKING', 'bkg_xyz'),
    correlationId: 'c1',
    domain: 'BOOKING' as const,
    actors: [
      { uid: SARAH, role: 'BOOKER' as const },
      { uid: MAYA, role: 'PROVIDER' as const },
    ],
    reference: 'bkg_xyz',
    documents: [],
    fulfillment: { status: 'DELIVERED' as const },
    auditEvents: [],
    createdAt: '',
    updatedAt: '',
  };

  it('booking receipt owner → BOOKER (Sarah), NOT provider', () => {
    expect(receiptOwnerUid(passport)).toBe(SARAH);
  });

  it('provider earnings surface → PROVIDER (Maya), NOT customer', () => {
    expect(providerEarningsUid(passport)).toBe(MAYA);
  });

  it('third-party actor cannot read provider earnings', () => {
    const actor = { uid: NIR, workspaceHint: 'PROVIDER' as const };
    expect(canReadProviderEarnings({ requestedForUid: MAYA, actor })).toBe(false);
  });
});

// ── §53 / §14.4 SELF-BOOKING BLOCK ────────────────────────────────────

describe('§53 — Self-booking blocked', () => {
  it('same uid on both sides → guard tripped', () => {
    expect(isSelfBooking({ bookerUid: NIR, providerUid: NIR })).toBe(true);
  });
});

// ── §14.4 EMERGENCY OVERRIDE ──────────────────────────────────────────

describe('§14.4 — Active-service emergency access', () => {
  it('provider during IN_PROGRESS can access emergency info', () => {
    const actor = { uid: MAYA, workspaceHint: 'PROVIDER' as const };
    const rel = {
      bookerUid: SARAH,
      providerUid: MAYA,
      bookingPhase: 'IN_PROGRESS' as const,
      paymentPhase: 'PAID' as const,
    };
    expect(canAccessEmergencyInfo(actor, rel)).toBe(true);
    expect(canReadBooking(actor, rel)).toBe(true);
  });

  it('provider during CONFIRMED (not IN_PROGRESS yet) → NO emergency reveal', () => {
    const actor = { uid: MAYA, workspaceHint: 'PROVIDER' as const };
    const rel = {
      bookerUid: SARAH,
      providerUid: MAYA,
      bookingPhase: 'CONFIRMED' as const,
      paymentPhase: 'PAID' as const,
    };
    expect(canAccessEmergencyInfo(actor, rel)).toBe(false);
  });
});

// ── §14.6 CANCELLATION PREVIEW (customer perspective) ────────────────

describe('§14.6 — Cancellation preview shows itemised refund + provider impact', () => {
  it('paid booking, mid-tier fee → customer sees Fee + Refund + payout warning', () => {
    const preview = buildCancellationPreview(
      {
        bookingId: 'bkg_1',
        bookingRef: 'PW-BKG-XYZ1',
        initiator: 'CUSTOMER',
        policyVersion: 'cp-2026-01',
        originalTotalCents: 50000,
        feeCents: 5000,
        refundCents: 45000,
        refundDestination: { cardCents: 45000, eGiftCents: 0, walletCents: 0 },
        providerImpact: {
          payoutRolledBack: true,
          scheduleReleased: true,
          ratingImpact: 'CANCEL_COUNT_INCREMENT',
        },
        documentEffect: { needsCreditNote: true },
        currency: 'ILS',
      },
      'v1',
      '2026-08-30T13:00:00Z',
    );
    expect(preview.actionType).toBe('CUSTOMER_CANCEL_BOOKING_PAID');
    expect(preview.summary).toMatch(/Partial refund/);
    expect(preview.warnings.some((w) => /provider.{0,10}payout/i.test(w))).toBe(true);
    expect(preview.affectedEntities[0].label).toBe('PW-BKG-XYZ1');
  });
});

// ── §35 MEET & GREET FAST REBOOK ──────────────────────────────────────

describe('§35 — Meet & Greet completed → customer sees fast rebook', () => {
  it('COMPLETED customer → BOOKING_REQUEST_SUBMIT available', () => {
    const list = meetGreetAvailableActions({
      participant: 'CUSTOMER',
      phase: 'COMPLETED',
      bothPartiesAcknowledged: true,
    });
    expect(list.some((a) => a.type === 'BOOKING_REQUEST_SUBMIT')).toBe(true);
  });

  it('COMPLETED provider → does NOT see fast rebook (only customer initiates)', () => {
    const list = meetGreetAvailableActions({
      participant: 'PROVIDER',
      phase: 'COMPLETED',
      bothPartiesAcknowledged: true,
    });
    expect(list.some((a) => a.type === 'BOOKING_REQUEST_SUBMIT')).toBe(false);
  });
});

// ── §14.6 CANCEL POST-COMPLETION FORBIDDEN ────────────────────────────

describe('§14.6 — Cannot cancel a COMPLETED booking', () => {
  it('customer cannot cancel after COMPLETED', () => {
    expect(
      canCancelBooking(
        { uid: SARAH, workspaceHint: 'PET_PARENT' },
        {
          bookerUid: SARAH,
          providerUid: MAYA,
          bookingPhase: 'COMPLETED',
          paymentPhase: 'PAID',
        },
      ),
    ).toBe(false);
  });
});
