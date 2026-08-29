/**
 * CEO MASTER DIRECTIVE 2026-08-28 §7 §9 §10 §11 §22 — Journey Brain
 * wizard write-path invariants.
 *
 * Every /api/journey/* endpoint MUST:
 *   * derive userUid from the verified Firebase token — NEVER from
 *     req.body (defence against cross-user write per CEO §22)
 *   * validate body with Zod so a hostile client cannot ship a
 *     100-KB snapshot / unbounded strings
 *   * fail-CLOSED on service errors (500 + errorCode)
 *   * be mounted under validateFirebaseToken + apiLimiter
 *
 * Pin these so a refactor cannot silently open a bypass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'journey.ts'),
  'utf8',
);
const REG = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('/api/journey — mount + auth (CEO §22)', () => {
  it('is mounted under /api/journey with validateFirebaseToken + apiLimiter', () => {
    expect(REG).toContain("import journeyRoutes from \"./routes/journey\";");
    expect(REG).toMatch(/app\.use\('\/api\/journey', validateFirebaseToken, apiLimiter, journeyRoutes\);/);
  });

  it('EVERY handler resolves the caller from the Firebase token — NEVER from req.body', () => {
    // callerUid reads firebaseUser.uid or user.uid from the auth
    // middleware. No handler may reach for req.body.userUid — that
    // would let a hostile client forge writes under another user.
    expect(ROUTE).toMatch(/function callerUid\(req: Request\): string \| null \{\s*\n\s*return \(req as any\)\.firebaseUser\?\.uid \|\| \(req as any\)\.user\?\.uid \|\| null;\s*\n\s*\}/);
    // No handler dereferences body.userUid.
    expect(ROUTE).not.toMatch(/req\.body\.userUid/);
    expect(ROUTE).not.toMatch(/req\.body\?\.userUid/);
    // No handler passes body-derived uid to the service — every
    // saveCheckpoint / saveSearch / addFavouriteProvider call uses
    // the token-derived `uid`.
    expect(ROUTE).toMatch(/userUid: uid,/);
  });

  it('every handler 401s WITHOUT a caller', () => {
    // Count the 401s — every handler in the file must emit one.
    const guards = (ROUTE.match(/if \(!uid\) return res\.status\(401\)\.json\(\{ ok: false, error: 'auth_required' \}\);/g) ?? []).length;
    // 3 checkpoint + 3 search + 4 favourite handlers = 10.
    expect(guards).toBeGreaterThanOrEqual(10);
  });
});

describe('/api/journey/checkpoints (Phase 2 §11 §12)', () => {
  it('POST validates the body with a strict Zod schema (bounded strings + ttl cap)', () => {
    expect(ROUTE).toMatch(/const CheckpointBodySchema = z\.object\(\{/);
    expect(ROUTE).toMatch(/domain: z\.string\(\)\.min\(1\)\.max\(64\),/);
    expect(ROUTE).toMatch(/state: z\.string\(\)\.min\(1\)\.max\(64\),/);
    expect(ROUTE).toMatch(/lastSafeStep: z\.string\(\)\.min\(1\)\.max\(64\),/);
    // 30-day TTL cap — a client cannot ship a 100-year checkpoint.
    expect(ROUTE).toMatch(/ttlMs: z\.number\(\)\.int\(\)\.positive\(\)\.max\(30 \* 24 \* 60 \* 60 \* 1000\)\.optional\(\),/);
  });

  it('GET supports both a single-domain read and a full list', () => {
    expect(ROUTE).toMatch(/router\.get\('\/checkpoints'/);
    expect(ROUTE).toMatch(/const domain = typeof req\.query\.domain === 'string' \? req\.query\.domain : null;/);
    expect(ROUTE).toMatch(/const rows = await listActiveCheckpoints\(uid\);/);
  });

  it('DELETE clears the checkpoint for a domain — used on final wizard commit', () => {
    expect(ROUTE).toMatch(/router\.delete\('\/checkpoints\/:domain'/);
    expect(ROUTE).toMatch(/await clearCheckpoint\(uid, domain\);/);
  });
});

describe('/api/journey/searches (Phase 3 §7)', () => {
  it('POST validates + calls saveSearch', () => {
    expect(ROUTE).toMatch(/const SearchBodySchema = z\.object\(\{/);
    // 180-day TTL cap for saved searches (longer than checkpoints
    // by design — a "still looking?" nudge for a wedding walk in
    // 6 months is reasonable).
    expect(ROUTE).toMatch(/ttlMs: z\.number\(\)\.int\(\)\.positive\(\)\.max\(180 \* 24 \* 60 \* 60 \* 1000\)\.optional\(\),/);
    expect(ROUTE).toMatch(/await saveSearch\(\{\s*\n\s*userUid: uid,/);
  });

  it('GET / DELETE symmetric with checkpoints', () => {
    expect(ROUTE).toMatch(/router\.get\('\/searches'/);
    expect(ROUTE).toMatch(/router\.delete\('\/searches\/:domain'/);
  });
});

describe('/api/journey/favourites (Phase 3 §9 §10)', () => {
  it('POST validates providerId + domain and calls addFavouriteProvider', () => {
    expect(ROUTE).toMatch(/const FavouriteBodySchema = z\.object\(\{\s*\n\s*providerId: z\.string\(\)\.min\(1\)\.max\(200\),\s*\n\s*domain: z\.string\(\)\.min\(1\)\.max\(64\),\s*\n\s*\}\);/);
    expect(ROUTE).toMatch(/await addFavouriteProvider\(\{\s*\n\s*userUid: uid,/);
  });

  it('DELETE removes the star', () => {
    expect(ROUTE).toMatch(/router\.delete\('\/favourites'/);
    expect(ROUTE).toMatch(/await removeFavouriteProvider\(\{\s*\n\s*userUid: uid,/);
  });

  it('GET returns the list (optionally domain-scoped)', () => {
    expect(ROUTE).toMatch(/router\.get\('\/favourites'/);
    expect(ROUTE).toMatch(/await listFavouriteProviders\(uid, domain\);/);
  });

  it('GET :domain/:providerId returns the boolean starred check', () => {
    expect(ROUTE).toMatch(/router\.get\('\/favourites\/:domain\/:providerId'/);
    expect(ROUTE).toMatch(/await isFavouriteProvider\(uid, providerId, domain\);/);
  });
});
