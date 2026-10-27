// v21.1 — the current game mode is named everywhere: per-mode accent colour, tab title, export
// filenames, Event Details / Final Results / Scores / Team Report headings, PDF + XLSX, and the
// Settings tooltips.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");
const { tokensFor, resolve, contrast, COMBOS, CSS } = require("./helpers/css-tokens");

const NAMES = { regular: "Regular Trivia", theme: "Theme Night", tune: "Name That Tune" };
const setup = (mode) =>
  `gameState = freshState(); gameState.meta.mode = "${mode}"; gameState.meta.location = "Bob's Pub"; gameState.meta.date = "2026-08-05";
   gameState.meta.themeName = "Simpsons"; gameState.teams = [freshTeam("Alpha")]; gameState.teams[0].scoreGuess = 40; renderAll();`;

describe("mode is named in the chrome", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  Object.entries(NAMES).forEach(([mode, name]) => {
    it(`${name}: data-mode, tab title, headings, tooltips`, () => {
      evalIn(window, setup(mode));
      const d = window.document;
      assert.equal(d.documentElement.getAttribute("data-mode"), mode);
      assert.equal(d.title, "Scorekeeper - " + name);
      assert.equal(d.querySelector("#sec-meta h2").textContent, "Event Details - " + name);
      assert.equal(d.querySelector("#sec-final h2").textContent.trim(), "Final Results - " + name);
      assert.match(d.getElementById("scoresHeading").textContent, new RegExp("Scores - " + name));
      assert.match(d.getElementById("gameModeSelect").title, new RegExp(name));
      assert.match(d.getElementById("tryExampleBtn").title, new RegExp(name));
      assert.match(d.getElementById("takeTourBtn").title, new RegExp(name));
      assert.match(evalIn(window, "buildAudit(0)"), new RegExp("Team Report \\u2014 " + name));
    });
  });

  it("export filenames end with the mode name", () => {
    evalIn(window, setup("tune"));
    assert.equal(evalIn(window, 'exportFn("pdf")'), "Bobs Pub - 08-05-2026 - Name That Tune.pdf");
    evalIn(window, setup("regular"));
    assert.equal(evalIn(window, 'exportFn("xlsx")'), "Bobs Pub - 08-05-2026 - Regular Trivia.xlsx");
  });
});

describe("exports name the mode in every mode", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());
  Object.entries(NAMES).forEach(([mode, name]) => {
    it(`${name}: PDF GAME field`, async () => {
      evalIn(window, setup(mode));
      await evalIn(window, "exportPDF()");
      const pdf = evalIn(window, `(function(){const b=[...window.__mockBlobUrls.values()].filter(b=>b.type.includes("pdf")).pop(); return new TextDecoder("latin1").decode(b.parts[0]);})()`);
      assert.ok(pdf.includes("(" + name + ")"), "GAME value");
      assert.ok(pdf.includes("(GAME)"));
      assert.ok(pdf.includes("(STANDINGS - " + name.toUpperCase() + ")"));
    });
  });
  it("Regular XLSX carries REGULAR TRIVIA in the title cell", async () => {
    evalIn(window, setup("regular"));
    await evalIn(window, "exportXLSXBackup()");
    const x = evalIn(window, `(function(){const b=[...window.__mockBlobUrls.values()].filter(b=>b.type.includes("spreadsheetml")).pop(); return new TextDecoder().decode(fflate.unzipSync(b.parts[0])["xl/worksheets/sheet1.xml"]);})()`);
    assert.match(x, /<c r="R1"[^>]*><is><t[^>]*>REGULAR TRIVIA</);
  });
});

describe("per-mode accent colour", () => {
  const MODES = ["regular", "theme", "tune"];
  const accent = (theme, cb, mode) => {
    const t = tokensFor(theme, cb, mode);
    return { t, col: resolve(t, t["--mode-accent"]) };
  };
  it("each mode has its own accent, used on the header and section edges", () => {
    for (const m of MODES) assert.match(CSS, new RegExp(`\\[data-mode="${m}"\\]\\{[^}]*--mode-accent:`));
    assert.match(CSS, /\.header\{[^}]*var\(--mode-accent/);
    assert.match(CSS, /\.section-header\{[^}]*var\(--mode-accent/);
  });
  COMBOS.forEach(({ theme, cb, name }) => {
    it(`accents clear 3:1 against header and card backgrounds (${name})`, () => {
      for (const m of MODES) {
        const { t, col } = accent(theme, cb, m);
        for (const bgTok of ["--bg-primary", "--bg-card"]) {
          const c = contrast(col, resolve(t, t[bgTok]));
          assert.ok(c >= 3, `${m} ${col} on ${bgTok} is ${c.toFixed(2)}:1`);
        }
      }
    });
    it(`the three accents are three different colours (${name})`, () => {
      assert.equal(new Set(MODES.map((m) => accent(theme, cb, m).col)).size, 3);
    });
    if (cb) {
      it(`Color Vision ${cb} swaps every accent for its own palette (${theme})`, () => {
        for (const m of MODES) assert.notEqual(accent(theme, cb, m).col, accent(theme, 0, m).col, m);
        // and the two vision modes don't share a palette either
        for (const m of MODES) assert.notEqual(accent(theme, 1, m).col, accent(theme, 2, m).col, m);
      });
    }
  });
});
