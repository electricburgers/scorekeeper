// v21.0 — Name That Tune game mode (4 rounds, Regular's wager sets, a Q5 wager closing every round
// capped 5 / 10 / 15 / 20, perfect score 126), the Game Mode dropdown, and the "changing modes
// wipes the board" rule.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const TEAMS = `gameState.teams = ["Alpha", "Bravo"].map(freshTeam); gameState.teams.forEach(t => t.scoreGuess = 50);`;
const EVENT = `gameState.meta.location = "Test Tap"; gameState.meta.quizId = "AB-123"; gameState.meta.hostName = "Host";`;
const tune = `gameState = freshState(); gameState.meta.mode = "tune"; ${EVENT} ${TEAMS} renderAll();`;
const j = (w, code) => JSON.parse(evalIn(w, `JSON.stringify(${code})`));

describe("Name That Tune: scoring model", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("names, helpers and per-mode limits", () => {
    evalIn(window, tune);
    assert.equal(evalIn(window, "isTune()"), true);
    assert.equal(evalIn(window, "isTheme()"), false);
    assert.equal(evalIn(window, "hasQ5Wagers()"), true);
    assert.equal(evalIn(window, "roundCount()"), 4);
    assert.equal(evalIn(window, "hasBonusQ(0) || hasBonusQ(2)"), false);
    assert.deepEqual(j(window, "[0,1,2,3].map(roundWagers)"), [[1, 2, 3, 4], [1, 3, 5, 7], [2, 4, 6, 8], [3, 6, 9, 12]]);
    assert.deepEqual(j(window, "[0,1,2,3].map(roundWagerType)"), ["wager1", "halftime", "wager3", "final"]);
    assert.deepEqual(j(window, "['wager1','halftime','wager3','final'].map(wagerMax)"), [5, 10, 15, 20]);
    assert.equal(evalIn(window, "guessLimit()"), 126);
    assert.equal(evalIn(window, "gameModeName()"), "Name That Tune");
    evalIn(window, 'gameState.meta.mode = "theme"');
    assert.equal(evalIn(window, "guessLimit()"), 95);
    assert.equal(evalIn(window, "gameModeName()"), "Theme Night");
    evalIn(window, 'gameState.meta.mode = "regular"');
    assert.equal(evalIn(window, "guessLimit()"), 146);
    assert.equal(evalIn(window, "gameModeName()"), "Regular Trivia");
    assert.deepEqual(j(window, "[0,1,2,3].map(roundWagerType)"), [null, "halftime", null, "final"]);
  });

  it("round titles name what the team must identify", () => {
    evalIn(window, tune);
    assert.deepEqual(j(window, "[0,1,2,3].map(roundTitle)"), [
      "Round 1 - Song Title",
      "Round 2 - Artist",
      "Round 3 - Song Title",
      "Round 4 - Song Title & Artist",
    ]);
    evalIn(window, 'gameState.meta.mode = "regular"');
    assert.deepEqual(j(window, "[0,1,2,3].map(roundTitle)"), ["Round 1", "Round 2", "Round 3", "Round 4"]);
  });

  it("a perfect night is 126: 76 of question points + wagers 5 + 10 + 15 + 20", () => {
    evalIn(window, tune);
    evalIn(
      window,
      `[0,1,2,3].forEach(ri => roundWagers(ri).forEach((w, qi) => { gameState.rounds[ri].questions[qi][0] = { wager: w, correct: true }; }));
       setW1(0, 5); setC1(0, true); setHW(0, 10); setHC(0, true); setW3(0, 15); setC3(0, true); setFW(0, 20); setFC(0, true);`,
    );
    assert.equal(evalIn(window, "grandTotal(0)"), 126);
  });

  it("wagers win/lose, clamp to 5/10/15/20, and each round's progress counts its wager", () => {
    evalIn(window, tune);
    evalIn(window, "setW1(0, 9); setC1(0, false); setHW(0, 99); setHC(0, true); setW3(0, 99); setC3(0, false); setFW(0, 99); setFC(0, true);");
    assert.equal(evalIn(window, "gameState.wager1[0].wager"), 5);
    assert.equal(evalIn(window, "gameState.wager3[0].wager"), 15);
    assert.equal(evalIn(window, "grandTotal(0)"), -5 + 10 - 15 + 20);
    assert.deepEqual(j(window, "[0,1,2,3].map(ri => roundProgress(ri))"), [
      { done: 1, total: 10 },
      { done: 1, total: 10 },
      { done: 1, total: 10 },
      { done: 1, total: 10 },
    ]);
  });

  it("preWagerTotal is the score going INTO each of the four wagers", () => {
    evalIn(window, tune);
    evalIn(
      window,
      `gameState.rounds[0].questions[0][0] = { wager: 4, correct: true };
       gameState.rounds[1].questions[0][0] = { wager: 7, correct: true };
       gameState.rounds[2].questions[0][0] = { wager: 8, correct: true };
       gameState.rounds[3].questions[0][0] = { wager: 12, correct: true };
       setW1(0, 5); setC1(0, true); setHW(0, 10); setHC(0, false); setW3(0, 15); setC3(0, true);`,
    );
    assert.deepEqual(j(window, "['wager1','halftime','wager3','final'].map(t => preWagerTotal(0, t))"), [4, 4 + 5 + 7, 4 + 5 + 7 - 10 + 8, 4 + 5 + 7 - 10 + 8 + 15 + 12]);
  });

  it("the new wager3 store survives migrate / reindex / checkGameStarted", () => {
    assert.deepEqual(j(window, "migrateState({ meta: {}, teams: [] }).wager3"), {});
    assert.equal(j(window, "migrateState({ meta: { mode: 'tune' }, teams: [] }).meta.mode"), "tune");
    assert.equal(j(window, "migrateState({ meta: { mode: 'bogus' }, teams: [] }).meta.mode"), "regular");
    evalIn(window, tune);
    evalIn(window, "gameState.wager3[0] = { wager: 3 }; gameState.gameStarted = false;");
    assert.equal(evalIn(window, "checkGameStarted()"), true);
  });
});

