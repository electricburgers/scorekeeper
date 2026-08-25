// More behavior tests — real app code (js/question-timer.js, js/dom-utils.js, js/export.js,
// js/team-audit.js, js/content.js, js/icons.js) exercised in jsdom via
// tests/helpers/load-app.js, same approach as tests/js-behavior.test.js and
// tests/gameplay.test.js. Covers previously-untested modules: the question timer, small DOM/
// string utilities, export's date/filename/XML-patch helpers, the Team Report audit, banter/
// staff-thanks cycling, and icon style persistence.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

// evalIn() returns objects/arrays built inside the jsdom window's own vm realm, whose Object/
// Array prototypes are NOT the same prototype objects as this test file's Node realm —
// node:assert/strict's deepEqual checks prototype identity, so comparing one of those against a
// plain literal here fails even when every own property matches. Round-tripping through JSON
// (same trick as tests/gameplay.test.js's evalJSON) sidesteps it.
function evalJSON(window, expr) {
  return JSON.parse(evalIn(window, `JSON.stringify(${expr})`));
}

// ============================================================================
// Question timer — fmtQt / bumpQTimer / setQtDurationSec / renderQtControls
// ============================================================================
describe("Question timer: fmtQt formatting", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("0 seconds formats as 0:00", () => {
    assert.deepEqual(evalJSON(window, "fmtQt(0)"), { neg: false, text: "0:00" });
  });
  it("65 seconds formats as 1:05 (seconds zero-padded, minutes not)", () => {
    assert.deepEqual(evalJSON(window, "fmtQt(65)"), { neg: false, text: "1:05" });
  });
  it("599 seconds formats as 9:59", () => {
    assert.deepEqual(evalJSON(window, "fmtQt(599)"), { neg: false, text: "9:59" });
  });
  it("a negative remaining time formats as neg:true with the absolute value", () => {
    assert.deepEqual(evalJSON(window, "fmtQt(-5)"), { neg: true, text: "0:05" });
  });
});

describe("Question timer: bumpQTimer clamps the idle base duration to QT_MIN_SEC..QT_MAX_SEC", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("repeated +30 nudges from idle never exceed QT_MAX_SEC (900)", () => {
    evalIn(window, "resetQTimer(); qtDurationSec = 890;");
    for (let i = 0; i < 5; i++) window.bumpQTimer(30);
    assert.equal(evalIn(window, "qtDurationSec"), 900);
  });
  it("repeated -30 nudges from idle never go below QT_MIN_SEC (60)", () => {
    evalIn(window, "resetQTimer(); qtDurationSec = 70;");
    for (let i = 0; i < 5; i++) window.bumpQTimer(-30);
    assert.equal(evalIn(window, "qtDurationSec"), 60);
  });
  it("a running timer's nudge is NOT clamped — it can go past the idle max/min freely", () => {
    evalIn(window, "resetQTimer(); toggleQTimer();"); // starts running at the default duration
    const before_ = evalIn(window, "qtEndEpoch");
    window.bumpQTimer(3000); // way past QT_MAX_SEC's worth of seconds
    assert.equal(evalIn(window, "qtEndEpoch"), before_ + 3000 * 1000);
  });
});

describe("Question timer: setQtDurationSec persists to prefs and clamps its input", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("sets qtDurationSec and saves it under the qtDurationSec prefs key", () => {
    window.setQtDurationSec(300);
    assert.equal(evalIn(window, "qtDurationSec"), 300);
    const persisted = JSON.parse(evalIn(window, "TRStore.getItem(PREFS_KEY)"));
    assert.equal(persisted.qtDurationSec, 300);
  });
  it("clamps a value above QT_MAX_SEC down to QT_MAX_SEC", () => {
    window.setQtDurationSec(99999);
    assert.equal(evalIn(window, "qtDurationSec"), evalIn(window, "QT_MAX_SEC"));
  });
  it("clamps a value below QT_MIN_SEC up to QT_MIN_SEC", () => {
    window.setQtDurationSec(1);
    assert.equal(evalIn(window, "qtDurationSec"), evalIn(window, "QT_MIN_SEC"));
  });
  it("a garbage (non-numeric) value falls back to QT_DEFAULT_SEC", () => {
    window.setQtDurationSec("not-a-number");
    assert.equal(evalIn(window, "qtDurationSec"), evalIn(window, "QT_DEFAULT_SEC"));
  });
});

