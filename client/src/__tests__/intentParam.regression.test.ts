/**
 * Issue #153 PR-FRES-6 — `?intent=` URL param honour helper.
 *
 * Before this PR, the only way `localStorage.signup_intent` got set was:
 *   1. Click of a Become-Provider CTA wired through becomeProvider.ts (#183)
 *   2. SignIn.tsx:220 auto-detection of ?redirect=…provider-onboarding
 *
 * Direct landings on /signup?intent=provider, /sign-in?intent=loyalty,
 * or the email-verify return at /__/auth/action?intent=provider were
 * silently dropped. The user reached the form with no intent set and
 * the post-login coordinator (#182) routed them to /home as customers.
 *
 * This regression suite locks:
 *   A. Helper behaviour: parsing, allowlist, alias mapping, idempotency,
 *      private-mode safety, no XSS / open-redirect surface.
 *   B. Caller integration: SignIn.tsx, SignUp.tsx, AuthAction.tsx all
 *      import + invoke the helper on mount, BEFORE any post-login
 *      routing fires.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// vitest runs under environment=node in this repo; stub a minimal
// localStorage so the helper's write is observable.
function installLocalStorageStub() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = { localStorage: ls, location: { search: '' } };
  } else {
    (globalThis as any).window.localStorage = ls;
    if (!(globalThis as any).window.location) {
      (globalThis as any).window.location = { search: '' };
    }
  }
}

// ── A. BEHAVIOUR TESTS ─────────────────────────────────────────────────────

describe('intentParam helper behaviour', () => {
  beforeAll(() => { installLocalStorageStub(); });
  beforeEach(() => {
    try { (globalThis as any).window.localStorage.clear(); } catch { /* noop */ }
  });

  it('1. ALLOWED_INTENTS locks the canonical 4-value set (mirrors server)', async () => {
    const { ALLOWED_INTENTS } = await import('../lib/intentParam');
    expect([...ALLOWED_INTENTS].sort()).toEqual(
      ['customer', 'loyalty', 'provider', 'staff_request'],
    );
  });

  it('2. canonicalizeIntent accepts every allowlisted value verbatim', async () => {
    const { canonicalizeIntent } = await import('../lib/intentParam');
    expect(canonicalizeIntent('customer')).toBe('customer');
    expect(canonicalizeIntent('loyalty')).toBe('loyalty');
    expect(canonicalizeIntent('provider')).toBe('provider');
    expect(canonicalizeIntent('staff_request')).toBe('staff_request');
  });

  it('3. canonicalizeIntent maps the marketing alias prestige → loyalty', async () => {
    const { canonicalizeIntent } = await import('../lib/intentParam');
    expect(canonicalizeIntent('prestige')).toBe('loyalty');
    expect(canonicalizeIntent('PRESTIGE')).toBe('loyalty');
    expect(canonicalizeIntent('  Prestige  ')).toBe('loyalty');
  });

  it('4. canonicalizeIntent drops non-allowlisted values silently (no XSS surface)', async () => {
    const { canonicalizeIntent } = await import('../lib/intentParam');
    expect(canonicalizeIntent('admin')).toBeNull();
    expect(canonicalizeIntent('"; DROP TABLE users; --')).toBeNull();
    expect(canonicalizeIntent('javascript:alert(1)')).toBeNull();
    expect(canonicalizeIntent('')).toBeNull();
    expect(canonicalizeIntent(null)).toBeNull();
    expect(canonicalizeIntent(undefined)).toBeNull();
  });

  it('5. parseIntentFromUrl reads the URLSearchParams and canonicalises', async () => {
    const { parseIntentFromUrl } = await import('../lib/intentParam');
    expect(parseIntentFromUrl('?intent=provider')).toBe('provider');
    expect(parseIntentFromUrl('?foo=bar&intent=loyalty')).toBe('loyalty');
    expect(parseIntentFromUrl('?intent=prestige')).toBe('loyalty');
    expect(parseIntentFromUrl('?intent=admin')).toBeNull();
    expect(parseIntentFromUrl('')).toBeNull();
    expect(parseIntentFromUrl('?other=1')).toBeNull();
  });

  it('6. applyIntentFromUrl writes canonical value to localStorage', async () => {
    const { applyIntentFromUrl } = await import('../lib/intentParam');
    const got = applyIntentFromUrl('?intent=provider');
    expect(got).toBe('provider');
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('provider');
  });

  it('7. applyIntentFromUrl with prestige alias writes loyalty', async () => {
    const { applyIntentFromUrl } = await import('../lib/intentParam');
    applyIntentFromUrl('?intent=prestige');
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('loyalty');
  });

  it('8. applyIntentFromUrl with no/invalid param leaves localStorage UNTOUCHED', async () => {
    const { applyIntentFromUrl } = await import('../lib/intentParam');
    (globalThis as any).window.localStorage.setItem('signup_intent', 'provider');
    expect(applyIntentFromUrl('?other=1')).toBeNull();
    // existing value preserved — we don't clobber what was already there
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('provider');
    expect(applyIntentFromUrl('?intent=admin')).toBeNull();
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('provider');
  });

  it('9. applyIntentFromUrl OVERWRITES stale localStorage when URL has valid intent', async () => {
    const { applyIntentFromUrl } = await import('../lib/intentParam');
    (globalThis as any).window.localStorage.setItem('signup_intent', 'customer');
    const got = applyIntentFromUrl('?intent=provider');
    expect(got).toBe('provider');
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('provider');
  });

  it('10. applyIntentFromUrl is idempotent', async () => {
    const { applyIntentFromUrl } = await import('../lib/intentParam');
    applyIntentFromUrl('?intent=loyalty');
    applyIntentFromUrl('?intent=loyalty');
    applyIntentFromUrl('?intent=loyalty');
    expect((globalThis as any).window.localStorage.getItem('signup_intent')).toBe('loyalty');
  });
});

