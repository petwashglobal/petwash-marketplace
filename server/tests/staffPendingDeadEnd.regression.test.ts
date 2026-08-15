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
 *     email, returns the caller's most recent staff_applications row or
 *     { application: null } if none exists. Mirrors GET /api/provider-applications/my.
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
 * Sections:
 *   A. Server — /mine endpoint present + declared BEFORE /:id + ownership shape
 *   B. Client — no fetch, no CTAs pre-fix is impossible now
 *   C. Client — every terminal branch has back-home + support CTAs
 *   D. Client — distinct fetch-error branch (with Retry) is present
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
    expect(/or\(\s*eq\(\s*staffApplications\.userId\s*,[\s\S]{0,80}?eq\(\s*staffApplications\.email/.test(code)).toBe(true);
  });

  it('A5. imports the or() operator (dedicated fix — the file previously imported only eq/and/desc)', () => {
    expect(/import\s*\{[^}]*\bor\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/.test(code)).toBe(true);
  });

  it('A6. returns { application } (single row via limit(1) + desc(createdAt), OR null when none)', () => {
    expect(/\.limit\(\s*1\s*\)/.test(code)).toBe(true);
    expect(/desc\(\s*staffApplications\.createdAt\s*\)/.test(code)).toBe(true);
    expect(/const\s+application\s*=\s*rows\[0\]\s*\?\?\s*null/.test(code)).toBe(true);
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
