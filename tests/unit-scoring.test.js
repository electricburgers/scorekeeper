// Unit tests for the pure scoring/ranking/format helpers in js/scoring.js. Each test builds the
// exact gameState it needs (no rendering, no clicks) and asserts on a return value.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

// evalIn returns objects from the jsdom realm; round-trip through JSON so deepEqual compares
// ordinary Node-realm values.
const J = (w, expr) => JSON.parse(evalIn(w, `JSON.stringify(${expr})`));

describe("unit: scoring helpers", () => {
  let w;
  const E = (expr) => evalIn(w, expr);
  // Fresh game in `mode` with n named teams; no DOM rendering involved.
  const game = (n = 2, mode = "regular") =>
    E(`gameState = freshState(); gameState.meta.mode = "${mode}";
       gameState.teams = [${Array.from({ length: n }, (_, i) => `freshTeam("T${i + 1}")`).join(",")}]; 0`);
  before(async () => {
    w = await loadAppWindow();
  });
  after(() => w.close());

  it("ordinal: 1/2/3/4 take st/nd/rd/th", () => {
    assert.deepEqual(J(w, "[1,2,3,4].map(ordinal)"), ["1st", "2nd", "3rd", "4th"]);
  });
  it("ordinal: 11, 12 and 13 are 'th', not st/nd/rd", () => {
    assert.deepEqual(J(w, "[11,12,13].map(ordinal)"), ["11th", "12th", "13th"]);
  });
  it("ordinal: 21, 22, 23, 101, 111 follow the last-digit rule except the teens", () => {
    assert.deepEqual(J(w, "[21,22,23,101,111].map(ordinal)"), ["21st", "22nd", "23rd", "101st", "111th"]);
  });
  it("alphaSortKey ignores a leading The / An / A, case-insensitively", () => {
    assert.deepEqual(J(w, `["The Quizzards","an Owl","A Team","THE Best"].map(alphaSortKey)`), [
      "Quizzards", "Owl", "Team", "Best",
    ]);
  });
  it("alphaSortKey keeps article-only and article-prefixed-word names intact", () => {
    assert.deepEqual(J(w, `["The","A","Another","Theory"].map(alphaSortKey)`), ["The", "A", "Another", "Theory"]);
  });
  it("applyAlphaSort sorts numerically-aware: Team 2 before Team 10", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam("Team 10"), freshTeam("Team 2"), freshTeam("Team 1")]; 0`);
    assert.deepEqual(J(w, `applyAlphaSort([0,1,2], "az")`), [2, 1, 0]);
    assert.deepEqual(J(w, `applyAlphaSort([0,1,2], "za")`), [0, 1, 2]);
  });
  it("applyAlphaSort keeps pending (unanswered) teams grouped above answered ones", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam("Alpha"), freshTeam("Bravo"), freshTeam("Charlie")]; 0`);
    assert.deepEqual(J(w, `applyAlphaSort([0,1,2], "az", new Set([2]))`), [2, 0, 1]);
  });
  it("answerPoints: place → 10/7/4/0, correct wager → wager, wrong or missing → 0", () => {
    assert.deepEqual(
      J(w, `[{place:1},{place:2},{place:3},{place:0},{wager:5,correct:true},{wager:5,correct:false},{wager:5},null,undefined].map(answerPoints)`),
      [10, 7, 4, 0, 5, 0, 0, 0, 0],
    );
  });
  it("isAnswered needs a place, or a wager AND a verdict", () => {
    assert.deepEqual(
      J(w, `[{place:0},{wager:3},{wager:3,correct:false},{correct:true},null].map(isAnswered)`),
      [true, false, true, false, false],
    );
  });
  it("gameMode falls back to regular for an unknown or missing mode", () => {
    game(1);
    E(`gameState.meta.mode = "zzz"`);
    assert.equal(E("gameMode()"), "regular");
    E(`delete gameState.meta.mode`);
    assert.equal(E("gameMode()"), "regular");
  });
  it("guessLimit and roundCount per mode: 146/4, 95/3, 126/4, 210/4", () => {
    const got = ["regular", "theme", "tune", "rivals"].map((m) => {
      game(1, m);
      return [E("guessLimit()"), E("roundCount()")];
    });
    assert.deepEqual(got, [[146, 4], [95, 3], [126, 4], [210, 4]]);
  });
  it("hasBonusQ is true for regular rounds 1 and 3 only, never in Q5-wager modes", () => {
    game(1);
    assert.deepEqual(J(w, "[0,1,2,3].map(hasBonusQ)"), [true, false, true, false]);
    for (const m of ["theme", "tune", "rivals"]) {
      game(1, m);
      assert.deepEqual(J(w, "[0,1,2,3].map(hasBonusQ)"), [false, false, false, false], m);
    }
  });
  it("roundTitle appends the task only in Name That Tune", () => {
    game(1, "tune");
    assert.equal(E("roundTitle(3)"), "Round 4 - Song Title & Artist");
    game(1, "regular");
    assert.equal(E("roundTitle(3)"), "Round 4");
  });
  it("roundWagerType: regular wagers close rounds 2 and 4; theme closes all three", () => {
    game(1);
    assert.deepEqual(J(w, "[0,1,2,3].map(roundWagerType)"), [null, "halftime", null, "final"]);
    game(1, "theme");
    assert.deepEqual(J(w, "[0,1,2,3].map(roundWagerType)"), ["wager1", "halftime", "final", null]);
  });
  it("wagerMax: regular 10/20, theme 5/10/20, tune 5/10/15/20", () => {
    game(1);
    assert.deepEqual(J(w, `["halftime","final"].map(wagerMax)`), [10, 20]);
    game(1, "theme");
    assert.deepEqual(J(w, `["wager1","halftime","final"].map(wagerMax)`), [5, 10, 20]);
    game(1, "tune");
    assert.deepEqual(J(w, `["wager1","halftime","wager3","final"].map(wagerMax)`), [5, 10, 15, 20]);
  });
  it("freshTeam starts blank, unpaused, with zero adjustment", () => {
    const t = J(w, `freshTeam("X")`);
    assert.equal(t.name, "X");
    assert.equal(t.scoreGuess, "");
    assert.equal(t.paused, false);
    assert.equal(t.adjustment, 0);
    assert.equal(t.njcb, false);
    assert.equal(t.bonusItem, false);
  });
  it("teamLabel falls back to 'Team N' for a blank name or missing team", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam(""), freshTeam("Real")]; 0`);
    assert.equal(E("teamLabel(0)"), "Team 1");
    assert.equal(E("teamLabel(1)"), "Real");
    assert.equal(E("teamLabel(7)"), "Team 8");
  });
  it("activeTeamCount and isPaused ignore paused teams", () => {
    game(3);
    E("gameState.teams[1].paused = true");
    assert.equal(E("activeTeamCount()"), 2);
    assert.deepEqual(J(w, "[0,1,2,9].map(isPaused)"), [false, true, false, false]);
  });
  it("halftime/final points: correct adds, incorrect subtracts, blank or ungraded is 0", () => {
    game(4);
    E(`gameState.halftime = {0:{wager:7,correct:true},1:{wager:7,correct:false},2:{wager:"",correct:true},3:{wager:4}};`);
    assert.deepEqual(J(w, "[0,1,2,3].map(htPts)"), [7, -7, 0, 0]);
    E(`gameState.finalWager = {0:{wager:20,correct:false}};`);
    assert.deepEqual(J(w, "[0,1].map(fwPts)"), [-20, 0]);
  });
  it("grandTotal adds Bonus Item (+5), NJCB (+3) and the manual adjustment", () => {
    game(1);
    E(`gameState.teams[0].bonusItem = true; gameState.teams[0].njcb = true; gameState.teams[0].adjustment = -2;
       gameState.rounds[0].questions[0][0] = {wager:4,correct:true};`);
    assert.equal(E("grandTotal(0)"), 4 + 5 + 3 - 2);
  });
  it("roundSub: a 4-part bonus is worth 5 per part in Round 1, and ignored in Round 2", () => {
    game(1);
    E(`gameState.rounds[0].bonus[0] = 3; gameState.rounds[1].bonus[0] = 3;`);
    assert.equal(E("roundSub(0,0)"), 15);
    assert.equal(E("roundSub(0,1)"), 0);
  });
  it("roundSub: Theme Night never counts a Round 4 entry", () => {
    game(1, "theme");
    E(`gameState.rounds[3].questions[0][0] = {wager:12,correct:true}; 0`);
    assert.equal(E("roundSub(0,3)"), 0);
    assert.equal(E("grandTotal(0)"), 0);
  });
});

describe("unit: ranking, usage and breakdown helpers", () => {
  let w;
  const E = (expr) => evalIn(w, expr);
  before(async () => {
    w = await loadAppWindow();
  });
  after(() => w.close());

  it("rankMap shares a place only when total AND guess-closeness both tie", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam("A"), freshTeam("B"), freshTeam("C")];
       for (const i of [0,1,2]) gameState.rounds[0].questions[0][i] = {wager:3,correct:true};
       gameState.teams[0].scoreGuess = 3; gameState.teams[1].scoreGuess = 3; gameState.teams[2].scoreGuess = 9; 0`);
    assert.deepEqual(J(w, "rankMap()"), { 0: 1, 1: 1, 2: 2 });
  });
  it("usedW lists each wager a team has spent in a round with its question index", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam("A")];
       gameState.rounds[1].questions[0][0] = {wager:5,correct:true};
       gameState.rounds[1].questions[2][0] = {wager:7,correct:false}; 0`);
    assert.deepEqual(J(w, "usedW(0,1)"), [{ qi: 0, wager: 5 }, { qi: 2, wager: 7 }]);
    assert.deepEqual(J(w, "usedW(0,0)"), []);
  });
  it("scoreBreakdown skips paused teams and unscored teams", () => {
    E(`gameState = freshState(); gameState.teams = [freshTeam("A"), freshTeam("B"), freshTeam("C"), freshTeam("D")];
       gameState.teams[3].paused = true; 0`);
    const r = J(w, `scoreBreakdown({0:{correct:true},1:{correct:false},3:{correct:true}}, 4)`);
    assert.deepEqual(r, { correct: 1, incorrect: 1, done: 2, correctPct: 50, incorrectPct: 50 });
  });
});
