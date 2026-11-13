// v21.50: the Settings Theme row shows its sun/moon pictograph beside the button (same 2rem size as the
// Game Mode pictograph); in Emoji icon style the emoji stays inside the button instead.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("Theme row pictograph", () => {
  let window;
  before(async () => { window = await loadAppWindow(); });
  after(() => { try { window.close(); } catch { /* ignore */ } });

  it("pictograph style: icon beside the button, button holds text only", () => {
    const d = window.document;
    evalIn(window, 'setIconStyle("pictograph"); applyPrefs();');
    assert.ok(d.querySelector("#themeIcon svg"));
    assert.equal(d.querySelector("#themeToggle svg"), null);
    assert.match(d.getElementById("themeToggle").textContent.trim(), /^(Dark|Light)$/);
  });
  it("icon follows the theme (moon in dark, sun in light)", () => {
    const d = window.document;
    evalIn(window, 'setTheme("light")');
    assert.ok(d.querySelector("#themeIcon svg.icon-sun"));
    evalIn(window, 'setTheme("dark")');
    assert.ok(d.querySelector("#themeIcon svg.icon-moon"));
  });
  it("emoji style: emoji stays in the button, icon span is empty", () => {
    const d = window.document;
    evalIn(window, 'setIconStyle("emoji")');
    assert.equal(d.getElementById("themeIcon").innerHTML, "");
    assert.match(d.getElementById("themeToggle").textContent, /[🌙☀]/u);
    evalIn(window, 'setIconStyle("pictograph")');
  });
});
