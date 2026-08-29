/**
 * Member home was scattered (audit 2026-07-24): the server decider sent members
 * to /home, which on WEB renders the MARKETING page — a signed-in member landed
 * on marketing, not their dashboard.
 *
 * Canonical customer home is now /pet-parent/home per CEO AUTH MASTER §5 §16
 * (2026-08-29): Prestige is an entitlement (a badge on the Pet Parent), not an
 * identity, so a plain-customer signup that landed on /prestige/home framed
 * every new user as if they were already Prestige members. The server decider
 * emits /pet-parent/home for every base-customer branch; only the Prestige
 * signup flow (an active Prestige enrollment) legitimately returns
 * /prestige/home.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const decider = R('server/routes/post-login.ts');
const signup = R('client/src/pages/SignUpLuxury.tsx');

describe('canonical member home', () => {
  it('server decider routes customers to /pet-parent/home, not /home or /prestige/home (CEO §5 §16)', () => {
    // The "complete customer" exit line — every complete customer path
    // terminates here (or an equivalent). It MUST NOT ship /home
    // (marketing) or /prestige/home (Prestige-framed).
    expect(decider).toMatch(/return \{ nextUrl: '\/pet-parent\/home', reason: 'OK', profileStatus: 'complete', role, userStatus \};/);
    expect(decider).not.toMatch(/nextUrl: '\/home', reason: 'OK', profileStatus: 'complete'/);
    expect(decider).not.toMatch(/nextUrl: '\/prestige\/home', reason: 'OK', profileStatus: 'complete'/);
  });
  it('client destForFlow: Prestige signup keeps /prestige/home; base default goes to /pet-parent/home', () => {
    // Prestige signup (an ACTIVE Prestige enrollment) legitimately
    // returns /prestige/home — the customer just enrolled and expects
    // their new benefits.
    expect(signup).toMatch(/case 'prestige': return '\/prestige\/home';/);
    // Base default (plain customer signup) — canonical customer home.
    expect(signup).toMatch(/default: return '\/pet-parent\/home';/);
    // Base default MUST NOT fall back to /prestige/home.
    expect(signup).not.toMatch(/default: return '\/prestige\/home';/);
  });
});
