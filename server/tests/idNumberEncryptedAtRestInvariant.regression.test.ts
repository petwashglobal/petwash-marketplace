/**
 * Regression pin — Teudat Zehut lands encrypted at rest, never raw
 * (CEO invariant — audit X-ray P1-6 / migration 0103 anchor).
 *
 * `users.id_number` is the legacy PLAINTEXT column and every write
 * path has been migrated to the ciphertext + blind-index pair
 * (`id_number_enc` + `id_number_hash`). The schema comment on the
 * legacy column says as much:
 *
 *   idNumber: varchar("id_number"),  // LEGACY plaintext — do NOT
 *   write (migrated to *_enc). Read path uses idNumberHash.
 *
 * The invariant: NO application code may set `idNumber` on the users
 * table in an insert or update. The only remaining consumer of that
 * column is the one-shot backfill script that reads legacy plaintext
 * rows, encrypts them, and nulls the plaintext (see
 * scripts/backfill-user-idnumber-encryption.ts).
 *
 * This pin walks server/ and shared/ (excluding the backfill script
 * and the schema file's declaration itself) and refuses any
 * `.values({ idNumber: ... })` or `.set({ idNumber: ... })` shape
 * that lands raw Teudat Zehut into the users row.
 */
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { repoGrep } from './helpers/repoGrep';

/*
 * WHOLE-TREE SCAN BUDGET (2026-09-10). These pins walk every .ts (and for some,
 * .tsx) under server/, shared/ and client/ in-process. They used to shell out
 * to ripgrep — a purpose-built parallel scanner — but ripgrep is not a
 * dependency of this repo and is often a shell function rather than a binary,
 * so `execSync` could never find it and NONE of these tests could run.
 *
 * In-process, a single file finishes in well under a second. But `test:money`
 * runs these files in PARALLEL workers that each fill their own cache and
 * contend for I/O, and that is enough to blow vitest's 5s default. A timeout
 * presents identically to a real regression, so the budget is explicit and
 * generous rather than left to chance.
 */
vi.setConfig({ testTimeout: 60_000 });


const ROOT = join(__dirname, '..', '..');

const ALLOWED = new Set<string>([
  // The migration script IS the reader of the legacy column — it clears
  // it. Not a "write raw" path.
  'scripts/backfill-user-idnumber-encryption.ts',
  // Column declaration lives here; not an assignment.
  'shared/schema.ts',
]);

function grepRepo(pattern: string): string[] {
  // Was `execSync("rg ...")`. ripgrep is not a dependency of this repo and
  // is frequently a shell function rather than a binary, so /bin/sh could not
  // find it and every test in this file died before asserting. See
  // server/tests/helpers/repoGrep.ts.
  return repoGrep(ROOT, pattern, {
    includeExt: ['ts'],
  });
}

describe('CEO invariant — Teudat Zehut encrypted at rest', () => {
  it('no application code writes `idNumber:` into a users-table insert or update', () => {
    // Concrete anti-pattern:
    //   db.insert(users).values({ idNumber: ... })
    //   db.update(users).set({ ..., idNumber: ..., ... })
    //
    // The safe path uses encryptField() → idNumberEnc AND blindIndex() → idNumberHash.
    // Refuse the raw `idNumber:` property key anywhere in the same file
    // that also references the `users` table — that combination is the
    // bug shape, not a hit on `idNumber` in a schema type or a form-input DTO.
    const hits = grepRepo(String.raw`\bidNumber:\s*[^\s]`);
    const strays: string[] = [];
    for (const line of hits) {
      const [file, lineNoRaw, ...rest] = line.split(':');
      const rel = file.replace(ROOT + '/', '');
      if (ALLOWED.has(rel)) continue;
      const content = rest.join(':').trimStart();
      // Skip comment-only lines so schema declarations and doc-comments
      // that mention the property key don't false-positive.
      if (/^(\/\/|\/\*|\*)/.test(content)) continue;
      // The property-key match only counts as a hit against the users
      // table when the same file also imports/uses `users` from shared
      // schema. Files that use the same key for a DIFFERENT table
      // (kyc_document.idNumber, form-DTO fields, etc.) are fine.
      const src = require('node:fs').readFileSync(file, 'utf8') as string;
      const touchesUsersTable =
        /from\s+['"]@shared\/schema['"]/.test(src) &&
        /\b(?:insert|update)\s*\(\s*users\s*\)/.test(src);
      if (!touchesUsersTable) continue;
      // And the property must sit inside an object-literal that could
      // reach a users-table .set/.values — proxy check: the key appears
      // within ~10 lines of an `insert(users)` or `update(users)` call.
      const lineNo = parseInt(lineNoRaw, 10);
      const lines = src.split('\n');
      const start = Math.max(0, lineNo - 12);
      const end = Math.min(lines.length, lineNo + 12);
      const window = lines.slice(start, end).join('\n');
      if (!/\b(?:insert|update)\s*\(\s*users\s*\)/.test(window)) continue;
      strays.push(`${rel}:${lineNo}`);
    }
    expect(
      strays,
      `raw idNumber written into users table — MUST encrypt via encryptField() → idNumberEnc + blindIndex() → idNumberHash. Offenders:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('schema legacy comment still names id_number as "do NOT write"', () => {
    const src = require('node:fs').readFileSync(
      join(ROOT, 'shared/schema.ts'),
      'utf8',
    ) as string;
    expect(src).toMatch(/idNumber:\s*varchar\("id_number"\)[\s\S]{0,120}?LEGACY plaintext[\s\S]{0,60}?do NOT write/);
  });

  it('encrypt path helpers (encryptField + blindIndex) still exist and are exported', () => {
    const src = require('node:fs').readFileSync(
      join(ROOT, 'server/services/secretFieldCrypto.ts'),
      'utf8',
    ) as string;
    expect(src).toMatch(/export function encryptField\(/);
    expect(src).toMatch(/export function blindIndex\(/);
  });

  it('backfill script still exists — the one legitimate consumer of the legacy column', () => {
    const src = require('node:fs').readFileSync(
      join(ROOT, 'scripts/backfill-user-idnumber-encryption.ts'),
      'utf8',
    ) as string;
    // Reads plaintext → encrypts → sets ..._enc + ..._hash AND clears
    // the raw column in the same UPDATE. The clear step is what
    // eventually makes the legacy column unreachable.
    expect(src).toMatch(/idNumberEnc:\s*enc,\s*idNumberHash:\s*hash,\s*idNumber:\s*null/);
  });
});
