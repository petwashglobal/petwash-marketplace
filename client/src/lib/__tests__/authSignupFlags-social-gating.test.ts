/**
 * Social sign-in providers are ALL ON by CEO decision (2026-06-28) — every
 * method is shown so customers can pick any. They remain individually gated by a
 * VITE_AUTH_SIGNUP_*_ENABLED env flag (an operator can force any off per-env),
 * and each is still wired through GRACEFUL error handling: a provider that
 * isn't configured yet (Firebase console / OAuth secrets missing) returns an
 * honest message, never a crash or silent dead tap.
 *
 * So the guardrail changed from "must be OFF" to "may be ON, but MUST degrade
 * gracefully + stay flag-controllable". Source-introspection so a regression
 * (un-gating, or removing the graceful handler) fails CI.
 *
 * REPOINTS (do not restore the old paths):
 *   - The old white SignIn.tsx page was KILLED in #1139 — ALL login was
 *     unified onto the premium screen (SignUpLuxury.tsx). The /signin gating
 *     suite is gone with it.
 *   - The graceful Firebase auth-error handling was CENTRALIZED into
 *     client/src/auth/client.ts (a code -> honest-message map). Any
 *     unmapped code degrades to a generic "Sign-in failed. Please try
 *     again." message — still no crash.
 *   - TikTok is no longer a Firebase button; it goes through the
 *     server-mediated socialExternal('tiktok') OAuth path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = path.resolve(__dirname, '..', '..');
const flagsSrc = fs.readFileSync(path.join(CLIENT, 'lib', 'authSignupFlags.ts'), 'utf8');
const signupSrc = fs.readFileSync(path.join(CLIENT, 'pages', 'SignUpLuxury.tsx'), 'utf8');
const authClientSrc = fs.readFileSync(path.join(CLIENT, 'auth', 'client.ts'), 'utf8');

describe('authSignupFlags — all providers ON but flag-controllable', () => {
  it('facebook/instagram/tiktok use on() (CEO 2026-06-28; force off only via env === "false")', () => {
    expect(flagsSrc).toMatch(/facebookSignin:\s*on\('VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/instagramSignin:\s*on\('VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/tiktokSignin:\s*on\('VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED'\)/);
  });
});

describe('auth/client — unconfigured providers degrade gracefully (no dead crash)', () => {
  it('maps the not-configured Firebase auth code to an honest message, never a crash', () => {
    // operation-not-allowed = the provider exists in code but is not enabled
    // in the Firebase console. It must resolve to an honest, non-crash message.
    expect(authClientSrc).toContain("'auth/operation-not-allowed'");
    expect(authClientSrc).toMatch(/not enabled|not configured|switched on/i);
    // Any unmapped code still degrades to a generic non-crash fallback.
    expect(authClientSrc).toMatch(/Sign-in failed\. Please try again\./);
  });
});

describe('SignUpLuxury (/signup) — dead social buttons are gated', () => {
  it('imports the flags', () => {
    expect(signupSrc).toMatch(/import\s*\{\s*signupFlags\s*\}\s*from\s*["']@\/lib\/authSignupFlags["']/);
  });

  it('Facebook + Instagram buttons render only when their flag is on', () => {
    expect(signupSrc).toMatch(/signupFlags\.facebookSignin\s*&&/);
    expect(signupSrc).toMatch(/signupFlags\.instagramSignin\s*&&/);
  });

  it('TikTok goes through the server-mediated OAuth path (not a raw Firebase dead button)', () => {
    // TikTok is server-mediated: no dead Firebase button, so signup routes it
    // through socialExternal('tiktok'), never a bare popup that would crash.
    expect(signupSrc).toMatch(/socialExternal\(\s*['"]tiktok['"]\s*\)|which:\s*'instagram'\s*\|\s*'tiktok'/);
  });
});
