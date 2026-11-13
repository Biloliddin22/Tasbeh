const CACHE_PREFIX = "tasbeh-shell-";
// Bump this version whenever a file in SHELL_FILES changes.
const CACHE_VERSION = 19;
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const SHELL_FILES = [
  "./",
  "style.css",
  "zikr.js",
  "translations.js",
  "main.js",
  "manifest.json",
  "Tasbeh.ico",
  "Tasbeh-192.png",
  "Tasbeh-512.png",
  "daily-chime.wav",
  "freestyle-chime.wav",
  "install-guide/chrome-menu.webp",
  "install-guide/install-option.webp",
  "install-guide/confirm-install.webp",
];
const scope = self.registration.scope;
const indexAlias = new URL("index.html", scope).href;
const shellURLs = new Set(SHELL_FILES.map(file => new URL(file, scope).href));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache the launch URL directly. Cloudflare Pages redirects the /index.html alias.
    await cache.addAll([...shellURLs].map(url => new Request(url, { cache: "reload", redirect: "error" })));
    // Recover the broken v2 shell immediately; normal updates wait for open app windows to close.
    if (await caches.has(CACHE_PREFIX + "2")) await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const oldCaches = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
    await Promise.all(oldCaches.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  url.search = "";
  const key = request.mode === "navigate" && url.href === indexAlias ? scope : url.href;
  if (!shellURLs.has(key)) return;

  event.respondWith(serveShell(request, key));
});

async function serveShell(request, key) {
  let cached;
  try {
    cached = await caches.match(key, { cacheName: CACHE_NAME });
  } catch {
    return fetch(request);
  }
  if (!cached || cached.redirected) return fetch(request);

  const range = request.headers.get("range");
  return range && key.endsWith(".wav") ? audioRange(cached, range) : cached;
}

// Audio players can request a slice even when the complete WAV is cached.
async function audioRange(response, range) {
  const data = await response.arrayBuffer();
  const size = data.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (start <= end) {
      return new Response(data.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "audio/wav",
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }
  return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
}
