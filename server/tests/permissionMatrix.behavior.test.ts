/**
 * Permission Matrix — behavior pins (business doctrine §16, §14.8, §72).
 */
import { describe, it, expect } from 'vitest';
import {
  canReadBooking,
  canMessageOnBookingThread,
  canProposeBookingPriceChange,
  canAcceptRevisedQuote,
  canCancelBooking,
  canAddPetMidBooking,
  canAccessOwnerContact,
  canAccessEmergencyInfo,
  canReadProviderEarnings,
  canReadFiscalDocument,
  canPerformAdminAction,
  isSelfBookingAttempt,
  type BookingRel,
  type PermissionActor,
} from '../../shared/marketplace/permissionMatrix';

const rel = (o: Partial<BookingRel> = {}): BookingRel => ({
  bookerUid: 'sarah',
  providerUid: 'maya',
  bookingPhase: 'CONFIRMED',
  paymentPhase: 'PAID',
  ...o,
});

const actor = (uid: string, o: Partial<PermissionActor> = {}): PermissionActor => ({
  uid,
  workspaceHint: 'PET_PARENT',
  ...o,
});

const staff = (scope: 'support' | 'finance' | 'trust_safety' | 'admin' | 'super_admin'): PermissionActor =>
  ({ uid: 'staff_1', workspaceHint: 'ADMIN', staff: { isStaff: true, scope } });

describe('read booking', () => {
  it('booker + provider can read; third party cannot', () => {
    const r = rel();
    expect(canReadBooking(actor('sarah'), r)).toBe(true);
    expect(canReadBooking(actor('maya'), r)).toBe(true);
    expect(canReadBooking(actor('nir'), r)).toBe(false);
  });
  it('staff can read (audit scope)', () => {
    expect(canReadBooking(staff('support'), rel())).toBe(true);
  });
});

describe('message on booking thread', () => {
  it('party + policy engine ALLOW → true', () => {
    expect(canMessageOnBookingThread(actor('sarah'), rel(), true)).toBe(true);
  });
  it('party + policy engine BLOCK → false (policy authority)', () => {
    expect(canMessageOnBookingThread(actor('sarah'), rel(), false)).toBe(false);
  });
  it('non-party → false regardless of policy', () => {
    expect(canMessageOnBookingThread(actor('nir'), rel(), true)).toBe(false);
  });
});

describe('propose booking price change (§57 chat cannot change money)', () => {
  it('provider on QUOTED / ACCEPTED / IN_PROGRESS can propose', () => {
    for (const phase of ['REQUESTED', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS'] as const) {
      expect(canProposeBookingPriceChange(actor('maya'), rel({ bookingPhase: phase }))).toBe(true);
    }
  });
  it('booker cannot propose a price change (only providers do)', () => {
    expect(canProposeBookingPriceChange(actor('sarah'), rel())).toBe(false);
  });
  it('after CONFIRMED / COMPLETED / CANCELLED provider cannot re-open pricing', () => {
    for (const phase of ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'DISPUTED'] as const) {
      expect(canProposeBookingPriceChange(actor('maya'), rel({ bookingPhase: phase }))).toBe(false);
    }
  });
});

describe('accept revised quote', () => {
  it('booker on active phase → true', () => {
    expect(canAcceptRevisedQuote(actor('sarah'), rel({ bookingPhase: 'ACCEPTED' }))).toBe(true);
  });
  it('provider cannot accept their own revised quote', () => {
    expect(canAcceptRevisedQuote(actor('maya'), rel({ bookingPhase: 'ACCEPTED' }))).toBe(false);
  });
  it('booker on CANCELLED / COMPLETED cannot accept', () => {
    for (const phase of ['CANCELLED', 'COMPLETED'] as const) {
      expect(canAcceptRevisedQuote(actor('sarah'), rel({ bookingPhase: phase }))).toBe(false);
    }
  });
});

