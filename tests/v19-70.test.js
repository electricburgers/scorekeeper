// v19.70 — per-question A-Z / Z-A name sort (cycles off -> A-Z -> Z-A -> off), combinable with
// the existing "unanswered first" sort.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const rowNames = (w, sel = "#qblock-0-0") =>
  [...w.document.querySelectorAll(sel + " .team-answer .ta-name")].map((e) => e.textContent.trim());
const btn = (w, sel = "#qblock-0-0") => w.document.querySelector(sel + " .q-alpha-btn");

describe("Per-question A-Z sort", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  const setup = () =>
    evalIn(
      window,
      `gameState = freshState();
       gameState.teams = ["Charlie", "alpha", "Bravo"].map(freshTeam);
       questionSortOrder = {}; questionAlphaSort = {}; questionSortPending = {};
       renderAll();`,
    );

  it("applyAlphaSort orders case-insensitively, either direction, and is a no-op when off", () => {
    setup();
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(applyAlphaSort([0,1,2],'az'))")), [1, 2, 0]);
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(applyAlphaSort([0,1,2],'za'))")), [0, 2, 1]);
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(applyAlphaSort([0,1,2],undefined))")), [0, 1, 2]);
  });

  it("tapping cycles A-Z, Z-A, off with distinct visual states", () => {
    setup();
    const b0 = btn(window);
    assert.ok(b0, "button exists");
    assert.equal(b0.getAttribute("data-state"), "off");
    assert.deepEqual(rowNames(window), ["Charlie", "alpha", "Bravo"]);

    window.toggleAlphaSort(0, 0);
    assert.equal(btn(window).getAttribute("data-state"), "az");
    assert.ok(btn(window).classList.contains("active"));
    assert.deepEqual(rowNames(window), ["alpha", "Bravo", "Charlie"]);

    window.toggleAlphaSort(0, 0);
    assert.equal(btn(window).getAttribute("data-state"), "za");
    assert.ok(btn(window).classList.contains("active"));
    assert.deepEqual(rowNames(window), ["Charlie", "Bravo", "alpha"]);

    window.toggleAlphaSort(0, 0);
    assert.equal(btn(window).getAttribute("data-state"), "off");
    assert.ok(!btn(window).classList.contains("active"));
    assert.deepEqual(rowNames(window), ["Charlie", "alpha", "Bravo"]);
  });

  it("works together with the unanswered-first sort (both on at once)", () => {
    setup();
    // Charlie answered; alpha + Bravo not.
    evalIn(window, "gameState.rounds[0].questions[0][0] = {wager:1, correct:true};");
    window.sortQuestion(0, 0);
    assert.ok(window.document.querySelector("#qblock-0-0 .q-sort-btn").classList.contains("active"));
    window.toggleAlphaSort(0, 0); // A-Z
    assert.ok(window.document.querySelector("#qblock-0-0 .q-sort-btn").classList.contains("active"));
    assert.ok(btn(window).classList.contains("active"));
    // unanswered first (alpha, Bravo A-Z), answered Charlie last
    assert.deepEqual(rowNames(window), ["alpha", "Bravo", "Charlie"]);
    window.toggleAlphaSort(0, 0); // Z-A
    assert.deepEqual(rowNames(window), ["Bravo", "alpha", "Charlie"]);
    window.toggleAlphaSort(0, 0); // off -> back to unanswered-first entry order
    assert.deepEqual(rowNames(window), ["alpha", "Bravo", "Charlie"]);
    assert.ok(window.document.querySelector("#qblock-0-0 .q-sort-btn").classList.contains("active"));
  });

  it("is per question and Reset clears it", () => {
    setup();
    window.toggleAlphaSort(0, 0);
    assert.equal(btn(window, "#qblock-0-1").getAttribute("data-state"), "off");
    window.resetQuestionSort(0, 0);
    assert.equal(btn(window).getAttribute("data-state"), "off");
  });
});

describe("Sort button states (CSS)", () => {
  const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "css", "styles.css"), "utf8");
  it("sort buttons are blank when off and solid when active", () => {
    assert.match(css, /\.q-sort-btn,\.q-alpha-btn\{background:transparent;/);
    assert.match(css, /\.q-sort-btn\.active,\.q-alpha-btn\.active\{background:var\(--accent-cyan-solid\)/);
  });
});

describe("A-Z sort on bonus questions", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());
  const names = () =>
    [...window.document.querySelectorAll("#bqblock-0 .bonus-row .ta-name")].map((e) => e.textContent.trim());
  const abtn = () => window.document.querySelector("#bqblock-0 .q-alpha-btn");

  it("bonus card has an A-Z button that cycles A-Z, Z-A, off and combines with Sort", () => {
    evalIn(
      window,
      `gameState = freshState();
       gameState.teams = ["Charlie", "alpha", "Bravo"].map(freshTeam);
       questionSortOrder = {}; questionAlphaSort = {}; questionSortPending = {};
       renderAll();`,
    );
    assert.ok(abtn(), "button exists");
    assert.equal(abtn().getAttribute("data-state"), "off");
    window.toggleBonusAlphaSort(0);
    assert.equal(abtn().getAttribute("data-state"), "az");
    assert.deepEqual(names(), ["alpha", "Bravo", "Charlie"]);
    window.toggleBonusAlphaSort(0);
    assert.deepEqual(names(), ["Charlie", "Bravo", "alpha"]);
    // with unanswered-first also on: Charlie answered stays last
    evalIn(window, "gameState.rounds[0].bonus[0] = 3;");
    window.sortBonusQuestion(0);
    assert.ok(window.document.querySelector("#bqblock-0 .q-sort-btn").classList.contains("active"));
    assert.deepEqual(names(), ["Bravo", "alpha", "Charlie"]);
    window.toggleBonusAlphaSort(0);
    assert.equal(abtn().getAttribute("data-state"), "off");
    window.toggleBonusAlphaSort(0);
    window.resetBonusQuestionSort(0);
    assert.equal(abtn().getAttribute("data-state"), "off");
  });
});
