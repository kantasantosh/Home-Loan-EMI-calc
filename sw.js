const CACHE_NAME = 'emi-calc-v4';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err => {
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
  if (e.request.method !== 'GET') return;

  // Treat ALL navigations (including the app launching from the home-screen
  // icon) as a request for index.html, regardless of the exact URL/query
  // Chrome attaches. This avoids exact-Request cache-key mismatches that
  // can intermittently miss right after install.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const cached = await caches.match('./index.html');
          if (cached) return cached;
          const res = await fetch('./index.html');
          if (res && res.status === 200) {
            try {
              const cache = await caches.open(CACHE_NAME);
              cache.put('./index.html', res.clone());
            } catch (err) {
              console.warn('SW: cache put failed', err);
            }
          }
          return res;
        } catch (err) {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
          return new Response(
            '<h1>Offline</h1><p>Could not load the app and nothing is cached yet. Please reconnect and try again.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // Non-navigation requests (css/js/img/etc.): cache-first, network fallback.
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
        return new Response('Offline and not cached.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});
