// HTML structural integrity — parsed via jsdom (no script execution needed for these checks,
// so a plain, fast DOMParser-style load rather than the full app harness in load-app.js). Catches
// the class of bug this session ran into by hand more than once: a broken internal link, a
// missing asset file, a duplicate id, a stale reference left behind after a rename.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PAGES = [
  { name: "index.html", rel: "index.html", dir: "" },
  { name: "faq/index.html", rel: "faq/index.html", dir: "faq" },
];

function loadDoc(rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  return new JSDOM(html).window.document;
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ---- Balanced tags (a cheap, direct check independent of jsdom's own error-recovering parser,
// which would silently "fix" a real mismatch rather than fail loudly the way a test should) ----
for (const p of PAGES) {
  for (const tag of ["div", "section", "details", "button", "svg", "span"]) {
    test(`${p.name} has matching <${tag}>/</${tag}> counts`, () => {
      const src = read(p.rel);
      // \s* tolerates a newline between the tag name and its final >, both on open and close —
      // the FAQ page's own established formatting style splits many inline tags across lines
      // exactly that way (`<span\n  class="x"\n  >text</span\n>`) specifically to avoid
      // whitespace rendering between adjacent inline elements, not a typo to flag.
      const opens = (src.match(new RegExp(`<${tag}(\\s|>)`, "g")) || []).length;
      const closes = (src.match(new RegExp(`</${tag}\\s*>`, "g")) || []).length;
      assert.equal(opens, closes, `${opens} <${tag}> vs ${closes} </${tag}>`);
    });
  }
}

// ---- No duplicate ids (an id collision means only the FIRST element is ever reachable via
// getElementById/#fragment — the second is silently dead) ----
for (const p of PAGES) {
  test(`${p.name} has no duplicate id attribute`, () => {
    const doc = loadDoc(p.rel);
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    const seen = new Set();
    const dupes = new Set();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    assert.deepEqual([...dupes], []);
  });
}

// ---- Every internal href="#x" link resolves to a real id somewhere on the page ----
for (const p of PAGES) {
  test(`${p.name}: every internal href="#..." link resolves to a real element id`, () => {
    const doc = loadDoc(p.rel);
    const broken = [];
    doc.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute("href").slice(1);
      if (!id) return; // bare href="#" (none currently, but not a broken-link shape)
      if (!doc.getElementById(id)) broken.push(a.getAttribute("href"));
    });
    assert.deepEqual(broken, []);
  });
}

// ---- Every <script src>, <link rel=stylesheet href>, and non-data: <img src> points at a real
// file on disk ----
for (const p of PAGES) {
  test(`${p.name}: every local <script src> file exists on disk`, () => {
    const doc = loadDoc(p.rel);
    const missing = [];
    doc.querySelectorAll("script[src]").forEach((s) => {
      const src = s.getAttribute("src");
      if (/^https?:\/\//.test(src)) return;
      const resolved = path.join(ROOT, p.dir, src);
      if (!fs.existsSync(resolved)) missing.push(src);
    });
    assert.deepEqual(missing, []);
  });
  test(`${p.name}: every local <link rel="stylesheet"> file exists on disk`, () => {
    const doc = loadDoc(p.rel);
    const missing = [];
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
      const href = l.getAttribute("href");
      if (/^https?:\/\//.test(href)) return;
      const resolved = path.join(ROOT, p.dir, href);
      if (!fs.existsSync(resolved)) missing.push(href);
    });
    assert.deepEqual(missing, []);
  });
  test(`${p.name}: every non-empty, non-data: <img src> file exists on disk`, () => {
    const doc = loadDoc(p.rel);
    const missing = [];
    doc.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const resolved = path.join(ROOT, p.dir, src);
      if (!fs.existsSync(resolved)) missing.push(src);
    });
    assert.deepEqual(missing, []);
  });
}

// ---- Every icon referenced by manifest.json exists ----
test("manifest.json's icons all exist on disk", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const missing = manifest.icons
    .map((i) => i.src)
    .filter((src) => !fs.existsSync(path.join(ROOT, src)));
  assert.deepEqual(missing, []);
});
test("manifest.json declares at least one maskable and one any-purpose icon", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const purposes = manifest.icons.flatMap((i) => (i.purpose || "").split(" "));
  assert.ok(purposes.includes("maskable"));
  assert.ok(purposes.includes("any"));
});

