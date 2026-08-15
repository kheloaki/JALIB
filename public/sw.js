/* Jamaa Market PWA service worker — push + minimal offline shell */

const CACHE_NAME = "jamaa-market-v2";
const SHELL_URLS = ["/fr/dashboard", "/jamaa-market-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("_next")) return;

  const acceptsHtml = event.request.headers
    .get("accept")
    ?.includes("text/html");
  const isDocument =
    event.request.mode === "navigate" ||
    (event.request.destination === "document" && acceptsHtml);

  if (isDocument) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/fr/dashboard")),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/fr/dashboard"))),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Jamaa Market",
    body: "Nouvelle alerte",
    url: "/fr/alertes",
    tag: "jamaa-alert",
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/jamaa-market-logo.png",
      badge: "/jamaa-market-logo.png",
      tag: payload.tag,
      data: { url: payload.url },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/fr/alertes";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
