// v21.51: A-Z sorting ignores a leading "The" / "An" / "A".
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

describe("A-Z sort ignores leading articles", () => {
  let window;
  before(async () => { window = await loadAppWindow(); });
  after(() => { try { window.close(); } catch { /* ignore */ } });

  it("alphaSortKey strips The/An/A but keeps article-only names", () => {
    assert.equal(evalIn(window, 'alphaSortKey("The Quizzards")'), "Quizzards");
    assert.equal(evalIn(window, 'alphaSortKey("an Apple")'), "Apple");
    assert.equal(evalIn(window, 'alphaSortKey("A Team")'), "Team");
    assert.equal(evalIn(window, 'alphaSortKey("Anchors")'), "Anchors");
    assert.equal(evalIn(window, 'alphaSortKey("The")'), "The");
  });

  it("applyAlphaSort files 'The Quizzards' under Q", () => {
    const names = JSON.stringify(["The Quizzards", "Alpha", "Zed"]);
    const out = evalIn(window, `
      gameState.teams = ${names}.map((n) => ({ name: n }));
      JSON.stringify(applyAlphaSort([0,1,2], "az"))`);
    assert.deepEqual(JSON.parse(out), [1, 0, 2]);
  });
});
