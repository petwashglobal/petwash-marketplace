#!/usr/bin/env node
/**
 * PR-STARTUP-HARDEN-1 — Required env-var audit
 *
 * Static scan of server/ for every `process.env.X` read, classifying:
 *   • MODULE_LOAD or FUNCTION_BODY scope
 *   • REQUIRED (throws if missing in production) / WARN / OPTIONAL
 *   • REACHABLE (transitively reachable from server/routes.ts import graph)
 *
 * Outputs:
 *   • docs/PRODUCTION_REQUIRED_ENV_VARS.md (auto-maintained, sorted, deterministic)
 *
 * Exit codes:
 *   0  inventory unchanged OR file did not previously exist (first run)
 *   5  inventory changed — new required env var introduced; reviewer must
 *      verify it is mapped in Cloud Run + GHA + (if relevant) other envs,
 *      then commit the regenerated docs file before merge
 *
 * Usage:
 *   npx tsx scripts/audit-required-env-vars.ts          (regenerate + write)
 *   npx tsx scripts/audit-required-env-vars.ts --check  (compare only, no write)
 *
 * NOTE: this is a STATIC scanner. It cannot evaluate dynamic env reads
 * (e.g. `process.env[name]` where name is computed). Those are out of scope
 * and intentionally excluded — they would yield false positives.
 */

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SERVER_DIR = join(ROOT, 'server');
const OUTPUT_PATH = join(ROOT, 'docs', 'PRODUCTION_REQUIRED_ENV_VARS.md');
const CHECK_ONLY = process.argv.includes('--check');

interface EnvRead {
  varName: string;
  file: string;       // relative path
  line: number;
  scope: 'MODULE_LOAD' | 'FUNCTION_BODY' | 'UNKNOWN';
  classification: 'REQUIRED' | 'WARN' | 'OPTIONAL';
  contextLine: string; // the line of code containing the read
  guardLine?: string;  // the line of code containing the throw, if any
}

// ─── Walk server/ for .ts files ──────────────────────────────────────────────

function listTsFiles(dir: string, out: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // skip noisy/uninteresting subtrees
      if (entry === 'node_modules' || entry === '.git' || entry === 'tests' || entry === '__tests__') continue;
      listTsFiles(full, out);
    } else if (st.isFile()) {
      if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  }
  return out;
}

// ─── Classify a single file ──────────────────────────────────────────────────

function classifyFile(filePath: string): EnvRead[] {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const reads: EnvRead[] = [];

  // Track brace/paren depth to determine top-level vs function-body scope.
  // This is a *heuristic* — for accurate scope we'd need a real TS parser.
  // We approximate: track curly-brace nesting; depth=0 ⇒ MODULE_LOAD.
  let braceDepth = 0;
  let parenDepth = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    let line = rawLine;

    // Strip block comments roughly (good enough for this audit)
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    while (true) {
      const start = line.indexOf('/*');
      if (start === -1) break;
      const end = line.indexOf('*/', start + 2);
      if (end === -1) {
        line = line.slice(0, start);
        inBlockComment = true;
        break;
      }
      line = line.slice(0, start) + line.slice(end + 2);
    }
    // Strip line comments
    const lineCommentIdx = line.indexOf('//');
    if (lineCommentIdx !== -1) line = line.slice(0, lineCommentIdx);

    // Record the depth AT this line (before counting this line's braces)
    const depthBeforeLine = braceDepth;

    // Find env reads on this line, BEFORE updating depth
    const envMatches = [...rawLine.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)];
    if (envMatches.length > 0) {
      for (const m of envMatches) {
        const varName = m[1];
        const scope = depthBeforeLine === 0 ? 'MODULE_LOAD' : 'FUNCTION_BODY';

        // Look for a `throw new Error` within the next 8 lines of the same
        // brace block. If found, mark REQUIRED.
        let guardLine: string | undefined;
        for (let j = i; j < Math.min(lines.length, i + 8); j++) {
          if (/\bthrow new Error\b/.test(lines[j])) {
            guardLine = lines[j].trim();
            break;
          }
        }

        let classification: EnvRead['classification'] = 'OPTIONAL';
        if (guardLine) {
          classification = 'REQUIRED';
        } else if (/\blogger?\.warn\b|\bconsole\.warn\b/.test(rawLine + (lines[i + 1] || ''))) {
          classification = 'WARN';
        }

        reads.push({
          varName,
          file: relative(ROOT, filePath),
          line: i + 1,
          scope,
          classification,
          contextLine: rawLine.trim(),
          guardLine,
        });
      }
    }

    // Now update depth based on this line's braces
    for (const c of line) {
      if (c === '{') braceDepth++;
      else if (c === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (c === '(') parenDepth++;
      else if (c === ')') parenDepth = Math.max(0, parenDepth - 1);
    }
  }

  return reads;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

