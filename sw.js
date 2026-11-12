/* Popps's Garage Dyno service worker — caches the app shell so the
 * dyno works offline in the garage. Plain JavaScript, no runtime
 * download, no network at all. Version the cache name on release. */
var CACHE = 'garage-dyno-v3';
var ASSETS = [
  './', './index.html', './dyno.js', './app.js', './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      return cached || fetch(event.request).then(function (resp) {
        // Cache successful same-origin responses for offline use.
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return resp;
      }).catch(function () {
        return cached;
      });
    })
  );
});
