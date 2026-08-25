"use strict";


/* ============ QUESTION TIMER ============
   A standalone per-question countdown — the host starts/pauses/resets it manually, independent
   of gameState (not saved/resumed with the session, same as craftDrawState above). There are
   two DOM copies of the widget (desktop: bottom of the scores sidebar; mobile: docked under the
   scores peek strip — see index.html/styles.css), kept in sync by operating on every element
   matching each .qtimer-* class rather than a single id. It ticks on its own short interval
   instead of going through renderAll(), so the big score sheet never re-renders just because a
   second passed. No sound — visual state only (flashing background, not a full render). */
const QT_MIN_SEC = 60,
  QT_MAX_SEC = 900,
  QT_DEFAULT_SEC = 180;
let qtDurationSec = QT_DEFAULT_SEC,
  qtEndEpoch = 0,
  qtRemainMs = 0,
  qtState = "idle"; // idle | running | paused

// The two .qtimer-display/.qtimer-toggle/.qtimer-reset pairs (desktop + mobile — see the file
// note above) are static markup baked into index.html, outside #mainContent/#sidebarBody, so
// unlike almost everything else in this app they're never torn down and rebuilt by an innerHTML
// rewrite. That makes it safe to query them once and reuse the NodeList, instead of re-running
// querySelectorAll on every 200ms tick (tickQTimer, ~5x/sec for the whole time a timer is
// running or paused) just to find the same two nodes again.
let qtDisplayEls = null,
  qtLastDisplayText = null,
  qtLastDisplayNeg = false;

