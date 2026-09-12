#!/usr/bin/env node
/**
 * EVERY PIN RUNS, OR IT IS NOT A PIN.
 *
 * 2026-09-13 audit: server/tests held 782 test files; the PR gates ran an
 * explicit list of ~115 of them (money-safety-gate.yml + package.json
 * test:money). Everything else — including ~50 regression pins written in
 * the week of 2026-09-12 (wallet pass sync, ONE member id, consent gate,
 * K9000 redemption fiscal, Cortina hardening, provider declarations…) — ran
 * once on the author's machine and never again. That is the mechanism behind
 * "little bugs always escaping": the pin exists, CI never asks it.
 *
 * This runs the WHOLE vitest suite and fails the PR when a test FILE fails
 * that is not in the frozen red baseline (scripts/ci/pins_red_baseline.txt —
 * the files that were already red on main the day this gate landed; each has
 * a reason). A baseline entry that turns green is reported so it can be
 * removed. Same discipline as scripts/guards/no_new_unreachable_route.py.
 *
 * Usage: node scripts/ci/pins_with_baseline.mjs [--update-baseline]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..');
const BASELINE = resolve(ROOT, 'scripts', 'ci', 'pins_red_baseline.txt');
const OUT = resolve(ROOT, '.vitest-pins.json');
const update = process.argv.includes('--update-baseline');

function readBaseline() {
  if (!existsSync(BASELINE)) return new Map();
  const m = new Map();
  for (const raw of readFileSync(BASELINE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [file, ...why] = line.split(/\s+#\s*/);
    m.set(file.trim(), why.join(' # ').trim());
  }
  return m;
}

const run = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${OUT}`, '--silent'], {
  cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CI: 'true' },
});
if (!existsSync(OUT)) {
  console.error('pins gate: vitest produced no JSON report (exit ' + run.status + ')');
  process.exit(2);
}
const report = JSON.parse(readFileSync(OUT, 'utf8'));
const rel = (p) => p.replace(ROOT + '/', '');
const red = report.testResults.filter((t) => t.status !== 'passed' && t.status !== 'skipped').map((t) => rel(t.name)).sort();
const green = new Set(report.testResults.filter((t) => t.status === 'passed').map((t) => rel(t.name)));

const baseline = readBaseline();
if (update) {
  mkdirSync(resolve(ROOT, 'scripts', 'ci'), { recursive: true });
  const lines = ['# Test FILES that were already red on main when the pins gate landed (2026-09-13).',
    '# One per line, "path  # reason". Remove a line once its file is green. NEVER add a file',
    '# to this list to get a PR through — fix the test or the code.', ''];
  for (const f of red) lines.push(`${f}  # ${baseline.get(f) ?? 'red on main at gate landing'}`);
  writeFileSync(BASELINE, lines.join('\n') + '\n');
  console.log(`pins gate: baseline written with ${red.length} red files`);
  process.exit(0);
}

const newRed = red.filter((f) => !baseline.has(f));
const healed = [...baseline.keys()].filter((f) => green.has(f));
const missing = [...baseline.keys()].filter((f) => !green.has(f) && !red.includes(f));

console.log(`pins gate: ${report.numTotalTestSuites} files, ${report.numTotalTests} tests, ${red.length} red files (${baseline.size} baselined)`);
if (healed.length) console.log(`pins gate: ${healed.length} baselined file(s) are GREEN now — remove them from ${rel(BASELINE)}:\n  ` + healed.join('\n  '));
if (missing.length) console.log(`pins gate: ${missing.length} baselined file(s) no longer exist — remove them:\n  ` + missing.join('\n  '));
if (newRed.length) {
  console.error(`\npins gate: ${newRed.length} test file(s) are RED and not in the baseline:\n  ` + newRed.join('\n  '));
  // Print WHY. The suite runs --silent (a full-suite log is unreadable), so
  // without this the operator sees a filename and nothing else and has to
  // reproduce locally — where an environment-dependent failure will not
  // reproduce at all. The JSON reporter already carries the messages.
  for (const file of newRed) {
    const suite = report.testResults.find((t) => rel(t.name) === file);
    console.error(`\n──── ${file}`);
    if (suite?.message) console.error(String(suite.message).split('\n').slice(0, 12).join('\n'));
    for (const a of suite?.assertionResults ?? []) {
      if (a.status !== 'failed') continue;
      console.error(`  ✗ ${a.fullName || a.title}`);
      for (const m of (a.failureMessages ?? []).slice(0, 1)) {
        console.error('    ' + String(m).split('\n').slice(0, 10).join('\n    '));
      }
    }
  }
  console.error('\nFix the code or the pin. Do not add to the baseline.');
  process.exit(1);
}
console.log('pins gate: OK — no new red test file.');
