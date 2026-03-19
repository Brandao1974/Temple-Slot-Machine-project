const CACHE_NAME = 'templo-cache-' + Date.now();

const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/mobile/mobile-layout.css',
  '/script.js',
  '/engine/slotConfig.js',
  '/engine/slotEngine.js'
];

// INSTALL (único e correto)
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// ACTIVATE (limpa versões antigas)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// FETCH (cache primeiro, rede como fallback)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});