// ---- Required <meta>/<title> tags present on both pages ----
for (const p of PAGES) {
  test(`${p.name} has a <title>`, () => {
    assert.ok(loadDoc(p.rel).querySelector("title")?.textContent.trim());
  });
  test(`${p.name} has a charset meta tag`, () => {
    assert.ok(loadDoc(p.rel).querySelector("meta[charset]"));
  });
  test(`${p.name} has a viewport meta tag`, () => {
    assert.ok(loadDoc(p.rel).querySelector('meta[name="viewport"]'));
  });
  test(`${p.name} has a meta description (this session's addition)`, () => {
    const content = loadDoc(p.rel)
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");
    assert.ok(content && content.length > 10);
  });
  test(`${p.name} has an og:title and og:description (this session's addition)`, () => {
    const doc = loadDoc(p.rel);
    assert.ok(doc.querySelector('meta[property="og:title"]')?.getAttribute("content"));
    assert.ok(
      doc.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    );
  });
}

// ---- Sample of critical, hand-picked elements each page depends on existing (a renamed id
// with no matching update elsewhere is exactly the kind of drift a smoke-level check like this
// is cheap insurance against) ----
const APP_CRITICAL_IDS = [
  "settingsPanel",
  "settingsToggleBtn",
  "auditOverlay",
  "auditModal",
  "confirmOverlay", // this session's confirm/alert modal
  "confirmModal",
  "confirmMessage",
  "confirmOkBtn",
  "confirmCancelBtn",
  "cbSelect",
  "fileLoadInput",
  "prefsLoadInput",
];
for (const id of APP_CRITICAL_IDS) {
  test(`index.html has #${id}`, () => {
    assert.ok(loadDoc("index.html").getElementById(id), `#${id} missing`);
  });
}

const FAQ_CRITICAL_IDS = [
  "faqSettingsPanel",
  "faqSettingsToggleBtn",
  "faqCvSelect",
  "faqSearch",
  "faqSearchClear", // this session's addition
  "faqNoResults",
  "faqLightbox",
  "faqLightboxImg",
];
for (const id of FAQ_CRITICAL_IDS) {
  test(`faq/index.html has #${id}`, () => {
    assert.ok(loadDoc("faq/index.html").getElementById(id), `#${id} missing`);
  });
}

// ---- FAQ-specific structural invariants ----
test("faq/index.html: every .faq-item has a unique id (this session's deep-link addition)", () => {
  const doc = loadDoc("faq/index.html");
  const items = [...doc.querySelectorAll(".faq-item")];
  assert.ok(items.length > 0);
  const missingId = items.filter((el) => !el.id);
  assert.deepEqual(missingId.length, 0, `${missingId.length} .faq-item(s) with no id`);
  const ids = items.map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate .faq-item ids found");
});

test("faq/index.html: every screenshot <img> has loading=\"lazy\" (this session's addition)", () => {
  const doc = loadDoc("faq/index.html");
  const shots = [...doc.querySelectorAll(".faq-shot img[src]")];
  assert.ok(shots.length > 10, "expected a substantial number of screenshots");
  const notLazy = shots.filter((img) => img.getAttribute("loading") !== "lazy");
  assert.deepEqual(
    notLazy.map((img) => img.getAttribute("src")),
    [],
  );
});

test("faq/index.html: the lightbox placeholder <img> is exempt from the lazy-loading check (empty src, filled by JS)", () => {
  const doc = loadDoc("faq/index.html");
  const el = doc.getElementById("faqLightboxImg");
  assert.equal(el.getAttribute("src"), "");
});

test("faq/index.html: every TOC link's target section exists", () => {
  const doc = loadDoc("faq/index.html");
  const tocLinks = [...doc.querySelectorAll(".faq-toc a[href^='#']")];
  assert.ok(tocLinks.length >= 15, "expected at least 15 TOC entries");
  const broken = tocLinks
    .map((a) => a.getAttribute("href").slice(1))
    .filter((id) => !doc.getElementById(id));
  assert.deepEqual(broken, []);
});

test("faq/index.html: every .faq-section referenced by the TOC has a matching TOC entry (no orphaned section)", () => {
  const doc = loadDoc("faq/index.html");
  const tocTargets = new Set(
    [...doc.querySelectorAll(".faq-toc a[href^='#']")].map((a) =>
      a.getAttribute("href").slice(1),
    ),
  );
  const sections = [...doc.querySelectorAll(".faq-section[id]")].map(
    (s) => s.id,
  );
  const orphaned = sections.filter((id) => !tocTargets.has(id));
  assert.deepEqual(orphaned, []);
});

