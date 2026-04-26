/**
 * Tech Pulse — Service Worker
 *
 * Strategien:
 *  - App-Shell (HTML, JS, CSS, Icons, Manifest): cache-first mit Versions-Cache.
 *  - Supabase REST-API: stale-while-revalidate (sofortige Anzeige aus Cache,
 *    parallel Aktualisierung im Hintergrund).
 *  - Lokale JSON-Dateien (data/*.json): network-first mit Cache-Fallback.
 *  - Externe Bilder (Artikelvorschauen): cache-first, runtime-cache.
 *
 * Bei jedem App-Update CACHE_VERSION hochzählen — alte Caches werden in
 * activate() automatisch entsorgt.
 */

const CACHE_VERSION = 'v1.0.0';
const CORE_CACHE    = `tp-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tp-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './archive.html',
  './app.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ─── Install ───────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('tp-') && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML-Navigation: network-first (Updates sollen schnell sichtbar sein)
  if (req.mode === 'navigate' || (sameOrigin && req.destination === 'document')) {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }

  // App-Shell-Assets (same-origin, statisch): cache-first
  if (sameOrigin) {
    // data/*.json soll immer möglichst frisch sein
    if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
      event.respondWith(networkFirst(req));
      return;
    }
    event.respondWith(cacheFirst(req));
    return;
  }

  // Supabase REST-API: stale-while-revalidate
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Supabase JS SDK (CDN): cache-first
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Externe Bilder (z.B. Artikelvorschauen): cache-first
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req));
    return;
  }
});

// ─── Cache-Strategien ──────────────────────────────────────────────────────

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, fallbackUrl) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('Offline', { status: 503 });
}

// ─── Push Notifications ────────────────────────────────────────────────────
//
// Erwartetes Payload-Format (JSON):
//   {
//     "title": "Tech Pulse · Neu",
//     "body":  "KI bricht Rekorde",
//     "url":   "/index.html",
//     "tag":   "edition-2026-04-26"
//   }
//
// Falls kein JSON-Payload: sinnvoller Default.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {
    data = { title: 'Tech Pulse', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Tech Pulse';
  const options = {
    body: data.body || '',
    icon: data.icon || './icons/icon-192.png',
    badge: data.badge || './icons/icon-96.png',
    tag: data.tag || 'tech-pulse',
    renotify: true,
    data: { url: data.url || './index.html' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      const clientUrl = new URL(client.url);
      const targetUrl = new URL(target, self.location.origin);
      if (clientUrl.origin === targetUrl.origin) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl.href);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

// Subscription-Reset: vom Browser ausgelöst, wenn die alte Subscription
// abläuft. Wir benachrichtigen den (offenen) Client, damit der sich neu
// registrieren kann; ohne offenen Client wird beim nächsten App-Start neu
// subscribed.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    all.forEach((client) => client.postMessage({ type: 'pushsubscriptionchange' }));
  })());
});
