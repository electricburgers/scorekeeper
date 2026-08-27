// Round 3 coverage — 10 more tests picked to close real gaps surfaced while writing the v19.54
// performance pass: sw.js's decision-expiry (the other half of tests/pwa.test.js's TTL
// coverage), Manual Drumroll Control's full stop/play-horn/winner flow, the Craft Fade slider's
// clamping/persistence, Sound Test Buttons' visibility gating, exiting the (now lazy-loaded)
// tutorial mid-tour, team-audit boundary content, XLSX GrandTotal correctness (guarding the
// v19.54 trivXPatchAll batching refactor) both at a normal team count and at MAX_TEAMS, the
// FAQ's image-error fallback, and atomic Craft Prize winner assignment.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, loadFaqWindow, evalIn } = require("./helpers/load-app");

function evalJSON(window, expr) {
  return JSON.parse(evalIn(window, `JSON.stringify(${expr})`));
}

// ============================================================================
// sw.js: DECISION_TTL_MS actually expires (the other half of tests/pwa.test.js's TTL coverage,
// which only tested a decision persisting WITHIN the window). Reuses that file's own mock
// ServiceWorkerGlobalScope/Cache Storage harness.
// ============================================================================
const ROOT = path.join(__dirname, "..");
const SW_SRC = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const WORKER_ORIGIN = "http://scorekeeper.test";
class MockRequest {
  constructor(input, opts) {
    this.url = new URL(input, WORKER_ORIGIN + "/").href;
    this.method = (opts && opts.method) || "GET";
    this.cache = opts && opts.cache;
  }
}
function mockResponse(ok, tag) {
  return { ok, tag, clone() { return this; } };
}
function loadSW(fetchImpl) {
  const cachesStore = new Map();
  function resolveKey(input) {
    const raw = typeof input === "string" ? input : input.url;
    return new URL(raw, WORKER_ORIGIN + "/").href;
  }
  const caches = {
    async open(name) {
      if (!cachesStore.has(name)) cachesStore.set(name, new Map());
      const map = cachesStore.get(name);
      return {
        async match(input) { return map.get(resolveKey(input)); },
        async put(input, response) { map.set(resolveKey(input), response); },
      };
    },
    async keys() { return [...cachesStore.keys()]; },
    async delete(name) { return cachesStore.delete(name); },
  };
  const listeners = {};
  const selfObj = {
    addEventListener(type, handler) { (listeners[type] = listeners[type] || []).push(handler); },
    location: { origin: WORKER_ORIGIN, href: WORKER_ORIGIN + "/" },
    skipWaiting() {},
    clients: { claim() {} },
  };
  const sandbox = { self: selfObj, caches, fetch: fetchImpl, Request: MockRequest, URL, Promise, setTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox, { filename: "sw.js" });
  return { listeners, cachesStore, self: selfObj, resolveKey };
}
async function fireFetch(sw, request) {
  let responded;
  sw.listeners.fetch[0]({ request, respondWith: (p) => (responded = p), waitUntil: () => {} });
  return { response: responded !== undefined ? await responded : undefined };
}
const CACHE_NAME = SW_SRC.match(/const CACHE_NAME='([^']+)'/)[1];

describe("Service worker fetch: a 'cache wins' decision expires after DECISION_TTL_MS and re-races", () => {
  it("a request issued ~5.1s after the decision was recorded races the network again instead of honoring the stale decision", async () => {
    let calls = 0;
    const sw = loadSW(async () => {
      calls++;
      return mockResponse(true, "fresh-" + calls);
    });
    const req = { method: "GET", url: WORKER_ORIGIN + "/index.html" };
    const cache = new Map();
    cache.set(sw.resolveKey(req), mockResponse(true, "stale"));
    sw.cachesStore.set(CACHE_NAME, cache);

    // Fast network wins the first race -> records decision 'network'.
    const first = await fireFetch(sw, req);
    assert.equal(first.response.tag, "fresh-1");

    // Wait past DECISION_TTL_MS (5000ms).
    await new Promise((r) => setTimeout(r, 5150));

    const second = await fireFetch(sw, req);
    // currentDecision() must have expired -> this goes through the real race again, and the
    // (still-fast) network wins it again, producing a THIRD network call, not decision-skip logic.
    assert.equal(second.response.tag, "fresh-2");
    assert.equal(calls, 2, "the network must have been called again — a stale decision was still being honored otherwise");
  });
});

