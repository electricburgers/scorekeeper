// PWA-mode coverage — 15 tests exercising what "installed, works offline" actually depends on:
// sw.js's real install/activate/fetch logic (executed for real via Node's vm module against a
// mock ServiceWorkerGlobalScope/Cache Storage, not just parsed as text the way
// tests/sw-integrity.test.js's static checks do — see that file's own top comment for why it
// stops at static analysis) and the installability metadata (manifest.json, index.html's PWA
// meta/link tags) a browser's "Add to Home Screen"/install prompt actually reads.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SW_SRC = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const WORKER_ORIGIN = "http://scorekeeper.test";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// A lightweight Request stand-in rather than Node's real global Request: sw.js's install step
// constructs `new Request(f, {cache:'reload'})` with a RELATIVE path ('./index.html') — the
// real fetch-spec Request requires an absolute URL with no implicit base outside a document/
// worker, so it throws on a bare relative string. This resolves against WORKER_ORIGIN instead,
// the same resolution self.location gives a real service worker, and keeps whatever `.cache`
// hint was passed so the install-step test below can see it.
class MockRequest {
  constructor(input, opts) {
    this.url = new URL(input, WORKER_ORIGIN + "/").href;
    this.method = (opts && opts.method) || "GET";
    this.cache = opts && opts.cache;
  }
}
function mockResponse(ok, tag) {
  return { ok, tag, clone() { return this; } };
}

// Builds a fresh Cache Storage + ServiceWorkerGlobalScope mock and runs the real sw.js source
// against it inside its own vm context — genuinely separate `decision`/`decidedAt` module state
// per call, same as a real service worker restarting.
function loadSW(fetchImpl) {
  const cachesStore = new Map(); // cacheName -> Map(resolvedURL -> response)
  function resolveKey(input) {
    const raw = typeof input === "string" ? input : input.url;
    return new URL(raw, WORKER_ORIGIN + "/").href;
  }
  const caches = {
    async open(name) {
      if (!cachesStore.has(name)) cachesStore.set(name, new Map());
      const map = cachesStore.get(name);
      return {
        async match(input) {
          return map.get(resolveKey(input));
        },
        async put(input, response) {
          map.set(resolveKey(input), response);
        },
      };
    },
    async keys() {
      return [...cachesStore.keys()];
    },
    async delete(name) {
      return cachesStore.delete(name);
    },
  };
  const listeners = {};
  const selfObj = {
    addEventListener(type, handler) {
      (listeners[type] = listeners[type] || []).push(handler);
    },
    location: { origin: WORKER_ORIGIN, href: WORKER_ORIGIN + "/" },
    skipWaiting() {
      selfObj._skipWaitingCalled = true;
    },
    clients: {
      claim() {
        selfObj._claimCalled = true;
      },
    },
  };
  const sandbox = {
    self: selfObj,
    caches,
    fetch: fetchImpl,
    Request: MockRequest,
    URL,
    Promise,
    setTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox, { filename: "sw.js" });
  return { listeners, cachesStore, self: selfObj, resolveKey };
}

async function fireInstall(sw) {
  let waited;
  sw.listeners.install[0]({ waitUntil: (p) => (waited = p) });
  await waited;
}
async function fireActivate(sw) {
  let waited;
  sw.listeners.activate[0]({ waitUntil: (p) => (waited = p) });
  await waited;
}
async function fireFetch(sw, request) {
  let responded;
  const sideEffects = [];
  sw.listeners.fetch[0]({
    request,
    respondWith: (p) => (responded = p),
    waitUntil: (p) => sideEffects.push(p),
  });
  const handled = responded !== undefined;
  // Deliberately NOT awaiting sideEffects (waitUntil's promises) here: in a real browser,
  // waitUntil() only extends how long the browser is willing to keep the worker alive — it
  // never delays the response respondWith() delivers to the page. sw.js's fetch handler passes
  // ITS OWN slow background network refresh to waitUntil (`e.waitUntil(network.catch(()=>{}))`)
  // regardless of which branch answers `responded` — awaiting it here would make every timing
  // assertion below measure the slow background refresh instead of the actual response latency.
  const response = handled ? await responded : undefined;
  return { handled, response, background: Promise.allSettled(sideEffects) };
}
const CACHE_NAME = SW_SRC.match(/const CACHE_NAME='([^']+)'/)[1];
const SHELL_FILES = [
  ...SW_SRC.match(/const SHELL_FILES=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g),
].map((m) => m[1]);

