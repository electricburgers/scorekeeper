// v21.42: in Theme Night the full-width Theme Name field sat between Date and Quiz ID, so Quiz ID
// could never share Date's row. Date and Quiz ID must be adjacent in Event Details, Theme Name after.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const at = (needle) => {
  const i = src.indexOf(needle);
  assert.ok(i > -1, "missing " + needle);
  return i;
};

test("Event Details order: Date, Quiz ID, then Theme Name, then Host Name", () => {
  const date = at('<label>Date</label>');
  const quiz = at('<label>Quiz ID</label>');
  const theme = at('<label>Theme Name</label>');
  const host = at('<label>Host Name</label>');
  assert.ok(date < quiz, "Quiz ID after Date");
  assert.ok(quiz < theme, "Theme Name must come after Quiz ID, not between Date and Quiz ID");
  assert.ok(theme < host, "Theme Name before Host Name");
});

const { describe, it, before, after } = require("node:test");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v21.42 Theme Night report + Advanced settings", () => {
  let window;
  before(async () => { window = await loadAppWindow(); });
  after(() => window.close());

  it("Team Report header shows the Theme Name in Theme Night (and not in Regular Trivia)", () => {
    evalIn(window, `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); gameState.meta.mode = "theme"; gameState.meta.themeName = "Simpsons Night"; renderAll(); openAudit(0);`);
    const head = window.document.querySelector("#auditModal .audit-head").textContent;
    assert.match(head, /Simpsons Night/);
    evalIn(window, `closeAudit(); gameState.meta.mode = "regular"; renderAll(); openAudit(0);`);
    assert.doesNotMatch(window.document.querySelector("#auditModal .audit-head").textContent, /Simpsons Night/);
    evalIn(window, `closeAudit();`);
  });

  it("Keyboard shortcuts and Score progression rows live in Advanced Settings", () => {
    const d = window.document;
    const inAdv = (label) =>
      [...d.querySelectorAll("#advancedGroup .settings-row .size-label")].some((l) => l.textContent.trim() === label);
    const outside = (label) =>
      [...d.querySelectorAll("#settingsPanel .settings-row .size-label")].filter((l) => !l.closest("#advancedGroup")).some((l) => l.textContent.trim() === label);
    for (const label of ["Keyboard shortcuts", "Score progression"]) {
      assert.ok(inAdv(label), label + " should be inside #advancedGroup");
      assert.ok(!outside(label), label + " should no longer be in the main settings list");
    }
  });

  it("Advanced Settings is grouped under headings, each with its rows in order (Icon Style moved in)", () => {
    const d = window.document;
    const kids = [...d.querySelectorAll("#advancedGroup > *")];
    const groups = [];
    for (const k of kids) {
      if (k.classList.contains("settings-group-label")) groups.push([k.textContent.trim(), []]);
      else if (groups.length) { const l = k.querySelector(".size-label"); if (l) groups[groups.length - 1][1].push(l.textContent.trim()); }
      else assert.fail("a row appears before the first group heading");
    }
    assert.deepEqual(groups, [
      ["Display", ["Icon Style", "Row Density", "Row Zebra Stripes", "Game Progress Bar"]],
      ["Scoring", ["Point Adjustments", "Crowd-Wisdom Percentage", "Edit Locked Fields"]],
      ["Timer", ["Question Timer", "Timer Widget", "Timer Stepper Buttons", "Timer Pulse"]],
      ["Craft Prize", ["Craft Prize Eligible List", "Manual Drumroll Control", "Drumroll Crossfade", "Sound Test Buttons"]],
      ["Tools", ["Score progression", "Keyboard shortcuts"]],
    ]);
    const mainLabels = [...d.querySelectorAll("#settingsPanel .settings-row .size-label")].filter((l) => !l.closest("#advancedGroup")).map((l) => l.textContent.trim());
    assert.ok(!mainLabels.includes("Icon Style"), "Icon Style should no longer be in the main list");
  });
});
