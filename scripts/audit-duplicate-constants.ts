/**
 * audit-duplicate-constants.ts
 * ----------------------------
 * PR-W22 (Phase 1.3) — Mega Phase F (Discipline Tooling)
 *
 * Scans the repo for duplicate definitions of core financial constants:
 *
 *   • VAT rate              — every  `(?:export )?const \w+ = 0.18;`  outside
 *                              the canonical shared/israel-compliance-config.ts
 *   • Wash price (cents)    — every  `5500` literal in a wash/k9000 context
 *   • Wash package prices   — '55.00', '150.00', '220.00', '440.00' literals
 *                              outside server/utils.ts (the canonical seed)
 *   • Env-var fallback      — `process.env.VAT_RATE || '0.18'` literal
 *
 * Why we built this: PR-W13 collapsed 26 duplicate VAT-rate definitions into
 * one. PR-W22 prevents the next 26 from being added without anyone noticing.
 *
 * USAGE
 *   npx tsx scripts/audit-duplicate-constants.ts            # human report
 *   npx tsx scripts/audit-duplicate-constants.ts --json     # machine output
 *   npx tsx scripts/audit-duplicate-constants.ts --strict   # exit 1 on any drift
 *
 * The companion CI guard lives at:
 *   server/tests/duplicate-constants-guard.test.ts
 * It calls scanRepo() and asserts the report is empty. Add a duplicate
 * VAT_RATE = 0.18 anywhere outside the canonical and CI fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');

const CANONICAL_VAT_FILE = path.join(REPO_ROOT, 'shared', 'israel-compliance-config.ts');
const CANONICAL_WASH_SEED_FILE = path.join(REPO_ROOT, 'server', 'utils.ts');
const CANONICAL_WASH_PRICE_FILE = path.join(
  REPO_ROOT,
  'server',
  'services',
  'K9000RedemptionService.ts',
);

// Subdirs we DO NOT scan (build artefacts, tests, generated, vendored).
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  '.cache',
  '.claude',
  'coverage',
  'tests',          // tests deliberately reference 0.18 / 5500 as fixtures
  '__tests__',
  'attached_assets',
  'uploads',
]);

const SKIP_FILE_SUFFIXES = ['.d.ts', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

/** Scan-result row for one offending site. */
export interface DuplicateFinding {
  category: 'vat_rate' | 'wash_price_cents' | 'wash_package_price' | 'env_fallback';
  file: string;          // repo-relative
  line: number;
  snippet: string;       // the offending line, trimmed
  message: string;
}

/* ────────────────────────────────────────────────────────────── *
 * File-collection
 * ────────────────────────────────────────────────────────────── */

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      collectTsFiles(path.join(dir, entry.name), acc);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      if (SKIP_FILE_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

/* ────────────────────────────────────────────────────────────── *
 * Detectors
 * ────────────────────────────────────────────────────────────── */

/**
 * VAT rate duplicates: any top-level `(?:export )?const NAME = 0.18` where
 * NAME contains VAT/RATE, OR any `0.18` literal in a `vatRate:` object key,
 * EXCEPT the canonical file.
 */
/** Strip `// …` line-comment tail and trim, so the literal-detector ignores
 *  human-written documentation that happens to mention 0.18. */
function stripLineComment(ln: string): string {
  // Quick-and-dirty: cut at the first `//` not inside a string literal.
  // Good enough for this audit; full lexer overkill.
  let inStr: '"' | "'" | '`' | null = null;
  for (let i = 0; i < ln.length - 1; i++) {
    const c = ln[i];
    if (inStr) {
      if (c === inStr && ln[i - 1] !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c as any;
    } else if (c === '/' && ln[i + 1] === '/') {
      return ln.slice(0, i);
    }
  }
  return ln;
}

function detectVatRate(file: string, lines: string[]): DuplicateFinding[] {
  if (file === CANONICAL_VAT_FILE) return [];
  const out: DuplicateFinding[] = [];
  const declRegex =
    /^\s*(?:export\s+)?(?:const|let)\s+(\w*VAT\w*|\w*Vat\w*|VAT_RATE|vatRate|ISRAEL_VAT_RATE|ISRAELI_VAT_RATE)\s*=\s*0\.18\b/;
  const inlineRegex = /(?<![\w.])0\.18(?![\d])/;
  const vatContextRegex = /vat|VAT/;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    const code = stripLineComment(raw); // ignore documentation tails
    if (declRegex.test(code)) {
      out.push({
        category: 'vat_rate',
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: trimmed,
        message: 'duplicate VAT-rate constant — import from shared/israel-compliance-config.ts',
      });
      continue;
    }
    if (inlineRegex.test(code) && vatContextRegex.test(code)) {
      if (/ISRAEL_VAT_RATE\b/.test(code)) continue;
      out.push({
        category: 'vat_rate',
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: trimmed,
        message: 'inline 0.18 in VAT context — replace with ISRAEL_VAT_RATE import',
      });
    }
  }
  return out;
}

/**
 * Wash price (in cents): the K9000 wash price is 5500 (₪55.00). Outside the
 * canonical K9000RedemptionService.ts, every `5500` literal in a wash/k9000
 * context should reference WASH_PRICE_ILS_CENTS.
 */
function detectWashPriceCents(file: string, lines: string[]): DuplicateFinding[] {
  if (file === CANONICAL_WASH_PRICE_FILE) return [];
  const out: DuplicateFinding[] = [];
  const ctxRegex = /(wash|K9000|kiosk|loyalty_wash|redem)/i;
  const litRegex = /(?<![\w.])5500(?![\d])/;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    const code = stripLineComment(raw);
    if (litRegex.test(code) && ctxRegex.test(code)) {
      if (/WASH_PRICE_ILS_CENTS\b/.test(code)) continue;
      out.push({
        category: 'wash_price_cents',
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: trimmed,
        message:
          'inline 5500 in wash/K9000 context — import WASH_PRICE_ILS_CENTS from server/services/K9000RedemptionService.ts',
      });
    }
  }
  return out;
}