test('faq/index.html: the "Team Report" section exists as its own top-level section (this session\'s reorganization)', () => {
  const doc = loadDoc("faq/index.html");
  const section = doc.getElementById("team-report");
  assert.ok(section, "#team-report section missing");
  assert.equal(section.tagName, "SECTION");
  assert.ok(section.classList.contains("faq-section"));
});

test('faq/index.html: the "Installing as an App" section exists (this session\'s addition)', () => {
  const doc = loadDoc("faq/index.html");
  assert.ok(doc.getElementById("install-app"));
});

test("faq/index.html has no leftover \"Score Audit\" text (renamed to \"Team Report\")", () => {
  const doc = loadDoc("faq/index.html");
  assert.doesNotMatch(doc.body.textContent, /Score Audit/);
});

test("faq/index.html has no leftover graduation-cap/ℹ️ Take the Tour icon markup (replaced by the waving-hand icon)", () => {
  const src = read("faq/index.html");
  assert.doesNotMatch(src, /icon-cap/);
});

// ---- SVG icon sprite (this session's refactor) — every <use> resolves to a real <symbol> ----
test("faq/index.html: every <use href=\"#x\"> resolves to a real <symbol id=\"x\"> in the sprite", () => {
  const doc = loadDoc("faq/index.html");
  const symbolIds = new Set(
    [...doc.querySelectorAll("symbol[id]")].map((s) => s.id),
  );
  assert.ok(symbolIds.size > 10, "expected a real icon sprite with multiple symbols");
  const broken = [];
  doc.querySelectorAll("use").forEach((u) => {
    const href = u.getAttribute("href") || u.getAttribute("xlink:href");
    const id = (href || "").replace("#", "");
    if (!symbolIds.has(id)) broken.push(href);
  });
  assert.deepEqual(broken, []);
});

test("faq/index.html: the icon sprite has no orphaned <symbol> that nothing <use>s (dead weight)", () => {
  const doc = loadDoc("faq/index.html");
  const used = new Set(
    [...doc.querySelectorAll("use")].map((u) =>
      (u.getAttribute("href") || u.getAttribute("xlink:href") || "").replace(
        "#",
        "",
      ),
    ),
  );
  const orphaned = [...doc.querySelectorAll("symbol[id]")]
    .map((s) => s.id)
    .filter((id) => !used.has(id));
  assert.deepEqual(orphaned, []);
});

