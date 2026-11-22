"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("v22.59 Game Submission steps", () => {
  it("warns (without blocking) when no Craft Prize winner is drawn, and drops the warning once one is", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); gameState.craftPrizeWinner = null; renderAll();");
      assert.ok(window.document.querySelector(".finish-warn"), "warning missing");
      assert.ok(window.document.querySelector("a.photo-upload-btn"), "link must stay usable");
      evalIn(window, "toggleCraftPrize(craftEligiblePool()[0])");
      assert.equal(window.document.querySelector(".finish-warn"), null);
      assert.ok(window.document.querySelector(".winner-copy .wc-label").textContent);
    } finally {
      window.close();
    }
  });

  it("every step is a plain list item (no stepper, nothing disabled) and the backup is labelled Optional", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();");
      assert.equal(window.document.querySelectorAll("#finishChecklist [disabled], #finishChecklist [aria-disabled]").length, 0);
      assert.match(window.document.querySelector("#finishChecklist li").textContent, /\(Optional\)/);
    } finally {
      window.close();
    }
  });
});

describe("v22.59 secureRandomIndex", () => {
  it("stays in range, hits every index, and uses crypto.getRandomValues", async () => {
    const window = await loadAppWindow();
    try {
      const r = evalIn(window, `(() => { let calls = 0; const real = crypto.getRandomValues.bind(crypto);
        const seen = new Set(); crypto.getRandomValues = (b) => { calls++; return real(b); };
        for (let i = 0; i < 400; i++) seen.add(secureRandomIndex(5));
        return { calls, seen: [...seen].sort().join(","), one: secureRandomIndex(1) }; })()`);
      assert.ok(r.calls >= 400);
      assert.equal(r.seen, "0,1,2,3,4");
      assert.equal(r.one, 0);
    } finally {
      window.close();
    }
  });
});
