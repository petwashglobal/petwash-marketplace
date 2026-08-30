/**
 * UnreadCountsService — CEO DEEP-LOGIC §19, §20.
 *
 * Locks the shape of the per-workspace SUMs the marketplace-inbox
 * endpoint uses to build a real global unread number. The previous
 * design read the fetched-for-workspace merged list to derive
 * `provider = 0` when the caller was on PET_PARENT — that was a lie
 * this pin bans from reappearing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'UnreadCountsService.ts'),
  'utf8',
);
const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'marketplace-inbox.ts'),
  'utf8',
);

describe('CEO §20 — SUM projections, not history hydration', () => {
  it('uses SUM(customer_unread) on booking_conversations for Pet Parent', () => {
    expect(SRC).toMatch(
      /COALESCE\(SUM\(\$\{bookingConversations\.customerUnread\}\), 0\)/,
    );
  });

  it('uses SUM(provider_unread) on booking_conversations for Provider', () => {
    expect(SRC).toMatch(
      /COALESCE\(SUM\(\$\{bookingConversations\.providerUnread\}\), 0\)/,
    );
  });

  it('uses SUM(unread_customer_count) on chat_threads for Pet Parent', () => {
    expect(SRC).toMatch(
      /COALESCE\(SUM\(\$\{chatThreads\.unreadCustomerCount\}\), 0\)/,
    );
  });

  it('uses SUM(unread_provider_count) on chat_threads for Provider', () => {
    expect(SRC).toMatch(
      /COALESCE\(SUM\(\$\{chatThreads\.unreadProviderCount\}\), 0\)/,
    );
  });

  it('never SELECTs a raw list (no `.select(*).from(bookingConversations)` without SUM)', () => {
    // The prior "load list then compute" pattern is banned in this
    // module; SUMs only.
    expect(SRC).not.toMatch(/\.select\(\)\.from\(bookingConversations\)/);
    expect(SRC).not.toMatch(/\.select\(\)\.from\(chatThreads\)/);
  });
});

describe('CEO §19 — response has all four counters + degraded fallback', () => {
  it('UnreadTotals carries petParent, provider, global, degraded', () => {
    expect(SRC).toMatch(
      /export interface UnreadTotals\s*\{[\s\S]{0,400}petParent: number;[\s\S]{0,200}provider: number;[\s\S]{0,200}global: number;[\s\S]{0,400}degraded:/,
    );
  });

  it('global = petParent + provider (never re-derived from a filtered list)', () => {
    expect(SRC).toMatch(/global:\s*petParent \+ provider/);
  });

  it('each SUM failure degrades ONLY its lane, not the whole call', () => {
    // sumOrDegraded wraps every query — one failure returns
    // { value: 0, degraded: true }, the other three carry on.
    expect(SRC).toMatch(/async function sumOrDegraded/);
    expect(SRC).toMatch(/return \{ value: 0, degraded: true \}/);
    // The four independent Promise.all sums.
    expect(SRC).toMatch(/const \[bcPP, bcPV, ctPP, ctPV\] = await Promise\.all/);
  });
});

describe('marketplace-inbox route wire', () => {
  it('calls loadUnreadTotals(uid) in parallel with the item listing', () => {
    expect(ROUTE).toMatch(/import \{ loadUnreadTotals \} from '\.\.\/services\/marketplace\/UnreadCountsService'/);
    expect(ROUTE).toMatch(
      /const \[result, totals\] = await Promise\.all\(\[[\s\S]{0,300}loadUnreadTotals\(uid\),/,
    );
  });

  it('response replaces the merged-list-derived unread with the SUM totals', () => {
    expect(ROUTE).toMatch(
      /unread:\s*\{[\s\S]{0,200}currentWorkspace,[\s\S]{0,80}petParent: totals\.petParent,[\s\S]{0,80}provider: totals\.provider,[\s\S]{0,80}global: totals\.global/,
    );
  });

  it("currentWorkspace is derived from the requested workspace", () => {
    expect(ROUTE).toMatch(
      /const currentWorkspace = workspace === 'PET_PARENT' \? totals\.petParent : totals\.provider/,
    );
  });

  it('unreadDegraded flags flow through to the caller for observability', () => {
    expect(ROUTE).toMatch(/unreadDegraded: totals\.degraded/);
  });
});
