// v22.103 — team names on one line beside the score buttons, and + Add Team focuses the new name.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");

describe("v22.103", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });
  after(() => window.close());
  const run = (js) => evalIn(window, js);
  const addButton = () => window.document.getElementById("addTeamBtn");

  beforeEach(() => {
    run("gameState = freshState(); teamAlphaSort = false; teamGuessSort = false; renderAll();");
  });

  it("+ Add Team puts focus in the new team's name field", () => {
    addButton().click();
    addButton().click();
    assert.equal(window.document.activeElement.getAttribute("aria-label"), "Team 2 name");
  });

  it("focuses the new team even when a name sort shows it out of last place", () => {
    run(`gameState.teams = ["Zebras", "Yaks"].map(freshTeam); teamAlphaSort = "za"; teamSortSnapshot = undefined; renderAll();`);
    addButton().click();
    assert.equal(window.document.activeElement.getAttribute("aria-label"), "Team 3 name");
  });

  it("addTeam() on its own, as the tour uses it, leaves focus alone", () => {
    run("document.activeElement.blur(); addTeam();");
    assert.equal(window.document.activeElement, window.document.body);
  });

  it("keeps the stylesheet's name width when there is no layout to measure", () => {
    run(`document.documentElement.style.setProperty("--name-col", "999px"); fitNameColumn();`);
    assert.equal(run(`document.documentElement.style.getPropertyValue("--name-col")`), "");
  });

  it("sets the column from the measured names and leaves no hidden copy of them", () => {
    run(`gameState.teams = ["Parliamentary Procedure"].map(freshTeam); fitNameColumn();
      Object.defineProperty(document.getElementById("nameProbe"), "offsetWidth", { configurable: true, get: () => 200 });
      fitNameColumn();`);
    assert.equal(run(`document.documentElement.style.getPropertyValue("--name-col")`), "201px");
    assert.equal(run(`document.getElementById("nameProbe").textContent`), "");
    run(`delete document.getElementById("nameProbe").offsetWidth;`);
  });

  it("wide question headers start the sort buttons at the score column, percentages after", () => {
    assert.match(css, /\.q-header-left,\.sw-header-left\{flex:1 1 0;max-width:var\(--score-col\);min-width:min-content\}/);
    assert.match(css, /\.q-header-right \.q-stats-row\{display:flex;gap:inherit;order:1\}/);
  });

  it("wide scoring rows use the measured column, with a floor for short names", () => {
    assert.match(css, /--score-col:max\(var\(--name-col,11rem\),13rem\)/);
    assert.match(css, /:is\(\.team-answer,\.bonus-row,\.special-wager-row\)>\.ta-name\{width:var\(--score-col\)/);
  });
});
