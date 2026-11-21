/* Service worker : permet d'ouvrir l'application hors connexion.
   Réseau d'abord (les mises à jour arrivent dès qu'il y a du réseau), copie locale en secours.
   L'API (/api/*) n'est jamais interceptée : les données viennent toujours du serveur. */
const V = 'carnet-v3';
const FILES = ['/', '/index.html', '/style.css', '/app.js', '/react.bundle.js', '/htm.js', '/manifest.webmanifest', '/icon-192.png', '/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const ok = (u.origin === location.origin && !u.pathname.startsWith('/api/')) || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname);
  if (!ok) return;
  e.respondWith(
    fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
