// v22.49 — the Q5 Bonus Question is locked until that round's Q4 has a response.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v22.49 bonus question order guard", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
       gameState.rounds.forEach(r => { r.questions = [{}, {}, {}, {}]; r.bonus = {}; });
       gameState.gameStarted = true; renderAll();`,
    );
  });
  after(() => window.close());

  it("is locked until Q4 of the same round has a response", () => {
    assert.equal(evalIn(window, "bonusLocked(0)"), true);
    evalIn(window, "setB(0,0,3)");
    assert.equal(evalIn(window, "JSON.stringify(gameState.rounds[0].bonus)"), "{}");
    evalIn(window, "gameState.rounds[0].questions[3][0] = { wager: 4, correct: true }; renderAll();");
    assert.equal(evalIn(window, "bonusLocked(0)"), false);
    evalIn(window, "setB(0,0,3)");
    assert.equal(evalIn(window, "gameState.rounds[0].bonus[0]"), 3);
  });

  it("never locks a bonus that already holds a score", () => {
    evalIn(window, "gameState.rounds[0].questions[3] = {}; renderAll();");
    assert.equal(evalIn(window, "bonusLocked(0)"), false);
  });
});
