/**
 * Issue #153 PR-FRES-B — postLoginCoordinator single-flight + cache pin.
 *
 * Deep-forensic finding (CEO directive "go deeper"):
 *   Seven independent client call sites fired POST /api/auth/post-login
 *   with no coordination. Concurrent calls produced multiple navigate()
 *   resolutions and the browser kept the LAST nextUrl, creating the
 *   "Become Provider appears for ~1s then bounces to /home" symptom on
 *   iPhone Safari (Nir's account) even after V1+V2+V3+V4 landed.
 *
 *   Affected raw-fetch sites:
 *     SignIn.tsx, SignUp.tsx (3x), GoogleOneTap.tsx (with setTimeout(500)),
 *     useAccountNavigation.ts, NotificationConsent.tsx, CompleteProfile.tsx
 *
 * After PR-FRES-B:
 *   ONE canonical pipeline: client/src/lib/postLoginCoordinator.ts
 *     • single-flight: identical concurrent callers share one Promise
 *     • 30s result cache for cacheable bodies (no body, or only `intent`)
 *     • profile-write bodies bypass cache (still de-duped on identical body)
 *     • Bearer token attachment when provided
 *     • cache key includes idToken tail + body fingerprint so different
 *       intents (provider vs loyalty) do not cross-contaminate
 *
 * Tests below split into:
 *   A. Behaviour tests on the coordinator itself (mocked global fetch)
 *   B. Source-pin tests proving every caller imports + uses the coordinator
 *      and that no raw POST /api/auth/post-login fetch remains outside it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── A. BEHAVIOUR TESTS ──────────────────────────────────────────────────────

describe('postLoginCoordinator behaviour', () => {
  const originalFetch = globalThis.fetch;
  let mod: typeof import('../lib/postLoginCoordinator');

  beforeEach(async () => {
    vi.resetModules();
    mod = await import('../lib/postLoginCoordinator');
    mod.__postLoginCoordinatorTestReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockFetch(impl: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
    const spy = vi.fn(impl);
    globalThis.fetch = spy as any;
    return spy;
  }

  it('1. two concurrent identical calls collapse to ONE network request', async () => {
    const spy = mockFetch(async () => new Response(JSON.stringify({ nextUrl: '/home' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const [a, b] = await Promise.all([mod.resolvePostLogin(), mod.resolvePostLogin()]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.nextUrl).toBe('/home');
    expect(b.nextUrl).toBe('/home');
  });

  it('2. 30s result cache: second call within window reuses cached result', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    const a = await mod.resolvePostLogin();
    const b = await mod.resolvePostLogin();
    expect(calls).toBe(1);
    expect(a.nextUrl).toBe('/home');
    expect(b.nextUrl).toBe('/home');
  });

  it('3. cache expires after POST_LOGIN_CACHE_TTL_MS — fresh fetch issued', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    vi.useFakeTimers();
    await mod.resolvePostLogin();
    vi.advanceTimersByTime(mod.POST_LOGIN_CACHE_TTL_MS + 100);
    await mod.resolvePostLogin();
    expect(calls).toBe(2);
  });

  it('4. provider intent and loyalty intent do NOT share cache (different keys)', async () => {
    let calls = 0;
    const spy = mockFetch(async (_input, init) => {
      calls++;
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const nextUrl = body.intent === 'provider' ? '/provider-onboarding' : '/loyalty/join';
      return new Response(JSON.stringify({ nextUrl }), { status: 200 });
    });
    const provider = await mod.resolvePostLogin({ body: { intent: 'provider' } });
    const loyalty = await mod.resolvePostLogin({ body: { intent: 'loyalty' } });
    expect(calls).toBe(2);
    expect(provider.nextUrl).toBe('/provider-onboarding');
    expect(loyalty.nextUrl).toBe('/loyalty/join');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('5. provider intent survives — same provider call within 30s reuses cached /provider-onboarding', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/provider-onboarding' }), { status: 200 }); });
    const a = await mod.resolvePostLogin({ body: { intent: 'provider' } });
    const b = await mod.resolvePostLogin({ body: { intent: 'provider' } });
    expect(calls).toBe(1);
    expect(a.nextUrl).toBe('/provider-onboarding');
    expect(b.nextUrl).toBe('/provider-onboarding');
  });

  it('6. profile-write body (firstName etc.) is NOT cached — fresh fetch each call', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    await mod.resolvePostLogin({ body: { firstName: 'Nir', lastName: 'Glazer', intent: 'provider' } });
    await mod.resolvePostLogin({ body: { firstName: 'Nir', lastName: 'Glazer', intent: 'provider' } });
    expect(calls).toBe(2);
  });

  it('7. invalidatePostLoginCache clears cached result and forces re-fetch', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    await mod.resolvePostLogin();
    mod.invalidatePostLoginCache();
    await mod.resolvePostLogin();
    expect(calls).toBe(2);
  });

  it('8. fail-closed: network error propagates to caller', async () => {
    mockFetch(async () => { throw new Error('boom'); });
    await expect(mod.resolvePostLogin()).rejects.toThrow('boom');
  });

  it('9. non-2xx response is returned with ok:false — caller decides fallback', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'bad' }), { status: 500 }));
    const r = await mod.resolvePostLogin();
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });

  it('10. 401 surfaced verbatim — useAccountNavigation can route to /signin', async () => {
    mockFetch(async () => new Response('Unauthorized', { status: 401 }));
    const r = await mod.resolvePostLogin();
    expect(r.status).toBe(401);
    expect(r.ok).toBe(false);
  });

  it('11. Bearer token attached when idToken provided', async () => {
    let capturedAuth: string | undefined;
    mockFetch(async (_input, init) => {
      capturedAuth = (init?.headers as any)?.Authorization;
      return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 });
    });
    await mod.resolvePostLogin({ idToken: 'abc.def.ghi-token-tail-1234567890' });
    expect(capturedAuth).toBe('Bearer abc.def.ghi-token-tail-1234567890');
  });

  it('12. five concurrent calls (the worst-case race) collapse to ONE request', async () => {
    let calls = 0;
    mockFetch(async () => { calls++; return new Response(JSON.stringify({ nextUrl: '/home' }), { status: 200 }); });
    await Promise.all([
      mod.resolvePostLogin(),
      mod.resolvePostLogin(),
      mod.resolvePostLogin(),
      mod.resolvePostLogin(),
      mod.resolvePostLogin(),
    ]);
    expect(calls).toBe(1);
  });
});

// ── B. SOURCE-PIN TESTS — every caller routes through the coordinator ───────

describe('PR-FRES-B caller-integration source pins', () => {
  it('13. SignIn.tsx imports resolvePostLogin and removed raw post-login fetch', () => {
    const src = read('client/src/pages/SignIn.tsx');
    expect(src).toMatch(/import\s*\{\s*resolvePostLogin\s*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    expect(src).not.toMatch(/fetch\([^)]*['"]\/api\/auth\/post-login['"]/);
  });

  it('14. GoogleOneTap.tsx removed setTimeout(..., 500) and uses coordinator', () => {
    const src = read('client/src/components/GoogleOneTap.tsx');
    expect(src).toMatch(/import\s*\{\s*resolvePostLogin\s*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    // No more arbitrary setTimeout(..., 500) coordination
    expect(src).not.toMatch(/setTimeout\([^)]*500\s*\)/);
    // No raw post-login fetch
    expect(src).not.toMatch(/fetch\([^)]*['"]\/api\/auth\/post-login['"]/);
  });

  it('16. useAccountNavigation routes through coordinator', () => {
    const src = read('client/src/hooks/useAccountNavigation.ts');
    expect(src).toMatch(/import\s*\{\s*resolvePostLogin\s*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    expect(src).not.toMatch(/fetch\([^)]*['"]\/api\/auth\/post-login['"]/);
  });

  it('17. NotificationConsent routes through coordinator', () => {
    const src = read('client/src/pages/NotificationConsent.tsx');
    expect(src).toMatch(/import\s*\{\s*resolvePostLogin\s*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    expect(src).not.toMatch(/fetch\([^)]*['"]\/api\/auth\/post-login['"]/);
  });

  it('18. CompleteProfile routes through coordinator', () => {
    const src = read('client/src/pages/CompleteProfile.tsx');
    expect(src).toMatch(/import\s*\{\s*resolvePostLogin\s*\}\s*from\s*['"]@\/lib\/postLoginCoordinator['"]/);
    expect(src).not.toMatch(/fetch\([^)]*['"]\/api\/auth\/post-login['"]/);
  });

  it('19. coordinator is the ONLY remaining raw post-login fetch in client/', () => {
    const dirs = [
      'client/src/pages',
      'client/src/components',
      'client/src/hooks',
      'client/src/auth',
      'client/src/lib',
    ];
    const offenders: string[] = [];
    const cmd = (require('child_process') as typeof import('child_process')).execSync;
    const out = cmd(
      `grep -rln "['\\\"]/api/auth/post-login['\\\"]" ${dirs.join(' ')} || true`,
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    if (out) {
      for (const line of out.split('\n')) {
        if (!line.endsWith('client/src/lib/postLoginCoordinator.ts')) {
          offenders.push(line);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
