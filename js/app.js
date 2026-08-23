const STORAGE_KEY = "trivRev6_session",
  PREFS_KEY = "trivRev6_prefs",
  MAX_TEAMS = 100;
/* Storage shim. Chromium throws "SecurityError: localStorage is not available for opaque
   origins" when the page is opened straight off disk (file:// is an opaque origin). Firefox
   permits it, which is why this app persists in Firefox but not in Chrome from file://.
   Serving over http://localhost (e.g. `python3 -m http.server`) gives a real origin and makes
   native storage work everywhere. When native storage is unavailable we fall back to an
   in-memory store so the app still runs for the current session (it just can't resume after a
   reload). TRStore.persistent reports whether real cross-session persistence is available. */
const TRStore = (function () {
  let backing = null,
    persistent = false;
  try {
    const k = "__trs_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    backing = window.localStorage;
    persistent = true;
  } catch (e) {
    const mem = Object.create(null);
    backing = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => {
        mem[k] = String(v);
      },
      removeItem: (k) => {
        delete mem[k];
      },
    };
    persistent = false;
  }
  return {
    get persistent() {
      return persistent;
    },
    getItem: (k) => {
      try {
        return backing.getItem(k);
      } catch (e) {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        backing.setItem(k, v);
      } catch (e) {}
    },
    removeItem: (k) => {
      try {
        backing.removeItem(k);
      } catch (e) {}
    },
  };
})();
const ROUND_WAGERS = [
  [1, 2, 3, 4],
  [1, 3, 5, 7],
  [2, 4, 6, 8],
  [3, 6, 9, 12],
];
const ROUND_COLORS = ["rl-1", "rl-2", "rl-3", "rl-4"];
const BONUS_ROUNDS = new Set([0, 2]);
// Inline SVG (rect+path, colored via .wager-badge.bg-correct svg in styles.css) rather than the
// ✅ Unicode emoji this replaced — that glyph is a fixed-color platform pictograph on iOS/Android
// (its own baked-in green square + white check), so no CSS color/theme/color-vision token could
// ever touch it. A bare shape has no color of its own, so it always renders in whatever
// --correct-badge-bg/--correct-badge-fg already resolve to for the active theme and color-vision
// mode.
const CORRECT_BADGE_SVG_PICT =
  '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="1" y="1" width="18" height="18" rx="5"></rect><path d="M4.5 10.3l3.5 3.5l7-7.8"></path></svg>';
// Icon Style (see the block starting at ICON_ALERT_PICT below) brings this one back into the
// swappable set too: the header comment above is exactly the reason CORRECT_BADGE_SVG existed in
// the first place (a fixed-color ✅ no CSS token could reach), and Icon Style's whole point is to
// let a host who wants that back have it, same as every other icon this replaced.
const CORRECT_BADGE_EMOJI = '<span class="icon-emoji">✅</span>';
let CORRECT_BADGE_SVG = CORRECT_BADGE_SVG_PICT;
// Same reasoning as CORRECT_BADGE_SVG above, applied to the Theme toggle's own 🌑/☀️ Unicode
// emoji: both are fixed-color platform pictographs (a literal gray moon, a literal orange sun)
// that no CSS token could touch. .icon-sun/.icon-moon (styles.css) each set color to a token
// that's already audited as AAA-legible text ON --bg-card specifically — the surface this button
// sits on — and already carries its own [data-cb] swap, so the icon both suits its theme (warm
// gold for day, cool cyan for night) and follows Settings > Color Vision like the rest of the app.
// Geometry is the well-known Feather/Lucide sun (circle + 8 rays) and moon (crescent via one
// circle overlapping another) icons rather than a hand-drawn shape — both are widely used, so
// they read as an actual sun/moon at a glance instead of needing to be puzzled out.
const THEME_ICON_SUN_PICT =
  '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5"></circle><g stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></g></svg>';
const THEME_ICON_MOON_PICT =
  '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
// Shared X icon (Feather/Lucide geometry, same family as the icons above) rather than a ✕/✗
// Unicode glyph — the remove-team button and every .wager-badge.bg-incorrect badge (Q1-4,
// bonus questions, special wager) all centered their glyph with flex already, but a text
// glyph's own font metrics (its baseline, its glyph-box padding) rarely land it visually
// centered regardless of how its container centers it — and different buttons' fonts/sizes can
// land it off by a different amount each, reading as "inconsistent" between contexts even
// though it's the same character. An SVG's viewBox geometry has no such metrics to fight — two
// crossing lines drawn symmetric around (12,12) simply are centered, identically, everywhere
// it's used.
// Both carry a shared "icon-mark" class (styles.css) sizing/coloring them generically via
// currentColor for every plain inline use (mini-progress label, Done badges, stat pills, Team
// Report lines) — contexts like .wager-badge.bg-incorrect/.remove-team button that need their
// own size still get it, since their own `svg` element selectors there are more specific than
// the shared class and win the cascade.
const X_ICON_SVG_PICT =
  '<svg class="icon-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';
// Bare checkmark (no colored square background — CORRECT_BADGE_SVG's rect is specific to that
// one small corner badge) for every OTHER ✓ in the app: the mini-progress "all rounds scored"
// label, round/question "Done" badges, the per-question correct/incorrect stat pills, and every
// ✓/✗ line in the Team Report. Same rationale as X_ICON_SVG above — colored via currentColor, so
// it always picks up whatever color token the pill/label around it already resolves to
// (--badge-green-fg, --pts-pos-fg, etc.), instead of a fixed-color platform glyph.
const CHECK_ICON_SVG_PICT =
  '<svg class="icon-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="5,13 10,18 20,6"></polyline></svg>';
// ICON_DONE is the exact same drawn checkmark as CHECK_ICON_SVG above (its own Pictograph-mode
// value IS CHECK_ICON_SVG_PICT, not a separate drawing) — the two only diverge in Emoji mode:
// "this round/question is finished" (round/question Done badges, and the mini-progress banner at
// 100%) gets ✔️, while every other ✓ above (Team Report lines, "looks good", "Copied", the
// correct/incorrect stat pills) keeps ✅. Split out for the same reason ICON_MARK_CORRECT was:
// one glyph was being asked to carry two different meanings under Icon Style's Emoji mode.
const ICON_DONE_EMOJI = '<span class="icon-emoji">✔️</span>';
// Dark theme only: ✔️ renders as a bare dark tick with no background of its own (the same
// legibility problem ICON_MARK_CORRECT's own comment above describes for ✔️ on a dark surface),
// which gets lost against this app's near-black dark-theme surfaces specifically. ☑️ carries its
// own light box baked into the glyph, so it stays legible there without needing a background of
// its own to sit on — same fix, same reasoning, just picked by theme here rather than being a
// fixed per-context choice, since THIS glyph (unlike ICON_MARK_CORRECT's) sits on plain page
// background rather than one fixed color that's always dark.
const ICON_DONE_EMOJI_DARK = '<span class="icon-emoji">☑️</span>';
// UI action glyphs, replacing the ↕ / ↺ / 🔄 / 🎲 characters these buttons used to carry. Same
// reasoning as X_ICON_SVG/CHECK_ICON_SVG above, and it applies twice over here:
//   1. 🔄 and 🎲 are emoji — fixed-color platform pictographs (a blue-and-white arrow loop, a
//      white-pipped die) that no theme or color-vision token could reach, so they stayed the same
//      two colors in all six theme/mode combinations while everything around them adapted.
//   2. ↕ and ↺ are text glyphs, and a glyph's own font metrics decide where it sits inside its
//      line box, so no amount of centering on the BUTTON can fix a glyph that sits high or low
//      in its own box — which is exactly why Sort and Reset looked off-centre beside their
//      labels. Geometry drawn around (12,12) in a 24x24 viewBox has no metrics to fight.
// All four are stroke-only and inherit currentColor, so they take the button's own already
// contrast-audited text color in every theme and color-vision mode. Geometry is Lucide's, the
// same family the sun/moon/check/X above already use.
const ICON_SORT_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v16"></path><path d="m3 8 4-4 4 4"></path><path d="M17 20V4"></path><path d="m21 16-4 4-4-4"></path></svg>';
// The Scores sidebar's Asc/Desc sort buttons and sortModeLabel()'s matching description below
// each carried a bare ↑/↓ Unicode glyph — swapped for the same reasoning as every other ICON_*
// here (a fixed-weight text glyph rather than currentColor-aware geometry), with ⬆️/⬇️ as the
// Emoji-mode pair since those are exactly what "Asc"/"Desc" already point at (single direction),
// not ICON_SORT's own two-way ↕ glyph above (used only for the icon-only Shuffle button).
const ICON_ARROW_UP_PICT =
  '<svg class="icon-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="5,12 12,5 19,12"></polyline><line x1="12" y1="5" x2="12" y2="19"></line></svg>';
const ICON_ARROW_DOWN_PICT =
  '<svg class="icon-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="5,12 12,19 19,12"></polyline><line x1="12" y1="5" x2="12" y2="19"></line></svg>';
const ICON_RESET_PICT =
  '<svg class="icon-ui icon-ui-reset" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>';
const ICON_REFRESH_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M21 21v-5h-5"></path></svg>';
const ICON_SHUFFLE_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"></path><path d="m18 2 4 4-4 4"></path><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"></path><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"></path><path d="m18 14 4 4-4 4"></path></svg>';
// Same geometry as ICON_SHUFFLE, tinted rather than currentColor. ICON_SHUFFLE itself stays
// plain — it's the Shuffle sort BUTTON's own icon, and every action glyph in the app (Sort,
// Reset, Refresh, the check/X) takes the control's own audited text colour rather than a colour
// of its own. This copy sits beside "Shuffled order" in .sort-mode-label instead, a plain text
// description rather than a control, which is the same role ICON_CLIPBOARD already plays beside
// "Entry order" a few lines down — so it gets the same decorative-pictograph treatment.
const ICON_SHUFFLE_TINTED_PICT =
  '<svg class="icon-ui icon-tinted icon-shuffle" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"></path><path d="m18 2 4 4-4 4"></path><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"></path><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"></path><path d="m18 14 4 4-4 4"></path></svg>';
// The rest of the app's emoji, as drawn geometry. Same two reasons as the four above: an emoji
// is a fixed-colour platform pictograph no theme or colour-vision token can reach, and its size
// and baseline are the font's business rather than the layout's. Lucide geometry throughout.
const ICON_CLIPBOARD_PICT =
  '<svg class="icon-ui icon-tinted icon-clipboard" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect class="ip-2" width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>';
const ICON_MIC_PICT =
  '<svg class="icon-ui icon-tinted icon-mic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path class="ip-2" d="M19 10v2a7 7 0 0 1-14 0v-2"/><line class="ip-2" x1="12" x2="12" y1="19" y2="22"/></svg>';
const ICON_HEART_PICT =
  '<svg class="icon-ui icon-tinted icon-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
const ICON_BEER_PICT =
  '<svg class="icon-ui icon-tinted icon-beer" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M17 9h1a3 5 0 0 1 0 10h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path class="ip-2" d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 3 11 3s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/></svg>';
const ICON_DRUM_PICT =
  '<svg class="icon-ui icon-tinted icon-drum" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 9v8a10 5 0 0 0 20 0V9"/><ellipse class="ip-2" cx="12" cy="9" rx="10" ry="5"/><path class="ip-3" d="m2 2 6 6"/><path class="ip-3" d="m22 2-6 6"/></svg>';
const ICON_TROPHY_PICT =
  '<svg class="icon-ui icon-tinted icon-trophy" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path class="ip-2" d="M4 22h16"/><path class="ip-2" d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path class="ip-2" d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
// Final Results' checkered flag. Deliberately NOT one of the tinted pictographs: a racing flag
// has no colour of its own, and the two things it IS made of are "ink" and "not ink". The filled
// squares take currentColor and the alternating ones are left empty, so the empty half is
// whatever surface the header sits on — which makes the checker read correctly as white-on-dark
// in the dark theme and black-on-light in the light one, from one set of paths, with no token to
// keep in sync. The thin edge path is what stops the flag dissolving into three loose squares.
// The whole thing rides a single shallow wave — one offset curve applied to the top edge, the
// mid-row boundary and the bottom edge alike, so the checks bend with the cloth instead of
// sitting flat on it. Three checks across rather than four: at the 16px this header renders, a
// four-column checker closed up into a blob.
const ICON_FLAG_PICT =
  '<svg class="icon-ui icon-flag" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 2v20"/><path class="fl-edge" d="M4 3C6 3.2 8 4.2 10 4.4C12 4.6 14 2.2 16 2C18 1.8 20 3.4 22 3.6L22 15.6C20 15.4 18 13.8 16 14C14 14.2 12 16.6 10 16.4C8 16.2 6 15.2 4 15Z"/><path class="fl-sq" d="M4 3C6 3.2 8 4.2 10 4.4L10 10.4C8 10.2 6 9.2 4 9Z"/><path class="fl-sq" d="M16 2C18 1.8 20 3.4 22 3.6L22 9.6C20 9.4 18 7.8 16 8Z"/><path class="fl-sq" d="M10 10.4C12 10.6 14 8.2 16 8L16 14C14 14.2 12 16.6 10 16.4Z"/></svg>';
const ICON_PDF_PICT =
  '<svg class="icon-ui icon-tinted icon-pdf" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 12v6"/><path d="m9 15 3 3 3-3"/></svg>';
const ICON_LINK_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const ICON_TRASH_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
// Play Horn's icon: a plain play triangle. No frame around it — the button already has a border
// and a label, so a square drawn inside a button was a second button drawn inside the first.
//
// No .icon-tinted, unlike the beer/drum/trophy pictographs. Those are pictures of coloured
// objects and need their emoji's hue back to read as themselves; a play triangle is not a picture
// of anything, so it takes currentColor like every other UI action glyph in this file (Sort,
// Reset, Refresh, Shuffle, Stop). On this button currentColor resolves to --on-accent-cyan, which
// is already audited against the accent fill it sits on, in every theme and colour-vision mode.
//
// Filled AND stroked (see .icon-play in styles.css): the fill is what makes it a play triangle
// rather than a hollow arrow at this size, and .icon-ui's inherited stroke-linejoin:round is what
// softens the three corners so it matches the rounded ends the rest of this family is drawn with.
// The geometry is sized for that stroke to sit around it: the path spans 8.5-19 across, which the
// 2.25 stroke carries out to roughly 7.2-20.2 of the 24 viewBox. Its centroid lands at x=12.0,
// the usual optical nudge that stops a play triangle looking as though it has slid left in its
// own box.
const ICON_HORN_PICT =
  '<svg class="icon-ui icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="pl-tri" d="M8.5 5.5 19 12l-10.5 6.5z"/></svg>';
const ICON_STOP_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
const ICON_SHEET_PICT =
  '<svg class="icon-ui icon-sheet" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="5" width="20" height="14" rx="2"/><path class="sh-head" d="M4 5h16a2 2 0 0 1 2 2v3H2V7a2 2 0 0 1 2-2Z"/><path d="M2 14.5h20"/><path d="M8.5 10v9"/><path d="M15.5 10v9"/></svg>';
// Alert triangle for the two warning banners (Resume, and the "autosave is off" notice). Both
// carried a literal \u26A0\uFE0F, which is the one emoji the v18.57 sweep missed on each: the
// Resume banner's markup in index.html was converted, but the JS that fills it in below used
// .textContent and so overwrote the icon with the emoji again on every load, and the autosave
// notice builds its own markup here. Same reasoning as the rest of these — an emoji is a
// fixed-colour platform pictograph, and the autosave banner in particular draws its own amber
// palette, which the emoji's baked-in orange-and-black never matched.
const ICON_ALERT_PICT =
  '<svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

// ============================== ICON STYLE (pictograph / emoji) ==============================
// Settings > Icon Style swaps every drawn pictograph above back for the platform emoji it
// replaced — the whole reason each one was redrawn as an SVG in the first place (see the ICON_*
// comments above) was to escape a fixed-colour glyph the app's own theme/colour-vision tokens
// couldn't reach, so this is opt-in nostalgia, not a fix to anything.
//
// Each ICON_* above is a `let`, initialised to its own _PICT value, with a matching _EMOJI
// string declared here — applyIconStyle reassigns every one of them in place rather than
// swapping in a lookup function, so every existing `${ICON_BEER}` etc. call site throughout this
// file keeps working unchanged; only the value the name currently points to changes. Emoji chosen
// to match this app's own pre-SVG history where it's on record (ICON_SORT/RESET/REFRESH replaced
// the literal ↕ / ↺ / \u{1F504} characters named in that comment; ICON_HORN replaced the
// \u{1F389} party popper the v18.72 changelog calls out as "the last emoji in the app" at the
// time) and to plain platform convention everywhere else. ICON_SHUFFLE/ICON_SHUFFLE_TINTED are
// the one deliberate exception — see the note on their own declaration for why \u{1F500} replaces
// the historical \u{1F3B2} rather than restoring it.
const THEME_ICON_SUN_EMOJI = '<span class="icon-emoji">☀️</span>';
const THEME_ICON_MOON_EMOJI = '<span class="icon-emoji">🌙</span>';
const X_ICON_SVG_EMOJI = '<span class="icon-emoji">❌</span>';
// X_ICON_SVG is shared by every "dismiss" meaning in the app — remove team, close Team Report,
// clear the craft prize winner, dismiss the autosave-off notice — and by "mark this wrong",
// which is a different meaning wearing the same mark. In pictograph mode that's fine, the same
// drawn X reads as either depending on context; in emoji mode it isn't, since ⛔ reads as "wrong
// answer" and would read as "delete/dismiss" everywhere else it currently shows up. ICON_INCORRECT
// is the same SVG picture as X_ICON_SVG — nothing about how it looks in pictograph mode changes —
// with its own emoji, and only the incorrect-marking call sites (the wager/bonus/special-wager
// incorrect badges, the incorrect result button, the per-question incorrect stat) use it instead
// of X_ICON_SVG. Team Report's own "incorrect" lines split off further still — see
// ICON_AUDIT_WRONG below.
const ICON_INCORRECT_EMOJI = '<span class="icon-emoji">⛔</span>';
// Team Report specifically: ❌ rather than ⛔ here, by request — same drawn X in Pictograph mode
// as ICON_INCORRECT (and X_ICON_SVG), only Emoji mode's glyph differs, same split pattern as
// every other ICON_* pair above that shares one drawing across more than one meaning.
const ICON_AUDIT_WRONG_EMOJI = '<span class="icon-emoji">❌</span>';
const CHECK_ICON_SVG_EMOJI = '<span class="icon-emoji">✅</span>';
// The Halftime/Final Wager "Mark correct" button (renderSpecialWager) draws its own icon AND, once
// selected, an overlaid CORRECT_BADGE_SVG badge right on top of it — both were ✅ in Emoji mode,
// so a selected button showed two identical green checks stacked on each other. The badge keeps
// ✅ (CORRECT_BADGE_EMOJI, below) — that's the actual "this one's the winner" signal. The button's
// OWN icon gets its own mark instead: ☑️, not ✔️, chosen for the surfaces it actually has to sit
// on — .correct-sel's background swings from near-black in dark theme to a bright light green in
// light theme (color-vision modes push it further, e.g. a pale blue), and ✔️ renders as a bare
// dark tick with no background of its own, which nearly disappears on the dark end of that range.
// ☑️ carries its own light box baked into the glyph, so its contrast comes from itself rather than
// from matching whatever's behind it — legible at both ends without needing per-theme tuning the
// way a CSS-colored icon would.
const ICON_MARK_CORRECT_EMOJI = '<span class="icon-emoji">☑️</span>';
// Same split, mirrored for the "Mark incorrect" button right beside it: it draws its own icon AND,
// once selected, an overlaid wager-badge with ICON_INCORRECT on top of it — both were ⛔ in Emoji
// mode, so a selected button showed two identical prohibition signs stacked on each other. The
// badge keeps ⛔ (ICON_INCORRECT, above) — that's the actual "this one's wrong" signal, same role
// CORRECT_BADGE_SVG plays on the correct side. The button's OWN icon gets ❌ instead (by request —
// an earlier pass here tried ✖️ first), the same pairing logic as ICON_MARK_CORRECT's ☑️: a
// visibly different mark from the badge it can sit next to, rather than the same glyph twice.
const ICON_MARK_INCORRECT_EMOJI = '<span class="icon-emoji">❌</span>';
const ICON_SORT_EMOJI = '<span class="icon-emoji">↕️</span>';
const ICON_ARROW_UP_EMOJI = '<span class="icon-emoji">⬆️</span>';
const ICON_ARROW_DOWN_EMOJI = '<span class="icon-emoji">⬇️</span>';
const ICON_RESET_EMOJI = '<span class="icon-emoji">↩️</span>';
const ICON_REFRESH_EMOJI = '<span class="icon-emoji">🔄</span>';
// 🔀 rather than the 🎲 this button's comment traces its history to: at the sizes Sort/Reset/
// Shuffle actually render (the sort-controls row, the standings sort buttons) a die reads as an
// ambiguous blob, where the crossed arrows keep reading as "shuffle" at a glance.
const ICON_SHUFFLE_EMOJI = '<span class="icon-emoji">🔀</span>';
const ICON_SHUFFLE_TINTED_EMOJI = '<span class="icon-emoji">🔀</span>';
const ICON_CLIPBOARD_EMOJI = '<span class="icon-emoji">📋</span>';
const ICON_MIC_EMOJI = '<span class="icon-emoji">🎤</span>';
const ICON_HEART_EMOJI = '<span class="icon-emoji">❤️</span>';
const ICON_BEER_EMOJI = '<span class="icon-emoji">🍺</span>';
const ICON_DRUM_EMOJI = '<span class="icon-emoji">🥁</span>';
const ICON_TROPHY_EMOJI = '<span class="icon-emoji">🏆</span>';
const ICON_FLAG_EMOJI = '<span class="icon-emoji">🏁</span>';
const ICON_PDF_EMOJI = '<span class="icon-emoji">📕</span>';
const ICON_LINK_EMOJI = '<span class="icon-emoji">🔗</span>';
const ICON_TRASH_EMOJI = '<span class="icon-emoji">🗑️</span>';
const ICON_HORN_EMOJI = '<span class="icon-emoji">🎉</span>';
const ICON_STOP_EMOJI = '<span class="icon-emoji">⏹️</span>';
const ICON_SHEET_EMOJI = '<span class="icon-emoji">📊</span>';
const ICON_ALERT_EMOJI = '<span class="icon-emoji">⚠️</span>';

// The reassignable bindings applyIconStyle below writes to — every existing `${ICON_BEER}` etc.
// call site elsewhere in this file reads through one of these, so reassigning here is all it
// takes to change what they render without touching any of those call sites.
let THEME_ICON_SUN = THEME_ICON_SUN_PICT;
let THEME_ICON_MOON = THEME_ICON_MOON_PICT;
let X_ICON_SVG = X_ICON_SVG_PICT;
let ICON_INCORRECT = X_ICON_SVG_PICT;
let ICON_AUDIT_WRONG = X_ICON_SVG_PICT;
let CHECK_ICON_SVG = CHECK_ICON_SVG_PICT;
let ICON_DONE = CHECK_ICON_SVG_PICT;
let ICON_MARK_CORRECT = CHECK_ICON_SVG_PICT;
let ICON_MARK_INCORRECT = X_ICON_SVG_PICT;
let ICON_SORT = ICON_SORT_PICT;
let ICON_ARROW_UP = ICON_ARROW_UP_PICT;
let ICON_ARROW_DOWN = ICON_ARROW_DOWN_PICT;
let ICON_RESET = ICON_RESET_PICT;
let ICON_REFRESH = ICON_REFRESH_PICT;
let ICON_SHUFFLE = ICON_SHUFFLE_PICT;
let ICON_SHUFFLE_TINTED = ICON_SHUFFLE_TINTED_PICT;
let ICON_CLIPBOARD = ICON_CLIPBOARD_PICT;
let ICON_MIC = ICON_MIC_PICT;
let ICON_HEART = ICON_HEART_PICT;
let ICON_BEER = ICON_BEER_PICT;
let ICON_DRUM = ICON_DRUM_PICT;
let ICON_TROPHY = ICON_TROPHY_PICT;
let ICON_FLAG = ICON_FLAG_PICT;
let ICON_PDF = ICON_PDF_PICT;
let ICON_LINK = ICON_LINK_PICT;
let ICON_TRASH = ICON_TRASH_PICT;
let ICON_HORN = ICON_HORN_PICT;
let ICON_STOP = ICON_STOP_PICT;
let ICON_SHEET = ICON_SHEET_PICT;
let ICON_ALERT = ICON_ALERT_PICT;

// A handful of pictographs live as static markup in index.html rather than as ICON_* strings
// (the settings gear, the header's Save/Load, the FAQ link, Try Example's flask, Take the Tour's
// hand, the settings panel's round X) because they're each used at exactly one call site and never
// built into a template literal. Keyed by element id/selector -> {pict, emoji}; pict is captured
// from the live DOM the first time applyIconStyle runs (whatever index.html already shipped),
// rather than duplicated here by hand, so it can never drift out of sync with the markup.
// Every emoji value below is wrapped in <span class="icon-emoji"> (styles.css: display:
// inline-block, line-height:1) rather than left as bare text — a bare platform emoji's own
// natural line-box height varies glyph to glyph (🧪 needs visibly more vertical room in its line
// than 👋 does, at the same font-size), so two of these buttons sitting side by side with no
// shared height constraint could end up two different heights depending only on which emoji they
// happened to carry. The wrapper is what settings-x-btn already needed this fix for on its own
// (below); every other target gets it now too, for the same reason rather than only when it goes
// visibly wrong.
const STATIC_ICON_TARGETS = [
  { sel: "#settingsToggleBtn", emoji: '<span class="icon-emoji">⚙️</span>' },
  { sel: '.toolbar button[onclick="saveToFile()"]', emoji: '<span class="icon-emoji">💾</span>', label: " Save" },
  { sel: '.toolbar button[onclick="triggerLoadFile()"]', emoji: '<span class="icon-emoji">📂</span>', label: " Load" },
  { sel: 'a[href="faq/index.html"]', emoji: '<span class="icon-emoji">❓</span>', label: " FAQ" },
  { sel: 'button[onclick="loadSampleGame()"]', emoji: '<span class="icon-emoji">🧪</span>', label: " Try Example" },
  { sel: 'button[onclick="Tutorial.start()"]', emoji: '<span class="icon-emoji">👋</span>', label: " Take the Tour" },
  // App Preferences (Advanced Settings) and Craft Prize Eligible List's Copy/TXT — four buttons
  // that never made it into this table at all, so Icon Style's Emoji mode silently skipped them
  // while every other icon-bearing static button in Settings swapped correctly.
  { sel: 'button[onclick="savePrefsToFile()"]', emoji: '<span class="icon-emoji">💾</span>', label: " Save" },
  { sel: 'button[onclick="triggerLoadPrefsFile()"]', emoji: '<span class="icon-emoji">📂</span>', label: " Load" },
  { sel: 'button[onclick="copyCraftEligible(this)"]', emoji: '<span class="icon-emoji">📋</span>', label: " Copy" },
  { sel: 'button[onclick="exportCraftEligible()"]', emoji: '<span class="icon-emoji">📄</span>', label: " TXT" },
  { sel: ".settings-x-btn", emoji: '<span class="icon-emoji">✕</span>' },
];
let staticIconPictCache = null;

function applyIconStyle(style) {
  const emoji = style === "emoji";
  THEME_ICON_SUN = emoji ? THEME_ICON_SUN_EMOJI : THEME_ICON_SUN_PICT;
  THEME_ICON_MOON = emoji ? THEME_ICON_MOON_EMOJI : THEME_ICON_MOON_PICT;
  X_ICON_SVG = emoji ? X_ICON_SVG_EMOJI : X_ICON_SVG_PICT;
  ICON_INCORRECT = emoji ? ICON_INCORRECT_EMOJI : X_ICON_SVG_PICT;
  ICON_AUDIT_WRONG = emoji ? ICON_AUDIT_WRONG_EMOJI : X_ICON_SVG_PICT;
  CHECK_ICON_SVG = emoji ? CHECK_ICON_SVG_EMOJI : CHECK_ICON_SVG_PICT;
  ICON_DONE = emoji
    ? document.documentElement.getAttribute("data-theme") === "dark"
      ? ICON_DONE_EMOJI_DARK
      : ICON_DONE_EMOJI
    : CHECK_ICON_SVG_PICT;
  ICON_MARK_CORRECT = emoji ? ICON_MARK_CORRECT_EMOJI : CHECK_ICON_SVG_PICT;
  ICON_MARK_INCORRECT = emoji ? ICON_MARK_INCORRECT_EMOJI : X_ICON_SVG_PICT;
  ICON_SORT = emoji ? ICON_SORT_EMOJI : ICON_SORT_PICT;
  ICON_ARROW_UP = emoji ? ICON_ARROW_UP_EMOJI : ICON_ARROW_UP_PICT;
  ICON_ARROW_DOWN = emoji ? ICON_ARROW_DOWN_EMOJI : ICON_ARROW_DOWN_PICT;
  ICON_RESET = emoji ? ICON_RESET_EMOJI : ICON_RESET_PICT;
  ICON_REFRESH = emoji ? ICON_REFRESH_EMOJI : ICON_REFRESH_PICT;
  ICON_SHUFFLE = emoji ? ICON_SHUFFLE_EMOJI : ICON_SHUFFLE_PICT;
  ICON_SHUFFLE_TINTED = emoji ? ICON_SHUFFLE_TINTED_EMOJI : ICON_SHUFFLE_TINTED_PICT;
  ICON_CLIPBOARD = emoji ? ICON_CLIPBOARD_EMOJI : ICON_CLIPBOARD_PICT;
  ICON_MIC = emoji ? ICON_MIC_EMOJI : ICON_MIC_PICT;
  ICON_HEART = emoji ? ICON_HEART_EMOJI : ICON_HEART_PICT;
  ICON_BEER = emoji ? ICON_BEER_EMOJI : ICON_BEER_PICT;
  ICON_DRUM = emoji ? ICON_DRUM_EMOJI : ICON_DRUM_PICT;
  ICON_TROPHY = emoji ? ICON_TROPHY_EMOJI : ICON_TROPHY_PICT;
  ICON_FLAG = emoji ? ICON_FLAG_EMOJI : ICON_FLAG_PICT;
  ICON_PDF = emoji ? ICON_PDF_EMOJI : ICON_PDF_PICT;
  ICON_LINK = emoji ? ICON_LINK_EMOJI : ICON_LINK_PICT;
  ICON_TRASH = emoji ? ICON_TRASH_EMOJI : ICON_TRASH_PICT;
  ICON_HORN = emoji ? ICON_HORN_EMOJI : ICON_HORN_PICT;
  ICON_STOP = emoji ? ICON_STOP_EMOJI : ICON_STOP_PICT;
  ICON_SHEET = emoji ? ICON_SHEET_EMOJI : ICON_SHEET_PICT;
  ICON_ALERT = emoji ? ICON_ALERT_EMOJI : ICON_ALERT_PICT;
  CORRECT_BADGE_SVG = emoji ? CORRECT_BADGE_EMOJI : CORRECT_BADGE_SVG_PICT;

  if (!staticIconPictCache) {
    staticIconPictCache = STATIC_ICON_TARGETS.map((t) => {
      const el = document.querySelector(t.sel);
      return el ? el.innerHTML : null;
    });
  }
  STATIC_ICON_TARGETS.forEach((t, i) => {
    const el = document.querySelector(t.sel);
    if (!el) return;
    const pict = staticIconPictCache[i];
    el.innerHTML = emoji
      ? t.emoji + (t.label || "")
      : pict != null
        ? pict
        : el.innerHTML;
  });

  // Same idea as Color Vision's own swatch next to its choice (setCvSelectDisplay below): a
  // literal preview of what this mode actually looks like, sitting right next to the word naming
  // it, rather than making "Pictograph"/"Emoji" a bare label the user has to already know the
  // meaning of. ICON_BEER_PICT/_EMOJI rather than a checkmark: the drawn mug and 🍺 read as
  // visibly different drawings of the same thing, where a checkmark in both modes looks nearly
  // identical and doesn't actually demonstrate the choice — and beer is this app's own mascot
  // icon besides.
  const btn = document.getElementById("iconStyleToggle");
  if (btn) {
    btn.innerHTML =
      (emoji ? ICON_BEER_EMOJI : ICON_BEER_PICT) +
      (emoji ? " Emoji" : " Pictograph");
  }
  // Resume banner text and the mini-progress "all rounds scored" label are both built once with
  // a template literal rather than re-rendered by renderAll(), same as every other place a
  // *_PICT/_EMOJI pair is baked into markup already on the page rather than freshly rendered —
  // renderAll() below covers everything that IS rendered from gameState, and the one-off resume
  // banner text is refreshed the same way dismissResumeBanner/resumeSession already do it.
  const resumeText = document.getElementById("resumeText");
  if (resumeText && resumeText.innerHTML.includes("Saved session from")) {
    resumeText.innerHTML = resumeText.innerHTML.replace(
      /^.*?Saved session from/,
      ICON_ALERT + " Saved session from",
    );
  }
  // Deliberately does NOT call renderAll() itself: renderAll() calls applyPrefs(), and
  // applyPrefs() calls this function first thing — self-triggering a render in here would be
  // infinite recursion. setIconStyle below calls this directly (so the ICON_* variables are
  // already updated) and THEN calls renderAll() itself, which re-renders #mainContent/
  // #sidebarBody with the new icons baked into their freshly-built HTML strings and, as a
  // harmless side effect, calls this function a second time with the same value.
}
function setIconStyle(style) {
  const p = loadPrefs();
  p.iconStyle = style === "emoji" ? "emoji" : "pictograph";
  savePrefs(p);
  applyIconStyle(p.iconStyle);
  renderAll();
  // The question timer's play/pause/reset icons live outside renderAll's own tree (built by
  // renderQtControls, called on timer state changes rather than on every render), so they'd
  // otherwise keep showing whichever style was active when the timer last started/paused/reset
  // until the next tick — same reason setTheme below re-renders for ICON_DONE.
  renderQtControls();
}
function toggleIconStyle() {
  const p = loadPrefs();
  setIconStyle(p.iconStyle === "emoji" ? "pictograph" : "emoji");
}

