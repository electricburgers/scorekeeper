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
