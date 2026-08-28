// v19.59 — 10 more tests for this batch: the XLSX export now trims to the game's real team
// count and carries a zebra stripe, Row Zebra Stripes defaults to Medium, the Example Game has
// a 3rd-place tie broken by score guess, Color Vision is gone from both pages, "Take the Tour"'s
// hand icon is tilted, and the JD Upload Form button carries the new Guy Fawkes pictograph.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, loadFaqWindow, evalIn } = require("./helpers/load-app");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

async function exportedSheet(window, setup) {
  evalIn(window, setup);
  await evalIn(window, "exportXLSXBackup()");
  return JSON.parse(
    evalIn(
      window,
      `JSON.stringify((function () {
        const blob = [...window.__mockBlobUrls.values()].find((b) => b.type.includes("spreadsheetml"));
        const files = fflate.unzipSync(blob.parts[0]);
        const dec = new TextDecoder("utf-8");
        return { sheet: dec.decode(files["xl/worksheets/sheet1.xml"]), styles: dec.decode(files["xl/styles.xml"]) };
      })())`,
    ),
  );
}

describe("v19.59 — XLSX export row trimming", () => {
  it("an 11-team export drops every team/filler row past the last team (row 15)", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet } = await exportedSheet(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const rowNums = [...sheet.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1]));
      assert.equal(Math.max(...rowNums), 15, "sheet should end at row 15 for 11 teams");
      assert.ok(!/<row r="16"/.test(sheet), "row 16 (12th team row) should be gone");
      assert.ok(!/<row r="105"/.test(sheet), "JD's trailing filler rows should be gone");
    } finally {
      window.close();
    }
  });

  it("the dimension and every 104-row range are clamped to the real last row", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet } = await exportedSheet(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      assert.match(sheet, /<dimension ref="A1:AN15"\/>/);
      assert.match(sheet, /<f t="shared" ref="K5:K15" si="0">/);
      assert.ok(!sheet.includes(":K104"), "no range should still reach row 104");
      assert.match(sheet, /<sortState ref="AL5:AM15">/);
    } finally {
      window.close();
    }
  });

  it("a MAX_TEAMS export keeps all 100 team rows (no over-trim)", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet } = await exportedSheet(
        window,
        `gameState = freshState();
         for (let i = 0; i < MAX_TEAMS; i++) gameState.teams.push(freshTeam("Team " + i));
         renderAll();`,
      );
      assert.ok(/<row r="104"/.test(sheet), "row 104 (100th team) must survive");
      assert.ok(!/<row r="105"/.test(sheet), "filler past the last team must not");
      assert.match(sheet, /<dimension ref="A1:AN104"\/>/);
    } finally {
      window.close();
    }
  });

  it("a single-team export still produces a valid (non-empty) shared-formula range", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet } = await exportedSheet(
        window,
        `gameState = freshState();
         gameState.teams.push(freshTeam("Solo"));
         renderAll();`,
      );
      assert.match(sheet, /<dimension ref="A1:AN5"\/>/);
      assert.match(sheet, /ref="K5:K5"/);
      assert.ok(/<row r="5"/.test(sheet) && !/<row r="6"/.test(sheet));
    } finally {
      window.close();
    }
  });
});

