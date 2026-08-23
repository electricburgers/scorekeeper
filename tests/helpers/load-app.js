// Loads the REAL app — the actual index.html, executing its own <script src> tags exactly as a
// browser would (same file, same order, same shared global scope) — into a jsdom window, so
// tests exercise the shipped code directly rather than a re-implemented copy that could drift
// from it (exactly the kind of drift this whole test setup exists to catch — see
// js/shared-ui.js's own top comment for the bug history behind that).
//
// A fake http://scorekeeper.test/ base URL + resources:"usable" is what makes jsdom fetch and
// run the real <script src> files off disk itself, in real <script>-tag semantics — this
// matters specifically because a top-level `const`/`let` in one classic script is visible to a
// later one via the shared global LEXICAL scope the same way it is in a real multi-<script>
// page, which a plain window.eval() per file does not reliably replicate (each eval call got
// its own top-level scope instead, and js/app.js's reference to js/shared-ui.js's
// SHARED_FONT_SIZES broke). Running the actual <script> elements sidesteps that outright by not
// trying to reproduce the semantics by hand.
//
// http:, not file: — a file:// origin is "opaque" in both real browsers and jsdom, which makes
// window.localStorage undefined outright (this app's own real, deliberate handling of exactly
// that case — see the "Cross-session storage is unavailable" console warning it prints — but
// not what the *theme migration* tests need: they simulate a real returning visitor's already-
// stored prefs, which requires a working Storage to simulate at all). LocalFileResourceLoader
// below serves the app's own real files for that fake http: origin without an actual server.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..");
const ORIGIN = "http://scorekeeper.test";

class LocalFileResourceLoader extends ResourceLoader {
  // Google Fonts (faq/css/fonts.css's @import) has no network access in a test run and isn't
  // needed for anything under test — resolving it to an empty response keeps jsdom from
  // logging a real fetch failure for every test run.
  fetch(url, options) {
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
      return Promise.resolve(Buffer.from(""));
    }
    if (url.startsWith(ORIGIN)) {
      const rel = decodeURIComponent(url.slice(ORIGIN.length + 1)).split("?")[0];
      return fs.promises.readFile(path.join(ROOT, rel));
    }
    return super.fetch(url, options);
  }
}

/** Stubs the audio stack and couple of Web APIs jsdom's own window doesn't implement — every
 * real call site for Audio/AudioContext is inside a function triggered by a user action
 * (starting a drumroll), never at load/parse time, so the stub only has to exist, not actually
 * do anything. Run via JSDOM's beforeParse hook (not after construction) so it's guaranteed to
 * be in place before any <script> — including the vendor libraries, which need TextEncoder at
 * parse time — actually runs; a post-construction call raced the async script-fetch queue and
 * missed it intermittently. */
function beforeParse(window) {
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.Audio = class {
    constructor() {}
    play() {
      return Promise.resolve();
    }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
  };
  window.AudioContext = window.webkitAudioContext = class {
    decodeAudioData(_buf, ok) {
      if (ok) ok({});
      return Promise.resolve({});
    }
  };
  window.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
  // Used to keep --layout-top/--header-h in sync with real element sizes as they change —
  // nothing under test resizes anything, so a no-op observer (never fires a callback) is
  // enough for the app's own setup code to run without throwing.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** Waits for the window's own load event (jsdom fires this once every <script src> — run
 * synchronously in document order, same as a real page — has executed) before resolving.
 * Rejects on a real uncaught error inside one of those scripts, so a genuinely broken page
 * fails the test loudly instead of tests quietly asserting against a half-loaded window. */
function whenLoaded(window) {
  return new Promise((resolve, reject) => {
    let settled = false;
    window.addEventListener("error", (e) => {
      if (settled) return;
      settled = true;
      reject(e.error || new Error(String(e.message || e)));
    });
    if (window.document.readyState === "complete") {
      settled = true;
      return resolve(window);
    }
    window.addEventListener("load", () => {
      if (settled) return;
      settled = true;
      resolve(window);
    });
    // 20s, not 5s: when the full test suite runs multiple files in parallel (node --test's
    // default), several jsdom windows are all parsing/executing app.js (~2.5MB, mostly base64
    // audio) at once, and CPU contention alone can push a real 'load' past 5s even though the
    // page is perfectly healthy — a smoke test that resolves early using a stale, not-yet-loaded
    // window then fails with confusing "APP_VERSION is undefined"-style errors instead of a
    // clear timeout. If this genuinely fires, resolving with the still-loading window (rather
    // than rejecting) keeps a truly-hung page's failure readable in the assertion that follows.
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(window); // safety net — not expected to fire on a healthy page
    }, 20000);
  });
}

function open(htmlPath, url) {
  const dom = new JSDOM(fs.readFileSync(htmlPath, "utf8"), {
    url,
    runScripts: "dangerously",
    resources: new LocalFileResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on("jsdomError", () => {}), // CSS-parse noise only
    beforeParse,
  });
  return whenLoaded(dom.window);
}

function loadAppWindow() {
  return open(path.join(ROOT, "index.html"), ORIGIN + "/index.html");
}
// urlSuffix lets a test load the FAQ with a real query string/hash already on the URL (e.g.
// "?q=wager" or "#q-some-id") — needed to exercise faqApplyQueryParam()/faqOpenLinkedItem()'s
// real load-time behavior, since jsdom's window.location.search is not reassignable after the
// fact (see the "FAQ search" describe block in tests/js-behavior.test.js for why).
function loadFaqWindow(urlSuffix) {
  return open(
    path.join(ROOT, "faq", "index.html"),
    ORIGIN + "/faq/index.html" + (urlSuffix || ""),
  );
}

// Real classic <script> semantics (verified against both jsdom and an actual browser): a
// top-level `function` declaration becomes a `window` property, so `window.someFunction(...)`
// works directly — but a top-level `const`/`let` (APP_VERSION, gameState, FONT_SIZES, and most
// of this codebase's other state) creates a binding in the shared global LEXICAL scope instead,
// which is visible to every other <script> tag on the page but is NOT a `window` property. The
// only way to read or set one of those from outside the page's own scripts, same as from a real
// browser's devtools console, is evaluating an expression back in that same window.
function evalIn(window, expr) {
  return window.eval(expr);
}

module.exports = { loadAppWindow, loadFaqWindow, evalIn, ROOT };