describe("Question timer: renderQtControls reflects qtState in the toggle button's classes", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("idle: neither qtimer-pause nor qtimer-resume, aria-label is Start timer", () => {
    evalIn(window, 'qtState = "idle"; renderQtControls();');
    const btn = window.document.querySelector(".qtimer-toggle");
    assert.equal(btn.classList.contains("qtimer-pause"), false);
    assert.equal(btn.classList.contains("qtimer-resume"), false);
    assert.equal(btn.getAttribute("aria-label"), "Start timer");
  });
  it("running: qtimer-pause is set, qtimer-resume is not, aria-label is Pause timer", () => {
    evalIn(window, 'qtState = "running"; renderQtControls();');
    const btn = window.document.querySelector(".qtimer-toggle");
    assert.equal(btn.classList.contains("qtimer-pause"), true);
    assert.equal(btn.classList.contains("qtimer-resume"), false);
    assert.equal(btn.getAttribute("aria-label"), "Pause timer");
  });
  it("paused: qtimer-resume is set, qtimer-pause is not, aria-label is Resume timer", () => {
    evalIn(window, 'qtState = "paused"; renderQtControls();');
    const btn = window.document.querySelector(".qtimer-toggle");
    assert.equal(btn.classList.contains("qtimer-resume"), true);
    assert.equal(btn.classList.contains("qtimer-pause"), false);
    assert.equal(btn.getAttribute("aria-label"), "Resume timer");
  });
});

// ============================================================================
// dom-utils.js — esc() and toggleClassPreserveScroll()
// ============================================================================
describe("esc(): HTML-escapes free text before it's interpolated into rendered markup", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("escapes &, <, >, and \" ", () => {
    assert.equal(
      evalIn(window, `esc('<img src=x onerror="alert(1)">&Co')`),
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;Co",
    );
  });
  it("does NOT escape a single quote/apostrophe (matches the app's existing behavior)", () => {
    assert.equal(evalIn(window, `esc("Bob's Team")`), "Bob's Team");
  });
  it("returns an empty string for falsy input rather than the literal string 'null'/'undefined'", () => {
    assert.equal(evalIn(window, "esc(null)"), "");
    assert.equal(evalIn(window, "esc(undefined)"), "");
    assert.equal(evalIn(window, 'esc("")'), "");
  });
  it("passes plain text through completely unchanged", () => {
    assert.equal(evalIn(window, `esc("Trivia Newton John")`), "Trivia Newton John");
  });
});

describe("toggleClassPreserveScroll: compensates scrollTop by the anchor's own on-screen shift", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("shifts scrollTop by exactly (after.top - before.top) around the mutate() call", () => {
    const out = evalIn(
      window,
      `(function () {
        const scrollEl = document.createElement("div");
        const anchorEl = document.createElement("div");
        scrollEl.scrollTop = 50;
        let calls = 0;
        anchorEl.getBoundingClientRect = function () {
          calls++;
          return { top: calls === 1 ? 200 : 235, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
        };
        let mutated = false;
        toggleClassPreserveScroll(scrollEl, anchorEl, () => { mutated = true; });
        return JSON.stringify({ scrollTop: scrollEl.scrollTop, mutated, calls });
      })();`,
    );
    const result = JSON.parse(out);
    assert.equal(result.mutated, true);
    assert.equal(result.calls, 2);
    assert.equal(result.scrollTop, 50 + (235 - 200));
  });
  it("is a no-op on scrollTop when the anchor didn't move (delta is 0 — falsy, so the write is skipped)", () => {
    const out = evalIn(
      window,
      `(function () {
        const scrollEl = document.createElement("div");
        const anchorEl = document.createElement("div");
        scrollEl.scrollTop = 12;
        anchorEl.getBoundingClientRect = () => ({ top: 50, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
        toggleClassPreserveScroll(scrollEl, anchorEl, () => {});
        return scrollEl.scrollTop;
      })();`,
    );
    assert.equal(out, 12);
  });
  it("calls mutate() and doesn't throw when scrollEl/anchorEl are missing", () => {
    const out = evalIn(
      window,
      `(function () {
        let mutated = false;
        toggleClassPreserveScroll(null, null, () => { mutated = true; });
        return mutated;
      })();`,
    );
    assert.equal(out, true);
  });
});

