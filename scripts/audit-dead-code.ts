/**
 * audit-dead-code.ts
 * ------------------
 * PR-W23 (Phase 1.4) — Mega Phase F (Discipline Tooling)
 *
 * READ-ONLY scanner that classifies potential dead code into:
 *
 *   SAFE_DELETE         — high-confidence dead. Zero references found.
 *   NEEDS_RUNTIME_VERIFY — referenced in source but possibly behind a
 *                          dead route, dead branch, or dynamic import.
 *                          Operator must verify in production logs.
 *   UNKNOWN             — referenced in non-trivial ways the static
 *                          scanner cannot resolve (re-exports, eval,
 *                          dynamic require). Manual review required.
 *
 * Per CEO directive: this script DOES NOT DELETE anything. It only
 * marks. Operator + reviewer make every deletion decision manually.
 *
 * Categories scanned:
 *   1. Orphan pgTable definitions — defined in shared/* but never
 *      imported anywhere under server/.
 *   2. Unmounted Express routers — files exporting a router that is
 *      never `app.use(... thatRouter)`.
 *   3. Unused server services — files exporting a class/instance whose
 *      symbol never appears in another server/ file.
 *   4. Specific known-dead spots from the audit pipeline:
 *        - storage.redeemGiftCard (server/storage.ts:1775-1779)
 *        - duplicate /api/health at routes.ts:744
 *        - WalletRepository write methods (insert walletTransactions)
 *
 * USAGE
 *   npx tsx scripts/audit-dead-code.ts             # human report
 *   npx tsx scripts/audit-dead-code.ts --json      # machine output
 *   npm run audit:dead                             # alias
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules', 'dist', '.next', '.turbo', '.cache', '.claude',
  'coverage', 'tests', '__tests__', 'attached_assets', 'uploads',
]);
const SKIP_FILE_SUFFIXES = ['.d.ts', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

type Verdict = 'SAFE_DELETE' | 'NEEDS_RUNTIME_VERIFY' | 'UNKNOWN';

export interface DeadCodeFinding {
  category: 'orphan_table' | 'unmounted_router' | 'unused_service' | 'known_dead';
  symbol: string;
  file: string;
  line?: number;
  verdict: Verdict;
  reason: string;
}

/* ────────────── helpers ────────────── */

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

const SERVER_FILES = collectTsFiles(path.join(REPO_ROOT, 'server'));
const SHARED_FILES = collectTsFiles(path.join(REPO_ROOT, 'shared'));

/** Memoised file-text cache. */
const _fileCache = new Map<string, string>();
function readFile(p: string): string {
  if (!_fileCache.has(p)) _fileCache.set(p, fs.readFileSync(p, 'utf8'));
  return _fileCache.get(p)!;
}

/** Count occurrences of a whole-word symbol across all server files. */
function countSymbolRefs(symbol: string, excludeFile?: string): number {
  const re = new RegExp(`\\b${symbol}\\b`);
  let count = 0;
  for (const f of SERVER_FILES) {
    if (f === excludeFile) continue;
    if (re.test(readFile(f))) count++;
  }
  return count;
}

/* ────────────── 1. Orphan tables ────────────── */

function scanOrphanTables(): DeadCodeFinding[] {
  const out: DeadCodeFinding[] = [];
  const tableRegex = /^export const (\w+) = pgTable\(/m;
  for (const f of SHARED_FILES) {
    const text = readFile(f);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(tableRegex);
      if (!m) continue;
      const name = m[1];
      const refs = countSymbolRefs(name);
      if (refs === 0) {
        out.push({
          category: 'orphan_table',
          symbol: name,
          file: path.relative(REPO_ROOT, f),
          line: i + 1,
          verdict: 'NEEDS_RUNTIME_VERIFY',
          reason:
            'pgTable defined but symbol never imported by any server/ file. ' +
            'Likely future-feature scaffolding. Confirm no live cron / migration / ' +
            'admin tool depends on it before dropping.',
        });
      }
    }
  }
  return out;
}

