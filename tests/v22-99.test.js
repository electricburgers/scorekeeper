// v22.99 — desktop usability: keyboard scoring on a selected team row, the "Reset Sort" button,
// the CB / Craft Beer label, and the two page-height fixes.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("v22.99 keyboard scoring", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });
  after(() => window.close());

  const run = (js) => evalIn(window, js);
  const json = (js) => JSON.parse(run(`JSON.stringify(${js} ?? null)`));
  const row = (id) => window.document.querySelector(`#mainContent [data-ta="${id}"]`);
  const press = (key) =>
    (window.document.activeElement || window.document.body).dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const select = (id) => click(row(id));
  const answer = (ri, qi, ti) => json(`gameState.rounds[${ri}].questions[${qi}][${ti}]`);

  beforeEach(() => {
    run(`kbClearRow(true);
      gameState = freshState();
      gameState.teams = ["A", "B"].map(freshTeam);
      gameState.gameStarted = true;
      // Q4 of rounds 1 and 4 scored, so the Bonus Question and final wager below are unlocked.
      [0, 3].forEach((ri) => [0, 1].forEach((ti) => (gameState.rounds[ri].questions[3][ti] = { wager: 4, correct: true })));
      questionSortOrder = {}; questionAlphaSort = { "0-0": "off", "0-1": "off", "3-0": "off", b0: "off", "sw-final": "off" };
      collapsedSections.clear(); collapsedQuestions.clear(); collapsedBonusQuestions.clear(); collapsedSpecialWagers.clear();
      renderAll();`);
  });

  it("does not score until a row is selected", () => {
    press("3");
    assert.equal(answer(0, 0, 0), null);
  });

  it("a number marks the wager correct, X and C change the result, Backspace clears", () => {
    select("0-0-0");
    assert.ok(row("0-0-0").classList.contains("kb-row"));
    press("3");
    assert.deepEqual(answer(0, 0, 0), { wager: 3, correct: true });
    press("3");
    assert.deepEqual(answer(0, 0, 0), { wager: 3, correct: true }, "repeating the number changes nothing");
    press("x");
    press("x");
    assert.deepEqual(answer(0, 0, 0), { wager: 3, correct: false });
    press("3");
    assert.deepEqual(answer(0, 0, 0), { wager: 3, correct: true });
    press("x");
    press("c");
    assert.deepEqual(answer(0, 0, 0), { wager: 3, correct: true });
    press("Backspace");
    assert.equal(answer(0, 0, 0), null);
  });

  it("keeps the selection through redraws and moves with the arrow keys", () => {
    select("0-0-0");
    press("1");
    assert.ok(row("0-0-0").classList.contains("kb-row"));
    press("ArrowDown");
    press("2");
    assert.deepEqual(answer(0, 0, 1), { wager: 2, correct: true });
    press("ArrowUp");
    assert.ok(row("0-0-0").classList.contains("kb-row"));
  });

  it("refuses a wager already used in the round", () => {
    run(`gameState.rounds[0].questions[0][0] = { wager: 2, correct: true }; renderAll()`);
    select("0-1-0");
    press("2");
    assert.equal(answer(0, 1, 0), null);
  });

  it("reads a two-digit wager typed as two keys", () => {
    select("final-0");
    press("1");
    press("5");
    press("c");
    assert.deepEqual(json("gameState.finalWager[0]"), { wager: 15, correct: true });
    press("Backspace");
    assert.deepEqual(json("gameState.finalWager[0]"), {});
  });

  it("scores a Bonus Question with 0-4", () => {
    select("bq-0-1");
    press("4");
    press("4");
    assert.equal(json("gameState.rounds[0].bonus[1]"), 4);
    press("Backspace");
    assert.equal(json("gameState.rounds[0].bonus[1]"), null);
  });

  it("Esc, or a click outside the rows, deselects", () => {
    select("0-0-0");
    press("Escape");
    press("3");
    assert.equal(answer(0, 0, 0), null);
    select("0-0-0");
    click(window.document.getElementById("appLogo"));
    assert.equal(window.document.querySelector(".kb-row"), null);
  });

  it("drops the selection when its section is collapsed", () => {
    select("0-0-0");
    run(`collapsedSections.add("sec-r1"); renderAll()`);
    press("3");
    assert.equal(answer(0, 0, 0), null);
  });

  it("lists the scoring keys in the shortcuts dialog", () => {
    run("toggleShortcutsHelp(true)");
    assert.match(window.document.getElementById("shortcutsOverlay").textContent, /Scoring from the keyboard/);
    run("toggleShortcutsHelp(false)");
  });

  it("labels the sort-restore button Reset Sort on every kind of card", () => {
    for (const card of ["#qblock-0-0", "#bqblock-0", "#swblock-final"]) {
      const b = window.document.querySelector(card + " .q-reset-btn");
      assert.equal(b.textContent.trim(), "Reset Sort", card);
      // The spoken name has to match the visible one (WCAG 2.5.3, Label in Name).
      assert.equal(b.getAttribute("aria-label"), "Reset Sort", card);
      assert.match(b.title, /scores are not changed/, card);
    }
  });

  it("craft beer chip reads CB when tight and Craft Beer otherwise, never anything longer", () => {
    const chip = window.document.querySelector(".njcb-check");
    assert.deepEqual([...chip.querySelectorAll('[class^="cb-"]')].map((e) => e.textContent), ["CB", "Craft Beer"]);
    for (const f of ["js/app.js", "css/styles.css", "faq/index.html", "faq/screenshots/README.md"])
      assert.doesNotMatch(read(f), /craft beer card|cb-lg/i, f);
  });
});

describe("v22.99 layout fixes", () => {
  it("the scoring column contains its absolutely positioned children", () => {
    assert.match(read("css/styles.css"), /\.col-left\{position:relative;/);
  });
  it("showing or skipping the tour offer re-measures the layout", () => {
    assert.equal(read("js/tutorial-firstrun.js").match(/syncLayoutTop\(\);/g).length, 2);
  });
});
