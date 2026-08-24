// Gameplay/scoring logic tests — real app code (js/app.js, js/scoring.js, js/craft-prize.js,
// js/storage.js) exercised in jsdom via tests/helpers/load-app.js, same approach as
// tests/js-behavior.test.js. This file covers core game mechanics (teams, wagers, ranking,
// craft prize, migration, persistence) that weren't yet under direct test.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

// evalIn() returns objects/arrays constructed inside the jsdom window's own vm realm, whose
// Object/Array prototypes are NOT the same prototype objects as this test file's Node realm —
// node:assert/strict's deepEqual checks prototype identity as part of "strict", so comparing a
// cross-realm object/array against a plain literal here fails with a "same structure but not
// reference-equal" error even when every own property matches. Round-tripping through JSON
// inside the SAME realm the value came from sidesteps that: the JSON string is a primitive, and
// JSON.parse() on this side produces an ordinary Node-realm object/array to compare against.
function evalJSON(window, expr) {
  return JSON.parse(evalIn(window, `JSON.stringify(${expr})`));
}

// ============================================================================
// Team management
// ============================================================================
describe("Team management: addTeam / removeTeam", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("addTeam() pushes a fresh team with the documented defaults", () => {
    evalIn(window, "gameState = freshState(); renderAll();");
    window.addTeam();
    const t = evalJSON(window, "gameState.teams[0]");
    assert.equal(t.name, "");
    assert.equal(t.scoreGuess, "");
    assert.equal(t.bonusItem, false);
    assert.equal(t.njcb, false);
    assert.equal(t.adjustment, 0);
    assert.equal(t.craftPrize, false);
    assert.equal(evalIn(window, "gameState.teams.length"), 1);
  });

  it("addTeam() never grows the roster past MAX_TEAMS", () => {
    evalIn(
      window,
      "gameState = freshState(); for (let i = 0; i < MAX_TEAMS + 5; i++) addTeam();",
    );
    assert.equal(evalIn(window, "gameState.teams.length"), evalIn(window, "MAX_TEAMS"));
  });

  it("removeTeam() shifts every other team's wagers down to close the gap, not just deletes the team", async () => {
    evalIn(
      window,
      `
      gameState = freshState();
      for (let i = 0; i < 3; i++) addTeam();
      // team 0: no wager on Q0. team 1: wager 2 correct. team 2: wager 3 incorrect.
      gameState.rounds[0].questions[0][1] = { wager: 2, correct: true };
      gameState.rounds[0].questions[0][2] = { wager: 3, correct: false };
      gameState.rounds[0].bonus[1] = 3;
      gameState.rounds[0].bonus[2] = 1;
      renderAll();
      `,
    );
    const p = window.removeTeam(0); // remove team 0 (untouched by any wager)
    await new Promise((r) => setTimeout(r, 10));
    window.document.getElementById("confirmOkBtn").click();
    await p;
    // what was team 1's wager is now team 0's (indices shifted down by one)
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][0]"), {
      wager: 2,
      correct: true,
    });
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][1]"), {
      wager: 3,
      correct: false,
    });
    assert.equal(evalIn(window, "gameState.rounds[0].bonus[0]"), 3);
    assert.equal(evalIn(window, "gameState.rounds[0].bonus[1]"), 1);
    // no leftover entry at the old (now out-of-range) index 2
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][2]"), undefined);
  });

  it("editing a team's name input (onchange) writes straight into gameState and survives a save/load round trip", () => {
    evalIn(
      window,
      "gameState = freshState(); addTeam(); renderAll();",
    );
    const input = window.document.querySelector('[data-ti="0"] input[type="text"]');
    input.value = "The Renamed Team";
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(evalIn(window, "gameState.teams[0].name"), "The Renamed Team");
    evalIn(window, "autosave();");
    const loaded = evalJSON(window, "loadSaved()");
    assert.equal(loaded.teams[0].name, "The Renamed Team");
  });
});

