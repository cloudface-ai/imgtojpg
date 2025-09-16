// Minimal service worker for PWA installability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No aggressive caching; just a safe network-first for HTML, fall back to cache if ever added later
// No fetch handler to avoid no-op overhead warnings


