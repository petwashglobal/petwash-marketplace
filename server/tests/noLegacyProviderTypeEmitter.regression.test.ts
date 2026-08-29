/**
 * CEO MASTER §2.3 (2026-08-29) — CI guard against NEW client-side
 * emitters of the legacy `?type=<alias>` / `?role=<alias>` provider
 * URL shape.
 *
 * Rule of the road:
 *   * The resume gate (BecomeProviderResume) STILL ACCEPTS legacy
 *     `?type=` and `?role=` shapes at the edge so old bookmarks +
 *     email links + native-app deep links do not break.
 *   * NEW app code MUST emit the canonical
 *     `?requestedService=<code>` shape via
 *     `urlForProviderIntent()` / `becomeProviderHref()`. Any client
 *     source that hand-builds `?type=<alias>` or `?role=<alias>` is
 *     a regression.
 *   * ALLOWED exceptions (documented below):
 *     - the resume gate's normaliser reads `type` and `role` from
 *       URL search params (READ, not emit).
 *     - tests / fixtures that exercise the legacy edge.
 *     - historical comments quoting the legacy shape.
 *
 * If a new emitter shows up, this test fails with the file:line so
 * the reviewer can point it at `urlForProviderIntent`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT_SRC = path.resolve(__dirname, '..', '..', 'client', 'src');

/**
 * Files/paths this check DOES NOT scan. All exemptions must be a
 * conscious decision — do not add here to bury a defect.
 */
const EXEMPT_PATH_SUFFIXES: string[] = [
  // Resume gate reads legacy params (does not EMIT them).
  'pages/BecomeProviderResume.tsx',
  'pages/becomeProviderResume.helpers.ts',
  // Test / regression files quoting the legacy shape.
  '__tests__',
  '.test.ts',
  '.test.tsx',
  '.regression.test.ts',
];

/**
 * Vocabulary the guard treats as legacy provider aliases. Present in
 * a URL query as `?type=<alias>` or `?role=<alias>` in EMISSION
 * position it is a violation.
 */
const LEGACY_ALIASES = ['sitter', 'walker', 'trainer', 'driver', 'pet_trek', 'station_operator'];

const EMITTER_PATTERNS: RegExp[] = LEGACY_ALIASES.flatMap((alias) => [
  new RegExp(`\\?type=${alias}\\b`, 'i'),
  new RegExp(`\\?role=${alias}\\b`, 'i'),
  new RegExp(`&type=${alias}\\b`, 'i'),
  new RegExp(`&role=${alias}\\b`, 'i'),
]);

/**
 * Walk client/src, collect .ts/.tsx files, return relative paths.
 */
function collectClientFiles(root: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      collectClientFiles(full, out);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function isExempt(abs: string): boolean {
  const rel = path.relative(CLIENT_SRC, abs);
  return EXEMPT_PATH_SUFFIXES.some((suffix) =>
    rel.endsWith(suffix) || rel.includes(`${suffix}/`) || rel.includes(`/${suffix}`),
  );
}

interface Finding {
  file: string;
  line: number;
  match: string;
}

function scanFile(abs: string): Finding[] {
  const rel = path.relative(CLIENT_SRC, abs);
  const src = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  const findings: Finding[] = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    // Skip lines that are ENTIRELY a comment quoting the legacy
    // shape — the spec allows historical/documentation prose.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    for (const rx of EMITTER_PATTERNS) {
      const m = rx.exec(line);
      if (m) {
        findings.push({ file: rel, line: i + 1, match: m[0] });
        break;
      }
    }
  }
  return findings;
}

describe('CEO §2.3 — no NEW client emitter writes ?type=<alias> or ?role=<alias>', () => {
  it('every client .ts/.tsx source is clear of legacy provider-URL emission', () => {
    const files = collectClientFiles(CLIENT_SRC);
    const allFindings: Finding[] = [];
    for (const f of files) {
      if (isExempt(f)) continue;
      allFindings.push(...scanFile(f));
    }
    // Zero tolerance. A grandfathered emitter must go through the
    // exempt list with a code comment explaining why — this test
    // is the reviewer's guardrail.
    expect(
      allFindings,
      allFindings.length
        ? `New legacy provider emitter(s) found:\n${allFindings
            .map((f) => `  ${f.file}:${f.line}  ${f.match}`)
            .join('\n')}\nUse urlForProviderIntent() from @/lib/ctaActions.`
        : '',
    ).toEqual([]);
  });
});
