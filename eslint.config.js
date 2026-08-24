// Dev-time lint only — this app has no build step, so nothing here runs in production; it's
// just `npm run lint:js` catching real mistakes (typos, dead code, unreachable branches,
// duplicate keys) before they ship. Deliberately not a style-enforcement system: this codebase
// already has its own very deliberate hand-formatting throughout (long explanatory comments,
// specific line-wrapping choices), and reformatting all of that to satisfy a style ruleset would
// cost far more than it's worth. `js.configs.recommended` covers correctness, not style.
const js = require("@eslint/js");

/** Browser globals every classic <script> here can see (window, document, fetch, etc.) plus the
 * few third-party globals the vendored libraries attach. */
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  console: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Blob: "readonly",
  File: "readonly",
  FileReader: "readonly",
  Audio: "readonly",
  AudioContext: "readonly",
  webkitAudioContext: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  KeyboardEvent: "readonly",
  CustomEvent: "readonly",
  MouseEvent: "readonly",
  Intl: "readonly",
  matchMedia: "readonly",
  getComputedStyle: "readonly",
  self: "readonly",
  caches: "readonly",
  atob: "readonly",
  btoa: "readonly",
  Promise: "readonly",
  structuredClone: "readonly",
  // Vendored libraries (js/vendor/*.min.js) attach these globals; the vendor files themselves
  // aren't linted (see ignores below).
  fflate: "readonly",
  jspdf: "readonly",
  jsPDF: "readonly",
};

module.exports = [
  {
    ignores: [
      "drumroll-pwa/**",
      "js/vendor/**",
      "js/data/xlsx-templates.js",
      "js/data/drum-clips.js",
      "node_modules/**",
      "faq/screenshots/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js", "faq/js/**/*.js", "sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      // Classic <script src> tags, not modules — index.html loads js/shared-ui.js, js/app.js
      // and js/tutorial.js in one shared global lexical environment by design (see
      // js/tutorial.js's own top-of-file note on exactly why), and faq/index.html does the same
      // for its own three files. That's exactly why no-undef is off below rather than trying to
      // enumerate every cross-file function/const as a "global" — a strict check here would be
      // almost entirely false positives, not real bugs.
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      "no-undef": "off",
      // vars:"local" — same reasoning as no-undef above: every top-level function/const here is
      // effectively "exported" to an HTML onclick="" attribute or another <script> sharing this
      // global scope, which no-unused-vars can't see from inside one file alone, so checking
      // top-level (script-scope) declarations would be almost entirely false positives. Local
      // variables inside a function body are genuinely local, though, and worth catching for
      // real — a truly unused local is dead code no matter how this file is loaded.
      "no-unused-vars": [
        "warn",
        {
          vars: "local",
          args: "none",
          varsIgnorePattern: "^_",
          // Same best-effort try/catch pattern no-empty's allowEmptyCatch covers below — an
          // unused catch(e) is that same "nothing to do about it" shape, not dead code.
          caughtErrors: "none",
        },
      ],
      // A handful of best-effort try/catches deliberately swallow an expected failure (e.g.
      // localStorage throwing in private browsing) with nothing to do about it — allowed
      // outright rather than warned on, since that's not dead code, it's the intended behavior.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // recommended sets this to "error"; downgraded to "warn" for the same reason as
      // no-unused-vars above — a few call sites intentionally reuse a broader case fallthrough,
      // and this should flag them for a human glance rather than block on them.
      "no-fallthrough": "warn",
    },
  },
  {
    files: ["eslint.config.js", "stylelint.config.js", ".htmlvalidate.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable" },
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...browserGlobals,
        require: "readonly",
        module: "writable",
        __dirname: "readonly",
        process: "readonly",
        Buffer: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
];
