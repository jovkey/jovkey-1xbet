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
