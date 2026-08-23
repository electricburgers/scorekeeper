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

// ---- Mobile Settings panel header ghosting: a host on a real iPhone saw the Theme row visibly
// double-expose/ghost against the Settings header while scrolling the panel. .settings-panel-
// head was pinned by flex layout (flex-shrink:0), not position:sticky, on the assumption that
// meant it didn't need the transform:translateZ(0) GPU-layer-promotion workaround already used
// on .header/.mini-progress/.audit-head for the same class of iOS Safari glitch — wrong, since
// the artifact is a compositing-layer boundary issue next to a -webkit-overflow-scrolling:touch
// container (.settings-panel-body), not something specific to position:sticky. Re-added; this
// guards the CSS side of that fix directly, since Chromium (this test suite's only real browser
// check, via the preview tool) doesn't reproduce this WebKit-specific glitch at all — nothing
// here can confirm the ghosting itself is gone, only that the fix that closed it last time is
// still present. ----
test("css/styles.css's mobile .settings-panel-head keeps the iOS GPU-layer-promotion fix (transform:translateZ(0) etc.)", () => {
  const src = read("css/styles.css");
  const rules = [...src.matchAll(/\.settings-panel-head\{([^}]*)\}/g)];
  const withContent = rules.find((m) => !/^display:none$/.test(m[1]));
  assert.ok(withContent, "no non-display:none .settings-panel-head rule found");
  assert.match(withContent[1], /transform:translateZ\(0\)/);
  assert.match(withContent[1], /-webkit-transform:translateZ\(0\)/);
  assert.match(withContent[1], /backface-visibility:hidden/);
  assert.match(withContent[1], /-webkit-backface-visibility:hidden/);
});

// ============================================================================
// Five new tests (per this session's "think about and describe... implement all of these"),
// plus the double-tap-zoom guard requested alongside them.
// ============================================================================

// ---- Double-tap-zoom: body{touch-action:manipulation} (already relied on by every button via
// the CSS Touch Action spec's ancestor-intersection rule) plus the explicit, redundant
// button/[role="button"] rule added this session as a self-contained belt-and-suspenders copy —
// see the comment above it in css/styles.css for why relying on the ancestor rule alone was
// judged too easy to accidentally defeat. ----
test("css/styles.css: body has touch-action:manipulation (prevents a double-tap being read as double-tap-to-zoom)", () => {
  const src = read("css/styles.css");
  const m = src.match(/\bbody\{([^}]*)\}/);
  assert.ok(m, "no body{...} rule found");
  assert.match(m[1], /touch-action:manipulation/);
});
test('css/styles.css: every actual <button>/[role="button"] gets touch-action:manipulation explicitly, not only by inheriting body\'s', () => {
  const src = read("css/styles.css");
  assert.match(src, /button,\[role="button"\]\{touch-action:manipulation\}/);
});
test("css/styles.css has no rule that sets touch-action to auto/pan-x/pan-y (either would defeat the double-tap-zoom fix for anything under it — .sheet-grab-handle/.mobile-scores-peek's deliberate drag-gesture opt-out uses touch-action:none instead, which is stricter, not more permissive)", () => {
  const src = read("css/styles.css");
  assert.doesNotMatch(src, /touch-action:\s*(auto|pan-x|pan-y)\b/);
});

// ---- Every transform:translateZ(0) GPU-layer-promotion fix (see .header/.mini-progress/
// .audit-head/.settings-panel-head's own comments — a compositing-layer-boundary artifact next to
// -webkit-overflow-scrolling:touch that surfaces as visible ghosting on real iOS Safari, invisible
// to every browser this test suite or the preview tool can actually check) is applied as the full
// 4-declaration idiom together, not just transform on its own — a partial copy would silently
// reintroduce the exact ghosting bug this session already chased down twice. ----
test("css/styles.css: every transform:translateZ(0) site also has -webkit-transform, backface-visibility, and -webkit-backface-visibility in the same rule", () => {
  const root = parse("css/styles.css");
  const offenders = [];
  root.walkRules((rule) => {
    const props = new Set();
    let hasTranslateZ = false;
    rule.walkDecls((decl) => {
      props.add(decl.prop.toLowerCase());
      if (/translateZ\(0\)/.test(decl.value)) hasTranslateZ = true;
    });
    if (!hasTranslateZ) return;
    for (const required of [
      "transform",
      "-webkit-transform",
      "backface-visibility",
      "-webkit-backface-visibility",
    ]) {
      if (!props.has(required))
        offenders.push(`${rule.selector} (line ${rule.source.start.line}) missing ${required}`);
    }
  });
  assert.deepEqual(offenders, []);
});

