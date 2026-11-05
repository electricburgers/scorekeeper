// v21.42: the Sort button shows a count badge + solid fill only when a re-sort would move teams.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v21.42 Sort button can-re-sort hint", () => {
  let window;
  before(async () => { window = await loadAppWindow(); });
  after(() => window.close());
  const btn = () => window.document.querySelector("#qblock-0-0 .q-sort-btn");

  it("lights up with a count when answered teams sit above unanswered ones, and quiets after Sort", () => {
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); gameState.rounds[0].questions[0] = {}; renderAll();`);
    assert.ok(!btn().classList.contains("can-resort"), "nothing answered: nothing to move");
    evalIn(window, `gameState.rounds[0].questions[0][0] = {wager: 1, correct: true}; renderAll();`);
    assert.ok(btn().classList.contains("can-resort"));
    const n = Number(btn().querySelector(".resort-count").textContent);
    assert.ok(n >= 2);
    evalIn(window, `sortQuestion(0, 0);`);
    assert.ok(!btn().classList.contains("can-resort"), "just sorted: nothing to move");
    assert.ok(btn().classList.contains("active"));
    evalIn(window, `gameState.rounds[0].questions[0][1] = {wager: 1, correct: false}; renderAll();`);
    assert.ok(btn().classList.contains("can-resort"), "another team answered since the sort");
  });
});