// ============================================================================
// export.js — date formatting, filename generation, and the XLSX template's XML patcher
// ============================================================================
describe("isoToMDY / isoToPretty: date formatting", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it('isoToMDY("2026-08-05") formats as 08-05-2026', () => {
    assert.equal(evalIn(window, 'isoToMDY("2026-08-05")'), "08-05-2026");
  });
  it('isoToMDY("2026-01-05") keeps the zero-padded single-digit month intact', () => {
    assert.equal(evalIn(window, 'isoToMDY("2026-01-05")'), "01-05-2026");
  });
  it("isoToMDY of a falsy value returns an empty string", () => {
    assert.equal(evalIn(window, "isoToMDY(\"\")"), "");
    assert.equal(evalIn(window, "isoToMDY(null)"), "");
  });
  it('isoToPretty("2026-08-05") formats as "Aug 5, 2026" (day not zero-padded)', () => {
    assert.equal(evalIn(window, 'isoToPretty("2026-08-05")'), "Aug 5, 2026");
  });
  it('isoToPretty("2026-12-25") formats as "Dec 25, 2026"', () => {
    assert.equal(evalIn(window, 'isoToPretty("2026-12-25")'), "Dec 25, 2026");
  });
  it("isoToPretty of a falsy value returns an empty string", () => {
    assert.equal(evalIn(window, "isoToPretty(\"\")"), "");
  });
});

describe("exportFn: export filename generation", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("sanitizes the Location and appends the date and extension", () => {
    evalIn(
      window,
      `gameState = freshState();
       gameState.meta.location = "Bob's Pub";
       gameState.meta.date = "2026-08-05";`,
    );
    assert.equal(evalIn(window, 'exportFn("pdf")'), "Bobs Pub - 08-05-2026.pdf");
  });
  it('falls back to "Trivia" when Location is blank', () => {
    evalIn(
      window,
      `gameState = freshState();
       gameState.meta.location = "";
       gameState.meta.date = "2026-08-05";`,
    );
    assert.equal(evalIn(window, 'exportFn("xlsx")'), "Trivia - 08-05-2026.xlsx");
  });
});

describe("trivXFind / trivXSet: XLSX template XML cell patching", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("trivXSet replaces a numeric cell's value without touching a sibling cell", () => {
    const xml = '<row><c r="A1" s="12"/><c r="B1" s="12"/></row>';
    const out = evalIn(window, `trivXSet(${JSON.stringify(xml)}, "A1", "n", 42)`);
    assert.equal(out, '<row><c r="A1" s="12"><v>42</v></c><c r="B1" s="12"/></row>');
  });
  it("trivXSet replaces a string cell as an escaped inlineStr, preserving the cell's own style", () => {
    const xml = '<row><c r="C2" s="7"/></row>';
    const out = evalIn(
      window,
      `trivXSet(${JSON.stringify(xml)}, "C2", "s", "Rock & <Roll>")`,
    );
    assert.equal(
      out,
      '<row><c r="C2" s="7" t="inlineStr"><is><t xml:space="preserve">Rock &amp; &lt;Roll&gt;</t></is></c></row>',
    );
  });
  it("trivXSet returns the XML unchanged when the target ref doesn't exist in it", () => {
    const xml = '<row><c r="A1" s="1"/></row>';
    const out = evalIn(window, `trivXSet(${JSON.stringify(xml)}, "Z99", "n", 1)`);
    assert.equal(out, xml);
  });
});