// ============================================================================
// Manual score adjustments
// ============================================================================
describe("Score adjustments (adjPts)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("adjPts accumulates repeated +/- calls into a single running total", () => {
    evalIn(window, "gameState = freshState(); addTeam(); renderAll();");
    window.adjPts(0, 1);
    window.adjPts(0, 1);
    window.adjPts(0, 1);
    window.adjPts(0, -1);
    assert.equal(evalIn(window, "gameState.teams[0].adjustment"), 2);
  });

  it("an adjustment persists through autosave/loadSaved and is reflected in grandTotal()", () => {
    evalIn(window, "gameState = freshState(); addTeam(); renderAll();");
    window.adjPts(0, 15);
    window.adjPts(0, -5);
    evalIn(window, "autosave();");
    evalIn(window, "gameState = migrateState(loadSaved());");
    assert.equal(evalIn(window, "gameState.teams[0].adjustment"), 10);
    assert.equal(evalIn(window, "grandTotal(0)"), 10);
  });
});

// ============================================================================
// Wager marking / undo (cycleW) — canScore() gates every scoring tap behind a Quiz ID + Host
// Name in Event Details UNLESS gameState.gameStarted is already true, so every setup below
// flips that flag directly rather than filling in Event Details fields irrelevant to what's
// under test here.
// ============================================================================
describe("Wager marking and undo (cycleW)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("first tap on a wager marks it correct and adds the wager to the team's grand total", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); renderAll();",
    );
    window.cycleW(0, 0, 0, 3);
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][0]"), {
      wager: 3,
      correct: true,
    });
    assert.equal(evalIn(window, "grandTotal(0)"), 3);
  });

  it("a second tap on the same wager value flips correct to incorrect", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); renderAll();",
    );
    window.cycleW(0, 0, 0, 3);
    window.cycleW(0, 0, 0, 3);
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0].correct"), false);
    assert.equal(evalIn(window, "grandTotal(0)"), 0);
  });

  it("a third tap on the same wager value clears the slot entirely (undo back to unanswered)", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); renderAll();",
    );
    window.cycleW(0, 0, 0, 3);
    window.cycleW(0, 0, 0, 3);
    window.cycleW(0, 0, 0, 3);
    assert.equal(evalIn(window, "gameState.rounds[0].questions[0][0]"), undefined);
    assert.equal(evalIn(window, "grandTotal(0)"), 0);
  });

  it("cycleW refuses to let a team reuse a wager value already spent on another question in the same round", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); renderAll();",
    );
    window.cycleW(0, 0, 0, 2); // team 0 spends wager 2 on Q0
    window.cycleW(0, 1, 0, 2); // tries to spend wager 2 again on Q1 — blocked
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][0]"), {
      wager: 2,
      correct: true,
    });
    assert.equal(evalIn(window, "gameState.rounds[0].questions[1][0]"), undefined);
  });
});

// ============================================================================
// ROUND_WAGERS — the allowed wager set per round is the game's actual rule set
// ============================================================================
describe("ROUND_WAGERS: per-round allowed wager values", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("Round 1 (bonus) allows exactly 1, 2, 3, 4", () => {
    assert.deepEqual(evalJSON(window, "ROUND_WAGERS[0]"), [1, 2, 3, 4]);
  });
  it("Round 2 allows exactly 1, 3, 5, 7", () => {
    assert.deepEqual(evalJSON(window, "ROUND_WAGERS[1]"), [1, 3, 5, 7]);
  });
  it("Round 3 (bonus) allows exactly 2, 4, 6, 8", () => {
    assert.deepEqual(evalJSON(window, "ROUND_WAGERS[2]"), [2, 4, 6, 8]);
  });
  it("Round 4 allows exactly 3, 6, 9, 12", () => {
    assert.deepEqual(evalJSON(window, "ROUND_WAGERS[3]"), [3, 6, 9, 12]);
  });
  it("BONUS_ROUNDS marks rounds 0 and 2 as bonus rounds, not 1 or 3", () => {
    const b = evalIn(window, "BONUS_ROUNDS");
    assert.equal(b.has(0), true);
    assert.equal(b.has(1), false);
    assert.equal(b.has(2), true);
    assert.equal(b.has(3), false);
  });
});

