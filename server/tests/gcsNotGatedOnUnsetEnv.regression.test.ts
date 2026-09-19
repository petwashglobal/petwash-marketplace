import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19, from the live boot log:
 *   [WARN] [K9000] GCS credentials not found - backups disabled
 *
 * Cloud Run sets neither GOOGLE_APPLICATION_CREDENTIALS nor
 * FIREBASE_SERVICE_ACCOUNT_KEY — it attaches a service account and the Google
 * client picks it up through Application Default Credentials. Gating a client
 * on those variables therefore means "always off in production", and the
 * feature disables itself while the code reads as though it works.
 *
 * The rest of the codebase already relies on ADC (lib/adoptionPhotoStore.ts,
 * lib/pawFinderPhotoStore.ts, routes/messaging.ts all call `new Storage()`
 * bare), which is what makes the gate wrong rather than merely cautious.
 */
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Deliberate exception: biometric/KYC storage stays behind its own gate. That
 * whole surface is dark pending the Google Cloud DPA (every /api/kyc and
 * /api/biometric-certificates route answers 451 DPA_REQUIRED in production),
 * so switching its storage on is not a code decision.
 */
const ALLOWED = new Set(['server/services/BiometricVerificationService.ts']);

function serverFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') serverFiles(p, out); }
    else if (e.name.endsWith('.ts') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

describe('a Google client is not gated on an env var Cloud Run never sets', () => {
  it('no service disables itself on GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_KEY', () => {
    const offenders: string[] = [];
    for (const file of serverFiles(path.join(ROOT, 'server'))) {
      const rel = path.relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('new Storage(')) continue;
      // an `if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_SERVICE_ACCOUNT_KEY)`
      // wrapping the construction is the shape that switched itself off
      const gated = /if\s*\(\s*process\.env\.(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_SERVICE_ACCOUNT_KEY)\s*\|\|\s*process\.env\.(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_SERVICE_ACCOUNT_KEY)\s*\)/.test(src);
      if (gated) offenders.push(rel);
    }
    expect(offenders, `these disable GCS in production: ${offenders.join(', ')}`).toEqual([]);
  });
});
