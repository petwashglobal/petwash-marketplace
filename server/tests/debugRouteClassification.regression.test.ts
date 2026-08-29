/**
 * CEO FLY MODE II §24 (2026-08-29) — debug-route classification pins.
 *
 * Three auth-adjacent probes surfaced in the F5 audit's "debug routes"
 * bucket. Classification:
 *
 *   /api/auth/session/test          → INTERNAL ADMIN ONLY  (was
 *                                     requireAuth; tightened to
 *                                     requireAdmin — leaked the caller's
 *                                     cookie key names).
 *   /api/auth/apple/config-health   → PUBLIC HEALTH-SAFE  (boolean
 *                                     readiness, no values; Ops needs
 *                                     this to spot the "Secret Manager
 *                                     var set but not wired into Cloud
 *                                     Run env" foot-gun that causes
 *                                     App-Store rejections).
 *   /api/auth/firebase-admin-test   → INTERNAL ADMIN ONLY  (already
 *                                     requireAdmin; keep).
 *
 * The pins below lock the guard on each route.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

function guardOf(path: string): string | null {
  // Match either app.get / app.post etc. followed by the path literal,
  // then the FIRST identifier that follows — that's the guard middleware.
  const pattern = new RegExp(
    `app\\.\\w+\\('${path.replace(/\//g, '\\/')}',\\s*([A-Za-z_$][A-Za-z0-9_$]*)`,
  );
  const m = SRC.match(pattern);
  return m ? m[1] : null;
}

describe('CEO FLY MODE II §24 — debug-route classification', () => {
  it('/api/auth/session/test is INTERNAL ADMIN ONLY (requireAdmin)', () => {
    expect(guardOf('/api/auth/session/test')).toBe('requireAdmin');
  });

  it('/api/auth/apple/config-health is PUBLIC HEALTH-SAFE (authLimiter only)', () => {
    // No auth guard — only the shared authLimiter. This probe returns
    // boolean env-var presence by NAME (never values) so App-Store /
    // Ops can spot the "Secret Manager set but Cloud Run env not
    // bound" foot-gun. A regression that adds requireAuth here breaks
    // the operational contract.
    expect(guardOf('/api/auth/apple/config-health')).toBe('authLimiter');
  });

  it('/api/auth/firebase-admin-test stays INTERNAL ADMIN ONLY (requireAdmin)', () => {
    expect(guardOf('/api/auth/firebase-admin-test')).toBe('requireAdmin');
  });

  it('/api/auth/session/test carries the §24 rationale comment', () => {
    // Anchor the comment so a refactor cannot silently downgrade the
    // guard back to requireAuth without also removing the reason it
    // was raised in the first place.
    const idx = SRC.indexOf("app.get('/api/auth/session/test'");
    expect(idx).toBeGreaterThan(0);
    const preface = SRC.slice(Math.max(0, idx - 800), idx);
    expect(preface).toMatch(/§24/);
    expect(preface).toMatch(/INTERNAL ADMIN ONLY/);
  });

  it('apple/config-health only ever COERCES env vars to boolean, never returns raw values', () => {
    // Structural guard: every process.env.APPLE_SIGN_IN_* reference
    // in this handler body must be inside a `!!(...)` boolean coerce.
    // A future "just include the value" convenience commit would leak
    // a signing key and get caught here.
    const startIdx = SRC.indexOf("app.get('/api/auth/apple/config-health'");
    const body = SRC.slice(startIdx, startIdx + 2500);
    // Every APPLE_SIGN_IN_* mention lives between `!!(` and `)` — a
    // boolean coerce. This regex asserts the shape by finding each
    // env ref and checking it is *preceded* by `!!(`.
    const envRefs = body.match(/process\.env\.APPLE_SIGN_IN_[A-Z_]+/g) || [];
    expect(envRefs.length).toBeGreaterThan(0);
    for (const ref of envRefs) {
      const refIdx = body.indexOf(ref);
      const preface = body.slice(Math.max(0, refIdx - 5), refIdx);
      // The immediate 5 chars before the ref must contain `!!(` OR
      // `|| ` (the second env var in a `!!(a || b)` pattern).
      expect(preface).toMatch(/(!!\(|\|\| )/);
    }
  });

  it('firebase-admin-test only writes boolean/string-name diagnostics, never a raw secret', () => {
    const startIdx = SRC.indexOf("app.get('/api/auth/firebase-admin-test'");
    const body = SRC.slice(startIdx, startIdx + 2000);
    // The one env ref must be a boolean coerce.
    expect(body).toMatch(/hasServiceAccount: !!process\.env\.FIREBASE_SERVICE_ACCOUNT_KEY/);
    // And the response body must NOT include the raw key.
    expect(body).not.toMatch(/FIREBASE_SERVICE_ACCOUNT_KEY: process\.env/);
  });
});