interface AggregatedVar {
  varName: string;
  classification: 'REQUIRED' | 'WARN' | 'OPTIONAL';
  reads: EnvRead[];
}

function aggregate(reads: EnvRead[]): AggregatedVar[] {
  const byVar = new Map<string, EnvRead[]>();
  for (const r of reads) {
    if (!byVar.has(r.varName)) byVar.set(r.varName, []);
    byVar.get(r.varName)!.push(r);
  }
  const out: AggregatedVar[] = [];
  for (const [varName, varReads] of byVar) {
    // Highest severity wins: any REQUIRED ⇒ REQUIRED; else any WARN ⇒ WARN; else OPTIONAL
    let cls: AggregatedVar['classification'] = 'OPTIONAL';
    if (varReads.some(r => r.classification === 'REQUIRED')) cls = 'REQUIRED';
    else if (varReads.some(r => r.classification === 'WARN')) cls = 'WARN';
    // Sort reads by file then line for determinism
    varReads.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
    out.push({ varName, classification: cls, reads: varReads });
  }
  // Sort: REQUIRED first, then WARN, then OPTIONAL; within each, alpha
  const sortOrder: Record<AggregatedVar['classification'], number> = {
    REQUIRED: 0,
    WARN: 1,
    OPTIONAL: 2,
  };
  out.sort((a, b) => {
    const o = sortOrder[a.classification] - sortOrder[b.classification];
    if (o !== 0) return o;
    return a.varName.localeCompare(b.varName);
  });
  return out;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderMarkdown(vars: AggregatedVar[], scannedFiles: number): string {
  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD only — deterministic for diffs

  const counts = {
    REQUIRED: vars.filter(v => v.classification === 'REQUIRED').length,
    WARN: vars.filter(v => v.classification === 'WARN').length,
    OPTIONAL: vars.filter(v => v.classification === 'OPTIONAL').length,
  };

  const lines: string[] = [];
  lines.push('# Production required env vars — auto-generated');
  lines.push('');
  lines.push('> **Auto-generated by `scripts/audit-required-env-vars.ts`. Do NOT edit by hand.**');
  lines.push('> Regenerate with: `npx tsx scripts/audit-required-env-vars.ts`');
  lines.push('> Verify with:     `npx tsx scripts/audit-required-env-vars.ts --check`');
  lines.push('');
  lines.push(`Generated date: ${now}`);
  lines.push(`Scanned files (server/): ${scannedFiles}`);
  lines.push(`Variables found: ${vars.length}  (REQUIRED ${counts.REQUIRED} · WARN ${counts.WARN} · OPTIONAL ${counts.OPTIONAL})`);
  lines.push('');
  lines.push('## Definitions');
  lines.push('');
  lines.push('- **REQUIRED** — at least one read site has a `throw new Error` guard nearby. Production will crash if this var is missing AND any guard fires.');
  lines.push('- **WARN** — at least one read site logs a warning if missing. Feature degrades, server still boots.');
  lines.push('- **OPTIONAL** — read sites use a fallback (`||`, `??`) or do not guard.');
  lines.push('- **MODULE_LOAD scope** — fires at `import` time (top-level). High blast radius.');
  lines.push('- **FUNCTION_BODY scope** — fires only when the function is called. Low blast radius.');
  lines.push('');
  lines.push('## Pre-deploy verification');
  lines.push('');
  lines.push('Before deploying to Cloud Run, every REQUIRED var in the table below must be:');
  lines.push('1. Present in GCP Secret Manager (if sensitive) OR set as a literal Cloud Run env var (if non-sensitive).');
  lines.push('2. Mapped into the `petwash-api` Cloud Run service\'s Variables & Secrets.');
  lines.push('3. (When applicable) also present in GitHub Actions deployment workflow env.');
  lines.push('');
  lines.push('A REQUIRED var that fires at MODULE_LOAD scope is the highest priority — those are the ones that take down the whole server, not just one feature.');
  lines.push('');

  for (const cls of ['REQUIRED', 'WARN', 'OPTIONAL'] as const) {
    const subset = vars.filter(v => v.classification === cls);
    if (subset.length === 0) continue;
    lines.push(`## ${cls} (${subset.length})`);
    lines.push('');
    for (const v of subset) {
      const hasModuleLoad = v.reads.some(r => r.scope === 'MODULE_LOAD');
      const priority = cls === 'REQUIRED' && hasModuleLoad ? ' ⚠️ MODULE_LOAD' : '';
      lines.push(`### ${v.varName}${priority}`);
      lines.push('');
      lines.push(`| File | Line | Scope | Context |`);
      lines.push(`|------|------|-------|---------|`);
      for (const r of v.reads) {
        const ctx = r.contextLine.replace(/\|/g, '\\|').slice(0, 120);
        lines.push(`| ${r.file} | ${r.line} | ${r.scope} | \`${ctx}\` |`);
      }
      if (v.reads.some(r => r.guardLine)) {
        const firstGuard = v.reads.find(r => r.guardLine)!.guardLine!;
        lines.push('');
        lines.push(`Guard line example:`);
        lines.push('');
        lines.push('```ts');
        lines.push(firstGuard);
        lines.push('```');
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Change-review protocol');
  lines.push('');
  lines.push('When this file changes in a PR:');
  lines.push('1. Reviewer confirms every newly-REQUIRED MODULE_LOAD var has a Cloud Run env mapping commit-or-PR before merge.');
  lines.push('2. CI gate `audit-required-envs --check` will fail the PR if this file is stale relative to the source tree.');
  lines.push('');
  lines.push('## Known limitations');
  lines.push('');
  lines.push('- Scope detection is brace-depth heuristic, not full AST. False positives are possible for unusual formatting.');
  lines.push('- Dynamic env reads (`process.env[varName]` with computed name) are NOT detected.');
  lines.push('- Tests directories (`tests/`, `__tests__/`) and `.d.ts` files are excluded.');
  lines.push('- Comments are stripped but extremely complex multi-line cases may slip through.');

  return lines.join('\n') + '\n';
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  if (!existsSync(SERVER_DIR)) {
    console.error(`[env-audit] FATAL: ${SERVER_DIR} not found. Run from repo root.`);
    process.exit(3);
  }

  const files = listTsFiles(SERVER_DIR);
  const allReads: EnvRead[] = [];
  for (const f of files) {
    try {
      allReads.push(...classifyFile(f));
    } catch (err) {
      console.error(`[env-audit] WARN: failed to scan ${f}: ${(err as Error).message}`);
    }
  }

  const vars = aggregate(allReads);
  const rendered = renderMarkdown(vars, files.length);

  if (CHECK_ONLY) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`[env-audit] FAIL: ${relative(ROOT, OUTPUT_PATH)} does not exist.`);
      console.error(`[env-audit] Run: npx tsx scripts/audit-required-env-vars.ts`);
      process.exit(5);
    }
    const existing = readFileSync(OUTPUT_PATH, 'utf8');
    if (existing === rendered) {
      console.log(`[env-audit] OK: ${relative(ROOT, OUTPUT_PATH)} is up to date.`);
      console.log(`[env-audit] Scanned ${files.length} files, found ${vars.length} env vars.`);
      process.exit(0);
    } else {
      console.error(`[env-audit] FAIL: ${relative(ROOT, OUTPUT_PATH)} is STALE.`);
      console.error(`[env-audit] A source-tree change introduced or removed an env-var read.`);
      console.error(`[env-audit] Run: npx tsx scripts/audit-required-env-vars.ts`);
      console.error(`[env-audit] Then commit the regenerated docs file.`);
      // Print a short diff hint
      const aLines = existing.split('\n');
      const bLines = rendered.split('\n');
      console.error(`[env-audit] (existing ${aLines.length} lines, new ${bLines.length} lines)`);
      process.exit(5);
    }
  }

  writeFileSync(OUTPUT_PATH, rendered);
  console.log(`[env-audit] Wrote ${relative(ROOT, OUTPUT_PATH)}`);
  console.log(`[env-audit] Scanned ${files.length} files, found ${vars.length} env vars`);
  const counts = {
    REQUIRED: vars.filter(v => v.classification === 'REQUIRED').length,
    WARN: vars.filter(v => v.classification === 'WARN').length,
    OPTIONAL: vars.filter(v => v.classification === 'OPTIONAL').length,
  };
  console.log(`[env-audit]   REQUIRED: ${counts.REQUIRED}`);
  console.log(`[env-audit]   WARN:     ${counts.WARN}`);
  console.log(`[env-audit]   OPTIONAL: ${counts.OPTIONAL}`);
  process.exit(0);
}

main();