// ============================================================================
// Reordering a question preserves its wager data
// ============================================================================
describe("sortQuestion: reordering questions doesn't lose wager data", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("swapping Q1 and Q2 moves each question's own wagers along with it", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      gameState.gameStarted = true;
      addTeam(); addTeam();
      gameState.rounds[0].questions[0][0] = { wager: 1, correct: true };
      gameState.rounds[0].questions[0][1] = { wager: 4, correct: false };
      gameState.rounds[0].questions[1][0] = { wager: 2, correct: true };
      renderAll();
      `,
    );
    // sortQuestion(ri, qi) sorts the questionSortOrder for display; verify the underlying
    // per-team wager objects for each qi are untouched by the reorder (data integrity, not
    // just that the call doesn't throw).
    window.sortQuestion(0, 0);
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][0]"), {
      wager: 1,
      correct: true,
    });
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[0][1]"), {
      wager: 4,
      correct: false,
    });
    assert.deepEqual(evalJSON(window, "gameState.rounds[0].questions[1][0]"), {
      wager: 2,
      correct: true,
    });
  });
});

// ============================================================================
// Ranking (rankMap / ranked / getDisplayOrder)
// ============================================================================
describe("Ranking: rankMap ties and tie-breaking", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("teams tied on total score (and guess) share one dense rank, and the next distinct team isn't skipped", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      for (let i = 0; i < 4; i++) addTeam();
      gameState.teams[0].adjustment = 100;
      gameState.teams[1].adjustment = 100; // ties with team 0
      gameState.teams[2].adjustment = 85;
      gameState.teams[3].adjustment = 60;
      renderAll();
      `,
    );
    const rm = evalJSON(window, "rankMap()");
    assert.equal(rm[0], 1);
    assert.equal(rm[1], 1); // tied for 1st with team 0
    assert.equal(rm[2], 2); // next distinct team is 2nd, not 3rd
    assert.equal(rm[3], 3);
  });

  it("a closer Score Guess breaks an otherwise-tied total into separate places", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      addTeam(); addTeam();
      gameState.teams[0].adjustment = 100;
      gameState.teams[0].scoreGuess = 90; // off by 10
      gameState.teams[1].adjustment = 100;
      gameState.teams[1].scoreGuess = 99; // off by 1 — closer guess wins the tie
      renderAll();
      `,
    );
    const rm = evalJSON(window, "rankMap()");
    assert.equal(rm[1], 1, "closer guesser should take sole 1st place");
    assert.equal(rm[0], 2, "the tie should be broken, not shared");
  });
});

// ============================================================================
// preWagerTotal — the running total shown before halftime/final wager is placed
// ============================================================================
describe("preWagerTotal: partial totals exclude the not-yet-placed special wager", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it('type "halftime" sums only Rounds 1-2 (adjustments included, halftime/final excluded)', () => {
    evalIn(
      window,
      `
      gameState = freshState();
      addTeam();
      gameState.rounds[0].questions[0][0] = { wager: 2, correct: true };
      gameState.rounds[1].questions[0][0] = { wager: 3, correct: true };
      gameState.rounds[2].questions[0][0] = { wager: 4, correct: true }; // must NOT count yet
      gameState.halftime[0] = { wager: 5, correct: true }; // must NOT count yet
      gameState.teams[0].adjustment = 1;
      renderAll();
      `,
    );
    assert.equal(evalIn(window, 'preWagerTotal(0, "halftime")'), 2 + 3 + 1);
  });

  it('type "final" additionally includes halftime plus Rounds 3-4', () => {
    evalIn(
      window,
      `
      gameState = freshState();
      addTeam();
      gameState.rounds[0].questions[0][0] = { wager: 2, correct: true };
      gameState.rounds[1].questions[0][0] = { wager: 3, correct: true };
      gameState.rounds[2].questions[0][0] = { wager: 4, correct: true };
      gameState.rounds[3].questions[0][0] = { wager: 6, correct: true };
      gameState.halftime[0] = { wager: 5, correct: true };
      gameState.finalWager[0] = { wager: 20, correct: true }; // must NOT count yet
      gameState.teams[0].adjustment = 1;
      renderAll();
      `,
    );
    assert.equal(
      evalIn(window, 'preWagerTotal(0, "final")'),
      2 + 3 + 4 + 6 + 5 + 1,
    );
  });
});

// ============================================================================
// Craft Prize winner assignment
// ============================================================================
describe("Craft Prize winner (toggleCraftPrize / startCraftPrizeDraw guard)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("toggleCraftPrize marks exactly one team's craftPrize flag and sets gameState.craftPrizeWinner", () => {
    evalIn(window, "gameState = freshState(); addTeam(); addTeam(); renderAll();");
    window.toggleCraftPrize(1);
    assert.equal(evalIn(window, "gameState.teams[0].craftPrize"), false);
    assert.equal(evalIn(window, "gameState.teams[1].craftPrize"), true);
    assert.equal(evalIn(window, "gameState.craftPrizeWinner.ti"), 1);
  });

  it("assigning the prize to a different team clears the previous winner's flag (only ever one winner)", () => {
    evalIn(window, "gameState = freshState(); addTeam(); addTeam(); renderAll();");
    window.toggleCraftPrize(0);
    window.toggleCraftPrize(1);
    assert.equal(evalIn(window, "gameState.teams[0].craftPrize"), false);
    assert.equal(evalIn(window, "gameState.teams[1].craftPrize"), true);
    assert.equal(evalIn(window, "gameState.craftPrizeWinner.ti"), 1);
  });

  it("startCraftPrizeDraw() refuses to start a second drawing once a winner is already chosen", async () => {
    evalIn(
      window,
      "gameState = freshState(); addTeam(); addTeam(); craftFlowOpen = true; renderAll();",
    );
    window.toggleCraftPrize(0);
    window.startCraftPrizeDraw();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmOverlay").classList.contains("show"),
      true,
    );
    assert.match(
      window.document.getElementById("confirmMessage").textContent,
      /already been chosen/i,
    );
    window.document.getElementById("confirmOkBtn").click();
  });

  it("craftEligiblePool excludes exactly the top-ranked N teams set by Exclude Top N", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      for (let i = 0; i < 5; i++) addTeam();
      gameState.teams[0].adjustment = 100; // rank 1
      gameState.teams[1].adjustment = 90;  // rank 2
      gameState.teams[2].adjustment = 80;  // rank 3
      gameState.teams[3].adjustment = 70;  // rank 4
      gameState.teams[4].adjustment = 60;  // rank 5
      gameState.meta.excludeTopN = 2;
      renderAll();
      `,
    );
    const pool = evalJSON(window, "craftEligiblePool()");
    assert.deepEqual(pool.sort(), [2, 3, 4]);
  });
});

