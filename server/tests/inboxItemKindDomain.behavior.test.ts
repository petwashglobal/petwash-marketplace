/**
 * InboxItem itemKind / domain behavior — CEO DEEP-LOGIC §22-§28.
 *
 * ThreadType only applies when the card is a conversation. Attention,
 * documents, provider requests, payment events all need their own
 * classification so filters can be built off itemKind + domain
 * (§23-§27), not off ThreadType.
 */
import { describe, it, expect } from 'vitest';
import {
  filterByCategory,
  type InboxItem,
  type InboxWorkspace,
  type InboxItemKind,
  type InboxDomain,
} from '@shared/marketplace/inboxItem';

function base(over: Partial<InboxItem> = {}): InboxItem {
  return {
    threadId: 't-1',
    threadType: 'BOOKING',
    entityId: 'e-1',
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

describe('CEO §23 — MESSAGES filter picks CONVERSATIONs only', () => {
  it('a booking conversation is included; a booking attention is NOT', () => {
    const items: InboxItem[] = [
      base({ threadId: 'chat', itemKind: 'CONVERSATION', domain: 'BOOKING' }),
      base({ threadId: 'att', itemKind: 'ATTENTION', domain: 'BOOKING' }),
    ];
    const out = filterByCategory(items, 'PET_PARENT', 'MESSAGES');
    expect(out.map((i) => i.threadId)).toEqual(['chat']);
  });

  it('a support conversation is a MESSAGES item too', () => {
    const items: InboxItem[] = [
      base({ threadId: 'sup', itemKind: 'CONVERSATION', domain: 'SUPPORT' }),
      base({ threadId: 'chat', itemKind: 'CONVERSATION', domain: 'BOOKING' }),
      base({ threadId: 'doc', itemKind: 'DOCUMENT', domain: 'BOOKING' }),
    ];
    const out = filterByCategory(items, 'PET_PARENT', 'MESSAGES');
    expect(out.map((i) => i.threadId).sort()).toEqual(['chat', 'sup']);
  });
});

describe('CEO §24 — BOOKINGS filter picks the BOOKING domain regardless of kind', () => {
  it('conversation + attention + document all included when domain is BOOKING', () => {
    const items: InboxItem[] = [
      base({ threadId: 'chat', itemKind: 'CONVERSATION', domain: 'BOOKING' }),
      base({ threadId: 'att',  itemKind: 'ATTENTION',   domain: 'BOOKING' }),
      base({ threadId: 'doc',  itemKind: 'DOCUMENT',    domain: 'BOOKING' }),
      base({ threadId: 'shop', itemKind: 'CONVERSATION', domain: 'SHOP' }),
    ];
    const out = filterByCategory(items, 'PET_PARENT', 'BOOKINGS');
    expect(out.map((i) => i.threadId).sort()).toEqual(['att', 'chat', 'doc']);
  });
});

describe('CEO §25 — REQUESTS filter picks provider requests only', () => {
  it('a PROVIDER_REQUEST is REQUESTS; a booking CONVERSATION for the same provider is not', () => {
    const items: InboxItem[] = [
      base({
        threadId: 'req',
        itemKind: 'PROVIDER_REQUEST' as InboxItemKind,
        domain: 'BOOKING',
        workspaceContext: 'PROVIDER',
      }),
      base({
        threadId: 'chat',
        itemKind: 'CONVERSATION',
        domain: 'BOOKING',
        workspaceContext: 'PROVIDER',
      }),
    ];
    const out = filterByCategory(items, 'PROVIDER', 'REQUESTS');
    expect(out.map((i) => i.threadId)).toEqual(['req']);
  });
});

describe('CEO §26 — ACTIVE_JOBS excludes PROVIDER_REQUEST', () => {
  it('BOOKING conversation counts; PROVIDER_REQUEST does not', () => {
    const items: InboxItem[] = [
      base({
        threadId: 'chat',
        itemKind: 'CONVERSATION',
        domain: 'BOOKING',
        workspaceContext: 'PROVIDER',
      }),
      base({
        threadId: 'req',
        itemKind: 'PROVIDER_REQUEST',
        domain: 'BOOKING',
        workspaceContext: 'PROVIDER',
      }),
    ];
    const out = filterByCategory(items, 'PROVIDER', 'ACTIVE_JOBS');
    expect(out.map((i) => i.threadId)).toEqual(['chat']);
  });
});

describe('CEO §27 — PAYMENTS_AND_DOCUMENTS is by kind, not domain', () => {
  it('DOCUMENT and PAYMENT_EVENT are included; a chat CONVERSATION is not', () => {
    const items: InboxItem[] = [
      base({ threadId: 'doc', itemKind: 'DOCUMENT',      domain: 'BOOKING' }),
      base({ threadId: 'pay', itemKind: 'PAYMENT_EVENT', domain: 'WALLET' }),
      base({ threadId: 'chat', itemKind: 'CONVERSATION', domain: 'BOOKING' }),
    ];
    const out = filterByCategory(items, 'PET_PARENT', 'PAYMENTS_AND_DOCUMENTS');
    expect(out.map((i) => i.threadId).sort()).toEqual(['doc', 'pay']);
  });
});

describe('legacy fallback — items without itemKind still route via ThreadType', () => {
  it('an old-style item (no itemKind, no domain) filters by threadType', () => {
    const items: InboxItem[] = [
      base({ threadId: 'legacy-booking', threadType: 'BOOKING' }),   // no kind/domain
      base({ threadId: 'legacy-shop',    threadType: 'SHOP_ORDER' }),
    ];
    const out = filterByCategory(items, 'PET_PARENT', 'BOOKINGS');
    expect(out.map((i) => i.threadId)).toEqual(['legacy-booking']);
  });
});