// Round 1 and Round 3's bonus question keep the colour each round is already tagged with
// elsewhere (rl-1 cyan, rl-3 gold) so the Q5 label is consistent with the rest of that round.
// No icon any more: all four Q5 blocks carried a pictograph (four squares, a poker chip, a
// horseshoe, a stack of chips) and they are gone at the host's request. They were decoration
// beside a label that already said what the block was — "BONUS (0-4 x 5)", "BONUS WAGER (1-20)"
// — and four different marks across four Q5s implied a distinction between them that does not
// exist. The colour classes stay; only the pictographs go.
// Declared up here, not next to renderBQ where it's used, because the very first render on a
// brand-new session — no saved game to resume — runs synchronously at script-parse time, before a
// `const` declared further down the file would be out of its temporal dead zone.
const BONUS_Q_STYLE = {
  0: { cls: "bq-r1" },
  2: { cls: "bq-r3" },
};
// Character limits for every field a host types free text into. Declared once and used twice:
// as the inputs' own maxlength, and again in migrateState to clamp values arriving from a saved
// file. The numbers are sized to what each field is for rather than to a round number — a quiz ID
// is a code, a team name has to fit the scoresheet's 220pt column, the staff list is a handful of
// first names, and the winner script is a paragraph read aloud.
const FIELD_MAX = {
  quizId: 24,
  hostName: 40,
  location: 60,
  craftPartner: 50,
  craftPartnerTown: 40,
  bonusItem: 60,
  staffNames: 200,
  teamName: 40,
  craftScript: 600,
};
const APP_VERSION = "v19.30"; // #Version Number — bump this manually when you release a new build
const APP_VERSION_DATE = "Aug 22, 2026"; // #Version Date — bump alongside APP_VERSION so folks can spot a stale build

const SAMPLE_GAME_JSON = `{"meta":{"date":"2024-02-29","location":"The Fawkes & Firkin","quizId":"XYZ-000","hostName":"Guy Fawkes","craftPartner":"Trivia Rev Brew Co","craftPartnerTown":"Toon Town","bonusItem":"Guy Fawkes Mask","staffNames":"Josie, Valerie, Fred, Daphne, Velma"},"teams":[{"name":"Parliamentary Procedure","scoreGuess":131,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Lanterns & Lore","scoreGuess":110,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"The Fifth of November","scoreGuess":86,"bonusItem":true,"njcb":false,"adjustment":0},{"name":"Quizzy McQuizface","scoreGuess":120,"bonusItem":false,"njcb":true,"adjustment":0},{"name":"Sherlock Homies","scoreGuess":113,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Mastermind Alliance","scoreGuess":130,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"The Usual Suspecters","scoreGuess":66,"bonusItem":false,"njcb":true,"adjustment":0},{"name":"Trivia Newton John","scoreGuess":124,"bonusItem":true,"njcb":false,"adjustment":0},{"name":"Two Heads, One Trophy","scoreGuess":99,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"Powder Keg of Knowledge","scoreGuess":127,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Remember Remember","scoreGuess":76,"bonusItem":false,"njcb":false,"adjustment":0}],"rounds":[{"questions":[{"0":{"wager":4,"correct":true},"1":{"wager":3,"correct":true},"2":{"wager":3,"correct":true},"3":{"wager":4,"correct":true},"4":{"wager":2,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":3,"correct":true},"7":{"wager":3,"correct":true},"8":{"wager":3,"correct":false},"9":{"wager":4,"correct":true},"10":{"wager":4,"correct":true}},{"0":{"wager":1,"correct":true},"1":{"wager":1,"correct":false},"2":{"wager":1,"correct":true},"3":{"wager":1,"correct":false},"4":{"wager":3,"correct":true},"5":{"wager":2,"correct":true},"6":{"wager":1,"correct":false},"7":{"wager":1,"correct":false},"8":{"wager":1,"correct":false},"9":{"wager":3,"correct":true},"10":{"wager":1,"correct":false}},{"0":{"wager":2,"correct":true},"1":{"wager":2,"correct":true},"2":{"wager":4,"correct":true},"3":{"wager":2,"correct":false},"4":{"wager":4,"correct":true},"5":{"wager":4,"correct":true},"6":{"wager":2,"correct":false},"7":{"wager":4,"correct":true},"8":{"wager":4,"correct":true},"9":{"wager":2,"correct":true},"10":{"wager":2,"correct":true}},{"0":{"wager":3,"correct":true},"1":{"wager":4,"correct":true},"2":{"wager":2,"correct":true},"3":{"wager":3,"correct":true},"4":{"wager":1,"correct":false},"5":{"wager":1,"correct":true},"6":{"wager":4,"correct":true},"7":{"wager":2,"correct":true},"8":{"wager":2,"correct":true},"9":{"wager":1,"correct":true},"10":{"wager":3,"correct":true}}],"bonus":{"0":4,"1":3,"2":4,"3":2,"4":0,"5":0,"6":2,"7":3,"8":0,"9":2,"10":2}},{"questions":[{"0":{"wager":7,"correct":true},"1":{"wager":7,"correct":true},"2":{"wager":5,"correct":true},"3":{"wager":7,"correct":true},"4":{"wager":3,"correct":true},"5":{"wager":5,"correct":true},"6":{"wager":7,"correct":true},"7":{"wager":7,"correct":true},"8":{"wager":7,"correct":true},"9":{"wager":3,"correct":true},"10":{"wager":5,"correct":true}},{"0":{"wager":5,"correct":false},"1":{"wager":3,"correct":false},"2":{"wager":7,"correct":true},"3":{"wager":1,"correct":false},"4":{"wager":7,"correct":true},"5":{"wager":7,"correct":true},"6":{"wager":3,"correct":false},"7":{"wager":3,"correct":false},"8":{"wager":1,"correct":false},"9":{"wager":5,"correct":false},"10":{"wager":3,"correct":true}},{"0":{"wager":3,"correct":false},"1":{"wager":1,"correct":false},"2":{"wager":1,"correct":false},"3":{"wager":3,"correct":false},"4":{"wager":1,"correct":false},"5":{"wager":1,"correct":false},"6":{"wager":5,"correct":false},"7":{"wager":1,"correct":false},"8":{"wager":5,"correct":false},"9":{"wager":1,"correct":false},"10":{"wager":1,"correct":false}},{"0":{"wager":1,"correct":false},"1":{"wager":5,"correct":true},"2":{"wager":3,"correct":true},"3":{"wager":5,"correct":true},"4":{"wager":5,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":1,"correct":false},"7":{"wager":5,"correct":true},"8":{"wager":3,"correct":false},"9":{"wager":7,"correct":true},"10":{"wager":7,"correct":true}}],"bonus":{}},{"questions":[{"0":{"wager":4,"correct":true},"1":{"wager":6,"correct":true},"2":{"wager":2,"correct":true},"3":{"wager":4,"correct":true},"4":{"wager":6,"correct":true},"5":{"wager":8,"correct":true},"6":{"wager":4,"correct":false},"7":{"wager":8,"correct":true},"8":{"wager":6,"correct":true},"9":{"wager":6,"correct":true},"10":{"wager":8,"correct":true}},{"0":{"wager":2,"correct":false},"1":{"wager":8,"correct":true},"2":{"wager":6,"correct":true},"3":{"wager":2,"correct":true},"4":{"wager":2,"correct":false},"5":{"wager":6,"correct":true},"6":{"wager":8,"correct":true},"7":{"wager":6,"correct":true},"8":{"wager":4,"correct":true},"9":{"wager":4,"correct":false},"10":{"wager":4,"correct":true}},{"0":{"wager":6,"correct":true},"1":{"wager":4,"correct":false},"2":{"wager":4,"correct":true},"3":{"wager":6,"correct":true},"4":{"wager":4,"correct":false},"5":{"wager":2,"correct":true},"6":{"wager":6,"correct":true},"7":{"wager":2,"correct":true},"8":{"wager":8,"correct":true},"9":{"wager":2,"correct":false},"10":{"wager":2,"correct":true}},{"0":{"wager":8,"correct":true},"1":{"wager":2,"correct":false},"2":{"wager":8,"correct":true},"3":{"wager":8,"correct":true},"4":{"wager":8,"correct":true},"5":{"wager":4,"correct":true},"6":{"wager":2,"correct":true},"7":{"wager":4,"correct":true},"8":{"wager":2,"correct":false},"9":{"wager":8,"correct":true},"10":{"wager":6,"correct":false}}],"bonus":{"0":4,"1":4,"2":4,"3":4,"4":4,"5":4,"6":4,"7":4,"8":4,"9":4,"10":4}},{"questions":[{"0":{"wager":12,"correct":true},"1":{"wager":12,"correct":true},"2":{"wager":12,"correct":true},"3":{"wager":6,"correct":true},"4":{"wager":9,"correct":true},"5":{"wager":9,"correct":true},"6":{"wager":12,"correct":true},"7":{"wager":12,"correct":true},"8":{"wager":6,"correct":false},"9":{"wager":9,"correct":true},"10":{"wager":12,"correct":true}},{"0":{"wager":6,"correct":true},"1":{"wager":6,"correct":false},"2":{"wager":6,"correct":true},"3":{"wager":12,"correct":true},"4":{"wager":12,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":6,"correct":true},"7":{"wager":3,"correct":false},"8":{"wager":9,"correct":true},"9":{"wager":12,"correct":true},"10":{"wager":6,"correct":false}},{"0":{"wager":3,"correct":true},"1":{"wager":9,"correct":false},"2":{"wager":9,"correct":true},"3":{"wager":3,"correct":false},"4":{"wager":3,"correct":false},"5":{"wager":12,"correct":true},"6":{"wager":9,"correct":true},"7":{"wager":9,"correct":true},"8":{"wager":12,"correct":true},"9":{"wager":3,"correct":false},"10":{"wager":9,"correct":true}},{"0":{"wager":9,"correct":true},"1":{"wager":3,"correct":false},"2":{"wager":3,"correct":false},"3":{"wager":9,"correct":true},"4":{"wager":6,"correct":false},"5":{"wager":6,"correct":true},"6":{"wager":3,"correct":true},"7":{"wager":6,"correct":false},"8":{"wager":3,"correct":false},"9":{"wager":6,"correct":true},"10":{"wager":3,"correct":false}}],"bonus":{}}],"halftime":{"0":{"wager":10,"correct":true},"1":{"wager":9,"correct":true},"2":{"wager":8,"correct":false},"3":{"wager":4,"correct":true},"4":{"wager":7,"correct":true},"5":{"wager":10,"correct":true},"6":{"wager":5,"correct":false},"7":{"wager":10,"correct":true},"8":{"wager":3,"correct":true},"9":{"wager":8,"correct":true},"10":{"wager":2,"correct":false}},"finalWager":{"0":{"wager":20,"correct":true},"1":{"wager":12,"correct":true},"2":{"wager":18,"correct":false},"3":{"wager":8,"correct":true},"4":{"wager":15,"correct":true},"5":{"wager":20,"correct":true},"6":{"wager":10,"correct":false},"7":{"wager":14,"correct":true},"8":{"wager":6,"correct":false},"9":{"wager":17,"correct":true},"10":{"wager":5,"correct":false}},"gameStarted":true}`;

// One continuous 32.6s drumroll: the 2.03s intro followed by 13 back-to-back copies of the
// 2.35s loop clip, butt-joined sample-accurately offline and encoded as a single MP3. This is
// one clip rather than an intro plus a looping middle because an HTMLMediaElement's loop
// restart is NOT gapless — it seeks back to zero, dropping a few ms of audio, which on
// something as continuous as a snare roll reads as a skip every 2.35s. (Web Audio's loop was
// sample-accurate, so this only became audible once the AudioContext came out; see the AUDIO
// POLICY note below for why it had to go.) MP3 encoder padding used to be the reason the loop
// clip had to stay uncompressed WAV, but padding only sits at a file's head and tail, and
// 32.6s covers the 30s maximum drumroll with room to spare — playback never reaches the end
// and never loops, so neither boundary is ever heard. Rebuild with: decode the intro, append
// 13 copies of the loop clip as raw PCM, then
//   ffmpeg -i roll.wav -c:a libmp3lame -b:a 128k -ar 48000 -ac 2 roll.mp3
// then replace assets/audio/roll.mp3 with the result.
//
// A fraction of a second of digital silence. iOS grants an <audio> element permission to play
// only when a play() call happens inside a user gesture, and that permission is per element —
// so the spare elements that hold the fade and finale have to be played once inside the host's
// drumroll tap, before they are ever needed. Playing this first (then swapping to the real
// clip, which keeps the permission) makes that unlocking play genuinely inaudible.
//
// The automatic ending: the victory horn with the drumroll fading out underneath it, mixed
// offline into one clip. A single <audio> element can only ever play one thing at a time, so
// an overlap has to be baked in — swapping straight from the roll to the horn left a hard
// cut where the roll simply vanished, which is what read as choppy. The roll enters this clip
// at exactly the level it was already playing at (the fade curve is at unity with zero slope
// at t=0), so the swap into it is inaudible, then it falls away over 1.0s. The curve decays
// faster than the standalone fade tail because it has to clear room for the horn, which is
// ~13dB quieter than the roll in RMS and would otherwise be masked through its own attack.
// WAV, not MP3: this clip is spliced into a running roll, and an encoder's leading padding would
// drop a gap at precisely the seam it exists to hide.
//
// These four finished clips (silent/roll/finale/horn) ship as real files under assets/audio/,
// referenced directly by DRUM_CLIPS below — not as base64 text in this bundle. They used to be
// four const DRUM_*_B64 strings here, individually decoded into a Blob on first use, which cost
// every visitor ~2.1MB of extra download and parse/compile time on this file whether or not they
// ever ran a drumroll. A real <audio src="assets/audio/...">, like the app's own icons and fonts
// already are, is at least as fast to swap between as the blob: URL it replaces (both are cheap
// handle lookups, no re-parse — the AUDIO POLICY note below explains why a data: URI specifically
// was rejected for the opposite reason) and lets the browser's HTTP/disk cache — and this app's
// own service worker precache — do the caching instead of an in-memory Blob rebuilt every
// session. Still file://-safe: <audio src> resolves like <img src>, not like fetch(), so it is
// not subject to Chrome's block on fetch()/XHR to local files (see the top-of-file note on why
// file:// has to keep working here) — unlike DRUM_FADESRC_B64 below, which stays base64 text for
// exactly that reason.
//
// Raw PCM for the drumroll fade-out: one seamless 2.352s loop of the roll, interleaved stereo
// 16-bit at 48kHz, with no container around it (buildFadeClip writes its own WAV header).
// Shipped as source material rather than as a finished clip because the fade length is a
// Settings slider now, and pre-rendering every length the slider can reach would cost
// megabytes and still quantise it. Applying an envelope to these samples is plain
// arithmetic over a typed array, so a fade of any length is built without Web Audio — which
// stays off-limits here for the reason in the AUDIO POLICY note below. Declared in
// js/data/drum-clips.js (loaded before this file) rather than inline here, same reasoning as
// TRIVIA_XLSX_B64 in js/data/xlsx-templates.js: one giant string literal kept out of the file
// every visitor's browser has to parse just to run anything else in the app.
/* ── HOST BANTER LINES ──────────────────────────────────────────────
   Cycle through these between questions/rounds and after reading scores.
   Add, remove, or rewrite any line freely — keep them in your own voice. */
const BANTER = {
  next: [
    "And there's the answer! Let's keep this energy rolling — next question.",
    "Boom, that's the one. Staying in motion, here comes the next.",
    "That was a good one. Shake it off, here's the next question.",
    "Hope that felt good! On we go to the next.",
    "Whether you nailed it or not, now you know. Next question coming up.",
    "Love the buzz in this room — let's ride it into the next one.",
    "That's the answer, folks. Stay with me, here's the next.",
    "Locked in? Good. Pencils ready for the next question.",
    "Nicely played, everybody. Onward to the next.",
    "That one's in the books. Bartender, a round of consolation for the wrong answers.",
    "Somewhere in this room, someone just changed a right answer to a wrong one. Rest in peace, that point.",
  ],
  round: [
    "That round's in the books — great work! Stretch those brains, the next round's coming up.",
    "Fun round, everybody. Grab a drink, we'll be right back at it.",
    "That's a wrap on this round. You all brought it — next one's on its way.",
    "Solid round! Check in with your team and get ready, there's more fun ahead.",
    "Round done, and you made it look easy. Give yourselves a hand.",
    "Nice work this round. Quick breather, then we dive back in.",
    "That round had some teeth — you survived it! Onto the next.",
    "Done and dusted. Remember: it's not about what you know, it's about what your teammate refused to write down.",
    "Round finished! If you're winning, act humble. If you're losing, act like it's strategy.",
    "Remember: there's no crying in trivia. There's a little crying in trivia.",
    "Wagers are scored! Fortunes were made and lost on that one.",
  ],
  scores: [
    "Alright, let's see where everybody stands — here come the scores!",
    "Score update time — let's see how the night is shaping up.",
    "Here's where we are, and I'll tell you, it is interesting up top.",
    "Let's check the standings — honestly, it's anybody's game right now.",
    "Updated scores coming at you — and there's still plenty of trivia left.",
    "Scoreboard time! Whether you're leading or climbing, the night is young.",
    "Here come the numbers — don't get comfortable, this can still swing.",
    "Scores are in for that one. No lead is safe, folks.",
    "Let's see those totals. Remember: the team in last place statistically buys the best snacks.",
    "If you're losing, it builds character. If you're winning, it builds a tab.",
    "Statistically, the team in last is having the best time. Somebody has to.",
  ],
  beer: [
    "EVERYONE got that one — beer round, people! Beautifully done, whole room.",
    "Full marks across the board — you are all on fire tonight!",
    "That's a beer round! Every single team nailed it. Gorgeous.",
    "Unanimous! The entire room got it. That's what I'm talking about.",
    "This right here is why I love this gig. Beer round — you earned it!",
    "Clean sweep, everybody. Not a single miss. Cheers to that!",
  ],
  manywrong: [
    "Oof, that one had teeth — a lot of teams just found that out.",
    "That question caught a bunch of you! It's a sneaky one, no shame.",
    "Tricky one, that. Plenty of teams went the other way — here's the answer.",
    "A lot of folks zigged when they should've zagged on that one.",
    "That one's gonna stick with you now — that's how it sticks for next time.",
    "Rough one for the room — totally understandable, here's how it shakes out.",
    "Brutal! If your table got that one, order something fancy — you've earned it.",
    "A lot of red on my sheet for that one. It was a toughie — shake it off!",
  ],
  everyonewrong: [
    "Okay, that one got EVERYBODY — don't feel bad, it got the whole room!",
    "Nobody landed that one, and honestly? It was brutal. No shame at all.",
    "Zero for zero on that one — a true stumper, and I get why.",
    "That might be the hardest question of the night. Nobody got it — telling.",
    "When the whole room misses, that's on the question, not you. Here's the answer.",
    "Clean miss across the board. File this one away for next time!",
  ],
};
const BANTER_CAT_LABEL = {
  next: "After the Answer / Next Question",
  round: "Moving to the Next Round",
  scores: "Reading the Scores",
  beer: "Beer Round — Everyone Right",
  manywrong: "Many Got It Wrong",
  everyonewrong: "Everyone Got It Wrong",
};
/* In-memory only: maps a placement key -> current line index. Persists across
   renderLeft() re-renders (which happen on every score tap) so a line a host
   refreshed to mid-round doesn't snap back to the first line. Intentionally NOT
   saved to storage — banter resets fresh each session. */
let banterState = {};
function banterLine(cat, key) {
  const arr = BANTER[cat] || [];
  if (!arr.length) return "";
  let i = banterState[key];
  if (i == null || i < 0 || i >= arr.length) {
    i = Math.floor(Math.random() * arr.length);
    banterState[key] = i;
  }
  return arr[i];
}
function renderBanter(cat, key, opts) {
  opts = opts || {};
  const sm = opts.sm ? " banter-sm" : "";
  const showLabel = opts.label !== false;
  const lbl = BANTER_CAT_LABEL[cat] || "";
  const line = banterLine(cat, key);
  return (
    `<div class="banter${sm}">` +
    `<div class="banter-main">` +
    (showLabel ? `<span class="banter-cat">${ICON_MIC} ${esc(lbl)}</span>` : "") +
    `<div class="banter-text" data-bkey="${key}">${esc(line)}</div>` +
    `</div>` +
    `<button class="banter-refresh" type="button" onclick="cycleBanter('${key}','${cat}')" title="New line" aria-label="Refresh banter line">${ICON_REFRESH}</button>` +
    `</div>`
  );
}
/* Pick a different random line, update ONLY that line's text node (no full
   re-render) so the refresh button never moves and scroll never jumps. */
function cycleBanter(key, cat) {
  const arr = BANTER[cat] || [];
  if (arr.length < 2) {
    return;
  }
  let cur = banterState[key] ?? -1,
    next = cur;
  while (next === cur) {
    next = Math.floor(Math.random() * arr.length);
  }
  banterState[key] = next;
  const el = document.querySelector(
    '.banter-text[data-bkey="' +
      (window.CSS && CSS.escape ? CSS.escape(key) : key) +
      '"]',
  );
  if (el) el.textContent = arr[next];
}

/* ── THANK THE STAFF ────────────────────────────────────────────────
   Shown right after the halftime wager — the one real pause in the night, and the point where
   the room still has drinks left to order. {names} is filled from Event Details → Restaurant
   Staff; when that's empty the line still reads fine, it just goes generic. Rewrite these
   freely, but keep the {names} token — it's the whole reason the block exists. */
const STAFF_THANKS = [
  "Halftime's in the books — and none of it happens without {names}. Give them a hand, and remember: they are the only people in this room who can bring you another drink.",
  "Round of applause for {names}! They've been dodging your elbows all night carrying a full tray — tip them like your next drink depends on it. It does.",
  "Quick shoutout to the real MVPs tonight: {names}. Not one correct wager between them, but every glass in here is full — take care of them on the way out.",
  "Before we go further — let's hear it for {names}, keeping this place running while we all yell about geography.",
  "Big thanks to {names} behind the bar tonight — pouring all night and putting up with us the whole time.",
  "Round of applause for {names} — you've earned hazard pay navigating this crowd tonight.",
  "Let's not forget the people actually working tonight — thank you to {names} for having us.",
  "A big thank you to {names} — trivia night doesn't happen without you.",
  "Let's hand out some appreciation along with the points tonight — thanks, {names}.",
  "Quick shoutout to {names}, keeping the drinks and food coming — we see you, we appreciate you.",
  "Before the next round — thanks to {names} behind the bar and in the kitchen making this happen.",
];
const STAFF_THANKS_FALLBACK = "your servers and bartenders tonight";
const STAFF_THANKS_KEY = "staff-thanks";
/* Builds the line as HTML (not text) so the names can be emphasised — they're the part the
   host actually has to read off. Index lives in banterState, so a line the host refreshed to
   survives the re-render that fires on every score tap, same as the banter lines nearby. */
function staffThanksHtml() {
  const raw = (gameState.meta.staffNames || "").trim();
  const names = raw
    ? `<strong class="staff-thanks-names">${esc(raw)}</strong>`
    : `<em class="staff-thanks-missing">${STAFF_THANKS_FALLBACK}</em>`;
  let i = banterState[STAFF_THANKS_KEY];
  if (i == null || i < 0 || i >= STAFF_THANKS.length) {
    i = Math.floor(Math.random() * STAFF_THANKS.length);
    banterState[STAFF_THANKS_KEY] = i;
  }
  // esc() first, then substitute: escaping leaves the {names} token alone, so the only markup
  // that survives into the line is the bit built above.
  return esc(STAFF_THANKS[i]).replace("{names}", names);
}
function cycleStaffThanks() {
  if (STAFF_THANKS.length < 2) return;
  let cur = banterState[STAFF_THANKS_KEY] ?? -1,
    next = cur;
  while (next === cur) {
    next = Math.floor(Math.random() * STAFF_THANKS.length);
  }
  banterState[STAFF_THANKS_KEY] = next;
  const el = document.getElementById("staffThanksLine");
  if (el) el.innerHTML = staffThanksHtml();
}
/* Two boxes write this one field — Event Details and the halftime block. Push the value into
   the other box and re-word the line in place rather than calling renderLeft(): a full render
   mid-typing would take the caret with it. The box that's being typed in is skipped, since
   assigning .value to a focused textarea moves the cursor to the end. */
function setStaffNames(v) {
  gameState.meta.staffNames = v;
  autosave();
  document.querySelectorAll(".staff-names-input").forEach((el) => {
    if (el !== document.activeElement && el.value !== v) el.value = v;
  });
  const line = document.getElementById("staffThanksLine");
  if (line) line.innerHTML = staffThanksHtml();
}
/* The editor is deliberately not gated behind the Event Details lock: the point of putting it
   here is that a host who never filled the names in can add them mid-game without scrolling
   back up, and it's free text that no score depends on. */
function renderStaffThanks() {
  if (!gameState.teams.length) return "";
  return (
    `<div class="staff-thanks" id="staffThanksBlock">` +
    `<div class="banter banter-sm">` +
    `<div class="banter-main">` +
    `<span class="banter-cat">${ICON_HEART} Thank the Staff</span>` +
    `<div class="banter-text" id="staffThanksLine">${staffThanksHtml()}</div>` +
    `</div>` +
    `<button class="banter-refresh" type="button" onclick="cycleStaffThanks()" title="New line" aria-label="Refresh staff thank-you line">${ICON_REFRESH}</button>` +
    `</div>` +
    `<label class="staff-thanks-edit"><span class="staff-thanks-edit-label">Staff names — same field as Event Details</span>` +
    `<textarea class="meta-textarea staff-names-input" maxlength="200" rows="2" aria-label="Restaurant staff names" placeholder="Server / bartender names to shout out" oninput="setStaffNames(this.value)">${esc(gameState.meta.staffNames || "")}</textarea></label>` +
    `</div>`
  );
}
// Both this array and DEFAULT_SI are shared with the FAQ (js/shared-ui.js's SHARED_FONT_SIZES/
// SHARED_DEFAULT_SIZE_INDEX) — same sizes, same default, so kept in one place instead of two
// copies of the same 14 numbers.
const FONT_SIZES = SHARED_FONT_SIZES,
  DEFAULT_SI = SHARED_DEFAULT_SIZE_INDEX;
const DENSITIES = ["normal", "compact", "relaxed"],
  DENSITY_LABELS = { normal: "Normal", compact: "Compact", relaxed: "Relaxed" };
const STRIPE_LEVELS = [0, 1, 2],
  STRIPE_LABELS = { 0: "Subtle", 1: "Medium", 2: "High" };

// collapsed question state: Set of "ri-qi" keys
let collapsedQuestions = new Set();
let collapsedBonusQuestions = new Set();
let collapsedSpecialWagers = new Set();
let questionSortOrder = {};