describe("Name That Tune: rendering", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, tune);
  });
  after(() => window.close());

  it("four rounds, each headed with what to name and closed by a Q5 wager; no 4-part bonus", () => {
    const d = window.document;
    assert.equal(d.querySelectorAll("[id^='sec-r']").length, 4);
    const heads = [...d.querySelectorAll("[id^='sec-r'] > .section-header h2 > span:first-child")].map((s) => s.textContent);
    assert.deepEqual(heads, ["Round 1 - Song Title", "Round 2 - Artist", "Round 3 - Song Title", "Round 4 - Song Title & Artist"]);
    ["wager1", "halftime", "wager3", "final"].forEach((t) => assert.ok(d.getElementById("swblock-" + t), t));
    assert.ok(!d.getElementById("bqblock-0") && !d.getElementById("bqblock-2"));
    [["wager1", "1-5"], ["halftime", "1-10"], ["wager3", "1-15"], ["final", "1-20"]].forEach(([t, r]) =>
      assert.match(d.getElementById("swblock-" + t).textContent, new RegExp(r)),
    );
    assert.ok(d.getElementById("standings-wager3"), "score block before the Round 3 wager");
    assert.match(d.getElementById("standings-wager1").textContent, /Before Round 1 Wager/);
    assert.match(d.getElementById("standings-halftime").textContent, /Before Round 2 Wager/);
    assert.match(d.getElementById("standings-wager3").textContent, /Before Round 3 Wager/);
    assert.match(d.getElementById("standings-final").textContent, /Before Round 4 Wager/);
  });

  it("Event Details heading, no Theme Name field, guess input capped at 126", () => {
    const d = window.document;
    assert.equal(d.querySelector("#sec-meta h2").textContent, "Event Details - Name That Tune");
    assert.ok(!d.querySelector("input[aria-label='Theme Name']"));
    const g = d.querySelector(".team-guess-cell input");
    assert.equal(g.max, "126");
    assert.match(g.placeholder, /1-126/);
  });

  it("Q5 wager rows score through the setters for all four rounds", () => {
    const d = window.document;
    evalIn(window, "setW3(1, 6); setC3(1, true)");
    assert.equal(evalIn(window, "grandTotal(1)"), 6);
    assert.ok(d.querySelector("#swblock-wager3 .pts-pos"));
  });

  it("guess entry rejects 0, negatives, decimals and values over 126", () => {
    window.appAlert = () => {};
    const tryGuess = (v) =>
      evalIn(window, `(function(){ gameState.teams[0].scoreGuess = 50; const i = { value: ${JSON.stringify(v)} }; setGuess(0, i); return gameState.teams[0].scoreGuess; })()`);
    assert.equal(tryGuess("126"), 126);
    assert.equal(tryGuess("1"), 1);
    assert.equal(tryGuess("127"), 50);
    assert.equal(tryGuess("0"), 50);
    assert.equal(tryGuess("-3"), 50);
    assert.equal(tryGuess("9.5"), 50);
  });

  it("the team report lists four round blocks, each with its wager", () => {
    evalIn(window, "setW1(0, 2); setC1(0, true); setHW(0, 3); setHC(0, true); setW3(0, 4); setC3(0, true); setFW(0, 5); setFC(0, false); renderAll();");
    const html = evalIn(window, "buildAudit(0)");
    ["Round 1 Wager", "Round 2 Wager", "Round 3 Wager", "Round 4 Wager"].forEach((s) => assert.match(html, new RegExp(s)));
    assert.match(html, /1–15/);
    assert.match(html, /Round 2 - Artist/);
  });
});

