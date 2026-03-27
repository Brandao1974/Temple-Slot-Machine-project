const CACHE_NAME = `templo-cache-${Date.now()}`;
console.log("Cache version:", CACHE_NAME);

const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/mobile/mobile-layout.css',
  './js/script.js',
  './engine/slotConfig.js',
  './engine/slotEngine.js'
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') return;

  // Ignora extensões e requests inválidos
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {

        if (response) return response;

        return fetch(event.request)
          .then(fetchResponse => {

            // Ignora respostas inválidas
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            const responseClone = fetchResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });

            return fetchResponse;
          });

      })
  );
});