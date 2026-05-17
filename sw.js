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

const CACHE_VERSION = 'v1.3.0';
const CORE_CACHE    = `tp-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tp-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './archive.html',
  './app.js',
  './env.js',
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

  // Supabase REST-API
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    // Die "aktuelle Edition" (is_current=eq.true) wechselt täglich — hier
    // muss das Netz gewinnen, sonst zeigt der erste Aufruf nach einem
    // Edition-Wechsel die Vortagsausgabe aus dem Cache.
    if (url.pathname.endsWith('/editions') && url.searchParams.get('is_current') === 'eq.true') {
      event.respondWith(networkFirst(req));
      return;
    }
    // Restliche REST-Calls (Artikel pro Edition, Videos): stale-while-revalidate
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

