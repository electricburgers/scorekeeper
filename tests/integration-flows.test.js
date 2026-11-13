// Integration tests: real click handlers + render pipeline + storage + export against the full
// page in jsdom. Each test drives the app the way the host would and asserts on rendered DOM,
// persisted storage, or produced files — not on a single function's return value.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("integration: scoring flows", () => {
  let w;
  const E = (expr) => evalIn(w, expr);
  const $ = (sel) => w.document.querySelector(sel);
  const $$ = (sel) => Array.from(w.document.querySelectorAll(sel));
  // Started game (bypasses the Event Details gate) with n teams, rendered.
  const start = (n = 3, mode = "regular") => {
    E(`gameState = freshState(); gameState.meta.mode = "${mode}"; gameState.meta.location = "Test Pub";
       gameState.gameStarted = true;
       gameState.teams = [${Array.from({ length: n }, (_, i) => `freshTeam("Team ${String.fromCharCode(65 + i)}")`).join(",")}];
       renderAll();`);
  };
  const scoreOf = (name) => {
    const row = $$(".scores-list .score-row").find((r) => r.querySelector(".sr-name").textContent.includes(name));
    return row && row.querySelector(".sr-score").textContent.trim();
  };
  before(async () => {
    w = await loadAppWindow();
  });
  after(() => w.close());
  beforeEach(() => start());

  it("addTeam adds a row to the sidebar and persists it", () => {
    E("addTeam()");
    assert.equal($$(".scores-list .score-row").length, 4);
    assert.equal(E("loadSaved().teams.length"), 4);
  });
  it("cycleW updates the sidebar total live as a wager is marked correct", () => {
    E("cycleW(1,0,0,5)");
    assert.equal(scoreOf("Team A"), "5");
    assert.equal(scoreOf("Team B"), "0");
  });
  it("cycleW's full cycle: correct → incorrect → cleared, reflected in the sidebar each step", () => {
    E("cycleW(1,0,0,5)");
    assert.equal(scoreOf("Team A"), "5");
    E("cycleW(1,0,0,5)");
    assert.equal(scoreOf("Team A"), "0");
    assert.equal(E("gameState.rounds[1].questions[0][0].correct"), false);
    E("cycleW(1,0,0,5)");
    assert.equal(E("gameState.rounds[1].questions[0][0]"), undefined);
  });
  it("a wager value already spent on another question in the round is refused", () => {
    E("cycleW(1,0,0,5); cycleW(1,1,0,5)");
    assert.equal(E("gameState.rounds[1].questions[1][0]"), undefined);
    assert.equal(scoreOf("Team A"), "5");
  });
  it("markAll(correct) grades every wagered team on a question at once", () => {
    E("for (const t of [0,1]) cycleW(1,0,t,3); markAll(1,0,false)");
    assert.equal(E("gameState.rounds[1].questions[0][0].correct"), false);
    assert.equal(E("gameState.rounds[1].questions[0][1].correct"), false);
    assert.equal(scoreOf("Team A"), "0");
    E("markAll(1,0,true)");
    assert.equal(scoreOf("Team B"), "3");
  });
  it("pausing a team removes its answer row and lets the others still make a Beer Round", () => {
    E("togglePause(2)");
    assert.equal($$("#qblock-0-0 .team-answer").length, 2);
    E("for (const t of [0,1]) cycleW(1,0,t,3)");
    assert.equal(E("isBeerRound(1,0)"), true);
    E("togglePause(2)");
    assert.equal(E("isBeerRound(1,0)"), false);
    assert.equal($$("#qblock-0-0 .team-answer").length, 3);
  });
  it("adjPts changes the total in the sidebar and survives a save/load round-trip", () => {
    E("adjPts(0, 4); adjPts(0, -1)");
    assert.equal(scoreOf("Team A"), "3");
    E("gameState = migrateState(loadSaved()); renderAll()");
    assert.equal(scoreOf("Team A"), "3");
  });
  it("removeTeamAt closes the gap: later teams keep their own scores under the new index", () => {
    E("cycleW(1,0,1,7); cycleW(1,0,2,3); removeTeamAt(0); renderAll()");
    assert.equal($$(".scores-list .score-row").length, 2);
    assert.equal(scoreOf("Team B"), "7");
    assert.equal(scoreOf("Team C"), "3");
  });
  it("sidebar ranks follow score: the leader is badged 1, the next 2", () => {
    E("cycleW(1,0,2,7); cycleW(1,0,0,3)");
    const rank = (name) =>
      $$(".scores-list .score-row")
        .find((r) => r.querySelector(".sr-name").textContent.includes(name))
        .querySelector(".sr-rank").textContent.trim();
    assert.equal(rank("Team C"), "1");
    assert.equal(rank("Team A"), "2");
    assert.equal(rank("Team B"), "3");
  });
  it("setGuess accepts a valid integer and rejects out-of-range input, restoring the old value", () => {
    const input = { value: "40" };
    E(`setGuess(0, ${JSON.stringify(input)})`);
    assert.equal(E("gameState.teams[0].scoreGuess"), 40);
    const bad = w.document.createElement("input");
    bad.value = "999";
    w.setGuess(0, bad);
    assert.equal(E("gameState.teams[0].scoreGuess"), 40);
    assert.equal(bad.value, "40");
  });
  it("a closer Score Guess wins a tied total in the Final Results order", () => {
    E(`for (const t of [0,1]) cycleW(1,0,t,5);
       gameState.teams[0].scoreGuess = 20; gameState.teams[1].scoreGuess = 6; renderAll()`);
    const place = (n) => E(`finalResultsRows().find(r => r.name === "${n}").place`);
    assert.equal(place("Team B"), 1);
    assert.equal(place("Team A"), 2);
    assert.equal(place("Team C"), 3);
  });
  it("Bonus Item and NJCB add points to the total but are stripped before the guess diff", () => {
    E(`cycleW(1,0,0,5); gameState.teams[0].bonusItem = true; gameState.teams[0].njcb = true;
       gameState.teams[0].scoreGuess = 5; renderAll()`);
    assert.equal(scoreOf("Team A"), "13");
    assert.equal(E("finalResultsRows().find(r => r.index === 0).diff"), 0);
  });
  it("halftime and final wagers move the total up and down and show in preWagerTotal", () => {
    E(`cycleW(1,0,0,7); gameState.halftime[0] = {wager:10, correct:false}; gameState.finalWager[0] = {wager:20, correct:true}; renderAll()`);
    assert.equal(scoreOf("Team A"), "17");
    assert.equal(E("preWagerTotal(0,'halftime')"), 7);
    assert.equal(E("preWagerTotal(0,'final')"), -3);
  });
  it("toggleCraftPrize assigns a single winner and moves it when another team is picked", () => {
    E("toggleCraftPrize(0)");
    assert.equal(E("gameState.craftPrizeWinner.ti"), 0);
    E("toggleCraftPrize(1)");
    assert.equal(E("gameState.craftPrizeWinner.ti"), 1);
    assert.equal(E("gameState.teams.filter(t => t.craftPrize).length"), 1);
    E("toggleCraftPrize(1)");
    assert.equal(E("gameState.craftPrizeWinner"), null);
  });
  it("Revolution Rivals: setPlace scores 10/7/4/0 into the sidebar and a repeat tap clears it", () => {
    start(2, "rivals");
    E("setPlace(0,0,0,1); setPlace(0,1,0,2); setPlace(0,2,0,3); setPlace(0,3,0,0)");
    assert.equal(scoreOf("Team A"), "21");
    E("setPlace(0,0,0,1)");
    assert.equal(scoreOf("Team A"), "11");
  });
  it("Revolution Rivals: all-miss on a question yields the 'everyonewrong' verdict", () => {
    start(2, "rivals");
    E("setPlace(0,0,0,0); setPlace(0,0,1,0)");
    assert.equal(E("qVerdict(0,0)"), "everyonewrong");
    E("setPlace(0,0,1,2)");
    assert.equal(E("qVerdict(0,0)"), "manywrong");
  });
  it("Name That Tune: a Q5 wager scores through setW1/setC1 and renders its own wager block", () => {
    start(1, "tune");
    E("setW1(0, 5); setC1(0, true)");
    assert.equal(E("grandTotal(0)"), 5);
    assert.ok($("#standings-wager1") || $("[data-ta='wager1-0']"), "Q5 wager block rendered");
    E("setC1(0, false)");
    assert.equal(E("grandTotal(0)"), -5);
  });
});