function loadPrefs() {
  try {
    const r = TRStore.getItem(PREFS_KEY);
    if (r) {
      const p = JSON.parse(r);
      // "hc-dark"/"hc-light" ("hc" for high contrast, from back when that was a separate,
      // optional theme rather than the only one) were the stored values every real returning
      // visitor's browser has under this key as of the rename that dropped the prefix — without
      // them listed here too, a real saved "hc-light" preference would fail the now-current
      // ["dark","light"] check above and fall through to the wrong branch below (anything not
      // recognized as light-ish defaults dark), flipping actual visitors from Light to Dark the
      // first time they load the renamed build. "light"/"bw" predate that and are kept for the
      // same reason, one rename further back.
      if (!["dark", "light"].includes(p.theme))
        p.theme = ["light", "bw", "hc-light"].includes(p.theme)
          ? "light"
          : "dark";
      if (p.sizeIndex == null) p.sizeIndex = DEFAULT_SI;
      if (!p.density) p.density = "normal";
      if (p.settingsOpen == null) p.settingsOpen = false;
      if (p.stripeLevel == null) p.stripeLevel = 0;
      if (p.cbMode == null) p.cbMode = p.colorblind ? 1 : 0;
      if (!p.craftDrawSeconds) p.craftDrawSeconds = 6;
      if (p.showAdjustments == null) p.showAdjustments = false;
      if (p.advancedOpen == null) p.advancedOpen = false;
      if (p.unlockEventDetails == null) p.unlockEventDetails = false;
      // qtDurationSec replaces the old whole-minutes-only qtDurationMin now that the base
      // duration is set from a 30-second-increment dropdown in Settings — migrate an existing
      // saved qtDurationMin rather than resetting it.
      if (!p.qtDurationSec)
        p.qtDurationSec = p.qtDurationMin ? p.qtDurationMin * 60 : 180;
      if (p.showTimer == null) p.showTimer = true;
      if (p.showTimerSteppers == null) p.showTimerSteppers = false;
      if (p.timerPulse == null) p.timerPulse = true;
      if (p.craftManualEnd == null) p.craftManualEnd = false;
      if (p.craftFadeSec == null) p.craftFadeSec = CRAFT_FADE_DEFAULT;
      if (p.qResultToggle == null) p.qResultToggle = false;
      return p;
    }
  } catch (e) {}
  return {
    theme: "dark",
    sizeIndex: DEFAULT_SI,
    density: "normal",
    settingsOpen: false,
    stripeLevel: 0,
    cbMode: 0,
    craftDrawSeconds: 6,
    showAdjustments: false,
    advancedOpen: false,
    unlockEventDetails: false,
    qtDurationSec: 180,
    showTimer: true,
    showTimerSteppers: false,
    timerPulse: true,
    craftManualEnd: false,
    craftFadeSec: CRAFT_FADE_DEFAULT,
    qResultToggle: false,
  };
}
function savePrefs(p) {
  TRStore.setItem(PREFS_KEY, JSON.stringify(p));
}
function applyPrefs() {
  const p = loadPrefs();
  // data-theme set BEFORE applyIconStyle below: ICON_DONE's own emoji picks between ✔️/☑️ by
  // reading data-theme off the DOM (see applyIconStyle), so the new theme has to already be
  // live on <html> the moment that read happens — otherwise a theme change made in the same tick
  // this runs (setTheme calls applyPrefs synchronously) would apply icons for the THEME BEING
  // LEFT rather than the one being switched to.
  document.documentElement.setAttribute("data-theme", p.theme);
  // Before the theme toggle's innerHTML write below reads THEME_ICON_SUN/MOON (and every other
  // ICON_* use further down this function and in renderAll()), so a saved "emoji" preference is
  // already in effect for the very first paint instead of flashing the pictograph first.
  applyIconStyle(p.iconStyle === "emoji" ? "emoji" : "pictograph");
  const dn = p.density || "normal";
  if (dn === "normal") document.documentElement.removeAttribute("data-density");
  else document.documentElement.setAttribute("data-density", dn);
  const tb = document.getElementById("themeToggle");
  if (tb)
    tb.innerHTML =
      p.theme === "light"
        ? THEME_ICON_SUN + " Light"
        : THEME_ICON_MOON + " Dark";
  const cbm = p.cbMode || 0;
  if (cbm) document.documentElement.setAttribute("data-cb", String(cbm));
  else document.documentElement.removeAttribute("data-cb");
  setCvSelectDisplay(String(cbm));
  const si = Math.max(
    0,
    Math.min(FONT_SIZES.length - 1, p.sizeIndex ?? DEFAULT_SI),
  );
  document.documentElement.style.fontSize = FONT_SIZES[si] + "px";
  const sr = document.getElementById("sizeResetBtn");
  if (sr) sr.textContent = si === DEFAULT_SI ? "A" : FONT_SIZES[si] + "px";
  const dt = document.getElementById("densityToggle");
  if (dt) dt.textContent = DENSITY_LABELS[dn] || "Normal";
  const panel = document.getElementById("settingsPanel");
  if (panel) panel.classList.toggle("settings-visible", !!p.settingsOpen);
  document
    .getElementById("settingsBackdrop")
    ?.classList.toggle("show", !!p.settingsOpen);
  const stb = document.getElementById("settingsToggleBtn");
  if (stb) stb.classList.toggle("active", !!p.settingsOpen);
  const sl = p.stripeLevel ?? 0;
  if (sl === 0) document.documentElement.removeAttribute("data-stripe");
  else document.documentElement.setAttribute("data-stripe", String(sl));
  const slt = document.getElementById("stripeToggle");
  if (slt) slt.textContent = STRIPE_LABELS[sl] || "Subtle";
  const adt = document.getElementById("adjToggle");
  if (adt) {
    adt.classList.toggle("active", !!p.showAdjustments);
    adt.textContent = p.showAdjustments ? "Shown" : "Hidden";
  }
  const advBtn = document.getElementById("advToggleBtn"),
    advGroup = document.getElementById("advancedGroup");
  if (advBtn && advGroup) {
    advBtn.classList.toggle("open", !!p.advancedOpen);
    advBtn.setAttribute("aria-expanded", String(!!p.advancedOpen));
    advGroup.classList.toggle("open", !!p.advancedOpen);
  }
  const unlockToggle = document.getElementById("unlockEventDetailsToggle");
  if (unlockToggle) {
    unlockToggle.classList.toggle("active", !!p.unlockEventDetails);
    unlockToggle.textContent = p.unlockEventDetails ? "Unlocked" : "Locked";
  }
  const timerToggle = document.getElementById("timerVisibleToggle");
  if (timerToggle) {
    timerToggle.classList.toggle("active", !!p.showTimer);
    timerToggle.textContent = p.showTimer ? "Shown" : "Hidden";
  }
  if (p.showTimer)
    document.documentElement.removeAttribute("data-timer-hidden");
  else document.documentElement.setAttribute("data-timer-hidden", "1");
  // Both rows below configure the timer widget itself — Timer Stepper Buttons decides whether IT
  // shows -30/+30 nudges, Timer Pulse decides whether IT flashes — so neither means anything with
  // Timer Widget off, same reasoning as Drumroll Crossfade needing Manual Drumroll Control on.
  const steppersRow = document.getElementById("timerSteppersRow");
  if (steppersRow) steppersRow.style.display = p.showTimer ? "" : "none";
  const pulseRow = document.getElementById("timerPulseRow");
  if (pulseRow) pulseRow.style.display = p.showTimer ? "" : "none";
  const stepperToggle = document.getElementById("timerSteppersToggle");
  if (stepperToggle) {
    stepperToggle.classList.toggle("active", !!p.showTimerSteppers);
    stepperToggle.textContent = p.showTimerSteppers ? "Shown" : "Hidden";
  }
  if (p.showTimerSteppers)
    document.documentElement.setAttribute("data-timer-steppers", "1");
  else document.documentElement.removeAttribute("data-timer-steppers");
  const pulseToggle = document.getElementById("timerPulseToggle");
  if (pulseToggle) {
    pulseToggle.classList.toggle("active", !!p.timerPulse);
    pulseToggle.textContent = p.timerPulse ? "Shown" : "Hidden";
  }
  if (p.timerPulse)
    document.documentElement.removeAttribute("data-timer-no-pulse");
  else document.documentElement.setAttribute("data-timer-no-pulse", "1");
  const fadeRange = document.getElementById("craftFadeRange");
  if (fadeRange) {
    fadeRange.value = String(craftFadeSec());
    previewCraftFadeSec(fadeRange.value);
  }
  const qResultToggle = document.getElementById("qResultToggleBtn");
  if (qResultToggle) {
    qResultToggle.classList.toggle("active", !!p.qResultToggle);
    qResultToggle.textContent = p.qResultToggle ? "On" : "Off";
  }
  const manualEndToggle = document.getElementById("craftManualEndToggle");
  if (manualEndToggle) {
    manualEndToggle.classList.toggle("active", !!p.craftManualEnd);
    manualEndToggle.textContent = p.craftManualEnd ? "On" : "Off";
  }
  // The crossfade length only ever matters once Manual Drumroll Control is on — it's Stop
  // Drumroll's own fade-out duration, and that button doesn't exist until manual control does —
  // so the row stays hidden rather than sitting there configuring a feature that isn't active.
  const crossfadeRow = document.getElementById("drumCrossfadeRow");
  if (crossfadeRow) crossfadeRow.style.display = p.craftManualEnd ? "" : "none";
  const vl = document.getElementById("versionLabel");
  if (vl) vl.textContent = "Scorekeeper " + APP_VERSION + " · " + APP_VERSION_DATE;
  const qts = document.getElementById("qtDurationSelect");
  if (qts && document.activeElement !== qts) qts.value = p.qtDurationSec;
}
function setTheme(t) {
  if (!["dark", "light"].includes(t)) t = "dark";
  const p = loadPrefs();
  p.theme = t;
  savePrefs(p);
  applyPrefs();
  // ICON_DONE's own emoji depends on theme now (see applyIconStyle), so a theme change has to
  // rebuild every already-rendered Done badge/mini-progress banner, not just flip CSS variables
  // the way every other theme-driven visual in this app can get away with — renderAll() re-reads
  // the ICON_DONE applyPrefs above just updated, the same order setIconStyle already uses
  // (applyIconStyle direct, then renderAll) so this isn't a new pattern, just the same one theme
  // changes hadn't needed before.
  renderAll();
}
function toggleTheme() {
  const p = loadPrefs();
  setTheme(p.theme === "dark" ? "light" : "dark");
}
function toggleAdjSetting() {
  const p = loadPrefs();
  p.showAdjustments = !p.showAdjustments;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
function toggleAdvancedSettings() {
  const p = loadPrefs();
  p.advancedOpen = !p.advancedOpen;
  savePrefs(p);
  toggleClassPreserveScroll(
    document.getElementById("settingsPanel"),
    document.getElementById("advToggleBtn"),
    () => applyPrefs(),
  );
}
function toggleUnlockEventDetails() {
  const p = loadPrefs();
  p.unlockEventDetails = !p.unlockEventDetails;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
function toggleTimerVisible() {
  const p = loadPrefs();
  p.showTimer = !p.showTimer;
  savePrefs(p);
  applyPrefs();
  syncQtimerH();
}
function toggleTimerSteppers() {
  const p = loadPrefs();
  p.showTimerSteppers = !p.showTimerSteppers;
  savePrefs(p);
  applyPrefs();
  syncQtimerH();
}
function toggleTimerPulse() {
  const p = loadPrefs();
  p.timerPulse = !p.timerPulse;
  savePrefs(p);
  applyPrefs();
}
function toggleQResultButtons() {
  const p = loadPrefs();
  p.qResultToggle = !p.qResultToggle;
  savePrefs(p);
  applyPrefs();
  renderAll();
}
function toggleCraftManualEnd() {
  const p = loadPrefs();
  p.craftManualEnd = !p.craftManualEnd;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
// Drumroll fade-out length, in seconds — the Settings slider's range and its default.
const CRAFT_FADE_MIN = 0.2;
const CRAFT_FADE_MAX = 3;
const CRAFT_FADE_DEFAULT = 1.2;
function craftFadeSec() {
  const v = parseFloat(loadPrefs().craftFadeSec);
  if (!isFinite(v)) return CRAFT_FADE_DEFAULT;
  return Math.max(CRAFT_FADE_MIN, Math.min(CRAFT_FADE_MAX, Math.round(v * 10) / 10));
}
// Live readout while the slider is being dragged. Deliberately does not rebuild the clip —
// re-rendering a multi-hundred-KB WAV on every pointer move would stutter the drag for nothing,
// since the value isn't committed until release.
function previewCraftFadeSec(v) {
  const el = document.getElementById("craftFadeVal");
  if (el) el.textContent = parseFloat(v).toFixed(1) + "s";
}
// Committed on release. Rebuilds the clip at the new length and re-arms the cue if one is already
// loaded, so the next "Stop Drumroll" uses it. Deliberately does NOT create a cue element if none
// exists — that needs a user gesture on the drumroll button and would claim the iOS audio session
// from a Settings slider, which is exactly what the AUDIO POLICY forbids. The next draw picks the
// new length up on its own.
function setCraftFadeSec(v) {
  const p = loadPrefs();
  p.craftFadeSec = Math.max(
    CRAFT_FADE_MIN,
    Math.min(CRAFT_FADE_MAX, Math.round(parseFloat(v) * 10) / 10),
  );
  savePrefs(p);
  applyPrefs();
  const cue = drumCues.fade;
  if (cue && cue.src !== drumClipUrl("silent")) {
    cue.src = drumClipUrl("fade");
    cue.load();
  }
}
function setCbMode(v) {
  const p = loadPrefs();
  p.cbMode = parseInt(v, 10) || 0;
  savePrefs(p);
  applyPrefs();
}

// Thin, page-named wrappers around js/shared-ui.js's sharedToggleCvMenu/sharedCloseCvMenu/
// sharedSetCvSelectDisplay — same widget, same markup, same positioning logic as the FAQ's own
// #faqCvSelect, so the actual implementation lives there once instead of as two independently
// hand-maintained copies (see that file's own top comment for why). Kept as same-named
// functions here rather than calling the shared ones directly from index.html's onclick=""
// attributes, so nothing in the markup had to change for this.
function closeCvMenu() {
  sharedCloseCvMenu("cbSelect");
}
function toggleCvMenu(e) {
  sharedToggleCvMenu(e, "cbSelect");
}
function selectCvOption(li, v) {
  setCvSelectDisplay(v);
  closeCvMenu();
  setCbMode(v);
}
function setCvSelectDisplay(v) {
  sharedSetCvSelectDisplay("cbSelect", v);
}
document.addEventListener("click", (e) => {
  // .cv-select-menu is checked separately from .cv-select: while open the menu is a child of
  // <body>, so it is no longer inside .cv-select for closest() to find.
  if (!e.target.closest(".cv-select") && !e.target.closest(".cv-select-menu"))
    closeCvMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCvMenu();
});
// The menu is now position:fixed (placed against the viewport, not the Settings panel — see
// .cv-select-menu's CSS comment), so it no longer scrolls along with the button that opened it.
// Close it on scroll rather than let it drift away from — or overlap — its own button. Capture
// phase is required: scroll doesn't bubble, and .settingsPanel/.settings-panel-body, not
// document, are what actually receive it.
document.getElementById("settingsPanel")?.addEventListener(
  "scroll",
  closeCvMenu,
  true,
);
function toggleDensity() {
  const p = loadPrefs();
  const ci = DENSITIES.indexOf(p.density || "normal");
  p.density = DENSITIES[(ci + 1) % DENSITIES.length];
  savePrefs(p);
  applyPrefs();
}
function toggleStripe() {
  const p = loadPrefs();
  const ci = STRIPE_LEVELS.indexOf(p.stripeLevel ?? 0);
  p.stripeLevel = STRIPE_LEVELS[(ci + 1) % STRIPE_LEVELS.length];
  savePrefs(p);
  applyPrefs();
}
function adjustFontSize(d) {
  const p = loadPrefs();
  if (d === 0) p.sizeIndex = DEFAULT_SI;
  else
    p.sizeIndex = Math.max(
      0,
      Math.min(FONT_SIZES.length - 1, (p.sizeIndex ?? DEFAULT_SI) + d),
    );
  savePrefs(p);
  applyPrefs();
}
function toggleSettings() {
  const p = loadPrefs();
  p.settingsOpen = !p.settingsOpen;
  savePrefs(p);
  applyPrefs();
}
// Closing the panel by removing its "settings-visible" class alone doesn't stick — settingsOpen
// is a persisted pref, and every renderAll() calls applyPrefs(), which re-reads that pref and
// re-shows the panel on the very next render if it's still true. Loading a saved/sample game
// (below) needs the pref itself flipped, not just the DOM, or the panel pops back open the
// moment the next score is entered and renderAll() fires.
function closeSettingsPanel() {
  const p = loadPrefs();
  if (p.settingsOpen) {
    p.settingsOpen = false;
    savePrefs(p);
  }
  applyPrefs();
}

(function () {
  const p = loadPrefs();
  document.documentElement.setAttribute("data-theme", p.theme);
  if (p.cbMode)
    document.documentElement.setAttribute("data-cb", String(p.cbMode));
  if (p.density && p.density !== "normal")
    document.documentElement.setAttribute("data-density", p.density);
  if (p.stripeLevel && p.stripeLevel > 0)
    document.documentElement.setAttribute("data-stripe", String(p.stripeLevel));
  document.documentElement.style.fontSize =
    FONT_SIZES[
      Math.max(0, Math.min(FONT_SIZES.length - 1, p.sizeIndex ?? DEFAULT_SI))
    ] + "px";
})();

function freshState() {
  return {
    meta: {
      date: new Date().toISOString().slice(0, 10),
      location: "",
      quizId: "",
      hostName: "",
      craftPartner: "",
      craftPartnerTown: "",
      bonusItem: "",
      staffNames: "",
      excludeTopN: 2,
    },
    teams: [],
    rounds: [0, 1, 2, 3].map(() => ({
      questions: [{}, {}, {}, {}],
      bonus: {},
    })),
    halftime: {},
    finalWager: {},
    gameStarted: false,
    craftPrizeWinner: null,
  };
}
function freshTeam(n) {
  return {
    name: n || "",
    scoreGuess: "",
    bonusItem: false,
    njcb: false,
    adjustment: 0,
    craftPrize: false,
  };
}

let gameState = freshState(),
  scoreSortMode = "entry",
  randomOrder = null;
let standingsSortMode = { halftime: "entry", final: "entry" };
let standingsRandomOrder = { halftime: null, final: null };
let collapsedStandings = new Set();
let collapsedSections = new Set([
  "sec-r1",
  "sec-r2",
  "sec-r3",
  "sec-r4",
  "sec-craftprize",
  "sec-export",
]);
let adjOpenTeams = new Set(),
  lastAction = null;
// Tracks the nearest identifiable ancestor (a team's own row, or failing that the whole
// question/bonus/special-wager/team-entry block, or failing that the whole collapsible
// .section) of whatever was just clicked inside #mainContent — used by renderLeft()'s scroll
// anchor further down this file. Delegated + capture phase (not each scoring function setting
// this individually, the way lastAction above
// only covers cycleW) so EVERY scoring path is covered automatically: cycleW, markAll, bonus
// choices, special-wager correct/incorrect, point adjustments, any future one — all of them
// re-render through renderLeft(), and all of them can shift content the same way.
//
// `.section` is the catch-all at the end of that selector list, and it covers every re-rendering
// control that isn't a scoring row at all: Craft Prize Drawing's buttons and steppers, Event
// Details' fields, Export & Data's. Without it those matched nothing, so renderLeft() ran with
// no anchor and fell back to the raw sy/wy restore — i.e. exactly the pre-v18.41 behaviour this
// anchor exists to replace: right for as long as nothing above them changed height, and a jump
// to somewhere unrelated the moment something did. closest() returns the NEAREST match, so a
// scoring row inside a section still anchors to the row, never to the whole section.
//
// Capture phase runs before the click's own onclick handler (cycleW/markAll/etc., which is what actually
// triggers the re-render), so this is always set to the right target before renderLeft() ever
// reads it. Not document.activeElement: Safari deliberately doesn't focus a <button> on a plain
// mouse/touch click, so that would silently miss this exact interaction on iOS, the platform
// this was reported from.
//
// Declared here, at the very top of the script, rather than down next to renderLeft() itself
// (where this used to live): the very first render on a brand-new session (no saved game — see
// the IIFE below) runs synchronously during initial script evaluation, and that first
// renderLeft() call reads this variable. A `let` declared later in the same script is in its
// temporal dead zone until its own statement executes, so reading it any earlier — even from a
// function invoked before that point — throws a ReferenceError. With this block previously
// positioned after renderLeft()'s definition (i.e. after that first synchronous render call),
// every brand-new session crashed on load with a blank #mainContent and never recovered, since
// the thrown error aborted the rest of the script before this declaration (and the click
// listener below) ever ran — leaving every future render call hitting the exact same
// ReferenceError forever. Returning users were unaffected (their saved session skips that first
// synchronous render, see the IIFE below), which is why this went unnoticed: it only bites the
// very first launch, or any time storage gets cleared/evicted (e.g. iOS Safari's ~7-day
// eviction for a PWA that sits unopened between events).
// KEYBOARD ACTIVATION for every role="button" in the app. These are divs and spans (section
// headers, question headers, team names, the mini-progress bar, standings rows) that carry
// role="button" and tabindex="0", so a keyboard or screen-reader user can focus them — but a
// plain element does not activate on Enter/Space the way a real <button> does, so before this
// they could be reached and then not used at all. That is a WCAG 2.1.1 (Keyboard, Level A)
// failure, and it covered 297 controls.
// Delegated on document rather than an onkeydown per element for the same reason the click
// anchor above is delegated: it covers every one of them, including any added later, from one
// place. Space is preventDefault-ed because its default action on a focused non-button is to
// scroll the page, which would fire the control AND jump the view.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  const el = e.target.closest('[role="button"]');
  if (!el) return;
  // A real <button>/<a> inside the region handles its own keys; don't fire both.
  if (e.target.closest("button,a,input,textarea,select") ) return;
  e.preventDefault();
  el.click();
});

// Screen-reader announcements for things that change on screen without moving focus — scoring a
// team, clearing a mark, the craft prize winner. Sighted hosts see the row update; without a live
// region a blind host taps a wager and gets no confirmation the tap landed at all (WCAG 4.1.3
// Status Messages, Level AA).
// The element is in the static HTML rather than created on demand: an aria-live region has to be
// in the DOM and observed by the accessibility tree BEFORE text is put into it, or the first
// message is silently missed. polite, so it queues behind whatever the reader is already saying
// instead of cutting it off — every message here is a confirmation, never an emergency.
// Re-announcing an identical string is a no-op in most readers, so a trailing space is toggled to
// force each one through even when the same message repeats (e.g. two teams both scoring "+4").
let __srToggle = false;
function teamLabel(ti) {
  return (gameState.teams[ti] && gameState.teams[ti].name) || "Team " + (ti + 1);
}
function announce(msg) {
  const el = document.getElementById("srAnnouncer");
  if (!el || !msg) return;
  __srToggle = !__srToggle;
  el.textContent = msg + (__srToggle ? " " : "");
}

// ---- CHARACTER-LIMIT FEEDBACK ------------------------------------------------------------
// Every host-typed field carries a maxlength (Team name 40, Location 60, Quiz ID 24, the
// announcement script 600, and so on). The browser enforces those silently: at the limit the
// field simply stops accepting characters, with no cue at all. Typing a team name that is one
// word too long therefore looks identical to a dropped keypress or a wedged app, and the host
// finds out only when they read back a name that stops mid-word.
//
// One delegated listener rather than a handler per field: the fields are re-rendered from
// scratch on nearly every interaction (renderLeft swaps #mainContent's innerHTML), so anything
// bound to the elements themselves would have to be re-bound every time. Delegation on document
// survives all of it and picks up fields added later for free.
//
// The note is one shared element that gets moved to whichever field is at its limit, not a node
// per field, so there is never more than one on screen and nothing to clean up if a re-render
// takes the old parent away. It is removed when the value drops back under the limit, when focus
// leaves, and on a timer — whichever happens first, because a message about what you just typed
// stops being about what you just typed fairly quickly.
(function () {
  let noteEl = null,
    noteTimer = null,
    noteField = null;
  function clearLimitNote() {
    clearTimeout(noteTimer);
    noteTimer = null;
    if (noteField) noteField.classList.remove("at-limit");
    noteField = null;
    if (noteEl) noteEl.remove();
    noteEl = null;
  }
  function showLimitNote(el, max) {
    // Already showing for this same field — leave it alone rather than restarting the timer on
    // every further keystroke, which would keep a note up indefinitely while the host holds a
    // key down against the limit.
    if (noteField === el) return;
    clearLimitNote();
    noteEl = document.createElement("span");
    noteEl.className = "limit-note";
    // aria-hidden and a separate announce(): the note is inserted mid-edit, and a live region
    // that appears inside the field's own labelling context can make a screen reader re-read the
    // whole field. #srAnnouncer is the app's existing single announcement channel.
    noteEl.setAttribute("aria-hidden", "true");
    noteEl.textContent = `Limit reached — ${max} characters max`;
    el.insertAdjacentElement("afterend", noteEl);
    el.classList.add("at-limit");
    noteField = el;
    announce(`Character limit reached, ${max} maximum`);
    noteTimer = setTimeout(clearLimitNote, 3200);
  }
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (
      !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    )
      return;
    // maxLength is -1 on a field that does not declare one, and number inputs (the team guess)
    // have no meaningful length limit even though they have min/max.
    const max = el.maxLength;
    if (!max || max < 0 || el.type === "number") return;
    if (el.value.length >= max) showLimitNote(el, max);
    else if (noteField === el) clearLimitNote();
  });
  // Capture, because focusout does not bubble in the same way from every field type here, and
  // because the field may be gone by the time a bubbled event would arrive.
  document.addEventListener("focusout", clearLimitNote, true);
})();

let lastClickAnchorSel = null;
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest(
      "[data-ta], [data-ti], .question-block, .special-section, .standings-sort-btns, .standings-block, .section",
    );
    if (!el) return;
    lastClickAnchorSel = el.hasAttribute("data-ta")
      ? `[data-ta="${el.getAttribute("data-ta")}"]`
      : el.hasAttribute("data-ti")
        ? `[data-ti="${el.getAttribute("data-ti")}"]`
        : el.id
          ? "#" + el.id
          : null;
  },
  true,
);
// Track which (ri,qi) combos we've already toasted for Beer Round
let beerRoundToasted = new Set();
// Craft prize randomizer (transient — not persisted across reload)
let craftDrawState = null,
  craftDrawTimeouts = [];
// Whether the host has opened the drawing flow. The section shows nothing but a single
// "Choose Craft Prize Winner" button until this is true, so none of the draw's machinery —
// audio included — is reachable without an explicit tap.
let craftFlowOpen = false;

function autosave() {
  TRStore.setItem(STORAGE_KEY, JSON.stringify(gameState));
}
function loadSaved() {
  try {
    const r = TRStore.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return null;
}
function clearSaved() {
  TRStore.removeItem(STORAGE_KEY);
}

(function () {
  const s = loadSaved();
  if (s) {
    // innerHTML, not textContent: the icon is markup, and a saved location is host-entered
    // free text, so it goes through esc() on the way in.
    document.getElementById("resumeText").innerHTML =
      ICON_ALERT +
      " Saved session from " +
      esc(s.meta?.date ? isoToMDY(s.meta.date) : "?") +
      " at " +
      esc(s.meta?.location || "(no location)") +
      ". Resume or start fresh?";
    document.getElementById("resumeBanner").classList.add("show");
  } else {
    gameState = freshState();
    renderAll();
  }
})();

// Keeps --qtimer-h in sync with the real rendered height of the desktop question timer, which
// .scores-list (see styles.css) reserves as bottom padding so the last team row can always
// scroll clear of the timer instead of being permanently stranded behind it. A ResizeObserver
// (not a one-time measurement) because the timer's height isn't fixed — it changes with
// font-size settings and with row-density/text-size changes elsewhere in Settings. Also called
// directly from toggleTimerVisible(): a display:none element reports 0 here, so hiding the
// timer collapses that reserved padding back down instead of leaving a gap behind it.
function syncQtimerH() {
  const qtEl = document.querySelector(".qtimer-desktop");
  if (!qtEl) return;
  document.documentElement.style.setProperty(
    "--qtimer-h",
    qtEl.offsetHeight + "px",
  );
}
(function () {
  const qtEl = document.querySelector(".qtimer-desktop");
  if (!qtEl) return;
  new ResizeObserver(syncQtimerH).observe(qtEl);
  syncQtimerH();
})();

// Keeps --header-h in sync with the real rendered height of .header, which .mini-progress
// (see styles.css) uses on mobile to sit just below it instead of underneath it. A
// ResizeObserver (not a one-time measurement) because the header's height isn't fixed — it
// changes with font-size settings and with the safe-area inset on notched phones.
(function () {
  const headerEl = document.querySelector(".header");
  if (!headerEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--header-h",
      headerEl.offsetHeight + "px",
    );
  new ResizeObserver(sync).observe(headerEl);
  sync();
})();

// Keeps --layout-top in sync with where .app-layout actually starts down the viewport, which is
// what its desktop height subtracts from 100dvh (see the note on .app-layout in styles.css for
// what the hardcoded 60px this replaces got wrong, and why the blank strip it left below the
// layout was reachable by scrolling with the cursor over the Scores column).
//
// One measurement of the panel's own top edge, rather than adding up the heights of the things
// above it: the sticky .header and the Resume banner are what sit there today, but a single
// "where does it begin" number stays right for whatever is ever added, shown or hidden up there,
// with no list to keep in step.
//
// getBoundingClientRect().top + scrollY, not offsetTop, because offsetTop is rounded to a whole
// pixel and this needs the fraction: the header is 46.5px at the default text size, and half a
// pixel of leftover height is enough for the document's rounded-up scrollHeight to exceed the
// viewport and make the page scrollable by 1px again — the exact thing being fixed. Adding
// scrollY makes it the document-relative top, so a measurement taken while the page happens to
// be scrolled (the very state this corrects, on the first pass after load) still reads true.
//
// Observed rather than measured once, for the same reason as --header-h above: the header grows
// with the font-size setting, and the Resume banner appears on load with a saved session and
// disappears on Resume/New Game/dismiss — a display:none toggle, which a ResizeObserver reports
// as a resize to zero. The window listener covers viewport changes that resize nothing being
// observed, and the two together are idempotent: re-running sync with nothing changed writes the
// same value back.
(function () {
  const layoutEl = document.querySelector(".app-layout");
  if (!layoutEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--layout-top",
      layoutEl.getBoundingClientRect().top + window.scrollY + "px",
    );
  const ro = new ResizeObserver(sync);
  // The two things in flow above the panel, and deliberately NOT the panel itself: a
  // ResizeObserver reports size, not position, so observing the panel could not detect it being
  // MOVED anyway — and since its height is what this variable sets, observing it would only feed
  // every write back in as another callback.
  for (const el of [
    document.querySelector(".header"),
    document.getElementById("resumeBanner"),
  ]) {
    if (el) ro.observe(el);
  }
  window.addEventListener("resize", sync);
  sync();
  // This first sync() can still be measuring a page that hasn't fully settled: the resume
  // banner's own text renders in Inter (font-display:swap) starting from a fallback system font,
  // and the fallback's metrics are narrower per character on every measured case — so the very
  // first paint can wrap the banner's one sentence onto one FEWER line than the webfont it swaps
  // into a few dozen ms later. That swap is a genuine resize of #resumeBanner and the observer
  // above does catch most of them, but the ones that land in the gap between this synchronous
  // sync() call and the observer's own first async callback are missed entirely, leaving
  // --layout-top permanently undershooting the panel's real top by however many lines the swap
  // added — which makes .app-layout (height:calc(100vh - var(--layout-top))) render that many
  // lines TALLER than the viewport actually has room for, and the document becomes scrollable by
  // exactly that overshoot: this is the "I can still scroll down past the bottom" bug. Nothing
  // else in the page re-triggers sync() once that initial race is lost — document.fonts.ready
  // resolves once every @font-face this page declares has actually swapped in, so this adds the
  // one guaranteed re-measurement that closes it, independent of whichever element's resize the
  // observer happened to miss.
  if (document.fonts?.ready) document.fonts.ready.then(sync);
  // Belt-and-braces for the same race from the other end: the window "load" event (all
  // resources, not just fonts, finished) fires after fonts.ready in every case that matters here
  // and costs nothing extra to also resync on, in case something other than a font swap is ever
  // the thing that lands late.
  window.addEventListener("load", sync);
})();

// Keeps --mobile-dock-h in sync with the real rendered height of .mobile-bottom-dock (the peek
// strip + timer docked at the bottom of the screen on mobile). The collapsing scores sheet (see
// .col-right in the mobile media query in styles.css) closes to this height rather than sliding
// fully offscreen, so it visually shrinks down to exactly the docked panel's own size and fades
// out right there instead of a slice of it lingering on top of the now-revealed dock. A
// ResizeObserver (not a one-time measurement) because the dock's height varies with the timer's
// visibility/steppers settings and the safe-area inset on notched phones.
(function () {
  const dockEl = document.getElementById("mobileBottomDock");
  if (!dockEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--mobile-dock-h",
      dockEl.offsetHeight + "px",
    );
  new ResizeObserver(sync).observe(dockEl);
  sync();
})();

// Closes the banner without picking Resume or New Game — for a host who's about to start the
// tutorial or a practice game instead and just wants it out of the way. The saved session stays
// untouched in storage either way; this only reveals the fresh empty game already sitting in
// gameState (see the top-level IIFE above), same as what's behind the banner until a choice is made.
function dismissResumeBanner() {
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}
function resumeSession() {
  const s = loadSaved();
  if (s) gameState = migrateState(s);
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}
function startNewGame() {
  clearSaved();
  gameState = freshState();
  scoreSortMode = "entry";
  randomOrder = null;
  standingsSortMode = { halftime: "entry", final: "entry" };
  standingsRandomOrder = { halftime: null, final: null };
  collapsedStandings = new Set();
  collapsedSections = new Set([
    "sec-r1",
    "sec-r2",
    "sec-r3",
    "sec-r4",
    "sec-craftprize",
    "sec-export",
  ]);
  collapsedQuestions = new Set();
  collapsedBonusQuestions = new Set();
  collapsedSpecialWagers = new Set();
  questionSortOrder = {};
  beerRoundToasted = new Set();
  adjOpenTeams = new Set();
  clearCraftDrawTimers();
  stopAllDrumAudio();
  craftDrawState = null;
  craftFlowOpen = false;
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}

function migrateState(s) {
  if (!s.meta)
    s.meta = {
      date: "",
      location: "",
      quizId: "",
      hostName: "",
      craftPartner: "",
      craftPartnerTown: "",
      bonusItem: "",
      staffNames: "",
    };
  [
    "hostName",
    "craftPartner",
    "craftPartnerTown",
    "bonusItem",
    "staffNames",
  ].forEach((k) => {
    s.meta[k] = s.meta[k] || "";
  });
  // The same limits the inputs carry as maxlength, applied again to whatever comes IN. maxlength
  // only stops a person typing past it — it does nothing for a value arriving from a loaded .json
  // file, an older session saved before these limits existed, or a paste handled by script. The
  // PDF header and the scoresheet's team column size their text to fit a fixed box, so a runaway
  // value doesn't overflow, it shrinks until it can't be read; clamping on the way in is what
  // keeps that from being reachable at all.
  Object.entries(FIELD_MAX).forEach(([k, max]) => {
    if (typeof s.meta[k] === "string" && s.meta[k].length > max)
      s.meta[k] = s.meta[k].slice(0, max);
  });
  if (Array.isArray(s.teams))
    s.teams.forEach((t) => {
      if (typeof t.name === "string" && t.name.length > FIELD_MAX.teamName)
        t.name = t.name.slice(0, FIELD_MAX.teamName);
    });
  if (!s.meta.excludeTopN) s.meta.excludeTopN = s.meta.giftCardCount || 2;
  if (!s.teams) s.teams = [];
  s.teams.forEach((t) => {
    if (t.adjustment === undefined) t.adjustment = 0;
    if (t.njcb === undefined) t.njcb = false;
    if (t.craftPrize === undefined) t.craftPrize = false;
  });
  if (!s.rounds || s.rounds.length < 4)
    s.rounds = [0, 1, 2, 3].map(
      (i) => s.rounds?.[i] || { questions: [{}, {}, {}, {}], bonus: {} },
    );
  s.rounds.forEach((r) => {
    if (!r.questions || r.questions.length < 4) r.questions = [{}, {}, {}, {}];
    if (!r.bonus) r.bonus = {};
  });
  if (!s.halftime) s.halftime = {};
  if (!s.finalWager) s.finalWager = {};
  if (s.gameStarted === undefined) s.gameStarted = false;
  if (s.craftPrizeWinner === undefined)
    s.craftPrizeWinner =
      s.craftPrizeDraws && s.craftPrizeDraws.length
        ? s.craftPrizeDraws[s.craftPrizeDraws.length - 1]
        : null;
  return s;
}

function checkGameStarted() {
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++) {
      const q = gameState.rounds[ri].questions[qi];
      for (const k in q) {
        if (q[k] && (q[k].wager !== undefined || q[k].correct !== undefined)) {
          gameState.gameStarted = true;
          return true;
        }
      }
    }
    if (BONUS_ROUNDS.has(ri)) {
      const b = gameState.rounds[ri].bonus;
      for (const k in b) {
        if (b[k] != null) {
          gameState.gameStarted = true;
          return true;
        }
      }
    }
  }
  for (const k in gameState.halftime) {
    if (gameState.halftime[k]?.wager) {
      gameState.gameStarted = true;
      return true;
    }
  }
  for (const k in gameState.finalWager) {
    if (gameState.finalWager[k]?.wager) {
      gameState.gameStarted = true;
      return true;
    }
  }
  return gameState.gameStarted;
}

