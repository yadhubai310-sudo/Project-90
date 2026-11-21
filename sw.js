const CACHE_PREFIX = 'project90-';
const CACHE_NAME = `${CACHE_PREFIX}shell-v2`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/seed.js',
  './js/date-utils.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  // No self.skipWaiting() here on purpose: a new service worker installs
  // and waits. It only takes over when the user taps "Refresh" on the
  // update banner, so an open session is never interrupted automatically.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Only ever touch PROJECT 90's own caches, never anything else
          // that might exist on the same origin.
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Page navigations: try the network first so you always get the latest
  // HTML when online, but fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (CSS, JS, icons): serve from cache instantly if present,
  // and quietly refresh the cache in the background from the network.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
