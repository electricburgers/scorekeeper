// v21.40: the A-Z sort button is orange (so it reads apart from the cyan Sort button and red Reset),
// with its own palette in each Color Vision mode. Red-Green mode turns "red" into orange, so A-Z must
// NOT be orange there. Every theme/mode combination must keep readable contrast.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const root = postcss.parse(fs.readFileSync(path.join(__dirname, "..", "css/styles.css"), "utf8"));

function vars(sel) {
  const out = {};
  root.walkRules((r) => {
    if (r.selectors.map((s) => s.trim()).includes(sel)) r.walkDecls(/^--az-/, (d) => (out[d.prop] = d.value.trim()));
  });
  return out;
}
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const BG = { dark: "#1c1c1c", light: "#dfe9f8" }; // --bg-input in each theme (what the button sits on)
const combos = [
  ['[data-theme="dark"][data-cb="1"]', "dark"], ['[data-theme="light"][data-cb="1"]', "light"],
  ['[data-theme="dark"][data-cb="2"]', "dark"], ['[data-theme="light"][data-cb="2"]', "light"],
];

test("base: A-Z button reads its colors from --az-* variables with orange defaults", () => {
  const base = vars(":root");
  assert.equal(base["--az-txt"], "var(--txt-orange)");
  assert.equal(base["--az-solid"], "var(--accent-orange)");
  let found = false;
  root.walkRules((r) => { if (r.selectors.includes(".q-alpha-btn") && r.some((d) => d.prop === "color" && /--az-txt/.test(d.value))) found = true; });
  assert.ok(found, ".q-alpha-btn should use var(--az-txt)");
});

for (const [sel, theme] of combos) {
  test(`${sel}: own A-Z palette, readable`, () => {
    const v = vars(sel);
    for (const k of ["--az-txt", "--az-solid", "--az-on"]) assert.match(v[k] || "", /^#[0-9a-f]{6}$|^#[0-9a-f]{3}$/i, `${k} missing`);
    const hex = (c) => (c.length === 4 ? "#" + [...c.slice(1)].map((x) => x + x).join("") : c);
    assert.ok(ratio(hex(v["--az-txt"]), BG[theme]) >= 4.5, "icon colour vs button background");
    assert.ok(ratio(hex(v["--az-on"]), hex(v["--az-solid"])) >= 4.5, "active icon vs active fill");
  });
}

test("Red-Green mode: A-Z is not orange (Reset is orange there)", () => {
  for (const sel of ['[data-theme="dark"][data-cb="1"]', '[data-theme="light"][data-cb="1"]']) {
    const h = vars(sel)["--az-solid"];
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const hue = (() => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const d = mx - mn;
      let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; x *= 60; return x < 0 ? x + 360 : x; })();
    assert.ok(hue < 20 || hue > 50 || false, "hue " + hue + " is in the orange band"); // yellow ~55-60, orange ~25-40
  }
});
