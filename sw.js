// Bump this version when publishing changes to the offline application files.
const CACHE_VERSION = 'truco-v6';
const CACHE_NAME = `${CACHE_VERSION}:${self.registration.scope}`;
const FILES = ['./', './index.html', './styles.css', './app.js', './engine.js',
  './storage.js', './tutorial.js', './icon.svg', './apple-touch-icon.png',
  './manifest.webmanifest', './assets/toast_mascot.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  // Let the running scorer finish using its current version; activate on close.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('truco-') && key.endsWith(`:${self.registration.scope}`) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin
      || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const saved = await cache.match(event.request);
      if (saved) return saved;
      if (event.request.mode === 'navigate') return cache.match('./index.html');
      return Response.error();
    }
  })());
});
