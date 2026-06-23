const CACHE = 'gjstore-v5';
const SHELL = ['./index.html', './config.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  // GAS API e Cloudinary: sempre rede (dados frescos)
  if (url.includes('script.google.com') || url.includes('cloudinary.com')) {
    return;
  }

  // HTML / navegação: network-first (sempre versão nova, fallback cache offline)
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Demais assets: cache-first, fallback rede
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
