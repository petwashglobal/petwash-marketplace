/**
 * InboxItem — behavior pins (business §10.4, §22–§26, §37, §81, §92).
 */
import { describe, it, expect } from 'vitest';
import {
  categoryForPetParent,
  categoryForProvider,
  computeUnreadCounts,
  filterByCategory,
  threadsAreIsolated,
  type InboxItem,
} from '../../shared/marketplace/inboxItem';

function item(over: Partial<InboxItem> = {}): InboxItem {
  return {
    threadId: 't1',
    threadType: 'BOOKING',
    entityId: 'e1',
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

describe('category mapping (§10.4 filters)', () => {
  it('Pet Parent: BOOKING + MEET_AND_GREET → BOOKINGS', () => {
    expect(categoryForPetParent('BOOKING')).toBe('BOOKINGS');
    expect(categoryForPetParent('MEET_AND_GREET')).toBe('BOOKINGS');
  });

  it('Pet Parent: SHOP_ORDER + GIFT → ORDERS', () => {
    expect(categoryForPetParent('SHOP_ORDER')).toBe('ORDERS');
    expect(categoryForPetParent('GIFT')).toBe('ORDERS');
  });

  it('Provider: BOOKING + MEET_AND_GREET → ACTIVE_JOBS', () => {
    expect(categoryForProvider('BOOKING')).toBe('ACTIVE_JOBS');
    expect(categoryForProvider('MEET_AND_GREET')).toBe('ACTIVE_JOBS');
  });

  it('Provider: PROVIDER_APPLICATION → COMPLIANCE', () => {
    expect(categoryForProvider('PROVIDER_APPLICATION')).toBe('COMPLIANCE');
  });

  it('SUPPORT → SUPPORT in both workspaces', () => {
    expect(categoryForPetParent('SUPPORT')).toBe('SUPPORT');
    expect(categoryForProvider('SUPPORT')).toBe('SUPPORT');
  });
});

describe('filterByCategory scopes by workspace first, then category', () => {
  const items: InboxItem[] = [
    item({ threadId: 't-cust-b', threadType: 'BOOKING', workspaceContext: 'PET_PARENT' }),
    item({ threadId: 't-cust-s', threadType: 'SHOP_ORDER', workspaceContext: 'PET_PARENT' }),
    item({ threadId: 't-prov-b', threadType: 'BOOKING', workspaceContext: 'PROVIDER' }),
    item({ threadId: 't-prov-c', threadType: 'PROVIDER_APPLICATION', workspaceContext: 'PROVIDER' }),
  ];

  it('Pet Parent ALL returns only Pet Parent items', () => {
    const out = filterByCategory(items, 'PET_PARENT', 'ALL');
    expect(out.map((i) => i.threadId).sort()).toEqual(['t-cust-b', 't-cust-s']);
  });

  it('Pet Parent BOOKINGS returns only BOOKING/M&G threads', () => {
    const out = filterByCategory(items, 'PET_PARENT', 'BOOKINGS');
    expect(out.map((i) => i.threadId)).toEqual(['t-cust-b']);
  });

  it('Provider ACTIVE_JOBS returns provider-side booking threads only', () => {
    const out = filterByCategory(items, 'PROVIDER', 'ACTIVE_JOBS');
    expect(out.map((i) => i.threadId)).toEqual(['t-prov-b']);
  });

  it('Provider COMPLIANCE isolates the application thread', () => {
    const out = filterByCategory(items, 'PROVIDER', 'COMPLIANCE');
    expect(out.map((i) => i.threadId)).toEqual(['t-prov-c']);
  });
});

describe('unread counts are per-workspace (§37)', () => {
  it('same UID as Pet Parent and Provider gets DISTINCT counters', () => {
    const items: InboxItem[] = [
      item({ workspaceContext: 'PET_PARENT', unreadCount: 3 }),
      item({ workspaceContext: 'PET_PARENT', unreadCount: 1 }),
      item({ workspaceContext: 'PROVIDER', unreadCount: 5 }),
    ];
    const counts = computeUnreadCounts(items);
    expect(counts).toEqual({ global: 9, petParent: 4, provider: 5 });
  });

  it('empty list → zeros', () => {
    expect(computeUnreadCounts([])).toEqual({ global: 0, petParent: 0, provider: 0 });
  });
});

describe('thread isolation (§81)', () => {
  it('two bookings between the same pair render as two separate threads', () => {
    const items: InboxItem[] = [
      item({ threadId: 't-1', threadType: 'BOOKING' }),
      item({ threadId: 't-2', threadType: 'BOOKING' }),
    ];
    expect(threadsAreIsolated(items)).toBe(true);
  });

  it('duplicate threadId → violation caught', () => {
    const items: InboxItem[] = [
      item({ threadId: 't-1' }),
      item({ threadId: 't-1' }),
    ];
    expect(threadsAreIsolated(items)).toBe(false);
  });
});