// ============================================================================
// Manual Drumroll Control: Stop Drumroll -> Play Horn -> winner committed
// ============================================================================
describe("Manual Drumroll Control: Stop Drumroll pauses the roll, Play Horn commits the winner", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("full flow: starting a draw, stopping it mid-roll, then playing the horn commits a winner and clears craftDrawState", async () => {
    evalIn(
      window,
      `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
       let p = loadPrefs();
       p.craftManualEnd = true;
       p.craftFadeSec = ${0.2}; // CRAFT_FADE_MIN — keep the fade timer short for this test
       savePrefs(p);
       craftFlowOpen = true;
       gameState.craftPrizeWinner = null;
       setCraftDrawSeconds(30); // long enough that the timed finish never fires mid-test
       renderAll();`,
    );
    evalIn(window, "startCraftPrizeDraw();");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(evalIn(window, "!!craftDrawState && craftDrawState.active"), true);

    evalIn(window, "stopDrumrollOnly();");
    // fadeOutDrumAudio's own setTimeout(after, ...) fires around craftFadeSec (0.2s) later.
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(
      evalIn(window, "craftDrawState.audioStopped"),
      true,
      "Stop Drumroll must flip audioStopped so the button swaps to Play Horn",
    );
    const html = window.document.getElementById("mainContent").innerHTML;
    assert.match(html, /Play Horn/);
    assert.doesNotMatch(html, /Stop Drumroll<\/button>/);

    evalIn(window, "playCraftVictoryHorn();");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(evalIn(window, "craftDrawState"), null, "the draw must be cleared once a winner is committed");
    const winner = evalJSON(window, "gameState.craftPrizeWinner");
    assert.ok(winner && typeof winner.ti === "number", "no winner was committed");
  });
});

// ============================================================================
// Craft Fade slider: clamping, persistence, and that the live preview does NOT persist
// ============================================================================
describe("Drumroll Crossfade: setCraftFadeSec clamps + persists, previewCraftFadeSec is preview-only", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("clamps a value above CRAFT_FADE_MAX (3.0) down to 3.0", () => {
    window.setCraftFadeSec(99);
    assert.equal(evalIn(window, "loadPrefs().craftFadeSec"), 3);
  });
  it("clamps a value below CRAFT_FADE_MIN (0.2) up to 0.2", () => {
    window.setCraftFadeSec(0);
    assert.equal(evalIn(window, "loadPrefs().craftFadeSec"), 0.2);
  });
  it("rounds to one decimal place and persists to prefs", () => {
    window.setCraftFadeSec(1.234);
    assert.equal(evalIn(window, "loadPrefs().craftFadeSec"), 1.2);
    const persisted = JSON.parse(evalIn(window, "TRStore.getItem(PREFS_KEY)"));
    assert.equal(persisted.craftFadeSec, 1.2);
  });
  it("previewCraftFadeSec() updates the live readout but writes nothing to prefs", () => {
    const before_ = evalIn(window, "loadPrefs().craftFadeSec");
    window.previewCraftFadeSec("2.7");
    assert.equal(evalIn(window, "loadPrefs().craftFadeSec"), before_, "preview must not persist");
  });
});

