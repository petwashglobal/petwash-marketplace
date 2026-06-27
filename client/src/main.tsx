// Cache bust: 2026-03-08
// Performance-optimized: parallel imports, 400ms Firebase config timeout
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/i18next-init";

// ── DOM-mutation resilience patch (P0 fix, 2026-06-27) ───────────────────────
// Production homepage white-screened with:
//   "NotFoundError: Failed to execute 'removeChild' on 'Node':
//    The node to be removed is not a child of this node."
// This is the well-known React crash that happens when something OUTSIDE React
// mutates the DOM — browser auto-translate (Safari/Chrome on this Hebrew site),
// extensions, or any foreign script — and React later unmounts a node that was
// moved. removeChild/insertBefore then throw and the whole app crashes via the
// error boundary. Guarding these two Node methods makes React tolerant of
// foreign DOM mutation (facebook/react#11538). Belt-and-suspenders with the
// translate="no" directive in index.html (PetWash ships its own i18n).
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Defensive one-time service-worker + Cache Storage cleanup.
//
// Earlier builds shipped pre-caching workers at both /sw.js and
// /service-worker.js. Returning iPhone/iPad users can keep a stale app shell
// alive even after a green deploy, which makes /signup show old UI. The
// current app intentionally does not register a service worker; this boot
// guard clears orphan registrations and their caches, then reloads once so
// the browser re-fetches the current Firebase Hosting bundle.
const PETWASH_CACHE_PURGE_VERSION = '2026-06-12-build-stamp-forced-refresh';

if (typeof window !== 'undefined') {
  void (async () => {
    let shouldReload = false;

    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        shouldReload = shouldReload || regs.length > 0;
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      } catch (_e) {
        // Non-blocking. A failed unregister is not allowed to break signup.
      }
    }

    if ('caches' in window) {
      try {
        const cacheNames = await window.caches.keys();
        shouldReload = shouldReload || cacheNames.length > 0;
        await Promise.all(cacheNames.map((name) => window.caches.delete(name).catch(() => false)));
      } catch (_e) {
        // Private browsing / restricted storage — ignore and continue.
      }
    }

    if (!shouldReload) return;

    try {
      if (sessionStorage.getItem(PETWASH_CACHE_PURGE_VERSION) === '1') return;
      sessionStorage.setItem(PETWASH_CACHE_PURGE_VERSION, '1');
    } catch (_e) {
      // If sessionStorage is blocked, a single extra reload is safer than a
      // stale signup page for a returning signed-in user.
    }

    window.location.reload();
  })();

  if ('serviceWorker' in navigator) {
    // When the kill-worker (public/sw.js or public/service-worker.js) finishes
    // clearing caches it posts a SW_KILLED message. Reload exactly once so the
    // now-stale bundle gets re-fetched from the network.
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data as { type?: string } | undefined;
      if (data?.type !== 'SW_KILLED') return;
      try {
        if (sessionStorage.getItem('petwash_sw_killed_reload') === '1') return;
        sessionStorage.setItem('petwash_sw_killed_reload', '1');
      } catch (_e) {
        // Private browsing / quota — proceed; one duplicate reload is
        // strictly better than serving the stale signup forever.
      }
      location.reload();
    });
  }
}

declare global {
  interface Window {
    _hsq?: any[];
    hbspt?: any;
    __FIREBASE_CONFIG__?: any;
    __FIREBASE_CONFIG_READY__?: Promise<boolean>;
  }
}

// HubSpot queue initialization (synchronous — no delay)
window._hsq = window._hsq || [];

function trackHubSpotPageView() {
  if (window._hsq) {
    window._hsq.push(["setPath", window.location.pathname + window.location.search]);
    window._hsq.push(["trackPageView"]);
  }
}

trackHubSpotPageView();

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  setTimeout(trackHubSpotPageView, 0);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  setTimeout(trackHubSpotPageView, 0);
};

window.addEventListener('popstate', trackHubSpotPageView);

