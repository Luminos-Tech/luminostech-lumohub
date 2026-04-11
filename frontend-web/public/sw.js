/* =============================================
   LumoHub PWA Service Worker
   Mục đích: Cache static assets để app hoạt động offline
   Chiến lược: Cache-first cho static assets, network-first cho API
============================================= */

const CACHE_NAME = "lumohub-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/logo_lumohub.png",
];

// ─── Install: cache static assets ───────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Failed to cache some assets:", err);
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// ─── Activate: cleanup old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all clients immediately
      self.clients.claim();
    })
  );
});

// ─── Fetch: cache-first cho static, network-first cho API ───────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Chrome extensions and dev tools
  if (url.protocol === "chrome-extension:") return;

  // API requests: network-first (always try to get fresh data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Optionally cache successful GET responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets / pages: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Cache successful responses for static content
        if (response.ok && (
          url.pathname.startsWith("/_next/static/") ||
          url.pathname.startsWith("/_next/image/") ||
          url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".woff2") ||
          url.pathname.endsWith(".png") ||
          url.pathname.endsWith(".svg") ||
          url.pathname.endsWith(".ico")
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Push notifications (nếu cần hỗ trợ push trong tương lai) ───────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "LumoHub", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "LumoHub", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-72.png",
      tag: data.tag || "lumohub-notification",
      data: data.data || {},
      vibrate: [200, 100, 200],
    })
  );
});

// ─── Notification click ──────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Nếu đã có cửa sổ mở, focus vào
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Nếu chưa có, mở cửa sổ mới
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
