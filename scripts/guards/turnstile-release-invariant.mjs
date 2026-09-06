#!/usr/bin/env node
/**
 * Release invariant: Turnstile's two halves must ship together.
 *
 * WHY THIS EXISTS. On 2026-09-06 production had NEITHER half:
 *
 *   TURNSTILE_SECRET_KEY      absent from Cloud Run and Secret Manager
 *   VITE_TURNSTILE_SITE_KEY   absent from the GitHub Actions secrets, so the
 *                             build substituted "" and Vite dead-code-eliminated
 *                             the widget out of the bundle entirely
 *
 * turnstileGuard fails CLOSED in production, so POST /api/auth/email/start and
 * POST /api/auth/sms/start were returning 503 to every customer. Nobody could
 * sign up or sign in by code. It had been that way since the Replit -> Cloud
 * Run migration, and nothing in the pipeline noticed — the only signal was a
 * /health endpoint that described the surfaces as merely "unprotected".
 *
 * A release must now fail BEFORE traffic moves, not after customers are locked
 * out. This checks both halves and, crucially, checks the BUILT BUNDLE rather
 * than trusting that an env var reached the compiler.
 *
 * It never prints, logs or compares key values — only presence.
 *
 *   node scripts/guards/turnstile-release-invariant.mjs [--dist dist/public]
 *
 * Exit 0 = both halves present (or non-production, where it warns only).
 * Exit 1 = a production release that would strand signup.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const distArg = args.indexOf('--dist');
const DIST = distArg !== -1 ? args[distArg + 1] : 'dist/public';

// A release is "production" when the pipeline says so. Default to strict:
// a guard that silently opts out is the failure mode it exists to prevent.
const IS_PRODUCTION =
  process.env.TURNSTILE_INVARIANT_ENV === 'production'
  || process.env.NODE_ENV === 'production'
  || process.env.GITHUB_REF === 'refs/heads/main';

const problems = [];
const notes = [];

// ── half 1: the server runtime secret ───────────────────────────────────────
if (!process.env.TURNSTILE_SECRET_KEY) {
  problems.push(
    'TURNSTILE_SECRET_KEY is not set for the server runtime. turnstileGuard '
    + 'fails CLOSED in production, so /api/auth/email/start and '
    + '/api/auth/sms/start will return 503 to every customer.',
  );
} else {
  notes.push('TURNSTILE_SECRET_KEY present (value not read).');
}

// ── half 2: the site key, as actually COMPILED into the bundle ──────────────
//
// Checking process.env.VITE_TURNSTILE_SITE_KEY here would prove nothing about
// the artifact being shipped: the value is inlined at build time, so a var set
// after the build, or in a different job, is invisible to the browser. The
// only honest check is the bundle itself.
function jsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = jsFiles(DIST);
if (files.length === 0) {
  problems.push(
    `No built JS found under ${DIST}. Run this AFTER the client build, or pass `
    + '--dist <path>; a release cannot be validated against an artifact that '
    + 'does not exist.',
  );
} else {
  /**
   * Look for a Turnstile SITE KEY LITERAL in the chunk that carries the widget.
   *
   * Cloudflare site keys are public by design and have a fixed shape
   * (`0x4AAAA…`, or `1x0000…`/`3x0000…` for the documented test keys), so this
   * is a presence test on a known token shape — the value is never printed,
   * compared or stored.
   *
   * An earlier version inferred presence from the challenges.cloudflare.com
   * loader URL appearing in the bundle. CodeQL flagged that as incomplete URL
   * substring sanitisation and was right to: a substring test against a
   * hostname is a fragile shape even when, as here, nothing is being
   * sanitised. Checking for the key itself is both more direct and exactly how
   * the 2026-09-06 outage was diagnosed.
   */
  const SITE_KEY_SHAPE = /0x4[A-Za-z0-9_-]{20,}|\b[13]x0{20}[A-Za-z0-9]{1,4}\b/;
  let sawWidget = false;
  let sawKey = false;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('SITE_KEY_MISSING')) continue;
    sawWidget = true;
    if (SITE_KEY_SHAPE.test(src)) sawKey = true;
  }
  const sawFoldedAway = sawWidget && !sawKey;

  if (!sawWidget) {
    notes.push(`No Turnstile widget code found in ${DIST} (nothing to validate).`);
  } else if (sawFoldedAway) {
    problems.push(
      'The client bundle was built WITHOUT VITE_TURNSTILE_SITE_KEY: the widget '
      + 'render path was dead-code-eliminated and executeTurnstileInvisible() '
      + 'can only return SITE_KEY_MISSING. The browser will never obtain a '
      + 'token, so signup stays dead even if the server secret is set. '
      + 'A VITE_* value is compiled in — set it in the BUILD environment and '
      + 'rebuild the client; adding it to Cloud Run afterwards changes nothing.',
    );
  } else {
    notes.push('Client bundle carries a Turnstile site key (value not read).');
  }
}

for (const n of notes) console.log(`  ok   ${n}`);
for (const p of problems) console.error(`  FAIL ${p}`);

if (problems.length === 0) {
  console.log('Turnstile release invariant: OK — both halves ship together.');
  process.exit(0);
}

if (!IS_PRODUCTION) {
  console.warn(
    '\nNon-production release — not blocking. The SAME configuration would '
    + 'take signup and sign-in DOWN in production.',
  );
  process.exit(0);
}

console.error(
  '\nRelease BLOCKED. Both halves of Turnstile must be provisioned together:\n'
  + '  TURNSTILE_SECRET_KEY     -> server runtime (Cloud Run / Secret Manager)\n'
  + '  VITE_TURNSTILE_SITE_KEY  -> client BUILD environment, then rebuild\n'
  + 'Both must come from the same Cloudflare Turnstile widget for petwash.co.il.\n'
  + 'The site key is public by design; the secret key is server-only.',
);
process.exit(1);
