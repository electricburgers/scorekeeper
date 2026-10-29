// v21.8: the Game Mode dropdown follows Icon Style (pictograph beside it / emoji in the options).
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("Game Mode dropdown icon style", () => {
  const app = read("js/app.js");
  it("emoji mode prefixes each option with its emoji, pictograph mode leaves them plain", () => {
    assert.match(app, /MODE_EMOJI = \{ regular: "🎯", theme: "🎭", tune: "🎵" \}/);
    assert.match(app, /\(emoji \? MODE_EMOJI\[o\.value\] \+ " " : ""\) \+ gameModeName\(o\.value\)/);
  });
  it("pictograph mode shows the drawn icon beside the select; emoji mode empties it", () => {
    assert.match(app, /icon\.innerHTML = emoji\s*\? ""\s*: \{ regular: ICON_MODE_REGULAR_PICT/);
    assert.match(read("css/styles.css"), /#gameModeIcon:empty\{display:none\}/);
  });
});
