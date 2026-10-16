// v19.68 — pausing a team, and the CB / Bonus checkbox swap on the Teams rows.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("Paused teams (scoring)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  const setup = () =>
    evalIn(
      window,
      `gameState = freshState();
       gameState.teams = [freshTeam("A"), freshTeam("B"), freshTeam("C")];
       gameState.teams[2].paused = true;`,
    );

  it("freshTeam() starts unpaused and migrateState backfills paused", () => {
    assert.equal(evalIn(window, "freshTeam('x').paused"), false);
    assert.equal(
      evalIn(window, "(() => { const s = {teams:[{name:'old'}]}; migrateState(s); return s.teams[0].paused; })()"),
      false,
    );
  });

  it("a paused team does not block a Beer Round", () => {
    setup();
    evalIn(window, "gameState.rounds[0].questions[0][0] = {wager:1, correct:true}; gameState.rounds[0].questions[0][1] = {wager:2, correct:true};");
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), true);
  });

  it("an unpaused team that hasn't answered still blocks the Beer Round", () => {
    setup();
    evalIn(window, "gameState.teams[2].paused = false; gameState.rounds[0].questions[0][0] = {wager:1, correct:true}; gameState.rounds[0].questions[0][1] = {wager:2, correct:true};");
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), false);
  });

  it("all teams paused is never a Beer Round", () => {
    setup();
    evalIn(window, "gameState.teams.forEach(t => t.paused = true);");
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), false);
  });

  it("bonus and halftime/final Beer Rounds ignore paused teams", () => {
    setup();
    evalIn(
      window,
      `gameState.rounds[0].bonus[0] = 4; gameState.rounds[0].bonus[1] = 4;
       gameState.halftime[0] = {wager:1, correct:true}; gameState.halftime[1] = {wager:1, correct:true};`,
    );
    assert.equal(evalIn(window, "isBonusBeerRound(0)"), true);
    assert.equal(evalIn(window, "isSpecialBeerRound('halftime')"), true);
  });

  it("round progress and question progress count only active teams", () => {
    setup();
    assert.equal(evalIn(window, "qScored(0, 0).total"), 2);
    assert.equal(evalIn(window, "roundProgress(0).total"), 10);
    evalIn(window, "for (let q=0;q<4;q++) for (const ti of [0,1]) gameState.rounds[0].questions[q][ti] = {wager:1, correct:true};");
    assert.equal(evalIn(window, "roundProgress(0).done"), 8);
  });

  it("a paused team stays in grandTotal / the roster", () => {
    setup();
    evalIn(window, "gameState.teams[2].bonusItem = true;");
    assert.equal(evalIn(window, "grandTotal(2)"), 5);
    assert.equal(evalIn(window, "gameState.teams.length"), 3);
  });
});

describe("Paused teams (UI)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("togglePause flips the flag and the team row shows a pressed pause button", () => {
    evalIn(window, "gameState = freshState(); renderAll();");
    window.addTeam();
    window.addTeam();
    window.togglePause(1);
    assert.equal(evalIn(window, "gameState.teams[1].paused"), true);
    const row = window.document.querySelector('.team-entry[data-ti="1"]');
    assert.ok(row.classList.contains("is-paused"));
    assert.equal(row.querySelector(".pause-team").getAttribute("aria-pressed"), "true");
    window.togglePause(1);
    assert.equal(evalIn(window, "gameState.teams[1].paused"), false);
  });

  it("paused teams get no entry row on question cards", () => {
    evalIn(window, "gameState = freshState(); renderAll();");
    window.addTeam();
    window.addTeam();
    window.togglePause(1);
    const rows = window.document.querySelectorAll("#qblock-0-0 .team-answer");
    assert.equal(rows.length, 1);
  });

  it("CB comes before Bonus, labelled CB / Bonus (never NJCB), with a BON short form", () => {
    evalIn(window, "gameState = freshState(); renderAll();");
    window.addTeam();
    const labels = [...window.document.querySelectorAll(".team-checks .check-label")];
    assert.equal(labels.length, 2);
    assert.ok(labels[0].classList.contains("njcb-check"));
    assert.ok(labels[1].classList.contains("item-check"));
    assert.match(labels[0].textContent, /\+3\s*CB/);
    assert.doesNotMatch(labels[0].textContent, /NJCB/);
    assert.match(labels[1].textContent, /\+5\s*Bonus/);
    assert.ok(labels[1].querySelector(".lbl-short").textContent.includes("BON"));
  });
});

describe("Teams row CSS", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "styles.css"), "utf8");
  it("makes the two checkboxes equal width and swaps to BON only when the row is too narrow", () => {
    assert.match(css, /@container \(max-width:[^)]*\)\s*\{[^}]*\.lbl-full\{display:none\}/);
    assert.match(css, /\.team-checks\s+\.check-label\s*\{[^}]*flex:\s*1 1 0/);
    assert.match(css, /\.lbl-short/);
  });
});