describe('cancel booking (§14.6)', () => {
  it('either party on active phases → true', () => {
    for (const phase of ['REQUESTED', 'QUOTED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] as const) {
      expect(canCancelBooking(actor('sarah'), rel({ bookingPhase: phase }))).toBe(true);
      expect(canCancelBooking(actor('maya'), rel({ bookingPhase: phase }))).toBe(true);
    }
  });
  it('non-party cannot cancel', () => {
    expect(canCancelBooking(actor('nir'), rel())).toBe(false);
  });
  it('cannot cancel after COMPLETED / CANCELLED / DISPUTED', () => {
    for (const phase of ['COMPLETED', 'CANCELLED', 'DISPUTED'] as const) {
      expect(canCancelBooking(actor('sarah'), rel({ bookingPhase: phase }))).toBe(false);
    }
  });
});

describe('add pet mid-booking (§32-§34)', () => {
  it('either party during CONFIRMED / IN_PROGRESS', () => {
    for (const phase of ['CONFIRMED', 'IN_PROGRESS'] as const) {
      expect(canAddPetMidBooking(actor('sarah'), rel({ bookingPhase: phase }))).toBe(true);
      expect(canAddPetMidBooking(actor('maya'), rel({ bookingPhase: phase }))).toBe(true);
    }
  });
  it('cannot add pet before or after the active window', () => {
    for (const phase of ['REQUESTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canAddPetMidBooking(actor('sarah'), rel({ bookingPhase: phase }))).toBe(false);
    }
  });
});

describe('owner contact reveal ladder (§11.1)', () => {
  it('provider on CONFIRMED / IN_PROGRESS can access', () => {
    for (const phase of ['CONFIRMED', 'IN_PROGRESS'] as const) {
      expect(canAccessOwnerContact(actor('maya'), rel({ bookingPhase: phase }))).toBe(true);
    }
  });
  it('provider on REQUESTED / QUOTED / ACCEPTED — no reveal yet', () => {
    for (const phase of ['REQUESTED', 'QUOTED', 'ACCEPTED'] as const) {
      expect(canAccessOwnerContact(actor('maya'), rel({ bookingPhase: phase }))).toBe(false);
    }
  });
  it('COMPLETED → no reveal (window expired)', () => {
    expect(canAccessOwnerContact(actor('maya'), rel({ bookingPhase: 'COMPLETED' }))).toBe(false);
  });
  it('booker cannot access owner contact (it is the owner\'s own)', () => {
    expect(canAccessOwnerContact(actor('sarah'), rel())).toBe(false);
  });
});

describe('emergency info (§14.4 safety beats leakage)', () => {
  it('provider during IN_PROGRESS only', () => {
    expect(canAccessEmergencyInfo(actor('maya'), rel({ bookingPhase: 'IN_PROGRESS' }))).toBe(true);
    expect(canAccessEmergencyInfo(actor('maya'), rel({ bookingPhase: 'CONFIRMED' }))).toBe(false);
    expect(canAccessEmergencyInfo(actor('maya'), rel({ bookingPhase: 'COMPLETED' }))).toBe(false);
  });
  it('non-provider cannot access', () => {
    expect(canAccessEmergencyInfo(actor('sarah'), rel({ bookingPhase: 'IN_PROGRESS' }))).toBe(false);
  });
});

describe('provider earnings + fiscal docs (§47 role separation)', () => {
  it('provider can read their own earnings; staff can too', () => {
    expect(canReadProviderEarnings({ requestedForUid: 'maya', actor: actor('maya') })).toBe(true);
    expect(canReadProviderEarnings({ requestedForUid: 'maya', actor: staff('finance') })).toBe(true);
  });
  it('other users cannot read provider earnings', () => {
    expect(canReadProviderEarnings({ requestedForUid: 'maya', actor: actor('sarah') })).toBe(false);
  });
  it('fiscal receipts: buyer holds it; other users cannot read', () => {
    expect(canReadFiscalDocument({ kind: 'CUSTOMER_RECEIPT', ownerUid: 'sarah', actor: actor('sarah') })).toBe(true);
    expect(canReadFiscalDocument({ kind: 'CUSTOMER_RECEIPT', ownerUid: 'sarah', actor: actor('nir') })).toBe(false);
  });
});

describe('self-booking guard (§14.4)', () => {
  it('same uid on both sides → true', () => {
    expect(isSelfBookingAttempt({ bookerUid: 'nir', providerUid: 'nir', bookingPhase: 'DRAFT', paymentPhase: 'UNPAID' })).toBe(true);
  });
  it('different uids → false', () => {
    expect(isSelfBookingAttempt(rel())).toBe(false);
  });
});

describe('admin actions', () => {
  it('non-staff cannot perform admin actions', () => {
    expect(canPerformAdminAction(actor('sarah'), 'suspend_provider')).toBe(false);
  });
  it('support can search but cannot suspend', () => {
    expect(canPerformAdminAction(staff('support'), 'search')).toBe(true);
    expect(canPerformAdminAction(staff('support'), 'suspend_provider')).toBe(false);
  });
  it('finance can refund_large but cannot suspend provider', () => {
    expect(canPerformAdminAction(staff('finance'), 'refund_large')).toBe(true);
    expect(canPerformAdminAction(staff('finance'), 'suspend_provider')).toBe(false);
  });
  it('trust_safety can suspend provider', () => {
    expect(canPerformAdminAction(staff('trust_safety'), 'suspend_provider')).toBe(true);
  });
  it('bulk_suspend requires super_admin', () => {
    expect(canPerformAdminAction(staff('admin'), 'bulk_suspend')).toBe(false);
    expect(canPerformAdminAction(staff('super_admin'), 'bulk_suspend')).toBe(true);
  });
  it('bulk_message allowed for admin + super_admin only', () => {
    expect(canPerformAdminAction(staff('support'), 'bulk_message')).toBe(false);
    expect(canPerformAdminAction(staff('admin'), 'bulk_message')).toBe(true);
    expect(canPerformAdminAction(staff('super_admin'), 'bulk_message')).toBe(true);
  });
});
