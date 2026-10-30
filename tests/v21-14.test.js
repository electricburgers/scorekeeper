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
  it("marks the paused team in standings and final results, for every look", () => {
    for (const v of ["1", "2", "3"]) {
      evalIn(w, `setPausedLook("${v}")`);
      assert.equal(w.document.documentElement.getAttribute("data-paused"), v);
      assert.equal(rows("#standings-halftime").length, 1, "halftime " + v);
      assert.equal(rows("#standings-final").length, 1, "final wager " + v);
      assert.equal(rows(".final-table").length, 1, "final results " + v);
    }
    evalIn(w, 'setPausedLook("2")');
    assert.match(rows(".final-table")[0], /Paused/);
    evalIn(w, 'setPausedLook("3")');
    assert.match(rows(".final-table")[0], /\(paused\)/);
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
