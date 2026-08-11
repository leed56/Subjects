/* LakBiz app-shell service worker — cache static assets + a public-page offline
 * fallback only. Authenticated/tenant HTML is NEVER cached: this device may be
 * shared, and a cached dashboard/sales/customers page would let a different
 * user (or the same user in a different org) see stale tenant data while
 * offline. See docs/ARCHITECTURE_AUDIT.md, "Service worker" section.
 */
const CACHE_VERSION = "lakbiz-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_URLS = ["/manifest.webmanifest", "/icon", "/apple-icon"];

/**
 * Only these documents may ever be cached and replayed offline. Every entry
 * here MUST be rendered identically for every visitor (no auth cookies, no
 * per-org/per-user data). Do not add a shop/admin/settings route to this
 * list — those render tenant-specific content server-side.
 */
const PUBLIC_DOCUMENT_ALLOWLIST = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (shouldBypassCache(request, url)) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (isDocumentRequest(request)) {
    if (isPublicDocumentPath(url.pathname)) {
      event.respondWith(networkFirstPublicPage(request));
    } else {
      // Authenticated/tenant document: network-only, never read or write
      // any cache. On failure, return a generic offline response instead
      // of any previously-cached page content.
      event.respondWith(networkOnlyDocument(request));
    }
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

function shouldBypassCache(request, url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (url.hostname.includes("supabase")) return true;
  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch")) return true;
  if (url.pathname.startsWith("/_next/data")) return true;
  return false;
}

function isDocumentRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isPublicDocumentPath(pathname) {
  return PUBLIC_DOCUMENT_ALLOWLIST.includes(pathname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cachesMatch(cache, request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cachesMatch(cache, request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const network = await networkPromise;
  if (network) return network;
  return Response.error();
}

/** Public marketing/login pages only — safe to cache, identical for everyone. */
async function networkFirstPublicPage(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cachesMatch(cache, request);
    if (cached) return cached;
    return offlineResponse();
  }
}

/** Authenticated/tenant pages: always hit the network, never cache the result. */
async function networkOnlyDocument(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response(
    "Offline — open LakBiz from your home screen once you're back online.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

async function cachesMatch(cache, request) {
  const direct = await cache.match(request);
  if (direct) return direct;
  return cache.match(stripSearch(request.url));
}

function stripSearch(url) {
  const next = new URL(url);
  next.search = "";
  return next.toString();
}
