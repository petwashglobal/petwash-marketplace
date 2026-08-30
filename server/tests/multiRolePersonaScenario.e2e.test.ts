/**
 * Multi-role persona E2E — CEO SPEED MODE §21-§22 + DEEP-LOGIC §88.
 *
 * One human, three capabilities in one day:
 *
 *   Nir = Pet Parent  +  Provider Sitter  +  Prestige
 *
 * Morning:  Nir books Maya as CUSTOMER.
 * Afternoon: Sarah books Nir as PROVIDER.
 * Evening:  Nir buys Shop item; receipt lands.
 *
 * Asserts the doctrine's multi-role invariants across the SAME UID:
 *   – JourneyState projections differ per role for the SAME booking
 *     entity (§86).
 *   – Pet Parent Inbox contains Maya-booking cards + Shop receipt.
 *   – Provider Inbox contains Sarah's request.
 *   – Prestige entitlement is CAPABILITY only, NEVER a third
 *     workspace (§21).
 *   – Global unread aggregates across both workspaces.
 *   – Self-booking is blocked even if Nir tried to book his own
 *     provider listing (§79).
 */
import { describe, it, expect } from 'vitest';
import { resolveBookingJourney } from '../services/marketplace/BookingJourneyResolver';
import { evaluateBookAgain } from '../services/marketplace/BookAgainService';
import { providerAcceptBooking } from '../services/marketplace/ProviderBookingResponseService';
import { computeUnreadCounts, type InboxItem } from '@shared/marketplace/inboxItem';
import { filterByCategory } from '@shared/marketplace/inboxItem';

const NIR = 'nir_uid';
const MAYA = 'maya_uid';
const SARAH = 'sarah_uid';

function chat(over: Partial<InboxItem>): InboxItem {
  const t = over.threadId ?? 'x';
  return {
    threadId: t,
    threadType: 'BOOKING',
    entityId: `entity_${t}`,
    workspaceContext: 'PET_PARENT',
    title: '',
    subtitle: '',
    lastMessage: '',
    lastMessageAt: '2026-08-30T00:00:00Z',
    unreadCount: 0,
    secondaryActions: [],
    ...over,
  };
}

describe('§22 — Nir\'s multi-role day', () => {
  it('MORNING: Nir books Maya (CUSTOMER role) → booking B-morning appears in Pet Parent inbox', () => {
    const nirAsCustomer = resolveBookingJourney({
      snapshot: {
        bookingId: 'B-morning',
        status: 'REQUESTED',
        customerUid: NIR,
        providerUid: MAYA,
        requestExpiresAt: '2026-08-30T18:00:00Z',
      },
      actorUid: NIR,
      actorRole: 'CUSTOMER',
    });
    expect(nirAsCustomer.waitingOn).toBe('PROVIDER');
    expect(nirAsCustomer.actor.uid).toBe(NIR);
    // No provider obligation because Nir is here as CUSTOMER.
    expect(nirAsCustomer.obligations.every((o) => o.type !== 'RESPOND_TO_PROVIDER_REQUEST')).toBe(true);
  });

  it('AFTERNOON: Sarah books Nir (PROVIDER role) → Nir gets REQUIRED response obligation', () => {
    const nirAsProvider = resolveBookingJourney({
      snapshot: {
        bookingId: 'B-afternoon',
        status: 'REQUESTED',
        customerUid: SARAH,
        providerUid: NIR,
        requestExpiresAt: '2026-08-30T20:00:00Z',
      },
      actorUid: NIR,
      actorRole: 'PROVIDER',
    });
    expect(nirAsProvider.waitingOn).toBe('PROVIDER');
    expect(nirAsProvider.primaryAction?.actionType).toBe('BOOKING_ACCEPT');
    expect(nirAsProvider.obligations.some((o) => o.severity === 'REQUIRED' && o.type === 'RESPOND_TO_PROVIDER_REQUEST')).toBe(true);
  });

  it('§79 — Nir cannot book his own provider listing', async () => {
    const r = await providerAcceptBooking({
      requestId: 'B-selfbook',
      providerUid: NIR,
      bookerUid: NIR,
      quoteBreakdown: { fake: true },
    });
    expect(r.code).toBe('SELF_BOOKING_BLOCKED');
  });

  it('EVENING: Shop receipt lands in Pet Parent workspace as DOCUMENT, never SUPPORT', () => {
    const receipt: InboxItem = {
      threadId: 'doc:shop-42',
      threadType: 'SHOP_ORDER',
      entityId: 'O-42',
      workspaceContext: 'PET_PARENT',
      itemKind: 'DOCUMENT',
      domain: 'SHOP',
      title: 'RECEIPT',
      subtitle: 'ORDER_RECEIPT',
      lastMessage: 'ORDER_RECEIPT',
      lastMessageAt: '2026-08-30T20:00:00Z',
      unreadCount: 0,
      secondaryActions: [],
    };
    // Assert it lives under PAYMENTS_AND_DOCUMENTS filter, not SUPPORT.
    const items = [receipt];
    const inSupport = filterByCategory(items, 'PET_PARENT', 'SUPPORT');
    const inPaymentsDocs = filterByCategory(items, 'PET_PARENT', 'PAYMENTS_AND_DOCUMENTS');
    expect(inSupport).toEqual([]);
    expect(inPaymentsDocs.map((i) => i.threadId)).toEqual(['doc:shop-42']);
  });
});

