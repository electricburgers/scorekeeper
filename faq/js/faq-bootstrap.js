// Same theme/prefs bootstrap the main app runs before paint, so this page opens already
// matching whatever theme/color-vision mode/text size the host has set — not a flash of the
// wrong theme, and not a page that's stuck in one look regardless of what Settings says.
// Loaded as a plain blocking <script src> (no defer/async) so it still runs before first
// paint, same timing as when this lived inline in <head>.
(function () {
  var PREFS_KEY = "trivRev6_prefs";
  var FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30],
    DEFAULT_SI = 3;
  var theme = "hc-dark",
    cbMode = 0,
    sizeIndex = DEFAULT_SI;
  try {
    var raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (["hc-dark", "hc-light"].includes(p.theme)) theme = p.theme;
      else if (["light", "bw", "hc-light"].includes(p.theme))
        theme = "hc-light";
      if (p.cbMode) cbMode = p.cbMode;
      if (p.sizeIndex != null) sizeIndex = p.sizeIndex;
    }
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
  if (cbMode) document.documentElement.setAttribute("data-cb", String(cbMode));
  var si = Math.max(0, Math.min(FONT_SIZES.length - 1, sizeIndex));
  document.documentElement.style.fontSize = FONT_SIZES[si] + "px";
})();
