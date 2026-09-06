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
 * TWO HALVES, TWO DIFFERENT STORES — and the check must respect that:
 *
 *   VITE_TURNSTILE_SITE_KEY  PUBLIC. Compiled into the browser bundle, so the
 *                            build system legitimately knows it. Verified by
 *                            inspecting the ARTIFACT.
 *   TURNSTILE_SECRET_KEY     SERVER-ONLY. Belongs in GCP Secret Manager, bound
 *                            to Cloud Run. Verified by inspecting the DEPLOY
 *                            BINDING — never by having the value.
 *
 * An earlier version read `secrets.TURNSTILE_SECRET_KEY` from GitHub Actions
 * so CI could check presence. That was wrong architecture: it pushes a
 * server-only production secret into a second secret store purely to satisfy
 * a check, widening exposure for no benefit. GitHub does not need the value
 * and no longer receives it.
 *
 * It never prints, logs or compares key values — only presence and bindings.
 *
 *   node scripts/guards/turnstile-release-invariant.mjs [--dist dist/public]
 *                                                       [--service petwash-api]
 *                                                       [--region me-west1]
 *                                                       [--project signinpetwash]
 *
 * Exit 0 = both halves present (or non-production, where it warns only).
 * Exit 1 = a production release that would strand signup.
 */
import { execFileSync } from 'node:child_process';
import { detectTurnstileInBundle } from './turnstileBundleDetect.mjs';

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

// ── half 1: the server secret, checked as a DEPLOY BINDING ──────────────────
//
// The question is "will the server receive TURNSTILE_SECRET_KEY?", and that is
// answered by the Cloud Run service configuration, not by handing the value to
// CI. gcloud reports the binding (env var name + the Secret Manager secret it
// resolves from) without ever revealing the secret.
function checkServerBinding() {
  const svcArg = args.indexOf('--service');
  const regArg = args.indexOf('--region');
  const projArg = args.indexOf('--project');
  const service = svcArg !== -1 ? args[svcArg + 1] : (process.env.CLOUD_RUN_SERVICE || 'petwash-api');
  const region = regArg !== -1 ? args[regArg + 1] : (process.env.CLOUD_RUN_REGION || 'me-west1');
  const project = projArg !== -1 ? args[projArg + 1] : (process.env.GCP_PROJECT || 'signinpetwash');

  let out = '';
  try {
    out = execFileSync('gcloud', [
      'run', 'services', 'describe', service,
      '--region', region, '--project', project,
      // Names only. Values of secret-backed env vars are never rendered by
      // gcloud anyway; this format asks for the env var NAMES and the secret
      // REFERENCES, so nothing sensitive can appear even in a debug log.
      '--format', 'json(spec.template.spec.containers[0].env)',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
  } catch (err) {
    notes.push(
      `Could not query Cloud Run (${service}/${region}) to verify the secret binding — `
      + 'skipping the server half. Post-deploy /api/health/bot-check is the backstop.',
    );
    return;
  }

  let bound = false;
  try {
    const parsed = JSON.parse(out);
    const env = parsed?.spec?.template?.spec?.containers?.[0]?.env ?? [];
    bound = env.some((e) => e?.name === 'TURNSTILE_SECRET_KEY'
      && (e?.valueFrom?.secretKeyRef?.name || typeof e?.value === 'string'));
  } catch {
    notes.push('Cloud Run description was unparseable — skipping the server half.');
    return;
  }

  if (bound) {
    notes.push(`TURNSTILE_SECRET_KEY is bound on Cloud Run ${service} (value never read).`);
  } else {
    problems.push(
      `TURNSTILE_SECRET_KEY is NOT bound on Cloud Run ${service} (${region}). turnstileGuard `
      + 'fails CLOSED in production, so /api/auth/email/start and /api/auth/sms/start will '
      + 'return 503 to every customer. Bind it from Secret Manager — do NOT copy the value '
      + 'into GitHub Actions.',
    );
  }
}
checkServerBinding();

// ── half 2: the site key, as actually COMPILED into the bundle ──────────────
//
// Checking process.env.VITE_TURNSTILE_SITE_KEY here would prove nothing about
// the artifact being shipped: the value is inlined at build time, so a var set
// after the build, or in a different job, is invisible to the browser. The
// only honest check is the bundle itself — and it uses the SAME detector the
// build-config writer uses, so the release gate and /api/health/bot-check can
// never disagree about what shipped.
const t = detectTurnstileInBundle(DIST);

if (!t.artifactFound) {
  problems.push(
    `No built JS found under ${DIST}. Run this AFTER the client build, or pass `
    + '--dist <path>; a release cannot be validated against an artifact that '
    + 'does not exist.',
  );
} else if (!t.widgetPresent) {
  notes.push(`No Turnstile widget code found in ${DIST} (nothing to validate).`);
} else if (!t.turnstileConfigured) {
  problems.push(
    'The client bundle was built WITHOUT VITE_TURNSTILE_SITE_KEY: the widget '
    + 'render path was dead-code-eliminated and executeTurnstileInvisible() '
    + 'can only return SITE_KEY_MISSING. The browser will never obtain a '
    + 'token, so signup stays dead even if the server secret is bound. '
    + 'A VITE_* value is compiled in — set it in the BUILD environment and '
    + 'rebuild the client; adding it to Cloud Run afterwards changes nothing. '
    + 'The site key is PUBLIC, so a GitHub variable is an appropriate home.',
  );
} else {
  notes.push('Client bundle carries a Turnstile site key (value not read).');
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
