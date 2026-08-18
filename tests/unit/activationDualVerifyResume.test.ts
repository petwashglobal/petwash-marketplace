/**
 * PR-AUTH-CONTACTS-3 regression pins — dual email/mobile verification with
 * resume state driven by the server's activation state machine.
 *
 * Two invariants matter here:
 *
 *  1. The `/activation-status` endpoint MUST derive the user id from an
 *     authenticated session (Bearer id token OR pw_session cookie) — the
 *     earlier `?userId=<uid>` variant let any caller enumerate any user's
 *     activation state. That defect is fixed here and pinned so it cannot
 *     silently re-enter the endpoint.
 *
 *  2. The client (AccountActivation page + ActivationBanner) must let
 *     mobile and email be verified in EITHER order — the previous UI
 *     disabled the email button until the mobile step completed, which
 *     stranded users whose email arrived first (Google/Apple signup) or
 *     hit a transient SMS outage. Resume state comes from the server's
 *     missingSteps, never a client-side session store, so a page reload
 *     or cross-device continuation picks up at the correct pair.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-CONTACTS-3 — server /activation-status auth', () => {
  const routeSrc = read('server/routes/onboarding-verification.ts');

  it('never accepts ?userId=<uid> from the query string on /activation-status', () => {
    // The endpoint block must not read userId from req.query — that was the
    // enumeration door. This regex is scoped to the /activation-status
    // handler so unrelated router uses of req.query are unaffected.
    const handler = routeSrc.match(
      /router\.get\('\/activation-status'[\s\S]*?\n\}\);\n/,
    );
    expect(handler, 'activation-status handler missing').toBeTruthy();
    expect(handler![0]).not.toMatch(/req\.query/);
    expect(handler![0]).not.toMatch(/const \{\s*userId\s*\}\s*=\s*req\.query/);
  });

  it('derives uid from Bearer / pw_session via resolveActivationUid()', () => {
    // The handler must call the local helper, and the helper must exist +
    // support BOTH auth transports (Bearer id token for the SPA + session
    // cookie for the shared web flows). 401 on missing auth (never 400).
    expect(routeSrc).toMatch(/async function resolveActivationUid\(req: Request\): Promise<string \| null>/);
    expect(routeSrc).toMatch(/const uid = await resolveActivationUid\(req\);/);
    expect(routeSrc).toMatch(/if \(!uid\) return res\.status\(401\)/);
    // Both auth branches present in the helper body:
    expect(routeSrc).toMatch(/fbAdmin\.verifyIdToken\(authHeader\.substring\(7\), true\)/);
    expect(routeSrc).toMatch(/fbAdmin\.verifySessionCookie\(sessionCookie, true\)/);
  });
});

describe('PR-AUTH-CONTACTS-3 — client AccountActivation UX', () => {
  const page = read('client/src/pages/AccountActivation.tsx');

  it('queries /activation-status WITHOUT ?userId=<uid> on the wire', () => {
    // The fetch URL must NOT carry userId; server derives it. The uid is
    // kept in the react-query queryKey so cache invalidates on account
    // switch, but it must not appear in the request URL.
    expect(page).not.toMatch(/activation-status\?userId=/);
    // Uses apiRequest (auth-aware wrapper), never bare fetch on this route.
    expect(page).toMatch(
      /apiRequest\("GET", "\/api\/onboarding-verification\/activation-status"\)/,
    );
  });

  it('does NOT gate the email step on mobile completion', () => {
    // The old `disabled={... || !mobileComplete}` prop forced a rigid
    // mobile-first flow. Rebuild removes it so email can be verified in
    // either order — even before mobile, or in parallel from another tab.
    expect(page).not.toMatch(/disabled=\{sendEmailMutation\.isPending \|\| !mobileComplete\}/);
    // Email button disable is now bound only to its own mutation state.
    expect(page).toMatch(/disabled=\{sendEmailMutation\.isPending\}\s*\n/);
  });

  it('renders both verify sections as independently addressable (testids present)', () => {
    // E2E-selectable anchors so the Playwright matrix in PR-AUTH-E2E-8 can
    // drive either step first without depending on visual order.
    expect(page).toContain('data-testid="section-verify-mobile"');
    expect(page).toContain('data-testid="section-verify-email"');
  });

  it('drops the ordered "Step 2 / Step 3" labels', () => {
    // The numbered step headings implied a mandatory sequence. Order-
    // independent labels ("Verify mobile" / "Verify email") make the
    // parallel nature of the two steps legible.
    expect(page).not.toMatch(/Step 2 — Verify mobile/);
    expect(page).not.toMatch(/Step 3 — Activate email/);
  });

  it('renders resume banners keyed on the server-side missingSteps derivation', () => {
    // The resume UX has NO client-side session storage — it re-reads
    // (mobileVerifiedAt, emailVerifiedAt) from the server on every render.
    // A page reload / cross-device continuation therefore picks up at the
    // correct pair without any localStorage or in-memory carry-over.
    expect(page).toContain('data-testid="banner-resume-email"');
    expect(page).toContain('data-testid="banner-resume-mobile"');
    // Explicit "either order" copy so the user isn't left guessing which
    // step they must do first.
    expect(page).toMatch(/complete them\s*\n?\s*in either order/);
  });
});

describe('PR-AUTH-CONTACTS-3 — ActivationBanner query', () => {
  const banner = read('client/src/components/ActivationBanner.tsx');

  it('queries /activation-status WITHOUT ?userId=<uid> on the wire', () => {
    expect(banner).not.toMatch(/activation-status\?userId=/);
    expect(banner).toMatch(
      /apiRequest\("GET", "\/api\/onboarding-verification\/activation-status"\)/,
    );
  });

  it('surfaces a specific label for BOTH missingSteps directions', () => {
    // Old code silently fell through to the email branch when neither
    // exact match landed (implicit else). The rebuild covers mobile-only,
    // email-only, both, and a defensive fallback for the empty-array case.
    expect(banner).toMatch(/const missingMobile = activation\.missingSteps\.includes\("mobile"\)/);
    expect(banner).toMatch(/const missingEmail = activation\.missingSteps\.includes\("email"\)/);
    expect(banner).toMatch(/Verify your mobile number to complete activation/);
    expect(banner).toMatch(/Verify your email to complete activation/);
  });
});