describe("integration: persistence, modes, files and exports", () => {
  let w;
  const E = (expr) => evalIn(w, expr);
  const $ = (sel) => w.document.querySelector(sel);
  const confirmWith = async (btnId, action) => {
    const p = E(action);
    await new Promise((r) => setTimeout(r, 0));
    $("#" + btnId).click();
    return p;
  };
  before(async () => {
    w = await loadAppWindow();
  });
  after(() => w.close());
  beforeEach(() => {
    E(`gameState = freshState(); gameState.meta.location = "Test Pub"; gameState.meta.quizId = "AB-123";
       gameState.meta.hostName = "Host"; gameState.gameStarted = true;
       gameState.teams = [freshTeam("Alpha"), freshTeam("Beta")]; renderAll();`);
  });

  it("autosave writes to storage under the app key, and loadSaved returns an equal state", () => {
    E("cycleW(1,0,0,5); autosave()");
    assert.equal(E("loadSaved().rounds[1].questions[0][0].wager"), 5);
    assert.equal(E("JSON.stringify(loadSaved()) === JSON.stringify(gameState)"), true);
  });
  it("migrateState on a saved game from older data fills in every field the app now needs", () => {
    const g = E(`JSON.stringify(migrateState({ teams: [{ name: "Old" }], rounds: [], meta: {} }))`);
    const s = JSON.parse(g);
    assert.equal(s.teams[0].paused, false);
    assert.equal(s.teams[0].adjustment, 0);
    assert.equal(s.meta.mode, "regular");
    assert.equal(s.rounds.length, 4);
  });
  it("changing Game Mode with scores on the board asks first and wipes scores but keeps team names", async () => {
    E("cycleW(1,0,0,5)");
    await confirmWith("confirmOkBtn", 'setGameMode("tune")');
    assert.equal(E("gameMode()"), "tune");
    assert.equal(E("grandTotal(0)"), 0);
    assert.equal(E("gameState.teams.map(t => t.name).join()"), "Alpha,Beta");
    assert.equal(E("gameState.meta.location"), "Test Pub");
  });
  it("declining the Game Mode switch leaves scores and the select untouched", async () => {
    E("cycleW(1,0,0,5)");
    await confirmWith("confirmCancelBtn", 'setGameMode("theme")');
    assert.equal(E("gameMode()"), "regular");
    assert.equal(E("grandTotal(0)"), 5);
    assert.equal($("#gameModeSelect").value, "regular");
  });
  it("exportFn builds '<Location> - <MM-DD-YYYY> - <Mode>.<ext>' from live Event Details", () => {
    E(`gameState.meta.location = "Bob's Pub: East"; gameState.meta.date = "2026-03-09"`);
    assert.equal(E('exportFn("xlsx")'), "Bobs Pub East - 03-09-2026 - Regular Trivia.xlsx");
  });
  it("saveToFile then loadFromFile round-trips the whole game through a real File", async () => {
    E("cycleW(1,0,1,3); adjPts(0,2)");
    const json = E("JSON.stringify(gameState)");
    E(`gameState = freshState(); renderAll()`);
    const file = new w.File([json], "save.json", { type: "application/json" });
    const input = w.document.createElement("input");
    Object.defineProperty(input, "files", { value: [file] });
    w.loadFromFile({ target: input });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(E("gameState.teams.length"), 2);
    assert.equal(E("grandTotal(1)"), 3);
    assert.equal(E("grandTotal(0)"), 2);
  });
  it("the Team Report overlay opens for a team and shows that team's name and running total", () => {
    E("cycleW(1,0,1,7)");
    E("openAudit(1)");
    assert.ok($("#auditOverlay").classList.contains("show") || $("#auditOverlay").style.display !== "none");
    assert.match($("#auditOverlay").textContent, /Beta/);
    assert.match($("#auditOverlay").textContent, /7/);
    E("closeAudit()");
  });
  it("XLSX backup export builds a non-empty blob and shows the export-complete prompt", async () => {
    E("cycleW(1,0,0,5)");
    E("window.__mockBlobUrls.clear()");
    await E("exportXLSXBackup()");
    const sizes = JSON.parse(E("JSON.stringify([...window.__mockBlobUrls.values()].map(b => b.parts ? b.parts.length : 0))"));
    assert.ok(sizes.some((n) => n > 0), "an xlsx blob was produced");
    assert.ok($("#exportPrompt").classList.contains("show"));
  });
});
