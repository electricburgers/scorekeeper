// v19.70 / v23.3 — question lists are always A-Z by team name. Sort (unanswered to the top) is the one
// button; v23.3 removed the per-question A-Z / Z-A and Reset Sort buttons.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const CARDS = [
  ["question", "#qblock-0-0", "gameState.rounds[0].questions[0][0] = {wager:1, correct:true}", "sortQuestion(0, 0)"],
  ["bonus", "#bqblock-0", "gameState.rounds[0].bonus[0] = 3", "sortBonusQuestion(0)"],
  ["halftime", "#swblock-halftime", "gameState.halftime[0] = {wager:1, correct:true}", "sortSpecialWager('halftime')"],
  ["final", "#swblock-final", "gameState.finalWager[0] = {wager:1, correct:true}", "sortSpecialWager('final')"],
];

describe("question lists are A-Z with one Sort button", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  for (const [kind, card, answer, sort] of CARDS) {
    it(`${kind}: A-Z, Sort lifts the unanswered, and a Sort after all are scored restores A-Z`, () => {
      evalIn(
        window,
        `gameState = freshState(); gameState.teams = ["Charlie", "alpha", "Bravo"].map(freshTeam);
         questionSortPending = {}; renderAll();`,
      );
      const $ = (sel) => window.document.querySelectorAll(card + " " + sel);
      const names = () => [...$(".ta-name")].map((e) => e.textContent.trim());
      assert.deepEqual(names(), ["alpha", "Bravo", "Charlie"]);
      assert.equal($(".q-sort-btn").length, 1);
      assert.equal($(".q-alpha-btn, .q-reset-btn").length, 0);

      // "alpha" is team 1; answer team 0 (Charlie) and then sort.
      evalIn(window, answer);
      evalIn(window, sort);
      assert.deepEqual(names(), ["alpha", "Bravo", "Charlie"]);
      evalIn(window, answer.replace("[0] =", "[1] ="));
      evalIn(window, sort);
      assert.deepEqual(names(), ["Bravo", "alpha", "Charlie"]);
      evalIn(window, answer.replace("[0] =", "[2] ="));
      evalIn(window, "renderAll()");
      assert.deepEqual(names(), ["Bravo", "alpha", "Charlie"], "scoring alone never moves a row");
      evalIn(window, sort);
      assert.deepEqual(names(), ["alpha", "Bravo", "Charlie"]);
    });
  }
});