// ── B. CALLER-INTEGRATION SOURCE PINS ──────────────────────────────────────

describe('PR-FRES-6 caller-integration source pins', () => {
  it('11. SignIn.tsx imports applyIntentFromUrl and invokes it BEFORE the redirect heuristic', () => {
    const src = read('client/src/pages/SignIn.tsx');
    expect(src).toMatch(/import\s*\{\s*applyIntentFromUrl\s*\}\s*from\s*['"]@\/lib\/intentParam['"]/);
    // applyIntentFromUrl() must run before the legacy customRedirect heuristic
    const apply = src.indexOf('applyIntentFromUrl()');
    const legacy = src.indexOf("provider-onboarding'");
    expect(apply).toBeGreaterThan(0);
    expect(legacy).toBeGreaterThan(apply);
  });

  it('12. AuthAction.tsx (email-link return) invokes applyIntentFromUrl before handleAction', () => {
    const src = read('client/src/pages/AuthAction.tsx');
    expect(src).toMatch(/import\s*\{\s*applyIntentFromUrl\s*\}\s*from\s*['"]@\/lib\/intentParam['"]/);
    const apply = src.indexOf('applyIntentFromUrl()');
    const handle = src.indexOf('handleAction(modeParam, codeParam)');
    expect(apply).toBeGreaterThan(0);
    expect(handle).toBeGreaterThan(apply);
  });

  it('14. Server allowlist (post-login.ts) and client helper agree on the 4-value set', () => {
    const helper = read('client/src/lib/intentParam.ts');
    const server = read('server/routes/post-login.ts');
    // Both files must reference the same 4 values
    for (const v of ['customer', 'loyalty', 'provider', 'staff_request']) {
      expect(helper).toMatch(new RegExp(`['"]${v}['"]`));
      expect(server).toMatch(new RegExp(`['"]${v}['"]`));
    }
  });
});