// ── Boot-failure self-heal (P0, 2026-06-27) ──────────────────────────────────
// If the top-level boot throws BEFORE React mounts, the user gets a blank white
// screen with no error boundary (the boundary lives *inside* the tree we never
// rendered). The #1 cause is a stale browser/app cache: an old index.html that
// references hashed JS chunks the latest deploy has replaced, so the dynamic
// import 404s. Recovery: hard-reload ONCE with a cache-bust param; if it still
// fails, render a branded "refreshing" panel (never blank) AND best-effort tell
// the server so the alarm fires — we must always know when boot dies.
const BOOT_RETRY_KEY = 'petwash_boot_retry';

function reportBootFailure(err: unknown) {
  try {
    const body = JSON.stringify({
      source: 'client-boot',
      // App never mounted even after a cache-bust reload — a real white-screen,
      // not a benign one-off chunk blip. Prefix marks it past the noise filter.
      message: `BOOT FAILED (white screen): ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      url: typeof location !== 'undefined' ? location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
    // keepalive so the POST survives the upcoming reload.
    void fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (_e) {
    /* never throw from the failure reporter */
  }
}

function renderBootFallback() {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div dir="rtl" style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0A0A0A;color:#fff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;text-align:center;">
      <div style="font-size:22px;font-weight:600;color:#D4AF37;">PetWash</div>
      <div style="font-size:16px;opacity:.9;">מעדכנים לגרסה האחרונה…<br/><span style="opacity:.7;font-size:14px;">Updating to the latest version…</span></div>
      <button onclick="location.reload()" style="margin-top:8px;background:#D4AF37;color:#0A0A0A;border:none;border-radius:9999px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;">רענון / Refresh</button>
    </div>`;
}

(async function initApp() {
  try {
    // Wait for Firebase config with a 400ms hard timeout.
    // If the server is slow, we fall through immediately and firebase.ts
    // uses VITE_ env vars as fallback — no user-visible delay.
    if (window.__FIREBASE_CONFIG_READY__) {
      await Promise.race([
        window.__FIREBASE_CONFIG_READY__,
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 400))
      ]);
    }

    // Load App, ErrorBoundary, and auth-guardian ALL IN PARALLEL
    // Previously these were 3 sequential awaits — each blocking the next
    const [{ default: App }, { AppErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./components/AppErrorBoundary'),
      import('./lib/auth-guardian-2025'), // fire-and-forget side effect
    ]);

    createRoot(document.getElementById("root")!).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );

    // Boot succeeded — clear the retry guard so a future genuine failure can
    // still trigger one self-heal reload.
    try { sessionStorage.removeItem(BOOT_RETRY_KEY); } catch (_e) { /* ignore */ }

    // Non-blocking background initializations — do NOT await these
    import('./lib/rum').then(({ trackWebVitals }) => {
      trackWebVitals();
    }).catch(() => {});

    import('./lib/deviceTelemetry').then(({ setupDeviceTracking }) => {
      setupDeviceTracking();
    }).catch(() => {});

    import('./lib/deviceDetection').then(({ logDeviceInfo }) => {
      logDeviceInfo();
    }).catch(() => {});
  } catch (err) {
    let alreadyRetried = false;
    try { alreadyRetried = sessionStorage.getItem(BOOT_RETRY_KEY) === '1'; } catch (_e) { /* ignore */ }

    if (!alreadyRetried) {
      // First failure this session — likely a stale cached index pointing at
      // chunks that 404. Force a fresh fetch from the network once. (No alert
      // yet: a one-off that self-heals on reload is not actionable.)
      try { sessionStorage.setItem(BOOT_RETRY_KEY, '1'); } catch (_e) { /* ignore */ }
      const u = new URL(window.location.href);
      u.searchParams.set('_cb', String(Date.now()));
      window.location.replace(u.toString());
      return;
    }

    // Retry already happened and we STILL failed — this is a real white-screen.
    // Tell the server so the alarm fires, then show a branded panel (never blank).
    reportBootFailure(err);
    renderBootFallback();
  }
})();