// ============================================================================
// install: precaches the app shell for offline-first launch
// ============================================================================
describe("Service worker install: precaches the app shell", () => {
  it("caches every SHELL_FILES entry under CACHE_NAME", async () => {
    const sw = loadSW(async () => mockResponse(true));
    await fireInstall(sw);
    const cache = sw.cachesStore.get(CACHE_NAME);
    assert.ok(cache, "CACHE_NAME was never opened");
    assert.equal(cache.size, SHELL_FILES.length);
    for (const f of SHELL_FILES) {
      assert.ok(cache.has(sw.resolveKey(f)), `${f} was not precached`);
    }
  });

  it("calls self.skipWaiting() so a new build activates without waiting on old tabs to close", async () => {
    const sw = loadSW(async () => mockResponse(true));
    await fireInstall(sw);
    assert.equal(sw.self._skipWaitingCalled, true);
  });

  it("fetches every shell file with {cache:'reload'}, bypassing the browser's own HTTP cache (a stale precache would defeat the whole install)", async () => {
    const seenCacheOpts = [];
    const sw = loadSW(async (req) => {
      seenCacheOpts.push(req.cache);
      return mockResponse(true);
    });
    await fireInstall(sw);
    assert.equal(seenCacheOpts.length, SHELL_FILES.length);
    assert.ok(seenCacheOpts.every((c) => c === "reload"));
  });
});

// ============================================================================
// activate: drops stale caches from a previous build, claims already-open tabs
// ============================================================================
describe("Service worker activate: old-build cache cleanup", () => {
  it("deletes every cache whose name isn't the current CACHE_NAME, and calls self.clients.claim()", async () => {
    const sw = loadSW(async () => mockResponse(true));
    sw.cachesStore.set("trivia-scorekeeper-shell-v12", new Map()); // a stale previous build
    sw.cachesStore.set(CACHE_NAME, new Map());
    await fireActivate(sw);
    assert.deepEqual([...sw.cachesStore.keys()], [CACHE_NAME]);
    assert.equal(sw.self._claimCalled, true);
  });
});

// ============================================================================
// fetch: only intercepts same-origin GETs
// ============================================================================
describe("Service worker fetch: scope — only same-origin GETs are intercepted", () => {
  it("a non-GET request (POST) is left alone — respondWith is never called", async () => {
    const sw = loadSW(async () => mockResponse(true));
    const { handled } = await fireFetch(sw, {
      method: "POST",
      url: WORKER_ORIGIN + "/api/whatever",
    });
    assert.equal(handled, false);
  });

  it("a cross-origin GET (e.g. Google Fonts) is left alone — this SW never intercepts other origins", async () => {
    const sw = loadSW(async () => mockResponse(true));
    const { handled } = await fireFetch(sw, {
      method: "GET",
      url: "https://fonts.googleapis.com/css?family=Inter",
    });
    assert.equal(handled, false);
  });
});

