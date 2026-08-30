/**
 * ChatThreadInboxAdapter — regression pin (source-anchored).
 *
 * CEO NEXT-AUTO §15 + Doctrine §22, §23, §37, §81, §92 + §10.2.
 *
 * The chat_threads spine covers everything that is NOT a legacy booking
 * chat: support, incident, K9000, PAW_FINDER, shop_order, gift,
 * provider_application, franchise, admin. This adapter projects those
 * rows into the unified InboxItem shape without cross-workspace bleed
 * and without leaking counterparty contact info.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'ChatThreadInboxAdapter.ts'),
  'utf8',
);

describe('CEO §92 — read-model over chat_threads (no new universe)', () => {
  it('reads from chatThreads spine, never creates a table', () => {
    expect(SRC).toMatch(/\.from\(chatThreads\)/);
    expect(SRC).not.toMatch(/CREATE TABLE/i);
  });

  it('counterparty users projection is id + firstName + lastName ONLY', () => {
    const idx = SRC.indexOf('.select({ id: users.id,');
    expect(idx).toBeGreaterThan(0);
    const end = SRC.indexOf('})', idx);
    const projection = SRC.slice(idx, end);
    expect(projection).not.toMatch(/email|phone/i);
  });
});

describe('CEO §37 — per-workspace unread + WHERE split (no cross-role leak)', () => {
  it('Pet Parent WHERE = customerUserId; Provider WHERE = providerUserId', () => {
    expect(SRC).toMatch(
      /workspace === 'PET_PARENT'[\s\S]{0,120}eq\(chatThreads\.customerUserId, uid\)[\s\S]{0,120}eq\(chatThreads\.providerUserId, uid\)/,
    );
  });

  it('unreadCount is per-workspace', () => {
    expect(SRC).toMatch(
      /unreadCount:\s*isPP\s*\?\s*r\.unreadCustomerCount\s*:\s*r\.unreadProviderCount/,
    );
  });
});

describe('CEO §81 — threadId + entityId isolation', () => {
  it('threadId is the row threadId (unique) — never a participant heuristic', () => {
    expect(SRC).toMatch(/threadId:\s*r\.threadId/);
  });

  it('entityId falls back through booking → order → gift → case → application → station → threadId', () => {
    expect(SRC).toMatch(
      /return r\.bookingId[\s\S]{0,120}\?\?\s*r\.orderId[\s\S]{0,120}\?\?\s*r\.giftId[\s\S]{0,120}\?\?\s*r\.caseId[\s\S]{0,120}\?\?\s*r\.applicationId[\s\S]{0,120}\?\?\s*r\.stationId[\s\S]{0,120}\?\?\s*r\.threadId/,
    );
  });
});

describe('thread_type mapping is closed — no unknown strings leak to UI', () => {
  it('INCIDENT collapses to SUPPORT; FRANCHISE collapses to ADMIN', () => {
    expect(SRC).toMatch(/case 'INCIDENT':[\s\S]{0,40}return 'SUPPORT'/);
    expect(SRC).toMatch(/case 'FRANCHISE':[\s\S]{0,40}return 'ADMIN'/);
  });

  it('unknown thread_type falls back to SUPPORT, never leaks raw string', () => {
    expect(SRC).toMatch(/default:[\s\S]{0,40}return 'SUPPORT'/);
  });
});

describe('CEO §10.2 — masked identity, never raw contact', () => {
  it('fallback labels + last-initial display, never raw uid or email', () => {
    expect(SRC).toMatch(/const otherFallback = isPP \? 'Provider' : 'Pet parent'/);
    expect(SRC).toMatch(/`\$\{first\} \$\{lastInitial\}\.`/);
  });
});

describe('adapter matches the HubSource contract', () => {
  it('exports listChatThreadInboxItems with (uid, workspace) signature', () => {
    expect(SRC).toMatch(
      /export async function listChatThreadInboxItems\(\s*uid: string,\s*workspace: InboxWorkspace,\s*\): Promise<InboxItem\[\]>/,
    );
  });
});
