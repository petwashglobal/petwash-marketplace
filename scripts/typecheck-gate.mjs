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

// ── "Cannot find name" is ZERO-TOLERANCE, baseline or not (2026-09-19) ──
// Every other type error is a wrong type on code that still runs. TS2304 means
// the identifier does not exist: the line throws ReferenceError the first time
// a real request reaches it, while esbuild builds happily and tests that never
// call that path stay green. Four shipped that way and sat inside the ~2,100
// baseline where nobody could see them:
//   walk-my-pet.ts        — the walk pay route threw on every call
//   LedgerService.ts      — opening a hold inserted into an unimported table
//   publicAuthRoutes.ts   — the identity probe threw on every phone login
//                           (swallowed by its own catch, so it looked fine)
//   unifiedLocationWeather.ts — the Google weather path 500'd; the helper it
//                           called was never written
// A baseline may forgive a backlog; it may not forgive code that cannot run.
//
// TS2552 IS THE SAME DEFECT (added 2026-09-19). It is the identical error with
// a spelling suggestion attached — "Cannot find name 'x'. Did you mean 'y'?" —
// and TypeScript picks it over TS2304 whenever a similar name is in scope,
// which is the COMMON case: a typo, or a hook declared in the neighbouring
// component. Matching only TS2304 let five of them through a gate written to
// stop exactly this:
//   MyAccount.tsx x5      setLocation() declared inside WalletActionButton, a
//                         different component. "Consent Center", "Notification
//                         Preferences" and the per-pet Passport / Care /
//                         Documents buttons threw on tap and did nothing.
//   storage.ts:2002       `inArray` used, never imported from drizzle-orm.
//   prestige-pass.ts x2   `executeRunId` where the variable is `execRunId`, in
//                         the finance replay APPROVE path — AFTER the report
//                         row was inserted, so an admin got a 500 and a
//                         half-written audit trail.
const cannotFind = (out.match(/.*error TS(?:2304|2552).*/g) ?? []);
if (cannotFind.length > 0) {
  console.error(
    `\n❌ ${cannotFind.length} "Cannot find name" error(s) — that code throws ReferenceError at runtime.\n` +
    `   This class is never baselined. Import it, define it, or fix the spelling.\n\n` +
    cannotFind.slice(0, 40).join('\n') + '\n',
  );
  process.exit(1);
}

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
