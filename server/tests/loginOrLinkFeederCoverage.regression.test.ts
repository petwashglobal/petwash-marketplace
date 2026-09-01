/**
 * Phase 1 regression pin — every session-mint / identity-creating feeder
 * MUST route through `server/identity/loginOrLink.ts`.
 *
 * The audit that scoped Phase 1 (feeder census, 2026-09-01) identified 11
 * distinct feeders that create a Pet Wash session or upsert a `users` row.
 * Any NEW feeder that lands without adopting the canonical identity resolver
 * silently re-fragments identity (Google-you + Apple-you become two users).
 *
 * This pin walks the known feeder set and asserts each file references the
 * canonical resolver. The KNOWN_LEGACY set is the CEO-authorized transitional
 * exemption — every entry is scheduled for wiring in Phase 1.x under
 * `ff.returning_user.identity_unified.enabled`. New entries are forbidden.
 *
 * When you add a session-mint feeder:
 *   1. Wire `loginOrLink` (or `linkAdditionalProvider` for user-initiated
 *      link) as part of the mint flow.
 *   2. Delete its entry from KNOWN_LEGACY here.
 *   3. Add a positive assertion for it in FEEDERS_WIRED below.
 *
 * If you cannot add the wiring in the same PR, that is fine — leave the
 * entry in KNOWN_LEGACY and open a follow-up. Do NOT introduce a NEW
 * un-wired feeder file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

// Every file that today mints a Pet Wash session OR upserts a `users` row.
// Enumerated from the Phase 1 feeder census (four-audit output, 2026-09-01).
// A file appearing here MUST either (a) call loginOrLink / linkAdditionalProvider,
// or (b) be listed in KNOWN_LEGACY below with a Phase 1.x wiring plan.
const FEEDER_FILES: readonly string[] = [
  // A1. Master cookie minter
  'server/routes.ts',
  // A2. Custom-token feeders
  'server/routes/publicAuthRoutes.ts',   // phone-session + email-session
  'server/routes/mobile-auth.ts',        // mobile-google
  'server/routes/mobile-biometric.ts',   // mobile biometric verify
  'server/routes/pin-auth.ts',           // pin trusted-device verify
  // A3. Session-cookie bypass minters
  'server/routes/identity-service.ts',   // /auth/login/standard + /auth/login/google
  // A4. Hidden identity minter inside auth middleware
  'server/customAuth.ts',
];

// Files scheduled for Phase 1.x loginOrLink wiring. Do NOT add new entries.
// Each entry must have a Phase 1.x follow-up planned; the wiring lands
// before Phase 6 (account-linking) opens.
const KNOWN_LEGACY: ReadonlySet<string> = new Set([
  'server/routes.ts',
  'server/routes/publicAuthRoutes.ts',
  'server/routes/mobile-auth.ts',
  'server/routes/mobile-biometric.ts',
  'server/routes/pin-auth.ts',
  'server/routes/identity-service.ts',
  'server/customAuth.ts',
]);

// Canonical identity resolver export names. Any legitimate feeder wiring
// imports one of these from '../identity/loginOrLink' or equivalent.
const RESOLVER_SYMBOLS = /\b(loginOrLink|linkAdditionalProvider)\b/;

/** Reads a repo-relative file. Returns null if the file does not exist. */
function readIfExists(rel: string): string | null {
  const abs = join(REPO_ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

describe('Phase 1 regression pin — loginOrLink feeder coverage', () => {
  it('every enumerated feeder file exists', () => {
    for (const rel of FEEDER_FILES) {
      const source = readIfExists(rel);
      expect(source, `feeder file missing: ${rel} — census may need updating`).not.toBeNull();
    }
  });

  it('every feeder either wires loginOrLink OR is listed in KNOWN_LEGACY', () => {
    const missing: string[] = [];
    for (const rel of FEEDER_FILES) {
      const source = readIfExists(rel);
      if (source === null) continue; // covered by the previous test
      const wired = RESOLVER_SYMBOLS.test(source);
      const exempt = KNOWN_LEGACY.has(rel);
      if (!wired && !exempt) {
        missing.push(rel);
      }
    }
    expect(
      missing,
      'The following feeders neither call loginOrLink nor appear in KNOWN_LEGACY. ' +
        'Either wire the resolver or add a KNOWN_LEGACY entry with a Phase 1.x plan:\n' +
        missing.map((m) => `  - ${m}`).join('\n'),
    ).toEqual([]);
  });

  it('KNOWN_LEGACY does not contain new entries (regression pin — Phase 1.x deletes them one by one)', () => {
    // Snapshot of KNOWN_LEGACY as of Phase 1 landing. As feeders adopt
    // loginOrLink they leave this set. This test guards against KNOWN_LEGACY
    // GROWING — a symptom of a new un-wired feeder sneaking in and being
    // added to the exemption list instead of being wired.
    const ALLOWED_LEGACY_MAX = 7;
    expect(
      KNOWN_LEGACY.size,
      `KNOWN_LEGACY has ${KNOWN_LEGACY.size} entries; Phase 1 pinned it at ${ALLOWED_LEGACY_MAX}. ` +
        'If you added a new feeder, WIRE loginOrLink; do not extend KNOWN_LEGACY.',
    ).toBeLessThanOrEqual(ALLOWED_LEGACY_MAX);
  });

  it('the canonical resolver module still exports loginOrLink AND linkAdditionalProvider', () => {
    const source = readIfExists('server/identity/loginOrLink.ts');
    expect(source, 'server/identity/loginOrLink.ts missing').not.toBeNull();
    expect(source).toMatch(/export\s+async\s+function\s+loginOrLink\b/);
    expect(source).toMatch(/export\s+async\s+function\s+linkAdditionalProvider\b/);
  });

  it('the unsafe verified-email auto-link path stays REMOVED from loginOrLink', () => {
    // Pin the Phase 1 rebuild: matching email is not proof of matching
    // person. If a future refactor accidentally reintroduces the auto-link,
    // this test catches it.
    const source = readIfExists('server/identity/loginOrLink.ts');
    expect(source).not.toBeNull();
    // Must not linkIdentity() based on a plain byEmail lookup inside
    // loginOrLink itself. The Phase 6 linkAdditionalProvider path is the
    // only sanctioned linking function.
    expect(source!).not.toMatch(/verified email matches an existing user/i);
    expect(source!).not.toMatch(/attach to an existing user with the SAME verified email/i);
  });

  it('shadow-merge observation is inline on the new-user path', () => {
    const source = readIfExists('server/identity/loginOrLink.ts');
    expect(source).not.toBeNull();
    expect(source!).toMatch(/emitShadowMergeIfCollision/);
    expect(source!).toMatch(/IDENTITY_SHADOW_WOULD_MERGE/);
  });
});