// BEER ROUND: question is a beer round if every team has been marked AND all are correct
function isBeerRound(ri, qi) {
  const n = gameState.teams.length;
  if (n === 0) return false;
  for (let ti = 0; ti < n; ti++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (!a || a.wager === undefined || a.correct !== true) return false;
  }
  return true;
}

function checkBeerRound(ri, qi) {
  const key = ri + "-" + qi;
  if (isBeerRound(ri, qi)) beerRoundToasted.add(key);
}

function roundSub(ti, ri) {
  const rd = gameState.rounds[ri];
  let t = 0;
  for (let qi = 0; qi < 4; qi++) {
    const a = rd.questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined)
      t += a.correct ? a.wager : 0;
  }
  if (BONUS_ROUNDS.has(ri)) {
    const bc = rd.bonus[ti];
    if (bc != null) t += bc * 5;
  }
  return t;
}
function htPts(ti) {
  const h = gameState.halftime[ti];
  if (!h || h.wager == null || h.wager === "") return 0;
  if (h.correct == null) return 0;
  return h.correct ? +h.wager : -h.wager;
}
function fwPts(ti) {
  const f = gameState.finalWager[ti];
  if (!f || f.wager == null || f.wager === "") return 0;
  if (f.correct == null) return 0;
  return f.correct ? +f.wager : -f.wager;
}
function grandTotal(ti) {
  let t = 0;
  for (let ri = 0; ri < 4; ri++) t += roundSub(ti, ri);
  t += htPts(ti) + fwPts(ti);
  if (gameState.teams[ti]?.bonusItem) t += 5;
  if (gameState.teams[ti]?.njcb) t += 3;
  t += gameState.teams[ti]?.adjustment || 0;
  return t;
}
// Teams level on total score are broken by Score Guess closeness (the same "closer guess wins
// the tie" rule the Final Results table already uses) — a team with no guess sorts last within
// its tied group (Infinity), same as there. Two teams that are ALSO tied on guess-closeness (or
// both have no guess at all) are a genuine, unbreakable tie and stay grouped for rankMap()
// below; a.index as the final fallback just keeps the sort stable/deterministic.
function ranked() {
  return gameState.teams
    .map((t, i) => {
      const total = grandTotal(i);
      const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
      const hasGuess = !(t.scoreGuess === "" || t.scoreGuess == null);
      const guessDiff = hasGuess
        ? Math.abs(total - bonuses - parseInt(t.scoreGuess, 10))
        : Infinity;
      return {
        index: i,
        name: t.name || "Team " + (i + 1),
        total,
        guessDiff,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total || a.guessDiff - b.guessDiff || a.index - b.index,
    );
}
// Dense ("1223") ranking on the (total, guessDiff) tie-broken order above: teams tied on BOTH
// total score and guess-closeness share a place, and the next genuinely-distinct team takes the
// very next place — no numbers get skipped for however many teams just tied. A closer guess now
// resolves a tied total into its own next place instead of sharing one (three teams "tied" for
// 5th by score alone, but one guessed closer, place as 5th/6th/6th instead of 5th/5th/5th) — no
// more than one team can hold 1st/2nd/etc. unless their guesses were ALSO tied.
function rankMap() {
  const rk = ranked();
  const rm = {};
  let place = 0,
    prevTotal = null,
    prevDiff = null;
  rk.forEach((r) => {
    if (prevTotal === null || r.total !== prevTotal || r.guessDiff !== prevDiff)
      place++;
    rm[r.index] = place;
    prevTotal = r.total;
    prevDiff = r.guessDiff;
  });
  return rm;
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function finalResultsRows() {
  const dv = (r) => (r.diff == null ? Infinity : r.diff);
  const rows = gameState.teams.map((t, i) => {
    const score = grandTotal(i);
    const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
    const hasG = !(t.scoreGuess === "" || t.scoreGuess == null);
    const guess = hasG ? parseInt(t.scoreGuess, 10) : null;
    const diff = hasG ? Math.abs(score - bonuses - guess) : null;
    // >0 = guess came in over the actual score, <0 = under, 0 = exact — display-only, the
    // tie-break sort above always uses the unsigned diff.
    const diffSign = hasG ? Math.sign(guess - (score - bonuses)) : 0;
    return {
      index: i,
      name: t.name || "Team " + (i + 1),
      score,
      guess,
      diff,
      diffSign,
    };
  });
  const byPlace = rows
    .slice()
    .sort((a, b) => b.score - a.score || dv(a) - dv(b) || a.index - b.index);
  // Place NUMBER is dense on the (score, diff) compound key — same rule as the sidebar's
  // rankMap(): a closer guess resolves a tied score into its own next place instead of sharing
  // one, so no more than one team can hold 1st/2nd/etc. unless their guesses were ALSO tied.
  // Only a genuinely unbreakable tie (same score AND same diff, or both teams with no guess at
  // all) still shares a place number and gets the "tie" badge below.
  let place = 0,
    prevScore = null,
    prevDiff = null;
  byPlace.forEach((r) => {
    const d = dv(r);
    if (prevScore === null || r.score !== prevScore || d !== prevDiff) place++;
    r.place = place;
    prevScore = r.score;
    prevDiff = d;
  });
  // .tie/.tieWinner are about the SCORE alone (not the compound place key above) — they flag
  // "this team's score was tied with another's" so the host can see at a glance where the
  // guess tiebreak actually did work, even though the place numbers are now always distinct.
  // .tieWinner marks whoever had the closest guess in that tied group (the one who got the
  // better place out of it); everyone else in the group just gets the plain "tie" badge.
  const cnt = {};
  rows.forEach((r) => {
    cnt[r.score] = (cnt[r.score] || 0) + 1;
  });
  const minD = {};
  rows.forEach((r) => {
    if (cnt[r.score] > 1) {
      const d = dv(r);
      if (minD[r.score] === undefined || d < minD[r.score]) minD[r.score] = d;
    }
  });
  rows.forEach((r) => {
    r.tie = cnt[r.score] > 1;
    r.tieWinner = r.tie && dv(r) === minD[r.score];
  });
  return byPlace
    .slice()
    .reverse(); /* ascending: lowest score (worst place) first */
}
function renderFinalResults() {
  if (!gameState.teams.length)
    return '<p class="fr-note">Add teams and score the game to see final results.</p>';
  const rows = finalResultsRows();
  let h =
    '<table class="final-table"><thead><tr><th>Place</th><th>Team</th><th>Score</th><th class="fr-guess-h">Guess</th><th class="fr-diff-h">Diff *</th></tr></thead><tbody>';
  rows.forEach((r) => {
    const medal =
      r.place === 1
        ? " fr-gold"
        : r.place === 2
          ? " fr-silver"
          : r.place === 3
            ? " fr-bronze"
            : "";
    const diffSigned =
      r.diffSign > 0 ? "+" + r.diff : r.diffSign < 0 ? "-" + r.diff : r.diff;
    h +=
      `<tr class="${r.tie ? "fr-tie" : ""}${medal}" role="button" tabindex="0" title="${esc(r.name)} \u2014 tap to view team report" onclick="openAudit(${r.index})">` +
      `<td class="fr-place" data-label="Place">${ordinal(r.place)}</td>` +
      `<td class="fr-name" data-label="Team"><span class="ta-name-clickable">${esc(r.name)}</span>${r.tie ? ` <span class="fr-tiebadge${r.tieWinner ? " fr-win" : ""}">${r.tieWinner ? CHECK_ICON_SVG + " closer" : "tie"}</span>` : ""}</td>` +
      `<td class="fr-score" data-label="Score">${r.score}</td>` +
      `<td class="fr-guess" data-label="Guess">${r.guess == null ? "\u2014" : r.guess}</td>` +
      `<td class="fr-diff${r.tieWinner ? " fr-diff-win" : ""}" data-label="Diff *">${r.guess == null ? "\u2014" : diffSigned}</td>` +
      `</tr>`;
  });
  h += "</tbody></table>";
  h +=
    '<details class="fr-details"><summary>Diff *</summary>' +
    `<p class="fr-note">Listed lowest \u2192 highest score (reveal order). Equal scores are broken by whose final guess is closest to their actual score \u2014 the smallest <strong>Diff</strong> takes the higher place (marked <span style="color:var(--badge-green-fg);font-weight:700;">${CHECK_ICON_SVG} closer</span>, with the rest of that tied group marked <strong>tie</strong>). A team tied on BOTH score and Diff shares a place number outright.</p>` +
    "<p class=\"fr-note\">* <strong>Diff</strong> is minus Bonuses \u2014 Bonus Item (+5) and NJCB (+3) are stripped from a team's score before it's compared to their guess, for every team.</p>" +
    "</details>";
  return h;
}
function usedW(ti, ri) {
  const u = [];
  for (let qi = 0; qi < 4; qi++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined) u.push({ qi, wager: a.wager });
  }
  return u;
}
function preWagerTotal(ti, type) {
  let t = roundSub(ti, 0) + roundSub(ti, 1);
  if (type === "final") t += htPts(ti) + roundSub(ti, 2) + roundSub(ti, 3);
  if (gameState.teams[ti]?.bonusItem) t += 5;
  if (gameState.teams[ti]?.njcb) t += 3;
  t += gameState.teams[ti]?.adjustment || 0;
  return t;
}

function renderStandings(type) {
  if (!gameState.teams.length) return "";
  const label =
    type === "halftime"
      ? "Scores \u2014 Before Halftime Wager"
      : "Scores \u2014 Before Final Wager";
  const mode = standingsSortMode[type] || "entry";
  const base = gameState.teams.map((t, ti) => ({
    ti,
    name: t.name || "Team " + (ti + 1),
    pts: preWagerTotal(ti, type),
  }));
  let list;
  if (mode === "random") {
    const ro = standingsRandomOrder[type];
    list = ro && ro.length === base.length ? ro.map((ti) => base[ti]) : base;
  } else list = base;
  const btns = [
    ["entry", "Entry"],
    ["random", `${ICON_SHUFFLE}<span class="sr-only">Shuffle</span>`],
  ]
    .map(
      ([m, lbl]) =>
        `<button class="standings-sort-btn${mode === m ? " active" : ""}" title="${m === "random" ? "Shuffle" : ""}" onclick="setStandingsSort('${type}','${m}')">${lbl}</button>`,
    )
    .join("");
  const isCollapsed = collapsedStandings.has(type);
  let h =
    `<div class="standings-block${isCollapsed ? " collapsed" : ""}" id="standings-${type}">` +
    `<div class="standings-title-row" role="button" tabindex="0" onclick="toggleStandingsCollapse('${type}')" title="${isCollapsed ? "Expand" : "Collapse"}" aria-label="${isCollapsed ? "Expand" : "Collapse"} ${esc(label)}"><span class="chevron standings-chevron">\u25BC</span><span class="standings-title">${label}</span></div>` +
    `<div class="standings-collapsible">` +
    renderBanter("scores", "sc-" + type, { sm: true }) +
    `<div class="standings-sort-btns" id="standings-sortbtns-${type}">${btns}</div>` +
    `<table class="standings-table"><thead><tr><th>Team</th><th>Score</th></tr></thead><tbody>`;
  list.forEach((t) => {
    h += `<tr class="standings-row" role="button" tabindex="0" title="${esc(t.name)} — tap to view team report" onclick="openAudit(${t.ti})"><td class="standings-name ta-name-clickable">${esc(t.name)}</td><td class="standings-pts">${t.pts}</td></tr>`;
  });
  return h + "</tbody></table></div></div>";
}
function toggleStandingsCollapse(type) {
  if (collapsedStandings.has(type)) collapsedStandings.delete(type);
  else collapsedStandings.add(type);
  const el = document.getElementById("standings-" + type);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (!el) return;
    const nowCollapsed = el.classList.toggle("collapsed");
    const row = el.querySelector(".standings-title-row");
    const label = row?.querySelector(".standings-title")?.textContent || "";
    if (row) {
      const verb = nowCollapsed ? "Expand" : "Collapse";
      row.title = verb + " " + label;
      row.setAttribute("aria-label", verb + " " + label);
    }
  });
}

function setSortMode(mode) {
  if (mode === "random") {
    randomOrder = gameState.teams.map((_, i) => i);
    for (let i = randomOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomOrder[i], randomOrder[j]] = [randomOrder[j], randomOrder[i]];
    }
  }
  scoreSortMode = mode;
  renderSB();
}
function getDisplayOrder() {
  const n = gameState.teams.length;
  if (scoreSortMode === "random" && randomOrder && randomOrder.length === n)
    return randomOrder.slice();
  if (scoreSortMode === "asc" || scoreSortMode === "desc") {
    // Sorts by rankMap()'s own place number (already tie-broken by score then guess-closeness)
    // rather than grandTotal alone — otherwise a tied pair could land in an order that
    // contradicts their #1/#2 rank badges, and Ascending's "dramatic reveal" could end on the
    // 2nd-place team instead of the actual winner.
    const rm = rankMap();
    const order = gameState.teams.map((_, i) => i);
    order.sort((a, b) => rm[a] - rm[b] || a - b);
    if (scoreSortMode === "asc") order.reverse();
    return order;
  }
  return gameState.teams.map((_, i) => i);
}
function sortModeLabel() {
  switch (scoreSortMode) {
    case "random":
      return `${ICON_SHUFFLE_TINTED} Shuffled order \u2014 for mid-game reads`;
    case "asc":
      return `${ICON_ARROW_UP} Lowest to highest \u2014 dramatic reveal`;
    case "desc":
      return `${ICON_ARROW_DOWN} Highest to lowest \u2014 leaderboard order`;
    default:
      return `${ICON_CLIPBOARD} Entry order \u2014 matches your scoresheet`;
  }
}

function setStandingsSort(type, mode) {
  if (mode === "random") {
    const order = gameState.teams.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    standingsRandomOrder[type] = order;
  }
  standingsSortMode[type] = mode;
  renderLeft();
}

function isBonusBeerRound(ri) {
  const n = gameState.teams.length;
  if (!n) return false;
  for (let ti = 0; ti < n; ti++) {
    if (gameState.rounds[ri].bonus[ti] !== 4) return false;
  }
  return true;
}
function isSpecialBeerRound(type) {
  const n = gameState.teams.length;
  if (!n) return false;
  const data = type === "halftime" ? gameState.halftime : gameState.finalWager;
  for (let ti = 0; ti < n; ti++) {
    const d = data[ti];
    if (!d || d.correct !== true) return false;
  }
  return true;
}

function renderAll() {
  renderLeft();
  renderSB();
  applyPrefs();
}

function renderLeft() {
  const m = document.getElementById("mainContent");
  if (!m) return;
  let sy = m.scrollTop;
  let wy = window.scrollY || document.documentElement.scrollTop || 0;
  // sy/wy alone assume nothing ABOVE the scroll position changed height between renders — but a
  // round badge's "N left" count changing width, a round or question flipping to its "Done"
  // state, sort re-ordering a question's rows, etc. all shift everything below them by a few px,
  // which is what "the view moves"/"jumps to somewhere random" whenever a score gets corrected —
  // sy/wy end up numerically right but pointing at different content than before. So instead we
  // anchor on whatever was just clicked (see lastClickAnchorSel above): note exactly where it
  // sits on screen now, and after the re-render put the scroll back so it sits in that same
  // place again. Consumed once, then cleared — so an unrelated later re-render (an onchange
  // handler elsewhere, say) never reuses a stale anchor from a click that has nothing to do
  // with it.
  //
  // NOT scrollIntoView({block:"nearest"}), which is what v18.45 used and what was still causing
  // the reported jump. Two separate problems with it, and they pull in opposite directions:
  //
  //   1. "nearest" asks the browser to bring the anchor *into view*, and a scroll container
  //      whose scroll-padding is `auto` (the default) explicitly permits the UA to place the
  //      target clear of obscuring position:sticky elements. This app stacks sticky bars at the
  //      top of the scroller — .header, and .mini-progress under it on mobile — so once the host
  //      is scrolled into a round (i.e. the entire time they're scoring), a row in that band
  //      counts as obscured and every tap on it snapped the view to push it clear. Measured on
  //      desktop: a hard snap by exactly .header's height, landing every start offset on the
  //      same final scrollTop. And whenever the anchor was outside the viewport for any reason,
  //      "nearest" yanked the whole view to it — up to 527px in testing.
  //   2. In the case it was actually added for it did nothing at all: if content above the
  //      anchor changes height, the anchor moves on screen but stays "in view", so "nearest" is
  //      satisfied and the shift goes uncorrected.
  //
  // Pinning the anchor to its own previous on-screen offset has neither problem — it's zero
  // movement by construction, and it never asks the browser where the element "should" go, so
  // sticky overlays, scroll-margin, content reflowing above it, and late-settling fonts are all
  // equally irrelevant.
  const anchorSel = lastClickAnchorSel;
  lastClickAnchorSel = null;
  // Where the anchor sits on screen right now, measured before anything is replaced. Viewport
  // coordinates (getBoundingClientRect) rather than offsetTop: they stay valid no matter which
  // ancestor actually ends up scrolling, which matters because the scroller differs by layout —
  // #mainContent scrolls on desktop, the window scrolls on mobile.
  const anchorBefore = anchorSel
    ? m.querySelector(anchorSel)?.getBoundingClientRect().top
    : undefined;
  const gs = checkGameStarted();
  let h = "";

  // Only VISIBLE once scoring has actually begun — before that there's no "current round" to
  // report, and showing it during team setup would just be clutter above Event Details. Still
  // rendered (just visibility:hidden via .mp-pending) rather than omitted outright once teams
  // exist, though: omitting it entirely until the first score landed was making Event Details
  // and everything below it jump down the moment that first badge popped in. Reserving the same
  // real markup — not a guessed placeholder height — the whole time guarantees the space it
  // claims once visible is exactly the space already held for it.
  h += renderMiniProgress(gs);

  // Quiz ID's format is free-entry — it never blocks scoring, just hinted: a soft warning
  // when it doesn't match the usual pattern, a green confirmation once it does. Being EMPTY
  // is a separate matter, though: like Location and Host Name, something has to be there
  // before scoring can start (checked in canScore()) — quizIdInvalid covers that, entirely
  // independent of quizIdWarn/quizIdGood, which only ever apply once something's typed.
  const quizIdEntered = !!(gameState.meta.quizId || "").trim();
  const quizIdGood = quizIdEntered && isQuizIdValid(gameState.meta.quizId);
  const quizIdWarn = quizIdEntered && !quizIdGood;
  const quizIdInvalid = !gs && !quizIdEntered;
  const locInvalid = !gs && !isLocationValid(gameState.meta.location);
  const hostInvalid = !gs && !isHostNameValid(gameState.meta.hostName);
  // Once scoring starts, Event Details normally locks (so it can't drift mid-game) — but a
  // typo can still happen, so the "Edit Locked Fields" setting lets the host reopen just these.
  const metaLocked = gs && !loadPrefs().unlockEventDetails;
  h += `<div class="section ${collapsedSections.has("sec-meta") ? "collapsed" : ""}" id="sec-meta"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-meta')"><h2>Event Details</h2><span class="chevron">▼</span></div><div class="section-body"><div class="meta-grid">
    <div class="field"><label>Date</label><div class="date-native-wrap"><input type="date" class="date-native" aria-label="Date" value="${esc(gameState.meta.date || "")}" ${metaLocked ? "disabled" : ""} onchange="setGameDateISO(this.value)"><span class="date-display-text${gameState.meta.date ? "" : " is-placeholder"}">${esc(isoToPretty(gameState.meta.date) || "Select date")}</span></div></div>
    <div class="field${quizIdInvalid ? " field-invalid" : quizIdWarn ? " field-warn" : quizIdGood ? " field-good" : ""}"><label>Quiz ID</label><input type="text" class="quiz-id-input" maxlength="24" aria-label="Quiz ID" value="${esc(gameState.meta.quizId)}" placeholder="AB-123" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.quizId=this.value;autosave();renderLeft();">${quizIdInvalid ? '<span class="guess-warn">&#9888; required</span>' : quizIdWarn ? '<span class="guess-warn">&#9888; unusual format — typically 1-5 letters + 1-4 numbers, e.g. AB-123</span>' : quizIdGood ? `<span class="guess-good">${CHECK_ICON_SVG} looks good</span>` : ""}</div>
    <div class="field${hostInvalid ? " field-invalid" : ""}"><label>Host Name</label><input type="text" maxlength="40" aria-label="Host Name" value="${esc(gameState.meta.hostName || "")}" placeholder="Who's hosting" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.hostName=this.value;autosave();renderLeft();">${hostInvalid ? '<span class="guess-warn">&#9888; required</span>' : ""}</div>
    <div class="field full${locInvalid ? " field-invalid" : ""}"><label>Location</label><input type="text" maxlength="60" aria-label="Location" list="locationList" autocomplete="off" value="${esc(gameState.meta.location)}" placeholder="Bar name — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.location=this.value;autosave();renderLeft();">${locInvalid ? '<span class="guess-warn">&#9888; required</span>' : ""}</div>
    <div class="field"><label>Craft Partner</label><input type="text" maxlength="50" aria-label="Craft Partner" list="craftPartnerList" autocomplete="off" value="${esc(gameState.meta.craftPartner)}" placeholder="Brewery — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.craftPartner=this.value;autosave();"></div>
    <div class="field"><label>Partner Town</label><input type="text" maxlength="40" aria-label="Partner Town" list="partnerTownList" autocomplete="off" value="${esc(gameState.meta.craftPartnerTown)}" placeholder="Town — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.craftPartnerTown=this.value;autosave();"></div>
    <div class="field full"><label>Bonus Item (+5)</label><input type="text" maxlength="60" aria-label="Bonus Item description" value="${esc(gameState.meta.bonusItem)}" placeholder="e.g., something red, deck of cards" onchange="gameState.meta.bonusItem=this.value;autosave();"></div>
    <div class="field full"><label>Restaurant Staff</label><textarea class="meta-textarea staff-names-input" maxlength="200" aria-label="Restaurant staff names" rows="2" placeholder="Server / bartender names to shout out" oninput="setStaffNames(this.value)">${esc(gameState.meta.staffNames || "")}</textarea></div>
  </div><p class="fr-note${metaLocked ? "" : " fr-note-pending"}"><svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Locked once scoring starts, so it can't drift mid-game. Typo? <a href="#" onclick="event.preventDefault();toggleUnlockEventDetails();">Unlock to fix it</a>.</p></div></div>`;

  // Flagged the whole game, not just before scoring starts — a guess left blank stops blocking
  // anything once scoring begins, but it still silently shows as "—" in Final Results, which
  // reads as a display bug rather than a data-entry gap if the host was never told.
  const missingGuessCount = gameState.teams.filter(
    (t) => t.scoreGuess === "" || t.scoreGuess == null,
  ).length;
  h += `<div class="section ${collapsedSections.has("sec-teams") ? "collapsed" : ""}" id="sec-teams"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-teams')"><h2>Teams (${gameState.teams.length})${missingGuessCount ? ` <span style="font-size:.65rem;font-weight:700;color:var(--txt-orange);background:rgba(255,170,0,.12);border:1px solid var(--accent-orange);border-radius:4px;padding:1px 6px;vertical-align:middle">&#9888; ${missingGuessCount} missing guess${missingGuessCount > 1 ? "es" : ""}</span>` : ""}</h2><span class="chevron">▼</span></div><div class="section-body">`;
  const showAdj = !!loadPrefs().showAdjustments;
  gameState.teams.forEach((t, i) => {
    const adj = t.adjustment || 0,
      adjOpen = adjOpenTeams.has(i);
    h += `<div class="team-entry${showAdj ? " has-adj" : ""}" data-ti="${i}">
      <div class="team-name-cell">
        <span class="team-number">Team ${i + 1}</span>
        <input type="text" maxlength="40" value="${esc(t.name)}" placeholder="Team name" aria-label="Team ${i + 1} name" onchange="gameState.teams[${i}].name=this.value;autosave();renderSB();">
        <div class="team-checks">
          <label class="check-label item-check${t.bonusItem ? " is-checked" : ""}">
            <input type="checkbox" class="check-input" id="bi${i}" ${t.bonusItem ? "checked" : ""} onchange="gameState.teams[${i}].bonusItem=this.checked;this.closest('.check-label').classList.toggle('is-checked',this.checked);autosave();renderSB();"><span class="check-box" aria-hidden="true"></span>+5 Bonus
          </label>
          <label class="check-label njcb-check${t.njcb ? " is-checked" : ""}">
            <input type="checkbox" class="check-input" id="nj${i}" ${t.njcb ? "checked" : ""} onchange="gameState.teams[${i}].njcb=this.checked;this.closest('.check-label').classList.toggle('is-checked',this.checked);autosave();renderSB();"><span class="check-box" aria-hidden="true"></span>+3 NJCB
          </label>
        </div>
      </div>
      <div class="team-guess-cell${t.scoreGuess === "" || t.scoreGuess == null ? " guess-missing" : ""}"><label>Guess</label><input type="number" aria-label="Team ${i + 1} final score guess, 1 to 146" min="1" max="146" value="${t.scoreGuess !== "" ? t.scoreGuess : ""}" placeholder="1-146" onchange="gameState.teams[${i}].scoreGuess=this.value?parseInt(this.value):'';autosave();renderLeft();">${t.scoreGuess === "" || t.scoreGuess == null ? `<span class="guess-warn">&#9888; ${gs ? "missing" : "required"}</span>` : ""}</div>
      ${
        showAdj
          ? `<div class="adj-wrap">
        <button class="adj-chip${adj !== 0 ? " adj-active" : ""}" onclick="toggleAdj(${i})" title="${adj !== 0 ? "Adj: " + (adj > 0 ? "+" : "") + adj + " \u2014 click to edit" : "Manual point adjustment"}">${adj !== 0 ? (adj > 0 ? "+" + adj : adj) : "\u00B1"}</button>
        ${adjOpen ? `<div class="adj-stepper"><button onclick="adjPts(${i},-1)">\u2212</button><span class="adj-val${adj > 0 ? " pos" : adj < 0 ? " neg" : ""}">${adj > 0 ? "+" + adj : adj}</span><button onclick="adjPts(${i},1)">+</button></div>` : ""}
      </div>`
          : ""
      }
      <div class="remove-team"><button onclick="removeTeam(${i})" title="Remove team" aria-label="Remove team ${i + 1}">${X_ICON_SVG}</button></div>
    </div>`;
  });
  if (gameState.teams.length < MAX_TEAMS)
    h += `<button class="btn" id="addTeamBtn" onclick="addTeam()">+ Add Team</button>`;
  else
    h += `<p class="fr-note">${MAX_TEAMS}-team max reached — remove a team to add another.</p>`;
  h += `</div></div>`;

  for (let ri = 0; ri < 4; ri++) {
    const rn = ri + 1,
      rp = roundProgress(ri),
      rComplete = rp.total > 0 && rp.done === rp.total;
    let rpBadge = "";
    if (rp.total > 0) {
      if (rComplete)
        rpBadge = `<span class="round-badge rb-done">${ICON_DONE} Done</span>`;
      else if (rp.done > 0)
        rpBadge =
          '<span class="round-badge rb-partial">' +
          (rp.total - rp.done) +
          " left</span>";
    }
    h += `<div class="section ${collapsedSections.has("sec-r" + rn) ? "collapsed" : ""} ${rComplete ? "round-complete" : ""}" id="sec-r${rn}"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-r${rn}')"><h2><span>Round ${rn}</span>${rpBadge}<span class="round-break"></span><span class="round-label ${ROUND_COLORS[ri]} round-wager-label">Wagers: ${ROUND_WAGERS[ri].join(", ")}</span></h2><span class="chevron">▼</span></div><div class="section-body">`;
    for (let qi = 0; qi < 4; qi++) h += renderWQ(ri, qi);
    if (ri === 1)
      h += renderStandings("halftime") + renderHT() + renderStaffThanks();
    else if (ri === 3) h += renderStandings("final") + renderFW();
    if (BONUS_ROUNDS.has(ri)) h += renderBQ(ri);
    if (ri < 3) h += renderBanter("round", "rbot-" + ri, {}); // outro after every round except the last
    h += `</div></div>`;
  }

  h += `<div class="section ${collapsedSections.has("sec-final") ? "collapsed" : ""}" id="sec-final"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-final')"><h2>${ICON_FLAG} Final Results</h2><span class="chevron">▼</span></div><div class="section-body">${renderFinalResults()}</div></div>`;

  h += `<div class="section ${collapsedSections.has("sec-craftprize") ? "collapsed" : ""}" id="sec-craftprize"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-craftprize')"><h2>${ICON_BEER} Craft Prize Drawing</h2><span class="chevron">\u25BC</span></div><div class="section-body">${renderCraftPrizeBlock()}</div></div>`;

  h += `<div class="section ${collapsedSections.has("sec-export") ? "collapsed" : ""}" id="sec-export"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-export')"><h2>Export &amp; Data</h2><span class="chevron">▼</span></div><div class="section-body">
    <div class="export-bar"><button class="btn" onclick="exportXLSXBackup()">${ICON_SHEET} XLSX</button><button class="btn" onclick="exportPDF()">${ICON_PDF} PDF</button><a class="btn" href="https://app.jotform.com/261954293403156" target="_blank" rel="noopener noreferrer">${ICON_LINK} JD Upload Form</a></div>
    <div class="export-prompt" id="exportPrompt"><p>Export complete. Clear session?</p><div style="display:flex;gap:8px;"><button class="btn btn-accent" onclick="startNewGame();">Yes</button><button class="btn" onclick="document.getElementById('exportPrompt').classList.remove('show');">No</button></div></div>
    <div style="margin-top:14px;text-align:center;"><button class="btn btn-danger" onclick="confirmClearSession()">${ICON_TRASH} Clear Session</button></div>
  </div></div>`;

  m.innerHTML = h;
  // Keeps --mini-progress-h in sync with .mini-progress's real rendered height, the same way
  // --header-h/--mobile-dock-h already are elsewhere — used by .section/.question-block/
  // .special-section's scroll-margin-top (styles.css) so jumpToSection/jumpToFirstUnanswered
  // never lands a target underneath this bar, which is sticky wherever it scrolls to. A plain
  // measurement here (not a ResizeObserver) is enough: .mini-progress is this function's own
  // markup, entirely replaced on every call, so this already re-measures it exactly when its
  // content (and so its height) can actually change.
  document.documentElement.style.setProperty(
    "--mini-progress-h",
    (m.querySelector(".mini-progress")?.offsetHeight || 0) + "px",
  );
  const anchorEl =
    anchorBefore === undefined ? null : m.querySelector(anchorSel);
  // Puts the anchor back at the exact on-screen offset it had before the re-render. Reading
  // getBoundingClientRect() here forces layout, so the comparison is against fully settled
  // post-render geometry rather than a stale guess. Whatever the difference is — content above
  // changing height, a badge rewrapping, rows re-sorting — it gets subtracted straight out of
  // the scroll position, so the anchor cannot visually move. Returns nothing and does nothing
  // when there's no anchor; callers fall back to the raw sy/wy restore below.
  const pinAnchor = () => {
    if (!anchorEl) return false;
    const delta = anchorEl.getBoundingClientRect().top - anchorBefore;
    // Sub-pixel noise is not worth a scroll write (and writing it back can itself round the
    // other way, which is how a "correction" turns into a slow drift over many taps).
    if (Math.abs(delta) < 0.5) return true;
    // Apply to whichever scroller can actually absorb it: #mainContent owns the scroll on
    // desktop, the window does on mobile. Taking the container's real applied movement (rather
    // than assuming it took the whole delta) means hitting its top/bottom clamp just passes the
    // remainder on to the window instead of silently dropping it.
    const prev = m.scrollTop;
    m.scrollTop = prev + delta;
    const rest = delta - (m.scrollTop - prev);
    if (Math.abs(rest) >= 0.5) window.scrollBy(0, rest);
    return true;
  };
  // Restore synchronously so the browser never paints a frame at the wrong offset. (Both
  // branches force layout while JS is still running, so no jump is ever visible.)
  if (!pinAnchor()) {
    m.scrollTop = sy;
    if (wy) window.scrollTo(0, wy);
  }
  // Re-assert after layout settles (fonts/container-queries) — same target, so no visible motion.
  requestAnimationFrame(() => {
    if (!pinAnchor()) {
      m.scrollTop = sy;
      if (wy) window.scrollTo(0, wy);
    }
    refreshPointerHover();
  });
}

function qScored(ri, qi) {
  const n = gameState.teams.length;
  let done = 0;
  for (let ti = 0; ti < n; ti++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined) done++;
  }
  return { done, total: n };
}
function roundProgress(ri) {
  const n = gameState.teams.length;
  if (!n) return { done: 0, total: 0 };
  let done = 0,
    total = n * 4;
  for (let qi = 0; qi < 4; qi++)
    for (let ti = 0; ti < n; ti++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager !== undefined && a.correct !== undefined) done++;
    }
  if (BONUS_ROUNDS.has(ri)) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      if (gameState.rounds[ri].bonus[ti] != null) done++;
    }
  } else if (ri === 1) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      const h = gameState.halftime[ti];
      if (h && h.wager != null && h.wager !== "" && h.correct != null) done++;
    }
  } else if (ri === 3) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      const f = gameState.finalWager[ti];
      if (f && f.wager != null && f.wager !== "" && f.correct != null) done++;
    }
  }
  return { done, total };
}
// Which round the host is presumably actively working on: the first one that isn't fully
// scored yet. Based on scoring state, not scroll position — so it reads the same regardless
// of where in the page the host has scrolled to (e.g. up to check Teams, or ahead to Final
// Results), which is simpler and more useful than trying to detect "what's on screen".
function currentProgressSummary() {
  if (!gameState.teams.length) return null;
  for (let ri = 0; ri < 4; ri++) {
    const rp = roundProgress(ri);
    if (rp.done < rp.total) return { ri, done: rp.done, total: rp.total };
  }
  // Complete: carry the game-wide total rather than the 0/0 this used to return, so the
  // finished bar can show the same scored/total figure the per-round bar was showing a
  // moment earlier instead of jumping to a sentence.
  let all = 0;
  for (let ri = 0; ri < 4; ri++) all += roundProgress(ri).total;
  return { ri: null, done: all, total: all };
}
// Shared by jumpToSection/jumpToFirstUnanswered below: scrolls to whatever matches selector.
// It used to also ring the target with a .jump-pulse cyan box-shadow that beat twice over 4.4s.
// That is gone at the host's request, along with its CSS: the smooth scroll itself already
// shows where the jump landed — you watch it arrive — so the ring was restating something the
// motion had just said, and it kept going for seconds after the host had started reading the
// row it pointed at. requestAnimationFrame stays: the callers re-render first, so the element
// this looks up does not exist until after that render.
function scrollToJumpTarget(selector) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
function jumpToSection(id) {
  collapsedSections.delete(id);
  renderAll();
  scrollToJumpTarget("#" + id);
}
// Tapping the mini-progress bar used to just jump to the current round's section header,
// leaving the host to scroll and expand their way to whatever's actually unscored inside it.
// This finds the first unanswered item within that round instead — in the same order it's
// rendered (Q1-4, then Halftime/Final Wager on round 2/4, then the Bonus Question on round 1/3)
// — and expands both the round section AND that item's own block if either is collapsed, same
// as jumpToSection does for a single section. Lands on the TOP of that item's own block (its
// "X left" badge included) rather than a specific team's row inside it — .question-block/
// .special-section's own scroll-margin-top (styles.css) keeps that badge clear of the sticky
// header instead of landing right underneath it.
function jumpToFirstUnanswered() {
  const s = currentProgressSummary();
  if (!s || s.ri == null) return jumpToSection("sec-final");
  const ri = s.ri,
    n = gameState.teams.length;
  let targetSel = null;
  for (let qi = 0; qi < 4 && !targetSel; qi++) {
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager !== undefined && a.correct !== undefined) done++;
    }
    if (done < n) {
      targetSel = "#qblock-" + ri + "-" + qi;
      collapsedQuestions.delete(ri + "-" + qi);
    }
  }
  if (!targetSel && (ri === 1 || ri === 3)) {
    const type = ri === 1 ? "halftime" : "final";
    const store = ri === 1 ? gameState.halftime : gameState.finalWager;
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      const d = store[ti];
      if (d && d.wager != null && d.wager !== "" && d.correct != null) done++;
    }
    if (done < n) {
      targetSel = "#swblock-" + type;
      collapsedSpecialWagers.delete(type);
    }
  }
  if (!targetSel && BONUS_ROUNDS.has(ri)) {
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      if (gameState.rounds[ri].bonus[ti] != null) done++;
    }
    if (done < n) {
      targetSel = "#bqblock-" + ri;
      collapsedBonusQuestions.delete("b" + ri);
    }
  }
  const sectionId = "sec-r" + (ri + 1);
  collapsedSections.delete(sectionId);
  renderAll();
  scrollToJumpTarget(targetSel || "#" + sectionId);
}
// visible: false renders the exact same markup the real, scored-at-least-once state uses (never
// a guessed/simplified placeholder) but with the .mp-pending class, which visibility:hidden's
// the whole thing while still letting it claim its real layout height — see the call site in
// renderLeft() for why. visibility:hidden also drops it out of tab order/the accessibility tree
// on its own, so no extra aria-hidden/tabindex handling is needed for the pending state.
function renderMiniProgress(visible) {
  const s = currentProgressSummary();
  if (!s) return "";
  const pendingCls = visible ? "" : " mp-pending";
  if (s.ri == null) {
    return `<div class="mini-progress mp-complete${pendingCls}" role="button" tabindex="0" onclick="jumpToSection('sec-final')">
      <span class="mp-label">${ICON_DONE} ${s.done}/${s.total} 100% - Jump to Final Results</span>
    </div>`;
  }
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return `<div class="mini-progress${pendingCls}" role="button" tabindex="0" onclick="jumpToFirstUnanswered()">
    <span class="mp-round ${ROUND_COLORS[s.ri]}">Round ${s.ri + 1}</span>
    <span class="mp-count">${s.done}/${s.total} scored</span>
    <div class="mp-bar"><div class="mp-fill" style="width:${pct}%"></div></div>
    <span class="mp-pct">${pct}%</span>
  </div>`;
}

