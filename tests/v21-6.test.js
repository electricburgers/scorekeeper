// v21.6: Settings > Team Names > Import keeps only the team names from a saved game.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("import team names", () => {
  it("has a Settings row, a hidden file input and handlers", () => {
    const html = read("index.html");
    assert.match(html, /Team Names<\/span>.*triggerImportTeamNames\(\)/);
    assert.match(html, /id="teamNamesLoadInput"[^>]*onchange="importTeamNamesFromFile\(event\)"/);
    const js = read("js/storage.js");
    assert.match(js, /function importTeamNamesFromFile/);
    assert.match(js, /next\.meta = \{ \.\.\.gameState\.meta \}/);
    assert.match(js, /freshTeam\(n\)/);
  });
  it("version is bumped everywhere", () => {
    assert.match(read("js/app.js"), /APP_VERSION = "v21\.6"/);
    assert.equal(JSON.parse(read("version.json")).version, "v21.6");
  });
});
