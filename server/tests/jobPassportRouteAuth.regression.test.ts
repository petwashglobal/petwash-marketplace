/**
 * job-passport.ts §44 route discipline pins.
 *
 * "URL is navigation. AUTHORIZATION IS SERVER DATA." — CEO §44.
 * The route must never trust the URL for actor kind and must never
 * mutate. This test locks:
 *
 *   • No mutation verbs anywhere in the route file (POST/PATCH/DELETE
 *     routes are banned — this endpoint is READ-ONLY per §60).
 *   • Viewer identity comes from req.firebaseUser + isSuperAdmin —
 *     never from body/query/params.
 *   • Privacy 404: unauthorised → same NOT_FOUND as truly missing,
 *     never a 403 that leaks existence.
 *   • The composer is called with a `viewer` that carries the SERVER-
 *     verified uid.
 *   • The /:jobRef endpoint parses the code and returns 400 / 501 —
 *     it never grants access based on knowing the jobRef alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'job-passport.ts'),
  'utf8',
);

describe('job-passport.ts — §44 read-only + auth discipline', () => {
  it('endpoint is READ-ONLY — no POST/PATCH/DELETE routes anywhere', () => {
    expect(SRC).not.toMatch(/router\.post\(/);
    expect(SRC).not.toMatch(/router\.patch\(/);
    expect(SRC).not.toMatch(/router\.delete\(/);
    expect(SRC).not.toMatch(/router\.put\(/);
    // GET routes must exist.
    expect(SRC).toMatch(/router\.get\(/);
  });

  it('viewer is server-derived — never from client body/query/params', () => {
    // resolveViewer must read firebaseUser only.
    expect(SRC).toMatch(/function\s+resolveViewer[\s\S]*?firebaseUser\?\.uid/);
    // Ban a viewer that reads uid from client-controlled surfaces.
    expect(SRC).not.toMatch(/viewer\s*=\s*req\.body\./);
    expect(SRC).not.toMatch(/viewer\s*=\s*req\.query\./);
    expect(SRC).not.toMatch(/const\s+uid\s*=\s*req\.body\./);
    expect(SRC).not.toMatch(/const\s+uid\s*=\s*req\.query\./);
  });

  it('actor kind is derived from isSuperAdmin, never from a body-supplied field', () => {
    // The resolver picks PETWASH_STAFF only via isSuperAdmin(email).
    expect(SRC).toMatch(/isSuperAdmin\(email\)\s*\?\s*['"]PETWASH_STAFF['"]\s*:\s*['"]CUSTOMER['"]/);
    // Ban an actor-kind assignment from the client.
    expect(SRC).not.toMatch(/kind\s*=\s*req\.body\./);
    expect(SRC).not.toMatch(/actorKind\s*=\s*req\.body\./);
  });

  it('privacy 404 pattern — unauthorised / not-participant → 404, never a 403', () => {
    // The /by-booking handler must return 404 for the "not participant"
    // path (which is indistinguishable from the "missing row" path).
    // A 403 here would leak existence (§34 same rule as WalkSession).
    expect(SRC).toMatch(/return\s+res\.status\(404\)/);
    const notFoundIdx = SRC.indexOf('NOT_FOUND');
    expect(notFoundIdx).toBeGreaterThan(-1);
    // No 403 status anywhere in this route file (admin is not scoped by
    // 403 either — admin is a wider viewer, not a gate on this route).
    expect(SRC).not.toMatch(/res\.status\(403\)/);
  });

  it('/:jobRef endpoint returns 501 today — the jobRef → bookingId index is Phase 2', () => {
    // Knowing a jobRef must NOT unlock a resource on its own (§13).
    // Until the reverse index exists, the endpoint returns 501 with a
    // hint pointing at /by-booking. A refactor that starts returning
    // 200 without wiring the reverse index is a security regression.
    const jobRefRoute = SRC.slice(SRC.indexOf("router.get('/:jobRef'"), SRC.length);
    expect(jobRefRoute).toMatch(/return\s+res\.status\(501\)/);
    expect(jobRefRoute).toMatch(/JOBREF_INDEX_NOT_READY/);
  });

  it('composeJobPassport call always receives the server-verified viewer', () => {
    // Every composer call in this file passes a viewer object built
    // from resolveViewer(). A call that passes a body-derived viewer
    // would slip past the firebase-only rule.
    const calls = [...SRC.matchAll(/composeJobPassport\(\{[\s\S]*?\}\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const m of calls) {
      const call = m[0];
      expect(call).toMatch(/viewer:/);
      // The viewer identity is either the resolved `viewer` variable
      // spread with a kind override, or the plain `viewer` variable.
      expect(call).toMatch(/viewer:\s*(\{\s*\.\.\.viewer|viewer\b)/);
    }
  });
});
