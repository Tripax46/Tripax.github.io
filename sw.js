// Service worker « Les pizzas de Fafa » : permet l'installation et l'usage hors ligne.
// Pour forcer la mise à jour chez tout le monde après une modification, change le numéro de version.
const VERSION = 'fafa-v1';
const FICHIERS = ['./', 'index.html', 'recueil.js', 'banniere.jpg', 'manifest.webmanifest',
                  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c =>
      // un fichier manquant n'empêche pas l'installation des autres
      Promise.all(FICHIERS.map(f => c.add(f).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // YouTube, polices… : on laisse le réseau gérer

  // Pages : réseau d'abord (toujours la dernière version), cache si hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copie = r.clone();
        caches.open(VERSION).then(c => c.put(req, copie));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./')))
    );
    return;
  }

  // Autres fichiers : cache d'abord, et mise à jour discrète en arrière-plan
  e.respondWith(
    caches.match(req).then(enCache => {
      const reseau = fetch(req).then(r => {
        if (r && r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
        return r;
      }).catch(() => enCache);
      return enCache || reseau;
    })
  );
});