describe("Game Mode dropdown", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("is a select with Regular, Theme Night and Name That Tune; the old toggle button is gone", () => {
    const d = window.document;
    const sel = d.getElementById("gameModeSelect");
    assert.equal(sel.tagName, "SELECT");
    assert.deepEqual([...sel.options].map((o) => [o.value, o.textContent]), [
      ["regular", "Regular Trivia"],
      ["theme", "Theme Night"],
      ["tune", "Name That Tune"],
    ]);
    assert.ok(sel.getAttribute("aria-label") || d.querySelector("label[for='gameModeSelect']"));
    assert.ok(!d.getElementById("gameModeToggle"));
  });

  it("the select and its pictograph follow the mode; emoji style swaps in 🎯 / 🎭 / 🎵", () => {
    const d = window.document;
    const icon = () => d.getElementById("gameModeIcon");
    evalIn(window, 'gameState = freshState(); renderAll();');
    assert.equal(d.getElementById("gameModeSelect").value, "regular");
    assert.ok(icon().querySelector("svg.icon-mode-regular"));
    evalIn(window, 'gameState.meta.mode = "theme"; renderAll();');
    assert.equal(d.getElementById("gameModeSelect").value, "theme");
    assert.ok(icon().querySelector("svg.icon-mode-theme"));
    evalIn(window, 'gameState.meta.mode = "tune"; renderAll();');
    assert.equal(d.getElementById("gameModeSelect").value, "tune");
    assert.ok(icon().querySelector("svg.icon-mode-tune"));
    assert.equal(icon().getAttribute("aria-hidden"), "true");
    evalIn(window, 'setIconStyle("emoji")');
    const opt = (v) => d.querySelector('#gameModeSelect option[value="' + v + '"]').textContent;
    assert.match(opt("tune"), /🎵/);
    assert.match(opt("regular"), /🎯/);
    assert.equal(icon().textContent, "");
    evalIn(window, 'gameState.meta.mode = "theme"; renderAll();');
    assert.match(opt("theme"), /🎭/);
    evalIn(window, 'gameState.meta.mode = "regular"; renderAll();');
    assert.equal(icon().textContent, "");
    evalIn(window, 'setIconStyle("pictograph")');
  });

  const board = `gameState = freshState(); gameState.meta.mode = "regular"; ${EVENT} gameState.meta.date = "2026-01-02"; ${TEAMS}
    gameState.teams[0].njcb = true; gameState.teams[0].bonusItem = true;
    gameState.rounds[0].questions[0][0] = { wager: 4, correct: true }; gameState.rounds[0].bonus[0] = 3;
    setHW(0, 5); setHC(0, true); gameState.craftPrizeWinner = 1; gameState.gameStarted = true; renderAll();`;

  it("changing modes with data present asks first; Cancel changes nothing", async () => {
    let asked = "";
    window.appConfirm = async (msg) => ((asked = msg), false);
    evalIn(window, board);
    const changed = await evalIn(window, 'setGameMode("tune")');
    assert.equal(changed, false);
    assert.match(asked, /Regular Trivia/);
    assert.match(asked, /Name That Tune/);
    assert.match(asked, /erase|wipe|clear/i);
    assert.equal(evalIn(window, "gameState.meta.mode"), "regular");
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0].wager"), 4);
    assert.equal(window.document.getElementById("gameModeSelect").value, "regular", "select snaps back");
  });

  it("confirming wipes scores, wagers, guesses and extras but keeps event details and team names", async () => {
    window.appConfirm = async () => true;
    evalIn(window, board);
    assert.equal(await evalIn(window, 'setGameMode("tune")'), true);
    const s = j(window, "gameState");
    assert.equal(s.meta.mode, "tune");
    assert.equal(s.meta.location, "Test Tap");
    assert.equal(s.meta.quizId, "AB-123");
    assert.equal(s.meta.date, "2026-01-02");
    assert.deepEqual(s.teams.map((t) => t.name), ["Alpha", "Bravo"]);
    assert.ok(s.teams.every((t) => t.scoreGuess === "" && !t.njcb && !t.bonusItem && !t.adjustment));
    assert.ok(s.rounds.every((r) => r.questions.every((q) => Object.keys(q).length === 0) && Object.keys(r.bonus).length === 0));
    ["halftime", "finalWager", "wager1", "wager3"].forEach((k) => assert.deepEqual(s[k], {}, k));
    assert.equal(s.gameStarted, false);
    assert.equal(s.craftPrizeWinner, null);
    assert.equal(evalIn(window, "grandTotal(0)"), 0);
    assert.equal(window.document.getElementById("gameModeSelect").value, "tune");
  });

  it("with no scoring data it switches silently (still resetting mode-specific fields)", async () => {
    let asked = false;
    window.appConfirm = async () => ((asked = true), true);
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; gameState.meta.themeName = "Simpsons"; renderAll();');
    assert.equal(await evalIn(window, 'setGameMode("regular")'), true);
    assert.equal(asked, false);
    assert.equal(evalIn(window, "gameState.meta.themeName"), "");
    assert.equal(await evalIn(window, 'setGameMode("regular")'), false, "same mode is a no-op");
  });

  it("every direction wipes (theme -> tune, tune -> regular)", async () => {
    window.appConfirm = async () => true;
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "theme"; gameState.meta.themeName = "X"; ' + TEAMS + " setW1(0, 3); setC1(0, true); gameState.gameStarted = true; renderAll();");
    await evalIn(window, 'setGameMode("tune")');
    assert.deepEqual(j(window, "gameState.wager1"), {});
    assert.equal(evalIn(window, "gameState.meta.themeName"), "");
    evalIn(window, "setW3(0, 3); setC3(0, true); gameState.gameStarted = true;");
    await evalIn(window, 'setGameMode("regular")');
    assert.deepEqual(j(window, "gameState.wager3"), {});
    assert.equal(evalIn(window, "grandTotal(0)"), 0);
  });

  it("the next game keeps Name That Tune; Clear Session names it", () => {
    evalIn(window, tune);
    evalIn(window, "startNewGame()");
    assert.equal(evalIn(window, "gameState.meta.mode"), "tune");
  });
});

