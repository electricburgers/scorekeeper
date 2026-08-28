// v19.62 — the XLSX backup export now bakes correct cached values into every running-total
// FORMULA cell (K/P/R/Z/AE/AG/AI) and the team-name mirror column (S), so a viewer that doesn't
// recalculate on load (Numbers, Quick Look, Excel in manual-calc mode) shows real numbers
// instead of the template's stale <v>0</v>. The zebra dxf also switched to the canonical
// conditional-format bgColor-only fill form so the stripe actually renders.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

// Runs `setup`, exports the XLSX, and returns { sheet, teams } — the raw sheet1.xml string plus
// each team's grandTotal/guess, so all XML parsing happens here in Node rather than in a fragile
// nested-string regex inside evalIn.
async function exportInfo(window, setup) {
  evalIn(window, setup);
  await evalIn(window, "exportXLSXBackup()");
  return JSON.parse(
    evalIn(
      window,
      `JSON.stringify((function () {
        const blob = [...window.__mockBlobUrls.values()].find((b) => b.type.includes("spreadsheetml"));
        const files = fflate.unzipSync(blob.parts[0]);
        const sheet = new TextDecoder("utf-8").decode(files["xl/worksheets/sheet1.xml"]);
        const teams = gameState.teams.map((t, ti) => ({
          name: t.name,
          grandTotal: grandTotal(ti),
          guess: t.scoreGuess === "" || t.scoreGuess == null ? null : parseInt(t.scoreGuess, 10),
        }));
        return { sheet, teams };
      })())`,
    ),
  );
}

// Cell element (with content) for a ref, and its cached <v> as a number.
function cell(sheet, ref) {
  const m = sheet.match(new RegExp('<c r="' + ref + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)'));
  return m ? m[0] : null;
}
function cachedV(sheet, ref) {
  const el = cell(sheet, ref);
  if (!el) return null;
  const v = el.match(/<v>(-?\d+(?:\.\d+)?)<\/v>/);
  return v ? Number(v[1]) : null;
}

describe("v19.62 — XLSX export bakes correct cached totals", () => {
  it("every team's AG (grand total) cached value equals grandTotal(ti), with the formula kept", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet, teams } = await exportInfo(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      assert.equal(teams.length, 11);
      teams.forEach((t, ti) => {
        const r = ti + 5;
        assert.equal(cachedV(sheet, "AG" + r), t.grandTotal, `AG cached value for "${t.name}"`);
        assert.match(cell(sheet, "AG" + r), /<f/, `AG for "${t.name}" should still carry its <f> for recalc`);
        assert.notEqual(cachedV(sheet, "AG" + r), 0, `AG for "${t.name}" should not be the stale zero`);
      });
    } finally {
      window.close();
    }
  });

  it("K / R / Z running totals are also cached, not left at zero", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet, teams } = await exportInfo(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      // Row 5 = Parliamentary Procedure, a fully-scored team — its subtotals are all non-zero.
      assert.equal(cachedV(sheet, "K5"), 38);
      assert.equal(cachedV(sheet, "R5"), 55);
      assert.equal(cachedV(sheet, "Z5"), 93);
      teams.forEach((t, ti) => {
        // Every subtotal chain must add up to the grand total (guards the per-column arithmetic).
        const r = ti + 5;
        assert.equal(cachedV(sheet, "AG" + r), t.grandTotal);
      });
    } finally {
      window.close();
    }
  });

  it("the AI (Diff) cached value equals guess - grandTotal for every team", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet, teams } = await exportInfo(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      teams.forEach((t, ti) => {
        assert.equal(cachedV(sheet, "AI" + (ti + 5)), (t.guess || 0) - t.grandTotal, `AI for "${t.name}"`);
      });
    } finally {
      window.close();
    }
  });

  it("the S mirror column holds the team name, not the stale 0", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet, teams } = await exportInfo(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      teams.forEach((t, ti) => {
        const el = cell(sheet, "S" + (ti + 5));
        assert.ok(el.includes(esc(t.name)), `S column for "${t.name}" should be the name`);
        assert.doesNotMatch(el, /<v>0<\/v>/, `S column for "${t.name}" should not be the stale 0`);
      });
    } finally {
      window.close();
    }
  });

  it("a team with no scores at all caches AG 0 (not a spurious number)", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet, teams } = await exportInfo(
        window,
        `gameState = migrateState({ teams: [{ name: "Empty Team" }, { name: "Other" }] }); renderAll();`,
      );
      assert.equal(teams[0].grandTotal, 0);
      assert.equal(cachedV(sheet, "AG5"), 0);
    } finally {
      window.close();
    }
  });
});
