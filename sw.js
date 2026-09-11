/* Skyrim guide offline cache, version 2.
   With internet: always loads the newest guide from GitHub (and saves a copy).
   Without internet: loads the saved copy instantly. */
var CACHE = 'skyrim-guide-v2';
var FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  /* download fresh copies; if any fail (e.g. offline), keep the old version */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || c.match('index.html');
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function finish(res) { if (!done && res) { done = true; resolve(res); } }
    /* slow connection: fall back to the saved copy after 3 seconds */
    var timer = setTimeout(function () { fromCache(req).then(finish); }, 3000);
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      clearTimeout(timer);
      finish(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (hit) { finish(hit || Response.error()); });
    });
  }));
});
