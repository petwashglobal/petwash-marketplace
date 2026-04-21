// Cache bust: 2026-03-08
// Performance-optimized: parallel imports, 400ms Firebase config timeout
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/i18next-init";

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
