// v22.104 — Enter and Space on a role="button" control activate it once. Two document-level
// handlers used to run for each press, so a section header opened and closed again.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v22.104 Enter and Space", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });
  after(() => window.close());
  const run = (js) => evalIn(window, js);
  const $ = (sel) => window.document.querySelector(sel);
  const press = (el, key) => {
    const e = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e;
  };
  const countClicks = (el) => {
    let n = 0;
    el.addEventListener("click", () => n++, true);
    return () => n;
  };

  beforeEach(() => {
    run(`gameState = freshState(); gameState.teams = ["B", "A"].map(freshTeam);
      teamAlphaSort = false; teamSortSnapshot = undefined; collapsedSections.clear(); collapsedQuestions.clear(); renderAll();`);
  });

  for (const key of ["Enter", " "]) {
    const name = key === " " ? "Space" : key;

    it(`${name} on a section header closes it, and a second press opens it`, () => {
      const header = $("#sec-teams .section-header");
      const clicks = countClicks(header);
      press(header, key);
      assert.equal(clicks(), 1);
      assert.equal(run(`collapsedSections.has("sec-teams")`), true);
      press(header, key);
      assert.equal(run(`collapsedSections.has("sec-teams")`), false);
    });

    it(`${name} on a question header toggles the question once`, () => {
      const header = $("#qblock-0-0 .q-header-left");
      const clicks = countClicks(header);
      press(header, key);
      assert.equal(clicks(), 1);
      assert.equal(run(`collapsedQuestions.has("0-0")`), true);
    });

    it(`${name} on a button inside a header is left to that button`, () => {
      const header = $("#sec-teams .section-header");
      const clicks = countClicks(header);
      const e = press($("#sec-teams .section-header .q-alpha-btn"), key);
      assert.equal(e.defaultPrevented, false, "the button's own activation must not be cancelled");
      assert.equal(clicks(), 0);
      assert.equal(run(`collapsedSections.has("sec-teams")`), false);
    });
  }
});

describe("v22.104 wide scoring rows", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "..", "css/styles.css"), "utf8");

  it("--sort-w is the sum of the three fixed button widths and their two gaps", () => {
    const rem = (re) => Number(css.match(re)[1]);
    const sort = rem(/\.q-header-right>:is\(\.q-sort-btn,\.q-alpha-btn,\.q-reset-btn\)\{width:([\d.]+)rem/);
    const alpha = rem(/\.q-header-right>\.q-alpha-btn\{width:([\d.]+)rem\}/);
    const reset = rem(/\.q-header-right>\.q-reset-btn\{width:([\d.]+)rem\}/);
    const gap = Number(css.match(/\.q-header-right\{[^}]*column-gap:(\d+)px\}/)[1]);
    const total = css.match(/--sort-w:calc\(([\d.]+)rem \+ (\d+)px\)/);
    assert.equal(Number(total[1]).toFixed(2), (sort + alpha + reset).toFixed(2));
    assert.equal(Number(total[2]), gap * 2);
  });

  it("rows end their controls at the Reset Sort edge, and A-Z has the larger picture", () => {
    assert.match(css, /padding-right:max\(10px,calc\(100% \+ 4px - var\(--title-w,var\(--score-col\)\) - var\(--sort-w\)\)\)/);
    assert.match(css, /\.q-alpha-btn:not\(\.team-guess-btn\) \.icon-ui\{width:1\.75em;height:1\.75em\}/);
  });
});

describe("v22.104 wager dropdown and pre-wager scores", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "..", "css/styles.css"), "utf8");
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("the wide wager dropdown is as tall as the correct / incorrect buttons", () => {
    const button = css.match(/^\.result-btn\{min-width:[\d.]+rem;min-height:([\d.]+)rem/m)[1];
    const select = css.match(/\.special-wager-row>\.sw-select\{appearance:none;[^}]*height:([\d.]+)rem/)[1];
    assert.equal(select, button);
  });

  it("pre-wager scores are wrapped so the wide layout can place them", () => {
    const html = evalIn(window, `gameState = freshState(); gameState.teams = ["A"].map(freshTeam); renderStandings("halftime")`);
    assert.match(html, /<td class="standings-pts"><span class="st-score">0<\/span><\/td>/);
    assert.match(html, /<th><span class="st-score">Score<\/span><\/th>/);
    assert.match(css, /\.standings-table \.st-score\{display:inline-block;min-width:3\.7rem;text-align:center\}/);
  });
});

describe("v22.104 narrower score boxes", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "..", "css/styles.css"), "utf8");
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());
  const run = (js) => evalIn(window, js);

  it("only the score boxes and the text between them are limited, not the round cards", () => {
    assert.match(css, /\.section-body>:is\(\.question-block,\.special-section,\.standings-block,\.banter,\.staff-thanks\)\{max-width:var\(--fit\)\}/);
  });

  it("records a header title's width on its block, and keeps it while hidden", () => {
    run(`gameState = freshState(); gameState.teams = ["A"].map(freshTeam); renderAll();
      window.__t = document.querySelector("#qblock-0-0 .q-header-left");
      __t.getBoundingClientRect = () => ({ width: 163.5 }); setTitleWidth(__t);`);
    const width = () => run(`document.getElementById("qblock-0-0").style.getPropertyValue("--title-w")`);
    assert.equal(width(), "163.5px");
    run(`__t.getBoundingClientRect = () => ({ width: 0 }); setTitleWidth(__t);`);
    assert.equal(width(), "163.5px");
  });
});
