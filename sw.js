/* Poolham service worker.
 *
 * Goal: the dashboard must open instantly, work with no network at all, and
 * never show a blank page because a CDN was slow or blocked.
 *
 * Strategy
 *   navigations  -> network-first, cache fallback (so edits to index.html land
 *                   immediately when online, and still work offline)
 *   same-origin  -> cache-first, fill on miss
 *   cross-origin -> untouched (nothing external is loaded any more anyway)
 */

const VERSION = 'poolham-v1';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/tailwind.js',
  './vendor/chart.js',
  './vendor/lucide.js',
  './vendor/vazirmatn.css',
  './vendor/fonts/Vazirmatn-Regular.woff2',
  './vendor/fonts/Vazirmatn-Medium.woff2',
  './vendor/fonts/Vazirmatn-SemiBold.woff2',
  './vendor/fonts/Vazirmatn-Bold.woff2',
  './vendor/fonts/Vazirmatn-Black.woff2',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-167.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Deliberately NOT cache.addAll(): that rejects the whole install if a
    // single URL 404s. One missing icon must not cost us the offline app.
    await Promise.all(CORE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(VERSION);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
               new Response('<h1 dir="rtl">آفلاین هستید</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