describe("Name That Tune: exports", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, tune);
    evalIn(
      window,
      `gameState.meta.date = "2026-03-04";
       [0,1,2,3].forEach(ri => roundWagers(ri).forEach((w, qi) => { gameState.rounds[ri].questions[qi][0] = { wager: w, correct: true }; }));
       setW1(0, 5); setC1(0, true); setHW(0, 4); setHC(0, false); setW3(0, 12); setC3(0, true); setFW(0, 20); setFC(0, true);`,
    );
  });
  after(() => window.close());

  const sheet = async () => {
    await evalIn(window, "exportXLSXBackup()");
    return evalIn(
      window,
      `(function () {
        const blob = [...window.__mockBlobUrls.values()].filter((b) => b.type.includes("spreadsheetml")).pop();
        return new TextDecoder().decode(fflate.unzipSync(blob.parts[0])["xl/worksheets/sheet1.xml"]);
      })()`,
    );
  };

  it("XLSX: all four Q5 wagers in J / Q / Y / AF, caps 5-10-15-20, round bands name the task, Final = grand total", async () => {
    const x = await sheet();
    assert.match(x, /<c r="J5"[^>]*><v>5<\/v>/);
    assert.match(x, /<c r="Q5"[^>]*><v>-4<\/v>/);
    assert.match(x, /<c r="Y5"[^>]*><v>12<\/v>/);
    assert.match(x, /<c r="AF5"[^>]*><v>20<\/v>/);
    assert.match(x, /<c r="I5"[^>]*><v>5<\/v>/, "R1 cap");
    assert.match(x, /<c r="X5"[^>]*><v>15<\/v>/, "R3 cap");
    assert.match(x, /<c r="I4"[^>]*><is><t[^>]*>Wager 1-5</);
    assert.match(x, /<c r="Q4"[^>]*><is><t[^>]*>Wager 1-10</);
    assert.match(x, /<c r="X4"[^>]*><is><t[^>]*>Wager 1-15</);
    assert.match(x, /<c r="AF4"[^>]*><is><t[^>]*>Wager 1-20</);
    assert.match(x, /<c r="E3"[^>]*><is><t[^>]*>Round 1 - Song Title</);
    assert.match(x, /<c r="L3"[^>]*><is><t[^>]*>Round 2 - Artist</);
    assert.match(x, /<c r="T3"[^>]*><is><t[^>]*>Round 3 - Song Title</);
    assert.match(x, /<c r="AA3"[^>]*><is><t[^>]*>Round 4 - Song Title &amp; Artist</);
    assert.match(x, /NAME THAT TUNE/);
    // Regular wager columns are untouched: Round 4 Q4 (12) lands in AD, Round 2 Q4 (7) in O.
    assert.match(x, /<c r="AD5"[^>]*><v>12<\/v>/);
    assert.match(x, /<c r="O5"[^>]*><v>7<\/v>/);
    assert.doesNotMatch(x, /<col min="27" max="31"[^>]*hidden="1"/, "Round 4 stays visible");
    // 76 + 5 - 4 + 12 + 20 = 109 (Round 2 wager lost)
    assert.match(x, /<c r="AG5"[^>]*>(<f[^>]*>[^<]*<\/f>)?<v>109<\/v>/);
  });

  it("PDF: mode-named Standings title, a Sub before every wager, round bands name the task", async () => {
    await evalIn(window, "exportPDF()");
    const pdf = evalIn(
      window,
      `(function(){const b=[...window.__mockBlobUrls.values()].filter(b=>b.type.includes("pdf")).pop(); return new TextDecoder("latin1").decode(b.parts[0]);})()`,
    );
    assert.match(pdf, /\(STANDINGS - NAME THAT TUNE\)/);
    ["Round 1 - Song Title", "Round 2 - Artist", "Round 3 - Song Title", "Round 4 - Song Title & Artist"].forEach((s) =>
      assert.ok(pdf.includes(s), s),
    );
    assert.match(pdf, /\(W 1-5\)/);
    assert.match(pdf, /\(W 1-15\)/);
    assert.match(pdf, /\(W 1-20\)/);
    assert.match(pdf, /\(NAME THAT TUNE\)|\(Name That Tune\)/, "header names the game");
    assert.equal((pdf.match(/\(Sub\)/g) || []).length, 4, "Sub column in all four rounds");
  });
});

