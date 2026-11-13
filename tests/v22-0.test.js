// v22.0 — Revolution Rivals: Q1-4 scored by survey place (#1/#2/#3/other = 10/7/4/0), Q5 wagers
// on the #1 answer (caps 5/10/15/20), perfect night 210, no Beer Round, branded header.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const setup = (n = 2) =>
  `gameState = freshState(); gameState.meta.mode = "rivals"; gameState.meta.location = "Bob's Pub";
   gameState.teams = [${Array.from({ length: n }, (_, i) => `freshTeam("T${i + 1}")`).join(",")}]; renderAll();`;

describe("Revolution Rivals", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("is a registered mode with a 210 guess limit and 4 Q5-wager rounds", () => {
    evalIn(window, setup());
    assert.equal(evalIn(window, "gameMode()"), "rivals");
    assert.equal(evalIn(window, "gameModeName()"), "Revolution Rivals");
    assert.equal(evalIn(window, "guessLimit()"), 210);
    assert.equal(evalIn(window, "roundCount()"), 4);
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify([0,1,2,3].map(roundWagerType))")), [
      "wager1", "halftime", "wager3", "final",
    ]);
    assert.deepEqual(JSON.parse(evalIn(window, "JSON.stringify(['wager1','halftime','wager3','final'].map(wagerMax))")), [5, 10, 15, 20]);
  });

  it("places score 10 / 7 / 4 / 0", () => {
    evalIn(window, setup());
    evalIn(window, "gameState.meta.location='Bob'; for (const [qi,p] of [[0,1],[1,2],[2,3],[3,0]]) gameState.rounds[0].questions[qi][0] = { place: p };");
    assert.equal(evalIn(window, "roundSub(0,0)"), 21);
    assert.equal(evalIn(window, "grandTotal(0)"), 21);
  });

  it("a perfect night is 210", () => {
    evalIn(window, setup(1));
    evalIn(
      window,
      `for (let ri=0; ri<4; ri++) for (let qi=0; qi<4; qi++) gameState.rounds[ri].questions[qi][0] = { place: 1 };
       gameState.wager1[0] = {wager:5,correct:true}; gameState.halftime[0] = {wager:10,correct:true};
       gameState.wager3[0] = {wager:15,correct:true}; gameState.finalWager[0] = {wager:20,correct:true};`,
    );
    assert.equal(evalIn(window, "grandTotal(0)"), 210);
  });

  it("a lost Q5 wager subtracts", () => {
    evalIn(window, setup(1));
    evalIn(window, "gameState.rounds[0].questions[0][0] = { place: 1 }; gameState.wager1[0] = {wager:5,correct:false};");
    assert.equal(evalIn(window, "grandTotal(0)"), 5);
  });

  it("setPlace sets, switches, and clears on a repeat tap; progress follows", () => {
    evalIn(window, setup(1));
    evalIn(window, "gameState.meta.quizId='AB-123'; gameState.meta.hostName='Host'; gameState.meta.craftPartner='X'; gameState.meta.craftPartnerTown='Y'; canScore = () => true; setPlace(0,0,0,2);");
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0].place"), 2);
    assert.equal(evalIn(window, "qScored(0,0).done"), 1);
    evalIn(window, "setPlace(0,0,0,3)");
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0].place"), 3);
    evalIn(window, "setPlace(0,0,0,3)");
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0]"), undefined);
    assert.equal(evalIn(window, "qScored(0,0).done"), 0);
  });

  it("renders four place buttons per team and no Beer Round", () => {
    evalIn(window, setup(2));
    evalIn(window, "for (let t=0;t<2;t++) gameState.rounds[0].questions[0][t] = { place: 1 }; renderAll();");
    const d = window.document;
    assert.equal(d.querySelectorAll("#qblock-0-0 .place-btn").length, 8);
    assert.equal(evalIn(window, "isBeerRound(0,0)"), false);
  });

  it("an unknown mode still migrates to regular; rivals survives migration", () => {
    assert.equal(evalIn(window, 'migrateState({ meta: { mode: "rivals" } }).meta.mode'), "rivals");
    assert.equal(evalIn(window, 'migrateState({ meta: { mode: "zzz" } }).meta.mode'), "regular");
  });
});