describe("v19.59 — XLSX zebra striping", () => {
  it("the sheet gets a zebra conditional-format rule over the team rows, below the K-column rule", async () => {
    const window = await loadAppWindow();
    try {
      const { sheet } = await exportedSheet(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      assert.match(
        sheet,
        /<conditionalFormatting sqref="A5:AN15"><cfRule type="expression" dxfId="1" priority="2"><formula>MOD\(ROW\(\),2\)=0<\/formula>/,
      );
      // The existing "cell has a value" highlight stays priority 1 (on top where they overlap).
      assert.match(sheet, /dxfId="0" priority="1"/);
    } finally {
      window.close();
    }
  });

  it("styles.xml gains a second dxf (the grey zebra fill) without disturbing the first", async () => {
    const window = await loadAppWindow();
    try {
      const { styles } = await exportedSheet(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      assert.match(styles, /<dxfs count="2">/);
      const dxfs = styles.match(/<dxfs count="2">([\s\S]*?)<\/dxfs>/)[1];
      const entries = dxfs.match(/<dxf>[\s\S]*?<\/dxf>/g);
      assert.equal(entries.length, 2, "exactly two dxf entries");
      assert.match(entries[0], /FCE8B2/, "the original dxf 0 (K-column highlight) must be kept");
      // dxf 1 is the zebra fill — a conditional-format fill takes the bgColor-only form, NOT the
      // patternType/fgColor form a normal cell fill uses (see trivXAddZebraDxf).
      assert.match(entries[1], /<patternFill><bgColor rgb="FFE0E0E0"\/><\/patternFill>/);
      assert.doesNotMatch(entries[1], /fgColor|patternType/);
    } finally {
      window.close();
    }
  });
});

describe("v19.59 — Row Zebra Stripes default", () => {
  it("fresh prefs default to Medium (stripeLevel 1), applied as data-stripe=1", async () => {
    const window = await loadAppWindow();
    try {
      assert.equal(evalIn(window, "loadPrefs().stripeLevel"), 1);
      evalIn(window, "applyPrefs()");
      assert.equal(
        window.document.documentElement.getAttribute("data-stripe"),
        "1",
      );
      assert.equal(
        window.document.getElementById("stripeToggle").textContent.trim(),
        "Medium",
      );
    } finally {
      window.close();
    }
  });
});

describe("v19.59 — Example Game 3rd-place tie", () => {
  it("Powder Keg of Knowledge and Mastermind Alliance tie on 125, Powder Keg takes 3rd on the closer guess", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const rows = JSON.parse(
        evalIn(window, "JSON.stringify(finalResultsRows())"),
      );
      const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
      const pk = byName["Powder Keg of Knowledge"];
      const ma = byName["Mastermind Alliance"];
      assert.equal(pk.score, 125);
      assert.equal(ma.score, 125);
      assert.equal(pk.place, 3);
      assert.equal(ma.place, 4);
      assert.ok(pk.tie && ma.tie, "both flagged as a score tie");
      assert.ok(pk.tieWinner && !ma.tieWinner, "Powder Keg is the closer guess");
    } finally {
      window.close();
    }
  });
});

describe("v19.59 — Color Vision removed", () => {
  it("neither page ships a cv-select widget, a data-cb attribute, or the cbMode pref default", async () => {
    const app = await loadAppWindow();
    const faq = await loadFaqWindow();
    try {
      assert.equal(app.document.querySelector(".cv-select"), null);
      assert.equal(faq.document.querySelector(".cv-select"), null);
      assert.equal(app.document.documentElement.hasAttribute("data-cb"), false);
      assert.equal("cbMode" in JSON.parse(evalIn(app, "JSON.stringify(loadPrefs())")), false);
      assert.ok(!read("css/styles.css").includes("[data-cb="), "no data-cb CSS rules remain");
    } finally {
      app.close();
      faq.close();
    }
  });
});

describe("v19.59 — icons", () => {
  it('"Take the Tour" hand icon is tilted (matches the 👋 emoji lean)', () => {
    const css = read("css/styles.css");
    const m = css.match(/\.icon-hand\{([^}]*)\}/);
    assert.ok(m, ".icon-hand rule not found");
    assert.match(m[1], /transform:\s*rotate\(-15deg\)/);
  });

  it("the JD Upload Form button carries the Guy Fawkes pictograph and a two-line label", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const a = window.document.querySelector("a.jd-upload-btn");
      assert.ok(a, "JD Upload Form button missing");
      assert.ok(a.classList.contains("export-sq"), "should be a square icon-forward button like XLSX/PDF");
      assert.ok(a.querySelector("svg.icon-fawkes"), "Guy Fawkes icon missing");
      const label = a.querySelector(".export-sq-label").innerHTML;
      assert.match(label, /Upload/);
      assert.match(label, /<br\s*\/?>\s*Form/, "'Form' should sit on its own line, below the icon");
      assert.match(evalIn(window, "ICON_FAWKES"), /icon-fawkes|🎭/);
    } finally {
      window.close();
    }
  });
});
