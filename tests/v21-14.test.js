// v21.14: paused-team look in the score tables (3 trial options) and the taller phone Scores sheet.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

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
});