function qVerdict(ri, qi) {
  if (isBeerRound(ri, qi)) return "beer";
  const n = gameState.teams.length;
  let ans = 0,
    wrong = 0;
  for (let ti = 0; ti < n; ti++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.correct !== undefined) {
      ans++;
      if (a.correct === false) wrong++;
    }
  }
  if (ans === 0) return "next";
  if (wrong === ans) return "everyonewrong";
  if (wrong >= Math.ceil(ans / 2)) return "manywrong";
  return "next";
}
// Correct/incorrect breakdown for a single question, out of teams graded so far
// (not the full roster) so it reads accurately mid-grading instead of front-loading
// ungraded teams into the "incorrect" bucket. incorrectPct is 100-correctPct (not its
// own rounded value) so the two percentages always sum to exactly 100.
function scoreBreakdown(dataObj, n) {
  let correct = 0,
    incorrect = 0;
  for (let ti = 0; ti < n; ti++) {
    const a = dataObj[ti];
    if (a && a.correct != null) {
      if (a.correct) correct++;
      else incorrect++;
    }
  }
  const done = correct + incorrect;
  const correctPct = done ? Math.round((correct / done) * 100) : 0;
  const incorrectPct = done ? 100 - correctPct : 0;
  return { correct, incorrect, done, correctPct, incorrectPct };
}
function renderQStatsRow(s) {
  if (!s.done) return "";
  return `<span class="q-stats-row">
    <span class="q-stat q-stat-correct">${CHECK_ICON_SVG} ${s.correct}/${s.done} (${s.correctPct}%)</span>
    <span class="q-stat q-stat-incorrect">${ICON_INCORRECT} ${s.incorrect}/${s.done} (${s.incorrectPct}%)</span>
  </span>`;
}
function renderWQ(ri, qi) {
  const wagers = ROUND_WAGERS[ri];
  const qs = qScored(ri, qi);
  const beer = isBeerRound(ri, qi);
  const qKey = ri + "-" + qi;
  const isCollapsed = collapsedQuestions.has(qKey);
  // Crowd-Wisdom Percentage (Advanced Settings): shows/hides the live
  // correct/incorrect percentage next to Sort/Reset below — see renderQStatsRow.
  const qResultToggle = !!loadPrefs().qResultToggle;

  // Block-level state class
  let blockCls = "question-block";
  if (beer) blockCls += " beer-round";
  else if (qs.total > 0 && qs.done === qs.total) blockCls += " q-done";
  else if (qs.done > 0) blockCls += " q-active";
  if (isCollapsed) blockCls += " q-collapsed";

  const badgeCls = beer
    ? "q-badge q-beer"
    : qs.done === qs.total
      ? "q-badge q-complete"
      : "q-badge q-remaining";
  const badgeText =
    qs.total === 0
      ? ""
      : beer
        ? `${ICON_BEER} Beer Round!`
        : qs.done === qs.total
          ? `${ICON_DONE} Done`
          : qs.total - qs.done + " left";

  let h = `<div class="${blockCls}" id="qblock-${ri}-${qi}">`;

  // Collapsible header
  h += `<div class="q-header">
    <div class="q-header-left" role="button" tabindex="0" onclick="toggleQuestion(${ri},${qi})">
      <span class="q-chevron">▼</span>
      <div class="question-title">
        <span>Q${qi + 1}</span>
        ${qs.total ? `<span class="${badgeCls}">${badgeText}</span>` : ""}
      </div>
    </div>
    <div class="q-header-right">
      ${qResultToggle ? renderQStatsRow(scoreBreakdown(gameState.rounds[ri].questions[qi], gameState.teams.length)) : ""}
      <button class="q-sort-btn${questionSortOrder[qKey] ? " active" : ""}" onclick="sortQuestion(${ri},${qi})" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button>
      <button class="q-reset-btn" onclick="resetQuestionSort(${ri},${qi})" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button>
    </div>
  </div>`;

  // Body (collapsible)
  h += `<div class="q-body">`;
  const entryOrder = gameState.teams.map((_, i) => i);
  let teamOrder = questionSortOrder[qKey]
    ? questionSortOrder[qKey].filter((ti) => ti < gameState.teams.length)
    : entryOrder;
  if (questionSortOrder[qKey]) {
    // include any teams added after the sort was taken (e.g. new team) at the end
    entryOrder.forEach((ti) => {
      if (!teamOrder.includes(ti)) teamOrder.push(ti);
    });
  }
  teamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const ans = gameState.rounds[ri].questions[qi][ti] || {};
    const uw = usedW(ti, ri);
    const sel = ans.wager;
    const hasW = sel !== undefined,
      hasR = ans.correct !== undefined;
    const isFlash =
      lastAction &&
      lastAction.ri === ri &&
      lastAction.qi === qi &&
      lastAction.ti === ti;
    const isBeerFlash =
      lastAction &&
      lastAction.ri === ri &&
      lastAction.qi === qi &&
      lastAction.beerRound &&
      !isFlash;
    let ptsHtml;
    if (hasW && hasR) {
      const p = ans.correct ? ans.wager : 0;
      ptsHtml =
        p > 0
          ? `<span class="ta-pts pts-pos">+${p}</span>`
          : `<span class="ta-pts pts-nil">0</span>`;
    } else ptsHtml = `<span class="ta-pts pts-zero">\u2014</span>`;

    let rowCls = "team-answer";
    if (isBeerFlash) rowCls += " beer-flash";
    else if (isFlash) rowCls += " flash";

    h += `<div class="${rowCls}" data-ta="${ri}-${qi}-${ti}"><span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} — tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span><div class="ta-wagers">`;
    wagers.forEach((w) => {
      const isSel = sel === w,
        isUsed = !isSel && uw.some((u) => u.wager === w && u.qi !== qi);
      let cls = "wager-btn",
        badge = "";
      if (isSel && ans.correct === true) {
        cls += " correct";
        badge = `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>`;
      } else if (isSel && ans.correct === false) {
        cls += " incorrect";
        badge = `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>`;
      } else if (isUsed) cls += " used";
      h += `<button class="${cls}" onclick="cycleW(${ri},${qi},${ti},${w})" ${isUsed ? "disabled" : ""}>${w}${badge}</button>`;
    });
    h += `</div>${ptsHtml}</div>`;
  });
  // Banter lives inside .q-body (not after it) so collapsing the question via CSS
  // (.q-collapsed .q-body{display:none}) hides the banter along with the rest of
  // the body instead of leaving it visible as an orphaned sibling.
  const v = qVerdict(ri, qi);
  h += renderBanter(v, `q-${ri}-${qi}-${v}`, { sm: true });
  h += `</div>`;
  h += `</div>`;
  return h;
}

function toggleQuestion(ri, qi) {
  const key = ri + "-" + qi;
  if (collapsedQuestions.has(key)) collapsedQuestions.delete(key);
  else collapsedQuestions.add(key);
  const el = document.getElementById("qblock-" + ri + "-" + qi);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("q-collapsed");
  });
}
function sortQuestion(ri, qi) {
  const key = ri + "-" + qi;
  const answered = (ti) => {
    const a = gameState.rounds[ri].questions[qi][ti];
    return !!(a && a.wager !== undefined && a.correct !== undefined);
  };
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetQuestionSort(ri, qi) {
  delete questionSortOrder[ri + "-" + qi];
  renderAll();
}
function sortBonusQuestion(ri) {
  const key = "b" + ri;
  const answered = (ti) => gameState.rounds[ri].bonus[ti] != null;
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetBonusQuestionSort(ri) {
  delete questionSortOrder["b" + ri];
  renderAll();
}
function sortSpecialWager(type) {
  const key = "sw-" + type;
  const data = type === "final" ? gameState.finalWager : gameState.halftime;
  const answered = (ti) => {
    const d = data[ti];
    return !!(d && d.wager != null && d.wager !== "" && d.correct != null);
  };
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetSpecialWagerSort(type) {
  delete questionSortOrder["sw-" + type];
  renderAll();
}
function toggleBonusQ(ri) {
  const key = "b" + ri;
  if (collapsedBonusQuestions.has(key)) collapsedBonusQuestions.delete(key);
  else collapsedBonusQuestions.add(key);
  const el = document.getElementById("bqblock-" + ri);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("bq-collapsed");
  });
}

function renderBQ(ri) {
  const n = gameState.teams.length;
  let subDone = 0;
  for (let ti = 0; ti < n; ti++) {
    if (gameState.rounds[ri].bonus[ti] != null) subDone++;
  }
  const beer = isBonusBeerRound(ri);
  let badge = "";
  if (n) {
    if (beer)
      badge =
        `<span class="q-badge q-badge-lg q-beer">${ICON_BEER} Beer Round!</span>`;
    else if (subDone === n)
      badge = `<span class="q-badge q-badge-lg q-complete">${ICON_DONE} Done</span>`;
    else
      badge = `<span class="q-badge q-badge-lg q-remaining">${n - subDone} left</span>`;
  }
  const isCollapsedBQ = collapsedBonusQuestions.has("b" + ri);
  let blockCls = "question-block";
  if (beer) blockCls += " beer-round";
  else if (n > 0 && subDone === n) blockCls += " q-done";
  else if (subDone > 0) blockCls += " q-active";
  if (isCollapsedBQ) blockCls += " bq-collapsed";
  const bqStyle = BONUS_Q_STYLE[ri] || { cls: "" };
  const bqKey = "b" + ri;
  let h = `<div class="${blockCls}" id="bqblock-${ri}"><div class="q-header"><div class="q-header-left" role="button" tabindex="0" onclick="toggleBonusQ(${ri})"><span class="q-chevron">\u25BC</span><div class="question-title bonus-title"><div class="bonus-title-top"><span class="${bqStyle.cls}">Q5</span>${badge}</div><span class="${bqStyle.cls} bonus-title-sub">BONUS (0-4 \u00D7 5)</span></div></div><div class="q-header-right"><button class="q-sort-btn${questionSortOrder[bqKey] ? " active" : ""}" onclick="sortBonusQuestion(${ri})" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button><button class="q-reset-btn" onclick="resetBonusQuestionSort(${ri})" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button></div></div><div class="q-body">`;
  const bqEntryOrder = gameState.teams.map((_, i) => i);
  let bqTeamOrder = questionSortOrder[bqKey]
    ? questionSortOrder[bqKey].filter((ti) => ti < gameState.teams.length)
    : bqEntryOrder;
  if (questionSortOrder[bqKey]) {
    bqEntryOrder.forEach((ti) => {
      if (!bqTeamOrder.includes(ti)) bqTeamOrder.push(ti);
    });
  }
  bqTeamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const v = gameState.rounds[ri].bonus[ti];
    const submitted = v != null;
    const c = submitted ? v : 0;
    let ptsHtml;
    if (!submitted) ptsHtml = `<span class="bonus-pts pts-zero">\u2014</span>`;
    else if (c > 0)
      ptsHtml = `<span class="bonus-pts pts-pos">+${c * 5}</span>`;
    // No tick before the 0. A checkmark reads as "correct" everywhere else in this app, and a
    // team that got none of the four bonus questions right is the opposite of that — the mark
    // was only ever there to say "submitted, not skipped", which .submitted-zero's own styling
    // (and the row's .is-submitted state) already carry.
    else ptsHtml = `<span class="bonus-pts submitted-zero">0</span>`;
    const choices = [0, 1, 2, 3, 4]
      .map((k) => {
        const isSel = submitted && c === k;
        let cls = "bonus-choice-btn",
          cbadge = "";
        if (isSel && k === 0) {
          cls += " incorrect";
          cbadge = `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>`;
        } else if (isSel && k > 0) {
          cls += " correct";
          cbadge = `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>`;
        }
        return `<button class="${cls}" onclick="setB(${ri},${ti},${k})" title="${k} correct \u2014 +${k * 5} pts \u2014 tap again to unselect">${k}${cbadge}</button>`;
      })
      .join("");
    h += `<div class="bonus-row${submitted ? " is-submitted" : ""}"><span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} \u2014 tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span>
      <div class="bonus-right"><div class="bonus-choice">${choices}</div>
      ${ptsHtml}</div></div>`;
  });
  // Only a Beer Round gets banter here — "next question" doesn't fit since a bonus question
  // is immediately followed by a new round, not another question.
  if (beer) h += renderBanter("beer", `bq-${ri}-beer`, { sm: true });
  return h + `</div></div>`;
}

// Halftime and final wagers are identical except for range, labels and setters.
function renderSpecialWager(type) {
  const isFinal = type === "final";
  const data = isFinal ? gameState.finalWager : gameState.halftime;
  const max = isFinal ? 20 : 10;
  const sectionCls = isFinal
    ? "special-section final-wager"
    : "special-section";
  const titleSub = isFinal ? "BONUS WAGER (1-20)" : "BONUS WAGER (1-10)";
  const wSet = isFinal ? "setFW" : "setHW",
    cSet = isFinal ? "setFC" : "setHC";
  const beer = isSpecialBeerRound(type);
  const swN = gameState.teams.length;
  let swDone = 0;
  for (let ti = 0; ti < swN; ti++) {
    const d = data[ti];
    if (d && d.wager != null && d.wager !== "" && d.correct != null) swDone++;
  }
  let swBadge = "";
  if (swN) {
    if (beer)
      swBadge = `<span class="q-badge q-beer">${ICON_BEER} Beer Round!</span>`;
    else if (swDone === swN)
      swBadge = `<span class="q-badge q-complete">${ICON_DONE} Done</span>`;
    else
      swBadge = `<span class="q-badge q-remaining">${swN - swDone} left</span>`;
  }
  const swCollapsed = collapsedSpecialWagers.has(type);
  const swKey = "sw-" + type;
  // Same "Crowd-Wisdom Percentage" gate the regular Q1-4 rows use (see
  // renderQStatsRow's other call site) — this row was showing the correct/incorrect tally unconditionally,
  // ignoring the toggle entirely, so turning the setting Off didn't hide it here like it does
  // everywhere else.
  const swResultToggle = !!loadPrefs().qResultToggle;
  let h = `<div class="${sectionCls}${beer ? " beer-round" : ""}${swCollapsed ? " sw-collapsed" : ""}" id="swblock-${type}"><div class="sw-header"><div class="sw-header-left" role="button" tabindex="0" onclick="toggleSpecialWager('${type}')"><span class="q-chevron">\u25BC</span><h3 class="sw-title"><span class="sw-title-row">Q5${swBadge}</span><span class="sw-title-sub">${titleSub}</span></h3></div><div class="q-header-right">${swResultToggle ? renderQStatsRow(scoreBreakdown(data, swN)) : ""}<button class="q-sort-btn${questionSortOrder[swKey] ? " active" : ""}" onclick="sortSpecialWager('${type}')" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button><button class="q-reset-btn" onclick="resetSpecialWagerSort('${type}')" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button></div></div>`;
  // No "Beer Round! Everyone got it right!" stripe under the header. The header's own Beer Round
  // badge is two inches away and says the same thing, and the whole block is already washed gold
  // with a gold border — three statements of one fact. Same call, same reasoning, as removing the
  // bonus questions' version of this line in v18.57.
  h += `<div class="sw-body">`;
  const swEntryOrder = gameState.teams.map((_, i) => i);
  let swTeamOrder = questionSortOrder[swKey]
    ? questionSortOrder[swKey].filter((ti) => ti < gameState.teams.length)
    : swEntryOrder;
  if (questionSortOrder[swKey]) {
    swEntryOrder.forEach((ti) => {
      if (!swTeamOrder.includes(ti)) swTeamOrder.push(ti);
    });
  }
  swTeamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const d = data[ti] || {};
    const w = d.wager != null && d.wager !== "" ? +d.wager : null;
    let pts = `<span class="ta-pts pts-zero">\u2014</span>`;
    if (w != null && d.correct != null) {
      const p = d.correct ? w : -w;
      pts = `<span class="ta-pts ${p > 0 ? "pts-pos" : p < 0 ? "pts-neg" : "pts-nil"}">${p > 0 ? "+" : ""}${p}</span>`;
    }
    let selOpts = `<option value=""${w == null ? " selected" : ""}>\u2014</option>`;
    for (let n = 1; n <= max; n++) {
      selOpts += `<option value="${n}"${w === n ? " selected" : ""}>${n}</option>`;
    }
    const selectHtml = `<select class="sw-select" aria-label="Wager amount (1\u2013${max})" onchange="${wSet}(${ti},this.value)">${selOpts}</select>`;
    h += `<div class="special-wager-row" data-ta="${type}-${ti}">
      <span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} \u2014 tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span>
      ${selectHtml}
      <div class="ta-result">
        <button class="result-btn ${d.correct === true ? "correct-sel" : ""}" onclick="${cSet}(${ti},true)" aria-label="Mark correct">${ICON_MARK_CORRECT}${d.correct === true ? `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>` : ""}</button>
        <button class="result-btn ${d.correct === false ? "incorrect-sel" : ""}" onclick="${cSet}(${ti},false)" aria-label="Mark incorrect">${ICON_MARK_INCORRECT}${d.correct === false ? `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>` : ""}</button>
      </div>
      ${pts}
    </div>`;
  });
  // Only a Beer Round gets banter here — "next question" doesn't fit since this wager is
  // immediately followed by a new round (or Final Results), not another question.
  if (beer) h += renderBanter("beer", `sw-${type}-beer`, { sm: true });
  return h + `</div></div>`;
}
function toggleSpecialWager(type) {
  if (collapsedSpecialWagers.has(type)) collapsedSpecialWagers.delete(type);
  else collapsedSpecialWagers.add(type);
  const el = document.getElementById("swblock-" + type);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("sw-collapsed");
  });
}
function renderHT() {
  return renderSpecialWager("halftime");
}
function renderFW() {
  return renderSpecialWager("final");
}

function toggleSidebar() {
  // A just-finished swipe on the peek strip or the sheet's grab handle (see the drag IIFE near
  // the bottom of this file) fires a click on release — swallow that one so the drag doesn't
  // also re-toggle right back.
  if (suppressNextSheetClick) {
    suppressNextSheetClick = false;
    return;
  }
  const sb = document.getElementById("sidebar");
  const open = sb.classList.toggle("open");
  document.getElementById("sidebarBackdrop")?.classList.toggle("show", open);
  const peek = document.getElementById("mobileScoresPeek");
  if (peek) {
    peek.setAttribute("aria-expanded", String(open));
    peek.setAttribute("aria-label", open ? "Close scores" : "Open scores");
    peek.classList.toggle("msp-hidden", open);
  }
}

function renderSB() {
  const body = document.getElementById("sidebarBody");
  if (!body) return;
  const sy = body.scrollTop;
  body.innerHTML = `<div class="sort-controls">
    <button class="sort-btn ${scoreSortMode === "entry" ? "active" : ""}" onclick="setSortMode('entry')">Entry</button>
    <button class="sort-btn ${scoreSortMode === "random" ? "active" : ""}" onclick="setSortMode('random')" title="Shuffle" aria-label="Shuffle">${ICON_SHUFFLE}<span class="sr-only">Shuffle</span></button>
    <button class="sort-btn ${scoreSortMode === "asc" ? "active" : ""}" onclick="setSortMode('asc')">${ICON_ARROW_UP} Asc</button>
    <button class="sort-btn ${scoreSortMode === "desc" ? "active" : ""}" onclick="setSortMode('desc')">${ICON_ARROW_DOWN} Desc</button>
  </div><div class="sort-mode-label">${sortModeLabel()}</div>${buildScores()}`;
  body.scrollTop = sy;
  requestAnimationFrame(() => {
    body.scrollTop = sy;
    refreshPointerHover();
  });
}

function buildScores() {
  if (!gameState.teams.length)
    return '<div class="scores-list" style="color:var(--text-muted);padding:12px;">Add teams to begin.</div>';
  const rm = rankMap();
  const order = getDisplayOrder();
  let h = '<div class="scores-list">';
  order.forEach((ti) => {
    const t = gameState.teams[ti],
      tot = grandTotal(ti),
      rank = rm[ti],
      rc = rank <= 3 ? "sr-rank-" + rank : "";
    const r1 = roundSub(ti, 0),
      r2 = roundSub(ti, 1),
      r3 = roundSub(ti, 2),
      r4 = roundSub(ti, 3);
    const ht = htPts(ti),
      fw = fwPts(ti),
      bi = t.bonusItem ? 5 : 0,
      nj = t.njcb ? 3 : 0,
      adj = t.adjustment || 0;
    const tip = [
      "R1:" + r1,
      "HT:" + (ht >= 0 ? "+" : "") + ht,
      "R2:" + r2,
      "R3:" + r3,
      "FW:" + (fw >= 0 ? "+" : "") + fw,
      "R4:" + r4,
    ];
    if (bi) tip.push("Item:+5");
    if (nj) tip.push("NJCB:+3");
    if (adj) tip.push("Adj:" + (adj > 0 ? "+" : "") + adj);
    const cb = t.craftPrize ? " cb-prize" : "";
    const cbTag = t.craftPrize
      ? ` <span class="cb-tag">${ICON_BEER} CB Prize</span>`
      : "";
    h += `<div class="score-row${cb}${rc ? " " + rc : ""}" title="${tip.join(" | ")}"><span class="sr-rank ${rc}">${rank}</span><span class="sr-name sr-name-clickable" role="button" tabindex="0" title="Tap to set or clear the Craft Beer prize winner" onclick="toggleCraftPrize(${ti})">${esc(t.name || "Team " + (ti + 1))}${cbTag}</span><span class="sr-score">${tot}</span></div>`;
  });
  return h + "</div>";
}

function toggleCraftPrize(ti) {
  if (!gameState.teams[ti]) return;
  const was = gameState.teams[ti].craftPrize;
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.teams[ti].craftPrize = !was;
  gameState.craftPrizeWinner = gameState.teams[ti].craftPrize
    ? { ti, script: craftPrizeScript(ti) }
    : null;
  autosave();
  renderAll();
}

// CRAFT PRIZE RANDOMIZER — drumroll + name-flash + spoken winner script. Only ever one winner.
//
// AUDIO POLICY — the app must never take the device's audio session until the host asks for it.
// The host runs this on the same iPad they play background music from, and iOS hands the audio
// session to whichever app most recently claimed it: the moment this tab claims one, their music
// ducks or stops every time the tab takes focus. Claiming happens far earlier than most code
// assumes — merely constructing an AudioContext is enough on iOS, even suspended, and so is a
// silent priming .play(). The previous implementation did exactly that: it built an AudioContext
// and decoded ~1.1MB of drum audio into it at page load as a warm-up, so simply opening the
// scorekeeper stole audio priority from the music app.
//
// So the rules here are:
//   * No Web Audio API at all — no AudioContext, no decodeAudioData, no gain nodes.
//   * Plain <audio> elements only, all of them constructed lazily inside the tap on the drumroll
//     button — never before it — and reused for every draw thereafter.
//   * The first .play() of a draw runs synchronously inside that tap's own click handler, with
//     nothing awaited before it, so iOS counts it as a direct user gesture. The spare elements
//     holding the fade and finale are unlocked in that same handler (see cueDrumClip), which is
//     what lets them start later from a timer.
//   * Nothing anywhere else in the app plays audio. Grep for playDrumClip and handOverToCue:
//     these functions are the only callers, and they are only ever reached from a craft-prize
//     button.
//
// An element can only play one thing at a time and cannot loop or cross a clip boundary
// gaplessly, so nothing is sequenced, looped, or layered at playback time — every transition the
// host hears is pre-rendered into a clip. assets/audio/roll.mp3 is a single 32.6s take long
// enough that a draw never reaches its end; from there a roll hands off exactly once, on an
// explicit cue, into a clip that already contains the transition: finale.wav (horn over the
// roll fading out) at
// the reveal, or the fade tail (roll fading out alone, built by fadeClipUrl at whatever length
// the Settings slider is set to) if the host stops early. Both open at the roll's own level and
// are handed over between elements rather than swapped on one, so neither transition has a level
// step or a gap in it.

