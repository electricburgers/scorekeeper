// v21.5: on touch devices / screens up to 1024px every control is at least 44x44 CSS px.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
const block = css.slice(css.indexOf("/* TOUCH TARGETS"));

describe("touch target sizing", () => {
  it("lives in a coarse-pointer / narrow-screen media query", () => {
    assert.match(block, /@media \(pointer:coarse\),\(max-width:1024px\)\{/);
  });
  it("dropdowns, buttons and fields get a 44px minimum height", () => {
    const rule = block.match(/\{min-height:44px\}/);
    assert.ok(rule);
    for (const sel of [".theme-select", ".cv-select-btn", ".settings-btn", ".sort-btn", 'input[type="text"]', 'input[type="number"]', ".check-label", ".toolbar>button"])
      assert.ok(block.split("{min-height:44px}")[0].includes(sel), sel);
  });
  it("icon buttons are 44px wide and the timer buttons 44x44", () => {
    assert.match(block, /\.settings-x-btn[^{]*\{min-width:44px\}/);
    assert.match(block, /qtimer-step\{width:44px;height:44px;min-height:44px\}/);
  });
  it("small glyph buttons extend their tap area instead of resizing", () => {
    assert.match(block, /\.pause-team::after,\.remove-team button::after\{content:"";position:absolute;inset:-12px\}/);
  });
  it("dropdown menu rows are 44px tall", () => {
    assert.match(block, /\.cv-select-menu li\{min-height:44px/);
  });
});
