// v22.53 — timer progress bar: shrinks left, neutral color, threshold notches, no animation.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v22.53 timer progress bar", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());
  const fills = () =>
    [...window.document.querySelectorAll(".qtimer-bar-fill")].map((f) => f.style.transform);

  it("has a bar in both widget copies, full at idle with notches", () => {
    assert.equal(window.document.querySelectorAll(".qtimer-bar").length, 2);
    assert.deepEqual(fills(), ["scaleX(1.0000)", "scaleX(1.0000)"]);
    const bar = window.document.querySelector(".qtimer-bar");
    assert.ok(bar.hasAttribute("data-n1") && bar.hasAttribute("data-n2"));
    assert.equal(bar.style.getPropertyValue("--qt-n1"), "33.333%");
  });
  it("shrinks with remaining time, holds when paused, empty in overtime", () => {
    evalIn(window, "toggleQTimer(); qtEndEpoch = Date.now() + 90000; tickQTimer();");
    assert.equal(fills()[0], "scaleX(0.5000)");
    evalIn(window, "toggleQTimer();"); // pause
    const held = fills()[0];
    evalIn(window, "tickQTimer();");
    assert.equal(fills()[0], held);
    evalIn(window, "toggleQTimer(); qtEndEpoch = Date.now() - 5000; tickQTimer();");
    assert.equal(fills()[0], "scaleX(0.0000)");
  });
  it("+30s past the starting total keeps the bar full and grows the total", () => {
    evalIn(window, "resetQTimer(); toggleQTimer(); bumpQTimer(30);");
    assert.equal(fills()[0], "scaleX(1.0000)");
    assert.equal(evalIn(window, "qtTotalMs") >= 209000, true);
    evalIn(window, "resetQTimer();");
    assert.equal(evalIn(window, "qtTotalMs"), 180000);
  });
  it("has no animation/transition and never uses the warn/crit colors", () => {
    const css = fs.readFileSync(path.join(__dirname, "../css/styles.css"), "utf8");
    const rules = css.split("\n").filter((l) => /^\.qtimer-bar/.test(l)).join("\n");
    assert.ok(rules.length > 0);
    assert.doesNotMatch(rules, /animation|transition|accent-gold|danger/);
  });
});
