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
// This kill-script (a) clears every cache, (b) unregisters itself, (c) tells
// open clients to reload so they pick up the fresh build. Idempotent — running
// it on a clean device is a no-op.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_KILLED', message: 'Cache cleared, reloading...' });
      });
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Pass every request straight through to the network — never serve from cache.
  event.respondWith(fetch(event.request));
});
