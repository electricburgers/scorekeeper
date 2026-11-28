// v23.3 — the Sort dot follows the order on screen, and the Teams list never re-sorts while typing.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v23.3", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });
  after(() => window.close());
  const run = (js) => evalIn(window, js);
  const $ = (sel) => window.document.querySelector(sel);
  const rows = () => [...window.document.querySelectorAll("#qblock-0-0 .ta-name")].map((e) => e.textContent.trim());
  const dot = () => !!$("#qblock-0-0 .q-sort-btn .resort-dot");
  const teamRows = () => [...window.document.querySelectorAll('#sec-teams .team-entry input[type="text"]')].map((e) => e.value);
  const teamDot = (sel) => !!$(`#sec-teams .team-sort-row ${sel} .resort-dot`);
  const type = (ti, kind, value) => {
    const input = $(`#sec-teams .team-entry[data-ti="${ti}"] input[type="${kind}"]`);
    input.value = value;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const setTeams = (names) =>
    run(`gameState = freshState(); gameState.teams = ${JSON.stringify(names)}.map(freshTeam);
      gameState.teams.forEach((t) => (t.scoreGuess = 50)); questionSortPending = {};
      teamAlphaSort = undefined; teamGuessSort = false; teamSortSnapshot = undefined; collapsedSections.clear(); renderAll();`);
  const score = (ti) => run(`gameState.rounds[0].questions[0][${ti}] = { wager: 1, correct: true }; renderAll();`);

  describe("per-question dot", () => {
    // Entry order is the reverse of A-Z, so a dot worked out from entry order would be wrong.
    beforeEach(() => setTeams(["Cobra", "Bison", "Aardvark"]));

    it("stays off when the unanswered teams are already on top on screen", () => {
      score(0); // Cobra is first by entry but last by name
      assert.deepEqual(rows(), ["Aardvark", "Bison", "Cobra"]);
      assert.equal(dot(), false);
    });

    it("shows when a tap would move rows, and clears after the tap", () => {
      score(2); // Aardvark sits on top
      assert.equal(dot(), true);
      assert.match($("#qblock-0-0 .q-sort-btn").title, /3 teams would move \(unanswered teams go to the top\)/);
      run("sortQuestion(0, 0)");
      assert.deepEqual(rows(), ["Bison", "Cobra", "Aardvark"]);
      assert.equal(dot(), false);
    });

    it("offers the way back to A-Z once every team is scored", () => {
      score(2);
      run("sortQuestion(0, 0)");
      score(1);
      score(0);
      assert.equal(dot(), true);
      assert.match($("#qblock-0-0 .q-sort-btn").title, /back to A-Z/);
      run("sortQuestion(0, 0)");
      assert.deepEqual(rows(), ["Aardvark", "Bison", "Cobra"]);
      assert.equal(dot(), false);
    });

    it("ignores paused teams", () => {
      score(2);
      run("gameState.teams[2].paused = true; renderAll()");
      assert.equal(dot(), false);
    });

    it("keeps a saved sort on the same teams after one is removed", () => {
      score(2);
      run("sortQuestion(0, 0); removeTeamAt(0); renderAll()");
      assert.deepEqual(rows(), ["Bison", "Aardvark"]);
      assert.equal(dot(), false);
    });
  });

  describe("Teams section", () => {
    beforeEach(() => setTeams(["Mango", "Cherry"]));

    it("naming a new team keeps it last, shows the dot and renames it in the questions", () => {
      run("cycleTeamAlphaSort()");
      $("#addTeamBtn").click();
      assert.equal(teamDot(".q-alpha-btn:not(.team-guess-btn)"), false);
      const input = $('#sec-teams .team-entry[data-ti="2"] input[type="text"]');
      const button = $("#sec-teams .team-sort-row .q-alpha-btn");
      type(2, "text", "Apple");
      assert.deepEqual(teamRows(), ["Cherry", "Mango", "Apple"]);
      assert.equal(teamDot(".q-alpha-btn:not(.team-guess-btn)"), true);
      assert.ok(input.isConnected, "the field being typed in is not replaced");
      assert.ok(button.isConnected, "the sort button is not replaced");
      assert.deepEqual(rows(), ["Apple", "Cherry", "Mango"]);
      run("cycleTeamAlphaSort()");
      assert.deepEqual(teamRows(), ["Apple", "Cherry", "Mango"]);
      assert.equal(teamDot(".q-alpha-btn:not(.team-guess-btn)"), false);
    });

    for (const alpha of [true, false]) {
      it(`filling in the last missing guess moves nothing (A-Z ${alpha ? "on" : "off"})`, () => {
        if (alpha) run("cycleTeamAlphaSort()");
        $("#addTeamBtn").click();
        type(2, "text", "Apple");
        run("toggleTeamGuessSort()"); // missing guesses first: Apple goes on top
        if (teamDot(".team-guess-btn")) run("toggleTeamGuessSort()");
        const before = teamRows();
        type(2, "number", "60");
        assert.deepEqual(teamRows(), before);
        assert.equal($("#sec-teams .team-guess-btn").disabled, false, "still on, so still usable");
      });
    }

    it("the No guess dot re-sorts in place, then the button can be switched off", () => {
      $("#addTeamBtn").click();
      run("toggleTeamGuessSort()");
      type(2, "number", "60");
      assert.equal(teamDot(".team-guess-btn"), true);
      $("#sec-teams .team-guess-btn").click();
      assert.equal(teamDot(".team-guess-btn"), false);
      assert.equal(run("teamGuessSort"), "first");
      $("#sec-teams .team-guess-btn").click();
      $("#sec-teams .team-guess-btn").click();
      assert.equal(run("teamGuessSort"), false);
      assert.equal($("#sec-teams .team-guess-btn").disabled, true);
    });

    it("waits for a press to finish before redrawing, so the click is not lost", async () => {
      const event = (name) => window.document.body.dispatchEvent(new window.Event(name, { bubbles: true }));
      const row = $("#qblock-0-0 .ta-name");
      event("pointerdown");
      type(0, "text", "Zebra");
      assert.ok(row.isConnected);
      event("pointerup");
      await new Promise((resolve) => window.setTimeout(resolve, 5));
      assert.deepEqual(rows(), ["Cherry", "Zebra"]);
    });
  });
});