/**
 * Wash package prices ('55.00', '150.00', '220.00', '440.00') hard-coded
 * outside the canonical seed.
 */
function detectWashPackagePrice(file: string, lines: string[]): DuplicateFinding[] {
  if (file === CANONICAL_WASH_SEED_FILE) return [];
  const out: DuplicateFinding[] = [];
  const litRegex = /['"](55\.00|150\.00|220\.00|440\.00)['"]/;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    const m = ln.match(litRegex);
    if (m) {
      out.push({
        category: 'wash_package_price',
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: trimmed,
        message: `wash-package price literal '${m[1]}' duplicated — derive from createWashPackageData (server/utils.ts)`,
      });
    }
  }
  return out;
}

/**
 * `process.env.VAT_RATE || '0.18'` env-fallback drift. Should always resolve
 * to `String(ISRAEL_VAT_RATE)` after PR-W13.
 */
function detectEnvFallback(file: string, lines: string[]): DuplicateFinding[] {
  const out: DuplicateFinding[] = [];
  const re = /process\.env\.VAT_RATE\s*\|\|\s*['"]0\.18['"]/;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      out.push({
        category: 'env_fallback',
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: lines[i].trim(),
        message: "env fallback uses bare '0.18' — replace with String(ISRAEL_VAT_RATE)",
      });
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────── *
 * Public scanner
 * ────────────────────────────────────────────────────────────── */

export function scanRepo(): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  const files = [
    ...collectTsFiles(path.join(REPO_ROOT, 'server')),
    ...collectTsFiles(path.join(REPO_ROOT, 'shared')),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    findings.push(
      ...detectVatRate(file, lines),
      ...detectWashPriceCents(file, lines),
      ...detectWashPackagePrice(file, lines),
      ...detectEnvFallback(file, lines),
    );
  }
  return findings;
}

/* ────────────────────────────────────────────────────────────── *
 * CLI entry
 * ────────────────────────────────────────────────────────────── */

function main(): void {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const strict = args.includes('--strict');

  const findings = scanRepo();

  if (asJson) {
    process.stdout.write(JSON.stringify({ count: findings.length, findings }, null, 2) + '\n');
  } else {
    if (findings.length === 0) {
      console.log('✅ No duplicate constants detected. Single-source-of-truth invariant holds.');
    } else {
      console.log(`⚠️  ${findings.length} duplicate-constant findings:\n`);
      const grouped: Record<string, DuplicateFinding[]> = {};
      for (const f of findings) {
        (grouped[f.category] ||= []).push(f);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        console.log(`── ${cat} (${items.length}) ──`);
        for (const it of items) {
          console.log(`  ${it.file}:${it.line}`);
          console.log(`    ${it.snippet}`);
          console.log(`    → ${it.message}`);
        }
        console.log();
      }
    }
  }

  if (strict && findings.length > 0) process.exit(1);
}

// CLI guard: only run main() when invoked directly (not when imported by tests).
// Works in both CJS (require.main) and ESM (process.argv[1] === this file).
const invokedDirectly =
  process.argv[1] === __filename ||
  process.argv[1]?.endsWith('audit-duplicate-constants.ts');
if (invokedDirectly) {
  main();
}
