// Regression guards for the v21.0 whole-app WCAG 2.1/2.2 AA pass (the contrast ratios themselves
// were measured in a real browser across Regular / Theme Night / Name That Tune x 6 theme+color
// vision combinations; these pin the fixes so they can't quietly regress).
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const css = read("css/styles.css");
const faqCss = read("faq/css/faq.css");

describe("WCAG AA fixes stay fixed", () => {
  it("pinch-zoom is not disabled (1.4.4 Resize Text)", () => {
    assert.doesNotMatch(read("index.html"), /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
  });
  it("a finished question is not faded with opacity (it dropped light-theme text under 4.5:1)", () => {
    assert.match(css, /\.question-block\.q-done\{[^}]*\}/);
    assert.doesNotMatch(css.match(/\.question-block\.q-done\{[^}]*\}/)[0], /opacity/);
  });
  it("placeholders, locked fields, paused rows and the empty-points dash stay legible", () => {
    assert.match(css, /input::placeholder,textarea::placeholder\{color:var\(--text-muted\);opacity:1\}/);
    assert.match(css, /input:disabled\{opacity:\.65/);
    assert.doesNotMatch(css.match(/\.pts-zero,\.bonus-pts\.pts-zero\{[^}]*\}/)[0], /opacity/);
    assert.doesNotMatch(css.match(/\.cp-note\{[^}]*\}/)[0], /opacity/);
  });
  it("sort buttons use the AA text token, not the fill token", () => {
    assert.match(css, /\.q-sort-btn,\.q-alpha-btn\{background:transparent;color:var\(--txt-cyan\)/);
  });
  it("2.5.8 target size: 24px minimum rules exist for the short rows and selects", () => {
    assert.match(css, /\.q-header-left,\.standings-title-row,\.cv-select-btn\{min-height:24px\}/);
    assert.match(css, /\.ta-name-clickable,\.sr-name-clickable\{padding-block:5px;margin-block:-5px\}/);
    assert.match(css, /\.theme-select\{min-height:1\.75rem/);
  });
  it("selects show a focus ring for keyboard users", () => {
    assert.match(css, /\.theme-select:focus-visible\{outline:2px solid/);
  });
  it("FAQ: search box has an AA placeholder and a 3:1 border; separators are legible", () => {
    assert.match(faqCss, /\.faq-search::placeholder\s*\{[^}]*color:\s*var\(--text-muted\)/);
    assert.match(faqCss, /\.faq-search\s*\{[^}]*border:\s*1px solid var\(--border-control\)/);
    assert.match(faqCss, /\.faq-expand-sep\s*\{[^}]*color:\s*var\(--text-muted\)/);
  });
});
