// Service worker des pizzas de Fafa : fonctionne hors ligne.
// Augmente le numéro de version à chaque modification des fichiers.
const VERSION = 'fafa-v16';
const FICHIERS = [
  './', 'index.html', 'pizzas.json', 'banniere.jpg', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.ico',
  'images/favicon-32.png', 'images/apple-touch-icon.png', 'images/accueil.png',
  'images/fond-accueil.jpg', 'images/logo-signature.png', 'images/picto-camion.png', 'images/picto-vege.png', 'images/logo-ooni.png', 'images/affiche-merci.jpg', 'images/affiche-merci-pc.jpg', 'musique.mp3'
];

// Lecture audio depuis le cache : Safari demande des morceaux (en-tête Range)
function reponsePartielle(req, rep) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return rep;
  return rep.arrayBuffer().then(buf => {
    const deb = +m[1], fin = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
    const part = buf.slice(deb, fin + 1);
    return new Response(part, { status: 206, statusText: 'Partial Content', headers: {
      'Content-Type': rep.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + deb + '-' + fin + '/' + buf.byteLength,
      'Content-Length': part.byteLength } });
  });
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c =>
    // un fichier manquant (ex. banniere.jpg) ne bloque pas l'installation
    Promise.all(FICHIERS.map(f => c.add(f).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(noms => Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) {
    // médias (musique) : servis depuis le cache s'ils y sont, sinon directement depuis le réseau
    e.respondWith(caches.match(req.url).then(r => r ? reponsePartielle(req, r) : fetch(req)));
    return;
  }
  const frais = req.mode === 'navigate' || /\.(json|html)$/.test(new URL(req.url).pathname);
  if (frais) {
    // page et données : réseau d'abord (toujours à jour), cache en secours hors ligne
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  } else {
    // images, icônes : cache d'abord
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(rep => {
      // on ne garde en cache que les réponses réussies (jamais une erreur 404)
      if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
      return rep;
    })));
  }
});

// Toucher la notification du minuteur ramène sur l'application
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs =>
    cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
