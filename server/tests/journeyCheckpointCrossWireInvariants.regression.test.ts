/**
 * Cross-journey invariant regression pin for the Journey Brain
 * Phase 2 write-side (post-release 2026-09-03).
 *
 * The individual wire tests each pin one file. This pin captures
 * the invariants that MUST hold across ALL six resumable journeys
 * so a refactor cannot silently violate the safety contract in
 * one file without failing here:
 *
 *   1. Every resumable-journey file imports useJourneyCheckpoint
 *      from the ONE canonical hook path.
 *   2. Every one calls the hook with a domain literal that exists
 *      in the JourneyDomain enum (server/services/journeyCheckpoints.ts).
 *   3. Every one gates on `enabled: !!user` — the checkpoint
 *      endpoint 401s anonymous callers.
 *   4. Every one calls `.clear()` somewhere — the resume-card must
 *      disappear on completion.
 *   5. Every one's save-payload region contains NONE of the
 *      forbidden payment / fiscal / KYC / verification-truth keys.
 *   6. The six JourneyDomain enum members are FULLY covered — no
 *      more, no less — by the six wired files. Adding a new domain
 *      without wiring it fails here; removing an enum member
 *      without deleting the wire fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * One row per JourneyDomain enum member. Every row must point at a
 * real file on disk that carries a real wire. The six rows in this
 * array are the SOLE authority on which JourneyDomain values are
 * wired end-to-end.
 */
const WIRED_JOURNEYS = [
  {
    // Added 2026-09-06 while rebasing this pin onto current main. #2234 wired
    // the academy journey and added 'academy_book' to the JourneyDomain enum
    // AFTER this table was written, so the coverage assertion below was RED on
    // main — the table had six domains, the enum seven. That is the invariant
    // doing its job: a new JourneyDomain must not exist without a wire.
    // Verified before adding: client/src/pages/academy/BookingFlow.tsx:64 calls
    // useJourneyCheckpoint('academy_book', …) via the canonical hook path.
    domain: 'academy_book',
    file: 'client/src/pages/academy/BookingFlow.tsx',
  },
  {
    domain: 'sitter_book',
    file: 'client/src/pages/sitter-suite/BookingFlow.tsx',
  },
  {
    domain: 'walk_book',
    file: 'client/src/pages/walk-my-pet/BookingFlow.tsx',
  },
  {
    domain: 'marketplace_book',
    file: 'client/src/pages/MarketplaceBookingFlow.tsx',
  },
  {
    domain: 'shop_checkout',
    file: 'client/src/pages/CheckoutCanon.tsx',
  },
  {
    domain: 'egift',
    file: 'client/src/pages/BuyGiftCard.tsx',
  },
  {
    domain: 'provider_apply',
    file: 'client/src/pages/ProviderOnboarding.tsx',
  },
] as const;

/**
 * Keys a checkpoint payload MUST NEVER carry — enforced at three
 * layers (endpoint FORBIDDEN_PAYLOAD_KEYS, hook FORBIDDEN_PAYLOAD_KEYS,
 * and now this cross-file source pin). Any of these appearing inside
 * a `.save({...})` call region in a wire is a hard fail — the wire
 * is trying to store payment/legal truth.
 */
const FORBIDDEN_IN_ANY_SAVE = [
  // Payment truth
  'chargeId',
  'paidAt',
  'refundId',
  'settlementId',
  'transactionId',
  'redirectUrl',
  'paymentUrl',
  // Fiscal truth
  'fiscalDocumentNumber',
  // Voucher / issued-artefact truth (egift specific but universally forbidden)
  'voucherCode',
  'eGiftId',
  // KYC digits / uploads / verification (provider_apply)
  'idNumber',
  'idExpiry',
  'governmentId',
  'selfiePhoto',
  'phoneOtpCode',
  'biometricScore',
  'biometricMatchScore',
];

function readWire(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');
}

function readServiceEnum(): string[] {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'services', 'journeyCheckpoints.ts'),
    'utf8',
  );
  // The service file declares `export type JourneyDomain = 'a' | 'b' | ...`.
  // Extract every quoted literal after `JourneyDomain =` up to the closing `;`.
  const m = src.match(/export type JourneyDomain =([\s\S]*?);/);
  if (!m) throw new Error('cannot find JourneyDomain enum in journeyCheckpoints.ts');
  return Array.from(m[1].matchAll(/'([a-z_]+)'/g)).map((x) => x[1]);
}

