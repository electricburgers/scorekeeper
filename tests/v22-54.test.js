// v22.54 — Export & Data renamed Game Submission, buttons grouped under two headings.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow } = require("./helpers/load-app");

describe("v22.54 Game Submission section", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("titles the section Game Submission", () => {
    const h = window.document.querySelector("#sec-export .section-header h2");
    assert.equal(h.textContent.trim(), "Game Confirmation");
    assert.ok(h.querySelector("svg.icon-ui"), "clipboard pictograph missing");
  });

  it("is one ordered list of steps with no XLSX button: backup, Winner Photos, PDF, Game Confirmation", () => {
    const body = window.document.querySelector("#sec-export .section-body");
    assert.equal(body.querySelectorAll(".export-group-title").length, 0);
    assert.ok(!body.querySelector('[onclick*="exportXLSXBackup"]'), "XLSX button should be gone");
    const steps = [...body.querySelectorAll("ol.finish-list > li")];
    assert.equal(steps.length, 4);
    const act = (li) => li.querySelector(".finish-rect").textContent.trim();
    assert.deepEqual(steps.map(act), ["Save backup", "Open the Winner Photos Form", "Download PDF", "Open the Game Confirmation Form"]);
  });
});