describe("Name That Tune: Try Example", () => {
  it("loads the same teams, scaled so the highest guess is 126 and totals stay legal", async () => {
    const window = await loadAppWindow();
    window.appConfirm = async () => true;
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "tune"; renderAll();');
    let prompt = "";
    window.appConfirm = async (m) => ((prompt = m), true);
    await evalIn(window, "loadSampleGame()");
    assert.match(prompt, /Name That Tune/);
    assert.equal(evalIn(window, "gameState.meta.mode"), "tune");
    assert.equal(evalIn(window, "gameState.teams.length"), 11);
    assert.equal(evalIn(window, "gameState.teams[0].name"), "Parliamentary Procedure");
    assert.equal(evalIn(window, "Math.max(...gameState.teams.map(t => t.scoreGuess))"), 126);
    assert.ok(evalIn(window, "new Set(gameState.teams.map(t => t.scoreGuess)).size") > 5);
    assert.ok(evalIn(window, "gameState.teams.every((_, i) => grandTotal(i) - ((gameState.teams[i].njcb?3:0)+(gameState.teams[i].bonusItem?5:0)) <= 126)"));
    // Regular wagers kept; all four Q5 wagers filled in within caps; no 4-part bonus counts.
    assert.ok(evalIn(window, "Object.keys(gameState.wager1).length") === 11);
    assert.ok(evalIn(window, "Object.keys(gameState.wager3).length") === 11);
    assert.ok(evalIn(window, "Object.values(gameState.wager1).every(w => w.wager >= 1 && w.wager <= 5)"));
    assert.ok(evalIn(window, "Object.values(gameState.wager3).every(w => w.wager >= 1 && w.wager <= 15)"));
    assert.ok(evalIn(window, "gameState.rounds.every(r => Object.keys(r.bonus).length === 0)"));
    assert.equal(window.document.querySelectorAll("[id^='sec-r']").length, 4);
    window.close();
  });
});