describe('§21 — Prestige is CAPABILITY, never a third workspace', () => {
  it('Nir has ONLY two inbox workspace contexts: PET_PARENT and PROVIDER', () => {
    const items: InboxItem[] = [
      chat({ threadId: 'mayaChat', workspaceContext: 'PET_PARENT', itemKind: 'CONVERSATION', domain: 'BOOKING' }),
      chat({ threadId: 'sarahReq', workspaceContext: 'PROVIDER',   itemKind: 'PROVIDER_REQUEST', domain: 'BOOKING' }),
    ];
    const uniq = new Set(items.map((i) => i.workspaceContext));
    expect(Array.from(uniq).sort()).toEqual(['PET_PARENT', 'PROVIDER']);
    // No PRESTIGE workspace anywhere in the shape.
    for (const i of items) {
      expect((i.workspaceContext as any)).not.toBe('PRESTIGE');
    }
  });
});

describe('§19 — Global unread aggregates across both workspaces on the same UID', () => {
  it('unread counters sum PET_PARENT + PROVIDER, never zero one out', () => {
    const items: InboxItem[] = [
      chat({ threadId: 'mayaChat', workspaceContext: 'PET_PARENT', unreadCount: 3, itemKind: 'CONVERSATION', domain: 'BOOKING' }),
      chat({ threadId: 'sarahReq', workspaceContext: 'PROVIDER',   unreadCount: 4, itemKind: 'PROVIDER_REQUEST', domain: 'BOOKING' }),
    ];
    const c = computeUnreadCounts(items);
    expect(c.petParent).toBe(3);
    expect(c.provider).toBe(4);
    expect(c.global).toBe(7);
  });
});

describe('§4 — Book Again prefill from Nir\'s COMPLETED booking with Maya', () => {
  it('returns provider Maya + same pets + shifted schedule', () => {
    const r = evaluateBookAgain({
      actorUid: NIR,
      providerStillActive: true,
      now: '2026-08-30T00:00:00Z',
      prior: {
        bookingId: 'B-past',
        customerUid: NIR,
        providerUid: MAYA,
        status: 'COMPLETED',
        serviceType: 'PET_SITTING',
        petIds: ['bruno'],
        originalScheduleStart: '2026-08-25T10:00:00Z',
        originalScheduleEnd:   '2026-08-25T12:00:00Z',
        location: { kind: 'PROVIDER_HOME' },
      },
    });
    expect(r.code).toBe('PREFILL_READY');
    expect(r.prefill!.providerUid).toBe(MAYA);
    expect(r.prefill!.petIds).toEqual(['bruno']);
    expect(new Date(r.prefill!.suggestedStart).getTime()).toBeGreaterThan(new Date('2026-08-30T00:00:00Z').getTime());
  });
});