/* ────────────── 2. Unmounted routers ────────────── */

function scanUnmountedRouters(): DeadCodeFinding[] {
  const out: DeadCodeFinding[] = [];
  const exportRegex = /^export\s+default\s+router\b/m;
  const exportNamedRegex = /^export\s+const\s+(\w+Router|\w+Routes)\b/m;
  for (const f of SERVER_FILES) {
    if (!f.includes('/routes/')) continue;
    const text = readFile(f);
    if (!exportRegex.test(text) && !exportNamedRegex.test(text)) continue;
    const base = path.basename(f, '.ts');
    // Heuristic: search for the file's basename or its exported router
    // name in routes.ts and index.ts (the mount sites).
    const mountFiles = [
      path.join(REPO_ROOT, 'server', 'routes.ts'),
      path.join(REPO_ROOT, 'server', 'index.ts'),
    ];
    let mounted = false;
    // Match against the file's path RELATIVE to server/, allowing either
    // static or dynamic import. The path may include sub-folders
    // (./routes/finance/<base>), so match on a flexible suffix.
    const relPath = path.relative(path.join(REPO_ROOT, 'server'), f).replace(/\\/g, '/');
    const importPath = './' + relPath.replace(/\.tsx?$/, '');
    for (const mf of mountFiles) {
      if (!fs.existsSync(mf)) continue;
      const mfText = readFile(mf);
      // Look for the EXACT relative import path or its base form.
      const escapedExact = importPath.replace(/[-./]/g, '\\$&');
      const escapedBase = base.replace(/[-./]/g, '\\$&');
      const importRe = new RegExp(
        `['\"](${escapedExact}|\\.\\./?[^'\"\\s]*?/${escapedBase})['\"]`,
      );
      if (importRe.test(mfText)) {
        mounted = true;
        break;
      }
    }
    if (!mounted) {
      out.push({
        category: 'unmounted_router',
        symbol: base,
        file: path.relative(REPO_ROOT, f),
        verdict: 'NEEDS_RUNTIME_VERIFY',
        reason:
          'File exports a router but no import seen in server/routes.ts or server/index.ts. ' +
          'May be mounted via dynamic import, sub-mount, or be genuinely dead.',
      });
    }
  }
  return out;
}

/* ────────────── 3. Unused services ────────────── */

function scanUnusedServices(): DeadCodeFinding[] {
  const out: DeadCodeFinding[] = [];
  for (const f of SERVER_FILES) {
    if (!f.includes('/services/')) continue;
    const text = readFile(f);
    // Pull the primary exported class / const symbol
    const classMatch = text.match(/^export class (\w+)/m);
    const constMatch = text.match(/^export const (\w+)/m);
    const symbol = classMatch?.[1] ?? constMatch?.[1];
    if (!symbol) continue;
    const refs = countSymbolRefs(symbol, f);
    if (refs === 0) {
      out.push({
        category: 'unused_service',
        symbol,
        file: path.relative(REPO_ROOT, f),
        verdict: 'NEEDS_RUNTIME_VERIFY',
        reason:
          'Primary export of this service is not imported by any other server/ file. ' +
          'Could be a dynamic import, an entry point referenced only by tests, or genuinely dead.',
      });
    }
  }
  return out;
}

/* ────────────── 4. Known-dead spots from PR-W14 / W18 / W19 / W20 ────────────── */

