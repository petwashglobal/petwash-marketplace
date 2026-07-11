#!/usr/bin/env node
/**
 * SendGrid direct-send ratchet gate (P0 queue #148 "PR-EMAIL-LAST").
 *
 * Every customer email should go through `sendGuardedEmail()` in
 * server/lib/guarded-sendgrid.ts so it passes the EmailSpendGuard (per-recipient
 * + global spend caps). A raw `sgMail.send(...)` bypasses that guard — a real
 * cost / abuse risk (see the cost-control principle: pay only for musts).
 *
 * A full migration of the ~14 legacy call sites is risky (could break live
 * emails), so instead this gate BASELINES the current direct-send files and
 * fails only when a NEW file introduces `sgMail.send(`. As legacy sites are
 * migrated to sendGuardedEmail(), remove them from the baseline to ratchet down.
 *
 * Baseline: server/lib/sendgrid-direct-baseline.txt (one repo-relative path/line).
 * Runs on PRs via .github/workflows/sendgrid-guard-gate.yml. No deps (pure Node).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, 'server');
const BASELINE_FILE = join(ROOT, 'server/lib/sendgrid-direct-baseline.txt');
const NEEDLE = 'sgMail.send(';

/** Recursively collect .ts files under dir, skipping tests + node_modules. */
function collectTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'tests' || entry === '__tests__') continue;
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function loadBaseline() {
  try {
    return new Set(
      readFileSync(BASELINE_FILE, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    );
  } catch {
    return new Set();
  }
}

const baseline = loadBaseline();
const current = new Set();
for (const file of collectTsFiles(SCAN_DIR)) {
  const text = readFileSync(file, 'utf8');
  if (text.includes(NEEDLE)) current.add(relative(ROOT, file));
}

const added = [...current].filter((f) => !baseline.has(f)).sort();
const removed = [...baseline].filter((f) => !current.has(f)).sort();

if (removed.length) {
  console.log(
    `ℹ️  ${removed.length} baseline file(s) no longer call sgMail.send() directly — ` +
      `remove them from server/lib/sendgrid-direct-baseline.txt to ratchet the gate down:`,
  );
  for (const f of removed) console.log(`   - ${f}`);
  console.log('');
}

if (added.length) {
  console.error('::error title=New unguarded sgMail.send()::' + added.join(', '));
  console.error('');
  console.error('🛑 New direct sgMail.send(...) call(s) detected — these bypass the EmailSpendGuard:');
  for (const f of added) console.error(`   - ${f}`);
  console.error('');
  console.error('Fix: send via sendGuardedEmail() from server/lib/guarded-sendgrid.ts instead of');
  console.error('calling sgMail.send() directly. If a direct send is genuinely required (e.g. the');
  console.error('guard internals), add the file to server/lib/sendgrid-direct-baseline.txt with a note.');
  process.exit(1);
}

console.log(`✅ No new unguarded sgMail.send() call sites (${current.size} baselined, 0 new).`);
