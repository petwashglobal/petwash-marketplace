/**
 * Unconfigured social sign-in providers must be hidden by default.
 *
 * Facebook, Instagram, and TikTok buttons used to render unconditionally on
 * /signup (SignUpLuxury) and /signin (SignIn) even though their backends 503 or
 * their consoles aren't configured — so users tapped buttons that error.
 * They are now gated behind default-OFF flags (like apple_signin already was),
 * so signup/login only show options that actually work, and an operator flips
 * the env flag to true once the provider's console + secrets are ready.
 *
 * Source-introspection so a regression (un-gating a dead button) fails CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = path.resolve(__dirname, '..', '..');
const flagsSrc = fs.readFileSync(path.join(CLIENT, 'lib', 'authSignupFlags.ts'), 'utf8');
const signupSrc = fs.readFileSync(path.join(CLIENT, 'pages', 'SignUpLuxury.tsx'), 'utf8');
const signinSrc = fs.readFileSync(path.join(CLIENT, 'pages', 'SignIn.tsx'), 'utf8');

describe('authSignupFlags — unconfigured providers default OFF', () => {
  it('facebook/instagram/tiktok use off() (enabled only when env === "true")', () => {
    expect(flagsSrc).toMatch(/facebookSignin:\s*off\('VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/instagramSignin:\s*off\('VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED'\)/);
    expect(flagsSrc).toMatch(/tiktokSignin:\s*off\('VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED'\)/);
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