// silent/roll/finale/horn ship as real files under assets/audio/ (see the top-of-file note on
// why) — drumClipUrl() below points an <audio> element straight at one, no decode step and no
// audio-session cost either way. The fade clip is the one exception still built from base64: its
// length depends on a Settings slider, so it can't be a finished file — see fadeClipUrl below.
const DRUM_CLIPS = {
  silent: "assets/audio/silent.wav",
  roll: "assets/audio/roll.mp3",
  finale: "assets/audio/finale.wav",
  horn: "assets/audio/horn.mp3",
};
// Format of DRUM_FADESRC_B64, and therefore of the fade clips built from it. These have to match
// the roll the fade splices out of, or the handover would step in level or collapse to mono.
const FADE_SR = 48000;
const FADE_CH = 2;
// Where in the loop the fade starts. This point measures the same RMS as the loop overall, so the
// fade opens at the level the roll was already playing at and the handover has no step in it —
// the loop's own start is 2.8dB quieter and audibly dropped. Wraps, since the source is a loop.
const FADE_SRC_OFFSET = Math.round(2.2 * FADE_SR);
const FADE_RAMP_SEC = 0.008; // ramp-in covering the sub-ms overlap at the handover
let drumAudio = null; // plays the roll, and the horn on its own
let drumCues = {}; // clip name -> spare element holding that clip pre-loaded and ready to start
let fadeSrcPcm = null; // Int16Array of DRUM_FADESRC_B64, decoded once
let fadeClip = { sec: null, url: null }; // the one built fade clip, rebuilt when the slider moves

function b64Bytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function drumClipUrl(name) {
  // The fade is synthesised rather than shipped, since its length is a Settings slider.
  if (name === "fade") return fadeClipUrl(craftFadeSec());
  // The other four are real files (DRUM_CLIPS above) — no decode, no cache dict needed, the
  // browser's own HTTP/disk cache (and the service worker precache) already does that job.
  return DRUM_CLIPS[name];
}
// Renders the fade-out to a WAV blob at the requested length: read the roll loop from the
// level-matched offset, multiply by a raised-cosine envelope (unity with zero slope at the start,
// true zero at the end, so neither the splice nor the tail can click), and wrap the header on.
// Pure arithmetic over a typed array — no AudioContext, so this costs nothing on the audio session.
function fadeClipUrl(sec) {
  if (fadeClip.sec === sec && fadeClip.url) return fadeClip.url;
  if (!fadeSrcPcm) {
    const bytes = b64Bytes(DRUM_FADESRC_B64);
    fadeSrcPcm = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / 2,
    );
  }
  const srcFrames = fadeSrcPcm.length / FADE_CH;
  const frames = Math.max(1, Math.round(sec * FADE_SR));
  const ramp = Math.round(FADE_RAMP_SEC * FADE_SR);
  const dataLen = frames * FADE_CH * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const tag = (o, s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  dv.setUint32(4, 36 + dataLen, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, FADE_CH, true);
  dv.setUint32(24, FADE_SR, true);
  dv.setUint32(28, FADE_SR * FADE_CH * 2, true);
  dv.setUint16(32, FADE_CH * 2, true);
  dv.setUint16(34, 16, true);
  tag(36, "data");
  dv.setUint32(40, dataLen, true);
  const out = new Int16Array(buf, 44, frames * FADE_CH);
  for (let i = 0; i < frames; i++) {
    let g = 0.5 * (1 + Math.cos((Math.PI * i) / frames));
    if (i < ramp) g *= 0.5 * (1 - Math.cos((Math.PI * i) / ramp));
    const si = ((FADE_SRC_OFFSET + i) % srcFrames) * FADE_CH;
    const di = i * FADE_CH;
    for (let c = 0; c < FADE_CH; c++) out[di + c] = fadeSrcPcm[si + c] * g;
  }
  // Only ever one fade clip alive — drop the previous length rather than leaking a blob per
  // notch of the slider.
  if (fadeClip.url) URL.revokeObjectURL(fadeClip.url);
  fadeClip = {
    sec,
    url: URL.createObjectURL(new Blob([buf], { type: "audio/wav" })),
  };
  return fadeClip.url;
}
// Declares this page's audio as "ambient" — it mixes with whatever else the device is playing
// rather than taking the audio session for itself. Without this, iOS gives any page that plays
// audio an exclusive "playback" session, and the host's music app is paused the instant the
// drumroll starts. That is the same failure the AUDIO POLICY above is written against, reached by
// a different route: the policy stops the app claiming a session before it is asked to, and this
// stops the session it does eventually take from being an exclusive one. The two are complements,
// not alternatives — neither one alone keeps the music playing.
//
// Set once, ahead of any playback, and never per-play: the type is a property of the page, not of
// a clip. Assigning it is a declaration of intent rather than a claim on the session — no element
// is constructed and nothing is decoded — so unlike a priming .play() it is safe to do at load,
// which is also the only place it can be done early enough to cover the first roll.
//
// Feature-detected, since the Audio Session API is recent WebKit only; everywhere else this is a
// no-op and playback is unaffected. If iOS still interrupts the music with the type set to
// ambient, that is the platform's call to make and not something the page can override.
let ambientSessionRequested = false;
function useAmbientAudioSession() {
  if (ambientSessionRequested) return;
  ambientSessionRequested = true;
  try {
    if ("audioSession" in navigator) navigator.audioSession.type = "ambient";
  } catch (e) {
    // A partial implementation can reject the assignment. Nothing to fall back to, and nothing
    // worth blocking playback over — the drumroll still runs, it just may duck other audio.
  }
}
// Builds the single reusable element the first time a clip is actually played. preload="none"
// and the absence of a src keep it completely inert — no fetch, no decode, no audio session —
// right up until playDrumClip points it at a clip.
function getDrumAudio() {
  if (!drumAudio) {
    drumAudio = new Audio();
    drumAudio.preload = "none";
  }
  return drumAudio;
}
// Points the one element at a clip and starts it. Deliberately synchronous end to end: the first
// call of any draw runs inside a click handler, and an await/.then() before .play() would spend
// the user-gesture credit iOS grants that handler and leave the drumroll silent.
function playDrumClip(name) {
  const a = getDrumAudio();
  const url = drumClipUrl(name);
  if (a.src !== url) a.src = url;
  // A just-assigned src already starts at zero; this matters when the same clip is replayed
  // (tapping Play Horn twice), which would otherwise resume from where the last play ended.
  try {
    a.currentTime = 0;
  } catch (e) {}
  const p = a.play();
  if (p && p.catch)
    p.catch((err) => {
      // AbortError just means something legitimately superseded this play — a handover pausing
      // the roll, or a new draw reassigning src — so it is expected traffic, not a failure.
      if (err && err.name === "AbortError") return;
      console.error("Craft prize audio failed to play:", name, err);
    });
  return a;
}
// Loads a clip into its own spare element so it can start the instant it is cued, and unlocks
// that element for iOS while we are still inside the drumroll tap.
//
// Reassigning .src on the element that is currently playing costs ~30ms of real silence (measured:
// emptied -> loadstart -> loadedmetadata -> canplay), and the roll lands a beat every ~47ms, so
// that swap punched a hole through most of a beat. Handing over between two elements instead
// removes the load entirely: the incoming clip is already decoded and sitting at position zero,
// so cueing it is just a play() on a warm element.
//
// The unlocking play() has to happen here, inside the gesture, because iOS grants that permission
// per element and would otherwise reject the cue when it fires later from a timer. It plays
// assets/audio/silent.wav rather than the real clip so nothing is audible, then swaps to the real clip,
// which keeps the permission the silent play just earned.
function cueDrumClip(name) {
  let el = drumCues[name];
  if (el) {
    try {
      el.currentTime = 0;
    } catch (e) {}
    return el;
  }
  el = drumCues[name] = new Audio();
  el.preload = "auto";
  el.src = drumClipUrl("silent");
  const arm = () => {
    el.src = drumClipUrl(name);
    el.load(); // buffer it now, while the roll still has seconds left to run
    // Then play it once, muted, and rewind. Buffering alone is not enough: an element's first
    // play after a src swap blocks for ~10ms inside play() itself, and that time would be spent
    // with the roll still running over the top of the incoming clip. Playing it through once
    // muted takes that cost now, seconds before the host can possibly need it, and leaves the
    // element able to start in a fraction of a millisecond when it is actually cued. It is
    // inaudible, and it is not a preload of playback in the sense the AUDIO POLICY forbids —
    // it happens only after the host has already tapped the drumroll and started the audio.
    el.muted = true;
    const cool = () => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch (e) {}
      el.muted = false;
    };
    const w = el.play();
    if (w && w.then) w.then(cool, cool);
    else cool();
  };
  const p = el.play();
  if (p && p.then)
    p.then(() => {
      el.pause();
      arm();
    }, arm);
  else arm();
  return el;
}
// Hands playback over from the roll to an already-cued clip. The roll is left running until the
// incoming clip reports that it is actually producing sound ("playing"), so the two overlap by a
// fraction of a millisecond rather than leaving a gap between them — and the cued clips open with
// an 8ms ramp-in, so that overlap sums to roughly constant level instead of a bump. Together with
// the clips starting at the roll's own level, the handover is heard as the roll simply beginning
// to die away. Falls back to the same-element swap if the cue was never unlocked.
//
// `after` runs once the handover has completed, and exists to keep the caller's re-render off the
// main thread until then. "playing" is delivered as a task, so ANY synchronous work queued ahead
// of it — including a setTimeout(…, 0) — runs first and holds the event off for as long as it
// takes. A full renderLeft() there cost 11-19ms, all of it spent with the roll still playing over
// the incoming clip. Handing the render back through this callback makes the ordering explicit
// instead of racing it.
function handOverToCue(name, after) {
  let pending = after;
  // Always hand the caller's re-render to a later task. Running it inline would put ~10ms of
  // layout work inside the "playing" handler, i.e. in the middle of the handover itself, which
  // is exactly the window where the roll and the incoming clip are both audible.
  const finish = () => {
    if (!pending) return;
    const fn = pending;
    pending = null;
    setTimeout(fn, 0);
  };
  const el = drumCues[name];
  if (!el || el.src === drumClipUrl("silent")) {
    playDrumClip(name);
    finish();
    return;
  }
  const stopRoll = () => {
    if (drumAudio) {
      try {
        drumAudio.pause();
      } catch (e) {}
    }
    finish();
  };
  el.addEventListener("playing", stopRoll, { once: true });
  // Insurance against being cued while the warm-up play in cueDrumClip is still in flight, which
  // would otherwise hand over to a muted element and drop the fade entirely.
  el.muted = false;
  // Only seek when it would actually move — a redundant seek on a paused element still puts it
  // through the seeking/seeked cycle before it will report itself as playing.
  if (el.currentTime) {
    try {
      el.currentTime = 0;
    } catch (e) {}
  }
  const p = el.play();
  if (p && p.catch)
    p.catch((err) => {
      el.removeEventListener("playing", stopRoll);
      // An AbortError means the cue was deliberately stopped (a new draw, or the winner being
      // cleared mid-fade); anything else means it was refused, so fall back to swapping on the
      // main element rather than leaving the host with a roll that never winds down.
      if (!(err && err.name === "AbortError")) playDrumClip(name);
      finish();
    });
  // Safety net: never strand the caller's UI update if "playing" somehow never arrives — but the
  // roll has to be stopped too, not just the UI unblocked. This used to call finish() directly,
  // which fired the winner reveal/re-render fine but skipped the drumAudio.pause() that only
  // stopRoll does, so a browser that's slow (or fails) to fire "playing" left the roll looping
  // forever under the reveal instead of handing over to the horn. Routing through stopRoll keeps
  // both halves together; it's safe to run twice; finish()'s own pending guard already no-ops the
  // second call if "playing" does eventually arrive after this fires.
  setTimeout(stopRoll, 400);
}
// Starts the drumroll. Called straight from the draw button's click handler: the .play() below
// is the gesture-blessed call that unlocks the element for the roll itself, and the two cueDrumClip
// calls do the same for the clips it can hand off to. Nothing is sequenced or looped — the clip
// simply runs until the draw's finish timer cues the finale, which is what keeps the roll
// perfectly continuous however long the countdown is.
function startDrumrollAudio() {
  // Belt and braces — this normally ran at load, but the session type has to be in place before
  // the first play whatever the load order was, and once set the call is a no-op. A synchronous
  // property write spends no gesture credit, so it is safe ahead of the .play() below.
  useAmbientAudioSession();
  playDrumClip("roll");
  // Cue both clips a running roll can hand off to. This has to happen on this tap — it needs the
  // gesture — but it runs after playback is already under way so the roll never waits on it.
  cueDrumClip("finale");
  cueDrumClip("fade");
}
// The automatic reveal, fired by the draw's finish timer. Hands the roll over to the horn with the
// roll already fading out underneath it (see assets/audio/finale.wav), because one element cannot overlap
// two clips itself and cutting the roll dead at the horn sounded choppy.
function playDrumrollFinale(after) {
  handOverToCue("finale", after);
}
// The horn on its own, for the manual "Play Horn" button. That button is only ever reached once
// the roll has already been faded out by "Stop Drumroll", or after a winner is settled — there is
// no roll left to overlap or hand over from, so this just plays on the main element.
function playVictoryHornSound() {
  playDrumClip("horn");
}
function stopAllDrumAudio() {
  // Never construct anything just to stop it — this is called from startNewGame and from clearing
  // a winner, neither of which should bring an audio element into existence.
  if (drumAudio) {
    try {
      drumAudio.pause();
    } catch (e) {}
  }
  Object.keys(drumCues).forEach((k) => {
    try {
      drumCues[k].pause();
    } catch (e) {}
  });
}
// Winds the roll down instead of cutting it off mid-beat — used by the manual "Stop Drumroll"
// control, over whatever length the Settings crossfade slider is set to. Hands over to the fade
// tail rather than ramping the element's volume, because iOS ignores volume writes entirely and a
// scripted gain fade does nothing at all on an iPad.
function fadeOutDrumAudio(after) {
  if (!drumAudio || drumAudio.paused) {
    stopAllDrumAudio();
    if (after) after();
    return;
  }
  handOverToCue("fade", after);
}
function clearCraftDrawTimers() {
  craftDrawTimeouts.forEach((id) => clearTimeout(id));
  craftDrawTimeouts = [];
  if (craftDrawState && craftDrawState.flashTimer)
    clearInterval(craftDrawState.flashTimer);
  if (craftDrawState && craftDrawState.countdownTimer)
    clearInterval(craftDrawState.countdownTimer);
}
// Elapsed/remaining/progress for the drumroll countdown UI, derived from a wall-clock
// timestamp (not a tick counter) so it stays accurate even if the tab was briefly backgrounded.
function craftCountdownState() {
  if (!craftDrawState || !craftDrawState.active) return null;
  const elapsed = performance.now() - craftDrawState.startedAt;
  const remaining = Math.max(0, craftDrawState.totalMs - elapsed);
  return {
    remaining,
    pct: Math.min(100, (elapsed / craftDrawState.totalMs) * 100),
  };
}
function craftPrizeScript(ti) {
  const t = gameState.teams[ti];
  const name = t?.name || "Team " + (ti + 1);
  const brewery = gameState.meta.craftPartner || "our craft partner";
  const town = (gameState.meta.craftPartnerTown || "").trim();
  return `Congratulations to ${name}! You've won a craft beer gift card to ${brewery}${town ? " in " + town : ""}. Cheers!`;
}
function setExcludeTopN(v) {
  // Can exclude at most N-1 of the N teams in the game — one team always has to stay
  // eligible for the craft prize, so the ceiling scales with the roster instead of a flat cap.
  const maxExcludeN = Math.max(1, gameState.teams.length - 1);
  const n = Math.max(1, Math.min(maxExcludeN, parseInt(v, 10) || 2));
  gameState.meta.excludeTopN = n;
  autosave();
  renderLeft();
}
function setCraftDrawSeconds(v) {
  const n = Math.max(3, Math.min(30, parseInt(v, 10) || 6));
  const p = loadPrefs();
  p.craftDrawSeconds = n;
  savePrefs(p);
  renderLeft();
}
function updateCraftScript(val) {
  if (gameState.craftPrizeWinner) {
    gameState.craftPrizeWinner.script = val;
    autosave();
  }
}
// The top N places (N = exclude-top setting) don't compete for the one craft-beer prize.
function craftEligiblePool() {
  const n = gameState.meta.excludeTopN || 2;
  const topN = new Set(
    ranked()
      .slice(0, n)
      .map((r) => r.index),
  );
  return gameState.teams.map((_, i) => i).filter((i) => !topN.has(i));
}

/* ── ELIGIBLE LIST EXPORT (for an outside drumroll app) ─────────────
   Hands the drawing off to a separate name-picker/drumroll app: same pool the in-app drawing
   would use, including the Exclude Top N rule, so the outside draw is over exactly the teams
   this app would have drawn from, led by the craft partner and its town. Plain lines, one entry
   each — that's what those apps take on a paste, and anything richer (CSV columns, JSON) just
   shows up as junk on the wheel. */
function craftEligibleTeamNames() {
  return craftEligiblePool().map(
    (ti) => gameState.teams[ti].name || "Team " + (ti + 1),
  );
}
// The craft partner and its town lead the list — the outside app is showing this to a room, and
// the brewery giving the prize should be on screen before the names it's being drawn for. Blank
// fields are dropped rather than emitted as empty lines: a name-picker reads a blank line as a
// nameless entry and will happily land the wheel on it.
function craftEligibleNames() {
  const head = [gameState.meta.craftPartner, gameState.meta.craftPartnerTown]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return head.concat(craftEligibleTeamNames());
}
// Both entry points refuse for the same two reasons; say which one out loud rather than
// silently handing over an empty file. Checks the team pool, not craftEligibleNames — the
// partner/town header would otherwise make a teamless list look non-empty.
function craftEligibleBlocker() {
  if (!gameState.teams.length)
    return "Add some teams first — there's nobody to export.";
  if (!craftEligibleTeamNames().length)
    return `No eligible teams: every team is inside the excluded top ${gameState.meta.excludeTopN || 2}. Lower "Exclude Top" in the Craft Prize Drawing section.`;
  return "";
}
function exportCraftEligible() {
  const blocked = craftEligibleBlocker();
  if (blocked) return appAlert(blocked);
  dl(
    new Blob([craftEligibleNames().join("\n") + "\n"], {
      type: "text/plain;charset=utf-8",
    }),
    exportFn("txt").replace(/\.txt$/, " - Craft Prize Eligible.txt"),
  );
}
function copyCraftEligible(btn) {
  const blocked = craftEligibleBlocker();
  if (blocked) return appAlert(blocked);
  const text = craftEligibleNames().join("\n");
  const ok = () => flashBtn(btn, CHECK_ICON_SVG + " Copied");
  const fail = () => {
    // execCommand is deprecated, but navigator.clipboard is undefined on a plain-http origin —
    // which is exactly what a laptop serving this over venue wifi looks like. Keep the fallback.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand("copy");
      ta.remove();
      copied ? ok() : appAlert("Couldn't copy — use the TXT button instead.");
    } catch (e) {
      appAlert("Couldn't copy — use the TXT button instead.");
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, fail);
  } else fail();
}
// Momentary label swap for confirmation — the app has no toast, and the button is already
// under the pointer that pressed it. Restores from the original label, so a double-tap mid-
// flash can't leave "✓ Copied" stuck there.
// innerHTML, not textContent: the flash label carries the shared CHECK_ICON_SVG now, and a
// textContent round-trip would both render the markup as literal text and strip any icon the
// button itself already had when restoring it.
function flashBtn(btn, label, ms) {
  if (!btn) return;
  if (btn.dataset.flashRestore == null)
    btn.dataset.flashRestore = btn.innerHTML;
  clearTimeout(+btn.dataset.flashTimer || 0);
  btn.innerHTML = label;
  btn.dataset.flashTimer = setTimeout(() => {
    btn.innerHTML = btn.dataset.flashRestore;
    delete btn.dataset.flashRestore;
    delete btn.dataset.flashTimer;
  }, ms || 1500);
}

function startCraftPrizeDraw() {
  if (craftDrawState && craftDrawState.active) return;
  if (gameState.craftPrizeWinner) {
    appAlert("The craft prize winner has already been chosen!");
    return;
  }
  const pool = craftEligiblePool();
  if (!pool.length) {
    appAlert(
      "No eligible teams left for the drawing (top-ranked teams are excluded)!",
    );
    return;
  }
  const prefs = loadPrefs();
  const totalMs = Math.max(3, Math.min(30, prefs.craftDrawSeconds || 6)) * 1000;
  craftDrawState = {
    active: true,
    pool,
    displayName: gameState.teams[pool[0]].name || "Team " + (pool[0] + 1),
    startedAt: performance.now(),
    totalMs,
  };
  clearCraftDrawTimers();
  stopAllDrumAudio();
  // THE audio gesture. Everything above this line is synchronous, and startDrumrollAudio calls
  // .play() synchronously too, so this whole path is still inside the button's click handler —
  // which is what makes iOS treat it as a user gesture and what unlocks the element for the
  // finale/fade swaps that follow. Do not put anything asynchronous in front of it.
  startDrumrollAudio();
  craftDrawState.flashTimer = setInterval(() => {
    const ti = pool[Math.floor(Math.random() * pool.length)];
    const name = gameState.teams[ti]?.name || "Team " + (ti + 1);
    if (craftDrawState) craftDrawState.displayName = name;
    // Update the flash text node directly — a full renderLeft() 9x/sec would rebuild the
    // entire left column for no reason, since only this one line of text is changing.
    const el = document.getElementById("cpFlashName");
    if (el) el.textContent = name;
    else renderLeft();
  }, 110);
  // Countdown UI ticks independently of the name-flash so the host can glance at exactly how
  // far into the drumroll they are while manually raising the volume and talking over it.
  craftDrawState.countdownTimer = setInterval(() => {
    const st = craftCountdownState();
    if (!st) return;
    const numEl = document.getElementById("cpCountdownNum");
    if (numEl) numEl.textContent = Math.ceil(st.remaining / 1000) + "s";
    const barEl = document.getElementById("cpCountdownBar");
    if (barEl) barEl.style.width = st.pct + "%";
  }, 100);
  // The finale and the winner selection share one timer so the reveal and the sound land together.
  // Audio first, and the winner deferred by a task rather than run inline: finalizeCraftPrizeWinner
  // does a full renderAll(), and the roll is stopped by the finale's own "playing" event, which
  // cannot be dispatched while that render owns the main thread. Running it inline held the event
  // off for ~10ms and left the roll overlapping the horn for that long. A frame's delay on the
  // winner appearing is invisible; the overlap was not. "Stop Drumroll" clears this timer, which
  // correctly cancels both halves.
  craftDrawTimeouts.push(
    setTimeout(() => {
      // Stop the name-flash and countdown intervals before the handover, not after. They repaint
      // every ~100ms, and one landing inside the handover window blocks the main thread for long
      // enough to leave the roll audible over the horn. finalizeCraftPrizeWinner clears them
      // again, harmlessly.
      clearCraftDrawTimers();
      playDrumrollFinale(() => finalizeCraftPrizeWinner(pool));
    }, totalMs),
  );
  renderLeft();
}
// Picks and commits the winner from the eligible pool — shared by the normal timed finish
// (startCraftPrizeDraw's setTimeout) and the manual "End Drumroll Now" control.
function finalizeCraftPrizeWinner(pool) {
  clearCraftDrawTimers();
  const winnerTi = pool[Math.floor(Math.random() * pool.length)];
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.teams[winnerTi].craftPrize = true;
  gameState.craftPrizeWinner = {
    ti: winnerTi,
    script: craftPrizeScript(winnerTi),
  };
  craftDrawState = null;
  scoreSortMode = "asc";
  autosave();
  renderAll();
}
// Manual "Stop Drumroll" — lets the host cut the roll short (e.g. the moment a staff member
// reveals a paper from the stack) without picking the winner yet. Fades the roll down and leaves
// the draw paused, waiting on the host to fire the victory horn on demand via playCraftVictoryHorn.
// clearCraftDrawTimers below also cancels the timer that would otherwise fire the horn on schedule.
function stopDrumrollOnly() {
  if (!craftDrawState || !craftDrawState.active) return;
  // State first, because the repaint below can run synchronously on the fallback path and would
  // otherwise draw the pre-stop UI. The repaint is then handed to fadeOutDrumAudio rather than
  // run here, so it lands after the handover instead of blocking the event that drives it (see
  // handOverToCue). A frame's delay on the button swapping to "Play Horn" is invisible; the delay
  // it was costing the audio was not.
  clearCraftDrawTimers();
  craftDrawState.audioStopped = true;
  fadeOutDrumAudio(renderLeft);
}
// Manual "Play Horn" — while a draw is paused (roll already faded out via stopDrumrollOnly),
// picks and commits the winner and plays the horn, so the reveal lands exactly when the host
// wants it. Once a winner already exists, it just replays the horn on demand.
function playCraftVictoryHorn() {
  const pool =
    craftDrawState && craftDrawState.active ? craftDrawState.pool : null;
  // Horn first: this runs inside the button's click handler, and finalizeCraftPrizeWinner below
  // does a full re-render — no reason to make the reveal wait behind it.
  playVictoryHornSound();
  if (pool) finalizeCraftPrizeWinner(pool);
}
async function clearCraftPrizeWinner() {
  if (!gameState.craftPrizeWinner) return;
  if (
    !(await appConfirm(
      "Clear the craft prize winner? You can run the drumroll again after.",
    ))
  )
    return;
  clearCraftDrawTimers();
  stopAllDrumAudio();
  gameState.teams.forEach((t) => {
    t.craftPrize = false;
  });
  gameState.craftPrizeWinner = null;
  autosave();
  renderAll();
}
// Opens the drawing flow. Purely a UI reveal — it deliberately does NOT touch audio, warm
// anything up, or construct the <audio> element; see the AUDIO POLICY note above. The first and
// only thing that starts audio is the drumroll button inside the flow this reveals.
function openCraftPrizeFlow() {
  craftFlowOpen = true;
  renderLeft();
}
function renderCraftPrizeBlock() {
  const n = gameState.teams.length;
  if (!n)
    return '<p class="fr-note">Add teams to run the craft prize drawing.</p>';
  const excludeN = gameState.meta.excludeTopN || 2;
  const maxExcludeN = Math.max(1, n - 1);
  const poolLeft = craftEligiblePool().length;
  const prefs = loadPrefs();
  const secs = prefs.craftDrawSeconds || 6;
  const drawing = !!(craftDrawState && craftDrawState.active);
  const winner = gameState.craftPrizeWinner;
  // The Copy Prize Eligible List button used to be rendered here as well, in all three states
  // (pre-draw, mid-draw, winner shown). It now lives only in Advanced Settings > Craft Prize
  // Eligible List, which is where it was exported from all along — one button in one place
  // rather than the same action in two, in a section whose job is running the draw rather than
  // exporting from it.
  // Until the host opts in, the section is just this one button — same accent styling as the
  // drumroll button it opens, so it reads identically in every theme. A draw already running or
  // a winner already picked (e.g. restored from autosave) opens the flow on its own, so a
  // reload never hides a result behind the gate.
  if (!craftFlowOpen && !drawing && !winner) {
    return `<button class="btn btn-accent cp-draw-btn" onclick="openCraftPrizeFlow()" ${poolLeft <= 0 ? "disabled" : ""}>${ICON_BEER} Choose Craft Prize Winner</button>${poolLeft <= 0 ? `<p class="fr-note">No teams left to draw from — top ${excludeN} place${excludeN > 1 ? "s" : ""} excluded covers everyone entered. Add a team, or open this to lower Exclude Top.</p>` : ""}`;
  }
  let h = `<div class="cp-config">
      <div class="cp-field"><span class="cp-field-label">Exclude Top</span><div class="stepper">
        <button onclick="setExcludeTopN(${Math.max(1, excludeN - 1)})" ${drawing || excludeN <= 1 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Decrease excluded places">−</button>
        <input type="number" class="sw-input" aria-label="Number of top places excluded from the draw" inputmode="numeric" min="1" max="${maxExcludeN}" value="${excludeN}" ${drawing ? "disabled" : ""} onchange="setExcludeTopN(this.value)">
        <button onclick="setExcludeTopN(${Math.min(maxExcludeN, excludeN + 1)})" ${drawing || excludeN >= maxExcludeN ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Increase excluded places">+</button>
      </div></div>
      <div class="cp-field"><span class="cp-field-label">Drumroll (sec)</span><div class="stepper">
        <button onclick="setCraftDrawSeconds(${Math.max(3, secs - 1)})" ${drawing || secs <= 3 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Decrease drumroll seconds">−</button>
        <input type="number" class="sw-input" aria-label="Drumroll length in seconds" inputmode="numeric" min="3" max="30" value="${secs}" ${drawing ? "disabled" : ""} onchange="setCraftDrawSeconds(this.value)">
        <button onclick="setCraftDrawSeconds(${Math.min(30, secs + 1)})" ${drawing || secs >= 30 ? 'disabled style="opacity:.3;cursor:default"' : ""} aria-label="Increase drumroll seconds">+</button>
      </div></div>
    </div>
    <div class="cp-note">Top ${excludeN} place${excludeN > 1 ? "s" : ""} ${excludeN > 1 ? "are" : "is"} excluded: ${esc(
      ranked()
        .slice(0, excludeN)
        .map((r) => r.name)
        .join(", "),
    )}</div>`;
  if (drawing) {
    h += `<div class="cp-intro">${ICON_MIC} Now choosing our Craft Beer Prize winner…</div><div class="cp-flash" id="cpFlashName">${esc(craftDrawState.displayName || "")}</div>`;
    if (craftDrawState.audioStopped) {
      h += `<button class="btn btn-accent cp-horn-btn cp-manual-end-btn" onclick="playCraftVictoryHorn()" title="Pick the winner and play the victory horn now">${ICON_HORN} Play Horn</button>`;
    } else {
      const st = craftCountdownState() || {
        remaining: craftDrawState.totalMs,
        pct: 0,
      };
      h += `<div class="cp-countdown">
      <div class="cp-countdown-track"><div class="cp-countdown-fill" id="cpCountdownBar" style="width:${st.pct}%"></div></div>
      <div class="cp-countdown-num" id="cpCountdownNum">${Math.ceil(st.remaining / 1000)}s</div>
    </div>`;
      if (prefs.craftManualEnd) {
        h += `<button class="btn btn-danger cp-manual-end-btn" onclick="stopDrumrollOnly()" title="Stop just the drumroll sound, e.g. once a staff member reveals a paper from the stack — then play the horn whenever you're ready">${ICON_STOP} Stop Drumroll</button>`;
      }
    }
  } else {
    // The only control in the app that starts audio — see startCraftPrizeDraw's gesture note.
    h += `<button class="btn btn-accent cp-draw-btn" onclick="startCraftPrizeDraw()" ${winner || poolLeft <= 0 ? "disabled" : ""}>${ICON_DRUM} Start Drumroll</button>`;
    if (!winner && poolLeft <= 0)
      h += `<p class="fr-note">No teams left in the eligible pool — lower Exclude Top above, or add another team.</p>`;
    if (prefs.craftManualEnd && !winner) {
      // Previewed here, faded and disabled, so the host knows these controls exist before the
      // drumroll is even running — rather than only discovering them once a draw is underway.
      h += `<div class="cp-manual-preview">
        <button class="btn btn-danger cp-preview-btn" disabled title="Available once the drumroll is running">${ICON_STOP} Stop Drumroll</button>
        <button class="btn btn-accent cp-preview-btn" disabled title="Available once the drumroll is running">${ICON_HORN} Play Horn</button>
      </div>`;
    }
  }
  if (winner && !drawing) {
    const wname = gameState.teams[winner.ti]?.name || "Team " + (winner.ti + 1);
    h += `<div class="cp-winner"><span class="cp-winner-text">${ICON_TROPHY} <strong>${esc(wname)}</strong> won!</span><button class="btn btn-danger cp-clear-btn" onclick="clearCraftPrizeWinner()" title="Clear the winner and run the drawing again" aria-label="Clear the winner">${X_ICON_SVG}<span class="cp-clear-label"> Clear</span></button></div>
      ${
        prefs.craftManualEnd
          ? // Concatenation, not a ${} placeholder: this arm is a plain single-quoted string,
            // not a template literal, and pasting a placeholder into one is exactly how v18.57
            // shipped a button that rendered the literal text "${ICON_HORN} Play Horn" on screen.
            '<button class="btn btn-accent cp-horn-btn cp-manual-end-btn" onclick="playCraftVictoryHorn()" title="Play the victory horn on demand">' +
            ICON_HORN +
            ' Play Horn</button>'
          : ""
      }
      <label class="cp-script-label">Winner Announcement Script</label>
      <textarea class="cp-script" maxlength="600" aria-label="Winner announcement script" onchange="updateCraftScript(this.value)">${esc(winner.script)}</textarea>`;
  }
  return h;
}

