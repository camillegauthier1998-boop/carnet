/* Service worker : permet d'ouvrir l'application hors connexion.
   Réseau d'abord (les mises à jour arrivent dès qu'il y a du réseau), copie locale en secours.
   L'API (/api/*) n'est jamais interceptée : les données viennent toujours du serveur. */
const V = 'carnet-v7';
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

/* Notifications : le serveur envoie un signal sans contenu ; on récupère les messages en attente pour cet abonnement. */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let messages = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const j = sub && sub.toJSON();
      if (j) {
        const res = await fetch('/api/push/pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, auth: j.keys && j.keys.auth }) });
        if (res.ok) messages = (await res.json()).messages || [];
      }
    } catch (err) {}
    /* Le système exige d'afficher une notification à chaque signal */
    if (!messages.length) messages = [{ title: 'Carnet de santé familial', body: 'Vous avez des rappels : ouvrez le carnet pour les voir.', url: '/', tag: 'carnet' }];
    await Promise.all(messages.slice(0, 4).map(m => self.registration.showNotification(m.title, {
      body: m.body, tag: m.tag || undefined, icon: '/icon-192.png', badge: '/icon-192.png', lang: 'fr', data: { url: m.url || '/' }
    })));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const w of list) if (new URL(w.url).origin === self.location.origin && 'focus' in w) return w.focus();
    return self.clients.openWindow(url);
  }));
});
