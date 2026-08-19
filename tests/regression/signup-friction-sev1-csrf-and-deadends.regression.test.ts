import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Signup-friction audit (2026-08-19) SEV-1 pins.
//
// #1 CSRF trap: /api/auth/verify-signup-email + /verify-signup-mobile were
//    NOT in AUTH_CSRF_EXEMPT and the client sends the id-token in the JSON
//    body (no Authorization: Bearer header), so the Bearer-skip did NOT
//    fire and the global CSRF gate returned 403 EBADCSRFTOKEN — dead-ending
//    EVERY signup at the "second contact" step introduced by PR #1824.
//
// #2 Dead-end screen: /access-pending rendered no CTA on pending/rejected/
//    null states. A user who landed there had no home button, no way to
//    reach support, no way to sign out — they had to close the tab.

const SERVER_INDEX = readFileSync(
  join(__dirname, '..', '..', 'server', 'index.ts'),
  'utf8',
);
const ACCESS_PENDING = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'pages', 'AccessPending.tsx'),
  'utf8',
);

describe('signup-friction 2026-08-19 SEV-1 fixes', () => {
  it('AUTH_CSRF_EXEMPT includes /api/auth/verify-signup-email', () => {
    expect(SERVER_INDEX).toContain("'/api/auth/verify-signup-email'");
  });

  it('AUTH_CSRF_EXEMPT includes /api/auth/verify-signup-mobile', () => {
    expect(SERVER_INDEX).toContain("'/api/auth/verify-signup-mobile'");
  });

  it('both dual-verify entries sit inside the AUTH_CSRF_EXEMPT set literal', () => {
    // Confirm the entries are inside the Set literal, not stray strings
    // elsewhere in the file. We search for the opening of the set and the
    // next closing bracket, then check the presence in between.
    const start = SERVER_INDEX.indexOf('AUTH_CSRF_EXEMPT = new Set([');
    expect(start).toBeGreaterThan(-1);
    const end = SERVER_INDEX.indexOf(']);', start);
    expect(end).toBeGreaterThan(start);
    const block = SERVER_INDEX.slice(start, end);
    expect(block).toContain("'/api/auth/verify-signup-email'");
    expect(block).toContain("'/api/auth/verify-signup-mobile'");
  });

  it('AccessPending renders a Back-to-Home CTA on every terminal state', () => {
    expect(ACCESS_PENDING).toMatch(/data-testid="button-access-pending-home"/);
  });

  it('AccessPending renders a Contact-support CTA on every terminal state', () => {
    expect(ACCESS_PENDING).toMatch(/data-testid="button-access-pending-support"/);
    // Support target is the real support inbox, not a placeholder.
    expect(ACCESS_PENDING).toContain('support@petwash.co.il');
  });

  it('AccessPending offers Sign-out on the rejected branch', () => {
    expect(ACCESS_PENDING).toMatch(/data-testid="button-access-pending-signout"/);
  });

  it('AccessPending null-request state now has a heading + description, not just a bare line', () => {
    // The old code rendered only `<p>{t.noRequest}</p>` and was labelled a
    // dead end. The fix adds a heading + a paragraph that tells the visitor
    // what to do next.
    expect(ACCESS_PENDING).toMatch(/noRequestDesc/);
  });
});
