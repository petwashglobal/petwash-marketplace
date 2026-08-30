/**
 * BookingConversationInboxAdapter — regression pin (source-anchored).
 *
 * CEO NEXT-AUTO §14 + Doctrine §22, §23, §37, §81, §92 + §10.2.
 *
 * The adapter is a READ-MODEL over the existing booking_conversations
 * table. It must never:
 *   • Create a new storage universe (no CREATE TABLE).
 *   • Merge two bookings between the same customer/provider (§81).
 *   • Cross workspaces on the unread counter (§37).
 *   • Leak counterparty email / phone (§10.2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'BookingConversationInboxAdapter.ts'),
  'utf8',
);

describe('CEO §92 — read-model, not a new storage universe', () => {
  it('reads from booking_conversations (never creates a table)', () => {
    expect(SRC).toMatch(/\.from\(bookingConversations\)/);
    expect(SRC).not.toMatch(/CREATE TABLE/i);
  });

  it('resolves counterparty display names through the users table by id, never by email', () => {
    expect(SRC).toMatch(/from\(users\)/);
    expect(SRC).toMatch(/eq\(users\.id, uid\)/);
    // The batched name lookup MUST NOT pull an email or phone column.
    const selectIdx = SRC.indexOf('.select({ id: users.id,');
    expect(selectIdx).toBeGreaterThan(0);
    const end = SRC.indexOf('})', selectIdx);
    const projection = SRC.slice(selectIdx, end);
    expect(projection).not.toMatch(/email|phone/i);
  });
});

describe('CEO §37 — per-workspace unread counters', () => {
  it('Pet Parent workspace reads customer_unread; Provider reads provider_unread', () => {
    expect(SRC).toMatch(
      /unreadCount:\s*isPP\s*\?\s*r\.customerUnread\s*:\s*r\.providerUnread/,
    );
  });

  it('workspace-scoping goes through the WHERE clause — never a client-side filter', () => {
    // The queries in listBookingConversationInboxItems() split on workspace
    // before the query, so a Pet Parent listing can never receive rows
    // where the uid is only the provider (or vice versa).
    expect(SRC).toMatch(
      /workspace === 'PET_PARENT'[\s\S]{0,200}eq\(bookingConversations\.customerId, uid\)[\s\S]{0,200}eq\(bookingConversations\.providerId, uid\)/,
    );
  });
});

describe('CEO §81 — two bookings between same parties = TWO threads', () => {
  it('threadId is the conversationId (unique per booking), NOT (customer, provider)', () => {
    expect(SRC).toMatch(/threadId:\s*r\.conversationId/);
    expect(SRC).toMatch(/entityId:\s*r\.bookingId/);
  });
});

describe('CEO §10.2, §80 — masked identity + fallback labels', () => {
  it('otherParticipant.displayName is derived, never a raw email or phone', () => {
    // The display helper falls back to "Provider" / "Pet parent" labels
    // when the users row is missing — never renders the raw uid or an
    // email.
    expect(SRC).toMatch(/displayNameFor\(otherRow, otherFallback\)/);
    expect(SRC).toMatch(/const otherFallback = isPP \? 'Provider' : 'Pet parent'/);
  });

  it('display helper trims name and shows only last-name INITIAL', () => {
    expect(SRC).toMatch(/const lastInitial = /);
    expect(SRC).toMatch(/`\$\{first\} \$\{lastInitial\}\.`/);
  });
});

describe('CEO §92 — chat status is surfaced, not hidden', () => {
  it('closed / archived threads still appear; status is surfaced via statusBadge', () => {
    // A "read_only" or "archived" conversation is history — the inbox
    // must still show it (a doctrine's Inbox is a history, not a live-
    // threads-only filter). Status is exposed to the UI through the
    // statusBadge field.
    expect(SRC).toMatch(/statusBadge:\s*statusBadgeFor\(r\.chatStatus, r\.closedReason\)/);
    // The where-clause never filters on chat_status.
    const whereIdx = SRC.indexOf('const whereClause = workspace');
    const whereEnd = SRC.indexOf(';', whereIdx);
    expect(SRC.slice(whereIdx, whereEnd)).not.toMatch(/chatStatus/);
  });
});

describe('adapter matches the HubSource contract', () => {
  it('exports listBookingConversationInboxItems with (uid, workspace) signature', () => {
    expect(SRC).toMatch(
      /export async function listBookingConversationInboxItems\(\s*uid: string,\s*workspace: InboxWorkspace,\s*\): Promise<InboxItem\[\]>/,
    );
  });
});
