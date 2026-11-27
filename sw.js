const CACHE_NAME = 'maricopa-cache';

const PRECACHE_URLS = [
  '/index.html',
  '/home.html',
  '/inventory.html',
   '/analytics.html',
   '/orders.html',
   '/scanner.html',
   '/settings.html',
   '/support.html',
   '/logout.html',
  '/manifest.json',
  '/download.png',
  '/download.png',
  '/download.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn('[SW] Failed to precache:', url, err);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('maricopa-cache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: cache-first app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cachedPage = await caches.match(request, { ignoreSearch: true });
        if (cachedPage) return cachedPage;

        const shell = await caches.match('/index.html');
        if (shell) return shell;

        try {
          return await fetch(request);
        } catch (err) {
          return new Response('Offline and no cached app shell available.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }

  // Static assets: network-first, fall back to cache
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, copy);
        }

        return response;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        return new Response('Offline resource unavailable', { status: 503 });
      }
    })()
  );
});
