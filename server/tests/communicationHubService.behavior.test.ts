/**
 * CommunicationHubService — behavior pins (business §22, §23, §89, §92,
 * plus DEEP-LOGIC §7 locale + §8/§9 sourceHealth).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createStubHubSource,
  listForUser,
  type HubSource,
} from '../services/marketplace/CommunicationHubService';
import type { InboxItem } from '../../shared/marketplace/inboxItem';

function item(over: Partial<InboxItem> = {}): InboxItem {
  // Default `entityId` matches threadId so unrelated fixtures do not
  // dedupe under the new canonical (threadType, entityId) key.
  const tid = over.threadId ?? 't1';
  return {
    threadId: tid,
    threadType: 'BOOKING',
    entityId: `entity_${tid}`,
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

describe('stub source', () => {
  it('returns empty list + zero counts + all-healthy sourceHealth', async () => {
    const res = await listForUser('nir', createStubHubSource(), { workspace: 'PET_PARENT' });
    expect(res.items).toEqual([]);
    expect(res.unread).toEqual({ global: 0, petParent: 0, provider: 0 });
    expect(res.sourceHealth).toEqual({ bookingChat: 'ok', threadChat: 'ok', attention: 'ok' });
    expect(res.partial).toBe(false);
  });
});

describe('merging + dedup (§92 read-model)', () => {
  it('merges booking-conversations + chat_threads + attention into one Inbox', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return { items: [item({ threadId: 'bc-1', lastMessageAt: '2026-08-30T10:00:00Z' })] };
      },
      async listChatThreadInboxItems() {
        return { items: [item({ threadId: 'ct-1', lastMessageAt: '2026-08-30T11:00:00Z' })] };
      },
      async listAttentionInboxItems() {
        return { items: [item({ threadId: 'at-1', lastMessageAt: '2026-08-30T09:00:00Z' })] };
      },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(res.items.map((i) => i.threadId)).toEqual(['ct-1', 'bc-1', 'at-1']);
  });

  it('dedupes by canonical (threadType, entityId) — same booking from two lanes projected ONCE', async () => {
    // §10 — bookingConversations and chat_threads carry different
    // threadIds for the same booking; the canonical key collapses them.
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return { items: [item({ threadId: 'BC-abc', threadType: 'BOOKING', entityId: 'booking_42', lastMessage: 'from booking chat' })] };
      },
      async listChatThreadInboxItems() {
        return { items: [item({ threadId: 'uuid-xyz', threadType: 'BOOKING', entityId: 'booking_42', lastMessage: 'from chat_threads' })] };
      },
      async listAttentionInboxItems() {
        return { items: [] };
      },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(res.items).toHaveLength(1);
  });

  it('§11 — attention item and chat card for the SAME booking BOTH appear', async () => {
    // Attention items must not dedupe with a chat card even when
    // entityId matches — they are structurally different products.
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return { items: [item({ threadId: 'BC-abc', threadType: 'BOOKING', entityId: 'booking_42' })] };
      },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() {
        return { items: [item({ threadId: 'attention:xyz', threadType: 'BOOKING', entityId: 'booking_42' })] };
      },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(res.items).toHaveLength(2);
  });

  it('SUPPORT case that references the same bookingId does NOT merge into BOOKING', async () => {
    // Canonical key is (threadType, entityId), not entityId alone.
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return { items: [item({ threadId: 'BC-a', threadType: 'BOOKING', entityId: 'booking_42' })] };
      },
      async listChatThreadInboxItems() {
        return { items: [item({ threadId: 'uuid-b', threadType: 'SUPPORT', entityId: 'booking_42' })] };
      },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(res.items).toHaveLength(2);
  });
});

describe('newest-first sorting', () => {
  it('sorts by lastMessageAt descending', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() { return { items: [] }; },
      async listChatThreadInboxItems() {
        return {
          items: [
            item({ threadId: 't-old', lastMessageAt: '2026-08-30T01:00:00Z' }),
            item({ threadId: 't-new', lastMessageAt: '2026-08-30T15:00:00Z' }),
            item({ threadId: 't-mid', lastMessageAt: '2026-08-30T08:00:00Z' }),
          ],
        };
      },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(res.items.map((i) => i.threadId)).toEqual(['t-new', 't-mid', 't-old']);
  });
});

describe('workspace + category filter (§37, §10.4)', () => {
  const items = [
    item({ threadId: 'cust-book', workspaceContext: 'PET_PARENT', threadType: 'BOOKING' }),
    item({ threadId: 'cust-shop', workspaceContext: 'PET_PARENT', threadType: 'SHOP_ORDER' }),
    item({ threadId: 'prov-book', workspaceContext: 'PROVIDER', threadType: 'BOOKING' }),
  ];

  it('Pet Parent + BOOKINGS returns only Pet Parent BOOKING/M&G threads', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() { return { items }; },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT', category: 'BOOKINGS' });
    expect(res.items.map((i) => i.threadId)).toEqual(['cust-book']);
  });

  it('Provider + ACTIVE_JOBS returns only Provider BOOKING/M&G threads', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() { return { items }; },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PROVIDER', category: 'ACTIVE_JOBS' });
    expect(res.items.map((i) => i.threadId)).toEqual(['prov-book']);
  });
});

describe('unread counts (§37) — computed against FULL set, not filtered slice', () => {
  it('filtered list still exposes global + per-workspace counts across all items', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return {
          items: [
            item({ threadId: 'a', workspaceContext: 'PET_PARENT', unreadCount: 2 }),
            item({ threadId: 'b', workspaceContext: 'PROVIDER', unreadCount: 3 }),
          ],
        };
      },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT', category: 'ALL' });
    expect(res.items.map((i) => i.threadId)).toEqual(['a']);
    expect(res.unread).toEqual({ global: 5, petParent: 2, provider: 3 });
  });
});

describe('limit + since (incremental refresh)', () => {
  it('respects limit', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return {
          items: Array.from({ length: 100 }, (_, k) =>
            item({ threadId: `t-${k}`, lastMessageAt: `2026-08-30T${String(k).padStart(2, '0')}:00:00Z` }),
          ),
        };
      },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT', limit: 10 });
    expect(res.items).toHaveLength(10);
  });

  it('since drops older-than-cutoff items before category filtering', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() {
        return {
          items: [
            item({ threadId: 't-old', lastMessageAt: '2026-08-29T00:00:00Z' }),
            item({ threadId: 't-new', lastMessageAt: '2026-08-30T00:00:00Z' }),
          ],
        };
      },
      async listChatThreadInboxItems() { return { items: [] }; },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, {
      workspace: 'PET_PARENT',
      since: '2026-08-29T12:00:00Z',
    });
    expect(res.items.map((i) => i.threadId)).toEqual(['t-new']);
  });
});

describe('parallel source fetches', () => {
  it('calls all three sources concurrently (Promise.all)', async () => {
    const b = vi.fn(async () => ({ items: [] as InboxItem[] }));
    const c = vi.fn(async () => ({ items: [] as InboxItem[] }));
    const a = vi.fn(async () => ({ items: [] as InboxItem[] }));
    const source: HubSource = {
      listBookingConversationInboxItems: b,
      listChatThreadInboxItems: c,
      listAttentionInboxItems: a,
    };
    await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
  });
});

describe('CEO DEEP-LOGIC §7 — locale forwarded to every source', () => {
  it('default locale is he; explicit en overrides', async () => {
    const seen: Array<'he' | 'en'> = [];
    const source: HubSource = {
      async listBookingConversationInboxItems(_uid, _ws, opts) { seen.push(opts.locale); return { items: [] }; },
      async listChatThreadInboxItems(_uid, _ws, opts) { seen.push(opts.locale); return { items: [] }; },
      async listAttentionInboxItems(_uid, _ws, opts) { seen.push(opts.locale); return { items: [] }; },
    };
    await listForUser('nir', source, { workspace: 'PET_PARENT' });
    expect(seen).toEqual(['he', 'he', 'he']);
    seen.length = 0;
    await listForUser('nir', source, { workspace: 'PET_PARENT', locale: 'en' });
    expect(seen).toEqual(['en', 'en', 'en']);
  });
});

describe('CEO DEEP-LOGIC §8/§9 — degraded lane surfaces, never hides as empty', () => {
  it('a degraded lane sets sourceHealth.<lane>=degraded and partial=true', async () => {
    const source: HubSource = {
      async listBookingConversationInboxItems() { return { items: [], degraded: true }; },
      async listChatThreadInboxItems() {
        return { items: [item({ threadId: 't-1', unreadCount: 1 })] };
      },
      async listAttentionInboxItems() { return { items: [] }; },
    };
    const res = await listForUser('nir', source, { workspace: 'PET_PARENT' });
    // Threading lane still delivered content — the client should NOT
    // see "No messages" just because booking-chat was down.
    expect(res.items.map((i) => i.threadId)).toEqual(['t-1']);
    expect(res.sourceHealth).toEqual({
      bookingChat: 'degraded',
      threadChat: 'ok',
      attention: 'ok',
    });
    expect(res.partial).toBe(true);
  });

  it('all lanes healthy → partial=false', async () => {
    const res = await listForUser('nir', createStubHubSource(), { workspace: 'PET_PARENT' });
    expect(res.partial).toBe(false);
  });
});
