/**
 * paw-finder.ts §33 participant authorisation pins.
 *
 * Different route file, different pattern from booking-chat.ts —
 * paw-finder authorises via SQL row-level WHERE clauses rather than
 * a read-then-check-in-JS gate. Every mutation MUST be scoped to
 * the caller's uid on the row itself (owner_user_id or
 * requester_user_id), so the DB refuses to touch someone else's row
 * even if a route handler forgot to check.
 *
 * The rule pinned here:
 *   • uid is derived via the local `uid(req)` helper — never from
 *     req.body / req.query / req.params.
 *   • Every UPDATE / DELETE against a paw_finder_* table has a WHERE
 *     clause containing `owner_user_id = $` or `requester_user_id = $`.
 *     A caller can't mutate a row they don't own.
 *   • The uid helper reads from req.user?.uid || req.firebaseUser?.uid,
 *     both of which are server-verified. It never reads req.body.userId.
 *
 * A failure here fires with the exact query block that's missing
 * the row-level scope.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'paw-finder.ts'),
  'utf8',
);

describe('paw-finder.ts — §33 row-level participant auth', () => {
  it('uid helper is server-derived — never trusts client body', () => {
    // The uid helper is a plain function that reads only from the
    // Firebase-verified surfaces on the request object. Allow a
    // TypeScript return-type annotation between the paren list and
    // the opening brace.
    expect(SRC).toMatch(/function\s+uid\(req[^)]*\)[^\{]*\{[\s\S]*?req\.user\?\.uid\s*\|\|\s*req\.firebaseUser\?\.uid/);
    // Ban any assignment shape that would pull uid from client-controlled
    // request surfaces.
    expect(SRC).not.toMatch(/const\s+userId\s*=\s*req\.body\.userId/);
    expect(SRC).not.toMatch(/const\s+userId\s*=\s*req\.query\.userId/);
    expect(SRC).not.toMatch(/const\s+userId\s*=\s*req\.params\.userId/);
  });

  it('every mutating query on paw_finder_contact_requests is scoped by owner OR requester uid', () => {
    // Extract every pool.query block that begins with UPDATE / DELETE
    // and touches paw_finder_contact_requests. Each MUST also include
    // owner_user_id = $ or requester_user_id = $ in its WHERE.
    const re = /pool\.query\(\s*`([^`]+)`/g;
    const misses: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(SRC)) !== null) {
      const body = m[1];
      const first = body.trim().split(/\s+/)[0].toUpperCase();
      const isMutation = first === 'UPDATE' || first === 'DELETE';
      if (!isMutation) continue;
      if (!/paw_finder_contact_requests/i.test(body)) continue;

      const scoped =
        /owner_user_id\s*=\s*\$/i.test(body) ||
        /requester_user_id\s*=\s*\$/i.test(body);
      if (!scoped) {
        misses.push(body.slice(0, 200).replace(/\s+/g, ' '));
      }
    }
    expect(misses, `Unscoped mutation queries:\n${misses.join('\n---\n')}`).toEqual([]);
  });

  it('resolve endpoint on paw_finder_posts delegates to a service that receives uid', () => {
    // The /my/posts/:id/resolve handler delegates to resolvePost(userId, id).
    // The row-level scoping lives in the service; what matters here is that
    // the handler passes the server-derived uid, not a client-supplied value.
    const resolveIdx = SRC.indexOf('/my/posts/:id/resolve');
    expect(resolveIdx).toBeGreaterThan(-1);
    const handlerBlock = SRC.slice(resolveIdx, resolveIdx + 800);
    // uid must be resolved from the helper (not req.body).
    expect(handlerBlock).toMatch(/const\s+userId\s*=\s*uid\(req\)/);
    // Then the service call must pass userId first — a call that drops
    // userId or passes req.params.userId would let the caller resolve
    // someone else's post.
    expect(handlerBlock).toMatch(/resolvePost\(userId,\s*Number\(req\.params\.id\)\)/);
    // Explicit 401 when no uid — a POST with no auth would otherwise
    // fall through as unauthenticated.
    expect(handlerBlock).toMatch(/return\s+res\.status\(401\)/);
  });

  it('every /my/* mutation route sits behind requireAuth middleware', () => {
    // The /my/* namespace is user-scoped by contract. Any mutation
    // there without requireAuth (POST/PATCH/DELETE) is a hole.
    const myRouteMatches = [
      ...SRC.matchAll(/router\.(post|patch|delete)\(\s*(['"])\/my\/[^'"]+\2/g),
    ];
    // The current /my/* mutation surface has at least 4 handlers
    // (resolve, contacts/:id/accept, contacts/:id/decline, notifications/read-all).
    // A regex-miss lowering this would silently drop the auth check.
    expect(myRouteMatches.length).toBeGreaterThanOrEqual(4);
    // For each match, ensure requireAuth appears between the route
    // string and the handler function's opening. That's the same line
    // (Express middleware precedes the handler).
    const misses: string[] = [];
    for (const m of myRouteMatches) {
      const startIdx = m.index ?? 0;
      // Route header ends at the async arrow or function keyword.
      const arrowIdx = SRC.indexOf('async', startIdx);
      const header = SRC.slice(startIdx, arrowIdx);
      if (!/requireAuth/.test(header)) {
        misses.push(header.slice(0, 120));
      }
    }
    expect(misses, `/my/* mutation routes without requireAuth:\n${misses.join('\n')}`).toEqual([]);
  });
});
