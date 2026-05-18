#!/usr/bin/env node
/**
 * PR-STARTUP-HARDEN-1 — Routes-load smoke test
 *
 * Spawns a child process that attempts to import server/routes.ts in a
 * production-shaped environment. If any module-load throw fires, the
 * child exits non-zero and we capture the file:line of the first throw.
 *
 * The test catches (verified per CI/CD-council coverage matrix):
 *   • Module-load throws (top-level `throw new Error(...)`) — FULLY
 *   • Dynamic `import('./x')` failures executed during routes.ts init — FULLY
 *   • Startup async throws (unhandledRejection + uncaughtException) — FULLY
 *   • Firebase / Google client init failures at *construct* time IF the
 *     construct happens at module load (top-level `new X()` or top-level
 *     `export const x = new Y()`) — FULLY
 *   • Top-level secret-validation guards (`if (!env.X) throw`) at module
 *     scope — FULLY
 *   • Drizzle / Postgres pool init failures at module load — FULLY
 *   • Circular import crashes — FULLY
 *
 * The test does NOT catch (deferred to PR-OBSERVABILITY-1):
 *   • Failures inside registerRoutes(app) — middleware boot, route-specific
 *     setup, Express handler-registration errors. These happen AFTER the
 *     import() resolves; the probe does not boot Express.
 *   • Function-body throws that fire only on first API call.
 *   • Failures that depend on real Cloud Run runtime (metadata-server ADC,
 *     actual Secret Manager mapping, real Postgres connectivity, IAM roles).
 *     The post-deploy /api/health gate in petwash-ci.yml covers this layer.
 *
 * Output:
 *   • smoke-test-result.json (machine-readable artifact)
 *   • smoke-test-log.txt (human-readable + full stderr)
 *   • Human summary printed to stdout at end
 *
 * Exit codes (deterministic):
 *   0  routes.ts loaded successfully — no module-load throws
 *   1  module-load throw — first file:line captured in artifact
 *   2  timeout — boot exceeded SMOKE_TIMEOUT_MS
 *   3  config error — missing required tool / invalid invocation
 *   4  startup-time regression — boot took longer than SMOKE_BOOT_THRESHOLD_MS
 *
 * Usage:
 *   npx tsx scripts/smoke-test-routes-load.ts
 *
 * Environment overrides:
 *   SMOKE_TIMEOUT_MS         (default 60000)
 *   SMOKE_BOOT_THRESHOLD_MS  (default 30000) — fail if successful import takes longer
 *   SMOKE_ARTIFACT_DIR       (default ./smoke-test-output)
 *   SMOKE_TARGET             (default ./server/routes.ts)
 *
 * NOTE: This file is the gate between merge and deploy. Treat changes here
 * with the same scrutiny as production code, even though it never runs in
 * production itself.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─── Configuration ────────────────────────────────────────────────────────────

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 60_000);
const BOOT_THRESHOLD_MS = Number(process.env.SMOKE_BOOT_THRESHOLD_MS ?? 30_000);
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR ?? resolve(process.cwd(), 'smoke-test-output');
const TARGET = process.env.SMOKE_TARGET ?? './server/routes.ts';

// ─── Result shape ─────────────────────────────────────────────────────────────

interface SmokeResult {
  pass: boolean;
  exitCode: 0 | 1 | 2 | 3 | 4;
  reason: string;
  durationMs: number;
  target: string;
  firstThrow?: {
    errorClass: string;
    message: string;
    stack: string;
    firstAppFrame?: {
      file: string;
      line: number;
      column: number;
    };
  };
  envSnapshot: Record<string, string>;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeArtifacts(result: SmokeResult, rawStderr: string, rawStdout: string): void {
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(ARTIFACT_DIR, 'smoke-test-result.json'), JSON.stringify(result, null, 2));
    writeFileSync(
      join(ARTIFACT_DIR, 'smoke-test-log.txt'),
      [
        `# PetWash routes-load smoke test`,
        `# Timestamp: ${result.timestamp}`,
        `# Duration: ${result.durationMs}ms`,
        `# Result: ${result.pass ? 'PASS' : 'FAIL'} (exit ${result.exitCode})`,
        `# Reason: ${result.reason}`,
        ``,
        `── stdout ──`,
        rawStdout || '(empty)',
        ``,
        `── stderr ──`,
        rawStderr || '(empty)',
      ].join('\n'),
    );
  } catch (err) {
    console.error(`[smoke-test] WARNING: failed to write artifacts → ${(err as Error).message}`);
  }
}

function snapshotEnv(): Record<string, string> {
  // Redact secrets — only record presence + first/last 4 chars for confirmation
  const interesting = [
    'NODE_ENV',
    'DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'WALLET_LINK_SECRET',
    'PRESTIGE_QR_SECRET',
    'NAYAX_API_KEY',
    'NAYAX_ENABLED',
    'PAYMENT_PROVIDER_MODE',
    'SUMIT_API_KEY',
    'SUMIT_COMPANY_ID',
    'SUMIT_BASE_URL',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'AI_INTEGRATIONS_GEMINI_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'VERTEX_AI_LOCATION',
    'IP_HASH_SALT',
    'KYC_SALT',
    'TREASURY_FIELD_ENCRYPTION_KEY',
  ];
  const snap: Record<string, string> = {};
  for (const key of interesting) {
    const v = process.env[key];
    if (v === undefined) snap[key] = '<unset>';
    else if (v === '') snap[key] = '<empty>';
    else if (v.length <= 8) snap[key] = `<set,len=${v.length}>`;
    else snap[key] = `<set,len=${v.length},head=${v.slice(0, 4)},tail=${v.slice(-4)}>`;
  }
  return snap;
}

interface StackFrame {
  file: string;
  line: number;
  column: number;
}

function parseFirstAppFrame(stack: string): StackFrame | undefined {
  // Stack lines look like:
  //   at Function (/app/server/services/X.ts:34:13)
  //   at /app/server/services/X.ts:34:13
  //   at Module._compile (node:internal/modules/...)
  //
  // We want the FIRST frame that points to a file under /server/ or ./server/.
  const lines = stack.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    // Match: at FunctionName (PATH:LINE:COL)  OR  at PATH:LINE:COL
    const m = line.match(/\(([^()]*server\/[^()]+):(\d+):(\d+)\)/) ||
              line.match(/at (\/[^\s]*server\/[^\s]+):(\d+):(\d+)/) ||
              line.match(/at (\.?\/?server\/[^\s]+):(\d+):(\d+)/);
    if (m) {
      return {
        file: m[1].replace(/^\/app\//, '').replace(/^\.\//, ''),
        line: Number(m[2]),
        column: Number(m[3]),
      };
    }
  }
  return undefined;
}

function parseErrorBlock(stderr: string): { errorClass: string; message: string; stack: string } | undefined {
  // tsx + node print uncaught throws as:
  //   /path/file.ts:LINE
  //   throw new Error('xyz');
  //   ^
  //   Error: xyz
  //       at ...
  //       at ...
  // OR for our wrapped catch handler:
  //   __SMOKE_ERROR__:{"errorClass":"...","message":"...","stack":"..."}
  //
  // First try our wrapped JSON sentinel (preferred — clean), then fall back to raw parsing.
  const sentinel = stderr.match(/__SMOKE_ERROR__:(\{.*\})/);
  if (sentinel) {
    try {
      return JSON.parse(sentinel[1]);
    } catch {
      /* fall through */
    }
  }

  // Fallback: find "Error: ..." line and capture stack frames after it
  const errorMatch = stderr.match(/^([A-Z][A-Za-z]*Error|Error):\s*(.+)$/m);
  if (!errorMatch) return undefined;
  const startIdx = stderr.indexOf(errorMatch[0]);
  const stack = stderr.slice(startIdx);
  return {
    errorClass: errorMatch[1],
    message: errorMatch[2].trim(),
    stack,
  };
}

