// CRITICAL: All imports must be AFTER Firebase config loads
// Only import React root - App will be dynamically imported
import { createRoot } from "react-dom/client";

// HubSpot route change tracking
declare global {
  interface Window {
    _hsq?: any[];
    hbspt?: any;
    __FIREBASE_CONFIG__?: any;
    __FIREBASE_CONFIG_READY__?: Promise<boolean>;
  }
}

// PRODUCTION FIX: Wait for Firebase config before importing any Firebase-dependent code
(async function initApp() {
  // Wait for Firebase config to be ready (loaded from server or fallback set)
  if (window.__FIREBASE_CONFIG_READY__) {
    console.log('[App] Waiting for Firebase config...');
    await window.__FIREBASE_CONFIG_READY__;
    console.log('[App] Firebase config ready, importing app...');
  }
  
  // CRITICAL: Dynamic imports only AFTER config is ready
  // This ensures firebase.ts doesn't execute until config is loaded
  
  // Initialize Auth Guardian FIRST (before any Firebase imports)
  await import('./lib/auth-guardian-2025');
  
  const [{ default: App }] = await Promise.all([
    import('./App'),
    import('./index.css')
  ]);
  
  console.log('[App] App imported, initializing React...');

// Initialize HubSpot queue
window._hsq = window._hsq || [];

// Track route changes for HubSpot
function trackHubSpotPageView() {
  if (window._hsq) {
    const pathname = window.location.pathname;
    const search = window.location.search;
    window._hsq.push(["setPath", pathname + search]);
    window._hsq.push(["trackPageView"]);
  }
}

// Track initial page load
trackHubSpotPageView();

// Override history methods to track route changes
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

// Listen for popstate events (back/forward button)
window.addEventListener('popstate', trackHubSpotPageView);

  // Initialize RUM (Real User Monitoring) for performance tracking
  import('./lib/rum').then(({ trackWebVitals }) => {
    // Track Core Web Vitals (LCP, FID, CLS, TTFB) for 10% of sessions
    trackWebVitals();
  }).catch(err => console.error('RUM initialization error:', err));

  // Initialize device telemetry tracking for fraud prevention
  import('./lib/deviceTelemetry').then(({ setupDeviceTracking }) => {
    setupDeviceTracking();
  }).catch(err => console.error('Device telemetry initialization error:', err));

  // Initialize advanced device detection for browser/OS/firmware tracking
  import('./lib/deviceDetection').then(({ logDeviceInfo }) => {
    logDeviceInfo();
  }).catch(err => console.error('Device detection initialization error:', err));

  // Dynamically import AppErrorBoundary
  const { AppErrorBoundary } = await import('./components/AppErrorBoundary');
  
  createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
  
  // Register service worker for offline support
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered successfully:", registration.scope);
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });
  }
})();
