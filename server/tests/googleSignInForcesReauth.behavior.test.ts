/**
 * CEO 2026-09-13, verbatim: "gmail must require password".
 *
 * He was signed in via Gmail without being asked for anything, twice noticed
 * it, and then made the call. This pins the change.
 *
 * What is actually being enforced, stated precisely because the distinction
 * matters: `prompt: 'select_account'` only shows the account chooser — with a
 * live Google session, Google returns a token without asking for a credential.
 * `max_age=0` is the OIDC parameter that says Google's own authentication may
 * be at most 0 seconds old, so it must re-authenticate the person first.
 *
 * We cannot demand "a password" specifically — Google decides whether that
 * re-authentication is a password, a passkey, Face ID or a 2-step push. No
 * relying party can demand a particular factor. We can demand freshness.
 *
 * And a client parameter is a request, not a guarantee, which is why the real
 * enforcement is server-side on `auth_time` (server/adminAuth.ts). Both halves
 * are pinned here.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

async function loadParams() {
  const esbuild = await import('esbuild');
  const js = esbuild.transformSync(R('client/src/lib/googleAuthParams.ts'), { loader: 'ts', format: 'cjs' }).code;
  const m = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', js)(m, m.exports, require);
  return m.exports as typeof import('../../client/src/lib/googleAuthParams');
}

/** Every file that builds a Google provider for a real sign-in. */
const PROVIDER_SITES = [
  'client/src/auth/client.ts',
  'client/src/lib/auth-guardian-2025.ts',
  'client/src/lib/iosAuthHandler.ts',
];

describe('Google sign-in asks the person to prove it is them', () => {
  it('sends max_age=0 alongside the account chooser', async () => {
    const { googleAuthCustomParameters } = await loadParams();
    const p = googleAuthCustomParameters();
    expect(p.prompt).toBe('select_account');
    expect(p.max_age, 'without max_age Google just hands the token back').toBe('0');
  });

  it('max_age is a STRING — a numeric 0 is a silent no-op risk', async () => {
    const { googleAuthCustomParameters } = await loadParams();
    expect(typeof googleAuthCustomParameters().max_age).toBe('string');
  });

  it('the switch actually switches, and switching it off keeps the chooser', async () => {
    const src = R('client/src/lib/googleAuthParams.ts');
    expect(src).toMatch(/export const GOOGLE_FORCE_REAUTH = true;/);
    // flip it in a copy and confirm the parameter disappears but prompt stays
    const esbuild = await import('esbuild');
    const flipped = src.replace('GOOGLE_FORCE_REAUTH = true', 'GOOGLE_FORCE_REAUTH = false');
    const js = esbuild.transformSync(flipped, { loader: 'ts', format: 'cjs' }).code;
    const m = { exports: {} as any };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'require', js)(m, m.exports, require);
    const p = m.exports.googleAuthCustomParameters();
    expect(p.max_age).toBeUndefined();
    expect(p.prompt).toBe('select_account');
  });

  it('EVERY Google provider uses the shared parameters — no entry point left behind', () => {
    for (const f of PROVIDER_SITES) {
      const src = R(f);
      expect(src, `${f} does not import the shared params`).toContain('googleAuthCustomParameters');
      // and no hand-rolled chooser-only config may survive anywhere
      expect(
        /setCustomParameters\(\s*\{[^}]*prompt:\s*['"]select_account['"][^}]*\}\s*\)/s.test(src),
        `${f} still hand-rolls prompt:select_account and would skip max_age`,
      ).toBe(false);
    }
  });

  it('Facebook is NOT given Google OIDC parameters', () => {
    // A scripted edit briefly spread googleAuthCustomParameters() into
    // createFacebookProvider. max_age is OIDC and Facebook does not implement
    // it; prompt=select_account is not a Facebook parameter either.
    const src = R('client/src/lib/iosAuthHandler.ts');
    const at = src.indexOf('export function createFacebookProvider');
    expect(at).toBeGreaterThan(-1);
    const fb = src.slice(at, src.indexOf('\n}', at));
    // Match the CALL, not the identifier — the fix leaves a comment that names
    // the function, and `toContain` passes on that comment alone. (Third time
    // this trap has bitten in one session: pin the shape, never the prose.)
    expect(fb, 'Google params leaked into the Facebook provider')
      .not.toMatch(/\.\.\.\s*googleAuthCustomParameters\(\)|setCustomParameters\(\s*googleAuthCustomParameters/);
    expect(fb).toContain("display: 'popup'");
  });

  it('the server still enforces freshness — the parameter alone is only a request', () => {
    const admin = R('server/adminAuth.ts');
    expect(admin).toContain('ADMIN_SESSION_MAX_AGE_SECONDS');
    expect(admin, 'admin no longer checks how old the sign-in is').toMatch(/decoded\.auth_time/);
    expect(admin).toMatch(/sessionAge > ADMIN_SESSION_MAX_AGE_SECONDS/);
  });
});
