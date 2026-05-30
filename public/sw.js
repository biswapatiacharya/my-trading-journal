// Service Worker for Trading Journal PWA
const CACHE_NAME = "trading-journal-v1";
const OFFLINE_URL = "/offline";

// Assets to cache immediately
const PRECACHE_ASSETS = [
  "/",
  "/dashboard",
  "/trades",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Non-critical: don't fail install if pre-cache fails
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip API routes and auth routes — always network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // For navigation requests: network-first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? caches.match("/offline"))
        )
    );
    return;
  }

  // For static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return res;
        });
      })
    );
  }
});
