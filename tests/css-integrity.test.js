// CSS structural integrity — real parsing via postcss (already a transitive dependency of
// stylelint, so no extra package needed), not regex guessing. The two rules this suite is built
// around — no-syntax-errors and no-duplicate-properties-in-one-rule — each caught a real,
// shipped bug the first time stylelint ran against this codebase: an orphaned `}` in
// css/styles.css (a stray closing brace with no matching selector, left over from a since-
// removed two-column layout) and a fully duplicated display/align-items/justify-content triplet
// in .q-sort-btn,.q-reset-btn. Both are fixed; these tests are what stop them coming back.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const ROOT = path.join(__dirname, "..");
const CSS_FILES = [
  "css/styles.css",
  "css/tutorial.css",
  "faq/css/faq.css",
  "faq/css/fonts.css",
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function parse(rel) {
  return postcss.parse(read(rel), { from: path.join(ROOT, rel) });
}

// ---- Parses cleanly (would have caught the orphaned `}`) ----
for (const file of CSS_FILES) {
  test(`${file} parses as valid CSS with no syntax errors`, () => {
    assert.doesNotThrow(() => parse(file));
  });
}

// ---- No property declared twice with the IDENTICAL value in one rule (would have caught
// .q-sort-btn's triplet — display/align-items/justify-content, each repeated verbatim). Same
// property repeated with DIFFERENT values is excluded on purpose: css/styles.css uses that
// deliberately as a progressive-enhancement fallback (e.g. .app-layout's
// height:calc(100vh - ...) followed by height:calc(100dvh - ...) — older browsers that don't
// recognize dvh keep the vh value, newer ones take the later, more accurate one), not a mistake
// to flag the same way a byte-for-byte repeat is. ----
for (const file of CSS_FILES) {
  test(`${file} has no rule with a property declared twice with the same value`, () => {
    const root = parse(file);
    const offenders = [];
    root.walkRules((rule) => {
      const seenValues = new Map(); // prop -> Set of values already seen
      const dupesHere = new Set();
      rule.walkDecls((decl) => {
        const key = decl.prop.toLowerCase();
        const values = seenValues.get(key) || new Set();
        if (values.has(decl.value)) dupesHere.add(`${key}:${decl.value}`);
        values.add(decl.value);
        seenValues.set(key, values);
      });
      if (dupesHere.size) {
        offenders.push(
          `${rule.selector} (line ${rule.source.start.line}): ${[...dupesHere].join(", ")}`,
        );
      }
    });
    assert.deepEqual(offenders, []);
  });
}

// ---- Balanced braces (belt-and-suspenders on top of the parse check above) ----
for (const file of CSS_FILES) {
  test(`${file} has balanced { }`, () => {
    const src = read(file);
    const open = (src.match(/\{/g) || []).length;
    const close = (src.match(/\}/g) || []).length;
    assert.equal(open, close, `${open} '{' vs ${close} '}'`);
  });
}

// ---- No empty rule bodies (a selector with nothing inside is almost always leftover debris —
// exactly the shape the orphaned-brace bug would have left behind if it had matched a real
// selector instead of dangling with none) ----
for (const file of CSS_FILES) {
  test(`${file} has no rule with an empty body`, () => {
    const root = parse(file);
    const empties = [];
    root.walkRules((rule) => {
      if (rule.nodes.length === 0) {
        empties.push(`${rule.selector} (line ${rule.source.start.line})`);
      }
    });
    assert.deepEqual(empties, []);
  });
}

// ---- Every var(--x) reference has a matching --x definition somewhere in the same file or in
// css/styles.css (the shared design system every other file imports) ----
function collectDefinedCustomProps(...files) {
  const defined = new Set();
  for (const f of files) {
    parse(f).walkDecls((decl) => {
      if (decl.prop.startsWith("--")) defined.add(decl.prop);
    });
  }
  return defined;
}
function collectUsedCustomProps(file) {
  const used = new Set();
  const re = /var\(\s*(--[a-zA-Z0-9-]+)/g;
  let m;
  const src = read(file);
  while ((m = re.exec(src))) used.add(m[1]);
  return used;
}
{
  const definedInApp = collectDefinedCustomProps("css/styles.css");
  // Custom properties app.js keeps in sync with real rendered element sizes (--header-h,
  // --layout-top, --qtimer-h, --mobile-dock-h, --mini-progress-h — see the "Keeps --x in sync
  // with the real rendered height of..." comments above each one in js/app.js) are set via
  // element.style.setProperty(), never given a :root definition — CSS only ever reads them
  // through a var(--x, <fallback>) with its own literal fallback for the moment before JS has
  // run once, which is why these are expected to have no CSS-side definition at all.
  const jsComputedProps = new Set([
    "--header-h",
    "--layout-top",
    "--mobile-dock-h",
    "--qtimer-h",
    "--mini-progress-h",
  ]);
  test("every var(--x) in css/styles.css resolves to a --x defined in that same file (or is one of the small set app.js computes and sets directly)", () => {
    const used = collectUsedCustomProps("css/styles.css");
    const missing = [...used].filter(
      (p) => !definedInApp.has(p) && !jsComputedProps.has(p),
    );
    assert.deepEqual(missing, []);
  });
  test("every var(--x) in css/tutorial.css resolves to a --x defined in css/styles.css (the shared design system it reuses)", () => {
    const used = collectUsedCustomProps("css/tutorial.css");
    const missing = [...used].filter(
      (p) => !definedInApp.has(p) && !jsComputedProps.has(p),
    );
    assert.deepEqual(missing, []);
  });
  test("every var(--x) in faq/css/faq.css resolves to a --x defined in css/styles.css (the shared stylesheet the FAQ links directly)", () => {
    const used = collectUsedCustomProps("faq/css/faq.css");
    const missing = [...used].filter(
      (p) => !definedInApp.has(p) && !jsComputedProps.has(p),
    );
    assert.deepEqual(missing, []);
  });
  test("app.js's JS-computed custom properties (--header-h etc.) are all actually used somewhere in css/styles.css — none is stale/orphaned", () => {
    const used = collectUsedCustomProps("css/styles.css");
    const unused = [...jsComputedProps].filter((p) => !used.has(p));
    assert.deepEqual(unused, []);
  });
}

// ---- The hc-dark/hc-light -> dark/light rename (this session) left no stragglers ----
for (const file of CSS_FILES) {
  test(`${file} has no leftover "hc-dark"/"hc-light" data-theme selector`, () => {
    const src = read(file);
    assert.ok(!/data-theme=["']?hc-(dark|light)/.test(src));
  });
}

// ---- Every data-theme value used in a selector is one of the two real values ----
for (const file of CSS_FILES) {
  test(`${file} only selects data-theme="dark" or "light"`, () => {
    const src = read(file);
    const values = [...src.matchAll(/data-theme=["']([a-z-]+)["']/g)].map(
      (m) => m[1],
    );
    const bad = values.filter((v) => !["dark", "light"].includes(v));
    assert.deepEqual(bad, []);
  });
}

// ---- :root defines both a light (bare :root) and dark (media/attribute) value for every
// theme-swapped custom property css/styles.css declares more than once (a spot check across a
// representative sample of tokens, not exhaustive — the full cascade is easy to get subtly
// wrong and hard to catch by eye in a 2500-line file). ----
{
  const root = parse("css/styles.css");
  const propCounts = new Map();
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    propCounts.set(decl.prop, (propCounts.get(decl.prop) || 0) + 1);
  });
  const sampleTokens = [
    "--accent-cyan",
    "--accent-magenta",
    "--accent-gold",
    "--bg-primary",
    "--bg-card",
    "--text-primary",
    "--border",
  ];
  for (const token of sampleTokens) {
    test(`css/styles.css redefines ${token} for more than one theme (not just a single global value)`, () => {
      assert.ok(
        (propCounts.get(token) || 0) >= 2,
        `${token} defined ${propCounts.get(token) || 0} time(s), expected >= 2 (light + dark)`,
      );
    });
  }
}

// ---- Every .icon-* tint class referenced from js/app.js's ICON_*/STATIC_ICON_TARGETS actually
// has a CSS rule (a renamed/removed class here would silently leave an icon uncolored) ----
{
  const appSrc = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const iconClasses = [
    ...new Set(
      [...appSrc.matchAll(/class="icon-ui icon-tinted (icon-[a-z]+)/g)].map(
        (m) => m[1],
      ),
    ),
  ];
  const cssSrc = read("css/styles.css");
  for (const cls of iconClasses) {
    test(`css/styles.css defines a rule for .${cls} (referenced from js/app.js)`, () => {
      assert.match(cssSrc, new RegExp(`\\.${cls}\\{`));
    });
  }
}

// ---- The confirm/alert modal (this session's addition) has all the CSS it needs ----
for (const sel of [
  ".confirm-overlay",
  ".confirm-overlay.show",
  ".confirm-modal",
  ".confirm-message",
  ".confirm-actions",
  ".confirm-modal.confirm-alert #confirmCancelBtn",
]) {
  test(`css/styles.css defines ${sel}`, () => {
    assert.match(read("css/styles.css"), new RegExp(escapeRe(sel) + "\\{"));
  });
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\#]/g, "\\$&");
}

// ---- The FAQ's search-clear button (this session's addition) has the [hidden] override that
// makes the hidden attribute actually take effect over the class's own display:flex ----
test("faq/css/faq.css overrides display for .faq-search-clear[hidden] (otherwise the class's own display:flex always wins over the hidden attribute)", () => {
  assert.match(read("faq/css/faq.css"), /\.faq-search-clear\[hidden\]\s*\{\s*display:\s*none/);
});

// ---- Print stylesheet (this session's addition) actually forces answers open ----
test("faq/css/faq.css has an @media print block", () => {
  assert.match(read("faq/css/faq.css"), /@media print/);
});
test("faq/css/faq.css's print block forces .faq-a visible regardless of the <details> open attribute", () => {
  const src = read("faq/css/faq.css");
  const printBlockMatch = src.match(/@media print\s*\{([\s\S]*)\}\s*$/);
  assert.ok(printBlockMatch, "no @media print block found");
  assert.match(printBlockMatch[1], /\.faq-item \.faq-a\s*\{[^}]*display:\s*block\s*!important/);
});

// ---- Every CSS custom property this session's shared-ui.js icon-hand work introduced resolves
// ---- (--accent-gold reused rather than a fresh token — confirms it wasn't invented and left
// ---- undefined) ----
test('css/styles.css\'s .icon-hand rule points at --accent-gold, not an undefined token', () => {
  const src = read("css/styles.css");
  const m = src.match(/\.icon-hand\{([^}]*)\}/);
  assert.ok(m, ".icon-hand rule not found");
  assert.match(m[1], /--icon-tint:\s*var\(--accent-gold\)/);
});

// ---- The desktop "scroll void" bug: .app-layout's height used to subtract a hardcoded 60px
// guess at everything above it (the sticky header, sometimes the Resume banner) from 100vh/
// 100dvh. That guess undershot whenever the header ran taller than 60px (up to 70px at large
// text sizes) or the banner was in flow (~91px more), leaving the panel's bottom edge past the
// viewport and the *document itself* scrollable into a strip of rendered nothing below it — up
// to 89px of it. The fix (js/app.js's own --layout-top sync IIFE, see its top comment) measures
// the panel's real on-screen top instead of guessing; this test only guards the CSS side of
// that fix — that the desktop rule still reads the custom property rather than a bare number —
// since a `var(--layout-top,60px)` reverted back to a plain `60px` would silently reintroduce
// the exact bug with no visual difference on any display tall enough not to need the fallback. ----
test("css/styles.css's desktop .app-layout height reads var(--layout-top, ...), not a bare hardcoded height", () => {
  const src = read("css/styles.css");
  const m = src.match(/\.app-layout\{([^}]*)\}/);
  assert.ok(m, ".app-layout rule not found");
  assert.match(m[1], /height:calc\(100vh - var\(--layout-top,/);
  assert.match(m[1], /height:calc\(100dvh - var\(--layout-top,/);
});
