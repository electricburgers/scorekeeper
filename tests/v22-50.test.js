// v22.50 — wager Q5s (rounds 2 and 4) locked until the round's Q4 has a response; toast wording.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v22.50 special wager order guard", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
      gameState.rounds.forEach(r => { r.questions = [{}, {}, {}, {}]; r.bonus = {}; });
      gameState.halftime = {}; gameState.finalWager = {}; gameState.gameStarted = true; renderAll();`);
  });
  after(() => window.close());

  it("locks halftime and final wagers until Q4 has a response", () => {
    assert.equal(evalIn(window, 'specialLocked("halftime")'), true);
    assert.equal(evalIn(window, 'specialLocked("final")'), true);
    evalIn(window, "setHW(0, 3)");
    assert.equal(evalIn(window, "JSON.stringify(gameState.halftime)"), "{}");
    assert.ok(window.document.querySelector("#swblock-halftime.q-locked"));
    evalIn(window, "gameState.rounds[1].questions[3][0] = {wager:4, correct:true}; renderAll();");
    assert.equal(evalIn(window, 'specialLocked("halftime")'), false);
    evalIn(window, "setHW(0, 3)");
    assert.equal(evalIn(window, "gameState.halftime[0].wager"), 3);
  });

  it("toast wording is short", () => {
    assert.doesNotMatch(evalIn(window, "bonusLockedMessage(1)"), /at least one team/);
    assert.doesNotMatch(evalIn(window, "questionLockedMessage(0,1)"), /at least one team/);
  });
});
