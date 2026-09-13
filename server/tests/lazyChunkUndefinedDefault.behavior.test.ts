/**
 * 2026-09-13 monitoring alert — AppErrorBoundary on /payment-status:
 *   TypeError: Cannot read properties of undefined (reading 'default')  at <Lazy>
 *
 * Root cause was our own stale-chunk "recovery": main.tsx called preventDefault()
 * on `vite:preloadError`. Vite's preload helper then SWALLOWS the import error and
 * the dynamic import resolves to `undefined`; React.lazy reads `.default` of it.
 * The boundary did not recognise that message → crash card + critical alert, no
 * reload. And its retry counter lived in memory, so it could never stop a loop.
 *
 * These are behaviour tests: the preload helper below is Vite's own logic
 * (node_modules/vite/dist/node/chunks/dep-*.js, handlePreloadError), and the
 * boundary is the real component driven through its lifecycle methods.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const src = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── minimal browser globals ────────────────────────────────────────────────
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
let reloads = 0;
const listeners = new Map<string, Array<(e: any) => void>>();
function installWindow() {
  reloads = 0;
  listeners.clear();
  const win: any = {
    sessionStorage: new MemStorage(),
    location: { href: 'https://petwash.co.il/payment-status', reload: () => { reloads++; } },
    addEventListener: (t: string, fn: any) => { listeners.set(t, [...(listeners.get(t) || []), fn]); },
    dispatchEvent: (e: any) => { for (const fn of listeners.get(e.type) || []) fn(e); return !e.defaultPrevented; },
  };
  (globalThis as any).window = win;
  (globalThis as any).sessionStorage = win.sessionStorage;
  (globalThis as any).localStorage = new MemStorage();
}

/** Vite 6 preload helper, verbatim in behaviour. */
function vitePreload(baseModule: () => Promise<any>) {
  function handlePreloadError(err: unknown) {
    const e: any = new Event('vite:preloadError', { cancelable: true });
    e.payload = err;
    (globalThis as any).window.dispatchEvent(e);
    if (!e.defaultPrevented) throw err;
  }
  return Promise.resolve().then(() => baseModule().catch(handlePreloadError));
}

const failingImport = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://petwash.co.il/assets/not-found-OLD.js'));

