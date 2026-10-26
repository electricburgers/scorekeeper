// v20.0 — Theme Night game mode: 3 rounds, each Q1-4 then a Q5 bonus wager (caps 5 / 10 / 20),
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
    assert.match(d.getElementById("gameModeToggle").textContent, /Regular/);
    assert.ok(d.getElementById("bqblock-0"));
  });

  it("Theme mode shows 3 rounds, each closed by a Q5 wager, plus a Theme Name field", () => {
    setup(true);
    const d = window.document;
    assert.equal(d.querySelectorAll("[id^='sec-r']").length, 3);
    assert.ok(d.querySelector("input[aria-label='Theme Name']"));
    assert.match(d.getElementById("gameModeToggle").textContent, /Theme Night/);
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
    assert.equal(evalIn(window, "preWagerTotal(0,'wager1')"), 0);
    assert.ok(window.document.getElementById("standings-wager1"), "score block before the Round 1 wager");
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

describe("Theme Night: heading, icons, Try Example", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("heading and Theme Name field order follow the mode", () => {
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; renderAll();');
    const d = window.document;
    assert.equal(d.querySelector("#sec-meta h2").textContent, "Event Details - Theme Night");
    const labels = [...d.querySelectorAll("#sec-meta .meta-grid .field label")].map((l) => l.textContent);
    assert.ok(labels.indexOf("Theme Name") < labels.indexOf("Quiz ID"));
    assert.ok(labels.indexOf("Theme Name") > labels.indexOf("Date"));
    evalIn(window, 'gameState.meta.mode = "regular"; renderAll();');
    assert.equal(d.querySelector("#sec-meta h2").textContent, "Event Details");
  });

  it("Game Mode button has a pictograph, and an emoji in Emoji icon style", () => {
    const d = window.document;
    assert.ok(d.querySelector("#gameModeToggle svg.icon-mode-regular"));
    evalIn(window, 'setIconStyle("emoji")');
    assert.match(d.getElementById("gameModeToggle").textContent, /🎯/);
    evalIn(window, 'gameState.meta.mode = "theme"; renderAll();');
    assert.match(d.getElementById("gameModeToggle").textContent, /🎭/);
    evalIn(window, 'setIconStyle("pictograph")');
    assert.ok(d.querySelector("#gameModeToggle svg.icon-mode-theme"));
  });

  it("Try Example in Theme Night loads the same teams as a Simpsons theme night", async () => {
    window.appConfirm = async () => true;
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; renderAll();');
    await evalIn(window, "loadSampleGame()");
    const r = JSON.parse(
      evalIn(window, `JSON.stringify({ mode: gameState.meta.mode, theme: gameState.meta.themeName, n: gameState.teams.length, first: gameState.teams[0].name, r4: grandTotal(0) === (roundSub(0,0)+roundSub(0,1)+roundSub(0,2)+htPts(0)+fwPts(0)+w1Pts(0)+5+3) })`),
    );
    assert.equal(r.mode, "theme");
    assert.equal(r.theme, "The Simpsons");
    assert.equal(r.n, 11);
    assert.equal(r.first, "Parliamentary Procedure");
    assert.ok(evalIn(window, "gameState.rounds[1].questions.every(q => Object.values(q).every(a => [2,4,6,8].includes(a.wager)))"), "R2 wagers on theme budget");
    assert.ok(evalIn(window, "gameState.rounds[2].questions.every(q => Object.values(q).every(a => [3,6,9,12].includes(a.wager)))"), "R3 wagers on theme budget");
    assert.equal(evalIn(window, "Math.max(...gameState.teams.map(t => t.scoreGuess))"), 95);
    assert.ok(evalIn(window, "new Set(gameState.teams.map(t => t.scoreGuess)).size") > 5, "guesses are scaled, not all clamped to 95");
    assert.ok(r.r4);
    assert.equal(window.document.querySelectorAll("[id^='sec-r']").length, 3);
    // Regular Try Example is unchanged
    evalIn(window, 'gameState.meta.mode = "regular"; renderAll();');
    await evalIn(window, "loadSampleGame()");
    assert.equal(evalIn(window, "gameState.meta.mode"), "regular");
    assert.equal(evalIn(window, "gameState.meta.themeName"), "");
  });
});

describe("Theme Name gates scoring in Theme Night", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("canScore blocks without a Theme Name, passes once entered; Regular is unaffected", () => {
    const base = `gameState = freshState(); gameState.meta.quizId="AB-123"; gameState.meta.hostName="Host"; gameState.meta.location="Test Tap";
      gameState.teams=[freshTeam("A")]; gameState.teams[0].scoreGuess=40;`;
    evalIn(window, base + 'gameState.meta.mode="theme"; renderAll();');
    assert.equal(evalIn(window, "canScore()"), false);
    assert.ok(window.document.querySelector("#sec-meta .field-invalid input[aria-label='Theme Name']"));
    evalIn(window, 'gameState.meta.themeName="Star Wars"');
    assert.equal(evalIn(window, "canScore()"), true);
    evalIn(window, base + "renderAll();");
    assert.equal(evalIn(window, "canScore()"), true);
  });
});

describe("Theme Name length cap", () => {
  it("input maxlength is 40 and loaded games are clamped", async () => {
    const window = await loadAppWindow();
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; renderAll();');
    assert.equal(window.document.querySelector("input[aria-label='Theme Name']").maxLength, 40);
    const len = evalIn(window, 'migrateState({ meta: { themeName: "x".repeat(99) }, teams: [] }).meta.themeName.length');
    assert.equal(len, 40);
    window.close();
  });
});
