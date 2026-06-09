// Self-uninstalling service worker.
//
// Earlier builds shipped a real Workbox-style sw.js (petwash-pwa-v2) that
// pre-cached the signup/signin app bundles. Devices that registered that
// worker keep serving the stale cached chunks even after a fresh deploy — on
// iPad the symptom is TWO React trees mounted on /signup at once (stale old
// SignUp page + freshly fetched SignUpLuxury). Nothing in the current client
// registers a service worker, but orphan registrations persist on returning
// devices.
//
// This kill-script:
//   (a) takes immediate control of all open clients (skipWaiting + claim)
//   (b) clears every Cache Storage entry
//   (c) tells open clients to reload ONCE (sessionStorage-guarded in main.tsx)
//   (d) unregisters itself
//   (e) until unregistered, passes every fetch straight to the network
//
// Idempotent on a clean device. Safe on a stale device — converges in one
// page load.

self.addEventListener('install', () => {
  // Activate as soon as we're installed instead of waiting for all old
  // SW-controlled clients to close. Without this, an old worker keeps
  // serving cached chunks indefinitely.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Take control of every open page right now. This displaces any old
    // SW that was previously controlling them so the next fetch goes
    // through our pass-through handler, not the old cache.
    try {
      await self.clients.claim();
    } catch (_e) {
      // Some browsers throw if there are no clients; ignore.
    }

    // Wipe every Cache Storage entry — including the old workbox precache.
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (_e) {
      // No caches API or partial failure — fall through to the reload
      // signal so the page still refreshes.
    }

    // Ask every controlled page to reload exactly once. The listener in
    // client/src/main.tsx uses a sessionStorage flag to avoid a reload
    // loop on already-clean devices.
    try {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_KILLED', reason: 'cache-cleared' });
      }
    } catch (_e) {
      // No clients to notify — fine.
    }

    // Unregister so future loads have no service worker at all.
    try {
      await self.registration.unregister();
    } catch (_e) {
      // Best-effort — orphan registration will be cleaned up on next visit.
    }
  })());
});

self.addEventListener('fetch', (event) => {
  // Pass every request straight to the network — never serve from cache.
  // This holds for the brief window between activate and unregister.
  event.respondWith(fetch(event.request));
});