describe('the root cause: preventDefault on vite:preloadError', () => {
  beforeEach(() => { installWindow(); vi.resetModules(); });

  it('reproduces the alert — a prevented preload error resolves the import to undefined', async () => {
    (globalThis as any).window.addEventListener('vite:preloadError', (e: any) => e.preventDefault());
    const mod = await vitePreload(failingImport);
    expect(mod).toBeUndefined();
    // React.lazy's initializer does exactly this:
    expect(() => (mod as any).default).toThrow(/reading 'default'/);
  });

  it('main.tsx no longer prevents it — the real error reaches the boundary', async () => {
    const main = src('client/src/main.tsx').replace(/\/\/.*$/gm, '');
    const m = main.match(/addEventListener\(\s*['"]vite:preloadError['"][\s\S]*?\);/);
    expect(m, 'vite:preloadError listener missing').toBeTruthy();
    expect(m![0]).not.toMatch(/preventDefault/);

    const { tryChunkReload } = await import('../../client/src/lib/chunkRecovery');
    (globalThis as any).window.addEventListener('vite:preloadError', () => { tryChunkReload(); });
    await expect(vitePreload(failingImport)).rejects.toThrow(/dynamically imported module/);
  });
});

describe('chunkRecovery', () => {
  beforeEach(() => { installWindow(); vi.resetModules(); });

  it('recognises every shape a failed chunk takes, including the alert text', async () => {
    const { isChunkLoadError } = await import('../../client/src/lib/chunkRecovery');
    for (const msg of [
      "Cannot read properties of undefined (reading 'default')",
      'Failed to fetch dynamically imported module: https://x/assets/a.js',
      'Importing a module script failed.',
      "'text/html' is not a valid JavaScript MIME type.",
      'error loading dynamically imported module',
      'Unable to preload CSS for /assets/a.css',
    ]) expect(isChunkLoadError(new TypeError(msg)), msg).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
  });

  it('reloads at most twice per minute — survives the reload it causes (no infinite loop)', async () => {
    let t = 1_000_000;
    for (let pageLife = 0; pageLife < 5; pageLife++) {
      vi.resetModules(); // a reload = fresh JS memory, same sessionStorage
      const { tryChunkReload } = await import('../../client/src/lib/chunkRecovery');
      tryChunkReload(t);
      tryChunkReload(t); // same failure seen by a second listener — counted once
      t += 3_000;
    }
    expect(reloads).toBe(2);

    vi.resetModules();
    const { tryChunkReload } = await import('../../client/src/lib/chunkRecovery');
    expect(tryChunkReload(t + 61_000)).toBe(true); // a minute later it may try again
  });
});

describe('AppErrorBoundary with the exact alert error', () => {
  beforeEach(() => { installWindow(); vi.resetModules(); });

  /** Run the REAL AppErrorBoundary.tsx the way the bundle would (esbuild), with
   *  only its UI/telemetry imports stubbed — chunkRecovery is the real module. */
  async function loadBoundary() {
    const esbuild = await import('esbuild');
    const load = (rel: string, loader: 'ts' | 'tsx', req: (id: string) => any) => {
      const js = esbuild.transformSync(src(rel), { loader, format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{"DEV":false}' } }).code;
      const module = { exports: {} as any };
      // eslint-disable-next-line no-new-func
      new Function('module', 'exports', 'require', js)(module, module.exports, req);
      return module.exports;
    };
    const recovery = load('client/src/lib/chunkRecovery.ts', 'ts', require);
    const stubs: Record<string, any> = {
      '@/lib/chunkRecovery': recovery,
      '@/lib/apiConfig': { getApiUrl: (p: string) => p },
      '@/lib/sentry': { trackBoundaryCrash: () => {} },
      '@/lib/crashCardCopy': { isHebrewCrashLocale: () => false, crashCardCopy: () => ({ dir: 'ltr', isHe: false }) },
      '@/components/ui/button': { Button: () => null },
      '@/components/ui/card': { Card: () => null, CardContent: () => null, CardHeader: () => null, CardTitle: () => null },
      'lucide-react': { AlertCircle: () => null, RefreshCw: () => null },
    };
    return load('client/src/components/AppErrorBoundary.tsx', 'tsx', (id) => (id in stubs ? stubs[id] : require(id)));
  }

  async function drive() {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    (globalThis as any).fetch = fetchSpy;
    const { AppErrorBoundary } = await loadBoundary();
    const err = new TypeError("Cannot read properties of undefined (reading 'default')");
    const b: any = new AppErrorBoundary({ children: null });
    b.state = { ...b.state, ...AppErrorBoundary.getDerivedStateFromError(err) };
    b.setState = (s: any) => { b.state = { ...b.state, ...s }; };
    const pending = b.render();
    b.componentDidCatch(err, { componentStack: '\n    at Lazy' });
    return { b, fetchSpy, pending };
  }

  it('first failure: blank + reload, no crash card, no server alert', async () => {
    const { b, fetchSpy, pending } = await drive();
    expect(b.state.isChunkError).toBe(true);
    expect(pending).toBeNull();
    expect(reloads).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(b.render()).toBeNull();
  });

  it('chunk really gone (reload budget spent): card + one logged chunk-load report', async () => {
    (globalThis as any).window.sessionStorage.setItem('pw_chunk_reload_at', String(Date.now()));
    (globalThis as any).window.sessionStorage.setItem('pw_chunk_reload_count', '2');
    const { b, fetchSpy } = await drive();
    expect(reloads).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body);
    expect(body.errorKind).toBe('chunk-load');
    expect(body.repeatedChunkFailure).toBe(true);
    expect(b.render()).not.toBeNull();
  });
});

describe('the other two boundaries use the same recovery', () => {
  it('RouteErrorBoundary (25 routes) and AuthRouteErrorBoundary reload a failed chunk', () => {
    const app = src('client/src/App.tsx');
    const route = app.slice(app.indexOf('class RouteErrorBoundary'), app.indexOf('class RouteErrorBoundary') + 1500);
    expect(route).toMatch(/isChunk\s*&&\s*tryChunkReload\(\)/);
    expect(src('client/src/components/AuthRouteErrorBoundary.tsx')).toMatch(/isChunkLoadError\(err\)\s*&&\s*tryChunkReload\(\)/);
  });
});

describe('eGift buy paths send the bot check', () => {
  it('BuyGiftCard gates on the eGift rail (#2447) and sends a Turnstile token', () => {
    const page = src('client/src/pages/BuyGiftCard.tsx');
    expect(page).toMatch(/!egiftPurchaseEnabled/);
    expect(page).toMatch(/executeTurnstileInvisible\('egift_purchase'\)/);
    expect(page).toMatch(/\.\.\.\(turnstileToken \? \{ turnstileToken \} : \{\}\)/);
  });

  it('the shared guest checkout helper fetches a Turnstile token itself', () => {
    const helper = src('client/src/lib/sumitCheckout.ts');
    const fn = helper.slice(helper.indexOf('export async function startGuestEgiftCheckout'));
    expect(fn.slice(0, 1500)).toMatch(/executeTurnstileInvisible\(/);
  });
});
