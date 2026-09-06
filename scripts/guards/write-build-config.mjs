#!/usr/bin/env node
/**
 * Writes dist/public/build-config.json — non-secret metadata ABOUT the build,
 * so the running server can report what the browser actually received.
 *
 * Why this file has to exist: /api/health/bot-check used to derive the client
 * half from `process.env.VITE_TURNSTILE_SITE_KEY` on the SERVER. That is a
 * frontend build variable. A correctly built frontend can carry the site key
 * while Cloud Run has no such env var at all — so the endpoint would have
 * reported the site key absent immediately after a correct deployment, and
 * the opposite mistake (READY while the browser still cannot mint a token)
 * was equally reachable.
 *
 * Contains BOOLEANS and timestamps only. No key material, ever — the site key
 * is public but there is still no reason to copy it here.
 *
 *   node scripts/guards/write-build-config.mjs [--dist dist/public]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectTurnstileInBundle } from './turnstileBundleDetect.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--dist');
const DIST = i !== -1 ? args[i + 1] : 'dist/public';

const t = detectTurnstileInBundle(DIST);

const config = {
  schema: 1,
  builtAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA || process.env.GIT_SHA || process.env.COMMIT_SHA || null,
  // The one field the health endpoint needs: did the artifact ship with a
  // usable Turnstile configuration?
  turnstileConfigured: t.turnstileConfigured,
  // Kept so an operator can tell "no key" from "no widget in this build at all".
  turnstileWidgetPresent: t.widgetPresent,
};

if (!t.artifactFound) {
  console.error(`write-build-config: no built JS under ${DIST} — run this AFTER the client build.`);
  process.exit(1);
}

const out = join(DIST, 'build-config.json');
writeFileSync(out, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log(`write-build-config: wrote ${out}`, JSON.stringify({
  turnstileConfigured: config.turnstileConfigured,
  turnstileWidgetPresent: config.turnstileWidgetPresent,
}));
