// v21.48: the Game Mode pictograph vanished in v21.47 (its span collapsed to 0 width). Layout can't be
// measured in jsdom, so these pin the CSS shape that was verified in headless Chromium to render 44x44
// beside a 44px-tall select without growing the row.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
const rule = (sel) => {
  const m = css.match(new RegExp("(?:^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}"));
  return m ? m[1] : "";
};

describe("Game Mode pictograph is visible", () => {
  it("the icon span does not rely on aspect-ratio from a stretched height (that resolves to 0 width)", () => {
    assert.doesNotMatch(rule("#gameModeIcon"), /aspect-ratio/);
  });
  it("the icon is in-flow (an absolutely positioned child gives its span no intrinsic width)", () => {
    assert.doesNotMatch(css, /#gameModeIcon \.icon-ui[^{]*\{[^}]*position:absolute/);
  });
  it("the picker is a grid so the svg takes the select's row height and sizes its own width", () => {
    assert.match(rule(".game-mode-picker"), /display:inline-grid/);
    assert.match(css, /#gameModeIcon \.icon-ui[^{]*\{[^}]*height:100%[^}]*aspect-ratio:1/);
  });
});
