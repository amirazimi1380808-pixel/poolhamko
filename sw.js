/* ─── Poolhamko Service Worker ───
 * Strategy:
 *  - Precache the full application shell (HTML, CSS, JS, font, icons, manifest).
 *  - Cache-first for all precached local assets (they are versioned by cache name).
 *  - Navigation fallback → cached index.html (SPA-style offline reload).
 *  - Versioned cache + activate-time cleanup → no stale app versions stuck.
 *  - No sensitive financial data is ever cached (localStorage is not touched
 *    by the SW; only static shell assets live in the CacheStorage).
 * Bump CACHE_VERSION on any release so clients update cleanly. */

const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `poolhamko-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/storage.js',
    './js/secure-storage.js',
    './js/crypto.js',
    './js/transactions.js',
    './js/cards.js',
    './js/cheques.js',
    './js/debts.js',
    './js/birthdays.js',
    './js/budgets.js',
    './js/notifications.js',
    './js/settings.js',
    './js/ui-render.js',
    './js/charts.js',
    './js/jalali-calendar.js',
    './js/utils.js',
    './js/icons.js',
    './vendor/chart.umd.min.js',
    './assets/fonts/Vazirmatn-Variable.woff2',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-maskable-192.png',
    './assets/icons/icon-maskable-512.png',
    './assets/icons/apple-touch-icon.png'
];

/* Install: precache everything, activate immediately */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

/* Activate: delete old caches, take control */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k.startsWith('poolhamko-') && k !== CACHE_NAME)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/* Fetch:
 *  - navigations → cache-first with network fallback + offline shell fallback
 *  - same-origin static assets → cache-first (precached), then network,
 *    then cache put for anything same-origin not yet cached
 *  - cross-origin → network only (there should be none in this app) */
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    if (req.mode === 'navigate') {
        event.respondWith(
            caches.match('./index.html').then(cached => {
                const network = fetch(req)
                    .then(res => {
                        caches.open(CACHE_NAME).then(c => c.put('./index.html', res.clone()));
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
        return;
    }

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // never handle cross-origin

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
        })
    );
});
