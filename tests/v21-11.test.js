// v21.11+: each question's header (label, badge, description, A-Z / Sort / Reset) pins itself while
// its team list scrolls - no duplicate row.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("sticky question header", () => {
  let w;
  before(async () => {
    w = await loadAppWindow();
    evalIn(w, `gameState = freshState(); gameState.teams = ["B","A"].map(freshTeam); gameState.teams.forEach(t=>t.scoreGuess=50); gameState.gameStarted=true; collapsedSections.clear(); collapsedQuestions.clear(); renderAll();`);
  });
  after(() => w.close());
  const d = () => w.document;

  it("the buttons sit in the real header of every question card; no separate sort row", () => {
    assert.ok(d().querySelector("#qblock-0-0 .q-header .q-alpha-btn"));
    assert.ok(d().querySelector("#bqblock-0 .q-header .q-alpha-btn"));
    ["halftime", "final"].forEach((t) => assert.ok(d().querySelector("#swblock-" + t + " .sw-header .q-alpha-btn"), t));
    assert.ok(!d().querySelector(".q-sortbar"));
  });
  it("headers are sticky and containers use overflow:clip", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
    assert.match(css, /\.q-header\{position:sticky;top:var\(--qbar-top\)/);
    assert.match(css, /\.special-section \.sw-header\{position:sticky;top:var\(--qbar-top\)/);
    assert.match(css, /\.section,\.question-block\{overflow:clip\}/);
  });
});
