const CACHE_NAME = 'emi-calc-v3';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err => {
            // Don't let one failed asset kill the whole install.
            console.warn('SW: failed to cache', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; // let non-GET pass through untouched

  e.respondWith(
    (async () => {
      try {
        const cached = await caches.match(e.request);
        if (cached) return cached;

        const res = await fetch(e.request);
        if (res && res.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(e.request, res.clone());
          } catch (err) {
            console.warn('SW: cache put failed', err);
          }
        }
        return res;
      } catch (err) {
        // Network failed and nothing cached - fall back for page navigations.
        if (e.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }
        // Never leave respondWith with a rejected promise.
        return new Response('Offline and not cached.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});
