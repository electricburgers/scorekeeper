// v19.78 — Theme Night game mode: 3 rounds, each Q1-4 then a Q5 bonus wager (caps 5 / 10 / 20),
// a Theme Name event field, and the XLSX / PDF exports carrying both.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("Theme Night mode", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  const setup = (theme) =>
    evalIn(
      window,
      `gameState = freshState();
       gameState.meta.mode = ${theme ? '"theme"' : '"regular"'};
       gameState.meta.location = "Test Tap"; gameState.meta.quizId = "AB-123"; gameState.meta.hostName = "Host";
       gameState.meta.themeName = "80s Night";
       gameState.teams = ["Alpha", "Bravo"].map(freshTeam);
       gameState.teams.forEach(t => t.scoreGuess = 50);
       renderAll();`,
    );

  it("Regular mode is unchanged: 4 rounds, no Theme Name field, toggle reads Regular", () => {
    setup(false);
    const d = window.document;
    assert.equal(d.querySelectorAll("[id^='sec-r']").length, 4);
    assert.ok(!d.querySelector("input[aria-label='Theme Name']"));
    assert.equal(d.getElementById("gameModeToggle").textContent, "Regular");
    assert.ok(d.getElementById("bqblock-0"));
  });

  it("Theme mode shows 3 rounds, each closed by a Q5 wager, plus a Theme Name field", () => {
    setup(true);
    const d = window.document;
    assert.equal(d.querySelectorAll("[id^='sec-r']").length, 3);
    assert.ok(d.querySelector("input[aria-label='Theme Name']"));
    assert.equal(d.getElementById("gameModeToggle").textContent, "Theme Night");
    ["wager1", "halftime", "final"].forEach((t) => assert.ok(d.getElementById("swblock-" + t), t));
    assert.ok(!d.getElementById("bqblock-0"), "no 4-part bonus in Theme Night");
    assert.match(d.getElementById("swblock-wager1").textContent, /1-5/);
    assert.match(d.getElementById("swblock-halftime").textContent, /1-10/);
    assert.match(d.getElementById("swblock-final").textContent, /1-20/);
  });

  it("wagers score win/lose and cap at 5 / 10 / 20; progress counts them", () => {
    setup(true);
    evalIn(
      window,
      `setW1(0, 9); setC1(0, true);   // capped to 5, +5
       setHW(0, 99); setHC(0, false); // capped to 10, -10
       setFW(0, 7); setFC(0, true);   // +7`,
    );
    assert.equal(evalIn(window, "gameState.wager1[0].wager"), 5);
    assert.equal(evalIn(window, "grandTotal(0)"), 5 - 10 + 7);
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(roundProgress(0))")), { done: 1, total: 2 * 5 });
    assert.equal(evalIn(window, "preWagerTotal(0,'halftime')"), 5);
  });

  it("toggleGameMode flips the mode and keeps scores; new game keeps the mode", async () => {
    setup(false);
    await evalIn(window, "toggleGameMode()");
    assert.equal(evalIn(window, "gameState.meta.mode"), "theme");
    evalIn(window, "startNewGame()");
    assert.equal(evalIn(window, "gameState.meta.mode"), "theme");
    await evalIn(window, "toggleGameMode()");
    assert.equal(evalIn(window, "gameState.meta.mode"), "regular");
  });

  it("migrateState defaults old games to regular with empty wager1/themeName", () => {
    const r = JSON.parse(
      evalIn(window, `JSON.stringify((() => { const s = migrateState({ meta: {}, teams: [] }); return [s.meta.mode, s.meta.themeName, s.wager1]; })())`),
    );
    assert.deepEqual(r, ["regular", "", {}]);
  });

  it("XLSX carries the theme name and the Q5 wagers; PDF builds", async () => {
    setup(true);
    evalIn(window, "setW1(0, 3); setC1(0, true); setHW(0, 4); setHC(0, false); setFW(0, 6); setFC(0, true);");
    await evalIn(window, "exportXLSXBackup()");
    const sheet = evalIn(
      window,
      `(function () {
        const blob = [...window.__mockBlobUrls.values()].filter((b) => b.type.includes("spreadsheetml")).pop();
        return new TextDecoder().decode(fflate.unzipSync(blob.parts[0])["xl/worksheets/sheet1.xml"]);
      })()`,
    );
    assert.match(sheet, /THEME: 80s Night/);
    assert.match(sheet, /<c r="J5"[^>]*><v>3<\/v>/);
    assert.match(sheet, /<c r="Q5"[^>]*><v>-4<\/v>/);
    assert.match(sheet, /<c r="Y5"[^>]*><v>6<\/v>/);
    await assert.doesNotReject(() => evalIn(window, "exportPDF()"));
  });
});