// ============================================================================
// migrateState — loading older or oversized saved data
// ============================================================================
describe("migrateState: field clamping and backfilling old saves", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("clamps meta.quizId and meta.staffNames to their FIELD_MAX lengths on load", () => {
    const max = evalIn(window, "FIELD_MAX");
    const result = evalJSON(
      window,
      `migrateState({
        meta: { quizId: "Q".repeat(${max.quizId + 20}), staffNames: "S".repeat(${max.staffNames + 20}) },
        teams: [],
      })`,
    );
    assert.equal(result.meta.quizId.length, max.quizId);
    assert.equal(result.meta.staffNames.length, max.staffNames);
  });

  it("clamps an oversized team name to FIELD_MAX.teamName on load", () => {
    const maxName = evalIn(window, "FIELD_MAX.teamName");
    const result = evalJSON(
      window,
      `migrateState({ meta: {}, teams: [{ name: "T".repeat(${maxName + 25}) }] })`,
    );
    assert.equal(result.teams[0].name.length, maxName);
  });

  it("backfills adjustment/njcb/craftPrize on a team object saved before those fields existed", () => {
    const result = evalJSON(
      window,
      `migrateState({ meta: {}, teams: [{ name: "Old Team" }] })`,
    );
    assert.equal(result.teams[0].adjustment, 0);
    assert.equal(result.teams[0].njcb, false);
    assert.equal(result.teams[0].craftPrize, false);
  });

  it("resolves craftPrizeWinner from a legacy craftPrizeDraws array when the current field is absent", () => {
    const result = evalJSON(
      window,
      `migrateState({
        meta: {},
        teams: [{ name: "A" }, { name: "B" }],
        craftPrizeDraws: [{ ti: 0 }, { ti: 1 }],
      })`,
    );
    assert.deepEqual(result.craftPrizeWinner, { ti: 1 });
  });
});

