#!/usr/bin/env node
/**
 * Typecheck ratchet gate.
 *
 * The app builds with esbuild (NO typecheck), so wrong method names / renamed
 * columns / dropped imports ship silently and only crash when the line runs
 * (this caused real HTTP 500s — email OTP, winback, loyalty-fraud, payment
 * services). We can't make `tsc` pass (a large Replit-era backlog exists), so
 * this gate BASELINES the backlog and fails only when a change INTRODUCES NEW
 * type errors. Ratchet `.typecheck-baseline` down as fixes land.
 *
 * Usage: node scripts/typecheck-gate.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const baselineRaw = readFileSync(new URL('../.typecheck-baseline', import.meta.url), 'utf8').trim();
const baseline = parseInt(baselineRaw, 10);
if (!Number.isFinite(baseline)) {
  console.error(`[typecheck-gate] invalid .typecheck-baseline: "${baselineRaw}"`);
  process.exit(2);
}

let out = '';
try {
  // tsc exits 0 when clean; throws (non-zero) when errors exist — capture stdout either way.
  execSync('node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc -p tsconfig.json --pretty false', {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  out = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
}

const count = (out.match(/error TS\d+/g) ?? []).length;
console.log(`[typecheck-gate] ${count} type errors (baseline ${baseline})`);

if (count > baseline) {
  const delta = count - baseline;
  console.error(
    `\n❌ ${delta} NEW type error(s) introduced vs baseline ${baseline}.\n` +
    `   The esbuild build won't catch these — they hide runtime bugs (HTTP 500s).\n` +
    `   Fix them, or if intentional, justify and bump .typecheck-baseline.\n\n` +
    `New/changed errors (top 40):\n` +
    (out.match(/.*error TS\d+.*/g) ?? []).slice(0, 40).join('\n'),
  );
  process.exit(1);
}

if (count < baseline) {
  console.log(`✅ ${baseline - count} FEWER than baseline — lower .typecheck-baseline to ${count} to lock in the win.`);
} else {
  console.log('✅ no new type errors.');
}
process.exit(0);
