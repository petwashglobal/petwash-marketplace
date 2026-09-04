/**
 * Prestige enrollment loop — P0 LIVE FIX regression pins.
 *
 * CEO 2026-08-29: an already-signed-in Pet Parent who clicked
 * "Join PetWash Prestige" from /pet-parent/home was navigated to
 * /loyalty/join, which unconditionally redirected to /signup?flow=prestige,
 * where the post-login resolver bounced them back to /pet-parent/home
 * without enrolling. The user experienced this as a loop.
 *
 * These pins lock the shape of the fix so a regression to the routing
 * or the enrollment component surfaces in vitest, not just in a
 * user-visible browser bug.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT_SRC = path.resolve(__dirname, '..', '..', 'client', 'src');

const APP = fs.readFileSync(path.resolve(CLIENT_SRC, 'App.tsx'), 'utf8');
const HOME = fs.readFileSync(path.resolve(CLIENT_SRC, 'pages', 'PrestigeHome.tsx'), 'utf8');
const ROUTER = fs.readFileSync(path.resolve(CLIENT_SRC, 'pages', 'LoyaltyJoinRouter.tsx'), 'utf8');
const ENROLL = fs.readFileSync(path.resolve(CLIENT_SRC, 'pages', 'PrestigeEnroll.tsx'), 'utf8');

describe('CEO P0 §1 — signed-in user must never be sent to /signup for Prestige', () => {
  it('/loyalty/join, /privilege, /vito render LoyaltyJoinRouter (NOT a raw Redirect)', () => {
    // Two of the three shapes together prevent regression to the
    // unconditional Redirect that caused the live loop.
    expect(APP).toMatch(/<Route path="\/loyalty\/join">[\s\S]{0,200}<LoyaltyJoinRouter/);
    expect(APP).toMatch(/<Route path="\/privilege">[\s\S]{0,200}<LoyaltyJoinRouter/);
    expect(APP).toMatch(/<Route path="\/vito">[\s\S]{0,200}<LoyaltyJoinRouter/);
  });

  it('none of the three routes still carry the unconditional /signup?flow=prestige redirect', () => {
    // The bug shape: <Route path="/loyalty/join">{()=>Redirect to signup}
    // If someone reintroduces that pattern this pin flags it.
    for (const route of ['/loyalty/join', '/privilege', '/vito']) {
      const escaped = route.replace(/\//g, '\\/');
      const re = new RegExp(
        `<Route path="${escaped}">[\\s\\S]{0,300}<Redirect to=[\\s\\S]{0,120}signup\\?flow=prestige`,
      );
      expect(APP).not.toMatch(re);
    }
  });

  it('router is a lazy import so it participates in the app bundle graph', () => {
    expect(APP).toMatch(/const LoyaltyJoinRouter = lazy\(\(\) => import\("@\/pages\/LoyaltyJoinRouter"\)\)/);
    expect(APP).toMatch(/const PrestigeEnroll = lazy\(\(\) => import\("@\/pages\/PrestigeEnroll"\)\)/);
  });
});

describe('CEO P0 §2 — /prestige/enroll is the ONE authenticated enrollment destination', () => {
  it('App mounts /prestige/enroll behind RequireAuth with PrestigeEnroll', () => {
    expect(APP).toMatch(
      /<Route path="\/prestige\/enroll">[\s\S]{0,300}<RequireAuth>[\s\S]{0,80}<PrestigeEnroll[\s\S]{0,80}<\/RequireAuth>/,
    );
  });

  it('LoyaltyJoinRouter routes an authenticated non-Prestige user to /prestige/enroll', () => {
    // The whole point of the fix — the signed-in user goes IN-APP,
    // never through /signup.
    expect(ROUTER).toMatch(/Redirect to="\/prestige\/enroll"/);
    // And an already-Prestige user goes to the member surface.
    expect(ROUTER).toMatch(/Redirect to="\/prestige-club"/);
  });

  it('LoyaltyJoinRouter reads user + whoami before deciding — never blind /signup route', () => {
    expect(ROUTER).toMatch(/useFirebaseAuth\(\)/);
    expect(ROUTER).toMatch(/useWhoami\(\)/);
    // Signed-out branch still routes to /signup, but WITH the redirect
    // intent so the user comes back to /prestige/enroll after auth.
    expect(ROUTER).toMatch(
      /!user[\s\S]{0,600}\/signup\?flow=prestige[\s\S]{0,200}redirect=[\s\S]{0,200}\/prestige\/enroll/,
    );
  });

  it('LoyaltyJoinRouter waits for auth-loading before routing (no accidental /signup during hydration)', () => {
    expect(ROUTER).toMatch(/authLoading[\s\S]{0,200}animate-spin/);
    expect(ROUTER).toMatch(/whoamiLoading[\s\S]{0,200}animate-spin/);
  });
});

describe('CEO P0 §3 — Pet Parent home CTA goes DIRECT to /prestige/enroll', () => {
  it('Join CTA navigates to /prestige/enroll, not /loyalty/join', () => {
    // The Join button used to point at /loyalty/join, which even after
    // the router fix costs one extra client-side redirect for the
    // common signed-in case. CEO §11 "one destination authority" —
    // the button in the app knows the user is signed in already.
    expect(HOME).toMatch(/navigate\(['"]\/prestige\/enroll['"]\)[\s\S]{0,200}data-testid="prestige-join-cta"/);
    // And the deprecated destination is gone from this CTA.
    const ctaIdx = HOME.indexOf('data-testid="prestige-join-cta"');
    expect(ctaIdx).toBeGreaterThan(0);
    // Look at the 400 chars around the CTA for the deprecated path.
    const window = HOME.slice(Math.max(0, ctaIdx - 400), ctaIdx + 100);
    expect(window).not.toMatch(/navigate\(['"]\/loyalty\/join['"]\)/);
  });
});

describe('CEO P0 §4 — enrollment reuses canonical account data', () => {
  it('PrestigeEnroll reads name/email/phone from whoami — never asks the user to type them', () => {
    // The whole design principle: existing customer, don't re-collect
    // fields the server already has (CEO §3).
    expect(ENROLL).toMatch(/useWhoami\(\)/);
    expect(ENROLL).toMatch(/w\.displayName/);
    expect(ENROLL).toMatch(/w\.email/);
    expect(ENROLL).toMatch(/w\.phone/);
    // There is no editable text input for first/last name / email / phone.
    expect(ENROLL).not.toMatch(/<input[^>]*type=["']email["']/);
    expect(ENROLL).not.toMatch(/<input[^>]*type=["']tel["']/);
    expect(ENROLL).not.toMatch(/<input[^>]*type=["']password["']/);
    expect(ENROLL).not.toMatch(/<input[^>]*type=["']date["']/);
  });

  it('PrestigeEnroll POSTs the server-authoritative /api/prestige/join endpoint', () => {
    expect(ENROLL).toMatch(/apiRequest\(['"]POST['"], ['"]\/api\/prestige\/join['"]/);
  });

  it('PrestigeEnroll invalidates whoami + capabilities on success', () => {
    // Otherwise the Join CTA would still appear on the next home render.
    expect(ENROLL).toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[['"]\/api\/session\/whoami['"]\]/);
    expect(ENROLL).toMatch(/invalidateQueries\(\{\s*queryKey:\s*\[['"]\/api\/me\/capabilities['"]\]/);
  });

  it('already-Prestige users are redirected off /prestige/enroll to /prestige-club', () => {
    expect(ENROLL).toMatch(
      /prestigeStatus === ['"]active['"][\s\S]{0,120}Redirect to="\/prestige-club"/,
    );
  });

  it('post-success navigation defaults to /pet-parent/home and safely honors ?returnTo=', () => {
    expect(ENROLL).toMatch(/\/pet-parent\/home/);
    // Open-redirect guard: the hand-rolled inline check
    //   redirect.startsWith('/') && !redirect.startsWith('//')
    // was replaced (Phase 8.b, 2026-09-01) by the shared readReturnTo() helper
    // in client/src/auth/returnTo.ts, which runs isSafeReturnTarget():
    // rejects protocol-relative '//', an embedded '/https:' scheme, CRLF
    // header-splitting chars, and over-long targets. Strictly stronger than
    // the two-clause inline test, and one implementation for every surface.
    expect(ENROLL).toMatch(/readReturnTo\(window\.location\.search\)\s*\|\|\s*['"]\/pet-parent\/home['"]/);
    expect(ENROLL).toMatch(/from\s+['"]@\/auth\/returnTo['"]|from\s+['"].*auth\/returnTo['"]/);
  });

  it('emits PRESTIGE_ENROLLMENT_OPENED + _SUBMITTED analytics markers (CEO §16)', () => {
    expect(ENROLL).toMatch(/PRESTIGE_ENROLLMENT_OPENED/);
    expect(ENROLL).toMatch(/PRESTIGE_ENROLLMENT_SUBMITTED/);
  });
});

describe('CEO P0 §7 — server derives identity from Firebase Bearer, not the body', () => {
  it('prestige-join handler reads uid from req.firebaseUser (not req.body)', () => {
    // Reads the SERVER endpoint the client posts to and confirms the
    // identity axis has not regressed to reading from body input.
    const HANDLER = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes', 'prestige-join.ts'),
      'utf8',
    );
    expect(HANDLER).toMatch(/const userId = \(req as any\)\.firebaseUser\?\.uid/);
    // A body-supplied uid or firebaseUid would be an identity-spoofing gap.
    expect(HANDLER).not.toMatch(/req\.body\.(?:uid|firebaseUid)/);
  });
});
