// Service worker precache integrity — sw.js's own top comment documents that a missing/stale
// SHELL_FILES entry "bit three separate times" (v18.51 and v18.57's changelog entries) before
// being fixed; nothing has verified SHELL_FILES against the real filesystem or against what
// index.html/faq/index.html actually load until now. Static analysis only — sw.js itself doesn't
// run in jsdom (no ServiceWorkerGlobalScope), so this checks the same things a browser's install
// step would fail on, without needing to actually run one.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SW_SRC = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function shellFiles() {
  const m = SW_SRC.match(/const SHELL_FILES\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(m, "SHELL_FILES array not found in sw.js");
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test("sw.js declares a CACHE_NAME matching the trivia-scorekeeper-shell-vN convention", () => {
  const m = SW_SRC.match(/const CACHE_NAME\s*=\s*'([^']+)'/);
  assert.ok(m, "CACHE_NAME not found");
  assert.match(m[1], /^trivia-scorekeeper-shell-v\d+$/);
});

test("SHELL_FILES has no duplicate entries", () => {
  const files = shellFiles();
  const seen = new Set();
  const dupes = files.filter((f) => (seen.has(f) ? true : (seen.add(f), false)));
  assert.deepEqual(dupes, []);
});

test("every SHELL_FILES entry resolves to a real file on disk (except './', the app shell root)", () => {
  const files = shellFiles().filter((f) => f !== "./");
  const missing = files.filter(
    (f) => !fs.existsSync(path.join(ROOT, f.replace(/^\.\//, ""))),
  );
  assert.deepEqual(missing, [], `missing on disk: ${missing.join(", ")}`);
});

// This is the exact class of mistake sw.js's own comment describes biting three times before —
// a real file that loads fine online but was never added to SHELL_FILES, so it silently isn't
// available offline until someone notices by hand. Cross-referencing what the two HTML pages
// actually <script src>/<link href> against SHELL_FILES catches it automatically instead.
function localAssetRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g))
    refs.push(m[1]);
  // Google Fonts' own stylesheet link isn't a local file and can't be precached — the css itself
  // (faq/css/fonts.css) already documents this; skip anything not a same-tree relative path.
  return refs.filter((r) => !/^https?:\/\//.test(r));
}

test("every local <script src>/<link stylesheet> in index.html is listed in sw.js's SHELL_FILES", () => {
  const files = new Set(shellFiles().map((f) => f.replace(/^\.\//, "")));
  const refs = localAssetRefs(read("index.html"));
  assert.ok(refs.length > 5, "expected to find several local script/link refs in index.html");
  const missing = refs.filter((r) => !files.has(r));
  assert.deepEqual(missing, []);
});

test("every local <script src>/<link stylesheet> in faq/index.html is listed in sw.js's SHELL_FILES", () => {
  const files = new Set(shellFiles().map((f) => f.replace(/^\.\//, "")));
  const refs = localAssetRefs(read("faq/index.html")).map((r) =>
    // faq/index.html's own refs are written relative to faq/ itself (e.g. "../js/shared-ui.js",
    // "css/faq.css") — normalize to the same root-relative form SHELL_FILES uses.
    r.startsWith("../") ? r.slice(3) : "faq/" + r,
  );
  assert.ok(refs.length > 3, "expected to find several local script/link refs in faq/index.html");
  const missing = refs.filter((r) => !files.has(r));
  assert.deepEqual(missing, []);
});

// This session's audio extraction specifically — the four real clip files and the relocated
// fade-source script must all be precached, or the drumroll silently stops working offline.
test("the drumroll's audio files (this session's extraction) are all in SHELL_FILES", () => {
  const files = new Set(shellFiles().map((f) => f.replace(/^\.\//, "")));
  for (const f of [
    "js/data/drum-clips.js",
    "assets/audio/silent.wav",
    "assets/audio/roll.mp3",
    "assets/audio/finale.wav",
    "assets/audio/horn.mp3",
  ]) {
    assert.ok(files.has(f), `${f} missing from SHELL_FILES`);
  }
});

// The DRUM_CLIPS paths app.js actually uses at runtime must be the SAME paths SHELL_FILES
// precaches — a typo in either place would precache the wrong thing (or the right thing at the
// wrong path) and the drumroll would 404 offline despite this test suite's other checks passing.
test("js/app.js's DRUM_CLIPS paths exactly match the audio files SHELL_FILES precaches", () => {
  const appSrc = read("js/app.js");
  const m = appSrc.match(/const DRUM_CLIPS = \{([\s\S]*?)\};/);
  assert.ok(m, "DRUM_CLIPS not found in js/app.js");
  const paths = [...m[1].matchAll(/:\s*"([^"]+)"/g)].map((x) => x[1]);
  assert.equal(paths.length, 4);
  const files = new Set(shellFiles().map((f) => f.replace(/^\.\//, "")));
  for (const p of paths) assert.ok(files.has(p), `${p} not in SHELL_FILES`);
});