// ============================================================================
// Team Report (team-audit.js) — internal consistency with the scoreboard's own grandTotal()
// ============================================================================
describe("Team Report audit: internal consistency with grandTotal()", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("buildAudit()'s own running total matches grandTotal() for the sample game's first team (no 'take a screenshot' consistency-check note)", () => {
    evalIn(window, "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();");
    const html = evalIn(window, "buildAudit(0)");
    assert.ok(
      !html.includes("take a screenshot"),
      "buildAudit's own internal running-total-vs-grandTotal check failed",
    );
    const m = html.match(/aud-total"><span>Grand Total<\/span><span class="val">(-?\d+)</);
    assert.ok(m, "Grand Total figure not found in buildAudit output");
    assert.equal(Number(m[1]), evalIn(window, "grandTotal(0)"));
  });

  it("auditGuessDiff reports the same guess/diff numbers finalResultsRows() computes for that team", () => {
    const rows = evalIn(window, "JSON.stringify(finalResultsRows())");
    const row = JSON.parse(rows).find((r) => r.index === 0);
    const html = evalIn(window, "auditGuessDiff(0, grandTotal(0))");
    // guess and |diff| both surface as plain numbers in the audit's own cells.
    assert.ok(html.includes(">" + row.guess + "<"), "Score Guess cell doesn't match finalResultsRows()");
    assert.ok(
      html.includes(">" + row.diff + "<") || html.includes(">+" + row.diff + "<") || html.includes(">-" + row.diff + "<"),
      "Diff cell doesn't match finalResultsRows()",
    );
  });

  it("auditOverallStats' correct+incorrect count never exceeds the 26 possible answers (16 regular + 2x4 bonus + halftime + final)", () => {
    const html = evalIn(window, "auditOverallStats(0)");
    const m = html.match(/(\d+)\/(\d+) correct/);
    assert.ok(m, "correct/total figure not found");
    assert.ok(Number(m[2]) <= 26, `total answered (${m[2]}) exceeds the 26 possible`);
  });
});

// ============================================================================
// Banter/staff-thanks line cycling — never repeats the same line twice in a row
// ============================================================================
describe("cycleBanter / cycleStaffThanks: never immediately repeats the current line", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("cycleBanter never lands back on the same index it started from", () => {
    const results = evalIn(
      window,
      `(function () {
        banterState = { k: 0 };
        const seen = [];
        for (let i = 0; i < 30; i++) {
          const prev = banterState.k;
          cycleBanter("k", "next");
          seen.push(banterState.k !== prev);
        }
        return JSON.stringify(seen);
      })();`,
    );
    assert.ok(JSON.parse(results).every(Boolean), "cycleBanter repeated the same index at least once");
  });

  it("cycleStaffThanks never lands back on the same index it started from", () => {
    const results = evalIn(
      window,
      `(function () {
        banterState = { "staff-thanks": 0 };
        const seen = [];
        for (let i = 0; i < 30; i++) {
          const prev = banterState["staff-thanks"];
          cycleStaffThanks();
          seen.push(banterState["staff-thanks"] !== prev);
        }
        return JSON.stringify(seen);
      })();`,
    );
    assert.ok(JSON.parse(results).every(Boolean), "cycleStaffThanks repeated the same index at least once");
  });
});

// ============================================================================
// Icon style persists through prefs storage (Settings > Icon Style)
// ============================================================================
describe("Icon style persistence", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("toggleIconStyle() saves the new style under the iconStyle prefs key", () => {
    evalIn(window, `let __p = loadPrefs(); __p.iconStyle = "pictograph"; savePrefs(__p); applyPrefs();`);
    window.toggleIconStyle();
    const persisted = JSON.parse(evalIn(window, "TRStore.getItem(PREFS_KEY)"));
    assert.equal(persisted.iconStyle, "emoji");
  });
  it("toggling back to pictograph persists that too, not just the one-way emoji switch", () => {
    window.toggleIconStyle();
    const persisted = JSON.parse(evalIn(window, "TRStore.getItem(PREFS_KEY)"));
    assert.equal(persisted.iconStyle, "pictograph");
  });
  it("a fresh migrateState()-loaded prefs blob with iconStyle:'emoji' round-trips through applyPrefs() as emoji (button label says Emoji, not Pictograph)", () => {
    evalIn(window, `let __p = loadPrefs(); __p.iconStyle = "emoji"; savePrefs(__p); applyPrefs();`);
    const label = window.document.getElementById("iconStyleToggle").innerHTML;
    assert.ok(label.includes("Emoji"), `expected the icon style button to say Emoji, got: ${label}`);
  });
});
