/**
 * Social sign-in providers are ALL ON by CEO decision (2026-06-28) — every
 * method is shown so customers can pick any. They remain individually gated by a
 * VITE_AUTH_SIGNUP_*_ENABLED env flag (an operator can force any off per-env),
 * and each is still wired through SignIn's GRACEFUL error handling: a provider
 * that isn't configured yet (Firebase console / OAuth secrets missing) returns
 * "not switched on yet — use Google/email/phone", never a crash or silent dead tap.
 *
 * So the guardrail changed from "must be OFF" to "may be ON, but MUST degrade
 * gracefully + stay flag-controllable". Source-introspection so a regression
 * (un-gating, or removing the graceful handler) fails CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = path.resolve(__dirname, '..', '..');
const flagsSrc = fs.readFileSync(path.join(CLIENT, 'lib', 'authSignupFlags.ts'), 'utf8');
const signupSrc = fs.readFileSync(path.join(CLIENT, 'pages', 'SignUpLuxury.tsx'), 'utf8');
const signinSrc = fs.readFileSync(path.join(CLIENT, 'pages', 'SignIn.tsx'), 'utf8');

describe('authSignupFlags — all providers ON but flag-controllable', () => {
  it('facebook/instagram/tiktok use on() (CEO 2026-06-28; force off only via env === "false")', () => {
    expect(flagsSrc).toMatch(/facebookSignin:\s*on\('VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/instagramSignin:\s*on\('VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/tiktokSignin:\s*on\('VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED'\)/);
  });
});

describe('SignIn — unconfigured providers degrade gracefully (no dead crash)', () => {
  it('handles the not-configured Firebase auth codes with an honest message', () => {
    expect(signinSrc).toContain('auth/operation-not-allowed');
    expect(signinSrc).toContain('auth/configuration-not-found');
    expect(signinSrc).toMatch(/switched on yet|not configured yet/);
  });
});

describe('SignUpLuxury (/signup) — dead social buttons are gated', () => {
  it('Facebook + Instagram buttons render only when their flag is on', () => {
    expect(signupSrc).toMatch(/signupFlags\.facebookSignin\s*&&/);
    expect(signupSrc).toMatch(/signupFlags\.instagramSignin\s*&&/);
  });
});

describe('SignIn (/signin) — dead social buttons are gated', () => {
  it('imports the flags and gates facebook/instagram/tiktok', () => {
    expect(signinSrc).toMatch(/import\s*\{\s*signupFlags\s*\}\s*from\s*["']@\/lib\/authSignupFlags["']/);
    expect(signinSrc).toMatch(/signupFlags\.facebookSignin\s*&&/);
    expect(signinSrc).toMatch(/signupFlags\.instagramSignin\s*&&/);
    expect(signinSrc).toMatch(/signupFlags\.tiktokSignin\s*&&/);
  });
});
