// Keeps the app working offline. Network first, so an update always wins; whatever was loaded is kept as the fallback.
// The text reader is large, so it is only cached after you use it once.
const CACHE = "rd-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "ocr.js", "sample.js", "theme-init.js", "icon.svg", "icon-192.png", "manifest.webmanifest",
  "engine/index.js", "engine/detect.js", "engine/checks.js", "engine/boxes.js", "engine/ocrmap.js", "engine/exif.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match("index.html")))
  );
});
