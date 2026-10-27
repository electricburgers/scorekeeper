// v20.10 — guess bounds (1-95 Theme Night, 1-146 Regular) and the PDF Standings changes.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("guess entry bounds", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  const tryGuess = (mode, v) =>
    evalIn(
      window,
      `(function () {
        window.appAlert = () => {};
        gameState = freshState(); gameState.meta.mode = ${JSON.stringify(mode)};
        gameState.teams = [freshTeam("A")]; gameState.teams[0].scoreGuess = 50;
        const input = { value: ${JSON.stringify(v)} };
        setGuess(0, input);
        return gameState.teams[0].scoreGuess;
      })()`,
    );

  it("accepts values in range and rejects 0, negatives, decimals and too-high values", () => {
    assert.equal(tryGuess("theme", "95"), 95);
    assert.equal(tryGuess("theme", "1"), 1);
    assert.equal(tryGuess("theme", "96"), 50);
    assert.equal(tryGuess("regular", "146"), 146);
    assert.equal(tryGuess("regular", "147"), 50);
    assert.equal(tryGuess("regular", "0"), 50);
    assert.equal(tryGuess("regular", "-5"), 50);
    assert.equal(tryGuess("regular", "7.5"), 50);
    assert.equal(tryGuess("regular", ""), "");
  });
});
