const STATIC_CACHE = "vitrinezap-static-v5.5";
const HTML_CACHE = "vitrinezap-html-v6.2";
const OFFLINE_URL = "./offline.html";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/storeApi.js",
  "./js/supabaseClient.js",
  "./js/utils.js",
  "./js/pwa.js",
  "./js/push.js",
  "./js/cartFuture.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/placeholders/product-placeholder.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, HTML_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSupabase = url.hostname.includes("supabase");
  const isAdminRoute =
    url.pathname.endsWith("/admin.html") ||
    url.pathname.includes("/js/admin.js") ||
    url.pathname.includes("/css/admin.css");

  if (isSupabase || isAdminRoute) {
    return;
  }

  const isStorefrontStaticAsset =
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("manifest.json") ||
    url.pathname.endsWith("/css/styles.css") ||
    url.pathname.endsWith("css/styles.css") ||
    url.pathname.endsWith("/js/config.js") ||
    url.pathname.endsWith("js/config.js") ||
    url.pathname.endsWith("/js/app.js") ||
    url.pathname.endsWith("js/app.js") ||
    url.pathname.endsWith("/js/storeApi.js") ||
    url.pathname.endsWith("js/storeApi.js") ||
    url.pathname.endsWith("/js/supabaseClient.js") ||
    url.pathname.endsWith("js/supabaseClient.js") ||
    url.pathname.endsWith("/js/utils.js") ||
    url.pathname.endsWith("js/utils.js") ||
    url.pathname.endsWith("/js/pwa.js") ||
    url.pathname.endsWith("js/pwa.js") ||
    url.pathname.endsWith("/js/push.js") ||
    url.pathname.endsWith("js/push.js") ||
    url.pathname.endsWith("/js/cartFuture.js") ||
    url.pathname.endsWith("js/cartFuture.js");

  if (isStorefrontStaticAsset) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
});

async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request, { cache: "no-store" });
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || (await caches.match(OFFLINE_URL));
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (request.destination === "image") {
      return caches.match("./assets/placeholders/product-placeholder.svg");
    }
    return new Response("Offline", {
      status: 503,
      statusText: "Offline"
    });
  }
}

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {
    title: "Novidades na vitrine",
    body: "Abra o aplicativo para ver o que chegou."
  };

  const options = {
    body: payload.body,
    icon: payload.icon || "./assets/icons/icon-192.png",
    badge: payload.badge || "./assets/icons/icon-192.png",
    image: payload.image,
    data: {
      target_url: payload.target_url || "./index.html"
    }
  };

  event.waitUntil(self.registration.showNotification(payload.title || "VitrineZap", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.target_url || "./index.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.includes(targetUrl));
      if (matchingClient) {
        return matchingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