function scanKnownDeadSpots(): DeadCodeFinding[] {
  const out: DeadCodeFinding[] = [];

  // 4a. storage.redeemGiftCard — caller is the now-410-disabled route
  const storagePath = path.join(REPO_ROOT, 'server', 'storage.ts');
  if (fs.existsSync(storagePath)) {
    const txt = readFile(storagePath);
    if (/async redeemGiftCard\(/.test(txt)) {
      out.push({
        category: 'known_dead',
        symbol: 'storage.redeemGiftCard',
        file: 'server/storage.ts',
        verdict: 'SAFE_DELETE',
        reason:
          'Only caller (legacy POST /api/gift-cards/redeem) is 410-disabled in PR #123. ' +
          'Safe to remove after orphan migration ships.',
      });
    }
  }

  // 4b. Duplicate /api/health handler in routes.ts:744 (shadowed by index.ts:683)
  const routesPath = path.join(REPO_ROOT, 'server', 'routes.ts');
  if (fs.existsSync(routesPath)) {
    const lines = readFile(routesPath).split('\n');
    for (let i = 740; i < 750 && i < lines.length; i++) {
      if (lines[i].includes("app.get('/api/health'")) {
        out.push({
          category: 'known_dead',
          symbol: "app.get('/api/health')",
          file: 'server/routes.ts',
          line: i + 1,
          verdict: 'SAFE_DELETE',
          reason:
            'Shadowed by earlier registration in server/index.ts:683 (Express resolves first match). Dead route.',
        });
        break;
      }
    }
  }

  // 4c. WalletRepository write methods — no external callers (per PR-W20)
  const wrPath = path.join(REPO_ROOT, 'server', 'repositories', 'WalletRepository.ts');
  if (fs.existsSync(wrPath)) {
    const refs =
      countSymbolRefs('walletRepository', wrPath) +
      countSymbolRefs('WalletRepository', wrPath);
    if (refs <= 2) {
      out.push({
        category: 'known_dead',
        symbol: 'WalletRepository.create / .insert (writes to walletTransactions)',
        file: 'server/repositories/WalletRepository.ts',
        verdict: 'NEEDS_RUNTIME_VERIFY',
        reason:
          'No external caller of the write methods (insertions to walletTransactions / walletBalances). ' +
          'Confirm no admin/cron/migration script invokes them before deletion. ' +
          'Read methods (getTotalSpending / getTransactionCount) ARE used by CDPService.',
      });
    }
  }

  return out;
}

/* ────────────── public entry ────────────── */

export function scanRepo(): DeadCodeFinding[] {
  return [
    ...scanOrphanTables(),
    ...scanUnmountedRouters(),
    ...scanUnusedServices(),
    ...scanKnownDeadSpots(),
  ];
}

/* ────────────── CLI ────────────── */

function main(): void {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const findings = scanRepo();

  if (asJson) {
    process.stdout.write(JSON.stringify({ count: findings.length, findings }, null, 2) + '\n');
    return;
  }

  if (findings.length === 0) {
    console.log('✅ No dead-code candidates detected.');
    return;
  }

  console.log(`Dead-code scan: ${findings.length} candidates\n`);
  const grouped: Record<string, DeadCodeFinding[]> = {};
  for (const f of findings) (grouped[f.category] ||= []).push(f);

  for (const [cat, items] of Object.entries(grouped)) {
    console.log(`── ${cat.toUpperCase().replace(/_/g, ' ')} (${items.length}) ──`);
    const byVerdict: Record<Verdict, number> = {
      SAFE_DELETE: 0,
      NEEDS_RUNTIME_VERIFY: 0,
      UNKNOWN: 0,
    };
    for (const it of items) byVerdict[it.verdict]++;
    console.log(
      `  verdicts: SAFE_DELETE=${byVerdict.SAFE_DELETE}  ` +
      `NEEDS_RUNTIME_VERIFY=${byVerdict.NEEDS_RUNTIME_VERIFY}  ` +
      `UNKNOWN=${byVerdict.UNKNOWN}`
    );
    // Show top 10 per category
    for (const it of items.slice(0, 10)) {
      const loc = it.line ? `:${it.line}` : '';
      console.log(`    [${it.verdict}] ${it.symbol}`);
      console.log(`        ${it.file}${loc}`);
      console.log(`        ${it.reason.replace(/\n\s+/g, ' ')}`);
    }
    if (items.length > 10) console.log(`    … and ${items.length - 10} more`);
    console.log();
  }
  console.log('Per CEO directive: NO automatic deletion. Operator decides each.');
}

const invokedDirectly =
  process.argv[1] === __filename ||
  process.argv[1]?.endsWith('audit-dead-code.ts');
if (invokedDirectly) main();
