// Same theme/prefs bootstrap the main app runs before paint, so this page opens already
// matching whatever theme/color-vision mode/text size the host has set — not a flash of the
// wrong theme, and not a page that's stuck in one look regardless of what Settings says.
// Loaded as a plain blocking <script src> (no defer/async) so it still runs before first
// paint, same timing as when this lived inline in <head>. FONT_SIZES/DEFAULT_SI come from
// js/shared-ui.js (loaded just before this file — see faq/index.html's <head>), the same array
// js/app.js and faq/js/faq.js both use, rather than a third copy of the same 14 numbers.
(function () {
  var PREFS_KEY = "trivRev6_prefs";
  var FONT_SIZES = SHARED_FONT_SIZES,
    DEFAULT_SI = SHARED_DEFAULT_SIZE_INDEX;
  var theme = "dark",
    cbMode = 0,
    sizeIndex = DEFAULT_SI;
  try {
    var raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (["dark", "light"].includes(p.theme)) theme = p.theme;
      // "hc-light"/"hc-dark" ("hc" for high contrast, dropped once that stopped being a
      // separate, optional theme) are what a real returning visitor's stored prefs actually
      // hold as of that rename — recognized here too so their real Light/Dark choice survives
      // it instead of silently defaulting dark (this var's own initial value above) the first
      // time the renamed build loads. "light"/"bw" predate that, same reason, one rename back.
      else if (["light", "bw", "hc-light"].includes(p.theme)) theme = "light";
      if (p.cbMode) cbMode = p.cbMode;
      if (p.sizeIndex != null) sizeIndex = p.sizeIndex;
    }
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
  if (cbMode) document.documentElement.setAttribute("data-cb", String(cbMode));
  var si = Math.max(0, Math.min(FONT_SIZES.length - 1, sizeIndex));
  document.documentElement.style.fontSize = FONT_SIZES[si] + "px";
})();
