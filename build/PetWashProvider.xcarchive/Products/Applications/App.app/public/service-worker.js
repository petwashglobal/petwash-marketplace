// PetWash service-worker kill switch.
//
// Some old iPhone/iPad sessions registered /service-worker.js instead of
// /sw.js. If this file is missing, Firebase Hosting serves index.html for the
// service-worker script URL and the old registration can stay in control. This
// file intentionally mirrors /sw.js: it clears Cache Storage, asks open pages
// to reload once, passes all fetches to the network, and unregisters itself.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
    } catch (_e) {
      // No clients yet.
    }

    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (_e) {
      // Cache API unavailable or partial failure.
    }

    try {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_KILLED', reason: 'service-worker-cache-cleared' });
      }
    } catch (_e) {
      // No clients to notify.
    }

    try {
      await self.registration.unregister();
    } catch (_e) {
      // Best effort.
    }
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