function addTeam() {
  if (gameState.teams.length >= MAX_TEAMS) return;
  gameState.teams.push(freshTeam(""));
  autosave();
  renderAll();
}
// Shift all integer keys above the removed index down by one (returns a new map).
function reindexAfterRemoval(map, ti) {
  const out = {};
  for (const k in map) {
    const i = parseInt(k, 10);
    if (i < ti) out[i] = map[k];
    else if (i > ti) out[i - 1] = map[k];
  }
  return out;
}
async function removeTeam(ti) {
  const name = gameState.teams[ti]?.name || "Team " + (ti + 1);
  const msg = checkGameStarted()
    ? 'Remove "' +
      name +
      '"? This also deletes every round, bonus, and wager score already entered for them — it can’t be undone.'
    : 'Remove "' + name + '"?';
  if (!(await appConfirm(msg, { danger: true, okLabel: "Remove" }))) return;
  gameState.teams.splice(ti, 1);
  const newAdj = new Set();
  adjOpenTeams.forEach((i) => {
    if (i < ti) newAdj.add(i);
    else if (i > ti) newAdj.add(i - 1);
  });
  adjOpenTeams = newAdj;
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++)
      gameState.rounds[ri].questions[qi] = reindexAfterRemoval(
        gameState.rounds[ri].questions[qi],
        ti,
      );
    gameState.rounds[ri].bonus = reindexAfterRemoval(
      gameState.rounds[ri].bonus,
      ti,
    );
  }
  gameState.halftime = reindexAfterRemoval(gameState.halftime, ti);
  gameState.finalWager = reindexAfterRemoval(gameState.finalWager, ti);
  // Exclude Top can never cover the whole remaining roster (at least one team must stay
  // eligible for the craft prize) — a removal can push a previously-valid setting over that
  // new N-1 ceiling, so pull it back in line rather than leaving a stale, now-invalid number.
  const maxExcludeN = Math.max(1, gameState.teams.length - 1);
  if ((gameState.meta.excludeTopN || 2) > maxExcludeN)
    gameState.meta.excludeTopN = maxExcludeN;
  autosave();
  renderAll();
}
function toggleAdj(ti) {
  if (adjOpenTeams.has(ti)) adjOpenTeams.delete(ti);
  else adjOpenTeams.add(ti);
  renderLeft();
}
function adjPts(ti, d) {
  if (!gameState.teams[ti]) return;
  gameState.teams[ti].adjustment = (gameState.teams[ti].adjustment || 0) + d;
  autosave();
  renderAll();
}
function cycleW(ri, qi, ti, w) {
  if (!canScore()) return;
  const q = gameState.rounds[ri].questions[qi];
  const a = q[ti] || {};
  if (a.wager === w) {
    // same wager re-clicked: correct -> incorrect -> fully cleared (remove the slot entirely)
    if (a.correct === true) a.correct = false;
    else delete q[ti];
  } else {
    // blocked duplicate returns without ever creating an empty slot
    if (usedW(ti, ri).find((u) => u.wager === w && u.qi !== qi)) return;
    a.wager = w;
    a.correct = true;
    q[ti] = a;
  }
  // Say what just happened. The row updates visually, but focus never moves, so without this a
  // screen-reader user gets nothing back from the tap that just scored a team.
  const now = q[ti];
  announce(
    !now
      ? `${teamLabel(ti)}, round ${ri + 1} question ${qi + 1} cleared`
      : `${teamLabel(ti)}, round ${ri + 1} question ${qi + 1}, wager ${now.wager}, ${now.correct ? "correct, plus " + now.wager : "incorrect, 0"} points. Total ${grandTotal(ti)}`,
  );
  const wasBeer = beerRoundToasted.has(ri + "-" + qi);
  lastAction = { ri, qi, ti };
  gameState.gameStarted = true;
  autosave();
  // Check beer round BEFORE re-render so we can set beer flash context
  const nowBeer = isBeerRound(ri, qi);
  if (nowBeer && !wasBeer) {
    lastAction.beerRound = true;
  }
  renderAll();
  checkBeerRound(ri, qi);
  setTimeout(() => {
    lastAction = null;
  }, 900);
}
function markAll(ri, qi, correct) {
  if (!canScore()) return;
  announce(
    `All wagered teams marked ${correct ? "correct" : "incorrect"} for round ${ri + 1} question ${qi + 1}`,
  );
  const wasBeer = beerRoundToasted.has(ri + "-" + qi);
  gameState.teams.forEach((_, ti) => {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined) a.correct = correct;
  });
  lastAction = null;
  gameState.gameStarted = true;
  autosave();
  renderAll();
  if (correct && !wasBeer) checkBeerRound(ri, qi);
}
// Accepts 1-5 letters, optional dash, 1-4 digits (e.g. "AB-123", "ABCDE1234").
function isQuizIdValid(v) {
  const s = (v || "").trim();
  return /^[A-Za-z]{1,5}-?\d{1,4}$/.test(s);
}
// Required-ness is just "something's in the field" — deliberately separate from isQuizIdValid
// so the format hint stays advisory-only and doesn't start blocking scoring on its own.
function isQuizIdEntered(v) {
  return !!(v || "").trim();
}
function isLocationValid(v) {
  return !!(v || "").trim();
}
function isHostNameValid(v) {
  return !!(v || "").trim();
}

// Guard: before the very first scoring action, a Quiz ID, Host Name, and Location must all be
// entered, and every team must have a guess. Quiz ID's format is still free-entry — it just
// has to be non-empty, not match any particular pattern. After the game has started once,
// this check is bypassed.
function canScore() {
  if (gameState.gameStarted) return true;
  // Required means entered, not "matches the pattern" — Quiz ID's format hint stays purely
  // advisory (v16.41), so a value that just doesn't look typical still satisfies this gate.
  if (!isQuizIdEntered(gameState.meta.quizId)) {
    appAlert("Please enter a Quiz ID in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  if (!isHostNameValid(gameState.meta.hostName)) {
    appAlert("Please enter a Host Name in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  if (!isLocationValid(gameState.meta.location)) {
    appAlert("Please enter a Location in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  const missing = gameState.teams.reduce((acc, t, i) => {
    if (t.scoreGuess === "" || t.scoreGuess == null)
      acc.push(t.name || "Team " + (i + 1));
    return acc;
  }, []);
  if (missing.length === 0) return true;
  appAlert(
    "Please enter a score guess for all teams before scoring begins.\n\nMissing guess:\u00a0" +
      missing.join(", "),
  );
  // Scroll the Teams section into view so the user can fix it
  const sec = document.getElementById("sec-teams");
  if (sec) {
    if (sec.classList.contains("collapsed")) sec.classList.remove("collapsed");
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return false;
}
function setB(ri, ti, v) {
  if (!canScore()) return;
  const cur = gameState.rounds[ri].bonus[ti];
  if (cur === v) {
    delete gameState.rounds[ri].bonus[ti];
    announce(`${teamLabel(ti)}, round ${ri + 1} bonus cleared`);
  } else {
    gameState.rounds[ri].bonus[ti] = v;
    announce(
      `${teamLabel(ti)}, round ${ri + 1} bonus, ${v} of 4 correct, plus ${v * 5} points`,
    );
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function clearB(ri, ti) {
  delete gameState.rounds[ri].bonus[ti];
  autosave();
  renderAll();
}
function setHW(ti, v) {
  if (!canScore()) return;
  if (!gameState.halftime[ti]) gameState.halftime[ti] = {};
  if (("" + v).trim() === "") {
    delete gameState.halftime[ti].wager;
  } else {
    gameState.halftime[ti].wager = Math.max(1, Math.min(10, +v || 1));
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setHC(ti, v) {
  if (!canScore()) return;
  const d = gameState.halftime[ti];
  if (!d || d.wager == null || d.wager === "") return;
  /* need a wager first */ const c = d.correct;
  if (c === v) delete d.correct;
  else d.correct = v;
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setFW(ti, v) {
  if (!canScore()) return;
  if (!gameState.finalWager[ti]) gameState.finalWager[ti] = {};
  if (("" + v).trim() === "") {
    delete gameState.finalWager[ti].wager;
  } else {
    gameState.finalWager[ti].wager = Math.max(1, Math.min(20, +v || 1));
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setFC(ti, v) {
  if (!canScore()) return;
  const d = gameState.finalWager[ti];
  if (!d || d.wager == null || d.wager === "") return;
  /* need a wager first */ const c = d.correct;
  if (c === v) delete d.correct;
  else d.correct = v;
  gameState.gameStarted = true;
  autosave();
  renderAll();
}

// ===== THEMED CONFIRM / ALERT (replaces window.confirm()/alert()) =====
// window.confirm()/alert() render in the OS/browser's own fixed light popup style, no matter
// this app's Dark/Light theme or Color Vision mode — the one thing left that ignored both, and
// a jarring bright-white flash against a dark room's screen besides. Both return a Promise
// instead of blocking the thread the way the native calls do (impossible to replicate for a
// custom element — nothing in the DOM can pause script execution), so every call site that used
// to read confirm()'s return value directly now awaits this instead; appAlert's callers already
// only ever ran alert() for its side effect and never touched a return value, so those call
// sites needed no restructuring beyond the rename.
let confirmDialogResolve = null;
function showConfirmDialog(message, opts) {
  const modal = document.getElementById("confirmModal");
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmMessage").textContent = message;
  const isAlert = !!(opts && opts.alert);
  modal.classList.toggle("confirm-alert", isAlert);
  const okBtn = document.getElementById("confirmOkBtn");
  okBtn.textContent = (opts && opts.okLabel) || (isAlert ? "OK" : "Confirm");
  okBtn.classList.toggle("btn-danger", !!(opts && opts.danger));
  document.getElementById("confirmCancelBtn").textContent =
    (opts && opts.cancelLabel) || "Cancel";
  overlay.classList.add("show");
  // Alert has no Cancel to reach, so OK is the sensible default focus; confirm defaults to
  // Cancel instead — every current confirm() call site guards a destructive or hard-to-undo
  // action (clearing a session, replacing loaded data), so an accidental Enter press should
  // never be the one that lands on the destructive option.
  (isAlert ? okBtn : document.getElementById("confirmCancelBtn")).focus();
  return new Promise((resolve) => {
    confirmDialogResolve = resolve;
  });
}
function confirmDialogRespond(result) {
  document.getElementById("confirmOverlay").classList.remove("show");
  const resolve = confirmDialogResolve;
  confirmDialogResolve = null;
  if (resolve) resolve(result);
}
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    document.getElementById("confirmOverlay").classList.contains("show")
  )
    confirmDialogRespond(false);
});
// opts: {danger, okLabel, cancelLabel} — danger reddens the confirm button (btn-danger) for
// destructive actions, matching the app's existing red/danger styling elsewhere.
function appConfirm(message, opts) {
  return showConfirmDialog(message, opts);
}
// Resolves once OK is dismissed — nothing meaningful in the resolved value (there's only ever
// one way out), so callers that just want to keep going after the reader has seen the message
// can await it same as appConfirm, just without checking what it returns.
function appAlert(message) {
  return showConfirmDialog(message, { alert: true });
}
// Export & Data's own "Clear Session" button (below the already-custom Yes/No export prompt) —
// pulled out to a named function since an inline onclick="" attribute can't await a Promise.
async function confirmClearSession() {
  if (
    await appConfirm("Clear all data?", {
      danger: true,
      okLabel: "Clear Session",
    })
  )
    startNewGame();
}

// ===== TEAM REPORT (formerly "Score Audit") =====
function openAudit(ti) {
  const el = document.getElementById("auditModal");
  if (!el) return;
  el.innerHTML = buildAudit(ti);
  document.getElementById("auditOverlay").classList.add("show");
}
function closeAudit() {
  document.getElementById("auditOverlay").classList.remove("show");
}

// Same guess/diff math as finalResultsRows() (Bonus Item/NJCB stripped out before comparing to
// the guess), just for one team instead of the whole sorted table — shown right under Grand
// Total so the host can see how close the team's pre-game guess landed without leaving the audit.
function auditGuessDiff(ti, score) {
  const t = gameState.teams[ti];
  const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
  const hasG = !(t.scoreGuess === "" || t.scoreGuess == null);
  const guess = hasG ? parseInt(t.scoreGuess, 10) : null;
  const adjusted = score - bonuses;
  const diff = hasG ? Math.abs(adjusted - guess) : null;
  const diffSign = hasG ? Math.sign(guess - adjusted) : 0;
  const diffTxt =
    diff == null
      ? "—"
      : diffSign > 0
        ? "+" + diff
        : diffSign < 0
          ? "-" + diff
          : diff;
  const guessCell = `<div class="aud-cell"><span class="aud-stat-n">${guess == null ? "—" : guess}</span><span class="aud-stat-pct">Score Guess</span></div>`;
  const diffCell = `<div class="aud-cell"><span class="aud-stat-n">${diffTxt}</span><span class="aud-stat-pct">Diff</span></div>`;
  // No bonuses: just Diff then Score Guess — Adj. Score would equal the raw score, so
  // there's nothing for it to clarify and it's left out entirely, and Grand Total above stays
  // the sole score anchor.
  if (!bonuses) return `<div class="aud-grid aud-grid-2">${diffCell}${guessCell}</div>`;
  // Bonus Item/NJCB collapse into one combined "Diff Adj *" figure instead of separate -5/-3
  // cells, sitting left of Adj. Score so the whole chain (adjustment -> adjusted score ->
  // diff -> guess) reads as a single divided card.
  const adjCell = `<div class="aud-cell aud-stat-wrong"><span class="aud-stat-n">-${bonuses}</span><span class="aud-stat-pct">Diff Adj *</span></div>`;
  const adjustedCell = `<div class="aud-cell"><span class="aud-stat-n">${adjusted}</span><span class="aud-stat-pct">Adj. Score</span></div>`;
  return `<div class="aud-grid aud-grid-4">${adjCell}${adjustedCell}${diffCell}${guessCell}</div>`;
}
// Tally of every question a team has been marked on — the 16 regular Q1-4 x Round 1-4 answers,
// the 4-question Beer Round bonus in Round 1 and Round 3 (rounds.bonus[ti] is a 0-4 count of how
// many of those 4 were correct), and the single Halftime/Final wagers after Round 2/4 — 26
// questions total when every one has been marked. Shown as a correct/incorrect count under the
// Grand Total.
function auditOverallStats(ti) {
  let correct = 0,
    incorrect = 0;
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager != null && a.wager !== "" && a.correct != null) {
        if (a.correct) correct++;
        else incorrect++;
      }
    }
    if (BONUS_ROUNDS.has(ri)) {
      const v = gameState.rounds[ri].bonus[ti];
      if (v != null) {
        correct += v;
        incorrect += 4 - v;
      }
    }
  }
  const h = gameState.halftime[ti];
  if (h && h.wager != null && h.wager !== "" && h.correct != null) {
    if (h.correct) correct++;
    else incorrect++;
  }
  const f = gameState.finalWager[ti];
  if (f && f.wager != null && f.wager !== "" && f.correct != null) {
    if (f.correct) correct++;
    else incorrect++;
  }
  const total = correct + incorrect;
  if (!total) return "";
  const correctPct = Math.round((correct / total) * 100);
  const incorrectPct = 100 - correctPct;
  return (
    `<div class="aud-grid aud-grid-2">` +
    `<div class="aud-cell aud-stat-correct"><span class="aud-stat-n">${correct}/${total} correct</span><span class="aud-stat-pct">${correctPct}%</span></div>` +
    `<div class="aud-cell aud-stat-wrong"><span class="aud-stat-n">${incorrect}/${total} incorrect</span><span class="aud-stat-pct">${incorrectPct}%</span></div>` +
    `</div>`
  );
}
function auditQLine(ri, qi, ti) {
  const a = gameState.rounds[ri].questions[qi][ti] || {};
  const hasW = a.wager !== undefined,
    hasR = a.correct !== undefined;
  let res, pts, pcls;
  if (!hasW) {
    res = '<span class="aud-res aud-none">no wager placed</span>';
    pts = "\u2014";
    pcls = "none";
  } else if (!hasR) {
    res =
      '<span class="aud-res aud-pending">wager ' +
      a.wager +
      " \u2014 not marked</span>";
    pts = "\u2014";
    pcls = "none";
  } else if (a.correct) {
    res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} correct</span>`;
    pts = "+" + a.wager;
    pcls = "pos";
  } else {
    res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} incorrect</span>`;
    pts = "0";
    pcls = "zero";
  }
  const wtxt = hasW ? "wager " + a.wager : "\u2014";
  return `<div class="aud-line"><span class="aud-q">Q${qi + 1}</span><span class="aud-wager">${wtxt}</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
}

function buildAudit(ti) {
  const t = gameState.teams[ti];
  if (!t) return "";
  const name = esc(t.name || "Team " + (ti + 1));
  const rm = rankMap();
  const rank = rm[ti];
  let h = `<div class="audit-head"><h2>${name}<span class="aud-sub">Team Report \u2014 rank #${rank} of ${gameState.teams.length} \u00B7 ${esc(gameState.meta.location || "")}${gameState.meta.quizId ? " \u00B7 Quiz " + esc(gameState.meta.quizId) : ""}</span></h2><button class="audit-close" onclick="closeAudit()" aria-label="Close" title="Close">${X_ICON_SVG}</button></div>`;
  h += `<div class="audit-body">`;

  let run = 0;
  function roundBlock(ri, label, colorCls) {
    let b = `<div class="aud-round"><div class="aud-round-h"><span class="round-label ${colorCls}">${label}</span><span style="color:var(--text-muted);font-weight:400;font-size:.68rem;letter-spacing:0;text-transform:none">wagers ${ROUND_WAGERS[ri].join(", ")}</span></div>`;
    for (let qi = 0; qi < 4; qi++) b += auditQLine(ri, qi, ti);
    if (BONUS_ROUNDS.has(ri)) {
      const v = gameState.rounds[ri].bonus[ti];
      let res, pts, pcls;
      if (v == null) {
        res = '<span class="aud-res aud-none">not marked</span>';
        pts = "\u2014";
        pcls = "none";
      } else if (v > 0) {
        res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} ${v} of 4 correct</span>`;
        pts = "+" + v * 5;
        pcls = "pos";
      } else {
        res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} 0 of 4 correct</span>`;
        pts = "0";
        pcls = "zero";
      }
      b += `<div class="aud-line"><span class="aud-q">B</span><span class="aud-wager">bonus \u00D75</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
    }
    const sub = roundSub(ti, ri);
    run += sub;
    b += `<div class="aud-subline"><span class="asl-row"><span class="lbl">Subtotal</span><span class="sub">${sub}</span></span><span class="asl-row"><span class="lbl">total so far</span><span class="run">${run}</span></span></div>`;
    return b + `</div>`;
  }
  function wagerBlock(data, label, colorCls, maxTxt, skipSub) {
    const w =
      data && data.wager != null && data.wager !== "" ? +data.wager : null;
    let res, pts, pcls;
    if (w == null) {
      res = '<span class="aud-res aud-none">no wager placed</span>';
      pts = "\u2014";
      pcls = "none";
    } else if (data.correct == null) {
      res =
        '<span class="aud-res aud-pending">wager ' +
        w +
        " \u2014 not marked</span>";
      pts = "\u2014";
      pcls = "none";
    } else if (data.correct) {
      res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} correct</span>`;
      pts = "+" + w;
      pcls = "pos";
    } else {
      res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} incorrect</span>`;
      pts = "\u2212" + w;
      pcls = "neg";
    }
    const p = w != null && data.correct != null ? (data.correct ? w : -w) : 0;
    run += p;
    let b = `<div class="aud-round"><div class="aud-round-h"><span class="round-label ${colorCls}">${label}</span><span style="color:var(--text-muted);font-weight:400;font-size:.68rem;letter-spacing:0;text-transform:none">${maxTxt}</span></div>`;
    b += `<div class="aud-line"><span class="aud-q">\u2605</span><span class="aud-wager">${w != null ? "wager " + w : "\u2014"}</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
    // Final Wager's own running total always equals Grand Total (nothing scores after it), which
    // sits right below in its own callout \u2014 showing it again here would just repeat that number.
    if (!skipSub)
      b += `<div class="aud-subline"><span class="asl-row"><span class="lbl">after ${label}</span></span><span class="asl-row"><span class="lbl">total so far</span><span class="run">${run}</span></span></div>`;
    return b + `</div>`;
  }

  // Extras \u2014 bonus item and NJCB card are checked in before the game starts, so show them
  // first; the running "total so far" in every later block includes them from the start.
  // No value in the leading .aud-q cell the way scored rows carry a question number: the points
  // are already stated at the end of the row, and printing "+5" at both ends of a two-item line
  // just said the same thing twice. The label carries no verb for the same reason \u2014 "Bonus
  // item" and "NJCB Member Card" are the things being scored, and "brought"/"shown" only restated
  // that they are present, which the row's existence and its points already say.
  const item = t.bonusItem ? 5 : 0,
    nj = t.njcb ? 3 : 0,
    adj = t.adjustment || 0;
  if (item || nj || adj) {
    h += `<div class="aud-round"><div class="aud-round-h"><span class="round-label rl-3">Extras</span></div>`;
    if (item)
      h += `<div class="aud-line"><span class="aud-res aud-correct">Bonus item</span><span class="aud-p pos">+5</span></div>`;
    if (nj)
      h += `<div class="aud-line"><span class="aud-res aud-correct">NJCB Member Card</span><span class="aud-p pos">+3</span></div>`;
    if (adj)
      h += `<div class="aud-line"><span class="aud-res">Manual adjustment</span><span class="aud-p ${adj > 0 ? "pos" : "neg"}">${adj > 0 ? "+" : ""}${adj}</span></div>`;
    const extrasSub = item + nj + adj;
    run += extrasSub;
    // Subtotal only, no "total so far" — Extras is rendered before Round 1, so at this point the
    // two are the same number and printing both would state it twice. Same reason the Final
    // Wager block skips its own running total. The block itself only renders when the team has
    // extras at all, so this line never appears as a lone 0.
    h += `<div class="aud-subline"><span class="asl-row"><span class="lbl">Subtotal</span><span class="sub">${extrasSub}</span></span></div>`;
    h += `</div>`;
  }

  // Two-column desktop layout: column 1 runs through Halftime Bonus, column 2 picks up at
  // Round 3 \u2014 Grand Total and everything after it (Guess/Diff, overall stats, note) stays
  // full-width below both columns rather than living inside either one.
  let col1 = roundBlock(0, "Round 1", "rl-1");
  col1 += roundBlock(1, "Round 2", "rl-2");
  col1 += wagerBlock(
    gameState.halftime[ti],
    "Halftime Bonus",
    "rl-2",
    "win or lose, 1\u201310",
  );
  let col2 = roundBlock(2, "Round 3", "rl-3");
  col2 += roundBlock(3, "Round 4", "rl-4");
  col2 += wagerBlock(
    gameState.finalWager[ti],
    "Final Wager",
    "rl-4",
    "win or lose, 1\u201320",
    true,
  );
  h += `<div class="aud-columns"><div class="aud-col">${col1}</div><div class="aud-col">${col2}</div></div>`;

  const gt = grandTotal(ti);
  h += `<div class="aud-total"><span>Grand Total</span><span class="val">${gt}</span></div>`;
  h += auditGuessDiff(ti, gt);
  h += auditOverallStats(ti);
  if (run !== gt)
    h += `<div class="aud-note">Note: running figure (${run}) and grand total (${gt}) differ \u2014 if you see this, take a screenshot.</div>`;
  else
    h += `<div class="aud-note">Each round shows that question's wager, whether it was marked correct or incorrect, and the team's running score. To fix a wrong wager, close this and tap the wager button in the round itself. </br> </br><strong>Diff Adj (Difference Adjustment)</strong> is the Bonuses coming back off — Bonus Item (+5) and NJCB (+3). </br><strong>Adj. Score (Adjusted Score)</strong> is the Grand Total with those stripped out. </br><strong>Diff</strong> is Adj. Score measured against the team's Score Guess. A plus (+) means they guessed high, a minus (−) means they guessed low, and 0 means they called it exactly. </br> </br>* Every team's guess is compared on the same bonus-free footing, which is why the bonuses come off before the guess is scored.</div>`;
  h += `</div>`;
  return h;
}
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

function saveToFile() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(gameState, null, 2)], {
      type: "application/json",
    }),
  );
  a.download = exportFn("json").replace(".json", "-save.json");
  a.click();
}
async function triggerLoadFile() {
  const msg = gameState.teams.length
    ? "Replace current session? This wipes every team, score, and Event Details field currently entered — it can’t be undone."
    : "Replace current session?";
  // The file input's own .click() below needs to run off a real user gesture or the browser
  // silently refuses to open the picker — the OK button's own click, which is what resolves
  // this await, still counts (a browser's "transient activation" survives a promise resolving
  // synchronously off a real click, same as it would survive any other microtask hop), so this
  // works the same as it did calling window.confirm() synchronously.
  if (await appConfirm(msg, { okLabel: "Replace" }))
    document.getElementById("fileLoadInput").click();
}
function loadFromFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function (ev) {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch (err) {
      appAlert(
        "Bad JSON \u2014 this file isn\u2019t a valid save: " + err.message,
      );
      return;
    }
    try {
      gameState = migrateState(data);
      autosave();
      renderAll();
      document.getElementById("resumeBanner")?.classList.remove("show");
      closeSettingsPanel();
    } catch (err) {
      appAlert("Couldn\u2019t load this save: " + err.message);
      console.error("loadFromFile render error:", err);
    }
  };
  r.readAsText(f);
  e.target.value = "";
}
// App Preferences save/load — a separate file format from the Session Data save/load above:
// this one carries only the Settings-panel prefs blob (theme, size, timer duration, etc.), not
// team/score data, so a host can carry their preferred setup between events without dragging an
// old game's teams and scores along with it.
function savePrefsToFile() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(loadPrefs(), null, 2)], {
      type: "application/json",
    }),
  );
  // Prefs aren't tied to any one game (that's what saveToFile/exportFn's Location-based name is
  // for) — Host Name is the one Event Details field that identifies a PERSON rather than a game,
  // which is what makes it useful here: a host who saves their own preferences file once and
  // reuses it across events gets a filename naming them, not whatever game happened to be open
  // when they saved it. Falls back to the plain name whenever it's blank, same as exportFn falls
  // back to "Trivia" for an empty Location.
  const host = sanitizeFile(gameState.meta.hostName);
  a.download = (host ? host + " - " : "") + "Scorekeeper Preferences.json";
  a.click();
}
async function triggerLoadPrefsFile() {
  if (
    await appConfirm("Replace current app preferences?", {
      okLabel: "Replace",
    })
  )
    document.getElementById("prefsLoadInput").click();
}
function loadPrefsFromFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function (ev) {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch (err) {
      appAlert(
        "Bad JSON — this file isn’t a valid preferences file: " + err.message,
      );
      return;
    }
    try {
      savePrefs(data);
      applyPrefs();
      setQtDurationSec(loadPrefs().qtDurationSec);
    } catch (err) {
      appAlert("Couldn’t load these preferences: " + err.message);
      console.error("loadPrefsFromFile error:", err);
    }
  };
  r.readAsText(f);
  e.target.value = "";
}
async function loadSampleGame() {
  const msg = gameState.teams.length
    ? "Load the sample game? This wipes every team, score, and Event Details field currently entered \u2014 it can\u2019t be undone."
    : "Load the sample game? This replaces your current session.";
  if (!(await appConfirm(msg, { okLabel: "Load" }))) return;
  gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
  autosave();
  renderAll();
  document.getElementById("resumeBanner")?.classList.remove("show");
  closeSettingsPanel();
}

