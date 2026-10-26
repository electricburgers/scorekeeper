// v19.81 — Theme Night tour, Theme Night point budgets, and the O(n) scoring pass.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("Theme Night point budgets", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("budgets are 10 + 20 + 30 and wagers 5 + 10 + 20: a perfect night is 95 before CB/Bonus", () => {
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme";');
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const budgets = JSON.parse(evalIn(window, "JSON.stringify([0,1,2].map(ri => roundWagers(ri)))"));
    assert.deepEqual(budgets, [[1, 2, 3, 4], [2, 4, 6, 8], [3, 6, 9, 12]]);
    const total = budgets.reduce((t, b) => t + sum(b), 0) + 5 + 10 + 20;
    assert.equal(total, 95);
    evalIn(window, 'gameState.meta.mode = "regular"');
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(roundWagers(1))")), [1, 3, 5, 7]);
  });

  it("a perfect Theme Night scores 95 and the XLSX uses the new budget columns", async () => {
    evalIn(
      window,
      `gameState = freshState(); gameState.meta.mode = "theme"; gameState.meta.themeName = "T";
       gameState.meta.quizId = "A-1"; gameState.meta.hostName = "H"; gameState.meta.location = "L";
       gameState.teams = [freshTeam("A")]; gameState.teams[0].scoreGuess = 95;
       [0,1,2].forEach(ri => roundWagers(ri).forEach((w, qi) => { gameState.rounds[ri].questions[qi][0] = { wager: w, correct: true }; }));
       setW1(0,5); setC1(0,true); setHW(0,10); setHC(0,true); setFW(0,20); setFC(0,true); renderAll();`,
    );
    assert.equal(evalIn(window, "grandTotal(0)"), 95);
    await evalIn(window, "exportXLSXBackup()");
    const sheet = evalIn(
      window,
      `(function () {
        const blob = [...window.__mockBlobUrls.values()].filter((b) => b.type.includes("spreadsheetml")).pop();
        return new TextDecoder().decode(fflate.unzipSync(blob.parts[0])["xl/worksheets/sheet1.xml"]);
      })()`,
    );
    // Round 2 Q1 (wager 2) lands in column L, Round 3 Q4 (wager 12) in column W; AG = grand total.
    assert.match(sheet, /<c r="L5"[^>]*><v>2<\/v>/);
    assert.match(sheet, /<c r="W5"[^>]*><v>12<\/v>/);
    assert.match(sheet, /<c r="AG5"[^>]*>(<f[^>]*>[^<]*<\/f>)?<v>95<\/v>/);
    await assert.doesNotReject(() => evalIn(window, "exportPDF()"));
  });
});

describe("Theme Night tutorial walkthrough", () => {
  let window;
  let jsErrors;
  let seen;
  let stoppedNaturally;
  before(async () => {
    window = await loadAppWindow();
    jsErrors = [];
    window.addEventListener("error", (e) => jsErrors.push((e.error && e.error.message) || e.message));
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; renderAll();');
    await evalIn(window, "loadTutorialLib()");
    await evalIn(window, "Tutorial.start()");
    seen = [];
    let i = 0;
    for (; i < 60; i++) {
      const callout = window.document.querySelector(".tutorial-callout");
      if (!callout) break;
      seen.push(callout.textContent);
      // Mirrors what the host types for real: the three required Event Details fields.
      evalIn(window, 'gameState.meta.quizId = "TEST-001"; gameState.meta.hostName = "Test Host"; gameState.meta.themeName = "Simpsons";');
      evalIn(window, "Tutorial.next()");
      await new Promise((r) => setTimeout(r, 250));
    }
    stoppedNaturally = i < 60;
  });
  after(() => window.close());

  it("finishes without errors, still in Theme Night", () => {
    assert.equal(stoppedNaturally, true);
    assert.deepEqual(jsErrors, []);
    assert.equal(evalIn(window, "gameState.meta.mode"), "theme");
  });
  it("asks for a Theme Name and uses the 1-95 guess range; never mentions Round 4", () => {
    assert.ok(seen.some((t) => /Theme Name/.test(t)));
    assert.ok(seen.some((t) => /1-95/.test(t)));
    assert.ok(!seen.some((t) => /Round 4/.test(t)));
  });
  it("scores three rounds, each closed by a Q5 wager, and leaves Round 4 empty", () => {
    assert.ok(evalIn(window, "Object.keys(gameState.wager1).length") > 1);
    assert.ok(evalIn(window, "Object.keys(gameState.halftime).length") > 1);
    assert.ok(evalIn(window, "Object.keys(gameState.finalWager).length") > 1);
    assert.equal(evalIn(window, "Object.keys(gameState.rounds[3].questions[0]).length"), 0);
    assert.equal(evalIn(window, "document.querySelectorAll('[id^=\"sec-r\"]').length"), 3);
  });
});
