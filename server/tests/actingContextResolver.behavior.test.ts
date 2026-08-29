/**
 * ActingContextResolver — behavior pins
 * (business doctrine §2, §3.3, §14.4, §14.8, §72).
 *
 * Locks the fundamental identity != transaction role separation: same UID
 * can be BOOKER on one booking and PROVIDER on another, and the resolver
 * makes that legible from the authenticated uid + entity relationship.
 */
import { describe, it, expect } from 'vitest';
import {
  contextForBooking,
  contextForShopOrder,
  contextForEGift,
  isSelfBooking,
} from '../services/marketplace/ActingContextResolver';

const NIR = 'usr_nir_abc123';
const MAYA = 'usr_maya_def456';
const DAVID = 'usr_david_ghi789';
const SARAH = 'usr_sarah_jkl012';

describe('booking — same UID, different transaction capacities (doctrine §2)', () => {
  it('Nir booking Maya to walk Bruno → Nir is BOOKER on THIS booking', () => {
    const ctx = contextForBooking(NIR, { bookerUid: NIR, providerUid: MAYA });
    expect(ctx.actorUid).toBe(NIR);
    expect(ctx.transactionRole).toBe('BOOKER');
    expect(ctx.workspaceContext).toBe('PET_PARENT');
  });

  it('David booking Nir to sit Bella → Nir is PROVIDER on THIS booking', () => {
    const ctx = contextForBooking(NIR, { bookerUid: DAVID, providerUid: NIR });
    expect(ctx.transactionRole).toBe('PROVIDER');
    expect(ctx.workspaceContext).toBe('PROVIDER');
  });

  it('third party (not booker, not provider) → resolver refuses to handle the booking', () => {
    expect(() =>
      contextForBooking(SARAH, { bookerUid: NIR, providerUid: MAYA }),
    ).toThrow(/not a party/);
  });
});

describe('workspace hint is view-only, transaction role wins (doctrine §14.8, §72)', () => {
  it('BOOKER-in-a-booking with hint=PROVIDER still resolves as PET_PARENT workspace', () => {
    const ctx = contextForBooking(
      NIR,
      { bookerUid: NIR, providerUid: MAYA },
      'PROVIDER',
    );
    // The UI hint doesn't grant provider view of a booking where Nir is the customer.
    expect(ctx.workspaceContext).toBe('PET_PARENT');
    expect(ctx.transactionRole).toBe('BOOKER');
  });

  it('ADMIN hint carries through when actor holds admin (workspace stays ADMIN)', () => {
    const ctx = contextForBooking(
      NIR,
      { bookerUid: NIR, providerUid: MAYA },
      'ADMIN',
    );
    expect(ctx.workspaceContext).toBe('ADMIN');
  });
});

describe('self-booking guard (doctrine §14.4, §53)', () => {
  it('detects same uid on both sides', () => {
    expect(isSelfBooking({ bookerUid: NIR, providerUid: NIR })).toBe(true);
    expect(isSelfBooking({ bookerUid: NIR, providerUid: MAYA })).toBe(false);
  });

  it('resolver still returns a canonical shape (BOOKER) so the route can reject', () => {
    const ctx = contextForBooking(NIR, { bookerUid: NIR, providerUid: NIR });
    expect(ctx.transactionRole).toBe('BOOKER');
    // Callers combine this with isSelfBooking(...) → 400.
  });
});

describe('shop orders (doctrine §40)', () => {
  it('buyer resolves as BUYER + PET_PARENT workspace', () => {
    const ctx = contextForShopOrder(SARAH, { buyerUid: SARAH });
    expect(ctx.transactionRole).toBe('BUYER');
    expect(ctx.workspaceContext).toBe('PET_PARENT');
  });

  it('non-buyer is refused', () => {
    expect(() => contextForShopOrder(NIR, { buyerUid: SARAH })).toThrow(/not the buyer/);
  });
});

describe('eGift buyer vs recipient (doctrine §43)', () => {
  it('buyer resolves as BUYER', () => {
    const ctx = contextForEGift(SARAH, { buyerUid: SARAH, recipientUid: DAVID });
    expect(ctx.transactionRole).toBe('BUYER');
  });

  it('recipient resolves as RECIPIENT', () => {
    const ctx = contextForEGift(DAVID, { buyerUid: SARAH, recipientUid: DAVID });
    expect(ctx.transactionRole).toBe('RECIPIENT');
  });

  it('random third party is refused', () => {
    expect(() =>
      contextForEGift(NIR, { buyerUid: SARAH, recipientUid: DAVID }),
    ).toThrow(/not a party/);
  });
});
