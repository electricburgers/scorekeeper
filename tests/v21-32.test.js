// v21.32 — shared ranking rows, section-level left-pane patching, skip-identical autosave,
// keyboard shortcuts, score progression chart.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const SETUP = `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();`;

describe("ranking rows are shared", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, SETUP);
  });
  after(() => window.close());

  it("finalResultsRows order matches ranked() (reversed)", () => {
    const a = evalIn(window, "ranked().map(r=>r.index).reverse().join()");
    const b = evalIn(window, "finalResultsRows().map(r=>r.index).join()");
    assert.equal(a, b);
  });
  it("desc display order == place order, asc is its reverse", () => {
    const sorted = evalIn(window, `(function(){const rm=rankMap();return gameState.teams.map((_,i)=>i).sort((a,b)=>rm[a]-rm[b]||a-b).join()})()`);
    evalIn(window, `scoreSortMode="desc"`);
    assert.equal(evalIn(window, "getDisplayOrder().join()"), sorted);
    evalIn(window, `scoreSortMode="asc"`);
    assert.equal(evalIn(window, "getDisplayOrder().join()"), sorted.split(",").reverse().join());
    evalIn(window, `scoreSortMode="entry"`);
  });
  it("memoized rows are built once per render pass", () => {
    assert.equal(evalIn(window, "withScoreMemo(()=>teamScoreRows()===teamScoreRows())"), true);
  });
});

describe("left pane patches only changed sections", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, SETUP);
  });
  after(() => window.close());

  it("an unchanged section keeps its DOM node; a changed one is replaced", () => {
    const d = window.document;
    const meta = d.getElementById("sec-meta");
    const r3 = d.getElementById("sec-r3");
    const before = d.getElementById("sec-r1");
    evalIn(window, `gameState.rounds[0].questions[0][0] = {wager:1, correct:false}; renderAll();`);
    assert.equal(d.getElementById("sec-meta"), meta, "Event Details untouched");
    assert.equal(d.getElementById("sec-r3"), r3, "Round 3 untouched");
    assert.notEqual(d.getElementById("sec-r1"), before, "Round 1 re-rendered");
    assert.equal(d.getElementById("mainContent").innerHTML.length > 1000, true);
  });
  it("DOM stays in sync with a from-scratch render", () => {
    const d = window.document;
    const patched = d.getElementById("mainContent").innerHTML;
    evalIn(window, `lastRenderedLeftHTML=null; lastRenderedLeftParts=null; renderAll();`);
    assert.equal(d.getElementById("mainContent").innerHTML, patched);
  });
});

describe("autosave skips identical writes", () => {
  it("does not call setItem when the stored copy already matches", async () => {
    const window = await loadAppWindow();
    evalIn(window, `autosave(); window.__n=0; const s=window.localStorage.setItem.bind(window.localStorage);
      Storage.prototype.setItem=function(k,v){window.__n++;return s(k,v)};`);
    evalIn(window, "autosave(); autosave();");
    assert.equal(evalIn(window, "window.__n"), 0);
    evalIn(window, `gameState.meta.hostName="Zed"; autosave();`);
    assert.equal(evalIn(window, "window.__n"), 1);
    window.close();
  });
});

describe("keyboard shortcuts", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, SETUP);
  });
  after(() => window.close());
  const press = (key, opts = {}, target) => {
    const ev = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
    (target || window.document.body).dispatchEvent(ev);
    return ev;
  };

  it("d / a / e change the scoreboard order", () => {
    press("d");
    assert.equal(evalIn(window, "scoreSortMode"), "desc");
    press("a");
    assert.equal(evalIn(window, "scoreSortMode"), "asc");
    press("e");
    assert.equal(evalIn(window, "scoreSortMode"), "entry");
  });
  it("is ignored while typing in a field or with a modifier", () => {
    const inp = window.document.querySelector("#mainContent input[type=text]");
    press("d", {}, inp);
    assert.equal(evalIn(window, "scoreSortMode"), "entry");
    press("d", { ctrlKey: true });
    assert.equal(evalIn(window, "scoreSortMode"), "entry");
  });
  it("? toggles the help list and Esc closes it", () => {
    press("?");
    assert.ok(window.document.getElementById("shortcutsOverlay").classList.contains("show"));
    press("Escape");
    assert.ok(!window.document.getElementById("shortcutsOverlay").classList.contains("show"));
  });
  it("shortcuts are blocked while another overlay is open", () => {
    window.document.getElementById("auditOverlay").classList.add("show");
    press("d");
    assert.equal(evalIn(window, "scoreSortMode"), "entry");
    window.document.getElementById("auditOverlay").classList.remove("show");
  });
});

describe("score progression chart", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, SETUP);
  });
  after(() => window.close());

  it("every team's last point equals its grand total", () => {
    const ok = evalIn(window, `progressionData().series.every(s => s.pts.length===0 || s.pts[s.pts.length-1]===grandTotal(s.index))`);
    assert.equal(ok, true);
  });
  it("points never cover rounds with no scores", () => {
    evalIn(window, `gameState = freshState(); gameState.teams=[freshTeam("A"),freshTeam("B")]; gameState.rounds[0].questions[0][0]={wager:2,correct:true}; renderAll();`);
    assert.equal(evalIn(window, "progressionData().labels.join()"), "R1");
  });
  it("opens with a sensible default selection and honors picks", () => {
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll(); chartSelection=null; openProgressChart();`);
    const n = evalIn(window, "gameState.teams.length");
    assert.equal(evalIn(window, "chartSelection.size"), n <= 8 ? n : 5);
    evalIn(window, "chartPickPreset('none')");
    assert.equal(evalIn(window, "chartSelection.size"), 0);
    evalIn(window, "chartPick(0,true)");
    assert.equal(window.document.getElementById("chartTeam0").checked, true);
    assert.ok(window.document.getElementById("chartOverlay").classList.contains("show"));
  });
  it("g opens the chart", () => {
    evalIn(window, "closeProgressChart()");
    window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "g", bubbles: true }));
    assert.ok(window.document.getElementById("chartOverlay").classList.contains("show"));
  });
});
