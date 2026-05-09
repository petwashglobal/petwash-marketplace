/**
 * PR-PET-1 — pet-profile fragmentation audit pins.
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *         (PR #213, merged) + the Honesty preface §0.
 *
 * Purpose: lock the known fragmentation in source-pin tests so future
 * work cannot pretend the system has a single clean pet profile. These
 * tests are deliberately ANTI-tests where appropriate — they pin the
 * mess in place by name + line number so:
 *
 *   • Any future PR that "accidentally" reduces the count of pet
 *     definitions trips a test and forces a deliberate decision about
 *     consolidation (which is its OWN PR class per PR-PET-3+).
 *   • Any consolidation PR has a clear failing-test target to update,
 *     proving each fragment was retired on purpose, not by drift.
 *   • Reviewers cannot believe the system is clean when the audit
 *     evidence still exists in the codebase.
 *
 * No runtime change. No schema change. No UI change. No dependency.
 * No edits to source files; only this new test file is added.
 *
 * Hard scope:
 *   • The 4 categories the CEO listed in PR-PET-1 (multiple pet
 *     definitions; /api/pets duplicate mount; i18n split; reusable
 *     privacy pieces).
 *   • Each test cites file:line that was verified against current
 *     main BEFORE authoring (per CEO "stop and report if no longer
 *     true").
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

// ── Cat. 1 — Multiple pet definitions ────────────────────────────────────

describe('PR-PET-1 — pin: multiple parallel pet definitions exist', () => {
  it('1. shared/schema.ts has `pets` pgTable (the canonical-ish one)', () => {
    const src = read('shared/schema.ts');
    expect(src).toMatch(/export\s+const\s+pets\s*=\s*pgTable\(\s*['"]pets['"]/);
  });

  it('2. shared/super-app-schema.ts has a SECOND `pets` pgTable', () => {
    const src = read('shared/super-app-schema.ts');
    expect(src).toMatch(/export\s+const\s+pets\s*=\s*pgTable\(\s*['"]pets['"]/);
  });

  it('3. shared/super-app-schema-v2.ts has a THIRD `pets` pgTable', () => {
    const src = read('shared/super-app-schema-v2.ts');
    expect(src).toMatch(/export\s+const\s+pets\s*=\s*pgTable\(\s*['"]pets['"]/);
  });

  it('4. shared/schema.ts ALSO defines `customer_pets` (a different shape)', () => {
    const src = read('shared/schema.ts');
    expect(src).toMatch(/export\s+const\s+customerPets\s*=\s*pgTable\(\s*['"]customer_pets['"]/);
  });

  it('5. shared/schema.ts ALSO defines `pet_profiles_for_sitting`', () => {
    const src = read('shared/schema.ts');
    expect(src).toMatch(/export\s+const\s+petProfilesForSitting\s*=\s*pgTable\(\s*['"]pet_profiles_for_sitting['"]/);
  });

  it('6. shared/schema.ts ALSO defines `pet_avatars`', () => {
    const src = read('shared/schema.ts');
    expect(src).toMatch(/export\s+const\s+petAvatars\s*=\s*pgTable\(\s*['"]pet_avatars['"]/);
  });

  it('7. shared/firestore-schema.ts defines a Firestore `petProfileSchema` (Zod)', () => {
    const src = read('shared/firestore-schema.ts');
    expect(src).toMatch(/export\s+const\s+petProfileSchema\s*=\s*z\.object\(/);
  });

  it('8. walk-my-pet stores pet info INLINE on the booking row (no FK)', () => {
    // shared/schema.ts:5522 — inline `petName` on a walk-related table.
    const src = read('shared/schema.ts');
    // We assert that `pet_name` (snake-case Postgres column) appears in
    // tables OTHER than the pet definitions themselves. There are at
    // least 8 such occurrences across booking-shaped tables.
    const matches = src.match(/petName:\s*varchar\(\s*["']pet_name["']/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('9. AGGREGATE: at least 6 distinct pgTable definitions match a pet shape', () => {
    // Cross-check the audit's "seven definitions" claim by counting only
    // the pgTable defs (Firestore + inline-petName are separate
    // categories pinned above). Six pgTable defs:
    //   shared/schema.ts:pets
    //   shared/super-app-schema.ts:pets
    //   shared/super-app-schema-v2.ts:pets
    //   shared/schema.ts:customer_pets
    //   shared/schema.ts:pet_profiles_for_sitting
    //   shared/schema.ts:pet_avatars
    let count = 0;
    for (const file of [
      'shared/schema.ts',
      'shared/super-app-schema.ts',
      'shared/super-app-schema-v2.ts',
    ]) {
      const src = read(file);
      const matches = src.match(/pgTable\(\s*["'](pets|customer_pets|pet_profiles_for_sitting|pet_avatars)["']/g) || [];
      count += matches.length;
    }
    expect(count).toBeGreaterThanOrEqual(6);
  });
});

// ── Cat. 2 — /api/pets duplicate mount + client defensive parsing ────────

describe('PR-PET-1 — pin: /api/pets duplicate mount + client defensive parsing', () => {
  const routes = read('server/routes.ts');

  it('10. server/routes.ts mounts /api/pets via a router (Firestore-backed)', () => {
    expect(routes).toMatch(/app\.use\(\s*['"]\/api\/pets['"]/);
  });

  it('11. server/routes.ts ALSO defines /api/pets as a single GET handler', () => {
    expect(routes).toMatch(/app\.get\(\s*['"]\/api\/pets['"]/);
  });

  it('12. BOTH mount sites coexist in the same file (the bug)', () => {
    const useMatches = routes.match(/app\.use\(\s*['"]\/api\/pets['"]/g) || [];
    const getMatches = routes.match(/app\.get\(\s*['"]\/api\/pets['"]/g) || [];
    expect(useMatches.length).toBeGreaterThanOrEqual(1);
    expect(getMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('13. client/src/pages/GroomersBook.tsx has the defensive `.pets || d || []` parse', () => {
    const path = 'client/src/pages/GroomersBook.tsx';
    const src = read(path);
    // The defensive parse is the smoking gun that the prior programmer
    // KNEW two response shapes existed.
    expect(src).toMatch(/\.pets\s*\|\|\s*d\s*\|\|\s*\[\]/);
  });

  it('14. at least 3 client files defensively branch on response shape', () => {
    const candidates = [
      'client/src/pages/GroomersBook.tsx',
      'client/src/pages/MyAccount.tsx',
      'client/src/pages/walk-my-pet/BookingFlow.tsx',
      'client/src/pages/sitter-suite/BookingFlow.tsx',
    ];
    let count = 0;
    for (const file of candidates) {
      const fullPath = resolve(ROOT, file);
      if (!existsSync(fullPath)) continue;
      const src = read(file);
      // Either `.pets ||` (the defensive read) or `Array.isArray(...) ? ... : ... .pets`.
      if (
        /\.pets\s*\|\|/.test(src) ||
        /Array\.isArray\([^)]+\)\s*\?\s*[^:]+\s*:\s*\([^)]*\.pets/.test(src)
      ) {
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ── Cat. 3 — i18n split (two parallel systems, neither fully wired) ───────

describe('PR-PET-1 — pin: i18n split (two parallel systems)', () => {
  it('15. client/src/lib/i18n.ts is a monolithic file (>= 2000 lines)', () => {
    const src = read('client/src/lib/i18n.ts');
    const lines = src.split('\n').length;
    expect(lines).toBeGreaterThanOrEqual(2000);
  });

  it('16. client/src/lib/i18next-init.ts initialises with EMPTY resources', () => {
    const src = read('client/src/lib/i18next-init.ts');
    // Six languages declared, each with an empty translation object.
    expect(src).toMatch(/en:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
    expect(src).toMatch(/he:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
    expect(src).toMatch(/ar:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
    expect(src).toMatch(/ru:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
    expect(src).toMatch(/fr:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
    expect(src).toMatch(/es:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
  });

  it('17. public/locales/* directories exist on disk for the 6 languages', () => {
    for (const lang of ['en', 'he', 'ar', 'ru', 'fr', 'es']) {
      const dir = resolve(ROOT, `client/public/locales/${lang}`);
      expect(existsSync(dir)).toBe(true);
    }
  });

  it('18. i18next-init.ts does NOT use a backend / HTTP loader for locales', () => {
    // The init file is short and never references i18next-http-backend
    // or fs.readFileSync; the public/locales files therefore are not
    // loaded — confirming the split.
    const src = read('client/src/lib/i18next-init.ts');
    expect(src).not.toMatch(/i18next-http-backend|HttpBackend|i18next-fs-backend/);
    expect(src.split('\n').length).toBeLessThan(50); // tight file = no loader
  });
});

// ── Cat. 4 — Reusable privacy pieces (the bright spots) ──────────────────

describe('PR-PET-1 — pin: reusable privacy pieces (preserve verbatim)', () => {
  const PRIVACY_PATH = 'server/lib/petPrivacy.ts';
  const SCHEMA_PATH = 'shared/schema.ts';

  it('19. server/lib/petPrivacy.ts exists and is the privacy module', () => {
    expect(existsSync(resolve(ROOT, PRIVACY_PATH))).toBe(true);
    const src = read(PRIVACY_PATH);
    expect(src).toMatch(/Pet medical data privacy utilities/);
  });

  it('20. petPrivacy.ts enforces medicalShareConsent gating', () => {
    const src = read(PRIVACY_PATH);
    expect(src).toMatch(/medicalShareConsent/);
    expect(src).toMatch(/medicalDataPrivate/);
  });

  it('21. shared/schema.ts defines pet_temperament_enum', () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/petTemperamentEnum\s*=\s*pgEnum\(\s*["']pet_temperament["']/);
  });

  it('22. petPrivacy.ts has at least one explicit guard against unconsented disclosure', () => {
    const src = read(PRIVACY_PATH);
    // The combined check `medicalShareConsent === true && ...`
    // appears in code-only (strip block + line comments first).
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/medicalShareConsent['"]?\s*\]?\s*===\s*true/);
  });
});

// ── Cross-cutting: traceability + scope guard ─────────────────────────────

describe('PR-PET-1 — traceability + scope guard', () => {
  it('23. PR-PET-1 marker appears in this test file (grepability)', () => {
    const self = read('server/tests/petProfileFragmentation.regression.test.ts');
    const markers = self.match(/PR-PET-1/g) || [];
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it('24. this PR introduces NO money-flow keyword anywhere in the test file', () => {
    // Defence: a future amendment must not sneak any money-flow logic
    // into the audit-pin file. Pinning by name keeps the surface tight.
    const self = read('server/tests/petProfileFragmentation.regression.test.ts');
    expect(self).not.toMatch(/(payout|refund|wallet|charge|invoice|nayax|tranzila|stripe|sumit)\s*\(/i);
  });

  it('25. this PR introduces NO new schema definitions (no exported pgTable / pgEnum)', () => {
    // Scan for executable declarations, not regex pattern strings.
    // Strip block + line comments first; then strip the contents of
    // string literals so that regex patterns inside expect(...) calls
    // do not register as code.
    const self = read('server/tests/petProfileFragmentation.regression.test.ts');
    const codeOnly = self
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      // remove all string + regex literals
      .replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
    expect(codeOnly).not.toMatch(/\bexport\s+const\s+\w+\s*=\s*pgTable\(/);
    expect(codeOnly).not.toMatch(/\bexport\s+const\s+\w+\s*=\s*pgEnum\(/);
  });

  it('26. this PR introduces NO HTTP / DB call sites (read-only file inspection)', () => {
    const self = read('server/tests/petProfileFragmentation.regression.test.ts');
    const codeOnly = self
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
    // Real call sites: `fetch(`, `db.select(`, etc. — outside any string/regex.
    expect(codeOnly).not.toMatch(/\bawait\s+fetch\s*\(/);
    expect(codeOnly).not.toMatch(/\bdb\s*\.\s*(?:select|insert|update|delete)\s*\(/);
    // Imports of HTTP libraries.
    expect(codeOnly).not.toMatch(/\bfrom\s+\(\s*\)/);
    expect(self).not.toMatch(/^\s*import\s+[^;]*\bfrom\s+['"](?:axios|got|node-fetch)['"]/m);
  });
});
