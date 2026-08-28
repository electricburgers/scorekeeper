/* SHARED UI — logic identical between the main app (js/app.js, index.html) and the FAQ
   (faq/js/faq.js, faq/index.html), loaded as a plain <script> by both pages before their own.

   Extracted after two real bugs this session traced back to the FAQ's copy of this logic having
   silently drifted from the app's: the Color Vision dropdown ran off the right edge of the
   screen (the FAQ's own position:fixed placement math never got the app's viewport-clamping
   fix), and the Icon Style button had no preview swatch (the FAQ's copy never got that feature
   either). Both pages read/write the same `trivRev6_prefs` localStorage key and use byte-
   identical markup for the widgets covered here, so there's no reason for the JS driving them
   to have been two independently hand-maintained twins in the first place — this file is the
   one implementation both pages now call into, each through its own thin, page-named wrapper
   (toggleCvMenu/faqToggleCvMenu, etc.) so neither page's existing onclick="" attributes needed
   to change.

   Deliberately NOT extracted here: the rest of loadPrefs()/faqLoadPrefs() (the app's shape has
   many more gameplay-only fields the FAQ has no use for) and the Icon Style sweep (the app
   drives dozens of ICON_* template-literal variables from game state; the FAQ sweeps static
   svg[data-emoji] markup — different enough mechanisms that forcing them into one shared
   function would cost more clarity than the duplication it removed). Shared where the two are
   already identical, not forced where they aren't. */

// Both pages had this exact array under a differently-prefixed name (FONT_SIZES / FAQ_FONT_SIZES)
// — same 14 sizes, same DEFAULT_SI index (3 -> 15px), copy-pasted rather than shared.
const SHARED_FONT_SIZES = [
  12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30,
];
const SHARED_DEFAULT_SIZE_INDEX = 3;

// There's only ever one .cv-select-menu on either page, and it re-parents to <body> while open
// (see sharedToggleCvMenu below) — so a lookup scoped to the widget's own root id would find
// nothing once it's open. Everything here goes through this instead, same as each page's own
// (now-removed) cvMenuEl()/faqCvMenuEl() did individually.
function sharedCvMenuEl() {
  return document.querySelector(".cv-select-menu");
}
function sharedCloseCvMenu(rootId) {
  const w = document.getElementById(rootId);
  if (!w) return;
  const menu = sharedCvMenuEl();
  if (menu) {
    menu.classList.remove("cv-open");
    if (menu.parentElement === document.body) w.appendChild(menu);
  }
  w.classList.remove("open");
  w.querySelector(".cv-select-btn")?.setAttribute("aria-expanded", "false");
}
function sharedToggleCvMenu(e, rootId) {
  e.stopPropagation();
  const w = document.getElementById(rootId);
  if (!w) return;
  const willOpen = !w.classList.contains("open");
  document.querySelectorAll(".cv-select.open").forEach((o) => {
    if (o !== w) o.classList.remove("open");
  });
  const btnEl = w.querySelector(".cv-select-btn");
  const menu = sharedCvMenuEl();
  if (!willOpen) {
    sharedCloseCvMenu(rootId);
    return;
  }
  w.classList.add("open");
  btnEl.setAttribute("aria-expanded", "true");
  // Re-parented to <body> for as long as it is open, then put back by sharedCloseCvMenu.
  //
  // position:fixed alone is not enough to place this against the viewport — a fixed element is
  // positioned against the nearest ancestor that has a transform, not the viewport, and
  // .settings-panel has one for its slideDown animation (the app's .header also has
  // translateZ(0), for an iOS repaint fix). So the panel (or header) was the real containing
  // block, and coordinates computed against the viewport landed off by exactly that ancestor's
  // own offset. <body> has no transform, so from there fixed really does mean the viewport.
  //
  // It also lifts the menu clear of whatever stacking context it was otherwise trapped inside
  // (.settings-panel, .header, .faq-header) — its own z-index counts for nothing nested in
  // those, which is what let the app's tutorial callout paint straight over an open menu during
  // the Color Vision step before this existed.
  menu.classList.add("cv-open");
  document.body.appendChild(menu);
  const btn = btnEl.getBoundingClientRect();
  menu.style.minWidth = btn.width + "px";
  const menuRect = menu.getBoundingClientRect();
  let left = btn.left;
  if (left + menuRect.width > window.innerWidth - 8)
    left = btn.right - menuRect.width;
  menu.style.left = Math.max(8, left) + "px";
  let top = btn.bottom + 4;
  // Flip above the button instead of below when opening downward would run past the bottom of
  // the viewport.
  if (top + menuRect.height > window.innerHeight - 8)
    top = btn.top - menuRect.height - 4;
  menu.style.top = Math.max(8, top) + "px";
}
// Reflects the selected option into the closed button: its short label, and (mirrored from the
// option's own markup, not redrawn — one source for both) the swatch pair a mode swaps to, so
// the two colours are visible without opening the menu. "Off" has no swatch pair, so this clears
// it rather than leaving a stale one from whatever was picked before.
function sharedSetCvSelectDisplay(rootId, v) {
  const w = document.getElementById(rootId);
  const menu = sharedCvMenuEl();
  if (!w || !menu) return;
  const li = menu.querySelector('li[data-value="' + v + '"]');
  menu
    .querySelectorAll("li")
    .forEach((o) => o.setAttribute("aria-selected", "false"));
  if (!li) return;
  li.setAttribute("aria-selected", "true");
  const lbl = w.querySelector(".cv-select-label");
  if (lbl) lbl.textContent = li.dataset.short || li.textContent.trim();
  const swatchSrc = li.querySelector(".cv-swatch-pair");
  const swatchDst = w.querySelector(".cv-select-swatch");
  if (swatchDst) swatchDst.innerHTML = swatchSrc ? swatchSrc.innerHTML : "";
}