describe("Name That Tune: prompts name the mode", () => {
  it("Take the Tour, Clear Session, and the Resume banner say Name That Tune", async () => {
    const window = await loadAppWindow();
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "tune"; renderAll();');
    const src = evalIn(window, "[confirmClearSession, startTutorial].map(f => f.toString()).join('\\n')");
    assert.match(src, /gameModeName\(\)/);
    const banner = evalIn(window, `(function(){ return resumeBannerText({ meta: { mode: "tune", date: "2026-01-01", location: "Bar" } }); })()`);
    assert.match(banner, /Name That Tune/);
    window.close();
  });
});

describe("Name That Tune tutorial walkthrough", () => {
  let window;
  let jsErrors;
  let seen;
  let stoppedNaturally;
  before(async () => {
    window = await loadAppWindow();
    jsErrors = [];
    window.addEventListener("error", (e) => jsErrors.push((e.error && e.error.message) || e.message));
    evalIn(window, 'gameState = freshState(); gameState.meta.mode = "tune"; renderAll();');
    await evalIn(window, "loadTutorialLib()");
    await evalIn(window, "Tutorial.start()");
    seen = [];
    let i = 0;
    for (; i < 80; i++) {
      const callout = window.document.querySelector(".tutorial-callout");
      if (!callout) break;
      seen.push(callout.textContent);
      evalIn(window, 'gameState.meta.quizId = "TEST-001"; gameState.meta.hostName = "Test Host";');
      evalIn(window, "Tutorial.next()");
      await new Promise((r) => setTimeout(r, 250));
    }
    stoppedNaturally = i < 80;
  });
  after(() => window.close());

  it("finishes without errors, still in Name That Tune, with the 1-126 guess range", () => {
    assert.equal(stoppedNaturally, true);
    assert.deepEqual(jsErrors, []);
    assert.equal(evalIn(window, "gameState.meta.mode"), "tune");
    assert.ok(seen.some((t) => /1-126/.test(t)));
    assert.ok(!seen.some((t) => /Theme Name/.test(t)));
  });
  it("walks all four rounds and all four Q5 wagers", () => {
    ["wager1", "halftime", "wager3", "finalWager"].forEach((k) =>
      assert.ok(evalIn(window, `Object.keys(gameState.${k}).length`) > 1, k),
    );
    assert.equal(evalIn(window, "document.querySelectorAll('[id^=\"sec-r\"]').length"), 4);
    assert.ok(seen.some((t) => /Round 3/.test(t) && /wager/i.test(t)));
    assert.ok(!seen.some((t) => /Beer Round bonus|four-part|4-part/i.test(t)));
  });
});
