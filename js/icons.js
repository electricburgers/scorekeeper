"use strict";

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
// Red shell as a SOLID fill (not the 38% .icon-tinted wash) with a cream drumhead on top and
// three full-height vertical tension rods laced down the shell — the 🥁 emoji's own red-body /
// pale-top / laced-side look. The rods are drawn BEFORE the head so the cream oval covers their
// tops and they only show on the shell side. .dr-shell / .dr-rod styled in styles.css; the head
// reuses .icon-beer's cream-cap trick.
const ICON_DRUM_PICT =
  '<svg class="icon-ui icon-tinted icon-drum" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="dr-shell" d="M2 9v8a10 5 0 0 0 20 0V9"/><path class="ip-3 dr-rod" d="M6 9.4v8.1M12 9.8v8.8M18 9.4v8.1"/><ellipse class="ip-2" cx="12" cy="9" rx="10" ry="5"/><path class="ip-3" d="m2 2 6 6"/><path class="ip-3" d="m22 2-6 6"/></svg>';
const ICON_TROPHY_PICT =
  '<svg class="icon-ui icon-tinted icon-trophy" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path class="ip-2" d="M4 22h16"/><path class="ip-2" d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path class="ip-2" d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
// The Craft Prize "Test Sounds" bar's Crash / Horn buttons — drawn glyphs replacing the bare
// 💥 / 🎺 emoji, shaped and tinted to echo them so they still read at a glance and follow the
// app's theme + Icon Style. (Roll reuses ICON_DRUM, Fade reuses ICON_STOP — both already
// drawn.) Emoji mode restores 💥 / 🎺.
//   Crash 💥 → a solid, sharp eight-point jagged burst with a bright-yellow eight-point core star
//              sitting well inside it (r~7 of the 24 box, so the burst's red-orange points still
//              show past it), echoing the emoji's saturated orange-edge / yellow-centre look —
//              --tint-drum red-orange + --vivid-beer yellow, both AA-audited both themes.
//   Horn  📢 → a loudspeaker/bullhorn: a small mouthpiece, a wide flaring cone, and two sound
//              waves — tinted silver (--tint-mic, AA-audited both themes) to match 📢.
const ICON_SND_CRASH_PICT =
  '<svg class="icon-ui icon-tinted icon-snd-crash" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="snd-burst" d="M12 .5 14.96 10.78 20.1 3.9 14.96 13.22 23.5 12 13.22 14.96 20.1 20.1 10.78 14.96 12 23.5 9.04 13.22 3.9 20.1 9.04 10.78 .5 12 10.78 9.04 3.9 3.9 13.22 9.04Z"/><path class="ip-2" d="M19 12 14.77 13.15 16.95 16.95 13.15 14.77 12 19 10.85 14.77 7.05 16.95 9.23 13.15 5 12 9.23 10.85 7.05 7.05 10.85 9.23 12 5 13.15 9.23 16.95 7.05 14.77 10.85Z"/></svg>';
const ICON_SND_HORN_PICT =
  '<svg class="icon-ui icon-tinted icon-snd-horn" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="snd-body" d="M2 10h2v4H2z"/><path class="snd-body" d="M4 8 15 3.6v16.8L4 16z"/><path class="ip-2" d="M17.7 8.4a4.6 4.6 0 0 1 0 7.2"/><path class="ip-2" d="M20.2 6.2a8.4 8.4 0 0 1 0 11.6" opacity=".5"/></svg>';
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
// JD Upload Form's own icon — a Guy Fawkes mask, drawn straight from the app's own PWA /
// home-screen icon (icons/icon-source.svg): the flat-topped plate tapering to a rounded chin
// point, the handlebar mustache, the narrow goatee below it — the same three shapes, at the
// same 24-unit scale that source is authored in. Tinted purple (--tint-flask, freed up when
// the flask icon moved to green) so it echoes that icon's purple badge. The mustache and
// goatee are SOLID FILLS with no stroke of their own (.icon-fawkes .ip-2 in styles.css) —
// stroking them too, at .icon-ui's 2.25 width, closed the thin gap between them into one blob
// at button/mobile size. The plate keeps a thin (1.4) outline. 🎭 as the Emoji-mode glyph.
const ICON_FAWKES_PICT =
  '<svg class="icon-ui icon-tinted icon-fawkes" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4.2H16C19.2 4.2 20 8.2 20 11.4 20 16.6 15.6 21.8 12 21.8 8.4 21.8 4 16.6 4 11.4 4 8.2 4.8 4.2 8 4.2Z"/><path class="ip-2" d="M12 13.1c-.5-.9-1.6-1.3-2.6-.9-1.6.6-2.2 2.3-3.6 2.6-1 .2-1.9-.3-2.3-1.1-.3.9.1 2 1.1 2.5 1.7.8 3.5-.2 4.6-1.4.5-.6 1.1-1.1 1.8-1.4v-.3Zm0 0c.5-.9 1.6-1.3 2.6-.9 1.6.6 2.2 2.3 3.6 2.6 1 .2 1.9-.3 2.3-1.1.3.9-.1 2-1.1 2.5-1.7.8-3.5-.2-4.6-1.4-.5-.6-1.1-1.1-1.8-1.4v-.3Z"/><path class="ip-2" d="M10.1 16.6c.4 2.5 1 4.6 1.9 6.1.9-1.5 1.5-3.6 1.9-6.1-.8.4-1.3.8-1.9 1.7-.6-.9-1.1-1.3-1.9-1.7Z"/></svg>';
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
const ICON_FAWKES_EMOJI = '<span class="icon-emoji">🎭</span>';
const ICON_SND_CRASH_EMOJI = '<span class="icon-emoji">💥</span>';
const ICON_SND_HORN_EMOJI = '<span class="icon-emoji">📢</span>';
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
let ICON_FAWKES = ICON_FAWKES_PICT;
let ICON_SND_CRASH = ICON_SND_CRASH_PICT;
let ICON_SND_HORN = ICON_SND_HORN_PICT;
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
  { sel: 'button[onclick="startTutorial()"]', emoji: '<span class="icon-emoji">👋</span>', label: " Take the Tour" },
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
  ICON_FAWKES = emoji ? ICON_FAWKES_EMOJI : ICON_FAWKES_PICT;
  ICON_SND_CRASH = emoji ? ICON_SND_CRASH_EMOJI : ICON_SND_CRASH_PICT;
  ICON_SND_HORN = emoji ? ICON_SND_HORN_EMOJI : ICON_SND_HORN_PICT;
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