"use strict";
/* Tiny, deliberately-EAGER companion to js/tutorial.js (the ~1400-line guided-tour engine,
   which is now lazy-loaded on first actual use — see loadTutorialLib()/startTutorial() in
   js/app.js, the same loadScriptOnce() pattern js/export.js already uses for jsPDF/fflate).

   The tour engine itself is only needed once someone actually clicks "Take the Tour", but
   deciding whether to OFFER it in the first place has to run on every single page load, before
   anyone has clicked anything: this is the "New here? Take the tour." nudge card for a genuine
   first-time visitor (no tutorial_seen flag, no saved session) — and it's exactly the case
   #resumeBanner never shows in, so it gets its own small card instead, inserted right above it.
   Splitting this one small piece out of tutorial.js is what makes lazy-loading the rest of it
   possible without silently breaking that first-run offer for real first-time visitors — a
   version that just deferred the whole file would never show this card at all, since nothing
   would run its check until after someone had already clicked a button that doesn't exist yet.

   TUTORIAL_SEEN_KEY is intentionally a small, independent duplicate of tutorial.js's own
   internal SEEN_KEY constant (same literal string) rather than a shared import — the two files
   load completely independently (this one always, at page load; tutorial.js only sometimes,
   on demand), so there's nothing to import FROM at the time this runs. */
const TUTORIAL_SEEN_KEY = "trivRev6_tutorialSeen";
function tutorialMaybeOfferFirstRun() {
  if (TRStore.getItem(TUTORIAL_SEEN_KEY)) return;
  if (loadSaved()) return; // a real saved session exists — don't interrupt it
  const banner = document.getElementById("resumeBanner");
  if (!banner || document.getElementById("tutorialFirstRun")) return;
  const card = document.createElement("div");
  card.className = "tutorial-firstrun";
  card.id = "tutorialFirstRun";
  // Same hand-wave pictograph as the Settings > Sample Data > Take the Tour button
  // (index.html) — this card used to draw the graduation cap that icon had before it changed.
  // Not wired into STATIC_ICON_TARGETS/Icon Style like that button is: this card is only ever
  // in the DOM briefly, for a first-time visitor, so it isn't worth the extra bookkeeping a
  // dynamically-inserted, one-time element would need to participate in that sweep.
  card.innerHTML =
    `<p><svg class="icon-ui icon-tinted icon-hand" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg> New here? Take the tour.</p>` +
    `<div class="btn-row">` +
    `<button class="btn" onclick="startTutorial()">Take the Tour</button>` +
    `<button class="btn" onclick="dismissTutorialFirstRun()">Skip</button>` +
    `</div>`;
  banner.parentNode.insertBefore(card, banner);
}
function dismissTutorialFirstRun() {
  TRStore.setItem(TUTORIAL_SEEN_KEY, "1");
  const el = document.getElementById("tutorialFirstRun");
  if (el) el.remove();
}
// Runs once, on script load — by this point app.js's own top-level IIFE (js/app.js ~line 784)
// has already run and either shown the real #resumeBanner (a saved session exists) or rendered
// a fresh empty game (no saved session). That second case, with no tutorial_seen flag either,
// is exactly first-time-user.
tutorialMaybeOfferFirstRun();
