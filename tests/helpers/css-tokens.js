// Resolves the design tokens (CSS custom properties) the app ends up with for one combination of
// Settings > Theme (light/dark) and Settings > Color Vision (0/1/2), straight from css/styles.css,
// so tests can check real contrast ratios instead of trusting comments. Only top-level rules made
// purely of :root / [data-theme="x"] / [data-cb="n"] selectors count (that is where every token
// lives); anything else - classes, descendants, @media - is skipped.
"use strict";
const fs = require("fs");
const path = require("path");

const CSS = fs.readFileSync(path.join(__dirname, "..", "..", "css", "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function topLevelRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1,
      j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    rules.push({ selector, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return rules;
}
const RULES = topLevelRules(CSS);

function matches(compound, theme, cb) {
  const pieces = compound.match(/^(?::root|\[data-(?:theme|cb)="[^"]*"\])+$/) ? compound.match(/:root|\[data-(?:theme|cb)="[^"]*"\]/g) : null;
  if (!pieces) return 0;
  for (const p of pieces) {
    const m = p.match(/\[data-(theme|cb)="([^"]*)"\]/);
    if (!m) continue; // :root
    if (m[1] === "theme" && m[2] !== theme) return 0;
    if (m[1] === "cb" && m[2] !== String(cb)) return 0;
  }
  return pieces.length;
}

function tokensFor(theme, cb) {
  const hits = [];
  RULES.forEach((r, order) => {
    if (r.selector.startsWith("@")) return;
    const spec = Math.max(0, ...r.selector.split(",").map((s) => matches(s.trim(), theme, cb)));
    if (spec) hits.push({ spec, order, body: r.body });
  });
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const t = {};
  hits.forEach((h) => {
    for (const m of h.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) t[m[1]] = m[2].trim();
  });
  return t;
}
function resolve(tokens, value, depth = 0) {
  const m = String(value).match(/^var\((--[\w-]+)\)$/);
  if (m && depth < 10) return resolve(tokens, tokens[m[1]], depth + 1);
  return value;
}
function hexToRgb(h) {
  h = String(h).trim();
  const m = h.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) throw new Error("not a plain hex colour: " + h);
  const x = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((k) => parseInt(x.slice(k, k + 2), 16));
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const COMBOS = [];
["dark", "light"].forEach((theme) => [0, 1, 2].forEach((cb) => COMBOS.push({ theme, cb, name: `${theme}${cb ? " + color vision " + cb : ""}` })));

module.exports = { CSS, tokensFor, resolve, contrast, COMBOS };