describe('Journey Brain Phase 2 · cross-wire invariants (Lane C.3)', () => {
  const enumMembers = readServiceEnum();

  it('the WIRED_JOURNEYS table covers every JourneyDomain enum member (no more, no less)', () => {
    const wired = new Set(WIRED_JOURNEYS.map((j) => j.domain));
    const enumSet = new Set(enumMembers);
    expect([...wired].sort()).toEqual([...enumSet].sort());
  });

  it.each(WIRED_JOURNEYS.map((j) => [j.domain, j.file]))(
    '%s wire (%s) imports useJourneyCheckpoint from the canonical hook path',
    (_domain, rel) => {
      const src = readWire(rel);
      expect(src).toMatch(
        /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
      );
    },
  );

  it.each(WIRED_JOURNEYS.map((j) => [j.domain, j.file]))(
    '%s wire (%s) calls the hook with the correct domain literal AND enabled:!!user',
    (domain, rel) => {
      const src = readWire(rel);
      // Match: useJourneyCheckpoint<...>('<domain>', { enabled: !!user })
      //
      // The type argument is matched NON-GREEDILY (2026-09-06) rather than as
      // `[A-Za-z]+`. That narrower form silently assumed every wire uses a
      // NAMED payload type, so it failed against the academy wire's inline
      // `Record<string, unknown>` — nested angle brackets, a comma and a space
      // are all outside `[A-Za-z]`. The wire was correct; the pin was not.
      //
      // What this invariant is actually for is in its own title: the right
      // DOMAIN LITERAL and the `enabled: !!user` gate (so a checkpoint is
      // never opened for an anonymous visitor). Type-naming style is not part
      // of that guarantee and must not be able to fail it.
      const rx = new RegExp(
        `useJourneyCheckpoint<[\\s\\S]*?>\\(["']${domain}["'], \\{\\s*\\n?\\s*enabled: !!user,\\s*\\n?\\s*\\}\\)`,
      );
      expect(src).toMatch(rx);
    },
  );

  it.each(WIRED_JOURNEYS.map((j) => [j.domain, j.file]))(
    '%s wire (%s) calls .clear() somewhere — resume-card must clear on completion',
    (_domain, rel) => {
      const src = readWire(rel);
      // Both `checkpoint.clear()` and `providerApplyCheckpoint.clear()` are
      // acceptable — the local hook variable name is a wizard choice.
      expect(src).toMatch(/[A-Za-z]+\.clear\(\)/);
    },
  );

  it.each(WIRED_JOURNEYS.map((j) => [j.domain, j.file]))(
    '%s wire (%s) never mentions ANY forbidden payment/fiscal/KYC-truth key inside a .save({...}) region',
    (_domain, rel) => {
      const src = readWire(rel);
      // Extract every `<var>.save({...});` region. Multiple wires may
      // have multiple save calls (provider_apply saves once from an
      // effect, egift saves once from an effect, etc.).
      const saveRegions = Array.from(
        src.matchAll(/[A-Za-z]+\.save\(\{[\s\S]*?\}\);/g),
      ).map((m) => m[0]);
      // Every wire must have at least ONE save call.
      expect(saveRegions.length).toBeGreaterThan(0);
      for (const region of saveRegions) {
        for (const forbidden of FORBIDDEN_IN_ANY_SAVE) {
          expect(
            region.includes(forbidden),
            `[${rel}] save region must not include "${forbidden}"`,
          ).toBe(false);
        }
      }
    },
  );

  it('the hook FORBIDDEN_PAYLOAD_KEYS matches the server-side FORBIDDEN_PAYLOAD_KEYS (defence-in-depth contract stays in sync)', () => {
    const hookSrc = fs.readFileSync(
      path.resolve(
        __dirname, '..', '..', 'client', 'src', 'hooks', 'useJourneyCheckpoint.ts',
      ),
      'utf8',
    );
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes', 'journey-checkpoints.ts'),
      'utf8',
    );
    // Grab every quoted literal from the hook's FORBIDDEN_PAYLOAD_KEYS set.
    const hookKeys = new Set(
      Array.from(
        hookSrc.match(
          /export const FORBIDDEN_PAYLOAD_KEYS[\s\S]*?new Set\(\[([\s\S]*?)\]\)/,
        )?.[1].matchAll(/'([^']+)'/g) ?? [],
      ).map((m) => m[1]),
    );
    const routeKeys = new Set(
      Array.from(
        routeSrc.match(
          /const FORBIDDEN_PAYLOAD_KEYS = new Set\(\[([\s\S]*?)\]\)/,
        )?.[1].matchAll(/'([^']+)'/g) ?? [],
      ).map((m) => m[1]),
    );
    expect(hookKeys.size).toBeGreaterThan(0);
    expect(routeKeys.size).toBeGreaterThan(0);
    // Every server-side forbidden key must also appear on the client so a
    // bad payload is rejected BEFORE it hits the network. (The reverse is
    // allowed — the client can be stricter — but today both sets should be
    // in sync.)
    for (const k of routeKeys) {
      expect(hookKeys.has(k), `route rejects "${k}" but hook does not`).toBe(true);
    }
  });
});
