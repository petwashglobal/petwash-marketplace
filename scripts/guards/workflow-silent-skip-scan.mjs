#!/usr/bin/env node
/**
 * Find jobs that will SILENTLY SKIP.
 *
 * THE BUG THIS GENERALISES. deploy-frontend had `needs: deploy-backend` and no
 * `if`, so it defaulted to success(). A SKIPPED job anywhere in the transitive
 * needs graph skips every downstream job using that default — and
 * apply-migrations is skipped on any deploy that is not a workflow_dispatch or
 * a [migrate] commit.
 *
 * So the frontend never deployed. Production served a stale client bundle
 * while every deploy reported green, because the job said "skipped" — which
 * reads as "not needed", not "broken". A merged signup crash-fix and a
 * Turnstile site key both failed to reach browsers before anyone noticed.
 *
 * The shape to catch: a job with NO explicit `if` whose transitive needs
 * include a job that CAN skip (has its own `if`). Those are the jobs that will
 * quietly stop running the first time the conditional upstream doesn't fire.
 *
 *   node scripts/guards/workflow-silent-skip-scan.mjs [--fail]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

const DIR = '.github/workflows';
const FAIL = process.argv.includes('--fail');

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

let findings = 0;

for (const file of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  let wf;
  try {
    wf = load(readFileSync(join(DIR, file), 'utf8'));
  } catch {
    continue; // unparseable is a different problem
  }
  const jobs = wf?.jobs;
  if (!jobs || typeof jobs !== 'object') continue;

  // Which jobs can skip on their own terms?
  const conditional = new Set(
    Object.entries(jobs).filter(([, j]) => j && j.if !== undefined).map(([k]) => k),
  );

  // Transitive needs closure.
  function closure(name, seen = new Set()) {
    for (const dep of asArray(jobs[name]?.needs)) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      closure(dep, seen);
    }
    return seen;
  }

  for (const [name, job] of Object.entries(jobs)) {
    if (!job || job.if !== undefined) continue;      // has its own guard — its author chose
    const deps = closure(name);
    if (deps.size === 0) continue;                    // no needs, nothing to inherit
    const risky = [...deps].filter((d) => conditional.has(d));
    if (risky.length === 0) continue;

    findings += 1;
    console.error(
      `  ${file} :: ${name}\n`
      + `      no explicit \`if\`, so it defaults to success()\n`
      + `      but these jobs in its needs graph can skip: ${risky.join(', ')}\n`
      + `      -> when they skip, ${name} skips too, reporting "skipped" not "failed"\n`
      + `      fix: if: \${{ always() && !cancelled() && needs.<direct>.result == 'success' }}`,
    );
  }
}

if (findings === 0) {
  console.log('No silently-skipping jobs found.');
  process.exit(0);
}
console.error(`\n${findings} job(s) will silently skip when a conditional upstream does not fire.`);
process.exit(FAIL ? 1 : 0);
