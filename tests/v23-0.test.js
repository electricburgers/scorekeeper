// v23.0 — a fine slash on used wagers, percentages on their own row under the Sort button, and
// the Score race panel for very wide windows.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const css = read("css/styles.css");

describe("v23.0 styles", () => {
  it("fades a used wager through its colours, so the slash isn't faded with it", () => {
    const used = css.match(/^\.wager-btn\.used\{[^}]*\}/m)[0];
    assert.doesNotMatch(used, /opacity:/);
    assert.match(css, /\.wager-btn\.used::after\{content:'';position:absolute;inset:5px/);
  });

  it("puts the percentages on their own row without widening the score boxes", () => {
    assert.match(css, /:is\(\.q-header,\.sw-header\):has\(\.q-stats-row\)\{flex-wrap:wrap/);
    assert.match(css, /\.q-stats-row\{flex:0 0 100%\}/);
    assert.doesNotMatch(css, /\.col-left:has\(\.q-stats-row\)/);
  });

  it("shows the score race only on very wide windows", () => {
    assert.match(css, /\.race-panel\{display:none\}\n@media \(min-width:2100px\)\{/);
    assert.match(read("index.html"), /<aside class="race-panel" id="racePanel" aria-label="Score race">/);
  });
});

describe("v23.0 score race", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    window.HTMLElement.prototype.scrollIntoView = () => {};
    // jsdom has no layout: give the panel a width so it draws.
    Object.defineProperty(window.document.getElementById("racePanel"), "offsetWidth", { configurable: true, get: () => 700 });
  });
  after(() => window.close());
  const run = (js) => evalIn(window, js);
  const panel = () => window.document.getElementById("racePanel");
  const names = () => [...panel().querySelectorAll(".race-name")].map((e) => e.textContent);
  const colourOf = (name) =>
    [...panel().querySelectorAll(".race-legend button")]
      .find((b) => b.querySelector(".race-name").textContent === name)
      .querySelector(".race-key")
      .getAttribute("style");

  beforeEach(() => {
    run(`raceSlots.clear(); gameState = freshState(); gameState.teams = ["A","B","C","D","E","F","G"].map(freshTeam);
      gameState.gameStarted = true; renderAll();`);
  });
  const score = (ti, wager, qi = 0) => run(`gameState.rounds[0].questions[${qi}][${ti}] = { wager: ${wager}, correct: true };`);

  it("asks for a score before there is anything to draw", () => {
    assert.match(panel().textContent, /Score a question to start the race/);
  });

  it("lists the top five by score and counts the rest", () => {
    [1, 2, 3, 4].forEach((w, ti) => score(ti, w));
    run("renderSB()");
    assert.deepEqual(names(), ["D", "C", "B", "A", "E"]);
    assert.match(panel().textContent, /the other 2 teams/);
    assert.match(panel().textContent, /Running totals by round/);
  });

  it("keeps each team's colour when the order changes", () => {
    [1, 2, 3, 4].forEach((w, ti) => score(ti, w));
    run("renderSB()");
    const before_ = { A: colourOf("A"), D: colourOf("D") };
    score(0, 4, 1);
    run("renderSB()");
    assert.equal(names()[0], "A");
    assert.equal(colourOf("A"), before_.A);
    assert.equal(colourOf("D"), before_.D);
  });

  it("gives a newcomer the colour of the team it pushed out", () => {
    [1, 2, 3, 4].forEach((w, ti) => score(ti, w));
    run("renderSB()");
    const outColour = colourOf("E");
    score(5, 4);
    run("renderSB()");
    assert.ok(!names().includes("E"));
    assert.equal(colourOf("F"), outColour);
  });

  it("marks an unfinished round, and escapes team names", () => {
    run(`gameState.teams[0].name = '<img src=x onerror=alert(1)>';`);
    score(0, 4);
    run("renderSB()");
    assert.equal(panel().querySelector("img"), null);
    assert.equal(run("renderScoreRace.data.partial"), true);
    const svg = run(`raceSvg(600, 400, ["R1"], renderScoreRace.data.series, renderScoreRace.data.order, renderScoreRace.data.slots, true)`);
    assert.match(svg, /R1 so far/);
    assert.doesNotMatch(svg, /<img/);
  });

  it("keeps negative totals on the chart", () => {
    const svg = run(`raceSvg(600, 400, ["R1","R2"], [{ index: 0, name: "A", pts: [5, -8] }], [0], [0], false)`);
    assert.doesNotMatch(svg, /NaN/);
    assert.match(svg, />-10</);
  });
});

describe("v23.0 dark points boxes", () => {
  it("fills them at 25% in the default and colour-blind dark palettes, light theme staying solid", () => {
    const fills = [...css.matchAll(/--pts-(?:pos|neg)-bg:([^;}]+)/g)].map((m) => m[1]);
    assert.equal(fills.filter((v) => /^rgba\(.*,\.25\)$/.test(v)).length, 4);
    assert.equal(fills.filter((v) => /^#[0-9a-f]{6}$/i.test(v)).length, 4);
  });
});