// Minutes never get a leading zero (single-digit minutes read as "3:05", not "03:05") — the
// countdown never reaches double-digit minutes anyway (15 max), so there's nothing to align.
// Seconds always keep theirs, same as any normal clock display.
function fmtQt(totalSec) {
  const neg = totalSec < 0;
  totalSec = Math.abs(Math.round(totalSec));
  const m = Math.floor(totalSec / 60),
    s = totalSec % 60;
  return { neg, text: m + ":" + (s < 10 ? "0" : "") + s };
}
// The minus sign always occupies its slot (as a span that's just invisible when not negative)
// instead of only appearing once the countdown goes past 0:00 — otherwise the display's width
// jumps at the exact moment time runs out, which reads as a glitch rather than the intended
// "time's up" signal.
function qtSetDisplayText(fmt) {
  // tickQTimer calls this every 200ms while a timer is running/paused, but the formatted
  // text only actually changes once a second (fmtQt rounds to whole seconds) — so ~80% of
  // ticks were re-writing innerHTML with the exact text already on screen. Skipping the
  // no-op case cuts real DOM writes down to once/sec without changing what's ever shown.
  if (qtLastDisplayText === fmt.text && qtLastDisplayNeg === fmt.neg) return;
  qtLastDisplayText = fmt.text;
  qtLastDisplayNeg = fmt.neg;
  if (!qtDisplayEls) qtDisplayEls = document.querySelectorAll(".qtimer-display");
  qtDisplayEls.forEach((d) => {
    d.innerHTML = '<span class="qt-sign">−</span>' + fmt.text;
    d.classList.toggle("qt-neg", fmt.neg);
  });
}
// One-shot handler for the qt-crit -> qt-over handover below: fires once the fast settle
// transition (.qt-settle-fast, styles.css) actually finishes, and clears the inline box-shadow
// and class it ran on. A single shared function (not a closure per call) so
// removeEventListener below can match it.
function qtEndSettlePulse(e) {
  if (e.propertyName && e.propertyName !== "box-shadow") return;
  e.currentTarget.classList.remove("qt-settle-fast");
  e.currentTarget.style.boxShadow = "";
}
function qtSetDisplayClass(cls) {
  // Reuses the same cached static NodeList qtSetDisplayText resolves above — see its
  // declaration for why re-querying it is unnecessary (the elements never get torn down).
  if (!qtDisplayEls) qtDisplayEls = document.querySelectorAll(".qtimer-display");
  qtDisplayEls.forEach((d) => {
    // Whether this display is mid-pulse right now — either still in qt-crit's own infinite
    // animation, or already settling one out from a previous tick.
    const pulsing =
      d.classList.contains("qt-crit") || d.classList.contains("qt-settle-fast");
    // Read before the class swap below removes qt-crit and its animation along with it — this
    // is the actual on-screen darkness of the pulse at the exact instant the clock crossed zero.
    const midFlash = pulsing
      ? getComputedStyle(d).boxShadow
      : null;
    d.classList.remove("qt-warn", "qt-crit", "qt-over");
    if (cls) d.classList.add(cls);
    // Crossing 0:01 -> 0:00 swaps qt-crit for qt-over, and qt-over doesn't pulse. Snapping
    // straight to "no shadow" here would chop the flash off wherever it happened to be and pop
    // the box back flat at the exact moment the host is looking at it — so instead, freeze
    // whatever the pulse was actually showing (midFlash, above) as an inline style, then let it
    // transition down to nothing over .qt-settle-fast's own short, fixed .35s (styles.css) —
    // fast enough not to keep flashing after the round is already over, and a plain CSS
    // transition, so it's always smooth regardless of how dark that frozen instant was.
    //
    // Guarded on `pulsing` so this only ever settles a pulse that was actually running: a timer
    // resumed already past zero goes straight to qt-over with nothing in flight, and must not
    // start one just to fade it out. Guarded again on qt-settle-fast because tickQTimer calls
    // this every 200ms — without it, every tick would re-freeze and restart the transition from
    // itself, never actually finishing.
    if (cls === "qt-over" && pulsing) {
      if (!d.classList.contains("qt-settle-fast")) {
        d.style.boxShadow = midFlash;
        d.classList.add("qt-settle-fast");
        requestAnimationFrame(() => {
          d.style.boxShadow = "inset 0 0 0 0 rgba(0,0,0,0)";
        });
        d.addEventListener("transitionend", qtEndSettlePulse, { once: true });
      }
    } else if (d.classList.contains("qt-settle-fast")) {
      // Left the over state before the transition ended (a +30s nudge, a reset, a fresh start) —
      // drop the hold, the inline freeze, and the pending listener so none of it can fire against
      // a later state.
      d.classList.remove("qt-settle-fast");
      d.style.boxShadow = "";
      d.removeEventListener("transitionend", qtEndSettlePulse);
    }
  });
}
// Inline SVG (fill:currentColor, see .qtimer-btn.qtimer-toggle svg in styles.css) rather than
// the ▶/⏸ Unicode glyphs these replaced — those default to a fixed-color platform emoji font on
// iOS/Android, ignoring this button's own already theme/color-vision-audited text color entirely.
// A path/rect shape has no color of its own, so it always renders in whatever the button's state
// (idle/pause/resume) already resolves to. Still the Pictograph-mode value for exactly that
// reason — Icon Style's Emoji mode below is opt-in nostalgia (see the ICON STYLE section up top),
// not a fix to anything, so the color-losing tradeoff is the user's own choice to make there.
const QT_ICON_PLAY_PICT =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>';
const QT_ICON_PAUSE_PICT =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
const QT_ICON_PLAY_EMOJI = '<span class="icon-emoji">▶️</span>';
const QT_ICON_PAUSE_EMOJI = '<span class="icon-emoji">⏸️</span>';
// .qtimer-reset's own icon was static markup in index.html (desktop AND mobile copies), never
// touched by JS at all, since it never needed to change with timer STATE the way play/pause
// does — only reused here as a plain string constant so Icon Style can now swap it too, the same
// two-value PICT/EMOJI split as everything else, just driven from this render function instead
// of STATIC_ICON_TARGETS (that table only ever patches ONE matching element via querySelector;
// this button exists twice, desktop and mobile, and querySelectorAll below already visits both).
const QT_ICON_RESET_PICT =
  '<svg class="icon-ui icon-ui-reset" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>';
