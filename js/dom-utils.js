"use strict";

// Collapse/expand toggles below only flip a CSS class (no re-render), so the browser reflows
// in place — normally invisible. But if the collapse shrinks the page enough that the OLD
// scrollTop no longer fits, the browser silently clamps scrollTop to the new max, which reads
// as an odd jump to some unrelated spot rather than a smooth adjustment. Recording the toggled
// element's own viewport position before/after and correcting scrollTop by the same delta keeps
// it visually anchored either way — a real no-op in the common case, and a clean settle (instead
// of a random-feeling clamp) when the container did shrink out from under the old scroll offset.
function toggleClassPreserveScroll(scrollEl, anchorEl, mutate) {
  if (!scrollEl || !anchorEl) {
    mutate();
    return;
  }
  const before = anchorEl.getBoundingClientRect().top;
  mutate();
  const after = anchorEl.getBoundingClientRect().top;
  const delta = after - before;
  if (delta) scrollEl.scrollTop += delta;
}
function toggleSection(id) {
  if (collapsedSections.has(id)) collapsedSections.delete(id);
  else collapsedSections.add(id);
  const el = document.getElementById(id);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("collapsed");
  });
}
// iPadOS 13+ dropped "iPad" from its own user agent and reports as a plain Mac — the standard
// way to tell it apart from an actual Mac is that only the iPad also claims multi-touch support,
// which no desktop Mac does.
const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function dl(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  // target="_blank" used to be set unconditionally here, which is what let a PDF export "open a
  // new link that navigates away from the app" instead of just downloading: Chrome (and other
  // Chromium browsers) DO honor the download attribute on their own — the file saves in place,
  // no navigation, target irrelevant — but pairing it with target="_blank" on a PDF blob can make
  // Chrome's own built-in PDF viewer win the race and open the file in a new tab instead of
  // triggering the download it would have done unprompted. iOS Safari is the one browser that
  // does NOT honor download at all — it navigates the CURRENT tab straight to the blob URL,
  // which reloads the whole page and wipes all in-memory state (mid Tutorial Mode, that meant
  // the practice game vanishing and the host getting dumped back to step 1) — and needs
  // target="_blank" specifically to turn that navigation into a new tab instead, leaving the
  // running tab untouched. No feature-detect distinguishes "actually honors download" from "iOS
  // Safari, which claims to but doesn't", so this checks the platform directly and only sets
  // target where it's actually needed.
  if (IS_IOS) {
    a.target = "_blank";
    a.rel = "noopener";
  }
  a.click();
}
function esc(s) {
  return s
    ? String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
    : "";
}

/* Re-render replaces whole subtrees via innerHTML on almost every tap. Browsers only
   recompute which element is "under the pointer" (and thus its :hover state / cursor) on an
   actual mousemove event — they don't re-run hit-testing just because the DOM changed. So if
   the mouse is sitting still when a click swaps in a brand-new element at that same spot, it
   can keep showing the default arrow until the mouse physically moves again. Tracking the last
   real pointer position and replaying a synthetic mousemove after each render forces the
   browser to re-evaluate hover/cursor immediately against the new DOM. */
let __lastPointerXY = null;
function refreshPointerHover() {
  if (!__lastPointerXY) return;
  const [x, y] = __lastPointerXY;
  const el = document.elementFromPoint(x, y);
  if (el)
    el.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );
}

// BOTTOM SHEET DRAG — swipe the peek strip up to open the sheet, or swipe the open sheet's own
// grab handle down to close it, in addition to plain tapping either one. A small movement
// threshold tells a real swipe apart from a tap, and firing the toggle the instant that
// threshold is crossed (rather than waiting for release) makes it feel like a direct-manipulation
// drag instead of a delayed gesture recognizer.
let suppressNextSheetClick = false;
function bindSheetDrag(el, directionUp, onTrigger) {
  if (!el) return;
  let dragging = false,
    triggered = false,
    startY = 0;
  function onDown(e) {
    dragging = true;
    triggered = false;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
  }
  function onMove(e) {
    if (!dragging || triggered) return;
    let y;
    if (e.touches) {
      if (!e.touches[0]) return; // touch already lifted
      y = e.touches[0].clientY;
    } else {
      if (typeof e.buttons !== "undefined" && e.buttons === 0) {
        onUp();
        return;
      }
      y = e.clientY;
    }
    const deltaY = y - startY;
    const crossed = directionUp ? deltaY < -10 : deltaY > 10;
    if (!crossed) return;
    triggered = true;
    dragging = false;
    // Fire the toggle FIRST, while the suppress flag is still false — onTrigger() calls
    // toggleSidebar() directly, and that function's own suppress-check would otherwise see the
    // flag we're about to set and swallow this very call, making the drag a no-op. Only AFTER
    // the real toggle has happened do we arm the flag, so the browser's own trailing 'click'
    // event (fired on release for elements with an onclick, like the peek strip) gets swallowed
    // instead of re-toggling right back.
    onTrigger();
    suppressNextSheetClick = true;
    // Safety net: some browsers suppress the synthetic click after a touch drag entirely
    // (rather than firing one for toggleSidebar to consume) — self-clear so a stuck flag
    // can't eat one unrelated future tap.
    setTimeout(() => {
      suppressNextSheetClick = false;
    }, 400);
  }
  function onUp() {
    dragging = false;
  }
  el.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  el.addEventListener("touchstart", onDown, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onUp);
  document.addEventListener("touchcancel", onUp);
}