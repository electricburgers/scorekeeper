// v22.48 — scoring-order guard, blocked-scoring toast with a shrinking bar, screen wake lock,
// drumroll haptics, Finish game checklist, and the reduced-motion / contrast / forced-colors CSS.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const CSS = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
const j = (w, code) => JSON.parse(evalIn(w, `JSON.stringify(${code})`));

describe("v22.48 scoring-order guard", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    // A started game with every question empty.
    evalIn(
      window,
      `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
       gameState.rounds.forEach(r => { r.questions = [{}, {}, {}, {}]; });
       gameState.gameStarted = true; renderAll();`,
    );
  });
  after(() => window.close());

  it("Q1 of Round 1 is open; later questions are locked until the one before has a response", () => {
    assert.equal(evalIn(window, "questionLocked(0,0)"), false);
    assert.equal(evalIn(window, "questionLocked(0,1)"), true);
    assert.equal(evalIn(window, "questionLocked(0,3)"), true);
    assert.equal(evalIn(window, "questionLocked(1,0)"), true, "Round 2 Q1 waits on Round 1 Q4");
  });

  it("a blocked tap changes nothing and shows the toast with its shrinking bar", () => {
    evalIn(window, "cycleW(0,1,0,1)");
    assert.deepEqual(j(window, "gameState.rounds[0].questions[1]"), {});
    const toast = window.document.getElementById("appToast");
    assert.ok(toast.classList.contains("show"));
    assert.match(toast.textContent, /Q1 has no responses yet/);
    assert.ok(toast.querySelector(".app-toast-bar.run"), "shrinking bar missing");
  });

  it("locked question blocks show a badge and the dimmed class", () => {
    const blk = window.document.getElementById("qblock-0-1");
    assert.ok(blk.classList.contains("q-locked"));
    assert.ok(blk.querySelector(".q-locked-badge"));
    assert.ok(!window.document.getElementById("qblock-0-0").classList.contains("q-locked"));
  });

  it("one response on Q1 unlocks Q2, and Q2 can then be scored", () => {
    evalIn(window, "cycleW(0,0,0,1)");
    assert.equal(evalIn(window, "questionLocked(0,1)"), false);
    evalIn(window, "cycleW(0,1,0,2)"); // wager 1 is already spent on Q1
    assert.equal(j(window, "gameState.rounds[0].questions[1][0].wager"), 2);
  });

  it("clearing the only response on Q1 does not lock Q2 again while Q2 has its own response", () => {
    evalIn(window, "cycleW(0,0,0,1); cycleW(0,0,0,1)"); // correct -> incorrect -> cleared
    assert.deepEqual(j(window, "gameState.rounds[0].questions[0]"), {});
    assert.equal(evalIn(window, "questionLocked(0,1)"), false, "already-scored question stays editable");
    assert.equal(evalIn(window, "questionLocked(0,3)"), true);
  });
});

describe("v22.48 canScore() blocks with a toast, not a modal", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); gameState.rounds.forEach(r => { r.questions = [{}, {}, {}, {}]; r.bonus = {}; });
       gameState.wager1 = {}; gameState.halftime = {}; gameState.wager3 = {}; gameState.finalWager = {};
       gameState.gameStarted = false; gameState.meta.quizId = ""; renderAll();`);
  });
  after(() => window.close());

  it("a missing Quiz ID explains itself in the toast and opens no dialog", () => {
    assert.equal(evalIn(window, "canScore()"), false);
    const toast = window.document.getElementById("appToast");
    assert.match(toast.textContent, /Scoring is locked: enter a Quiz ID/);
    assert.ok(toast.querySelector(".app-toast-bar.run"));
    assert.equal(window.document.getElementById("confirmOverlay").classList.contains("show"), false);
  });

  it("missing guesses are named in the toast", () => {
    evalIn(window, `gameState.meta.quizId = "AB-123"; gameState.teams[0].scoreGuess = "";`);
    assert.equal(evalIn(window, "canScore()"), false);
    assert.match(window.document.getElementById("appToast").textContent, /every team has a score guess/);
  });
});

describe("v22.48 wake lock and haptics", () => {
  let window;
  let releases;
  before(async () => {
    window = await loadAppWindow();
    releases = 0;
    window.__wl = () => ({ addEventListener() {}, release: async () => { releases++; } });
    evalIn(
      window,
      `Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { window.__req = (window.__req || 0) + 1; return window.__wl(); } } });
       Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
       navigator.vibrate = (p) => { (window.__vibes = window.__vibes || []).push(p); return true; };
       gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));`,
    );
  });
  after(() => window.close());

  it("requests a screen wake lock once a game has teams, and only once", async () => {
    await evalIn(window, "syncWakeLock()");
    await evalIn(window, "syncWakeLock()");
    assert.equal(window.__req, 1);
  });

  it("turning Keep screen awake off releases it", async () => {
    await evalIn(window, "toggleKeepAwake()");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(releases, 1);
    assert.equal(evalIn(window, "loadPrefs().keepAwake"), false);
    assert.equal(window.document.getElementById("keepAwakeBtn").textContent, "Off");
  });

  it("the drumroll finishing buzzes the device", () => {
    evalIn(window, "finalizeCraftPrizeWinner([0])");
    assert.ok(Array.isArray(window.__vibes[0]) && window.__vibes[0].length >= 3);
  });
});

describe("v22.48 Finish game checklist", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();`);
  });
  after(() => window.close());

  const done = () => window.document.querySelectorAll("#finishChecklist .finish-item.done").length;

  it("starts with four unticked steps in backup, Winner Photos, PDF, Game Confirmation order", () => {
    const items = [...window.document.querySelectorAll("#finishChecklist .finish-item")].map((e) => e.textContent);
    assert.equal(items.length, 4);
    assert.match(items[0], /backup/i);
    assert.match(items[0], /\(Optional, just in case\)/);
    assert.match(items[1], /winners. names and photos/);
    assert.match(items[2], /PDF/);
    assert.match(items[3], /Game Confirmation/);
    assert.equal(done(), 0);
  });

  it("ticks as each action happens", () => {
    evalIn(window, "markFinish('photos')");
    assert.equal(done(), 1);
    evalIn(window, "saveToFile()");
    assert.equal(done(), 2);
  });

  it("a new game clears the ticks", () => {
    evalIn(window, "startNewGame()");
    assert.equal(done(), 0);
  });
});

describe("v22.48 CSS", () => {
  it("honors reduced motion, more contrast and forced colors", () => {
    assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{\s*\*,\*::before,\*::after\{animation-duration:\.01ms!important/);
    assert.match(CSS, /@media\(prefers-contrast:more\)/);
    assert.match(CSS, /@media\(forced-colors:active\)/);
  });
  it("sets color-scheme per theme and uses light-dark() with a fallback declaration", () => {
    assert.match(CSS, /:root,\[data-theme="dark"\]\{color-scheme:dark\}/);
    assert.match(CSS, /\[data-theme="light"\]\{color-scheme:light\}/);
    assert.match(CSS, /\.settings-panel\{box-shadow:[^;]*;box-shadow:[^;]*light-dark\(/);
  });
  it("the phone sheet sizes with svh and no 100dvh remains in that rule", () => {
    assert.match(CSS, /height:calc\(100svh - var\(--header-h,67px\) - 8px\)/);
  });
});
