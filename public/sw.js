// Hand-rolled service worker (no Workbox/next-pwa): Next.js's static assets are
// content-hashed per build, so there's no fixed manifest to precache safely — instead
// this caches the app shell (offline fallback + manifest + icons) at install time and
// everything else opportunistically at runtime, keyed by cache version below.
const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `fitness-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fitness-runtime-${CACHE_VERSION}`;
const ROUTINES_CACHE = `fitness-routines-${CACHE_VERSION}`;
const CURRENT_CACHES = [APP_SHELL_CACHE, RUNTIME_CACHE, ROUTINES_CACHE];

const APP_SHELL_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isNextStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

// The dashboard's "rutinas guardadas" list — the one read the roadmap calls out to
// keep available offline. Scoped narrowly on purpose: only this GET select gets
// cached, not workout/set writes or other Supabase calls.
function isRoutinesApiRequest(request, url) {
  return request.method === "GET" && url.pathname.includes("/rest/v1/routines");
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkFetch) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      // offline.html is a plain static file with no client-side JS/hydration of its
      // own, unlike every real Next.js route — so it's safe to serve directly under
      // whatever URL the user was navigating to; there's no embedded router state
      // that could end up mismatched with the address bar.
      networkFirst(request, RUNTIME_CACHE).catch(async () => (await caches.match("/offline.html")) || Response.error())
    );
    return;
  }

  if (isNextStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (isRoutinesApiRequest(request, url)) {
    event.respondWith(networkFirst(request, ROUTINES_CACHE));
    return;
  }
});
