/**
 * ONE detector for "was the client built with a Turnstile site key?".
 *
 * Shared by the release invariant (which blocks a deploy) and the build-config
 * writer (which records the answer for /api/health/bot-check). Two copies of
 * this logic would eventually disagree, and the health endpoint would then
 * contradict the gate that let the release through.
 *
 * It reads the BUILT ARTIFACT, never an environment variable. A VITE_* value
 * is inlined at compile time, so `process.env.VITE_TURNSTILE_SITE_KEY` on a
 * running server proves nothing about the bundle a browser downloads — that
 * confusion is exactly what this file exists to remove.
 *
 * Cloudflare site keys are PUBLIC by design, so matching their shape is not
 * handling a secret. The value is never returned, logged or compared.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** `0x4AAA…` production keys, plus Cloudflare's documented 1x/3x test keys. */
const SITE_KEY_SHAPE = /0x4[A-Za-z0-9_-]{20,}|\b[13]x0{20}[A-Za-z0-9]{1,4}\b/;

/** Marker proving the Turnstile widget module is in this artifact at all. */
const WIDGET_MARKER = 'SITE_KEY_MISSING';

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

/**
 * @returns {{ artifactFound: boolean, widgetPresent: boolean, turnstileConfigured: boolean }}
 *   turnstileConfigured is true ONLY when the widget module is present AND a
 *   site-key literal survived the build. When the key is empty Vite folds
 *   `if (!SITE_KEY) return {code:'SITE_KEY_MISSING'}` into the entire function
 *   body and drops the render path — so an absent key is directly observable.
 */
export function detectTurnstileInBundle(distDir) {
  const files = jsFiles(distDir);
  if (files.length === 0) {
    return { artifactFound: false, widgetPresent: false, turnstileConfigured: false };
  }

  let widgetPresent = false;
  let keyPresent = false;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes(WIDGET_MARKER)) continue;
    widgetPresent = true;
    if (SITE_KEY_SHAPE.test(src)) keyPresent = true;
  }

  return {
    artifactFound: true,
    widgetPresent,
    turnstileConfigured: widgetPresent && keyPresent,
  };
}
