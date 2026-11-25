const CACHE_NAME = "latex-studio-v3";

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/static/app.css?v=3",
  "/static/app.js?v=3",
  "/static/catalog.js?v=3",
  "/static/vendor/tex-svg-full.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Offline-first navigation fallback to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => {
        if (cached) {
          event.waitUntil(
            fetch(req)
              .then((res) => {
                if (res && res.ok) {
                  return caches.open(CACHE_NAME).then((c) => c.put("/", res));
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        return fetch(req).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // Cache-first for all same-origin static assets & bundled MathJax
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        if (!url.pathname.startsWith("/static/vendor/")) {
          event.waitUntil(
            fetch(req)
              .then((res) => {
                if (res && res.ok) {
                  return caches.open(CACHE_NAME).then((c) => c.put(req, res));
                }
              })
              .catch(() => {})
          );
        }
        return cached;
      }

      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
