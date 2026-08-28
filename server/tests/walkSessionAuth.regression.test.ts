/**
 * walk-session.ts §34 live-service participant auth pins.
 *
 * Live walks expose real-time GPS + vital tracking. A cross-user leak
 * here means user A watches user B's dog walk in real time, or a
 * walker checks in on a walk they weren't assigned. The route
 * handlers are already tight; this file pins the discipline so a
 * future refactor cannot loosen it.
 *
 * Rules:
 *   • Every handler sits behind requireAuth.
 *   • Every handler derives the caller uid from req.user (server-
 *     verified by requireAuth), never from req.body / query / params.
 *   • Every service call receives the server uid as an argument —
 *     the walkSessionService does the participant/role join itself
 *     (walker_profiles.walkerId → userId, walk_bookings.ownerId).
 *   • Unauthorised callers get the same "not found" 404 as truly
 *     missing walks (privacy 404 — never confirm existence to a
 *     non-participant).
 *   • Live-location handlers on the /owner/* namespace receive
 *     ownerId from the token — a body-supplied ownerId would let
 *     any authenticated caller watch any owner's walk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'walk-session.ts'),
  'utf8',
);

describe('walk-session.ts — §34 live-service participant auth', () => {
  it('every route uses requireAuth middleware', () => {
    // Extract every router.(post|get|patch|delete) header. The
    // requireAuth token must appear between the route string and
    // the async handler.
    const routes = [
      ...SRC.matchAll(/router\.(get|post|patch|delete)\(\s*(['"])[^'"]+\2[^)]*/g),
    ];
    expect(routes.length).toBeGreaterThanOrEqual(6);
    const misses: string[] = [];
    for (const m of routes) {
      const header = m[0];
      if (!/requireAuth/.test(header)) misses.push(header.slice(0, 120));
    }
    expect(misses, `walk-session routes without requireAuth:\n${misses.join('\n')}`).toEqual([]);
  });

  it('every handler derives caller uid from req.user (never req.body)', () => {
    // The file exclusively uses `req.user?.uid` / `req.user!.uid` for
    // both walkerId and ownerId derivations. A refactor that pulled
    // from req.body would slip past requireAuth's identity guarantee.
    const bodyReads = SRC.match(/(walkerId|ownerId|callerUid)\s*=\s*req\.body\.[a-zA-Z_]+/g);
    expect(bodyReads, `Client-body identity reads in walk-session.ts: ${bodyReads?.join(', ')}`).toBeNull();
    // At least one derivation each of walkerId + ownerId + callerUid
    // must exist and read from req.user.
    expect(SRC).toMatch(/const\s+walkerId\s*=\s*req\.user!?\??\.uid/);
    expect(SRC).toMatch(/const\s+ownerId\s*=\s*req\.user!?\??\.uid/);
    expect(SRC).toMatch(/const\s+callerUid\s*=\s*req\.user\?\.uid/);
  });

  it('every walkSessionService call passes uid — none receive client-supplied identity', () => {
    // Extract every walkSessionService.<method>(...) call and require
    // that a uid-derived variable (walkerId / ownerId / callerUid) is
    // one of the arguments. A call that only passes walkId + body
    // fields would let any authenticated caller resolve any walk.
    const calls = [
      ...SRC.matchAll(/walkSessionService\.[a-zA-Z]+\([^)]*\)/g),
    ];
    expect(calls.length).toBeGreaterThanOrEqual(5);
    const misses: string[] = [];
    for (const m of calls) {
      const call = m[0];
      const hasUidArg = /\b(walkerId|ownerId|callerUid)\b/.test(call);
      if (!hasUidArg) misses.push(call);
    }
    expect(misses, `Service calls without a uid-derived argument:\n${misses.join('\n')}`).toEqual([]);
  });

  it('the /:walkId/active endpoint uses the privacy-404 pattern (no existence leak)', () => {
    // Unauthorised callers must see the same 404 as truly-missing
    // walks. The route file's docstring calls this discipline out
    // explicitly; a refactor that swapped it for 403 leaks existence.
    const activeIdx = SRC.indexOf("router.get('/:walkId/active'");
    expect(activeIdx).toBeGreaterThan(-1);
    const handlerBlock = SRC.slice(activeIdx, activeIdx + 800);
    expect(handlerBlock).toMatch(/return\s+res\.status\(404\)/);
    // Ban a 403 branch on the "no session" path — a 403 would confirm
    // the walk exists but the caller isn't allowed.
    expect(handlerBlock).not.toMatch(/return\s+res\.status\(403\)/);
  });

  it('error handlers never leak error.message to the client (server logs full, client gets stable string)', () => {
    // Console.error the full server-side, respond with a stable generic
    // message. A refactor that surfaces error.message could leak
    // schema / query details to a caller.
    const catchBlocks = SRC.match(/catch\s*\(error\)\s*\{[\s\S]*?\}/g) ?? [];
    expect(catchBlocks.length).toBeGreaterThanOrEqual(4);
    const misses: string[] = [];
    for (const block of catchBlocks) {
      // The response body must NOT include a template interpolation
      // referencing error.message.
      if (/res\.status\([0-9]+\)\.json\(\{[^}]*\$\{error\.message\}/.test(block)) {
        misses.push(block.slice(0, 200).replace(/\s+/g, ' '));
      }
      // Also ban a direct pass-through: { error: error.message }.
      if (/res\.status\([0-9]+\)\.json\(\{[^}]*error:\s*error\.message/.test(block)) {
        misses.push(block.slice(0, 200).replace(/\s+/g, ' '));
      }
    }
    expect(misses, `Catch blocks that leak error.message:\n${misses.join('\n---\n')}`).toEqual([]);
  });
});
