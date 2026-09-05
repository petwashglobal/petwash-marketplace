/**
 * job-passport.ts §44 route discipline pins.
 *
 * "URL is navigation. AUTHORIZATION IS SERVER DATA." — CEO §44.
 * The route must never trust the URL for actor kind. Composer endpoints
 * are READ-ONLY (§60 Phase 1); handoff endpoints are the ONE allowed
 * mutation surface (§13, §14, §46) and must run through their own
 * discipline pin below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'job-passport.ts'),
  'utf8',
);

describe('job-passport.ts — §44 auth discipline', () => {
  it('composer endpoints are READ-ONLY — only the /handoff/* prefix is POST', () => {
    // Every router.post must sit on a /handoff/* path. No other mutation
    // shape is allowed on this router (composer is READ-ONLY per §60).
    const posts = [...SRC.matchAll(/router\.post\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(posts.length).toBeGreaterThan(0);
    for (const path of posts) {
      expect(path.startsWith('/handoff/')).toBe(true);
    }
    // PATCH / DELETE / PUT never allowed.
    expect(SRC).not.toMatch(/router\.patch\(/);
    expect(SRC).not.toMatch(/router\.delete\(/);
    expect(SRC).not.toMatch(/router\.put\(/);
    // GET routes must exist (composer + handoff status).
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
    // #240 migration: re-pointed from the bare `isSuperAdmin(email)` shape.
    // That shape is the audit-199 DEFECT (allowlist match on the email
    // STRING alone); the route was correctly migrated to
    // isSuperAdminVerified(req) — allowlist AND email_verified === true —
    // so this pin had begun failing against the FIXED code and was telling
    // the next agent to restore the vulnerability. Guarantee unchanged.
    expect(SRC).toMatch(/isSuperAdminVerified\(req as any\)\s*\?\s*['"]PETWASH_STAFF['"]\s*:\s*['"]CUSTOMER['"]/);
    expect(SRC).not.toMatch(/kind\s*=\s*req\.body\./);
    expect(SRC).not.toMatch(/actorKind\s*=\s*req\.body\./);
  });

  it('privacy 404 pattern — unauthorised / not-participant → 404, never a 403', () => {
    expect(SRC).toMatch(/return\s+res\.status\(404\)/);
    expect(SRC.indexOf('NOT_FOUND')).toBeGreaterThan(-1);
    expect(SRC).not.toMatch(/res\.status\(403\)/);
  });

  it('/:jobRef endpoint returns 501 today — the jobRef → bookingId index is Phase 2', () => {
    const jobRefRoute = SRC.slice(SRC.indexOf("router.get('/:jobRef'"), SRC.length);
    expect(jobRefRoute).toMatch(/return\s+res\.status\(501\)/);
    expect(jobRefRoute).toMatch(/JOBREF_INDEX_NOT_READY/);
  });

  it('composeJobPassport call always receives the server-verified viewer', () => {
    const calls = [...SRC.matchAll(/composeJobPassport\(\{[\s\S]*?\}\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const m of calls) {
      const call = m[0];
      expect(call).toMatch(/viewer:/);
      expect(call).toMatch(/viewer:\s*(\{\s*\.\.\.viewer|viewer\b)/);
    }
  });
});

describe('/handoff/* — §13, §14, §46 discipline', () => {
  it('every handoff route goes through the participant-scope guard', () => {
    // passportForParticipant is the ONE way a mutation route can prove
    // the caller belongs on this job. Every /handoff/* handler must
    // await it before touching the credential service.
    const handoffBlock = SRC.slice(SRC.indexOf("router.post('/handoff/"));
    const postHandlers = [
      ...handoffBlock.matchAll(/router\.(post|get)\(\s*['"]\/handoff\/[^'"]+['"][^{]*\{[\s\S]*?\n\}\);/g),
    ];
    expect(postHandlers.length).toBeGreaterThanOrEqual(3);
    for (const m of postHandlers) {
      expect(m[0]).toMatch(/passportForParticipant/);
      // …and the same-shape 404 for non-participants (§34).
      expect(m[0]).toMatch(/status\(404\)/);
    }
  });

  it('purpose whitelist runs BEFORE the participant lookup — no work for bogus purposes', () => {
    // Ban the purpose being read then handed to issueHandoff/verifyHandoff
    // without a HANDOFF_PURPOSES.includes gate above it.
    const issueRoute = SRC.slice(SRC.indexOf("router.post('/handoff/issue'"));
    expect(issueRoute).toMatch(/HANDOFF_PURPOSES\.includes\([\s\S]*?\)/);
    expect(issueRoute).toMatch(/UNKNOWN_PURPOSE/);
  });

  it('issue TTL is CAPPED server-side — never trusts the client value', () => {
    const issueRoute = SRC.slice(SRC.indexOf("router.post('/handoff/issue'"));
    // Math.min(..., 900) is the 15-minute cap. If a refactor lifts this,
    // the credential store's own MAX_TTL_MS still catches it, but the
    // route MUST also enforce so the log line reflects the honest number.
    expect(issueRoute).toMatch(/Math\.min\([\s\S]*?900\b/);
  });

  it('issue response returns the code ONCE and never logs it', () => {
    const issueRoute = SRC.slice(SRC.indexOf("router.post('/handoff/issue'"));
    // Response body carries `code:` — that's the ONE moment the plaintext
    // is exposed. Extract each logger.* call individually and ban any
    // reference to the plaintext code inside its argument list.
    expect(issueRoute).toMatch(/code:\s*cred\.code/);
    const loggerCalls = [...issueRoute.matchAll(/logger\.[a-z]+\(([\s\S]*?)\}\);/g)];
    for (const m of loggerCalls) {
      expect(m[1]).not.toMatch(/cred\.code/);
      expect(m[1]).not.toMatch(/\bcode\s*:/);
    }
  });

  it('verify does not leak WHY the code failed beyond the enumerated errorCode', () => {
    const verifyRoute = SRC.slice(SRC.indexOf("router.post('/handoff/verify'"));
    // The response body only carries {ok:false, errorCode} — never a raw
    // message that could differentiate CODE_NOT_FOUND from CODE_WRONG_JOB
    // in the wire response beyond the enumerated code.
    expect(verifyRoute).toMatch(/errorCode:\s*result\.errorCode/);
    expect(verifyRoute).not.toMatch(/message:\s*result\.message/);
  });
});