// ---- Every class a js/*.js file toggles onto an element with classList.add/toggle/remove has a
// matching CSS selector somewhere — swept automatically off the literal class-name arguments in
// every top-level js/*.js file, rather than a hand-maintained list (like the .icon-* test above)
// that can drift the same way the class names themselves can. A renamed/removed CSS rule for a
// class still toggled from JS would otherwise fail completely silently: the class lands on the
// element exactly as intended, nothing throws, it just does nothing visually. ----
test("every class referenced by classList.add/toggle/remove(...) in a top-level js/*.js file has a matching CSS selector", () => {
  const jsDir = path.join(ROOT, "js");
  const jsFiles = fs
    .readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/" + f);
  const classes = new Set();
  for (const f of jsFiles) {
    for (const m of read(f).matchAll(
      /classList\.(?:add|toggle|remove)\(\s*"([a-zA-Z0-9_-]+)"/g,
    )) {
      classes.add(m[1]);
    }
  }
  assert.ok(classes.size > 10, "expected to find several classList.add/toggle/remove class names");
  const cssSrc = CSS_FILES.map((f) => read(f)).join("\n");
  const missing = [...classes].filter((cls) => {
    const re = new RegExp("\\." + cls.replace(/-/g, "\\-") + "(?![a-zA-Z0-9_-])");
    return !re.test(cssSrc);
  });
  assert.deepEqual(missing, []);
});

// ---- Every animation:name shorthand resolves to a @keyframes name actually defined somewhere —
// a typo'd or renamed keyframes name fails silently (the element just never animates), the same
// invisible-no-op shape as the classList check above. ----
test("every animation:<name> in css/styles.css has a matching @keyframes <name> definition", () => {
  const root = parse("css/styles.css");
  const defined = new Set();
  root.walkAtRules("keyframes", (rule) => defined.add(rule.params.trim()));
  const missing = [];
  root.walkDecls("animation", (decl) => {
    const name = decl.value.trim().split(/\s+/)[0];
    if (name === "none") return; // animation:none deliberately clears an inherited animation
    if (!defined.has(name)) missing.push(`${name} (line ${decl.source.start.line})`);
  });
  assert.ok(defined.size > 3, "expected to find several @keyframes definitions");
  assert.deepEqual(missing, []);
});

// ---- !important is a specificity escape hatch, not a design pattern — pinned to the exact,
// already-reviewed set it's used for today (mostly deliberate "this state always wins" overrides:
// .btn-danger/.btn-accent's solid colors beating a more specific hover rule elsewhere, the
// beer-round highlight beating the row's own base styling, col-resize's cursor beating whatever
// the pointer is currently over) so a NEW one shows up as a failing test — a prompt to ask whether
// the specificity fight it's papering over is worth fixing at the root instead, the same judgment
// call this exact list already got, rather than silently accumulating. ----
test("css/styles.css uses !important only in the known, already-reviewed set of overrides", () => {
  const root = parse("css/styles.css");
  const found = [];
  root.walkDecls((decl) => {
    if (decl.important) found.push(`${decl.parent.selector} { ${decl.prop} }`);
  });
  const expected = [
    ".btn-accent { background }",
    ".btn-accent { color }",
    ".btn-accent { border-color }",
    ".btn-accent { font-weight }",
    ".btn-danger { border-color }",
    ".btn-danger { color }",
    ".btn-danger:hover { background }",
    "body.col-resizing { cursor }",
    "body.col-resizing { user-select }",
    "body.col-resizing * { cursor }",
    "body.col-resizing * { user-select }",
    ".col-right { width }",
    ".check-label { margin-bottom }",
    ".question-block.beer-round { background }",
    ".question-block.beer-round { border-left-color }",
    ".question-block.beer-round { opacity }",
    ".special-section.beer-round { background }",
    ".special-section.beer-round { border-color }",
    ".special-section.beer-round h3 { color }",
    ".sw-header h3 { margin-bottom }",
    ".question-block.beer-round { border-color }",
    ".fr-diff-win { color }",
    ".fr-diff-win { font-weight }",
  ];
  assert.deepEqual([...found].sort(), [...expected].sort());
});

// ---- Mobile breakpoints only ever use this project's fixed, intentional set of pixel values —
// {480, 600, 601, 768, 769} — where 600/601 and 768/769 are deliberate max-width/min-width
// complementary pairs (one rule ends exactly where its counterpart begins, no 1px gap or overlap)
// and 480 is a further sub-breakpoint nested inside the ≤600px mobile block. A one-off value like
// 599px or 767px typo'd into a new rule wouldn't line up with its neighbor and would leave a
// dead pixel gap where neither rule's styles apply — the same shape of bug the mobile Settings
// panel gap fix (this session) chased down, just in a media query instead of a padding value. ----
test("css/styles.css only uses the project's known set of @media width breakpoints", () => {
  const src = read("css/styles.css");
  const KNOWN = new Set([480, 600, 601, 768, 769]);
  const found = [...src.matchAll(/@media\s*\(\s*(?:min|max)-width:\s*(\d+)px/g)].map(
    (m) => Number(m[1]),
  );
  assert.ok(found.length > 3, "expected to find several @media width breakpoints");
  const unknown = found.filter((px) => !KNOWN.has(px));
  assert.deepEqual(unknown, []);
});