function humanSummary(result: SmokeResult): void {
  const sep = '═'.repeat(72);
  console.log(`\n${sep}`);
  console.log(`PetWash routes-load smoke test — ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(sep);
  console.log(`Exit code:  ${result.exitCode}`);
  console.log(`Reason:     ${result.reason}`);
  console.log(`Duration:   ${result.durationMs}ms (threshold ${BOOT_THRESHOLD_MS}ms)`);
  console.log(`Target:     ${result.target}`);

  if (result.firstThrow) {
    console.log(`\nFirst throw:`);
    console.log(`  Error class:  ${result.firstThrow.errorClass}`);
    console.log(`  Message:      ${result.firstThrow.message}`);
    if (result.firstThrow.firstAppFrame) {
      const f = result.firstThrow.firstAppFrame;
      console.log(`  First app frame:`);
      console.log(`    ${f.file}:${f.line}:${f.column}`);
    } else {
      console.log(`  First app frame: <none found in /server/ — check stack manually>`);
    }
    console.log(`\n  Stack (first 12 lines):`);
    result.firstThrow.stack
      .split('\n')
      .slice(0, 12)
      .forEach((line) => console.log(`    ${line}`));
  }

  console.log(`\nArtifact: ${join(ARTIFACT_DIR, 'smoke-test-result.json')}`);
  console.log(`${sep}\n`);
}

// ─── Child-process probe script (injected into tsx) ───────────────────────────

/**
 * The probe runs in a tsx subprocess. It awaits the import of routes.ts and
 * emits a structured sentinel line to stderr on failure so the parent can
 * parse cleanly. Sentinel format: __SMOKE_ERROR__:<json>
 *
 * It also wires process-level error handlers so unhandled rejections AND
 * uncaught exceptions during boot are surfaced (the import() catch alone
 * does not catch async throws that escape the import promise).
 */
const PROBE_SCRIPT = `
  const SENTINEL = '__SMOKE_ERROR__:';
  let reported = false;
  const report = (err) => {
    if (reported) return;
    reported = true;
    const payload = {
      errorClass: (err && err.constructor && err.constructor.name) || typeof err,
      message: err && err.message ? String(err.message) : String(err),
      stack: err && err.stack ? String(err.stack) : '<no stack>',
    };
    process.stderr.write('\\n' + SENTINEL + JSON.stringify(payload) + '\\n');
    process.exit(1);
  };
  process.on('uncaughtException', report);
  process.on('unhandledRejection', report);

  const target = ${JSON.stringify(TARGET)};
  import(target).then(() => {
    process.stdout.write('__SMOKE_OK__\\n');
    process.exit(0);
  }).catch(report);
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const started = Date.now();

  // 1. Spawn tsx with the probe inline. Use the local tsx binary (no global needed).
  const tsxBin = resolve(process.cwd(), 'node_modules/.bin/tsx');
  const args = ['-e', PROBE_SCRIPT];

  const child = spawn(tsxBin, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  child.stdout.on('data', (chunk) => { stdoutBuf += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });

  // 2. Race against timeout
  const timeoutHandle = setTimeout(() => {
    try { child.kill('SIGKILL'); } catch { /* noop */ }
  }, TIMEOUT_MS);

  const exitCodeFromChild: number = await new Promise((resolveChild) => {
    child.on('close', (code, signal) => {
      clearTimeout(timeoutHandle);
      if (signal === 'SIGKILL') resolveChild(124); // conventional timeout exit
      else resolveChild(code ?? 0);
    });
    child.on('error', () => {
      clearTimeout(timeoutHandle);
      resolveChild(127); // conventional command-not-found / spawn failure
    });
  });

  const durationMs = Date.now() - started;

  // 3. Classify the result
  let result: SmokeResult;

  if (exitCodeFromChild === 124) {
    // Timeout
    result = {
      pass: false,
      exitCode: 2,
      reason: `Routes-load exceeded SMOKE_TIMEOUT_MS=${TIMEOUT_MS} — likely infinite loop, deadlock, or external service hang at module load`,
      durationMs,
      target: TARGET,
      envSnapshot: snapshotEnv(),
      timestamp: new Date().toISOString(),
    };
    writeArtifacts(result, stderrBuf, stdoutBuf);
    humanSummary(result);
    process.exit(2);
  }

  if (exitCodeFromChild === 127) {
    // Spawn failure — likely tsx missing
    result = {
      pass: false,
      exitCode: 3,
      reason: `Could not spawn tsx at ${tsxBin}. Run \`npm ci\` first.`,
      durationMs,
      target: TARGET,
      envSnapshot: snapshotEnv(),
      timestamp: new Date().toISOString(),
    };
    writeArtifacts(result, stderrBuf, stdoutBuf);
    humanSummary(result);
    process.exit(3);
  }

  if (exitCodeFromChild !== 0) {
    // Module-load throw (or any uncaught error during import)
    const parsed = parseErrorBlock(stderrBuf);
    const firstAppFrame = parsed ? parseFirstAppFrame(parsed.stack) : undefined;
    result = {
      pass: false,
      exitCode: 1,
      reason: parsed
        ? `Module-load throw during routes.ts import: ${parsed.errorClass}`
        : `Routes.ts import exited ${exitCodeFromChild} but no error block parsed — see smoke-test-log.txt`,
      durationMs,
      target: TARGET,
      firstThrow: parsed ? { ...parsed, firstAppFrame } : undefined,
      envSnapshot: snapshotEnv(),
      timestamp: new Date().toISOString(),
    };
    writeArtifacts(result, stderrBuf, stdoutBuf);
    humanSummary(result);
    process.exit(1);
  }

  // Success path — verify sentinel
  if (!stdoutBuf.includes('__SMOKE_OK__')) {
    result = {
      pass: false,
      exitCode: 1,
      reason: 'Child exited 0 but success sentinel missing — probe may have been malformed',
      durationMs,
      target: TARGET,
      envSnapshot: snapshotEnv(),
      timestamp: new Date().toISOString(),
    };
    writeArtifacts(result, stderrBuf, stdoutBuf);
    humanSummary(result);
    process.exit(1);
  }

  // Boot-time regression check
  if (durationMs > BOOT_THRESHOLD_MS) {
    result = {
      pass: false,
      exitCode: 4,
      reason: `Routes-load took ${durationMs}ms — exceeds SMOKE_BOOT_THRESHOLD_MS=${BOOT_THRESHOLD_MS}. Investigate cold-start regression.`,
      durationMs,
      target: TARGET,
      envSnapshot: snapshotEnv(),
      timestamp: new Date().toISOString(),
    };
    writeArtifacts(result, stderrBuf, stdoutBuf);
    humanSummary(result);
    process.exit(4);
  }

  result = {
    pass: true,
    exitCode: 0,
    reason: `Routes loaded cleanly in ${durationMs}ms`,
    durationMs,
    target: TARGET,
    envSnapshot: snapshotEnv(),
    timestamp: new Date().toISOString(),
  };
  writeArtifacts(result, stderrBuf, stdoutBuf);
  humanSummary(result);
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke-test] FATAL — harness itself crashed:', err);
  process.exit(3);
});