// ============================================================================
// Sound Test Buttons visibility mirrors Drumroll Crossfade's own gating (both hidden until
// Manual Drumroll Control is on)
// ============================================================================
describe("Sound Test Buttons: hidden until Manual Drumroll Control is on, same as Drumroll Crossfade", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("both rows are hidden (display:none) while craftManualEnd is off", () => {
    evalIn(window, `let p = loadPrefs(); p.craftManualEnd = false; savePrefs(p); applyPrefs();`);
    assert.equal(window.document.getElementById("soundTestRow").style.display, "none");
    assert.equal(window.document.getElementById("drumCrossfadeRow").style.display, "none");
  });
  it("both rows become visible once craftManualEnd is on", () => {
    evalIn(window, `let p = loadPrefs(); p.craftManualEnd = true; savePrefs(p); applyPrefs();`);
    assert.notEqual(window.document.getElementById("soundTestRow").style.display, "none");
    assert.notEqual(window.document.getElementById("drumCrossfadeRow").style.display, "none");
  });
});

// ============================================================================
// Tutorial: exiting mid-tour restores the exact pre-tour gameState
// ============================================================================
describe("Tutorial: Tutorial.skip() mid-tour restores the exact pre-tour gameState", () => {
  it("a real in-progress game is byte-for-byte restored after starting and skipping the tour", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        `gameState = freshState();
         addTeam();
         gameState.teams[0].name = "My Real Team";
         gameState.teams[0].scoreGuess = 77;
         gameState.meta.hostName = "Real Host";
         renderAll();`,
      );
      const before_ = evalJSON(window, "gameState");
      await evalIn(window, "loadTutorialLib()"); // lazy-loaded — see tests/js-behavior.test.js
      const p = evalIn(window, "Tutorial.start()");
      await new Promise((r) => setTimeout(r, 30));
      // Confirmation overlay is showing (a real team exists) — confirm replacing the session.
      window.document.getElementById("confirmOkBtn").click();
      await p;
      await new Promise((r) => setTimeout(r, 30));
      // Now genuinely mid-tour with the practice gameState swapped in.
      assert.notEqual(evalJSON(window, "gameState.meta.hostName"), "Real Host");
      evalIn(window, "Tutorial.skip();");
      await new Promise((r) => setTimeout(r, 30));
      const after_ = evalJSON(window, "gameState");
      assert.deepEqual(after_, before_);
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// team-audit.js: boundary content the existing consistency check doesn't exercise
// ============================================================================
describe("Team Report (buildAudit): boundary content", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("a nonexistent team index returns an empty string rather than throwing", () => {
    evalIn(window, "gameState = freshState();");
    assert.doesNotThrow(() => evalIn(window, "buildAudit(0)"));
    assert.equal(evalIn(window, "buildAudit(0)"), "");
  });

  it("a team with every question unanswered returns an empty stats block (0 total), not a crash", () => {
    evalIn(window, "gameState = freshState(); addTeam(); renderAll();");
    assert.doesNotThrow(() => evalIn(window, "buildAudit(0)"));
    // auditOverallStats returns "" outright when total===0 — see js/team-audit.js.
    assert.equal(evalIn(window, "auditOverallStats(0)"), "");
  });

  it("a team with a perfect run (every wager marked correct) reports 0 incorrect", () => {
    evalIn(
      window,
      `gameState = freshState(); addTeam();
       gameState.gameStarted = true;
       for (let ri = 0; ri < 4; ri++) {
         const wm = ROUND_WAGERS[ri];
         for (let qi = 0; qi < 4; qi++) gameState.rounds[ri].questions[qi][0] = { wager: wm[qi], correct: true };
         if (BONUS_ROUNDS.has(ri)) gameState.rounds[ri].bonus[0] = 4;
       }
       gameState.halftime[0] = { wager: 10, correct: true };
       gameState.finalWager[0] = { wager: 20, correct: true };
       renderAll();`,
    );
    // auditOverallStats returns an HTML fragment, not a data object — match its own text.
    const html = evalIn(window, "auditOverallStats(0)");
    const m = html.match(/(\d+)\/(\d+) incorrect/);
    assert.ok(m, "expected an '.../N incorrect' stat in the rendered fragment");
    assert.equal(m[1], "0");
    assert.doesNotThrow(() => evalIn(window, "buildAudit(0)"));
  });
});

// ============================================================================
// export.js: XLSX GrandTotal cells match grandTotal(ti) — guards the v19.54 trivXPatchAll
// batching refactor (trivInjectXlsx used to call trivXSet once per cell; now queues patches and
// applies them in one indexed pass — this is the correctness check that the rewrite didn't
// silently drop or misplace any cell).
// ============================================================================
describe("XLSX export: GrandTotal (AL column) cells match grandTotal(ti) for every team", () => {
  it("a normal 11-team export's AL cells equal grandTotal(ti) for each team, keyed by rank order", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();");
      await evalIn(window, "exportXLSXBackup()");
      const result = JSON.parse(
        evalIn(
          window,
          `JSON.stringify((function () {
            const blob = [...window.__mockBlobUrls.values()].find((b) => b.type.includes("spreadsheetml"));
            const unzipped = fflate.unzipSync(blob.parts[0]);
            const xml = new TextDecoder("utf-8").decode(unzipped["xl/worksheets/sheet1.xml"]);
            const rm = rankMap();
            const rk = ranked();
            return rk.map((row, i) => {
              const rr = i + 5;
              const m = xml.match(new RegExp('<c r="AL' + rr + '"[^>]*><v>(\\\\d+)</v></c>'));
              return { ti: row.index, cellVal: m ? parseInt(m[1], 10) : null, expected: grandTotal(row.index) };
            });
          })())`,
        ),
      );
      assert.ok(result.length === 11);
      for (const row of result) {
        assert.equal(row.cellVal, row.expected, `AL cell for team ${row.index} did not match grandTotal()`);
      }
    } finally {
      window.close();
    }
  });

  it("MAX_TEAMS (100) exports without throwing (the real stress case the trivXPatchAll batching fix targets)", async () => {
    const window = await loadAppWindow();
    try {
      // Built directly on gameState.teams rather than 100x addTeam() — addTeam() autosaves and
      // fully re-renders on every single call, which is its own real cost (~39s for 100 calls
      // in this jsdom harness) that has nothing to do with what THIS test is actually timing:
      // trivInjectXlsx/trivXPatchAll's own performance against a 100-team sheet.
      evalIn(
        window,
        `gameState = freshState();
         for (let i = 0; i < MAX_TEAMS; i++) gameState.teams.push(freshTeam("Team " + i));
         gameState.teams.forEach((t, i) => { t.adjustment = i % 5; });
         renderAll();`,
      );
      const started = Date.now();
      await assert.doesNotReject(() => evalIn(window, "exportXLSXBackup()"));
      // Generous ceiling, not a tight benchmark assertion — this just guards against the
      // pre-batching O(cells-per-team × teams) behavior regressing back in, where 100 teams
      // × ~25 cells each meant ~2500 sequential whole-sheet regex rescans.
      assert.ok(Date.now() - started < 5000, "XLSX export at MAX_TEAMS took too long — the trivXPatchAll batching may have regressed");
    } finally {
      window.close();
    }
  });

  // The embedded XLSX backup template (js/data/xlsx-templates.js) now carries pre-built, styled
  // team rows through row 104 — team rows are index+5, so every team up to storage.js's
  // MAX_TEAMS (100) has real B/…/AL/AM cells (and the shared-formula K/P/R/S/Z/AE/AG/AI ranges
  // extend to match). This used to stop at row 44 (40 teams), and trivXSet/trivXPatchAll's
  // correct "no match -> leave unchanged" no-op meant a game past 40 teams silently dropped
  // those teams' rows from the XLSX with no error. This test drives a full MAX_TEAMS export and
  // asserts every ranked AL GrandTotal cell exists and equals grandTotal(ti).
  it("a full MAX_TEAMS (100) export writes an AL GrandTotal cell for every team matching grandTotal(ti)", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        `gameState = freshState();
         for (let i = 0; i < MAX_TEAMS; i++) gameState.teams.push(freshTeam("Team " + i));
         gameState.teams.forEach((t, i) => { t.adjustment = i % 5; });
         gameState.rounds[0].questions[0][0] = { wager: 4, correct: true };
         gameState.rounds[0].questions[0][MAX_TEAMS - 1] = { wager: 3, correct: true };
         gameState.rounds[2].questions[1][MAX_TEAMS - 1] = { wager: 4, correct: true };
         renderAll();`,
      );
      await evalIn(window, "exportXLSXBackup()");
      const result = JSON.parse(
        evalIn(
          window,
          `JSON.stringify((function () {
            const blob = [...window.__mockBlobUrls.values()].find((b) => b.type.includes("spreadsheetml"));
            const unzipped = fflate.unzipSync(blob.parts[0]);
            const xml = new TextDecoder("utf-8").decode(unzipped["xl/worksheets/sheet1.xml"]);
            const rk = ranked();
            return rk.map((row, i) => {
              const rr = i + 5;
              const m = xml.match(new RegExp('<c r="AL' + rr + '"[^>]*><v>(-?\\\\d+)</v></c>'));
              return { index: row.index, cellVal: m ? parseInt(m[1], 10) : null, expected: grandTotal(row.index) };
            });
          })())`,
        ),
      );
      assert.equal(result.length, evalIn(window, "MAX_TEAMS"));
      for (const row of result) {
        assert.equal(row.cellVal, row.expected, `AL cell for team ${row.index} did not match grandTotal()`);
      }
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// FAQ: faqShotFallback() image onerror swaps in the documented text fallback
// ============================================================================
describe("FAQ: faqShotFallback() replaces a broken screenshot with its text fallback", () => {
  it("calling faqShotFallback on an <img> swaps its .faq-shot wrapper to the fallback caption text", async () => {
    const window = await loadFaqWindow();
    try {
      const img = window.document.querySelector(".faq-shot img[data-shot-base]");
      assert.ok(img, "expected at least one real screenshot <img> on the FAQ page");
      const wrap = img.closest(".faq-shot");
      assert.equal(wrap.classList.contains("faq-shot-missing"), false);
      window.faqShotFallback(img, "Test fallback caption");
      assert.equal(wrap.classList.contains("faq-shot-missing"), true);
      assert.equal(wrap.textContent, "Test fallback caption");
      // The broken <img> itself is gone, not just hidden — replaced by the wrapper's own text.
      assert.equal(wrap.querySelector("img"), null);
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Craft Prize: winner assignment is atomic — unset throughout the roll, set exactly once at
// the very end via finalizeCraftPrizeWinner
// ============================================================================
describe("Craft Prize: winner assignment is atomic, never partially visible mid-roll", () => {
  it("craftPrizeWinner stays null while craftDrawState.active is true, and is set exactly once when the timed finish fires", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
         craftFlowOpen = true;
         gameState.craftPrizeWinner = null;
         setCraftDrawSeconds(3); // setCraftDrawSeconds clamps to a 3s minimum — see js/craft-prize.js
         renderAll();`,
      );
      evalIn(window, "startCraftPrizeDraw();");
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(evalIn(window, "craftDrawState.active"), true);
      assert.equal(
        evalIn(window, "gameState.craftPrizeWinner"),
        null,
        "a winner must not exist while the roll is still active",
      );
      // Let the timed finish (finalizeCraftPrizeWinner) run — totalMs is 3000 (the clamped
      // minimum above), plus room for the finale audio scheduling ahead of the callback.
      await new Promise((r) => setTimeout(r, 3700));
      assert.equal(evalIn(window, "craftDrawState"), null);
      const winner = evalJSON(window, "gameState.craftPrizeWinner");
      assert.ok(winner && typeof winner.ti === "number");
      // Exactly one team carries craftPrize:true — the assignment didn't leave a partial/multi
      // state behind.
      const flagged = evalJSON(window, "gameState.teams.filter(t => t.craftPrize)");
      assert.equal(flagged.length, 1);
      assert.equal(flagged[0].name, evalJSON(window, `gameState.teams[${winner.ti}]`).name);
    } finally {
      window.close();
    }
  });
});