// ---- App-side structural invariants ----
test("index.html: the confirm/alert modal's OK button has an onclick handler wired to confirmDialogRespond(true)", () => {
  const doc = loadDoc("index.html");
  const btn = doc.getElementById("confirmOkBtn");
  assert.match(btn.getAttribute("onclick") || "", /confirmDialogRespond\(true\)/);
});
test("index.html: the confirm/alert modal's Cancel button has an onclick handler wired to confirmDialogRespond(false)", () => {
  const doc = loadDoc("index.html");
  const btn = doc.getElementById("confirmCancelBtn");
  assert.match(btn.getAttribute("onclick") || "", /confirmDialogRespond\(false\)/);
});
test("js/app.js: Clear Session's button calls confirmClearSession(), not window.confirm() directly (the button's markup is a JS template string, not static index.html)", () => {
  const src = read("js/app.js");
  assert.match(src, /confirmClearSession\(\)/);
  assert.doesNotMatch(src, /onclick="if\(confirm\(/);
});

// This session's js/app.js module split created js/team-audit.js — and shipped it with a real
// bug: the file existed, was correct, was listed in eslint's glob and sw.js's SHELL_FILES and
// the onclick-function-existence test's file list below, but its own <script src> tag was never
// actually added to index.html. Every static/string-matching check that only reads *.js files
// off disk passed anyway (openAudit/closeAudit/buildAudit genuinely exist in that file), so
// nothing caught it until a real click on a team name threw "openAudit is not defined" in an
// actual browser. This test is the fix: every non-vendor, non-data top-level file in js/ — the
// exact directory this exact mistake can happen in — must have a matching <script src> in
// index.html, checked by actually listing the directory, not by hand-maintaining a second list
// that can drift from it the same way the missing tag itself did.
// js/tutorial.js is the one deliberate exception (v19.54): it's lazy-loaded on first "Take the
// Tour" click (loadTutorialLib(), js/app.js) via a real dynamically-inserted <script> element,
// the same loadScriptOnce() pattern the export libs already used as of v19.51 — never as a
// blocking <script src> tag in index.html. It's still required to exist on disk (checked
// elsewhere: sw.js's SHELL_FILES-on-disk test, and the onclick-function-existence test below,
// both still cover it) and is still listed in sw.js's SHELL_FILES for offline coverage — just
// exempted from THIS specific "must have a blocking <script> tag" check.
const LAZY_LOADED_JS_FILES = new Set(["js/tutorial.js"]);
test("every top-level js/*.js file (excluding js/vendor/**, js/data/**, and lazy-loaded files) has a <script src> tag in index.html", () => {
  const jsFiles = fs
    .readdirSync(path.join(ROOT, "js"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/" + f)
    .filter((f) => !LAZY_LOADED_JS_FILES.has(f));
  assert.ok(jsFiles.length > 5, "expected to find several top-level js/*.js files");
  const doc = loadDoc("index.html");
  const scripts = new Set(
    [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
  );
  const missing = jsFiles.filter((f) => !scripts.has(f));
  assert.deepEqual(missing, []);
});

test("index.html loads js/shared-ui.js before js/app.js (app.js references SHARED_FONT_SIZES at parse time)", () => {
  const doc = loadDoc("index.html");
  const scripts = [...doc.querySelectorAll("script[src]")].map((s) =>
    s.getAttribute("src"),
  );
  const sharedIdx = scripts.indexOf("js/shared-ui.js");
  const appIdx = scripts.indexOf("js/app.js");
  assert.ok(sharedIdx !== -1 && appIdx !== -1);
  assert.ok(sharedIdx < appIdx);
});

test("faq/index.html loads js/shared-ui.js before faq-bootstrap.js and faq.js", () => {
  const doc = loadDoc("faq/index.html");
  const scripts = [...doc.querySelectorAll("script[src]")].map((s) =>
    s.getAttribute("src"),
  );
  const sharedIdx = scripts.indexOf("../js/shared-ui.js");
  const bootstrapIdx = scripts.indexOf("js/faq-bootstrap.js");
  const faqIdx = scripts.indexOf("js/faq.js");
  assert.ok(sharedIdx !== -1 && bootstrapIdx !== -1 && faqIdx !== -1);
  assert.ok(sharedIdx < bootstrapIdx && bootstrapIdx < faqIdx);
});

// ---- No leftover debug/marker text ----
for (const p of PAGES) {
  test(`${p.name} has no leftover TODO/FIXME/XXX markers`, () => {
    const src = read(p.rel);
    assert.doesNotMatch(src, /\b(TODO|FIXME|XXX)\b/);
  });
  test(`${p.name} has no leftover console.log-driving debugger statement`, () => {
    assert.doesNotMatch(read(p.rel), /<script[^>]*>[\s\S]*?\bdebugger\b[\s\S]*?<\/script>/);
  });
}

// ---- Every <button onclick> / <a onclick> references a function that actually exists in one
// of the page's own <script src> files (a renamed function with a stale onclick="" would only
// ever surface as a silent no-op click in the real app — this catches it statically instead) ----
function collectDeclaredFunctionNames(...jsFiles) {
  const names = new Set();
  for (const f of jsFiles) {
    const src = read(f);
    for (const m of src.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)) {
      names.add(m[1]);
    }
  }
  return names;
}
test("index.html: every onclick=\"fnName(...)\" call references a function defined in one of the app's own <script> files", () => {
  const doc = loadDoc("index.html");
  const declared = collectDeclaredFunctionNames(
    "js/shared-ui.js",
    // The nine files js/app.js was split into (this session's refactor) — same shared global
    // scope as one file, just organized; onclick="" handlers can call into any of them.
    "js/storage.js",
    "js/icons.js",
    "js/content.js",
    "js/scoring.js",
    "js/dom-utils.js",
    "js/confirm-dialog.js",
    "js/team-audit.js",
    "js/question-timer.js",
    "js/craft-prize.js",
    "js/export.js",
    "js/app.js",
    "js/tutorial.js",
  );
  const missing = [];
  doc.querySelectorAll("[onclick]").forEach((el) => {
    const code = el.getAttribute("onclick");
    for (const m of code.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
      const name = m[1].split(".")[0];
      // JS keywords the regex can't tell apart from a function call by shape alone, plus
      // built-ins/DOM methods/other in-scope objects legitimately called inline — none of
      // these are app functions expected to be declared in the app's own <script> files.
      if (
        [
          "if",
          "for",
          "while",
          "switch",
          "catch",
          "function",
          "return",
          "typeof",
          "new",
          "event",
          "document",
          "this",
          "window",
          "confirm",
          "Tutorial",
        ].includes(name)
      )
        continue;
      if (!declared.has(name)) missing.push(name);
    }
  });
  assert.deepEqual([...new Set(missing)], []);
});

// ---- version.json (repo root) drives the "a newer version is available" check (checkForUpdate,
// js/app.js) — it has to be bumped in the same commit as APP_VERSION or that check starts
// lying: stale, it can never detect a real new release; ahead of what's actually deployed, it
// nags a host running the exact build that just shipped it. This is the test js/app.js's own
// top-of-file comment on APP_VERSION says exists. ----
test("version.json's version matches js/app.js's APP_VERSION exactly", () => {
  const appSrc = read("js/app.js");
  const appMatch = appSrc.match(/const APP_VERSION = "([^"]+)"/);
  assert.ok(appMatch, "APP_VERSION not found in js/app.js");
  const versionJson = JSON.parse(read("version.json"));
  assert.equal(versionJson.version, appMatch[1]);
});

// ============================================================================
// Five new tests (per this session's "think about and describe... implement all of these").
// ============================================================================

// ---- Every icon-only <button>/[role="button"] — one with no visible text, just an SVG/emoji
// glyph — has an accessible name (aria-label, aria-labelledby, or title). Static index.html/
// faq/index.html pass today (every icon-only control already carries one); this is a regression
// guard against a future one shipping without it, silent to a screen reader the same way a button
// wired to nothing is silent to a sighted user clicking it. ----
for (const p of PAGES) {
  test(`${p.name}: every icon-only <button>/[role="button"] (no visible text) has an accessible name`, () => {
    const doc = loadDoc(p.rel);
    const missing = [];
    doc.querySelectorAll('button, [role="button"]').forEach((el) => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (text) return; // has its own visible text — that IS its accessible name
      const hasLabel =
        el.hasAttribute("aria-label") ||
        el.hasAttribute("aria-labelledby") ||
        el.hasAttribute("title");
      if (!hasLabel) missing.push(el.outerHTML.slice(0, 120));
    });
    assert.deepEqual(missing, []);
  });
}

// ---- The same check for the small set of icon-only glyph buttons js/app.js emits directly as
// literal characters (not interpolated text) — the one shape a purely static-HTML sweep above
// can't see. Scoped narrowly to literal, non-interpolated button bodies specifically to avoid
// false positives on buttons whose visible text comes from a `${...}` expression this test can't
// evaluate (e.g. a Tutorial callout's own "${nextLabel}", or a wager amount's "${w}${badge}") —
// those already read as real words/numbers at runtime, unlike a bare "−"/"+"/"×" glyph, which
// needs a label the same way .settings-x-btn's drawn X icon does. Caught two real ones the first
// time this test was written: the Point Adjustment stepper's − and + buttons (js/app.js). ----
test("js/*.js: every icon-only <button> with a literal (non-interpolated) glyph body has an accessible name", () => {
  const jsDir = path.join(ROOT, "js");
  const jsFiles = fs
    .readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/" + f);
  const missing = [];
  for (const f of jsFiles) {
    const src = read(f);
    for (const m of src.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const attrs = m[1];
      const inner = m[2].replace(/<[^>]*>/g, "").trim();
      if (inner.includes("${")) continue; // can't statically evaluate — see comment above
      const decoded = inner.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      );
      if (decoded.length > 2) continue; // not a bare-glyph (or empty, icon-only-via-child) body
      if (/[a-zA-Z]/.test(decoded)) continue; // a real short word ("No"), not a symbol glyph
      const hasLabel = /aria-label=|title=|aria-labelledby=/.test(attrs);
      if (!hasLabel) {
        const lineNo = src.slice(0, m.index).split("\n").length;
        missing.push(`${f}:${lineNo} ${JSON.stringify(decoded)}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

// ---- Locks in the v19.33 PWA status-bar-shadow fix: index.html's status bar meta must not be
// "black-translucent" (which pulls content under the notch and gets an OS-drawn translucency
// scrim, the actual shadow this session's bug report was about — see CHANGELOG.md's v19.33 entry
// for the full diagnosis), and neither page's viewport meta may reintroduce viewport-fit=cover
// (what makes black-translucent's scrim apply in the first place). Not a page-to-page equality
// check — faq/index.html deliberately has no status-bar meta at all (it's never launched as its
// own standalone PWA window), which is exactly why the shadow never appeared there to begin
// with, not a drift to unify away. ----
test('index.html\'s apple-mobile-web-app-status-bar-style is not "black-translucent"', () => {
  const doc = loadDoc("index.html");
  const meta = doc.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  assert.ok(meta, "expected an apple-mobile-web-app-status-bar-style meta tag");
  assert.notEqual(meta.getAttribute("content"), "black-translucent");
});
for (const p of PAGES) {
  test(`${p.name}: viewport meta does not set viewport-fit=cover (re-enables the OS status-bar scrim)`, () => {
    const doc = loadDoc(p.rel);
    const viewport = doc.querySelector('meta[name="viewport"]');
    assert.ok(viewport, "expected a viewport meta tag");
    assert.doesNotMatch(viewport.getAttribute("content") || "", /viewport-fit=cover/);
  });
}

// ---- Guards the chevron-on-the-left CSS fix (this session): it works by giving .faq-q-arrow
// order:-1 inside its <summary>'s flex row rather than reordering the <span>s themselves (to avoid
// touching all 68 FAQ entries' markup) — which means the fix silently stops working, per entry,
// for any <summary> missing either span, or holding more than one of either. ----
test("faq/index.html: every .faq-item's <summary> has exactly one .faq-q-arrow and one .faq-q-text", () => {
  const doc = loadDoc("faq/index.html");
  const bad = [];
  doc.querySelectorAll(".faq-item > summary").forEach((summary) => {
    const arrows = summary.querySelectorAll(":scope > .faq-q-arrow").length;
    const texts = summary.querySelectorAll(":scope > .faq-q-text").length;
    if (arrows !== 1 || texts !== 1) {
      bad.push(
        `${summary.closest(".faq-item").id}: ${arrows} .faq-q-arrow, ${texts} .faq-q-text`,
      );
    }
  });
  assert.deepEqual(bad, []);
});

// ---- Every non-empty, non-data: <img> has real alt text — the existing checks above cover src
// resolving to a real file, but not whether it's actually described for a screen reader. The
// lightbox's own placeholder <img> is the one deliberate exception: it starts with alt="" and an
// empty src by design, filled in at click time from the clicked screenshot's own alt
// (openFaqLightbox, faq/js/faq.js) — same exemption already given to it by the lazy-loading check
// above, for the same reason. ----
test("faq/index.html: every <img> other than the lightbox placeholder has non-empty alt text", () => {
  const doc = loadDoc("faq/index.html");
  const missing = [];
  doc.querySelectorAll("img").forEach((img) => {
    if (img.id === "faqLightboxImg") return;
    const alt = img.getAttribute("alt");
    if (!alt || !alt.trim()) missing.push(img.getAttribute("src"));
  });
  assert.deepEqual(missing, []);
});

// ---- Generalizes the "every onclick=\"fnName(...)\" in index.html resolves to a real function"
// check above to the markup js/*.js itself builds and injects at render time (template strings in
// app.js/team-audit.js/craft-prize.js/tutorial.js/etc.) — the exact blind spot that let the
// missing js/team-audit.js <script> tag ship (openAudit/closeAudit/buildAudit were all correctly
// DEFINED, so the static-HTML-only version of this check had nothing to flag; the bug was only
// ever reachable through a real click on JS-emitted markup). Strips ${...} template interpolation
// before matching call sites — both because an interpolated argument (Math.max(...) computing a
// number, say) isn't part of the onclick attribute a browser ever sees, and because a handful of
// onclick strings interpolate the FUNCTION NAME itself (onclick="${cSet}(...)"), which this static
// sweep has no way to resolve and has to skip rather than guess. ----
test("every onclick=\"fnName(...)\" emitted by a top-level js/*.js template string references a function defined in one of the app's own <script> files", () => {
  const jsDir = path.join(ROOT, "js");
  const jsFiles = fs
    .readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/" + f);
  const declared = collectDeclaredFunctionNames(...jsFiles);
  const skip = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "function",
    "return",
    "typeof",
    "new",
    "event",
    "document",
    "this",
    "window",
    "confirm",
    "Tutorial",
    "Math",
  ]);
  const missing = [];
  for (const f of jsFiles) {
    const src = read(f);
    for (const m of src.matchAll(/onclick="([^"]*)"/g)) {
      const code = m[1].replace(/\$\{[^}]*\}/g, ""); // strip template interpolation entirely
      for (const c of code.matchAll(/(^|[^.\w])([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
        const name = c[2];
        if (skip.has(name)) continue;
        if (!declared.has(name)) missing.push(`${f}: ${name}`);
      }
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
