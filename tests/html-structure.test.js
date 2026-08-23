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
test("index.html: every onclick=\"fnName(...)\" call references a function defined in js/shared-ui.js, js/app.js, or js/tutorial.js", () => {
  const doc = loadDoc("index.html");
  const declared = collectDeclaredFunctionNames(
    "js/shared-ui.js",
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
