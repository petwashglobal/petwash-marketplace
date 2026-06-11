// Cache bust: 2026-03-08
// Performance-optimized: parallel imports, 400ms Firebase config timeout
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/i18next-init";

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

(async function initApp() {
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
})();
