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
    assert.equal(h.textContent.trim(), "Game Submission");
    assert.ok(h.querySelector("svg.icon-ui"), "clipboard pictograph missing");
  });

  it("groups XLSX/PDF under Download Scoresheet and the forms under Submit Results", () => {
    const body = window.document.querySelector("#sec-export .section-body");
    const titles = [...body.querySelectorAll(".export-group-title")];
    assert.deepEqual(titles.map((t) => t.textContent), ["Download Scoresheet", "Submit Results"]);
    const labels = (t) =>
      [...t.nextElementSibling.querySelectorAll(".export-sq-label")].map((l) => l.textContent);
    assert.ok(titles[0].nextElementSibling.classList.contains("export-bar"));
    assert.deepEqual(labels(titles[0]), ["XLSX", "PDF"]);
    assert.deepEqual(labels(titles[1]), ["Winner Photos", "Game Confirmation"]);
  });
});
