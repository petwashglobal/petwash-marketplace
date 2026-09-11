import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * THE STAFF COUNTER TOOL IS REACHABLE (2026-09-11)
 *
 * /staff/scan is the till: scan a customer's card, read their balances, charge
 * for a wash. 381 lines, routed, role-gated to staff — and reachable by
 * nothing. No link anywhere in the client, and no redirect pointed at it.
 *
 * An APPROVED staff member is sent to /admin/dashboard by post-login.ts, and
 * that dashboard offered exactly one link (station control). So a staff member
 * could not open their own till without being told the URL.
 *
 * NOT a bug, and deliberately not "fixed": /staff/pending and /staff/rejected
 * are also unlinked, but they are REDIRECT targets — onboardingGate.ts and
 * post-login.ts send people there. Unlinked is correct for those two. Checking
 * that distinction is why this pin asserts the redirects still exist rather
 * than demanding links for every /staff route.
 */
const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const dashboard = read('client/src/pages/AdminDashboard.tsx');
const app = read('client/src/App.tsx');
const postLogin = read('server/routes/post-login.ts');

/** A LINK shape, never the bare path — prose mentioning a path routes nobody. */
const linksTo = (src: string, path: string) =>
  new RegExp(`(?:to:\\s*|href[:=]\\s*|navigate\\(\\s*|setLocation\\(\\s*)["'\`]${path}`).test(src);

describe('a staff member can open the counter tool', () => {
  it('the admin dashboard — where approved staff land — links to /staff/scan', () => {
    expect(linksTo(dashboard, '/staff/scan')).toBe(true);
  });

  it('the route still exists and is role-gated to staff', () => {
    expect(app).toMatch(/path="\/staff\/scan"/);
    expect(app).toMatch(/minRole="staff"/);
  });

  it('approved staff are still sent to the dashboard that carries the link', () => {
    // If this destination ever changes, the link above has to move with it.
    expect(postLogin).toMatch(/status === 'approved'[\s\S]{0,120}\/admin\/dashboard/);
  });

  it('the two status pages stay redirect-only — they must NOT sprout links', () => {
    // /staff/pending and /staff/rejected are destinations people are SENT to.
    // Linking them from a nav would invite someone to visit a page that only
    // makes sense as the answer to "your application was rejected".
    expect(postLogin).toMatch(/\/staff\/rejected/);
    expect(linksTo(dashboard, '/staff/pending')).toBe(false);
    expect(linksTo(dashboard, '/staff/rejected')).toBe(false);
  });
});
