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
  it("the icon has an explicit fixed size (no layout-dependent sizing that overlapped the select on iOS)", () => {
    assert.match(css, /#gameModeIcon \.icon-ui[^{]*\{[^}]*width:2rem;height:2rem/);
    assert.doesNotMatch(css, /#gameModeIcon \.icon-ui[^{]*\{[^}]*(position:absolute|aspect-ratio)/);
  });
  it("the picker is a plain centered flex row", () => {
    assert.match(rule(".game-mode-picker"), /display:inline-flex;align-items:center/);
  });
  it("the Game Mode select is trimmed shorter than the 44px touch default", () => {
    assert.match(css, /#gameModeSelect\.theme-select\{[^}]*min-height:2\.25rem/);
  });
  it("every Game Mode pictograph tint is defined in both the dark (default) and light themes", () => {
    const lightAt = css.indexOf('[data-theme="light"]{');
    assert.ok(lightAt > 0);
    const dark = css.slice(0, lightAt);
    const light = css.slice(lightAt, lightAt + 6000);
    for (const v of ["--tint-trophy", "--tint-trophy-2", "--tint-flask", "--tint-theme-2", "--tint-cap"]) {
      assert.ok(dark.includes(v + ":"), v + " missing in dark");
      assert.ok(light.includes(v + ":"), v + " missing in light");
    }
  });
});
