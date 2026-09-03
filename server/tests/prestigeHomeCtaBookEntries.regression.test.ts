/**
 * Lane B follow-up · CTA action-id wiring on PrestigeHome quick-action
 * tiles (post-release 2026-09-03).
 *
 * PrestigeHome is the Pet-Parent home screen — the single busiest
 * customer surface. Every quick-action tile that STARTS a real
 * customer journey must carry a stable CTA identity so analytics can
 * distinguish "customer taps to book a sitter" from "customer taps
 * to add a pet" — and so a Playwright / E2E can drive the tile by
 * its `data-testid` without label scraping.
 *
 * Pinned invariants:
 *   1. The tile onClick emits `emitCtaEvent(a.actionId)` BEFORE
 *      navigate(a.to) — the emit MUST be first so a slow navigation
 *      never buries the event.
 *   2. The DOM carries `data-action-id={a.actionId}` and
 *      `data-testid={a.testId}` so E2E has stable handles.
 *   3. Each of the four booking-journey entries (sitter / walk /
 *      academy / eGift) resolves to the right (destination,
 *      actionId, testId) triplet.
 *   4. Every CtaAction literal used in this file is a real member
 *      of the CtaAction enum (guard against typos silently emitting
 *      an id nothing consumes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'PrestigeHome.tsx'),
  'utf8',
);
const REGISTRY = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'lib', 'ctaActions.ts'),
  'utf8',
);

describe('PrestigeHome · CTA book-entries wiring (Lane B follow-up)', () => {
  it('imports emitCtaEvent + CtaAction type from the canonical registry', () => {
    expect(SRC).toMatch(
      /import \{ emitCtaEvent, type CtaAction \} from '@\/lib\/ctaActions';/,
    );
  });

  it('quick-action button onClick emits BEFORE navigate — order matters', () => {
    // A single ordered regex that must match verbatim. If a refactor
    // flips the two calls, this fails.
    expect(SRC).toMatch(
      /onClick=\{\(\) => \{\s*\n\s*if \(a\.soon\) return;\s*\n\s*if \(a\.actionId\) emitCtaEvent\(a\.actionId\);\s*\n\s*navigate\(a\.to\);\s*\n\s*\}\}/,
    );
  });

  it('quick-action button forwards data-action-id AND data-testid onto the DOM', () => {
    expect(SRC).toMatch(/data-action-id=\{a\.actionId\}/);
    expect(SRC).toMatch(/data-testid=\{a\.testId\}/);
  });

  it.each([
    ['/sitter-suite',   'BOOK_SITTER_ENTRY',  'petparent-home-book-sitter'],
    ['/walk-my-pet',    'BOOK_WALK_ENTRY',    'petparent-home-book-walk'],
    ['/academy',        'BOOK_ACADEMY_ENTRY', 'petparent-home-book-academy'],
    ['/buy-gift-card',  'EGIFT_PURCHASE',     'petparent-home-egift-purchase'],
    ['/my-wallet',      'WALLET_TOP_UP',      'petparent-home-wallet-top-up'],
  ])('%s tile carries actionId=%s testId=%s', (to, actionId, testId) => {
    // The array literal on PrestigeHome pairs `to`, `actionId`, and
    // `testId` on ONE row. Pin them together so a refactor that
    // splits them (or changes any single field) fails loudly.
    // `/` in the URL is not a regex metachar; drop it verbatim.
    const rx = new RegExp(
      `to:\\s*'${to}'[\\s\\S]{0,300}actionId:\\s*'${actionId}'[\\s\\S]{0,120}testId:\\s*'${testId}'`,
    );
    expect(SRC).toMatch(rx);
  });

  it('every actionId literal used in PrestigeHome exists in the CtaAction enum (no typos)', () => {
    // Extract each `actionId: '<X>'` and confirm the registry has
    // `| '<X>'` — that's the exact syntactic shape of a CtaAction
    // union member.
    const ids = Array.from(SRC.matchAll(/actionId:\s*'([A-Z_]+)'/g)).map(
      (m) => m[1],
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of new Set(ids)) {
      expect(REGISTRY).toContain(`| '${id}'`);
    }
  });

  it('the "soon" tile (PetTrek) is guarded — never emits an event, never navigates', () => {
    // The tile with `soon: true` short-circuits at the top of the
    // handler. Pin the guard so an accidental removal (or reorder
    // that emits before the guard) fails here.
    expect(SRC).toMatch(/if \(a\.soon\) return;/);
    expect(SRC).toMatch(/soon: true/);
  });
});
