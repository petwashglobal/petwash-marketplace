/**
 * Member home was scattered (audit 2026-07-24): the server decider sent members
 * to /home, which on WEB renders the MARKETING page — a signed-in member landed
 * on marketing, not their dashboard.
 *
 * 2026-09-18 — RETARGETED. This pinned /prestige/home as the canonical
 * destination. TWO later CEO decisions moved it, and both are product
 * corrections rather than drift:
 *
 *   2026-08-28 — Pet Parent is the base customer workspace; Prestige is a
 *     MEMBERSHIP ENTITLEMENT, not a synonym for "customer". Defaulting a plain
 *     signup to /prestige/home dropped every new user onto a Prestige-branded
 *     landing as if they were already members.
 *   2026-09-03 (Lane A, #2190) — the canonical customer workspace is
 *     /pet-parent/home, and Prestige renders INSIDE it as a badge, never as a
 *     competing destination that forces a customer into a separate auth
 *     universe.
 *
 * So the pin failed the correction. What it exists to prevent is unchanged and
 * is what it guards now: a signed-in customer must never be dropped on the
 * marketing page, and there must be exactly ONE canonical customer home.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const decider = R('server/routes/post-login.ts');
const signup = R('client/src/pages/SignUpLuxury.tsx');

describe('canonical customer home', () => {
  it('the decider sends a completed member to /pet-parent/home', () => {
    expect(decider).toMatch(/return \{ nextUrl: '\/pet-parent\/home', reason: 'OK', profileStatus: 'complete', role, userStatus \};/);
  });

  it('NO completed-profile branch may fall back to the marketing page', () => {
    // The original bug, and the only thing that must never come back.
    expect(decider).not.toMatch(/nextUrl: '\/home', reason: 'OK', profileStatus: 'complete'/);
  });

  it('/prestige/home is not a rival customer home in the decider', () => {
    // Prestige is an entitlement rendered inside the workspace. If it ever
    // becomes a post-login destination again, that is the split-universe
    // regression Lane A closed.
    expect(decider).not.toMatch(/nextUrl: '\/prestige\/home'/);
  });

  it('signup defaults a plain customer to /pet-parent/home, not a members-only landing', () => {
    expect(signup).toMatch(/default: return '\/pet-parent\/home';/);
  });

  it('…but an explicit Prestige ENROLMENT still lands on Prestige', () => {
    // The customer just enrolled and expects to see the benefits they paid for.
    expect(signup).toMatch(/case 'prestige': return '\/prestige\/home';/);
  });
});
