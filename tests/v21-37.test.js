// v21.37: on iOS Safari the Date input (inline-flex, UA min-width, native chrome) refused to shrink
// to its grid column on phones and overlapped Quiz ID. The input must be taken out of flow inside a
// wrapper that is sized by the grid column, so the input's own intrinsic width can never leak out.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const css = fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8");
const root = postcss.parse(css);

// Declarations of every rule inside a (max-width:600px) @media or @container block whose selector list includes `sel`.
function phoneDecls(sel) {
  const out = {};
  root.walkAtRules(/^(media|container)$/, (at) => {
    if (!/max-width:\s*600px/.test(at.params)) return;
    at.walkRules((r) => {
      if (r.selectors.map((s) => s.trim()).includes(sel)) r.walkDecls((d) => (out[d.prop] = d.value));
    });
  });
  return out;
}

test("phone: Date wrapper is a block sized by its grid column, giving the input a positioning box", () => {
  const w = phoneDecls(".meta-grid .date-native-wrap");
  assert.equal(w.display, "block");
  assert.equal(w.position, "relative");
  assert.equal(w["min-width"], "0");
  assert.match(w["min-height"] || "", /44px/);
});

test("phone: Date input is absolutely filled into the wrapper (intrinsic width cannot leak into layout)", () => {
  const i = phoneDecls(".meta-grid .date-native");
  assert.equal(i.position, "absolute");
  assert.equal(i.inset, "0");
  assert.equal(i.width, "100%");
  assert.equal(i.height, "100%");
  assert.equal(i["min-width"], "0");
  assert.equal(i["max-width"], "100%");
  assert.equal(i["box-sizing"], "border-box");
});

test("phone: Date input drops Safari's native appearance so UA sizing no longer applies", () => {
  const i = phoneDecls(".meta-grid .date-native");
  assert.equal(i["-webkit-appearance"], "none");
  assert.equal(i.appearance, "none");
});
