// Loads the real app/FAQ into jsdom and checks they come up without throwing — the cheapest,
// highest-value test there is for a codebase with no build step: if this fails, the app is
// broken for every visitor, not just a test.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, loadFaqWindow, evalIn } = require("./helpers/load-app");

// The main app starts a setInterval(tickQTimer, 200) at load time — an open jsdom window keeps
// that (and the whole Node process, when this file runs test-isolation:"process") alive forever
// if never closed. Every window opened here must be window.close()'d, success or failure.
//
// APP_VERSION/FAQ_VERSION are top-level `const`s (js/app.js, faq/js/faq-bootstrap.js) — a
// lexical-scope-only binding, not a `window` property (see helpers/load-app.js's own top
// comment) — so they must be read via evalIn(), not window.APP_VERSION directly.

test("main app loads without throwing and renders the header", async () => {
  const window = await loadAppWindow();
  try {
    assert.equal(
      window.document.querySelector(".logo")?.textContent.trim(),
      "Score Keeper",
    );
    const version = evalIn(window, "APP_VERSION");
    assert.equal(typeof version, "string");
    assert.ok(version.startsWith("v"));
  } finally {
    window.close();
  }
});

test("FAQ page loads without throwing and renders its header", async () => {
  const window = await loadFaqWindow();
  try {
    assert.ok(
      window.document.querySelector(".faq-logo")?.textContent.includes("Score"),
    );
    assert.equal(typeof evalIn(window, "FAQ_VERSION"), "string");
  } finally {
    window.close();
  }
});

test("main app and FAQ report the same app version scheme (both start with v)", async () => {
  const app = await loadAppWindow();
  const faq = await loadFaqWindow();
  try {
    assert.match(evalIn(app, "APP_VERSION"), /^v\d+\.\d+$/);
    assert.match(evalIn(faq, "FAQ_VERSION"), /^v\d+\.\d+$/);
  } finally {
    app.close();
    faq.close();
  }
});
