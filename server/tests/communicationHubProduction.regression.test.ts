/**
 * CommunicationHubService — production HubSource factory pin.
 *
 * CEO NEXT-AUTO §21 + Doctrine §22, §92.
 *
 * The abstract HubSource shipped with only a stub (createStubHubSource
 * returns [] for every lane). This pin locks the factory that binds the
 * three real adapters (§14–§16) into one HubSource the unified Inbox
 * endpoint can plug into:
 *
 *   • Each lane is fail-CLOSED — an adapter throw becomes [] for its
 *     lane so a partial DB outage never nukes the whole Inbox.
 *   • Adapter modules are LAZY-imported so an unused lane doesn't pay
 *     module-load cost on cold start, and boot-time module cycles stay
 *     broken.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'CommunicationHubService.ts'),
  'utf8',
);

describe('createProductionHubSource — wires all three real adapters', () => {
  it('exports the factory', () => {
    expect(SRC).toMatch(/export function createProductionHubSource\(\): HubSource/);
  });

  it('binds the booking-conversation adapter (§14)', () => {
    expect(SRC).toMatch(
      /async listBookingConversationInboxItems\(uid, workspace\)[\s\S]{0,300}import\('\.\/BookingConversationInboxAdapter'\)/,
    );
  });

  it('binds the chat_threads adapter (§15)', () => {
    expect(SRC).toMatch(
      /async listChatThreadInboxItems\(uid, workspace\)[\s\S]{0,300}import\('\.\/ChatThreadInboxAdapter'\)/,
    );
  });

  it('binds the attention adapter (§16)', () => {
    expect(SRC).toMatch(
      /async listAttentionInboxItems\(uid, workspace\)[\s\S]{0,300}import\('\.\/AttentionInboxAdapter'\)/,
    );
  });
});

describe('lane-level fail-closed discipline', () => {
  it('each lane wraps its adapter call in try / return []', () => {
    // A thrown adapter must never take down the other two lanes' data.
    // The doctrine's Inbox is a projection — when a source fails, the
    // caller gets an empty list for that lane, never a 500.
    const factoryIdx = SRC.indexOf('createProductionHubSource(): HubSource');
    expect(factoryIdx).toBeGreaterThan(0);
    const factoryBody = SRC.slice(factoryIdx, SRC.length);
    const catchCount = (factoryBody.match(/} catch {\s*return \[\]/g) ?? []).length;
    expect(catchCount).toBeGreaterThanOrEqual(3);
  });
});

describe('CEO §92 — no new storage, just wiring', () => {
  it('the factory does NOT create tables, run migrations, or open its own db handle', () => {
    const idx = SRC.indexOf('createProductionHubSource(): HubSource');
    const end = SRC.length;
    const body = SRC.slice(idx, end);
    expect(body).not.toMatch(/CREATE TABLE/i);
    expect(body).not.toMatch(/new Pool\(|new Client\(/);
  });
});
