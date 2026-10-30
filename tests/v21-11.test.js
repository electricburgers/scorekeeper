// v21.11: A-Z / Sort / Reset live in a sticky row at the top of each question's body.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("sticky question sort row", () => {
  let w;
  before(async () => {
    w = await loadAppWindow();
    evalIn(w, `gameState = freshState(); gameState.teams = ["B","A"].map(freshTeam); gameState.teams.forEach(t=>t.scoreGuess=50); gameState.gameStarted=true; collapsedSections.clear(); collapsedQuestions.clear(); renderAll();`);
  });
  after(() => w.close());
  const q = (sel) => w.document.querySelector("#qblock-0-0 " + sel);

  it("buttons are in the first row of the body, not the header", () => {
    assert.ok(!q(".q-header .q-alpha-btn"));
    assert.ok(q(".q-body > .q-sortbar:first-child .q-alpha-btn"));
    assert.ok(q(".q-sortbar .q-sort-btn") && q(".q-sortbar .q-reset-btn"));
    assert.ok(w.document.querySelector("#bqblock-0 .q-body > .q-sortbar:first-child .q-alpha-btn"));
  });
  it("the sort row is sticky and containers use overflow:clip", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
    assert.match(css, /\.q-sortbar\{position:sticky;top:var\(--qbar-top\)/);
    assert.match(css, /\.section,\.question-block\{overflow:clip\}/);
  });
});
