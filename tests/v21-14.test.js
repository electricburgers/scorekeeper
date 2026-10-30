// v21.14: paused-team look in the score tables (3 trial options) and the taller phone Scores sheet.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");
const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");

describe("paused teams in score tables", () => {
  let w;
  before(async () => {
    w = await loadAppWindow();
    evalIn(w, `gameState = freshState(); gameState.teams = ["A","B"].map(freshTeam); gameState.teams[1].paused = true; gameState.gameStarted = true; renderAll();`);
  });
  after(() => w.close());
  const rows = (sel) => [...w.document.querySelectorAll(sel + " .row-paused")].map((r) => r.textContent);
  it("marks the paused team (dimmed + Paused pill) in standings and final results", () => {
    assert.equal(rows("#standings-halftime").length, 1);
    assert.equal(rows("#standings-final").length, 1);
    assert.equal(rows(".final-table").length, 1);
    assert.match(rows(".final-table")[0], /Paused/);
    assert.ok(w.document.querySelector(".final-table tr:not(.row-paused) .paused-pill") === null);
  });
  it("dims with colour, not opacity", () => {
    assert.doesNotMatch(css.match(/\.row-paused td,[^{]*\{[^}]*\}/)?.[0] || css.match(/tr\.row-paused td[^{]*\{[^}]*\}/)[0], /opacity/);
  });
});
describe("phone Scores sheet", () => {
  it("opens to just under the header and has bigger sort buttons", () => {
    assert.match(css, /height:calc\(100dvh - var\(--header-h,67px\) - 8px\)/);
    assert.match(css, /@media\(max-width:768px\)\{\s*\.sort-btn\{font-size:1\.02rem/);
  });
});

describe("one-row question header", () => {
  it("A-Z is an icon button (pictograph) and the phone header does not wrap", () => {
    const icons = fs.readFileSync(path.join(__dirname, "..", "js/icons.js"), "utf8");
    assert.match(icons, /ICON_AZ_DOWN_PICT/);
    assert.match(css, /\.q-header,\.sw-header\{flex-wrap:nowrap\}/);
  });
});
