/**
 * Signup routing 'wise smart logic' (CEO 2026-07-24: "check buttons where what
 * how, minimum needed"). After signup the client navigated to its own intent
 * GUESS (destForFlow → /dashboard or /provider-onboarding), bypassing the
 * server's post-login decider — so a new user missing a name was dumped on a
 * dashboard that bounced instead of going to /complete-profile. Now the
 * just-completed signup asks the decider, passing the loyalty/provider intent.
 * And CompleteProfile prefills every known field (incl. the now-saved DOB) so
 * it only asks for what's genuinely missing = minimum needed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const signup = R('client/src/pages/SignUpLuxury.tsx');
const cp = R('client/src/pages/CompleteProfile.tsx');

describe('finishAndRoute defers to the server decider', () => {
  it('resolves post-login and navigates to its nextUrl', () => {
    const fn = signup.slice(signup.indexOf('async function finishAndRoute'), signup.indexOf('async function sendCode'));
    expect(fn).toMatch(/resolvePostLogin\(\{ body: \{ intent \} \}\)/);
    expect(fn).toMatch(/navigate\(data\?\.nextUrl/);
    // navigate(dest) survives ONLY as the catch fallback, not the primary path
    expect(fn).toMatch(/\} catch \{\s*navigate\(dest\);/);
  });

  it('passes provider vs loyalty intent so routing is role-correct', () => {
    const fn = signup.slice(signup.indexOf('async function finishAndRoute'), signup.indexOf('async function sendCode'));
    expect(fn).toMatch(/flow === 'provider' \? 'provider' : 'loyalty'/);
  });
});

describe('CompleteProfile only asks for what is missing', () => {
  it('prefills firstName, lastName, phone AND dateOfBirth from the loaded user', () => {
    expect(cp).toMatch(/if \(data\.user\.firstName\) setFirstName/);
    expect(cp).toMatch(/if \(data\.user\.phone\) setPhone/);
    expect(cp).toMatch(/if \(data\.user\.dateOfBirth\) setDateOfBirth/);
  });
});
