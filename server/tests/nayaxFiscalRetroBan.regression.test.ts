/**
 * Regression pin — auditor 2026-08-30 steps 16/17 + SUMIT rule:
 *   • No retroactive fiscal-document generation for Nayax
 *     transactions.
 *   • No duplication of existing fiscal documents.
 *   • No back-dated issuedAt.
 *
 * Source-anchored so a well-meaning engineer cannot silently add
 * a "fill in missing historical receipts" job or a "duplicate to
 * fix corrupted PDF" helper without tripping CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..');

/**
 * Recursively enumerate .ts files under a specific subdirectory,
 * skipping tests, node_modules, and the shared/ tree. Full-server
 * walks were too slow (5s timeout) — the retro-fiscal-generation
 * risk lives in services/ + routes/ + lib/, so scanning those is
 * sufficient AND fast.
 */
function walkNarrow(dirs: string[]): string[] {
  const out: string[] = [];
  const stack = [...dirs];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'tests' || e.name === '__tests__') continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (e.isFile() && p.endsWith('.ts')) out.push(p);
    }
  }
  return out;
}

const FILES = walkNarrow([
  path.join(SERVER_ROOT, 'services'),
  path.join(SERVER_ROOT, 'routes'),
  path.join(SERVER_ROOT, 'lib'),
]);

/** Read each file once and cache its contents so per-token tests reuse the walk. */
const CACHE = new Map<string, string>();
for (const f of FILES) {
  try { CACHE.set(f, fs.readFileSync(f, 'utf8')); } catch { /* skip unreadable */ }
}

const BANNED_TOKENS: Array<{ token: RegExp; label: string }> = [
  { token: /\bgenerateRetroactive(Fiscal)?Receipt\b/i, label: 'generateRetroactiveReceipt' },
  { token: /\bbackfillFiscalDocument(s)?\b/i, label: 'backfillFiscalDocument' },
  { token: /\bbackdatedIssuedAt\b/i, label: 'backdatedIssuedAt' },
  { token: /\bforceDuplicateReceipt\b/i, label: 'forceDuplicateReceipt' },
  { token: /\bcloneFiscalDocument\b/i, label: 'cloneFiscalDocument' },
];

describe('Nayax fiscal retro/duplicate ban — source-anchored', () => {
  for (const { token, label } of BANNED_TOKENS) {
    it(`no server code uses banned symbol: ${label}`, () => {
      const offenders: string[] = [];
      for (const [f, contents] of CACHE) {
        // Exempt this pin file itself (should not appear in
        // services/routes/lib walk anyway, but keep the guard).
        if (f.endsWith('nayaxFiscalRetroBan.regression.test.ts')) continue;
        if (token.test(contents)) offenders.push(path.relative(SERVER_ROOT, f));
      }
      expect(offenders, `banned '${label}' appears in: ${offenders.join(', ')}`).toEqual([]);
    });
  }

  it('IsraeliDigitalReceiptService (if present) contains no "retroactive" / "backfill" / "backdate" tokens', () => {
    const candidate = path.join(SERVER_ROOT, 'services', 'IsraeliDigitalReceiptService.ts');
    if (!fs.existsSync(candidate)) return;
    const src = fs.readFileSync(candidate, 'utf8');
    for (const tok of ['retroactive', 'backfill', 'backdate']) {
      // Comments that reference the AUDIT are fine — the ban is on
      // words that would name a function or a code path. Match
      // whole-word occurrences in identifiers only.
      const identMatch = new RegExp(`\\b\\w*${tok}\\w*\\b`, 'i');
      const hit = identMatch.exec(src);
      if (!hit) continue;
      // Allow if the match sits inside a line-comment.
      const line = src.slice(0, hit.index).split('\n').pop() ?? '';
      const insideComment = /^\s*\/\/|\*/.test(line);
      expect(insideComment, `IsraeliDigitalReceiptService names '${tok}' outside a comment: ${hit[0]}`).toBe(true);
    }
  });
});
