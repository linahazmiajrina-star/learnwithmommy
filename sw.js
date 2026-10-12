/* Offline support. Every file is served from the phone's cache straight away and refreshed in the background,
 * so the app opens with no internet, and an edit pushed to GitHub shows up the second time the app is opened.
 * Add any new file the app needs to SHELL so it works offline from the first visit. */
const APP_CACHE = "lwm-app-v3";
const FONT_CACHE = "lwm-fonts-v1";
const SHELL = [
  "./",
  "exam.html",
  "css/style.css",
  "js/app.js",
  "js/subjects.js",
  "js/data/chinese/year1.js",
  "js/data/chinese/year2.js",
  "js/data/chinese/year3.js",
  "js/data/chinese/year4.js",
  "js/data/chinese/year5.js",
  "js/data/chinese/year6.js",
  "js/data/english/year1.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) e.respondWith(cachedThenRefresh(e));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cachedOrFetch(e.request));
});

async function cachedThenRefresh(e) {
  const req = e.request;
  const cache = await caches.open(APP_CACHE);
  const page = req.mode === "navigate";
  const cached = (await cache.match(req, { ignoreSearch: page })) || (page ? await cache.match("./") : undefined);
  const fresh = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  });
  if (!cached) return fresh;
  e.waitUntil(fresh.catch(() => { /* offline: the cached copy is enough */ }));
  return cached;
}

// Google Fonts hardly ever change, so keep the first copy.
async function cachedOrFetch(req) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
