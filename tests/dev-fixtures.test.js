// Developer Tools: hidden Advanced Settings group of generated partial-game fixtures.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("Developer Tools fixtures", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("every fixture in every mode builds, loads and renders", () => {
    const n = evalIn(window, `(() => {
      let c = 0;
      for (const m of DEV_MODES) for (const f of DEV_FIXTURES) {
        gameState = devBuildFixture(m, f.key);
        if (gameState.meta.mode !== m) throw new Error("mode " + m + f.key);
        const lim = GUESS_LIMITS[m];
        if (gameState.teams.some((t) => t.scoreGuess !== "" && (t.scoreGuess < 1 || t.scoreGuess > lim))) throw new Error("guess " + m + f.key);
        renderAll(); c++;
      }
      return c;
    })()`);
    assert.equal(n, 44);
  });

  it("lock fixtures leave the intended Q4 / Q5 locked", () => {
    const r = evalIn(window, `JSON.stringify((() => {
      const out = {};
      for (const m of DEV_MODES) {
        gameState = devBuildFixture(m, "r1-mid");
        const t1 = m === "regular" ? null : "wager1";
        out[m + "-r1"] = bonusLocked(0, t1);
        gameState = devBuildFixture(m, "lock-r2");
        out[m + "-r2"] = specialLocked("halftime");
        gameState = devBuildFixture(m, "lock-final");
        out[m + "-final"] = specialLocked("final");
        gameState = devBuildFixture(m, "halftime-pending");
        out[m + "-ht-unlocked"] = !specialLocked("halftime") && Object.keys(gameState.halftime).length === 0;
        gameState = devBuildFixture(m, "before-final");
        out[m + "-bf"] = !specialLocked("final") && Object.keys(gameState.finalWager).length === 0;
      }
      return out;
    })())`);
    for (const [k, v] of Object.entries(JSON.parse(r))) assert.equal(v, true, k);
  });

  it("edge fixtures: ties, paused, no-guess, MAX_TEAMS, craft pool", () => {
    const r = JSON.parse(evalIn(window, `JSON.stringify((() => {
      gameState = devBuildFixture("regular", "edge-ties");
      const tot = gameState.teams.map((_, ti) => grandTotal(ti));
      const o = { tie: tot[0] === tot[1] && tot[2] === tot[3] };
      gameState = devBuildFixture("regular", "edge-paused");
      o.paused = gameState.teams.filter((t) => t.paused).length;
      gameState = devBuildFixture("rivals", "edge-noguess");
      o.noGuess = gameState.teams.filter((t) => t.scoreGuess === "").length;
      gameState = devBuildFixture("tune", "edge-maxteams");
      o.max = gameState.teams.length === MAX_TEAMS;
      gameState = devBuildFixture("theme", "craft-ready");
      o.winner = gameState.craftPrizeWinner; o.pool = craftEligiblePool().length > 0;
      return o;
    })())`));
    assert.deepEqual(r, { tie: true, paused: 2, noGuess: 2, max: true, winner: null, pool: true });
  });

  it("is hidden until the version label is tapped 7 times, then toggles", () => {
    const group = window.document.getElementById("devToolsGroup");
    assert.equal(group.hidden, true);
    const vl = window.document.getElementById("versionLabel");
    for (let i = 0; i < 7; i++) vl.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(group.hidden, false);
    assert.equal(group.querySelectorAll("#devFixtureList button").length, 44);
    for (let i = 0; i < 7; i++) vl.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(group.hidden, true);
  });
});