const QT_ICON_RESET_EMOJI = '<span class="icon-emoji">↩️</span>';
function renderQtControls() {
  const emoji = loadPrefs().iconStyle === "emoji";
  document.querySelectorAll(".qtimer-toggle").forEach((b) => {
    // Icon-only (no "Start"/"Pause"/"Resume" label) — aria-label carries the accessible name
    // the bare icon can't, and stays in sync with it here rather than living in static HTML.
    b.innerHTML = qtState === "running"
      ? (emoji ? QT_ICON_PAUSE_EMOJI : QT_ICON_PAUSE_PICT)
      : (emoji ? QT_ICON_PLAY_EMOJI : QT_ICON_PLAY_PICT);
    b.setAttribute(
      "aria-label",
      qtState === "running"
        ? "Pause timer"
        : qtState === "paused"
          ? "Resume timer"
          : "Start timer",
    );
    b.classList.toggle("qtimer-pause", qtState === "running");
    b.classList.toggle("qtimer-resume", qtState === "paused");
  });
  document.querySelectorAll(".qtimer-reset").forEach((b) => {
    const active = qtState !== "idle";
    b.disabled = !active;
    b.classList.toggle("qtimer-reset-active", active);
    b.innerHTML = emoji ? QT_ICON_RESET_EMOJI : QT_ICON_RESET_PICT;
  });
}
function toggleQTimer() {
  if (qtState === "running") {
    qtRemainMs = qtEndEpoch - Date.now();
    qtState = "paused";
  } else if (qtState === "paused") {
    qtEndEpoch = Date.now() + qtRemainMs;
    qtState = "running";
  } else {
    qtEndEpoch = Date.now() + qtDurationSec * 1000;
    qtState = "running";
  }
  renderQtControls();
  tickQTimer();
}
function resetQTimer() {
  qtState = "idle";
  qtEndEpoch = 0;
  qtRemainMs = 0;
  qtSetDisplayText(fmtQt(qtDurationSec));
  qtSetDisplayClass(null);
  renderQtControls();
}
// Optional +/-30s stepper buttons (Advanced Settings > Timer Stepper Buttons, hidden by
// default): nudges whichever clock is live right now — the remaining time while running or
// paused, or the not-yet-started base duration while idle (clamped to the same 1-15 min range
// as the Settings dropdown, so idle nudges can't produce a duration Settings couldn't also
// set). Running/paused nudges are intentionally NOT clamped — going negative is exactly the
// existing "time's up" overflow the display already supports, and a host who taps +30 a bunch
// of times mid-question should just get more time, not hit an arbitrary ceiling.
function bumpQTimer(deltaSec) {
  if (qtState === "running") {
    qtEndEpoch += deltaSec * 1000;
  } else if (qtState === "paused") {
    qtRemainMs += deltaSec * 1000;
  } else {
    qtDurationSec = Math.max(
      QT_MIN_SEC,
      Math.min(QT_MAX_SEC, qtDurationSec + deltaSec),
    );
    qtSetDisplayText(fmtQt(qtDurationSec));
    qtSetDisplayClass(null);
    return;
  }
  tickQTimer();
}
// Settings > Question Timer: a 30-second-increment dropdown (1:00-15:00) sets the base
// duration used the next time the timer is started fresh from idle. Only takes effect
// immediately if idle — a timer already running or paused keeps counting down on the
// duration it started with, same as changing this while a real countdown is in progress
// shouldn't retroactively change it.
function setQtDurationSec(sec) {
  const n = Math.max(
    QT_MIN_SEC,
    Math.min(QT_MAX_SEC, parseInt(sec, 10) || QT_DEFAULT_SEC),
  );
  qtDurationSec = n;
  const p = loadPrefs();
  p.qtDurationSec = n;
  savePrefs(p);
  const sel = document.getElementById("qtDurationSelect");
  if (sel && document.activeElement !== sel) sel.value = n;
  if (qtState === "idle") qtSetDisplayText(fmtQt(qtDurationSec));
}
function tickQTimer() {
  if (qtState !== "running" && qtState !== "paused") return;
  const remainSec =
    (qtState === "running" ? qtEndEpoch - Date.now() : qtRemainMs) / 1000;
  qtSetDisplayText(fmtQt(remainSec));
  qtSetDisplayClass(
    remainSec < 0
      ? "qt-over"
      : remainSec <= 30
        ? "qt-crit"
        : remainSec <= 60
          ? "qt-warn"
          : null,
  );
}