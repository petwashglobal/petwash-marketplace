/**
 * PR-AUTH-FIX-STAFFPENDING-DEADEND — StaffPending is no longer a
 * static dead-end.
 *
 * Agent A HIGH #5 (2026-08-15). The pre-fix client/src/pages/StaffPending.tsx
 * was a stub — a single "your access request is being reviewed"
 * message with only a "Back to Home" button, and NO server fetch. A
 * user whose application had been REJECTED still saw "pending"
 * forever with no path forward; an APPROVED user landed on the same
 * dead-end. Same class of bug as PR-AUTH-FIX-DEADEND-SCREENS #4 fixed
 * for AccessPending (see server/tests/authDeadEndScreens.regression.test.ts).
 *
 * Fix:
 *   server/routes/staff-onboarding.ts — new GET /api/staff/applications/mine
 *     endpoint (declared BEFORE the /:id route so Express doesn't parse
 *     "mine" as an integer id). requireAuth-gated, matches on userId OR
 *     verified email, returns an EXPLICITLY-PROJECTED subset of the caller's
 *     most recent staff_applications row (or { application: null }) —
 *     mirrors GET /api/provider-applications/my.
 *   client/src/pages/StaffPending.tsx — rewritten as a state-aware page
 *     that fetches /api/staff/applications/mine and renders SEVEN branches
 *     (pending / documents_required / under_review / background_check /
 *     approved / rejected / no-application) plus a DISTINCT fetch-error
 *     branch — so a plain network blip no longer reads as "you were
 *     never in the queue". EVERY branch has CTAs (Back Home + Contact
 *     Support; plus branch-appropriate Refresh / Retry / Apply). Every
 *     button/link carries a data-testid so this test can pin it and no
 *     future refactor can silently strip a CTA.
 *
 * SECURITY PATCH (same PR, 2026-08-15) — two blockers found on review:
 *   BLOCKER 1: email fallback must require Firebase email_verified === true
 *     (an unverified email is caller-controllable — anyone can sign up
 *     with any address without confirming — so trusting it here would
 *     let a squatting sign-up read a real person's pre-signup application);
 *     case-insensitive EXACT equality via lower(col) = lower(val), NOT
 *     ILIKE (whose `_` and `%` are wildcards that would match unintended
 *     rows); never accept caller identity from req.query / req.params /
 *     req.body.
 *   BLOCKER 2: replace db.select() (whole row) with an EXPLICIT projection
 *     — do NOT expose dateOfBirth / address / taxId / bank* / notes /
 *     reviewer / fraud / criminal / references / formData / any other
 *     internal review field via /mine. Only surface { id, applicationType,
 *     status, rejectionReason, submittedAt, reviewedAt, approvedAt }.
 *
 * Sections:
 *   A. Server — /mine endpoint present + declared BEFORE /:id + ownership shape
 *   B. Client — no fetch, no CTAs pre-fix is impossible now
 *   C. Client — every terminal branch has back-home + support CTAs
 *   D. Client — distinct fetch-error branch (with Retry) is present
 *   E. Server — SECURITY: email fallback gated on email_verified, exact
 *      case-insensitive comparison, no caller-identity leak channels
 *   F. Server — SECURITY: explicit projection blocks internal / sensitive fields
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const SERVER = 'server/routes/staff-onboarding.ts';
const CLIENT = 'client/src/pages/StaffPending.tsx';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. Server — /api/staff/applications/mine endpoint
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — A. server /mine endpoint', () => {
  const src = read(SERVER);
  const code = codeOnly(src);

  it('A1. file exists', () => {
    expect(existsSync(resolve(ROOT, SERVER))).toBe(true);
  });

  it('A2. GET /api/staff/applications/mine is registered', () => {
    expect(
      /app\.get\(\s*['"]\/api\/staff\/applications\/mine['"]\s*,\s*requireAuth\s*,/.test(code),
    ).toBe(true);
  });

  it('A3. /mine is declared BEFORE /:id (else Express treats "mine" as an integer id and 404s)', () => {
    const mineIdx = code.search(/app\.get\(\s*['"]\/api\/staff\/applications\/mine['"]/);
    const idIdx = code.search(/app\.get\(\s*['"]\/api\/staff\/applications\/:id['"]/);
    expect(mineIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(mineIdx).toBeLessThan(idIdx);
  });

  it('A4. matches on userId OR email (email fallback preserves connection when app was submitted before signup)', () => {
    // The endpoint must not narrow to userId only — staffApplications.userId
    // is nullable and an application may exist under the email alone.
    // Note: the email comparison itself now uses sql`lower(...)=lower(...)`
    // (see section E) — the OR structure with eq(userId) as the first arm
    // remains, which is what this pin captures.
    expect(/or\(\s*eq\(\s*staffApplications\.userId\s*,[\s\S]{0,200}?staffApplications\.email/.test(code)).toBe(true);
  });

  it('A5. imports the or() AND sql operators (or for the disjunction, sql for lower(...)=lower(...) exact-match)', () => {
    expect(/import\s*\{[^}]*\bor\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/.test(code)).toBe(true);
    expect(/import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/.test(code)).toBe(true);
  });

  it('A6. returns { application } (single row via limit(1) + desc(createdAt), OR null when none)', () => {
    expect(/\.limit\(\s*1\s*\)/.test(code)).toBe(true);
    expect(/desc\(\s*staffApplications\.createdAt\s*\)/.test(code)).toBe(true);
    expect(/const\s+application\s*=\s*rows\[0\]\s*\?\?\s*null/.test(code)).toBe(true);
    // Contract stays { success: true, application: <row-or-null> } — the
    // client's fetch-error branch depends on the response shape being
    // stable (a change here would silently mask errors as "no application").
    expect(/return\s+res\.json\(\s*\{\s*success:\s*true\s*,\s*application\s*\}\s*\)/.test(code)).toBe(true);
  });

  it('A7. requires authentication — never returns another user\'s application', () => {
    // Pre-fix bypass check: /mine must never accept a userId from the query
    // string (that would let anyone fetch anyone else's application).
    const mineBlock =
      code.match(/app\.get\(\s*['"]\/api\/staff\/applications\/mine['"][\s\S]*?^\s*\}\s*\);/m)?.[0] || '';
    expect(mineBlock.includes('req.query')).toBe(false);
    expect(mineBlock.includes('req.params')).toBe(false);
    // userId must come from the authenticated request, not the body/query.
    expect(/getAuthenticatedUserId\(\s*req\s*\)/.test(mineBlock)).toBe(true);
    expect(/return\s+res\.status\(\s*401\s*\)/.test(mineBlock)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Client — is now state-aware (no static stub)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — B. client no longer a static stub', () => {
  const src = read(CLIENT);
  const code = codeOnly(src);

  it('B1. fetches /api/staff/applications/mine (the whole point — pre-fix did NO fetch)', () => {
    expect(src.includes('/api/staff/applications/mine')).toBe(true);
  });

  it('B2. sends a Firebase Bearer token with the fetch (authenticated caller only)', () => {
    expect(/user\.getIdToken\(\)/.test(code)).toBe(true);
    expect(/Authorization:\s*`Bearer\s*\$\{token\}`/.test(src)).toBe(true);
  });

  it('B3. tracks distinct fetchState (network error must not read as "no application")', () => {
    expect(/const\s*\[\s*fetchState\s*,\s*setFetchState\s*\]/.test(code)).toBe(true);
    expect(/setFetchState\s*\(\s*['"]error['"]\s*\)/.test(code)).toBe(true);
  });

  it('B4. renders every staff_applications.status value the schema defines', () => {
    // schema.ts line 7511: pending, documents_required, under_review,
    // background_check, approved, rejected. Missing any of these would
    // leave a user stuck on a blank card.
    for (const s of [
      'pending',
      'documents_required',
      'under_review',
      'background_check',
      'approved',
      'rejected',
    ]) {
      expect(new RegExp(`status\\s*===\\s*['"]${s}['"]`).test(code)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Client — every terminal branch has CTAs
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — C. CTAs on every branch', () => {
  const src = read(CLIENT);

  it('C1. Back Home CTA present (multiple instances — one per branch)', () => {
    const matches = (src.match(/data-testid="button-back-home"/g) || []).length;
    // 7 rendered branches minimum (pending/docs/under_review/background/
    // approved/rejected/no-app/error) — allow >=7 to give room for the
    // error branch too.
    expect(matches).toBeGreaterThanOrEqual(7);
  });

  it('C2. Contact Support link present (mailto:support@petwash.co.il) on every branch', () => {
    expect(src.includes('mailto:support@petwash.co.il')).toBe(true);
    const matches = (src.match(/data-testid="link-support"/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(7);
  });

  it('C3. no-application branch offers an Apply CTA that routes to /careers/apply', () => {
    expect(src).toContain('data-testid="button-apply"');
    expect(src).toContain("setLocation('/careers/apply')");
  });

  it('C4. pending / review / background_check branches have a Refresh CTA (retryTick refetch)', () => {
    expect(src).toContain('data-testid="button-refresh-status"');
    expect(/setRetryTick\s*\(/.test(src)).toBe(true);
  });

  it('C5. rejected branch surfaces the rejection reason (not a bare "not approved" wall)', () => {
    expect(/app\?\.rejectionReason\b/.test(src)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Client — distinct fetch-error branch with Retry
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — D. distinct fetch-error branch', () => {
  const src = read(CLIENT);
  const code = codeOnly(src);

  it('D1. status===null AND fetchState===\'error\' is its OWN branch (not collapsed to no-app)', () => {
    expect(/status\s*===\s*null\s*&&\s*fetchState\s*===\s*['"]error['"]/.test(code)).toBe(true);
  });

  it('D2. status===null AND fetchState===\'ok\' is a SEPARATE branch (no-application)', () => {
    expect(/status\s*===\s*null\s*&&\s*fetchState\s*===\s*['"]ok['"]/.test(code)).toBe(true);
  });

  it('D3. fetch-error branch has an explicit Retry CTA', () => {
    expect(src).toContain('data-testid="button-retry"');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. SECURITY — email fallback requires verified email, exact case-
//    insensitive equality, no caller-identity leak channels
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — E. security: email fallback + identity source', () => {
  const src = read(SERVER);
  const code = codeOnly(src);

  // Extract the /mine handler body so the pins can't be satisfied by
  // some unrelated block elsewhere in the (long) file.
  const mineBlock =
    code.match(/app\.get\(\s*['"]\/api\/staff\/applications\/mine['"][\s\S]*?^\s*\}\s*\);/m)?.[0] || '';

  it('E1. /mine handler was located (source pins that follow are meaningful)', () => {
    expect(mineBlock.length).toBeGreaterThan(0);
  });

  it('E2. requires Firebase email_verified === true before using email fallback', () => {
    // The whole point of BLOCKER 1: an unverified Firebase email is
    // caller-controllable — anyone can sign up with any address. Reading
    // rows by an unverified email would let a squatting sign-up see a
    // real person's pre-signup application.
    expect(/email_verified\s*===\s*true/.test(mineBlock)).toBe(true);
    // The variable must actually GATE the email fallback (not just be
    // computed and ignored). Pin that `verifiedEmail` is the source the
    // WHERE clause branches on.
    expect(/const\s+verifiedEmail\s*=/.test(mineBlock)).toBe(true);
    expect(/verifiedEmail\s*\?/.test(mineBlock)).toBe(true);
  });

  it('E3. email comparison uses case-insensitive EXACT equality (lower=lower), NOT ILIKE', () => {
    // ILIKE treats `_` and `%` as wildcards — using it here (with the
    // stored email or a caller-controlled email on either side) would
    // match unintended rows. Pin the exact lower(...)=lower(...) shape,
    // and pin the ABSENCE of ILIKE in the /mine handler.
    expect(/sql`lower\(\s*\$\{\s*staffApplications\.email\s*\}\s*\)\s*=\s*lower\(\s*\$\{\s*verifiedEmail\s*\}\s*\)`/.test(mineBlock)).toBe(true);
    expect(/\bilike\b/i.test(mineBlock)).toBe(false);
  });

  it('E4. handler NEVER reads caller identity from req.query / req.params / req.body', () => {
    // Any of these would let the caller declare which user they are,
    // bypassing the authenticated uid. Pin the ABSENCE.
    expect(mineBlock.includes('req.query')).toBe(false);
    expect(mineBlock.includes('req.params')).toBe(false);
    expect(mineBlock.includes('req.body')).toBe(false);
  });

  it('E5. caller uid comes ONLY from getAuthenticatedUserId(req)', () => {
    // The authoritative source. Pin that this is the ONLY thing feeding
    // the userId used in the WHERE clause.
    expect(/const\s+userId\s*=\s*getAuthenticatedUserId\(\s*req\s*\)/.test(mineBlock)).toBe(true);
    expect(/eq\(\s*staffApplications\.userId\s*,\s*String\(\s*userId\s*\)\s*\)/.test(mineBlock)).toBe(true);
    // Fail-closed 401 when no authenticated uid — never silently fall
    // through to some other identity source.
    expect(/return\s+res\.status\(\s*401\s*\)/.test(mineBlock)).toBe(true);
  });

  it('E6. UID-only path is used when the email is not verified (fallback is opt-IN on verification, not opt-OUT)', () => {
    // The ternary branch: `verifiedEmail ? or(...) : eq(userId)`. Pin
    // the eq(userId)-only ELSE arm exists — an unverified email caller
    // gets ONLY the uid lookup, never the email lookup.
    expect(/verifiedEmail\s*\?\s*or\([\s\S]*?\)\s*:\s*eq\(\s*staffApplications\.userId\s*,\s*String\(\s*userId\s*\)\s*\)/.test(mineBlock)).toBe(true);
  });

  it('E7. requires the caller to be authenticated (requireAuth middleware still present)', () => {
    // Sanity — the whole endpoint definition must still be gated.
    // If someone drops requireAuth here in a future refactor, this test
    // catches it BEFORE the endpoint becomes anonymous-readable.
    expect(/app\.get\(\s*['"]\/api\/staff\/applications\/mine['"]\s*,\s*requireAuth\s*,/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. SECURITY — explicit projection blocks internal / sensitive fields
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-STAFFPENDING-DEADEND — F. security: explicit projection', () => {
  const src = read(SERVER);
  const code = codeOnly(src);

  const mineBlock =
    code.match(/app\.get\(\s*['"]\/api\/staff\/applications\/mine['"][\s\S]*?^\s*\}\s*\);/m)?.[0] || '';

  // The ONLY fields the StaffPending client consumes — anything else
  // that a hypothetical review process might add to the row must NOT
  // leak through /mine.
  const ALLOWED_FIELDS = [
    'id',
    'applicationType',
    'status',
    'rejectionReason',
    'submittedAt',
    'reviewedAt',
    'approvedAt',
  ];

  // Fields present on staff_applications (or plausibly added later)
  // that MUST NOT leak — matches the reviewer's list verbatim.
  const FORBIDDEN_FIELDS = [
    'dateOfBirth',
    'address',
    'taxId',
    'bankAccountName',
    'bankAccountNumber',
    'bankRoutingNumber',
    'notes',
    'reviewerNotes',
    'fraudRiskScore',
    'shortlistScore',
    'shortlistRecommendation',
    'shortlistFlags',
    'criminalRecord',
    'references',
    'formData',
    // Also block a few more that exist on the current schema and would
    // similarly be inappropriate for /mine: identity + banking chain.
    'firstName',
    'lastName',
    'phone',
    'businessName',
    'businessLicense',
    'reviewedBy',
  ];

  it('F1. handler was located (source pins that follow are meaningful)', () => {
    expect(mineBlock.length).toBeGreaterThan(0);
  });

  it('F2. does NOT use unprojected db.select() (the pre-patch bug)', () => {
    // Pre-patch: `db.select().from(staffApplications)` — returns whole
    // row. Post-patch: `db.select({ ... }).from(staffApplications)` —
    // shape argument. Pin absence of the bare-select pattern.
    expect(/db\s*\.\s*select\(\s*\)\s*\.from\(\s*staffApplications\s*\)/.test(mineBlock)).toBe(false);
    // And pin PRESENCE of a shape argument.
    expect(/db\s*\n?\s*\.\s*select\(\s*\{[\s\S]*?\}\s*\)\s*\.from\(\s*staffApplications\s*\)/.test(mineBlock)).toBe(true);
  });

  it('F3. projection contains ONLY the seven allowed fields (allow-list, not deny-list)', () => {
    // Extract the shape object literal inside the .select({...}) call.
    const shape =
      mineBlock.match(/\.select\(\s*(\{[\s\S]*?\})\s*\)\s*\.from\(\s*staffApplications\s*\)/)?.[1] || '';
    expect(shape.length).toBeGreaterThan(0);
    const declaredKeys = Array.from(shape.matchAll(/^\s*(\w+)\s*:\s*staffApplications\./gm)).map(m => m[1]);
    // Every declared key must be in the allow-list.
    for (const k of declaredKeys) {
      expect(ALLOWED_FIELDS).toContain(k);
    }
    // And every allow-listed key must be declared.
    for (const k of ALLOWED_FIELDS) {
      expect(declaredKeys).toContain(k);
    }
  });

  it('F4. no forbidden internal / sensitive field name appears inside the /mine handler', () => {
    // Grep the handler body for each forbidden identifier. Even
    // referencing one (e.g. via staffApplications.taxId) should not
    // happen in this handler — the shape must not accidentally include
    // it, no filter must accidentally read it into a variable, no log
    // line must accidentally echo it.
    for (const f of FORBIDDEN_FIELDS) {
      const re = new RegExp(`\\b${f}\\b`);
      if (re.test(mineBlock)) {
        throw new Error(`Forbidden field "${f}" appears inside GET /api/staff/applications/mine handler`);
      }
    }
    // Reach for a positive assertion so the counter increments.
    expect(true).toBe(true);
  });

  it('F5. client interface documents ONLY the projected fields (contract stays in sync)', () => {
    // If the server projection is tightened but the client interface
    // still lists a removed field, TypeScript would happily read
    // undefined and render blanks. Pin that the StaffApplication
    // interface in StaffPending.tsx matches the projection exactly.
    const clientSrc = read(CLIENT);
    const iface =
      clientSrc.match(/interface\s+StaffApplication\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(iface.length).toBeGreaterThan(0);
    const declared = Array.from(iface.matchAll(/^\s*(\w+)\s*:/gm)).map(m => m[1]);
    for (const k of declared) {
      expect(ALLOWED_FIELDS).toContain(k);
    }
    for (const k of ALLOWED_FIELDS) {
      expect(declared).toContain(k);
    }
  });
});