// ============================================================================
// Quiz ID format validation
// ============================================================================
describe("isQuizIdValid: format check", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  const valid = ["AB-123", "ABCDE1234", "Q-1", "z9"];
  const invalid = ["", "   ", "ABCDEF-123", "AB-12345", "AB--123", "AB 123"];

  for (const v of valid) {
    it(`accepts ${JSON.stringify(v)}`, () => {
      assert.equal(evalIn(window, `isQuizIdValid(${JSON.stringify(v)})`), true);
    });
  }
  for (const v of invalid) {
    it(`rejects ${JSON.stringify(v)}`, () => {
      assert.equal(evalIn(window, `isQuizIdValid(${JSON.stringify(v)})`), false);
    });
  }
});

// ============================================================================
// Beer round detection — isBeerRound/isSpecialBeerRound don't gate on canScore() themselves,
// but getting there via cycleW does, so gameState.gameStarted is set up front here too.
// ============================================================================
describe("Beer round detection (isBeerRound / isSpecialBeerRound)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("isBeerRound is true only once every team has answered AND every answer is correct", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); addTeam(); renderAll();",
    );
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), false, "no answers yet");
    window.cycleW(0, 0, 0, 1);
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), false, "only one of two teams answered");
    window.cycleW(0, 0, 1, 2);
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), true, "both teams answered, both correct");
  });

  it("isBeerRound goes back to false the moment any one team is marked incorrect", () => {
    evalIn(
      window,
      "gameState = freshState(); gameState.gameStarted = true; addTeam(); addTeam(); renderAll();",
    );
    window.cycleW(0, 0, 0, 1);
    window.cycleW(0, 0, 1, 2);
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), true);
    window.cycleW(0, 0, 1, 2); // second tap on the same wager flips team 1 to incorrect
    assert.equal(evalIn(window, "isBeerRound(0, 0)"), false);
  });

  it("isSpecialBeerRound('halftime') is true only when every team's halftime wager is correct", () => {
    evalIn(window, "gameState = freshState(); addTeam(); addTeam(); renderAll();");
    assert.equal(evalIn(window, 'isSpecialBeerRound("halftime")'), false);
    evalIn(
      window,
      `gameState.halftime[0] = { wager: 5, correct: true };
       gameState.halftime[1] = { wager: 5, correct: false };`,
    );
    assert.equal(evalIn(window, 'isSpecialBeerRound("halftime")'), false);
    evalIn(window, `gameState.halftime[1].correct = true;`);
    assert.equal(evalIn(window, 'isSpecialBeerRound("halftime")'), true);
  });
});

// ============================================================================
// checkGameStarted — detects real gameplay even if the flag itself was never flipped
// ============================================================================
describe("checkGameStarted", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("reports false for a genuinely untouched fresh game", () => {
    evalIn(window, "gameState = freshState(); addTeam();");
    assert.equal(evalIn(window, "checkGameStarted()"), false);
  });

  it("detects a single real wager entry even when gameState.gameStarted was never explicitly set", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      addTeam();
      gameState.gameStarted = false;
      gameState.rounds[1].questions[2][0] = { wager: 5, correct: true };
      `,
    );
    assert.equal(evalIn(window, "checkGameStarted()"), true);
    // and it self-heals the flag for next time, rather than re-scanning every call
    assert.equal(evalIn(window, "gameState.gameStarted"), true);
  });

  it("detects a bonus-round answer alone as enough to count as started", () => {
    evalIn(
      window,
      `
      gameState = freshState();
      addTeam();
      gameState.gameStarted = false;
      gameState.rounds[0].bonus[0] = 3;
      `,
    );
    assert.equal(evalIn(window, "checkGameStarted()"), true);
  });
});

// ============================================================================
// Persistence edge cases
// ============================================================================
describe("Persistence: empty games and clearSaved", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("autosave/loadSaved round-trips a teamless fresh game without error", () => {
    evalIn(window, "gameState = freshState(); autosave();");
    const loaded = evalJSON(window, "loadSaved()");
    assert.deepEqual(loaded.teams, []);
    assert.equal(loaded.craftPrizeWinner, null);
    assert.equal(loaded.gameStarted, false);
  });

  it("clearSaved() removes the saved session — loadSaved() returns null afterward", () => {
    evalIn(window, "gameState = freshState(); addTeam(); autosave();");
    assert.notEqual(evalIn(window, "loadSaved()"), null);
    evalIn(window, "clearSaved();");
    assert.equal(evalIn(window, "loadSaved()"), null);
  });
});
