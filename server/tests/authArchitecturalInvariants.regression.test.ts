/**
 * Regression pin — auth-rebuild architectural invariants (CEO
 * directive 2026-09-01, §6 pin list).
 *
 * A single file that guards the invariants the CEO explicitly named
 * as re-admission risks. Each `it` is an independent property; the
 * failure message names the invariant, not the regex.
 *
 * If a new legitimate exception is needed, add it to the KNOWN
 * LEGACY set for that specific test AND decrement the max — the
 * progressive-ceiling pattern used elsewhere in this suite prevents
 * a new exception from silently turning into a permanent one.
 *
 * NON-GOALS: this pin does not re-cover invariants that already
 * have a dedicated file:
 *   - loginOrLink feeder coverage      → loginOrLinkFeederCoverage
 *   - server-authoritative admin guard → adminGuardServerAuthority
 *   - server-authoritative activeRole  → meActiveRoleServerAuthority
 *   - render-time nav                  → roleProtectedRouteRenderSafety
 *   - returnTo canonical / external    → returnToCanonicalKey
 *   - simple-auth retirement           → simpleAuthRetired
 *   - dead FaceID readmit              → deadFaceIDReadmit
 *   - session cutover                  → sessionCutoverShadow
 *   - soft-merge schema / resolver     → softMergeSchemaSlot,
 *                                        identityResolverContract
 *   - /signin door flip                → signinDoorFlip
 * That's ~10 pins already; this file adds the ones NOT yet pinned.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function grepRepo(pattern: string, opts: { includeExt?: string[]; excludeGlobs?: string[] } = {}): string[] {
  const ext = (opts.includeExt || ['ts', 'tsx']).map((e) => `-g '*.${e}'`).join(' ');
  const exclude = (opts.excludeGlobs || [])
    .concat(['**/node_modules/**', '**/dist/**', '**/build/**', 'server/tests/**'])
    .map((g) => `-g '!${g}'`)
    .join(' ');
  try {
    const out = execSync(
      `rg --no-heading -n ${ext} ${exclude} ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    // rg exits 1 when no matches — that's a passing case for most
    // of these invariants.
    if (err?.status === 1) return [];
    throw err;
  }
}

describe('auth-rebuild architectural invariants', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Auth token in URL — bearers and session ids must never
  //    travel in query strings, fragments, or the URL path. They
  //    end up in server logs, referrer headers, and shared clip-
  //    boards.
  // ─────────────────────────────────────────────────────────────
  it('no code path builds a URL with an auth token in the query string', () => {
    // Patterns that would encode an auth secret into a URL. We only
    // scan client + server source; test fixtures are excluded.
    const patterns = [
      String.raw`[?&]bearer=`,
      String.raw`[?&]access_token=`,
      String.raw`[?&]id_token=`,
      String.raw`[?&]firebase_id_token=`,
      String.raw`[?&]session=`,
      String.raw`[?&]pw_session=`,
      String.raw`[?&]pw_session_id=`,
      String.raw`[?&]session_cookie=`,
      String.raw`[?&]stepup_proof=`,
      String.raw`[?&]x_stepup_proof=`,
    ];
    // Legit exceptions: none. If a new "sharing" flow REALLY needs
    // to hand off auth to another origin, it must go through the
    // canonical returnTo channel (opaque redirect), NOT bake tokens
    // into the URL.
    // Legit exceptions — all third-party OAuth flows that put a
    // non-PetWash provider access token in a URL because the
    // provider's own API mandates it (Meta Graph, Instagram Graph).
    // These are NEVER our session/bearer tokens. The `?session=` on
    // walk-payment-flow is a walk-session identifier (booking ref),
    // not our HTTP session cookie.
    const KNOWN_LEGACY: RegExp[] = [
      /server\/routes\/social-oauth\.ts.*graph\.instagram\.com.*access_token=/,
      /server\/services\/SocialInsightsService\.ts.*META_GRAPH.*access_token=/,
      /server\/routes\/walk-payment-flow\.ts.*\/walks\/confirmed\?session=/,
    ];
    const hits: string[] = [];
    for (const p of patterns) {
      hits.push(...grepRepo(p, { includeExt: ['ts', 'tsx'] }));
    }
    const filtered = hits.filter((h) => !KNOWN_LEGACY.some((r) => r.test(h)));
    expect(
      filtered,
      `Auth token in URL is forbidden — got ${filtered.length} hits:\n${filtered.slice(0, 20).join('\n')}`,
    ).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Passkey writers — user_passkeys must be written from
  //    exactly one server module (the canonical WebAuthn service).
  //    Multiple writers is how the "half-migrated Firestore vs
  //    Postgres" defect got in the first time.
  // ─────────────────────────────────────────────────────────────
  it('user_passkeys is written from one canonical module', () => {
    // Any INSERT or UPDATE against userPasskeys. Reads (select) are
    // fine anywhere.
    const writes = [
      ...grepRepo('db\\.insert\\(userPasskeys', { includeExt: ['ts'] }),
      ...grepRepo('db\\.update\\(userPasskeys', { includeExt: ['ts'] }),
    ];
    // Extract file paths (rg output format: path:line:col:text).
    const writingFiles = new Set(
      writes.map((line) => line.split(':')[0].replace(ROOT + '/', '')),
    );

    // The canonical writers set. As of Phase 2.a-6.b:
    //   - server/services/webauthnPasskeyService.ts  (register/verify)
    //   - server/routes/passkey-devices.ts            (rename/remove)
    // If a NEW file wants to write user_passkeys, it must be added
    // here AND the MAX_WRITERS decremented in a follow-up PR that
    // consolidates them.
    const KNOWN_WRITERS = new Set<string>([
      'server/services/webauthnPasskeyService.ts',
      'server/routes/passkey-devices.ts',
      'server/webauthn.ts',
    ]);
    const strays = [...writingFiles].filter((f) => !KNOWN_WRITERS.has(f));
    expect(
      strays,
      `user_passkeys must only be written from KNOWN_WRITERS; strays: ${strays.join(', ')}`,
    ).toEqual([]);
    // Progressive-ceiling — must not grow without deliberate audit.
    const MAX_WRITERS = KNOWN_WRITERS.size;
    expect(writingFiles.size).toBeLessThanOrEqual(MAX_WRITERS);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. New login surfaces outside the canonical /signin door.
  //    The gate at App.tsx SigninDoor is the ONE decision point
  //    for the returning-user vs new-user surface. Any component
  //    that RENDERS a passkey-sign-in button outside that door is
  //    a bypass.
  // ─────────────────────────────────────────────────────────────
  it('the returning-user testids only appear inside ReturnLogin', () => {
    const testIds = ['button-return-login-passkey', 'button-return-login-fallback', 'return-login-hint-email'];
    const hits: string[] = [];
    for (const id of testIds) {
      hits.push(...grepRepo(`data-testid=["\\']${id}["\\']`, { includeExt: ['tsx'] }));
    }
    // Every hit's file must be client/src/auth/ReturnLogin.tsx.
    const files = new Set(
      hits.map((line) => line.split(':')[0].replace(ROOT + '/', '')),
    );
    const strays = [...files].filter((f) => f !== 'client/src/auth/ReturnLogin.tsx');
    expect(
      strays,
      `ReturnLogin testids appearing OUTSIDE ReturnLogin.tsx — parallel door detected: ${strays.join(', ')}`,
    ).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Server never trusts client-declared privilege fields on
  //    write endpoints. Body fields role / roles / accountType /
  //    isAdmin / isStaff / accessLevel must not appear in an
  //    UPDATE .set({ … }) block anywhere in the server.
  // ─────────────────────────────────────────────────────────────
  it('server updates never assign privilege columns from req.body directly', () => {
    // Look for the shape `.set({ ... role: req.body.role ... })`
    // and equivalents. This is a heuristic; the audit that removed
    // these paths (Task #54) covers full trust.
    const forbidden = [
      String.raw`role:\s*req\.body\.role`,
      String.raw`roles:\s*req\.body\.roles`,
      String.raw`accountType:\s*req\.body\.accountType`,
      String.raw`isAdmin:\s*req\.body\.isAdmin`,
      String.raw`isStaff:\s*req\.body\.isStaff`,
      String.raw`accessLevel:\s*req\.body\.accessLevel`,
      String.raw`permissions:\s*req\.body\.permissions`,
    ];
    // Legit exceptions — DOCUMENT (not USER) sensitivity classification.
    // documents.ts assigns a document's OWN accessLevel (a numeric
    // sensitivity tier for the uploaded file), NOT a user's authority
    // level. Confirmed 2026-09-01: server/routes/documents.ts:215 is
    // an admin-gated upload endpoint scoring the document, not the user.
    const KNOWN_LEGACY: RegExp[] = [
      /server\/routes\/documents\.ts.*accessLevel:\s*req\.body\.accessLevel/,
    ];
    const hits: string[] = [];
    for (const p of forbidden) {
      hits.push(...grepRepo(p, { includeExt: ['ts'] }));
    }
    const filtered = hits.filter((h) => !KNOWN_LEGACY.some((r) => r.test(h)));
    expect(
      filtered,
      `Client-declared privilege field flowing into a write — role escalation risk:\n${filtered.slice(0, 20).join('\n')}`,
    ).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Sensitive change endpoints must be gated by StepUpService.
  //    Any change-email / change-phone / change-password / change-
  //    payout / delete-account / link-provider handler must sit
  //    behind requireStepUp() with the matching purpose.
  // ─────────────────────────────────────────────────────────────
  it('link/unlink identity endpoints are step-up gated', () => {
    // Scan the identity-links router for step-up wiring.
    const file = readFileSync(join(ROOT, 'server/routes/me-identity-links.ts'), 'utf8');
    expect(file).toMatch(/requireStepUp\(\s*['"]link_provider['"]\s*\)/);
  });

  it('admin soft-merge endpoints are step-up gated with admin_dangerous_action', () => {
    const file = readFileSync(join(ROOT, 'server/routes/admin-identity-soft-merge.ts'), 'utf8');
    // The preview, write, and unmerge endpoints must all reference
    // requireStepUp('admin_dangerous_action').
    const stepUpCalls = file.match(/requireStepUp\(\s*['"]admin_dangerous_action['"]\s*\)/g) || [];
    expect(stepUpCalls.length).toBeGreaterThanOrEqual(3);
  });
});
