import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * THE FRANCHISE CONSOLE IS NAVIGABLE (2026-09-11)
 *
 * Six franchise pages exist. A franchise owner is redirected to
 * /franchise/dashboard by post-login.ts, so the dashboard was reachable — and
 * the other four were not. Inbox (165 lines), Reports (160), Support (153) and
 * Marketing (79) were ROUTED in App.tsx and linked from nowhere in the entire
 * client. 557 lines of built pages with no way in.
 *
 * The dashboard's only outbound link was /case-queue.
 *
 * TRAP worth recording: MobileBottomNav contains '/franchise/dashboard' and
 * '/franchise', which looks like navigation in a grep. It is an
 * ACCOUNT_HOME_PREFIXES active-state list — it highlights a tab, it routes
 * nobody. Matching the bare path would have called this fixed when it was not.
 */
const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const dashboard = read('client/src/pages/franchise/FranchiseOwnerDashboard.tsx');
const app = read('client/src/App.tsx');
const postLogin = read('server/routes/post-login.ts');

/** A LINK shape, never the bare path — prose and prefix lists route nobody. */
const linksTo = (src: string, path: string) =>
  new RegExp(`href:?\\s*=?\\s*["'\`]${path}["'\`]`).test(src);

const SUBPAGES = ['/franchise/reports', '/franchise/inbox', '/franchise/marketing', '/franchise/support'];

describe('a franchise owner can reach the whole console', () => {
  it.each(SUBPAGES)('the dashboard links to %s', (path) => {
    expect(linksTo(dashboard, path)).toBe(true);
  });

  it.each(SUBPAGES)('%s is still routed', (path) => {
    expect(app).toContain(`path="${path}"`);
  });

  it('franchise owners are still sent to the dashboard that carries the nav', () => {
    // If this destination moves, the navigation has to move with it.
    expect(postLogin).toMatch(/franchise_owner[\s\S]{0,120}\/franchise\/dashboard/);
  });
});