// ============================================================================
// fetch: the network-race-with-cache-fallback strategy that makes offline mode work
// ============================================================================
describe("Service worker fetch: cache-fallback and offline behavior", () => {
  it("nothing cached yet + network succeeds: serves the network response and caches it for next time", async () => {
    const sw = loadSW(async () => mockResponse(true, "fresh"));
    const req = { method: "GET", url: WORKER_ORIGIN + "/js/app.js" };
    const { response } = await fireFetch(sw, req);
    assert.equal(response.tag, "fresh");
    const cache = sw.cachesStore.get(CACHE_NAME);
    assert.equal(cache.get(sw.resolveKey(req)).tag, "fresh");
  });

  it("nothing cached yet + network fails entirely (fully offline, first-ever visit to a route): falls back to the precached app shell (index.html)", async () => {
    const sw = loadSW(async (r) => {
      if (r.url.endsWith("/index.html")) return mockResponse(true, "shell");
      throw new Error("offline");
    });
    const shellCache = new Map();
    shellCache.set(sw.resolveKey("./index.html"), mockResponse(true, "shell"));
    sw.cachesStore.set(CACHE_NAME, shellCache);
    const req = { method: "GET", url: WORKER_ORIGIN + "/some/uncached/route" };
    const { response } = await fireFetch(sw, req);
    assert.equal(response.tag, "shell");
  });

  it("a fast network response (well under NET_TIMEOUT_MS) is served fresh, not a stale cached copy", async () => {
    const sw = loadSW(async () => mockResponse(true, "fresh"));
    const req = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const cache = new Map();
    cache.set(sw.resolveKey(req), mockResponse(true, "stale"));
    sw.cachesStore.set(CACHE_NAME, cache);
    const { response } = await fireFetch(sw, req);
    assert.equal(response.tag, "fresh");
  });

  it("a slow network (past NET_TIMEOUT_MS) falls back to the cached copy immediately instead of hanging on a bad connection", async () => {
    const sw = loadSW(
      () => new Promise((resolve) => setTimeout(() => resolve(mockResponse(true, "too-late")), 3000)),
    );
    const req = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const cache = new Map();
    cache.set(sw.resolveKey(req), mockResponse(true, "stale"));
    sw.cachesStore.set(CACHE_NAME, cache);
    const started = Date.now();
    const { response } = await fireFetch(sw, req);
    assert.equal(response.tag, "stale");
    // Must resolve around NET_TIMEOUT_MS (1500ms), not wait out the full 3000ms network delay.
    assert.ok(Date.now() - started < 2500, "did not fall back to cache before the slow network resolved");
  });

  it("once a request has decided 'cache wins' (slow network), a request right after returns the cache immediately without re-racing the network", async () => {
    let calls = 0;
    const sw = loadSW(() => {
      calls++;
      return new Promise((resolve) => setTimeout(() => resolve(mockResponse(true, "slow-" + calls)), 3000));
    });
    const req1 = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const cache = new Map();
    cache.set(sw.resolveKey(req1), mockResponse(true, "stale"));
    sw.cachesStore.set(CACHE_NAME, cache);
    await fireFetch(sw, req1); // establishes the 'cache' decision (real ~1.5s wait, same as the test above)

    const req2 = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const started = Date.now();
    const { response } = await fireFetch(sw, req2);
    assert.equal(response.tag, "stale");
    assert.ok(Date.now() - started < 200, "a decided-'cache' request should return immediately, not race the network again");
  });

  it("once a request has decided 'network wins' (fast network), a later request whose own network call fails falls back to whatever's currently cached instead of hanging or crashing", async () => {
    let call = 0;
    const sw = loadSW(async () => {
      call++;
      if (call === 1) return mockResponse(true, "fast-first"); // wins the race, records 'network'
      throw new Error("second network call fails"); // must fall back to cache, not hang/crash
    });
    const req = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const cache = new Map();
    cache.set(sw.resolveKey(req), mockResponse(true, "stale"));
    sw.cachesStore.set(CACHE_NAME, cache);

    const first = await fireFetch(sw, req);
    assert.equal(first.response.tag, "fast-first");
    // A successful network answer also refreshes the cache entry (sw.js's own `cache.put`) — real,
    // intended behavior, so the next fallback below isn't serving stale content either.
    assert.equal(cache.get(sw.resolveKey(req)).tag, "fast-first");

    const second = await fireFetch(sw, req);
    // decision is 'network': call #2's OWN network attempt fails, so it must fall back to
    // whatever's cached right now (the copy call #1 just refreshed) rather than hang or throw.
    assert.equal(second.response.tag, "fast-first");
  });

  it("a non-ok network response (e.g. a 404) is never written into the cache, so a bad response can't poison what's served offline later", async () => {
    const sw = loadSW(async () => mockResponse(false, "404-body"));
    const req = { method: "GET", url: WORKER_ORIGIN + "/js/app.js" };
    await fireFetch(sw, req);
    const cache = sw.cachesStore.get(CACHE_NAME);
    assert.equal(cache.has(sw.resolveKey(req)), false);
  });
});

// ============================================================================
// Installability: manifest.json + index.html's PWA meta/link tags
// ============================================================================
describe("Installability: manifest.json and index.html's PWA meta/link tags", () => {
  it("manifest.json declares valid installability metadata: name, start_url, display:standalone, 192x192 + 512x512 icons, and every icon file actually exists on disk", () => {
    const manifest = JSON.parse(read("manifest.json"));
    assert.equal(typeof manifest.name, "string");
    assert.ok(manifest.name.length > 0);
    assert.equal(typeof manifest.start_url, "string");
    assert.equal(manifest.display, "standalone");
    const sizes = manifest.icons.map((i) => i.sizes);
    assert.ok(sizes.includes("192x192"), "no 192x192 icon (Android's install minimum)");
    assert.ok(sizes.includes("512x512"), "no 512x512 icon (Android's install minimum)");
    const missing = manifest.icons
      .map((i) => i.src)
      .filter((src) => !fs.existsSync(path.join(ROOT, src)));
    assert.deepEqual(missing, []);
  });

  it("index.html declares the tags needed for standalone install on both Android (manifest+theme-color) and iOS (apple-touch-icon+apple-mobile-web-app-capable, since iOS ignores manifest.json)", () => {
    const html = read("index.html");
    assert.match(html, /<link rel="manifest" href="manifest\.json">/);
    assert.match(html, /<meta name="theme-color" content="#[0-9a-fA-F]{3,6}">/);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(html, /<link rel="apple-touch-icon" href="[^"]+">/);
    const iconHref = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/)[1];
    assert.ok(fs.existsSync(path.join(ROOT, iconHref)), `apple-touch-icon file missing: ${iconHref}`);
  });
});
