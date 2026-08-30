/**
 * thread-chat send — atomicity + participant-role unread routing.
 *
 * CEO DEEP-LOGIC §23 (atomic write), §24-§25 (support/admin unread).
 *
 * The prior send flow ran two independent writes (INSERT message,
 * then UPDATE thread head + counters). A failure between them left
 * a ghost message with a stale thread head and un-incremented
 * unread. §23 requires those writes to commit or roll back together.
 *
 * The prior unread bump also only knew about customer / provider —
 * chatThreads has THREE counters (customer / provider / admin) and a
 * support-owned thread must route the increment through
 * unreadAdminCount when the recipient is the support owner. Reading a
 * thread as the support owner must clear that admin counter, not the
 * customer or provider one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'thread-chat.ts'),
  'utf8',
);

describe('CEO DEEP-LOGIC §23 — atomic message + thread head + unread', () => {
  it('the send flow runs inside db.transaction(...)', () => {
    // A single tx wraps INSERT chatThreadMessages + UPDATE chatThreads
    // so a mid-flight failure never persists a message with a stale
    // thread head.
    expect(SRC).toMatch(/const inserted = await db\.transaction\(async \(tx\) => \{/);
    // Message insert goes through tx, not db.
    expect(SRC).toMatch(/tx\s*\.insert\(chatThreadMessages\)/);
    // Thread head update goes through tx.
    expect(SRC).toMatch(/tx\.update\(chatThreads\)\.set\(\{/);
  });

  it('the old two-write flow (bare db.insert followed by bare db.update) is gone', () => {
    // No un-txn send-path insert / update against these tables.
    const sendSection = SRC.slice(SRC.indexOf("router.post('/:threadId/send'"), SRC.indexOf("router.put('/:threadId/read'"));
    // Any remaining insert(chatThreadMessages) in the send path must go
    // through tx (the tx variable name is what we match).
    expect(sendSection).not.toMatch(/await db\s*\.insert\(chatThreadMessages\)/);
    expect(sendSection).not.toMatch(/await db\.update\(chatThreads\)\.set\(\{[\s\S]{0,300}lastMessageAt/);
  });
});

describe('CEO DEEP-LOGIC §24 — send routes the unread bump by participant role', () => {
  it('bumps customer counter when the OTHER side is the customer participant', () => {
    expect(SRC).toMatch(/const bumpCustomer = !!\(t\.customerUserId && !isSenderCustomer\)/);
  });

  it('bumps provider counter when the OTHER side is the provider participant', () => {
    expect(SRC).toMatch(/const bumpProvider = !!\(t\.providerUserId && !isSenderProvider\)/);
  });

  it('bumps admin counter when the thread has a support owner and sender is NOT that owner', () => {
    // §24 — support-side unread was previously never incremented.
    expect(SRC).toMatch(/const bumpAdmin = !!\(t\.supportOwnerId && !isSenderSupport\)/);
    // The UPDATE conditionally increments unreadAdminCount.
    expect(SRC).toMatch(
      /unreadAdminCount:\s*bumpAdmin\s*\?\s*dsql`\$\{chatThreads\.unreadAdminCount\} \+ 1`\s*:\s*chatThreads\.unreadAdminCount/,
    );
  });

  it('sender identity is derived from server-side thread participants only', () => {
    // §24 — role of sender must NOT be inferred from a workspace guess.
    expect(SRC).toMatch(/const isSenderCustomer = t\.customerUserId === uid/);
    expect(SRC).toMatch(/const isSenderProvider = t\.providerUserId === uid/);
    expect(SRC).toMatch(/const isSenderSupport = t\.supportOwnerId === uid/);
  });
});

describe('CEO DEEP-LOGIC §25 — read receipt clears the caller\'s ACTUAL side', () => {
  it('customer / provider read resets their own counter', () => {
    expect(SRC).toMatch(/if \(t\.customerUserId === uid\) patch\.unreadCustomerCount = 0/);
    expect(SRC).toMatch(/if \(t\.providerUserId === uid\) patch\.unreadProviderCount = 0/);
  });

  it('support owner read resets unreadAdminCount — never a customer / provider counter', () => {
    // §25 — the prior read handler had no case for supportOwnerId,
    // so a support badge stayed sticky.
    expect(SRC).toMatch(/if \(t\.supportOwnerId === uid\) patch\.unreadAdminCount = 0/);
  });
});
