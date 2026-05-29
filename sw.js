// Service worker for offline use. A songbook gets used where wifi is flaky or
// absent, so we cache the app shell + song data and serve them offline.
//
// Strategy: stale-while-revalidate. Every request is answered from cache
// immediately (fast, offline-capable) while a fresh copy is fetched in the
// background for next time. Bump CACHE_VERSION to force clients onto new
// shell assets.
const CACHE_VERSION = 'vironia-v3';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './songs.json'
];
// The app icon is a cross-origin PNG (media.voog.com); it can't be precached
// (opaque response), so the runtime fetch handler caches it on first load.

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Cache entries individually so one failure (e.g. the CDN) doesn't abort
    // the whole install.
    await Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);

    const networkPromise = fetch(req).then(res => {
      // Cache successful same-origin responses and opaque cross-origin ones
      // (e.g. the no-cors CDN script request).
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    // Serve cache first; fall back to network; for navigations with neither,
    // fall back to the cached app shell.
    return cached
      || (await networkPromise)
      || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  })());
});
