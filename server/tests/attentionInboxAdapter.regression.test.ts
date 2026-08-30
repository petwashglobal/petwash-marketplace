/**
 * AttentionInboxAdapter — regression pin (source-anchored).
 *
 * CEO NEXT-AUTO §16 + Doctrine §22, §37, §85, §92 + §10.2.
 *
 * The adapter projects composeAttentionFeed() output (AttentionItem
 * from shared/lib/attentionFeed.ts) into InboxItem shape. It must
 * never spin up a new engine, must never merge across workspaces, and
 * must translate every domain to a closed inbox ThreadType vocabulary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'AttentionInboxAdapter.ts'),
  'utf8',
);

describe('CEO §92 — composition, not a new engine', () => {
  it('reuses composeAttentionFeed from the existing attention service', () => {
    expect(SRC).toMatch(/import \{ composeAttentionFeed \} from '\.\.\/attentionFeed'/);
    expect(SRC).toMatch(/const feed = await composeAttentionFeed\(actor, uid,/);
    expect(SRC).not.toMatch(/CREATE TABLE/i);
  });
});

describe('CEO §37 — actor derived from workspace, never merged', () => {
  it("PET_PARENT → 'pet_parent'; PROVIDER → 'provider'", () => {
    expect(SRC).toMatch(
      /const actor = workspace === 'PET_PARENT' \? 'pet_parent' : 'provider'/,
    );
  });
});

describe('threadType mapping is closed — no unknown strings leak', () => {
  it('booking-family domains map to BOOKING', () => {
    expect(SRC).toMatch(
      /case 'booking':[\s\S]{0,120}case 'walk':[\s\S]{0,80}case 'sitting':[\s\S]{0,80}case 'academy':[\s\S]{0,40}return 'BOOKING'/,
    );
  });

  it("'shop' → SHOP_ORDER, 'egift' → GIFT, 'paw_finder' → PAW_FINDER", () => {
    expect(SRC).toMatch(/case 'shop':[\s\S]{0,40}return 'SHOP_ORDER'/);
    expect(SRC).toMatch(/case 'egift':[\s\S]{0,40}return 'GIFT'/);
    expect(SRC).toMatch(/case 'paw_finder':[\s\S]{0,40}return 'PAW_FINDER'/);
  });

  it("'kyc' → PROVIDER_APPLICATION (compliance tab)", () => {
    expect(SRC).toMatch(/case 'kyc':[\s\S]{0,40}return 'PROVIDER_APPLICATION'/);
  });

  it('unknown domain falls back to SUPPORT, never leaks raw string', () => {
    expect(SRC).toMatch(/default:[\s\S]{0,40}return 'SUPPORT'/);
  });
});

describe('CEO §10.2 — no counterparty on Attention items', () => {
  it('otherParticipant is not populated (attention items are platform-generated)', () => {
    const idx = SRC.indexOf('feed.items.map<InboxItem>');
    const end = SRC.indexOf('}));', idx);
    const mapper = SRC.slice(idx, end);
    expect(mapper).not.toMatch(/otherParticipant/);
    // The adapter must not fetch from users either — attention items
    // are self-describing.
    expect(SRC).not.toMatch(/from users\)/);
  });
});

describe('threadId + entityId isolation', () => {
  it("threadId is prefixed 'attention:' + item id so it can't collide with a real thread", () => {
    expect(SRC).toMatch(/threadId:\s*`attention:\$\{it\.id\}`/);
  });

  it("entityId is the item's real entity ref (bookingId / orderId / ...)", () => {
    expect(SRC).toMatch(/entityId:\s*it\.entityId/);
  });
});

describe('adapter matches the HubSource contract', () => {
  it('exports listAttentionInboxItems with (uid, workspace) signature', () => {
    expect(SRC).toMatch(
      /export async function listAttentionInboxItems\(\s*uid: string,\s*workspace: InboxWorkspace,\s*\): Promise<InboxItem\[\]>/,
    );
  });
});
