/**
 * NotificationInboxSpec — CEO P0-CEP task #176 (Batch §12).
 *
 * The inbox row is AUTHORITATIVE — a failed push does not mean the
 * message never happened. Every OS/email/SMS delivery also lands
 * here and stays reachable through user-driven state changes.
 */
import { describe, it, expect } from 'vitest';
import {
  INBOX_ITEM_PURPOSES,
  isInboxItemPurpose,
  allocateInboxItem,
  transitionInboxItem,
  type InboxItem,
} from '@shared/marketplace/notificationInboxSpec';

const NOW = new Date('2026-08-31T12:00:00Z');
const LATER = new Date('2026-08-31T13:00:00Z');

describe('NotificationInboxSpec — enumeration', () => {
  it('purposes are unique SCREAMING_SNAKE_CASE identifiers', () => {
    const seen = new Set<string>();
    for (const p of INBOX_ITEM_PURPOSES) {
      expect(seen.has(p)).toBe(false);
      seen.add(p);
      expect(/^[A-Z][A-Z0-9_]+$/.test(p)).toBe(true);
    }
  });
  it('MARKETING is a first-class distinct purpose (Batch §13 separation)', () => {
    expect((INBOX_ITEM_PURPOSES as readonly string[]).includes('MARKETING')).toBe(true);
    expect((INBOX_ITEM_PURPOSES as readonly string[]).includes('BOOKING_UPDATE')).toBe(true);
  });
  it('isInboxItemPurpose rejects unregistered strings', () => {
    expect(isInboxItemPurpose('booking_update')).toBe(false);
    expect(isInboxItemPurpose('OTHER')).toBe(false);
    expect(isInboxItemPurpose(undefined)).toBe(false);
  });
});

describe('allocateInboxItem', () => {
  it('OK — new row is UNREAD with itemId = idempotencyKey and createdAt = now', () => {
    const v = allocateInboxItem({
      ownerUid: 'uid-1',
      idempotencyKey: 'booking.confirmed|uid-1|booking:BK-9',
      purpose: 'BOOKING_UPDATE',
      titleSlug: 'inbox.title.booking_confirmed',
      now: NOW,
      deepLink: { code: 'BOOKING_DETAIL', args: { id: 'BK-9' } },
      outOfBandAttempts: { push: 'failed', email: 'sent' },
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.item.itemId).toBe('booking.confirmed|uid-1|booking:BK-9');
    expect(v.item.state).toBe('UNREAD');
    expect(v.item.createdAt).toEqual(NOW);
    expect(v.item.outOfBandAttempts.push).toBe('failed');
    expect(v.item.outOfBandAttempts.email).toBe('sent');
  });

  it('REJECTED variants — NO_OWNER / EMPTY_IDEMPOTENCY_KEY / UNKNOWN_PURPOSE / EMPTY_TITLE', () => {
    const base = {
      ownerUid: 'uid-1',
      idempotencyKey: 'k',
      purpose: 'BOOKING_UPDATE' as const,
      titleSlug: 't',
      now: NOW,
    };
    const cases: Array<[Partial<typeof base>, string]> = [
      [{ ownerUid: '   ' }, 'NO_OWNER'],
      [{ idempotencyKey: '' }, 'EMPTY_IDEMPOTENCY_KEY'],
      [{ purpose: 'bogus' as never }, 'UNKNOWN_PURPOSE'],
      [{ titleSlug: '   ' }, 'EMPTY_TITLE'],
    ];
    for (const [over, expected] of cases) {
      const v = allocateInboxItem({ ...base, ...over });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe(expected);
    }
  });

  it('outOfBandAttempts defaults to {} when omitted', () => {
    const v = allocateInboxItem({
      ownerUid: 'u', idempotencyKey: 'k', purpose: 'ANNOUNCEMENT',
      titleSlug: 't', now: NOW,
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.item.outOfBandAttempts).toEqual({});
  });
});

describe('transitionInboxItem', () => {
  function baseItem(over: Partial<InboxItem> = {}): InboxItem {
    return {
      itemId: 'i',
      ownerUid: 'u',
      purpose: 'BOOKING_UPDATE',
      titleSlug: 't',
      createdAt: NOW,
      state: 'UNREAD',
      outOfBandAttempts: {},
      ...over,
    };
  }

  it('UNREAD → READ on MARK_READ, stamps readAt', () => {
    const v = transitionInboxItem({ item: baseItem(), transition: 'MARK_READ', now: LATER });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('READ');
    expect(v.next.readAt).toEqual(LATER);
  });

  it('MARK_READ refuses when already READ / ARCHIVED', () => {
    for (const state of ['READ', 'ARCHIVED'] as const) {
      const v = transitionInboxItem({ item: baseItem({ state }), transition: 'MARK_READ', now: LATER });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('ILLEGAL_STATE_FOR_TRANSITION');
    }
  });

  it('READ → UNREAD on MARK_UNREAD, clears readAt', () => {
    const v = transitionInboxItem({
      item: baseItem({ state: 'READ', readAt: NOW }),
      transition: 'MARK_UNREAD',
      now: LATER,
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('UNREAD');
    expect(v.next.readAt).toBeUndefined();
  });

  it('ARCHIVE stamps archivedAt from UNREAD or READ', () => {
    for (const state of ['UNREAD', 'READ'] as const) {
      const v = transitionInboxItem({ item: baseItem({ state }), transition: 'ARCHIVE', now: LATER });
      expect(v.code).toBe('OK');
      if (v.code !== 'OK') throw new Error();
      expect(v.next.state).toBe('ARCHIVED');
      expect(v.next.archivedAt).toEqual(LATER);
    }
  });

  it('RESTORE lands in READ (not UNREAD) and preserves original readAt when present', () => {
    const originalRead = new Date('2026-08-30T12:00:00Z');
    const v = transitionInboxItem({
      item: baseItem({ state: 'ARCHIVED', archivedAt: LATER, readAt: originalRead }),
      transition: 'RESTORE',
      now: LATER,
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('READ');
    expect(v.next.readAt).toEqual(originalRead);
    expect(v.next.archivedAt).toBeUndefined();
  });

  it('DISMISS is legal from any live state; DISMISSED is terminal', () => {
    for (const state of ['UNREAD', 'READ', 'ARCHIVED'] as const) {
      const v = transitionInboxItem({ item: baseItem({ state }), transition: 'DISMISS', now: LATER });
      expect(v.code).toBe('OK');
      if (v.code !== 'OK') throw new Error();
      expect(v.next.state).toBe('DISMISSED');
      expect(v.next.dismissedAt).toEqual(LATER);
    }
    // From DISMISSED, every further transition refuses.
    for (const t of ['MARK_READ', 'MARK_UNREAD', 'ARCHIVE', 'RESTORE', 'DISMISS'] as const) {
      const v = transitionInboxItem({
        item: baseItem({ state: 'DISMISSED', dismissedAt: NOW }),
        transition: t,
        now: LATER,
      });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('ITEM_DISMISSED');
    }
  });
});
