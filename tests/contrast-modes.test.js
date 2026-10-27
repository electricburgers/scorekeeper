// WCAG 2.1 AA for the Game Mode picker (Settings > Game Mode): its text, its three pictographs
// and its control boundary, in every Theme x Color Vision combination the app can be in.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { CSS, tokensFor, resolve, contrast, COMBOS } = require("./helpers/css-tokens");

const tok = (t, name) => resolve(t, t["--" + name.replace(/^--/, "")]);
// Icon tints exactly as .icon-mode-* declares them in the stylesheet.
const MODE_ICON_RULES = { regular: ".icon-mode-regular", theme: ".icon-mode-theme", tune: ".icon-mode-tune" };
function iconTints(t, rule) {
  const m = CSS.match(new RegExp(rule.replace(".", "\\.") + "\\{([^}]*)\\}"));
  assert.ok(m, rule + " is declared");
  const decl = {};
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) decl[d[1]] = resolve(t, d[2].trim());
  return decl;
}

describe("Game Mode picker meets WCAG 2.1 AA in every theme", () => {
  COMBOS.forEach(({ theme, cb, name }) => {
    describe(name, () => {
      const t = tokensFor(theme, cb);
      const bg = tok(t, "bg-card");

      it("select text and option text are >= 4.5:1 (resting and hover)", () => {
        assert.ok(contrast(tok(t, "text-primary"), bg) >= 4.5, "resting");
        assert.ok(contrast(tok(t, "text-primary"), tok(t, "bg-hover")) >= 4.5, "hover");
      });

      it("the select boundary and focus ring are >= 3:1 (non-text contrast)", () => {
        assert.ok(contrast(tok(t, "border-control"), bg) >= 3, "border");
        assert.ok(contrast(tok(t, "accent-cyan"), bg) >= 3, "focus ring");
      });

      Object.entries(MODE_ICON_RULES).forEach(([mode, rule]) => {
        it(`${mode} pictograph: every tint is >= 4.5:1 on the picker background`, () => {
          const d = iconTints(t, rule);
          for (const k of ["--icon-tint", "--icon-tint-2"]) {
            const c = contrast(d[k], bg);
            assert.ok(c >= 4.5, `${mode} ${k} ${d[k]} is ${c.toFixed(2)}:1`);
          }
        });
      });
    });
  });

  it("light theme: tinted surfaces keep text AA and control borders 3:1 on every surface", () => {
    const t = tokensFor("light", 0);
    const surfaces = ["bg-primary", "bg-card", "bg-card-alt", "bg-input", "bg-hover", "btn-idle-bg"].map((n) => tok(t, n));
    for (const bg of surfaces) {
      for (const txt of ["text-primary", "text-secondary", "text-muted", "txt-cyan", "txt-red", "txt-purple"]) {
        assert.ok(contrast(tok(t, txt), bg) >= 4.5, `${txt} on ${bg}`);
      }
      assert.ok(contrast(tok(t, "border-control"), bg) >= 3, `border-control on ${bg}`);
    }
  });

  it("the dropdown chevron (#888888) clears 3:1 on both card backgrounds", () => {
    assert.match(CSS, /\.theme-select\{[^}]*fill='%23888888'/);
    assert.ok(contrast("#888888", "#0d0d0d") >= 3);
    assert.ok(contrast("#888888", "#ffffff") >= 3);
  });
});
