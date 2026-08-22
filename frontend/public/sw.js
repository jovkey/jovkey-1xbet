/*
 * Service Worker minimal — REQUIS pour une vraie installation PWA sur Android.
 * Sans un service worker qui possède un gestionnaire "fetch", Chrome Android ne crée
 * qu'un raccourci (avec badge navigateur) au lieu d'une vraie appli (WebAPK) posée sur
 * l'écran d'accueil et lancée en plein écran. Ici on ne met AUCUN cache agressif (pour
 * ne jamais servir une version périmée du site ni casser l'API/SSE) : le handler existe,
 * c'est ce que Chrome exige, et il laisse tout passer normalement vers le réseau.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  // On ne gère que les requêtes GET ; POST / SSE / webhooks passent intacts.
  if (event.request.method !== 'GET') return;
  // Pas de respondWith → le navigateur gère la requête normalement (réseau direct).
  // La simple présence de ce gestionnaire suffit à rendre l'app installable.
});

/* ── Notifications push ─────────────────────────────────────────────
 * Le serveur envoie un JSON { title, body, url }. On affiche la notification
 * (même app fermée) et, au clic, on ouvre/ramène l'appli sur l'URL indiquée.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'Coupon Gratuit', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Coupon Gratuit';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { if ('navigate' in w) { try { w.navigate(url); } catch (e) {} } return w.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
