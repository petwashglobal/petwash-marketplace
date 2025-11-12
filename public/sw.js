const STATIC = "petwash-static-v1";
const DYNAMIC = "petwash-dynamic-v1";

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/brand/petwash-logo-official.png",
];

// Install event - precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.error("SW: Failed to precache assets", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC && key !== DYNAMIC)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== "GET") return;
  
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) return;
  
  // Skip API requests from caching
  if (url.pathname.startsWith("/api/")) return;
  
  // Cache-first for static assets (JS, CSS, images, fonts)
  if (/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        
        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      }).catch(() => {
        // Return offline fallback if available
        return new Response("Offline - resource not cached", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })
    );
    return;
  }
  
  // Stale-while-revalidate for HTML pages
  event.respondWith(
    (async () => {
      const cache = await caches.open(DYNAMIC);
      const cached = await cache.match(request);
      
      // Fetch fresh version in background
      const freshPromise = fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached); // Fallback to cached on error
      
      // Return cached immediately, or wait for fresh
      return cached || freshPromise;
    })()
  );
});

// Message handler for manual cache control
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      })
    );
  }
});
