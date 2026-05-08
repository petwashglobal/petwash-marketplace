/**
 * Issue #153 PR-FRES-5 — whoami auto-invalidation + sign-out cache wipe
 *
 * Lane-1 deep-audit findings (executive directive):
 *   #11 P0  AuthProvider.logout() never called invalidatePostLoginCache().
 *           Next user on the same device could inherit the previous user's
 *           cached nextUrl from postLoginCoordinator. queryClient.clear()
 *           does not reach module-level Maps. This is the cache-bleed gap.
 *
 *   #10 P0  useWhoami.ts staleTime=2 min, refetchInterval=5 min, with NO
 *           invalidation anywhere. After /api/auth/post-login resolves with
 *           a role escalation (customer → provider), whoami still serves the
 *           stale customer profile for up to 2 minutes — visible flash of
 *           customer chrome before /provider-os.
 *
 * Fix surface (3 files, no AuthProvider rewrite, no whoami collapse):
 *   client/src/lib/postLoginCoordinator.ts
 *     • registerPostLoginResolvedHandler(fn) — single-listener pattern
 *     • on every successful resolve, invokes the handler with the result
 *   client/src/auth/AuthProvider.tsx
 *     • useEffect on mount registers a handler that
 *       queryClient.invalidateQueries(['/api/session/whoami'])
 *     • logout() now calls invalidatePostLoginCache() before
 *       queryClient.clear() (also in the catch branch for failure paths)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── A. BEHAVIOUR — coordinator notifies the registered handler ──────────────

describe('postLoginCoordinator resolved-handler', () => {
  const originalFetch = globalThis.fetch;
  let mod: typeof import('../lib/postLoginCoordinator');

  beforeEach(async () => {
    vi.resetModules();
    mod = await import('../lib/postLoginCoordinator');
    mod.__postLoginCoordinatorTestReset();
  });

  function mockFetch(impl: (input: any, init?: any) => Promise<Response>) {
    const spy = vi.fn(impl);
    globalThis.fetch = spy as any;
    return spy;
  }

  it('1. registered handler is called once per successful resolve', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nextUrl: '/provider-os' }), { status: 200 }));
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    await mod.resolvePostLogin();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ nextUrl: '/provider-os', ok: true }));
  });

  it('2. handler is NOT called on a non-2xx response', async () => {
    mockFetch(async () => new Response('err', { status: 500 }));
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    await mod.resolvePostLogin();
    expect(fn).not.toHaveBeenCalled();
  });

  it('3. handler is NOT called on network failure (fail-closed)', async () => {
    mockFetch(async () => { throw new Error('boom'); });
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    await expect(mod.resolvePostLogin()).rejects.toThrow('boom');
    expect(fn).not.toHaveBeenCalled();
  });

  it('4. registering null detaches the handler (cleanup safety)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }));
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    mod.registerPostLoginResolvedHandler(null);
    await mod.resolvePostLogin();
    expect(fn).not.toHaveBeenCalled();
  });

  it('5. handler errors are isolated — do not bubble out of resolvePostLogin', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }));
    mod.registerPostLoginResolvedHandler(() => { throw new Error('handler-boom'); });
    await expect(mod.resolvePostLogin()).resolves.toMatchObject({ ok: true });
  });

  it('6. concurrent callers share Promise; handler still fires once', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    await Promise.all([mod.resolvePostLogin(), mod.resolvePostLogin(), mod.resolvePostLogin()]);
    expect(calls).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('7. cached results do NOT re-fire the handler (avoid duplicate invalidations)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }));
    const fn = vi.fn();
    mod.registerPostLoginResolvedHandler(fn);
    await mod.resolvePostLogin();
    await mod.resolvePostLogin(); // cache hit
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── B. SOURCE-PIN: AuthProvider wiring ──────────────────────────────────────

describe('PR-FRES-5 AuthProvider wiring', () => {
  it('8. AuthProvider imports invalidatePostLoginCache and registerPostLoginResolvedHandler', () => {
    const src = read('client/src/auth/AuthProvider.tsx');
    expect(src).toMatch(/import\s*\{[^}]*invalidatePostLoginCache[^}]*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    expect(src).toMatch(/import\s*\{[^}]*registerPostLoginResolvedHandler[^}]*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
  });

  it('9. AuthProvider.logout() calls invalidatePostLoginCache() BEFORE queryClient.clear() on the happy path', () => {
    const src = read('client/src/auth/AuthProvider.tsx');
    const idx = src.indexOf('const logout = async');
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, idx + 1500);
    const inv = block.indexOf('invalidatePostLoginCache()');
    const clr = block.indexOf('queryClient.clear()');
    expect(inv).toBeGreaterThan(0);
    expect(clr).toBeGreaterThan(0);
    expect(inv).toBeLessThan(clr);
  });

  it('10. logout() catch-branch also clears coordinator cache (failure path safety)', () => {
    const src = read('client/src/auth/AuthProvider.tsx');
    const idx = src.indexOf('const logout = async');
    const block = src.slice(idx, idx + 2200);
    // Two invalidatePostLoginCache calls expected: the happy-path one + the catch-branch one
    const matches = block.match(/invalidatePostLoginCache\(\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('11. AuthProvider registers a resolved handler that invalidates whoami query', () => {
    const src = read('client/src/auth/AuthProvider.tsx');
    expect(src).toMatch(/registerPostLoginResolvedHandler\(\s*\(\)\s*=>\s*\{[\s\S]*?invalidateQueries\([\s\S]*?['"]\/api\/session\/whoami['"]/);
  });

  it('12. resolved-handler effect cleans up by passing null on unmount', () => {
    const src = read('client/src/auth/AuthProvider.tsx');
    expect(src).toMatch(/registerPostLoginResolvedHandler\(null\)/);
  });

  it('13. coordinator exports the new handler-registration API', () => {
    const src = read('client/src/lib/postLoginCoordinator.ts');
    expect(src).toMatch(/export\s+function\s+registerPostLoginResolvedHandler\s*\(/);
  });

  it('14. coordinator preserves invalidatePostLoginCache (original sign-out clear API)', () => {
    const src = read('client/src/lib/postLoginCoordinator.ts');
    expect(src).toMatch(/export\s+function\s+invalidatePostLoginCache\s*\(/);
  });
});