function buildRows() {
  const rm = rankMap();
  return gameState.teams.map((team, ti) => {
    const r = {};
    r.Date = isoToMDY(gameState.meta.date);
    r.Location = gameState.meta.location;
    r.QuizID = gameState.meta.quizId;
    r.BonusItemDesc = gameState.meta.bonusItem || "";
    r.TeamName = team.name;
    r.ScoreGuess = team.scoreGuess;
    r.BonusItem = team.bonusItem ? 1 : 0;
    r.NJCB = team.njcb ? 1 : 0;
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[0].questions[qi][ti] || {};
      r["R1Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R1Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    const b1 = gameState.rounds[0].bonus[ti];
    r.R1BonusCount = b1 != null ? b1 : "";
    r.R1BonusPts = b1 != null ? b1 * 5 : "";
    r.R1Subtotal = roundSub(ti, 0);
    const ht = gameState.halftime[ti] || {};
    r.HalftimeWager = ht.wager != null && ht.wager !== "" ? ht.wager : "";
    r.HalftimeCorrect = ht.correct != null ? (ht.correct ? 1 : 0) : "";
    r.HalfTimePts = htPts(ti);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[1].questions[qi][ti] || {};
      r["R2Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R2Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    r.R2Subtotal = roundSub(ti, 1);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[2].questions[qi][ti] || {};
      r["R3Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R3Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    const b3 = gameState.rounds[2].bonus[ti];
    r.R3BonusCount = b3 != null ? b3 : "";
    r.R3BonusPts = b3 != null ? b3 * 5 : "";
    r.R3Subtotal = roundSub(ti, 2);
    const fw = gameState.finalWager[ti] || {};
    r.FinalWager = fw.wager != null && fw.wager !== "" ? fw.wager : "";
    r.FinalWagerCorrect = fw.correct != null ? (fw.correct ? 1 : 0) : "";
    r.FinalWagerPts = fwPts(ti);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[3].questions[qi][ti] || {};
      r["R4Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R4Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    r.R4Subtotal = roundSub(ti, 3);
    r.Adjustment = team.adjustment || 0;
    r.GrandTotal = grandTotal(ti);
    r.Rank = rm[ti];
    return r;
  });
}
function expCols() {
  return [
    "Date",
    "Location",
    "QuizID",
    "BonusItemDesc",
    "TeamName",
    "ScoreGuess",
    "BonusItem",
    "NJCB",
    "R1Q1Wager",
    "R1Q1Correct",
    "R1Q2Wager",
    "R1Q2Correct",
    "R1Q3Wager",
    "R1Q3Correct",
    "R1Q4Wager",
    "R1Q4Correct",
    "R1BonusCount",
    "R1BonusPts",
    "R1Subtotal",
    "HalftimeWager",
    "HalftimeCorrect",
    "HalfTimePts",
    "R2Q1Wager",
    "R2Q1Correct",
    "R2Q2Wager",
    "R2Q2Correct",
    "R2Q3Wager",
    "R2Q3Correct",
    "R2Q4Wager",
    "R2Q4Correct",
    "R2Subtotal",
    "R3Q1Wager",
    "R3Q1Correct",
    "R3Q2Wager",
    "R3Q2Correct",
    "R3Q3Wager",
    "R3Q3Correct",
    "R3Q4Wager",
    "R3Q4Correct",
    "R3BonusCount",
    "R3BonusPts",
    "R3Subtotal",
    "FinalWager",
    "FinalWagerCorrect",
    "FinalWagerPts",
    "R4Q1Wager",
    "R4Q1Correct",
    "R4Q2Wager",
    "R4Q2Correct",
    "R4Q3Wager",
    "R4Q3Correct",
    "R4Q4Wager",
    "R4Q4Correct",
    "R4Subtotal",
    "Adjustment",
    "GrandTotal",
    "Rank",
  ];
}

function exportPDF() {
  try {
    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
      appAlert("PDF library not loaded — cannot build PDF.");
      return;
    }
    if (!gameState.teams || !gameState.teams.length) {
      appAlert("No teams yet — nothing to export.");
      return;
    }
    const { jsPDF } = window.jspdf;
    // Text colors below are chosen for >=4.5:1 contrast (WCAG AA, normal text) against both
    // their cell's base background and its zebra-striped (darkened) variant — darkening a
    // light background actually *reduces* contrast against dark text (it moves the
    // background's luminance closer to the text's), so the striped variant is the binding
    // constraint and was checked explicitly for every color pair, not assumed to be safe.
    // The Sub/Diff red (8B0000) and the Round 2/3/4 header colors were also run through
    // protanopia/deuteranopia/tritanopia simulation to confirm they hold up for colorblind
    // readers, not just for typical color vision.
    const SPEC = [
      {
        w: 16,
        k: "rownum",
        df: "DCE6F2",
        dc: "000000",
        b: true,
        l4: "#",
        a: "C",
      },
      {
        w: 150,
        k: "teamname",
        df: "DCE6F2",
        dc: "000000",
        b: true,
        l4: "Team Name",
        a: "L",
      },
      {
        w: 32,
        k: "njcb3",
        df: "F2DCDB",
        dc: "6B2E12",
        b: false,
        l4: "CB=3",
        a: "C",
      },
      {
        w: 30,
        k: "item5",
        df: "CCC1DA",
        dc: "3E2352",
        b: false,
        l4: "B=5",
        a: "C",
      },
      {
        w: 20,
        k: "r1q0",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "1",
        a: "C",
      },
      {
        w: 20,
        k: "r1q1",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "2",
        a: "C",
      },
      {
        w: 20,
        k: "r1q2",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r1q3",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "4",
        a: "C",
      },
      {
        w: 26,
        k: "r1bonus",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Bonus",
        a: "C",
      },
      {
        w: 34,
        k: "tK",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r2q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "1",
        a: "C",
      },
      {
        w: 20,
        k: "r2q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r2q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "5",
        a: "C",
      },
      {
        w: 20,
        k: "r2q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "7",
        a: "C",
      },
      {
        w: 28,
        k: "tP",
        df: "EFEFEF",
        dc: "8B0000",
        b: true,
        l4: "Sub",
        a: "C",
      },
      {
        w: 40,
        k: "htpts",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "HT 1-10",
        a: "C",
      },
      {
        w: 34,
        k: "tR",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r3q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "2",
        a: "C",
      },
      {
        w: 20,
        k: "r3q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "4",
        a: "C",
      },
      {
        w: 20,
        k: "r3q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "6",
        a: "C",
      },
      {
        w: 20,
        k: "r3q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "8",
        a: "C",
      },
      {
        w: 26,
        k: "r3bonus",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Bonus",
        a: "C",
      },
      {
        w: 34,
        k: "tY",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r4q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r4q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "6",
        a: "C",
      },
      {
        w: 20,
        k: "r4q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "9",
        a: "C",
      },
      {
        w: 22,
        k: "r4q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "12",
        a: "C",
      },
      {
        w: 28,
        k: "tAD",
        df: "EFEFEF",
        dc: "8B0000",
        b: true,
        l4: "Sub",
        a: "C",
      },
      {
        w: 46,
        k: "fwpts",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Final 1-20",
        a: "C",
      },
      {
        w: 34,
        k: "tAF",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
    ];
    // group header row: [startIdx,endIdx,label,fillhex,fonthex] — only the 4 rounds get a
    // colored band; the id columns (#, Team Name, CB=3, B=5) stay blank above.
    // Round 2/3/4 use pastel tints of the Okabe-Ito colorblind-safe palette (bluish-green /
    // reddish-purple / vermillion) instead of hues that only differ in lightness — simulating
    // protanopia/deuteranopia/tritanopia on the old purple/rose/olive set showed them collapsing
    // to a worst-case RGB distance of ~34 (barely distinguishable); this set holds ~69 worst-case,
    // roughly double the separation, while every band still hits AAA (>=10:1) with black text.
    const GROUPS = [
      [4, 9, "Round 1", "FFC000", "000000"],
      [10, 16, "Round 2", "73CAB2", "000000"],
      [17, 22, "Round 3", "E3B5CF", "000000"],
      [23, 29, "Round 4", "E8A673", "000000"],
    ];
    const TRIV_WAGERS = [
      [1, 2, 3, 4],
      [1, 3, 5, 7],
      [2, 4, 6, 8],
      [3, 6, 9, 12],
    ];

    function hx(h) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const PW = doc.internal.pageSize.getWidth(),
      PH = doc.internal.pageSize.getHeight();
    const M = 24,
      usableW = PW - M * 2,
      pageBottom = PH - M;
    const teams = gameState.teams,
      N = teams.length;

    // ---- per-entry computed totals (entry order) ----
    const qpts = (ri, t) => {
      const out = [];
      const ws = TRIV_WAGERS[ri];
      for (let k = 0; k < 4; k++) {
        const W = ws[k];
        let p = 0;
        const qq = gameState.rounds[ri].questions;
        for (let qi = 0; qi < 4; qi++) {
          const a = qq[qi][t];
          if (a && a.wager === W) {
            p = a.correct === true ? W : 0;
            break;
          }
        }
        out.push(p);
      }
      return out;
    };
    const rec = [];
    for (let t = 0; t < N; t++) {
      const tm = teams[t];
      const r1 = qpts(0, t),
        r2 = qpts(1, t),
        r3 = qpts(2, t),
        r4 = qpts(3, t);
      const r1b = (gameState.rounds[0].bonus[t] || 0) * 5,
        r3b = (gameState.rounds[2].bonus[t] || 0) * 5;
      const ht = htPts(t),
        fw = fwPts(t);
      const njcb3 = tm.njcb ? 3 : 0,
        item5 = tm.bonusItem ? 5 : 0;
      const sum = (a) => a[0] + a[1] + a[2] + a[3];
      const tK = njcb3 + item5 + sum(r1) + r1b;
      const tP = tK + sum(r2);
      const tR = tP + ht;
      const tY = tR + sum(r3) + r3b;
      const tAD = tY + sum(r4);
      const tAF = tAD + fw;
      const guess =
        tm.scoreGuess === "" || tm.scoreGuess == null
          ? 0
          : parseInt(tm.scoreGuess, 10);
      rec.push({
        num: t + 1,
        name: tm.name || "Team " + (t + 1),
        njcb3,
        item5,
        r1,
        r2,
        r3,
        r4,
        r1b,
        r3b,
        ht,
        fw,
        tK,
        tP,
        tR,
        tY,
        tAD,
        fw2: fw,
        tAF,
        guess,
        tAH: tAF - njcb3 - item5 - guess,
      });
    }
    const standings = rec
      .slice()
      .sort((a, b) => b.tAF - a.tAF || a.num - b.num);

    // ---- value getter by kind for entry-row t ----
    const val = (k, t) => {
      const r = rec[t];
      switch (k) {
        case "rownum":
          return String(t + 1);
        case "teamname":
          return r.name;
        case "njcb3":
          return String(r.njcb3);
        case "item5":
          return String(r.item5);
        case "r1q0":
          return String(r.r1[0]);
        case "r1q1":
          return String(r.r1[1]);
        case "r1q2":
          return String(r.r1[2]);
        case "r1q3":
          return String(r.r1[3]);
        case "r1bonus":
          return String(r.r1b);
        case "tK":
          return String(r.tK);
        case "r2q0":
          return String(r.r2[0]);
        case "r2q1":
          return String(r.r2[1]);
        case "r2q2":
          return String(r.r2[2]);
        case "r2q3":
          return String(r.r2[3]);
        case "tP":
          return String(r.tP);
        case "htpts":
          return String(r.ht);
        case "tR":
          return String(r.tR);
        case "r3q0":
          return String(r.r3[0]);
        case "r3q1":
          return String(r.r3[1]);
        case "r3q2":
          return String(r.r3[2]);
        case "r3q3":
          return String(r.r3[3]);
        case "r3bonus":
          return String(r.r3b);
        case "tY":
          return String(r.tY);
        case "r4q0":
          return String(r.r4[0]);
        case "r4q1":
          return String(r.r4[1]);
        case "r4q2":
          return String(r.r4[2]);
        case "r4q3":
          return String(r.r4[3]);
        case "tAD":
          return String(r.tAD);
        case "fwpts":
          return String(r.fw);
        case "tAF":
          return String(r.tAF);
      }
      return "";
    };

    // ---- column x positions scaled to fit width ----
    const totalUnits = SPEC.reduce((a, c) => a + c.w, 0);
    const scale = usableW / totalUnits;
    const cw = SPEC.map((c) => c.w * scale);
    const cx = [];
    let acc = M;
    cw.forEach((w) => {
      cx.push(acc);
      acc += w;
    });

    // Subtle zebra striping: darkens a cell's own background by 10% on alternating rows.
    // Darkening a light background only ever raises contrast for the dark text drawn on
    // top of it, so every text/background pair already at AA on the base color stays at
    // (or above) AA once striped — verified against every color used in this table.
    const ZEBRA_FACTOR = 0.9;
    const darken = (hexcolor) => {
      const c = hx(hexcolor);
      return c
        .map((v) => Math.max(0, Math.round(v * ZEBRA_FACTOR)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    };
    const setFill = (h) => {
      const c = hx(h);
      doc.setFillColor(c[0], c[1], c[2]);
    };
    const setText = (h) => {
      const c = hx(h);
      doc.setTextColor(c[0], c[1], c[2]);
    };
    const fitFs = (txt, wpx, base) => {
      let fs = base;
      doc.setFontSize(fs);
      while (fs > 3 && doc.getTextWidth(txt) > wpx - 2) {
        fs -= 0.25;
        doc.setFontSize(fs);
      }
      return fs;
    };
    const cellText = (txt, ix, yTop, h, fontHex, bold, base, alignL) => {
      if (txt === "") return;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      fitFs(txt, cw[ix], base);
      setText(fontHex);
      const tx = alignL ? cx[ix] + 3 : cx[ix] + cw[ix] / 2;
      doc.text(txt, tx, yTop + h - h * 0.28, {
        align: alignL ? "left" : "center",
      });
    };

    const rowH = 18,
      fsData = Math.min(rowH * 0.6, 9);
    let y = M;

    function drawInfoHeader() {
      const meta = gameState.meta || {};
      const headerFields = [
        ["LOCATION", meta.location || "—"],
        ["DATE", isoToMDY(meta.date) || "—"],
        ["QUIZ #", meta.quizId || "—"],
        ["HOST", meta.hostName || "—"],
      ];
      // One row of four, as before. Craft Partner and Bonus Item are NOT here — they sit beside
      // the Standings table instead (see drawSideInfo), in the ~360pt of empty page that the
      // 432pt-wide table leaves to its right. A second header row cost 40pt of vertical space on
      // every export for two fields; the space next to Standings was already paid for.
      const drawRow = (fields, rowY, perRow) => {
        const fieldW = Math.min(320, usableW / perRow);
        fields.forEach(([label, value], i) => {
          const fx = M + i * fieldW;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          setText("595959");
          doc.text(label, fx, rowY + 9);
          doc.setFont("helvetica", "bold");
          fitFs(value, fieldW - 6, 15);
          setText("000000");
          doc.text(value, fx, rowY + 28, { maxWidth: fieldW - 6 });
        });
      };
      drawRow(headerFields, y, 4);
      y += 44;
    }
    function drawMainHeaderRows() {
      const groupY = y;
      setFill("FFFFFF");
      doc.rect(M, groupY, usableW, rowH, "F");
      GROUPS.forEach(([s, e, label, fill, font]) => {
        const x0 = cx[s],
          x1 = cx[e] + cw[e];
        setFill(fill);
        doc.rect(x0, groupY, x1 - x0, rowH, "F");
        doc.setFont("helvetica", "bold");
        setText(font);
        fitFs(label, x1 - x0, fsData + 2);
        doc.text(label, (x0 + x1) / 2, groupY + rowH - rowH * 0.28, {
          align: "center",
        });
      });
      y += rowH;
      const labelY = y;
      SPEC.forEach((c, ix) => {
        let fill = "FFFFFF";
        if (["tK", "tR", "tY", "tAF"].includes(c.k)) fill = "FFC000";
        else if (["tP", "tAD"].includes(c.k)) fill = "EFEFEF";
        setFill(fill);
        doc.rect(cx[ix], labelY, cw[ix], rowH, "F");
        if (c.l4)
          cellText(
            c.l4,
            ix,
            labelY,
            rowH,
            "000000",
            true,
            fsData,
            c.k === "teamname",
          );
      });
      y += rowH;
      return groupY;
    }
    function drawGridLines(topY, bottomY, xs, fullWidthEnd) {
      doc.setDrawColor(180, 180, 185);
      doc.setLineWidth(0.3);
      const rows = Math.round((bottomY - topY) / rowH);
      // horizontal lines are drawn per-row by the caller's row loop already covers fills;
      // here we only need the vertical column separators plus top/bottom borders.
      xs.forEach((x) => doc.line(x, topY, x, bottomY));
      doc.line(fullWidthEnd, topY, fullWidthEnd, bottomY);
      for (let r = 0; r <= rows; r++) {
        const yy = topY + r * rowH;
        doc.line(xs[0], yy, fullWidthEnd, yy);
      }
      doc.setDrawColor(120, 120, 120);
      doc.line(xs[0], topY, fullWidthEnd, topY);
    }

    drawInfoHeader();
    drawMainHeaderRows();
    let dataTop = y;
    for (let t = 0; t < N; t++) {
      if (y + rowH > pageBottom) {
        drawGridLines(dataTop, y, cx, M + usableW);
        doc.addPage();
        y = M;
        drawMainHeaderRows();
        dataTop = y;
      }
      const stripe = t % 2 === 1;
      SPEC.forEach((c, ix) => {
        setFill(stripe ? darken(c.df) : c.df);
        doc.rect(cx[ix], y, cw[ix], rowH, "F");
        cellText(val(c.k, t), ix, y, rowH, c.dc, c.b, fsData, c.a === "L");
      });
      y += rowH;
    }
    drawGridLines(dataTop, y, cx, M + usableW);
    y += 16;

    // ---- standings table (Place / Score / Team Name / Guess / Diff) ----
    const SCOLS = [
      { w: 44, k: "place", l: "Place", fill: "92D050" },
      { w: 56, k: "score", l: "Score", fill: "FFFFFF" },
      { w: 220, k: "name", l: "Team Name", fill: "FFFFFF" },
      { w: 56, k: "guess", l: "Guess", fill: "FFFFFF" },
      { w: 56, k: "diff", l: "Diff", fill: "FFFFFF" },
    ];
    const scx = [];
    let sacc = M;
    SCOLS.forEach((c) => {
      scx.push(sacc);
      sacc += c.w;
    });
    const standingsW = scx[SCOLS.length - 1] + SCOLS[SCOLS.length - 1].w;

    if (y + rowH * 3 > pageBottom) {
      doc.addPage();
      y = M;
    }
    function drawStandingsHeader() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText("000000");
      doc.text("STANDINGS", M, y);
      y += 12;
      const sHeadY = y;
      SCOLS.forEach((c, ix) => {
        setFill(c.fill);
        doc.rect(scx[ix], sHeadY, c.w, rowH, "F");
        doc.setFont("helvetica", "bold");
        setText("000000");
        fitFs(c.l, c.w, fsData);
        doc.text(
          c.l,
          scx[ix] + (c.k === "name" ? 3 : c.w / 2),
          sHeadY + rowH - rowH * 0.28,
          { align: c.k === "name" ? "left" : "center" },
        );
      });
      y += rowH;
      return sHeadY;
    }
    // Craft Partner and Bonus Item, in the empty page beside the Standings table. Standings is
    // 432pt of an ~794pt usable width, so there is roughly 360pt sitting unused to its right on
    // every export — enough for both fields at more than double the width a six-across header row
    // could have given them, for no vertical cost at all. Drawn once, from the top of the
    // Standings heading, and only on the page the table starts on: it is event metadata, not part
    // of the table, so repeating it after a page break would read as a second header.
    function drawSideInfo(topY) {
      const meta = gameState.meta || {};
      const partner = (meta.craftPartner || "").trim();
      const town = (meta.craftPartnerTown || "").trim();
      const x = M + standingsW + 28;
      const w = usableW - standingsW - 28;
      if (w < 90) return; // no room worth using — leave it off rather than crush it
      [
        ["CRAFT PARTNER", partner ? partner + (town ? " \u2014 " + town : "") : "\u2014"],
        ["BONUS ITEM", (meta.bonusItem || "").trim() || "\u2014"],
      ].forEach(([label, value], i) => {
        const fy = topY + i * 40;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText("595959");
        doc.text(label, x, fy);
        doc.setFont("helvetica", "bold");
        fitFs(value, w - 6, 15);
        setText("000000");
        doc.text(value, x, fy + 19, { maxWidth: w - 6 });
      });
    }
    const sideInfoY = y;
    drawStandingsHeader();
    drawSideInfo(sideInfoY);
    let sDataTop = y;
    standings.forEach((s, i) => {
      if (y + rowH > pageBottom) {
        drawGridLines(sDataTop, y, scx, standingsW);
        doc.addPage();
        y = M;
        drawStandingsHeader();
        sDataTop = y;
      }
      const rowVals = {
        place: String(i + 1),
        score: String(s.tAF),
        name: s.name,
        guess: String(s.guess),
        diff: String(s.tAH),
      };
      const sStripe = i % 2 === 1;
      SCOLS.forEach((c, ix) => {
        const base = c.k === "place" ? "DCE6F2" : "FFFFFF";
        setFill(sStripe ? darken(base) : base);
        doc.rect(scx[ix], y, c.w, rowH, "F");
        doc.setFont(
          "helvetica",
          c.k === "place" || c.k === "score" ? "bold" : "normal",
        );
        setText("000000");
        fitFs(rowVals[c.k], c.w - 4, fsData);
        doc.text(
          rowVals[c.k],
          scx[ix] + (c.k === "name" ? 3 : c.w / 2),
          y + rowH - rowH * 0.28,
          { align: c.k === "name" ? "left" : "center", maxWidth: c.w - 6 },
        );
      });
      y += rowH;
    });
    drawGridLines(sDataTop, y, scx, standingsW);
    y += 14;

    // footnote
    if (y + 10 > pageBottom) {
      doc.addPage();
      y = M + 10;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText("8B0000");
    doc.text(
      "* Diff is minus Bonuses — Bonus Item and NJCB points are excluded from the score before comparing it to the team's guess.",
      M,
      y,
    );

    dl(doc.output("blob"), exportFn("pdf"));
    document.getElementById("exportPrompt").classList.add("show");
  } catch (e) {
    appAlert("PDF export failed: " + (e && e.message ? e.message : e));
  }
}

// ---- date formatting (display in app + export) ----
// MM-DD-YYYY everywhere. There used to be a Settings toggle offering DD-Mon-YYYY as well, but
// nobody used it, so the alternate format and its chooser are gone rather than carried forever.
function isoToMDY(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  return p[1].padStart(2, "0") + "-" + p[2].padStart(2, "0") + "-" + p[0];
}
// Native <input type="date"> renders its own text in whatever format the browser/OS locale
// picks (mm/dd/yyyy, dd/mm/yyyy, ...), which reads as inconsistent across hosts' devices. This
// builds a fixed "Aug 15, 2026" string ourselves so Event Details always reads the same
// regardless of locale — overlaid on top of the (still fully functional) native input/picker.
// The month names are inlined here rather than hoisted to a top-level const: a brand-new
// session's very first render runs synchronously at script-parse time (see the round-bonus
// note near the top of this file), before a const declared this far down would be out of its
// temporal dead zone.
function isoToPretty(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = parseInt(p[1], 10) - 1;
  const day = parseInt(p[2], 10);
  if (mi < 0 || mi > 11 || isNaN(mi) || isNaN(day)) return iso;
  return months[mi] + " " + day + ", " + p[0];
}
// Native <input type="date"> always hands back either a valid ISO date or '' (never a
// half-typed/invalid string), so there's no parsing or validation left to do here — the
// browser's own calendar UI and keyboard navigation replace the old hand-rolled text parser.
function setGameDateISO(v) {
  if (!v) return;
  gameState.meta.date = v;
  autosave();
  renderLeft();
}
function sanitizeFile(s) {
  return String(s || "")
    .replace(/'/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function exportFn(ext) {
  const loc = sanitizeFile(gameState.meta.location) || "Trivia";
  const d =
    isoToMDY(gameState.meta.date) || new Date().toISOString().slice(0, 10);
  return loc + " - " + d + "." + ext;
}

// ---- old flat single-sheet XLSX backup (inject into prior template) ----
var TRIVX_R1 = { 1: "E", 2: "F", 3: "G", 4: "H" },
  TRIVX_R2 = { 1: "L", 3: "M", 5: "N", 7: "O" },
  TRIVX_R3 = { 2: "T", 4: "U", 6: "V", 8: "W" },
  TRIVX_R4 = { 3: "AA", 6: "AB", 9: "AC", 12: "AD" };
var TRIVX_WMAPS = [TRIVX_R1, TRIVX_R2, TRIVX_R3, TRIVX_R4],
  TRIVX_BONUS = { 0: "J", 2: "Y" },
  TRIVX_NET = { 1: "Q", 3: "AF" };
function trivXFind(xml, ref) {
  let m = xml.match(new RegExp('<c r="' + ref + '"[^>]*?/>'));
  if (m) return { i: m.index, len: m[0].length, el: m[0] };
  m = xml.match(new RegExp('<c r="' + ref + '"[^>]*?>[\\s\\S]*?</c>'));
  if (m) return { i: m.index, len: m[0].length, el: m[0] };
  return null;
}
function trivXSet(xml, ref, kind, val) {
  const f = trivXFind(xml, ref);
  if (!f) return xml;
  const s = trivStyle(f.el);
  let nw;
  if (kind === "n") nw = '<c r="' + ref + '"' + s + "><v>" + val + "</v></c>";
  else
    nw =
      '<c r="' +
      ref +
      '"' +
      s +
      ' t="inlineStr"><is><t xml:space="preserve">' +
      trivEsc(val) +
      "</t></is></c>";
  return xml.slice(0, f.i) + nw + xml.slice(f.i + f.len);
}
function trivInjectXlsx(templateBytes, gs, rk) {
  const files = fflate.unzipSync(templateBytes);
  const dec = new TextDecoder("utf-8"),
    enc = new TextEncoder();
  let x = dec.decode(files["xl/worksheets/sheet1.xml"]);
  if (gs.meta.hostName) x = trivXSet(x, "I1", "s", "HOST: " + gs.meta.hostName);
  if (gs.meta.location) x = trivXSet(x, "C2", "s", gs.meta.location);
  if (gs.meta.quizId) {
    x = trivXSet(x, "N2", "s", gs.meta.quizId);
    x = trivXSet(x, "AE2", "s", gs.meta.quizId);
  }
  const dtxt = isoToMDY(gs.meta.date);
  if (dtxt) x = trivXSet(x, "G2", "s", dtxt);
  gs.teams.forEach((tm, t) => {
    const r = t + 5;
    if (tm.name) x = trivXSet(x, "B" + r, "s", tm.name);
    const cb = (tm.njcb ? 3 : 0) + (parseInt(tm.adjustment, 10) || 0);
    if (cb !== 0) x = trivXSet(x, "C" + r, "n", cb);
    if (tm.bonusItem) x = trivXSet(x, "D" + r, "n", 5);
    if (tm.scoreGuess !== "" && tm.scoreGuess != null)
      x = trivXSet(x, "AH" + r, "n", parseInt(tm.scoreGuess, 10));
    for (let ri = 0; ri < 4; ri++) {
      const wm = TRIVX_WMAPS[ri],
        qs = gs.rounds[ri].questions;
      for (let qi = 0; qi < 4; qi++) {
        const a = qs[qi][t];
        if (!a || a.wager === undefined) continue;
        const col = wm[a.wager];
        if (!col) continue;
        if (a.correct === true) x = trivXSet(x, col + r, "n", a.wager);
        else if (a.correct === false) x = trivXSet(x, col + r, "n", 0);
      }
      if (ri === 0 || ri === 2) {
        const c = gs.rounds[ri].bonus[t];
        if (c != null) x = trivXSet(x, TRIVX_BONUS[ri] + r, "n", c * 5);
      } else {
        const d = (ri === 1 ? gs.halftime : gs.finalWager)[t];
        if (d && d.wager != null && d.wager !== "" && d.correct != null)
          x = trivXSet(
            x,
            TRIVX_NET[ri] + r,
            "n",
            d.correct ? +d.wager : -d.wager,
          );
      }
    }
  });
  rk.forEach((row, i) => {
    const rr = i + 5;
    x = trivXSet(x, "AL" + rr, "n", row.total);
    x = trivXSet(x, "AM" + rr, "s", row.name);
  });
  files["xl/worksheets/sheet1.xml"] = enc.encode(x);
  let wb = dec.decode(files["xl/workbook.xml"]);
  wb = wb.replace(
    /<calcPr calcId="(\d+)"\/>/,
    '<calcPr calcId="$1" fullCalcOnLoad="1"/>',
  );
  files["xl/workbook.xml"] = enc.encode(wb);
  return fflate.zipSync(files, { level: 6 });
}
function exportXLSXBackup() {
  try {
    if (typeof fflate === "undefined") {
      appAlert("Zip library not loaded \u2014 cannot build XLSX.");
      return;
    }
    if (typeof TRIVIA_XLSX_B64 === "undefined") {
      appAlert("Backup template not embedded.");
      return;
    }
    const bytes = trivB64ToBytes(TRIVIA_XLSX_B64);
    const out = trivInjectXlsx(bytes, gameState, ranked());
    dl(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      exportFn("xlsx"),
    );
    document.getElementById("exportPrompt").classList.add("show");
  } catch (e) {
    appAlert("XLSX backup export failed: " + (e && e.message ? e.message : e));
  }
}

function trivB64ToBytes(b64) {
  const bin = atob(b64),
    len = bin.length,
    u = new Uint8Array(len);
  for (let i = 0; i < len; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function trivEsc(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function trivStyle(el) {
  const m = el.match(/ s="(\d+)"/);
  return m ? ' s="' + m[1] + '"' : "";
}
function fn(ext) {
  return `trivia-${gameState.meta.quizId || "NOID"}-${gameState.meta.date || new Date().toISOString().slice(0, 10)}.${ext}`;
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
document.addEventListener("mousemove", (e) => {
  __lastPointerXY = [e.clientX, e.clientY];
});
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

// DRAG HANDLE
(function () {
  const handle = document.getElementById("dragHandle"),
    sidebar = document.getElementById("sidebar");
  if (!handle || !sidebar) return;
  let dragging = false,
    startX = 0,
    startW = 0;
  function onDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add("dragging");
    document.body.classList.add("col-resizing");
  }
  function onMove(e) {
    if (!dragging) return;
    let x;
    if (e.touches) {
      if (!e.touches[0]) return; // touch already lifted
      e.preventDefault(); // prevent page scroll fighting the drag
      x = e.touches[0].clientX;
    } else {
      // If mouse button was released outside the window, cancel drag
      if (typeof e.buttons !== "undefined" && e.buttons === 0) {
        onUp();
        return;
      }
      x = e.clientX;
    }
    const delta = startX - x;
    const newW = Math.max(
      200,
      Math.min(window.innerWidth * 0.6, startW + delta),
    );
    sidebar.style.width = newW + "px";
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.classList.remove("col-resizing");
    TRStore.setItem("trivRev6_sideW", sidebar.offsetWidth);
  }
  handle.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  handle.addEventListener("touchstart", onDown, { passive: false });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
  document.addEventListener("touchcancel", onUp); // reset if touch interrupted (notification, etc.)
  const saved = TRStore.getItem("trivRev6_sideW");
  if (saved) sidebar.style.width = saved + "px";
})();

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
bindSheetDrag(document.getElementById("mobileScoresPeek"), true, () => {
  if (!document.getElementById("sidebar")?.classList.contains("open"))
    toggleSidebar();
});
bindSheetDrag(document.getElementById("sheetGrabHandle"), false, () => {
  if (document.getElementById("sidebar")?.classList.contains("open"))
    toggleSidebar();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    const o = document.getElementById("auditOverlay");
    if (o && o.classList.contains("show")) closeAudit();
    const sb = document.getElementById("sidebar");
    if (sb && sb.classList.contains("open")) toggleSidebar();
  }
});

// Keyboard support for div/span controls styled as buttons (role="button"): Enter/Space activates them.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest('[role="button"]');
  if (!el) return;
  e.preventDefault();
  el.click();
});

/* If real storage is unavailable (opaque origin, e.g. Chrome opened from file://), warn once.
   The app still works for this session but won't autosave or offer Resume after a reload. */
(function () {
  if (TRStore.persistent) return;
  console.warn(
    "[Scorekeeper] Cross-session storage is unavailable (opaque origin). Autosave/Resume and saved preferences are disabled this session. Open this file over http://localhost (e.g. `python3 -m http.server`) or use Firefox to enable persistence.",
  );
  const n = document.createElement("div");
  n.setAttribute("role", "status");
  n.style.cssText =
    "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:560px;z-index:9999;background:#3a2a00;color:#ffe08a;border:1px solid #7a5a00;border-radius:10px;padding:10px 40px 10px 14px;font:600 12.5px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)";
  n.innerHTML =
    ICON_ALERT +
    ' <b>Autosave is off in this browser.</b> You opened this file directly, so this browser blocks storage. The game works, but it won\u2019t survive a reload. To enable Resume &amp; saved settings, serve it locally (<code style="background:rgba(0,0,0,.3);padding:1px 4px;border-radius:4px">python3 -m http.server</code> then open <code style="background:rgba(0,0,0,.3);padding:1px 4px;border-radius:4px">localhost:8000</code>) or use Firefox.';
  const x = document.createElement("button");
  x.innerHTML = X_ICON_SVG;
  x.setAttribute("aria-label", "Dismiss");
  x.style.cssText =
    "position:absolute;top:6px;right:8px;background:none;border:none;color:#ffe08a;font-size:15px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;padding:0";
  x.onclick = () => n.remove();
  n.appendChild(x);
  window.addEventListener("DOMContentLoaded", () =>
    document.body.appendChild(n),
  );
  if (document.readyState !== "loading") document.body.appendChild(n);
})();

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
  document.querySelectorAll(".qtimer-display").forEach((d) => {
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
  document.querySelectorAll(".qtimer-display").forEach((d) => {
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
setInterval(tickQTimer, 200);
(function initQTimer() {
  const p = loadPrefs();
  qtDurationSec = Math.max(
    QT_MIN_SEC,
    Math.min(QT_MAX_SEC, p.qtDurationSec || QT_DEFAULT_SEC),
  );
  const sel = document.getElementById("qtDurationSelect");
  if (sel) sel.value = qtDurationSec;
  qtSetDisplayText(fmtQt(qtDurationSec));
  renderQtControls();
})();

// Register the service worker so the app keeps working with no signal after it's been opened once.
// Requires http(s)/localhost — silently no-ops under file:// same as the storage warning above.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Sync the Settings controls to the saved prefs once on load. applyPrefs had only ever been
// reached through renderAll(), so before the first render every control in the panel still showed
// the default baked into index.html — Row Density reading "Normal" while set to compact, Timer
// Pulse reading "Shown" while switched off, and the crossfade slider sitting at 1.2s whatever it
// had been dragged to. The values were saved correctly the whole time; only the panel was stale.
// The IIFE near the top of this file handles the root-element attributes early to avoid a flash;
// this handles the panel's own widgets, which need the DOM to exist.
if (document.readyState === "loading")
  window.addEventListener("DOMContentLoaded", () => applyPrefs());
else applyPrefs();

// Mark this page's audio as mixable before anything can play. Deliberately at load and not inside
// the drumroll tap: it has to be in force ahead of the first play to have any effect, and unlike
// building or priming an audio element it takes nothing from the device's audio session.
useAmbientAudioSession();
