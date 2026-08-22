# Changelog

All notable changes to Scorekeeper are documented here, newest first. Versions
match the in-app "Scorekeeper vX.X" label (Settings panel). Reconstructed from
git history — dates are commit dates, and entries bundle the commits that
landed between one version bump and the next.

## v18.93 - 2026-08-22
- **Timer Stepper Buttons and Timer Pulse only show up in Advanced Settings once Timer Widget is
  turned on**, same reasoning and same pattern as Drumroll Crossfade needing Manual Drumroll
  Control on last version: both configure the timer widget itself (whether it shows -30/+30
  nudges, whether it flashes), so neither means anything with the widget off.

## v18.92 - 2026-08-22
- **Team Report's "incorrect" lines now use ❌ in Emoji mode, not ⛔** — the wager/bonus/per-question
  incorrect badges and stats elsewhere keep ⛔ unchanged; only Team Report's own three call sites
  split off into their own `ICON_AUDIT_WRONG`, same Pictograph-mode drawing as `ICON_INCORRECT`.
- **The Drumroll Crossfade slider only shows up in Advanced Settings once Manual Drumroll Control
  is turned on.** It sets the fade-out length for the Stop Drumroll button, which doesn't exist
  until manual control does — so the row now stays hidden rather than configuring a feature that
  isn't active yet, and appears the moment the toggle above it is switched on.

## v18.91 - 2026-08-22
- **The four Settings pictographs that were still plain monochrome now have colour**: App
  Preferences' Save (blue, silver window/label) and Load (gold folder), and Craft Prize Eligible
  List's Copy (the same tan/silver `ICON_CLIPBOARD` already drawn elsewhere, just missing its own
  classes) and TXT (silver page). All four reuse tint tokens this app already has audited
  (`--tint-cap`, `--accent-gold`, `--tint-clipboard`, `--tint-mic`) rather than inventing new ones.
- **Try Example's flask is green with a silver neck, matching the 🧪 emoji it stands in for**,
  reversed from its original "arbitrary purple, picked only to look distinct" choice. Reuses
  `--tint-sheet` (XLSX's own green) and `--tint-mic` (the mic's silver) rather than new colors.

## v18.90 - 2026-08-22
- **The R2/R4 bonus wager's "Mark incorrect" button now uses ✖️ for its own icon in Emoji mode,
  not ⛔.** Selecting it still overlays a ⛔ `wager-badge` right on top — that's the actual
  "this one's wrong" signal — which was showing the same ⛔ twice, stacked, the mirror image of
  the ☑️/✅ split `ICON_MARK_CORRECT` already fixed on the correct side. Split out the same way:
  new `ICON_MARK_INCORRECT` (✖️) for the button's own icon, `ICON_INCORRECT` (⛔) stays the badge.
- **Four Settings buttons weren't swapping to emoji at all**: App Preferences' Save/Load and Craft
  Prize Eligible List's Copy/TXT were never added to `STATIC_ICON_TARGETS`, so Icon Style's Emoji
  mode silently skipped them while every other icon-bearing button in Settings swapped correctly.
  Added all four (💾/📂/📋/📄).
- **The "Scores — Before Halftime/Final Wager" Entry button's active state was still the dull
  mustard yellow** the title itself was fixed to avoid last version — its background is a
  separate CSS rule that also reads `--badge-gold-fg`, missed in that pass. Same light-mode-only
  fix, same teal.

## v18.89 - 2026-08-22
- **Audited every emoji sitting alone inside its own container** (the close-X circles, remove-team,
  Team Report's ✅/⛔ lines, and the rest) — everything but one was already correctly centered.
  The exception: the per-question wager's incorrect (⛔) badge, which was reading a fixed
  `margin-top` tuned for the old, smaller emoji size rather than being centered by the flex box
  around it. **Then corrected further per follow-up feedback**: the badge's own red circle stays
  the shared size every badge uses — only the glyph inside it grows, up to ~90% fill (matching how
  full the correct badge's own ✅ already sits), leaving a thin ring of the badge's own red visible
  around it. That ring matters for colour vision specifically: the badge's red is one of this
  app's audited color-vision tokens; the ⛔ glyph itself is a fixed-palette platform emoji no CSS
  token can retint, so the ring is the one part of this badge every color-vision mode can still
  actually adjust.
- **The drawn beer mug's handle is taller.** Was a plain circular arc (equal width and height);
  now an ellipse — same horizontal reach as before, noticeably more vertical, reading like an
  actual mug handle instead of a stub. Updated everywhere the mug is drawn: the app's own
  `ICON_BEER_PICT`, the Icon Style swatch, and both FAQ occurrences.
- **The Scores sidebar's Asc/Desc sort controls, and their "Lowest to highest"/"Highest to lowest"
  descriptions, now use ⬆️/⬇️ in Emoji mode** (a matching drawn up/down arrow pair in Pictograph
  mode) instead of a bare ↑/↓ Unicode glyph that ignored Icon Style entirely.
- **The horizontal lines separating team rows in Teams now clear WCAG 1.4.11's 3:1 contrast
  floor.** They were using the plain `--border` token (~2.2:1 in light mode, ~1.4:1 in dark —
  failing in both), switched to `--border-control`, the token this app already maintains
  specifically to clear 3:1 on every surface a control sits on, rather than inventing a new color
  for just this one divider.
- **"Done" (round/question completion badges, and the mini-progress banner at 100%) now uses ✔️ in
  Emoji mode, not ✅.** Every OTHER ✅ in the app (Team Report lines, "looks good", "Copied", the
  correct/incorrect stat pills) is unchanged — only completion-marking specifically split off into
  its own `ICON_DONE`, the same way `ICON_MARK_CORRECT` split off before it for an equivalent
  one-glyph-two-meanings reason.
- **"Scores — Before Halftime/Final Wager" no longer renders as a dull mustard yellow in light
  mode.** That heading used the shared gold text token, which has to stay dark enough on white to
  hold 4.5:1 (#845e00) — visibly duller than dark theme's own vivid gold, which never has this
  problem and is untouched. Light mode only, switched to the same teal already used one line down
  for the standings themselves, which reads at 5.6:1 against this block's background.

## v18.88 - 2026-08-22
- **Advanced Settings reordered once more**: Row Density, Row Zebra Stripes, and Craft Prize
  Eligible List now lead the group, Point Adjustments moved to the very end.
- **Icon Style's own swatch is now a beer mug, not a checkmark.** A checkmark looks nearly
  identical in both Pictograph and Emoji mode, so it didn't actually show what the choice does; the
  drawn mug and 🍺 read as visibly different drawings of the same thing, and it's this app's own
  mascot icon besides.
- **The Settings panel's close X was too small in Emoji mode.** It rendered as a bare "✕" at the
  button's own small text size, thinner and smaller than the drawn pictograph X it replaced.
  Wrapped in `.icon-emoji` and given its own font-size bump so it reads as a proper X inside its
  circle instead of a faint sliver.
- **The remove-team X was too big in Emoji mode**, the opposite problem: the full-colour ❌ glyph
  at that button's small 1.6rem circle read visibly bulkier than the thin pictograph X it replaced.
  Scaled back down to match.

## v18.87 - 2026-08-22
- **The mobile docked timer's display and buttons are a notch smaller than v18.83 shipped them.**
  Display font-size 2.1rem → 1.85rem, toggle/reset/step buttons 2.75rem → 2.4rem — still bigger
  than the pre-v18.83 originals (1.3rem/2rem), just not as large as that first pass. The dock and
  row height stay exactly as frozen as before; shrinking the controls only freed more room under
  that same ceiling, nothing to re-derive.
- **Regular Settings and Advanced Settings shuffled once more.** App Preferences moved out of
  Advanced into the regular list (last, before the Advanced Settings toggle) — it's a meta setting,
  but not one that needs to hide behind "Advanced." Row Density and Row Zebra Stripes moved the
  other way, from regular into Advanced (last two rows), freeing the regular list down to the
  settings most hosts actually touch mid-event.
- **"Crowd-Wisdom Percentage Tags" is now just "Crowd-Wisdom Percentage."** Updated in Advanced
  Settings, the matching FAQ entry title, and the two app.js comments that named it.
- **Icon Style's own choice now previews itself, the same way Color Vision's swatch does.** The
  Pictograph/Emoji button carries a small checkmark next to the word — the drawn `CHECK_ICON_SVG`
  in Pictograph mode, the ✅ emoji in Emoji mode — so the choice shows what it actually looks like
  instead of naming itself in the abstract.
- **Saved App Preferences files are named after the host, when one's entered.** `savePrefsToFile()`
  used to always save as "Scorekeeper Preferences.json" no matter whose settings they were; it now
  prefixes the host's name (sanitized the same way exportFn's game filenames are) — "Guy Fawkes -
  Scorekeeper Preferences.json" — so a host who keeps their own prefs file can tell it apart from
  someone else's at a glance. Falls back to the plain name when Host Name is blank.

## v18.86 - 2026-08-22
- **"Per-Question Percentage Correct Labels" is now "Crowd-Wisdom Percentage Tags."** Renamed in
  Advanced Settings and in the matching FAQ entry title, plus the two code comments in app.js that
  named the old setting by string. No behavior change — same toggle, same `qResultToggle` pref key.

## v18.85 - 2026-08-22
- **Advanced Settings rows lost the icons v18.84 just gave them.** Ten rows each carrying their own
  small pictograph/emoji pair, on top of the buttons and range slider each row already had, read as
  clutter rather than help — the reorganized grouping from v18.84 was doing the actual work of
  making the list easier to scan, and the icons were competing with it rather than adding to it.
  Removed the SVGs, the row ids that existed only to target them, and their `STATIC_ICON_TARGETS`
  entries (app.js); every Advanced Settings row is back to a plain text label, same grouped order
  as v18.84.

## v18.84 - 2026-08-22
- **Settings and Advanced Settings are grouped by what a user actually comes here to do, instead of
  the order each row happened to ship in.** Regular settings now read Theme → Size → Icon Style →
  Color Vision → Row Density → Row Zebra Stripes (appearance, most-impactful first) → Question Timer
  (the one gameplay setting) → Sample Data → Help (onboarding/reference, last). Advanced Settings now
  reads Point Adjustments → Per-Question Percentage Correct Labels → Edit Locked Fields (scoring/
  editing) → Timer Widget → Timer Stepper Buttons → Timer Pulse (the timer's three toggles, together)
  → Manual Drumroll Control → Drumroll Crossfade → Craft Prize Eligible List (the craft-prize cluster,
  together) → App Preferences (a meta setting that backs up all the others, so it goes after them).
  Every Advanced Settings row also gets a small icon now — a drawn pictograph by default, swapped for
  a matching emoji by the Icon Style toggle above it, the same STATIC_ICON_TARGETS mechanism Try
  Example/Take the Tour/FAQ already used — closing the one place in Settings that had no icons at
  all while every other row already did.

## v18.83 - 2026-08-22
- **The mobile docked timer's display and buttons are bigger, without the dock itself growing a
  single pixel.** A first pass at this grew `.qtimer-mobile`'s own padding to make room, which grew
  `.mobile-bottom-dock`'s measured height right along with it and ate into the game content above
  — not what was asked. This version instead trims that row's padding (8px → 4px) and the display's
  own padding (5px → 3px) to free up exactly the room the bigger sizes need: display font-size
  1.3rem → 2.1rem, and the toggle/reset/step buttons' `2rem` floor → `2.75rem`. Verified against the
  pre-change build pixel for pixel: `.mobile-bottom-dock` height and `.qtimer-mobile` row height are
  both unchanged (103.5px / 54.5px), while the display, toggle, reset, and stepper buttons all
  measure visibly larger inside that same frame.

## v18.82 - 2026-08-22
- **PDF export could open a new tab showing the PDF instead of just downloading it.** `dl()` (the
  shared helper behind PDF, XLSX, and the craft-eligible TXT export) set `target="_blank"`
  unconditionally on the downloading link. Chrome and every other Chromium browser already honor
  the `download` attribute on their own — the file saves in place, no navigation happens, target
  is irrelevant — but pairing THAT with `target="_blank"` on a PDF blob specifically can make
  Chrome's own built-in PDF viewer win the race and open the file in a new tab instead of
  triggering the download it would have done unprompted, which is exactly the jarring "navigates
  away from the app" jump this was doing. `target="_blank"` was only ever needed for one browser
  — iOS Safari is the one that doesn't honor `download` at all, navigating the current tab
  straight to the blob URL instead (reloading the whole page and wiping in-memory state — mid
  Tutorial Mode, that meant the practice game vanishing) — and it's now scoped to just that
  platform, checked directly rather than feature-detected, since nothing distinguishes "actually
  honors download" from "iOS Safari, which claims to but doesn't." Verified: exporting PDF and
  XLSX on desktop Chrome now opens zero new tabs, where PDF previously opened one.

## v18.81 - 2026-08-22
- **The Halftime/Final Wager "Mark correct" button no longer shows the same ✅ twice.** Selecting
  it overlays a green `CORRECT_BADGE_SVG` badge — the actual "this is the winning call" signal —
  right on top of the button's own icon, and in Icon Style's Emoji mode both were ✅, so a selected
  button showed two identical green checks stacked on each other. The badge keeps ✅. The button's
  own icon is `ICON_MARK_CORRECT` now, a separate reassignable pair from the shared `CHECK_ICON_SVG`
  (which stays ✅ everywhere else — Done badges, "looks good", the rest), picked as ☑️ over ✔️ for
  where this button's background actually swings: `.correct-sel`'s fill runs from near-black in
  dark theme to bright light green in light theme (color-vision modes push it further still), and
  ✔️ renders as a bare dark tick with no background of its own — legible on the light end, nearly
  invisible on the dark one. ☑️ carries its own light box baked into the glyph, so it reads at
  both ends without needing per-theme tuning.

## v18.80 - 2026-08-22
- **The timer's critical-time pulse no longer shows a grey halo in light mode.** It animated
  `filter:brightness()`, which forces the element onto its own compositing layer for as long as
  the animation runs — including at the 0%/100% keyframes where the computed value is a no-op —
  and that layer's own edge antialiasing traced a faint grey fringe around the box wherever it sat
  against a light page. Invisible in dark mode, where the surroundings are already dark enough to
  hide it; in light mode it read as a dark film sitting on top of the timer rather than the timer
  itself pulsing. Replaced with an animated inset `box-shadow` (a huge zero-blur spread, filled
  with the box's own radius) — a normal paint operation with no such layer. `rgba(0,0,0,.25)` over
  the fill is the exact arithmetic equivalent of the old `brightness(.75)` (both just scale the
  original color by .75), so the pulse looks identical in dark mode and everywhere else this
  wasn't visible before.
- **Crossing 0:00 now finishes the pulse in a fixed, fast .35s instead of however much of a 2.9s
  beat happened to be left.** The previous fix for the old snap-to-full-brightness bug re-declared
  the same `qtFlash` animation on the settling state and let it run out its own cycle, which could
  take most of 3 seconds after the round was already over — correct, but slow for the one moment a
  host is most likely watching the number. `qtSetDisplayClass` now freezes whatever the pulse was
  actually showing at the instant of crossing as an inline `box-shadow`, then lets a plain CSS
  transition (`.qt-settle-fast`, unrelated to `qtFlash`'s own timing) carry it down to nothing —
  always the same short duration regardless of how dark that frozen instant was, and still smooth
  since a transition, unlike a fresh animation, always interpolates from whatever's actually on
  screen rather than restarting from a keyframe's fixed value.

## v18.79 - 2026-08-22
- **Icon Style's emoji are properly centered now.** `.icon-emoji` never set its own `line-height`,
  so it inherited whatever the surrounding button had (usually the browser default ~1.15-1.2x) —
  flex `align-items:center` centers that whole taller line-box, not the glyph's own visual weight
  inside it, so every icon-only button (the settings gear, the round X buttons, Shuffle) had a
  glyph riding slightly off the true center of its box. `line-height:1` on `.icon-emoji` closes
  most of that gap on its own. The one that needed more: the incorrect wager badge's ⛔ — measured
  against a 10x-scaled render, its white bar sat noticeably above center, because the badge's own
  `padding-bottom:1px` was tuned for the old SVG line icon's proportions, not this glyph's. Scoped
  to `.wager-badge.bg-incorrect .icon-emoji` only (✅ on the correct badge already sat centered
  without help): padding-bottom back to 0, replaced with a margin-top and a slight scale-down
  measured to land the bar dead center without poking past the badge's own circular edge.

## v18.78 - 2026-08-22
- **Shuffling the Before Halftime/Final Wager standings could scroll the page**, since the click
  anchor renderLeft() uses to pin the view in place (see the big comment on `lastClickAnchorSel`)
  only matched `[data-ta]`, `[data-ti]`, `.question-block`, `.special-section`, or the broad
  `.section` catch-all — a click inside `.standings-block` fell through to that catch-all and
  anchored on the ENTIRE enclosing round section instead of the standings block itself, which is
  the wrong granularity for something re-rendering a small part of a much bigger section.
  `.standings-block` now anchors to itself, the same "anchor the specific thing that was actually
  clicked, not everything around it" rule every other interactive element here already gets.

## v18.77 - 2026-08-22
- **Icon Style's emoji were rendering visibly smaller than the pictographs they replaced** in
  every button that gave its icon extra room on purpose — the Scores panel's Shuffle button most
  noticeably, but the same gap applied to every `.sort-btn`, `.standings-sort-btn`,
  `.q-sort-btn`/`.q-reset-btn`, the timer's reset button, and Banter's refresh button. Each of
  those boosts its `.icon-ui` svg past the shared 1em baseline (1.1-1.32em, tuned per button); a
  bare emoji character has no width/height for that boost to apply to, so in Emoji mode it fell
  straight back to the button's own small font-size. Every `*_EMOJI` string is wrapped in
  `<span class="icon-emoji">` now, and each of those five contexts gets a matching
  `transform:scale()` mirroring its `.icon-ui` ratio exactly — `transform`, not `font-size`, so
  the glyph reads bigger without growing the button's own padded box around it. Left unboosted
  (and unproblematic) everywhere else, e.g. `.wager-badge`'s own font-size already sized an emoji
  there proportionately.
- **The small correct/incorrect badges are Icon Style-aware now too.** `CORRECT_BADGE_SVG` was
  the one icon deliberately left out of the original sweep — colored square background baked into
  the SVG's own `<rect>`, "opaque and theme-independent" by design — but its own header comment
  says outright it replaced a ✅ emoji originally, which makes it exactly the kind of icon Icon
  Style exists to bring back. `CORRECT_BADGE_SVG` is a `let` now, defaulting to the same picture
  and swapping to ✅ in Emoji mode, same pattern as everything else.

## v18.76 - 2026-08-22
- **Three more Icon Style emoji picks, all by request.** Reset (per-question Sort/Reset, and the
  standings/scores Reset buttons) is ↩️ now, not ↺. Correct stays ✅ — already the case, just
  confirmed.
- **"Marking a question incorrect" splits off its own emoji, ⛔, from the generic X.** X_ICON_SVG
  was one shared mark for every "dismiss" meaning in the app AND for "wrong answer" — remove
  team, close Team Report, clear the craft prize winner, dismiss the autosave-off notice, *and*
  every incorrect wager/bonus/special-wager badge, the Mark Incorrect button, the per-question
  incorrect stat, Team Report's incorrect lines. Fine in pictograph mode, where the same drawn X
  reads as either depending on context; wrong in emoji mode, where ⛔ reading as "wrong answer"
  would also paint every close/remove/dismiss button in the app with a no-entry sign. New
  `ICON_INCORRECT` is the exact same SVG picture as `X_ICON_SVG` — nothing changes in pictograph
  mode — with its own `⛔` emoji, and only the incorrect-marking call sites use it; every
  dismiss/remove/close use stays on `X_ICON_SVG` (❌).

## v18.75 - 2026-08-22
- **Icon Style's Shuffle emoji is 🔀, not 🎲.** At the sizes Sort/Reset/Shuffle actually render —
  the sort-controls row, the standings sort buttons — a die reads as an ambiguous blob where the
  crossed arrows keep reading as "shuffle" at a glance. `ICON_SHUFFLE_EMOJI`/
  `ICON_SHUFFLE_TINTED_EMOJI` both change; nothing else about the toggle does.

## v18.74 - 2026-08-22
- **The FAQ moved into this repo.** It used to live at `electricburgers/scorekeeper-faq`, a
  separate git repo checked out at `faq/scorekeeper-faq/` and excluded here so the two repos'
  histories never collided. It's now `faq/`, tracked like every other file, with its own nested
  `.git` removed and its byte-for-byte copy of `css/styles.css` replaced with a link straight to
  `../css/styles.css` — the two pages can no longer drift apart the way that copy already had.
  Settings > Help now opens `faq/index.html` locally instead of the old GitHub Pages URL.
- **The right-hand Scores header's chevron is gone on desktop.** It called `toggleSidebar()`,
  which toggles `.col-right`'s `open` class — a class that only repositions anything inside the
  mobile bottom-sheet media query. On a wide viewport `.col-right` is a static column, so every
  click rotated the arrow 180deg for no reason at all: the one piece of the app that looked
  interactive and did nothing. Same fix already applied to the standings chevron in a past
  version; this is the other half — and that same standings chevron gets its own arrow BACK on
  desktop here, since unlike the Scores header it does do something (collapses the block) and
  hiding it there was removing a working affordance, not a dead one.
- **Fixed a real, if intermittent, "I can still scroll past the bottom" bug**, on top of the
  desktop layout-height fix from a few versions back. `--layout-top`'s sync() ran once,
  synchronously, at script-parse time — before Inter has necessarily swapped in over its
  font-display:swap fallback. On the loads where the Resume banner's one sentence wraps a
  different number of lines under the fallback font than under Inter, that first measurement can
  undershoot the panel's real top edge, which makes `.app-layout` (`height:calc(100vh -
  var(--layout-top))`) render a few pixels TALLER than the viewport actually has room for — and
  nothing else ever re-measures it, since neither `.header` nor `#resumeBanner`'s own box size
  changes again afterward. `document.fonts.ready` (plus a `load` listener, belt-and-braces) now
  forces one more sync() once every font has actually swapped in, closing the gap regardless of
  which element's resize the ResizeObserver missed.
- **Try Example and Take the Tour get their own pictograph colors** — a violet flask and a blue
  graduation cap, the same `.icon-tinted` treatment every emoji-replacement pictograph already
  gets, on two icons that had been left as plain `.icon-ui` outlines since they were drawn.
- **Color Vision shows its swatches next to the dropdown even closed.** The two colors a mode
  swaps to were only ever visible inside the open menu; the closed button now mirrors the
  selected option's own swatch pair next to its label, so the picked mode's colors are visible at
  a glance. "Off" has no swatch pair, so the button shows none for it, same as the menu always
  has.
- **"Shuffled order" gets the same tinted-pictograph treatment "Entry order" already had** — a
  magenta shuffle icon ahead of the label in the Scores panel, sized and colored the same way
  `ICON_CLIPBOARD` sits ahead of "Entry order" a few lines below it. The Shuffle sort BUTTON's own
  icon is untouched: it's a control, and every action glyph in this file takes the control's own
  audited text color rather than a color of its own, which is exactly why this needed its own
  separate, tinted copy rather than reusing that one.
- **New Settings row: Icon Style, Pictograph/Emoji.** Every `ICON_*` pictograph in the app —
  Sort, Reset, Refresh, Shuffle, the check and X marks, Beer, Drum, Trophy, Mic, Heart, Clipboard,
  Flag, PDF, Link, Trash, Play Horn, Stop, the spreadsheet icon, the alert triangle, the theme
  toggle's sun and moon — is a reassignable `let` now rather than a `const`, holding either its
  drawn-SVG value or the literal emoji it replaced (chosen from this changelog's own record of
  what each one used to be, where that's on record — Sort/Reset/Refresh/Shuffle replaced ↕ / ↺ /
  🔄 / 🎲, Play Horn replaced the 🎉 popper). Flipping the setting reassigns all of them and
  re-renders, so every already-drawn Sort button, badge, and pictograph in the current game
  updates in place; a handful of pictographs that live as one-off static markup in `index.html`
  rather than as an `ICON_*` string (the settings gear, header Save/Load, the FAQ link, the two
  Sample Data icons, the settings panel's round X) are swapped the same way through a small
  element-keyed table instead. Purely opt-in nostalgia — every one of these was redrawn as an SVG
  specifically to escape a fixed-color platform glyph the app's theme and color-vision tokens
  couldn't reach, and this setting knowingly gives that back.

## v18.73 - 2026-08-22
- **Every Q5 pictograph is gone** — Round 1's four squares, Round 2's poker chip, Round 3's horseshoe and Round 4's chip stack, the last two of which were only drawn in v18.71. Each sat beside a label that already said what the block was ("BONUS (0-4 x 5)", "BONUS WAGER (1-20)"), and four different marks across four Q5s implied a distinction between them that does not exist. The four `ICON_*` constants, their `.icon-*` rules, their `--tint-horseshoe` / `--tint-chips` tokens in both themes, and the `.sq-fill` / `.chip-spot` fill rules are all removed rather than left unreferenced. The round colour classes stay — the Q5 label still reads cyan in Round 1 and gold in Round 3.
- **Round 4's Q5 Beer Round is no longer the most golden thing in the app.** `.special-section` is one padded box with no separate header surface, so a Beer Round painted the title row, the badge row and the whole body in `--beer-bg` together. Round 3's Q5 is the *same* gold but reads as far less of it, because `.question-block` gives its header an opaque `--bg-input` fill and only the body below goes gold. The special sections now get that same split, which is what makes them match: measured, Round 4's header band and Round 3's are the identical colour in both themes.
- Negative margins on the band, because `.special-section` carries 12px of padding that `.question-block` does not — it has to reach back out to the section's inner edge to be a band at all. Its radius is the section's own 12px less its 2px border, so the corners sit inside the border rather than crossing it; collapsed, where there is no body under it, it takes the full inner radius and pulls the leftover strip of padding out from under itself too.
- **Play Horn takes a plain play triangle**, replacing the party popper that landed in v18.72 one version ago. It is a transport control rather than a picture of anything, which is also what the button is: it plays a sound, and it sits directly beside Stop Drumroll. No frame around it — the button already has a border and a label, so a square drawn inside it would be a second button drawn inside the first.
- That means no `.icon-tinted` and no colour of its own: it takes `currentColor` like every other UI action glyph in the file (Sort, Reset, Refresh, Shuffle, Stop), which on this button resolves to `--on-accent-cyan`, already audited against the accent fill it sits on in all six theme x colour-vision combinations. The four blocks of `--tint-horn` / `--vivid-horn` tokens v18.72 added for the popper, including their blue-yellow swap, go with it rather than being left unreferenced.
- The triangle is filled *and* keeps `.icon-ui`'s inherited stroke. The fill is what stops it reading as a hollow arrow at this size; the stroke is what rounds its three corners, via the `stroke-linejoin:round` the rest of the icon family is drawn with. Its centroid lands at x=12.0 — the usual optical nudge that stops a play triangle looking as though it has slid left inside its own box.

## v18.72 - 2026-08-22
- **The desktop layout stops scrolling into a strip of nothing.** `.app-layout` sized itself as `100vh - 60px`, where 60px was a guess at the height of everything above it. That guess was wrong in both directions: too small whenever the sticky header ran taller than 60px (it is 47px at the default text size but 70px at the 30px setting) or the Resume banner was in flow above it (~91px more), which pushed the panel's bottom edge past the viewport and made the **document itself** scrollable by the difference — up to 89px of blank background under the layout, with nothing rendered in it; and too large whenever they were shorter, leaving a dead strip the columns could have used.
- It now subtracts `--layout-top`, the panel's real distance from the top of the viewport, kept in sync by a ResizeObserver on the header and the Resume banner (the same pattern `--header-h`, `--mini-progress-h` and `--mobile-dock-h` already use). One measurement of where the panel starts, not a sum of the parts above it, so it stays right for anything ever added up there. Verified across seven combinations of banner shown/hidden and 12/15/22/30px text: the panel's bottom edge lands exactly on the viewport bottom in every one, and the document's scrollable extent is **0px** in all of them, against 89px and 166px before.
- **Fixes the mini progress bar vanishing when you click it**, which was the same bug seen from the other end. The bar is `position:sticky` inside the left column, so it cannot leave the top of that column — but `scrollIntoView` scrolls *every* scrollable ancestor, and while the document had that extra scrollable strip, the jump took it too and carried the whole layout, bar included, up off the top of the screen. Only scrolling the window back to the top brought it back. With the document no longer scrollable there is nothing for the jump to take.
- Removed the pulsing ring that used to ring whatever the progress bar jumped to. It beat twice over 4.4 seconds, which meant it was still going well after you had started reading the row it pointed at, and the smooth scroll already shows where the jump landed — you watch it arrive.
- **Light mode's sun is a sun again.** It was borrowing `--badge-gold-fg`, which is a *text* colour held to 4.5:1 on the darkest surface it ever lands on; in light mode that ceiling drags it to #845e00, a dark olive-brown. The disc and the rays are now separate tokens, which is what buys the yellow back: the disc is a filled area that only has to be seen, so it takes a genuinely vivid #ffc400 (**+66% chroma**, OKLCh L .850 against .508), while the rays and the ring drawn around the disc are the thin marks that carry the shape and take a deeper amber that clears 3:1 on every surface the button takes, hover included (+33% chroma on the old value). Both parts swap to magenta in blue-yellow mode, which the old single-token wiring got for free and the split pair now does deliberately.
- **Team names in the question rows are vertically centred at any length.** Some sat centred and some sat hard against the top of the row, and which one you got depended on the name. The cause was the hover magnifier: an always-in-layout inline box about 22px wide, so any name landing within that distance of the 11rem column edge pushed it onto a second line of its own — the box then measured two lines tall while the name still occupied only the first, and the row dutifully centred that two-line box, leaving the text 11px above centre. At 1.25em it was also the tallest thing on its line, so it set the line height of every single-line name.
- The magnifier is gone from those rows rather than given room, because reserving room for it makes names wrap earlier than they need to in an 11rem column and not reserving it puts the icon on top of the name. `.ta-name-clickable` already turns cyan and underlines on hover — the same signal every other link in the app uses — and the mobile layout has shipped without the icon all along. It stays on the standings and Final Results cells, which have width to spare. Names now wrap slightly *later* than before, since the icon is no longer eating ~22px off the last line.
- **Play Horn gets a drawn party popper**, replacing the last emoji in the app. Five candidates were drawn and compared at the 13px the button actually renders — an angled popper, a straight party horn, an air-horn canister, a trumpet, and a popper mid-burst — and judged on the same test the horseshoe and poker chip were: whether it still reads as itself once it is small. Three tints, not one, because a popper in a single flat hue is a triangle with lines on it: orange cone, pink and cyan stripes drawn across it as open paths so they stay stripes rather than bands at this size. The cyan stripe swaps to green in blue-yellow mode; the cone and the second stripe are both on the red side and stay put.
- The single-quoted one of that button's three sites is concatenated rather than given a `${}` placeholder. That is the exact mistake v18.57 shipped, where one arm rendered the literal text `${ICON_HORN} Play Horn` on screen.
- **Character limits now say so.** Every host-typed field has had a maxlength since v18.71, and the browser enforces them silently — at the limit the field just stops accepting characters, which looks identical to a dropped keypress. Hitting one now rings the field and shows "Limit reached — N characters max" in the same orange the required-field and Quiz ID hints already use, announced to screen readers through the app's existing channel. One delegated listener, since the fields are re-rendered from scratch on nearly every interaction, and one shared note element that moves to whichever field is at its limit.
- **The tutorial expands the questions it is about to point at.** It already reset the round sections, but not the per-item collapse sets — those start empty on a fresh game rather than pre-populated, so nothing re-created them and they carried the host's real session straight in. A host who had tidied away a couple of finished questions before opening the tutorial got a tour whose steps spotlighted question blocks that were still shut, which means a zero-height target and instructions referring to controls that are not on screen.
- **No more up/down spinners on the team guess field.** They are about 10px tall each at that size, they step by 1 through a 1-146 range, and on a row you are tabbing through at speed the only thing they reliably do is catch a stray click and silently change a score that was already right. `type="number"` stays for the numeric keypad and the min/max.
- Craft Prize Drawing's contents clear the section header. `.section-body` has no top padding — every other section opens on something that brings its own leading space, and this is the one that does not, so both the "Choose Craft Prize Winner" button and the EXCLUDE TOP / DRUMROLL (SEC) captions sat flush against the header's bottom edge.
- Export & Data's XLSX, PDF and JD Upload buttons are centred, lining up with the Clear Session button below them that has been centred all along. Left-aligned, the section read as two rows that had nothing to do with each other.

## v18.71 - 2026-08-21
- **Character limits on every field a host types free text into.** Quiz ID 24, Host Name 40, Location 60, Craft Partner 50, Partner Town 40, Bonus Item 60, Restaurant Staff 200, team names 40, the winner announcement script 600. Sized to what each field is for rather than to a round number — a quiz ID is a code, a team name has to fit the scoresheet's 220pt column, the staff list is a handful of first names, and the script is a paragraph read aloud.
- The numbers live in one `FIELD_MAX` and are applied twice: as the inputs' `maxlength`, and again in `migrateState` to clamp whatever comes IN. `maxlength` only stops a person typing past it — it does nothing for a value arriving from a loaded .json, an older session saved before these limits existed, or a script-driven paste. Verified by migrating a deliberately abusive state (500-character location, 900-character staff list, 500-character team name): every field lands on its limit exactly.
- Worth saying why this matters beyond tidiness: the PDF header and the scoresheet's team column size their text to fit a fixed box, so a runaway value never overflowed — it shrank until it could not be read. Clamping on the way in is what makes that unreachable.
- Removed "Beer Round! Everyone got it right!" from the Halftime and Final Wager blocks. The header's own Beer Round badge is two inches away and says the same thing, and the block is already washed gold with a gold border — three statements of one fact. Same call, same reasoning, as removing the bonus questions' version in v18.57. The now-dead `.beer-stripe` rules go with it.
- The horseshoe is the right way up, and reads as a horseshoe. It was an arch with its opening facing down — closer to a tombstone than a shoe. It now opens upward with flared heels.
- The poker chip reads as a poker chip. A ring with a hub and four thin spokes was a steering wheel; it now has the four solid edge spots that are the thing which actually says "casino chip". Solid rather than stroked, because at the 12px this header renders a 4x3.6-unit rectangle outlined at stroke-width 2.25 is all stroke and no shape.

## v18.70 - 2026-08-21
- Craft Partner and Bonus Item move out of the PDF's header and into the empty page beside the Standings table. The header is back to one row of four, which puts the round headers back at y=81 instead of y=121 — **40pt of vertical space reclaimed on every export**, where yesterday's second row was spending it on two fields.
- The space beside Standings was already paid for: the table is 432pt of an ~794pt usable width, so roughly 360pt sits unused to its right on every export. Both fields get more than double the width a six-across header row could have given them, for no vertical cost.
- Drawn once, from the top of the Standings heading, and only on the page the table starts on. It is event metadata rather than part of the table, so repeating it after a page break would read as a second header. Skipped entirely if the remaining width ever drops under 90pt — better absent than crushed.
- Verified by intercepting what jsPDF is asked to draw, across four cases: both fields filled, both empty (em-dash), a partner with no town (no trailing dash), and values long enough to need shrinking and wrapping. No overlap with the standings rows, and the panel's right edge lands flush with the page margin.

## v18.69 - 2026-08-21
- **Light mode's Beer Round is actually gold now.** The old #f1e7d0 background sat at OKLCh chroma .032 — a near-neutral beige, so the block that is meant to read as the fun moment of the night looked like unstyled paper. The background was both the biggest lever and the one with the most room: #fff0c4 is **+83% chroma** and slightly lighter. `--accent-gold` (every 7-14% wash: the Beer Round badge, its stripe, the CB Prize row and tag, the craft-prize flash) goes #e2b000 to #ffb300, +7%. `--beer-border` takes the most chromatic gold that still clears 3:1 on the new background, +10%.
- `--badge-gold-fg` could only gain 5%, and that is the honest number rather than the one I wanted. It has to hold 4.5:1 as text on the Beer Round badge — the darkest surface it ever renders on, and darker than the block behind it because the badge lays a gold wash *over* that block — while also serving as the fill under white on the tie badge and the active standings sort button. #845e00 lands at 4.51:1 and 5.86:1.
- Method note, because the first attempt at that value was wrong: the ceiling has to come from measuring the composited badge surface in the running app, not from computing the wash over the card. The wash sits on `--beer-bg`, not on the card, and computing it the easy way put the first value 9% too bright — caught by the audit, not by the arithmetic.
- **All four Q5 pictographs changed**, chosen from five candidates each. Round 1's gift becomes four squares with one filled — the only candidate that says "four sub-questions", which is what that block actually is. Round 3's clover becomes a horseshoe: same luck idea, and far more legible than the clover, which was the busiest mark in the app. Round 2's pause bars become a poker chip — the bars said "we are stopping", which is true of halftime but says nothing about putting points on the line. Round 4's target becomes a stack of chips with one on top, for the last and biggest wager of the night.
- The horseshoe and the chip stack keep their own colours (green, red); the four squares and the poker chip stay on their round accents, since neither is a thing with a colour of its own.
- PDF export gains **Craft Partner** and **Bonus Item**, on a second header row of two half-width fields rather than squeezing six across the first. Both hold free text a host types — a brewery name plus its town, a prize description — and at a sixth of the width they would have been the two narrowest fields on the page holding the two longest values. Verified against all three cases: both filled, both empty (em-dash, same as the other four), and a partner with no town (no trailing dash).
- Full audit after all of it: **1,625 rendered text pairs and 13 icon-in-context pairs per mode, 0 failures in all six theme x colour-vision combinations.**

## v18.68 - 2026-08-21
- Round 1's gift and Round 3's clover move to the head of their own "BONUS (0-4 x 5)" line, matching what v18.64 did for the Halftime and Final Wager icons. All four Q5 headers now read the same way: a bare "Q5" with its badge on the top line, and the pictograph introducing the sub-line that says what kind of question it is. Doing only the wagers left the two bonus rounds as the odd pair out.
- `BONUS_Q_STYLE`'s field is `icon`, not `emoji`. It has held an SVG since v18.57 and the old name had started reading as a leftover to be cleaned up rather than a thing in use.

## v18.67 - 2026-08-21
- Entry and Shuffle in the Before Halftime / Before Final Wager blocks split the difference at **32px** (58x32 and 38x32, measured), halfway between the ~20px they started at and the 44px of v18.64. 44 fixed the tap problem and overshot the look: two chunky pills above a quiet little standings table, pulling more attention than the scores they sit over.
- Worth being straight about the cost rather than filing it under "improved": 32px is **under** the 44px both platform guidelines ask for, so this is a deliberate trade of guideline compliance for proportion, not a claim to meet it. It clears the 24px WCAG 2.5.8 asks for at AA, and is 60% bigger than what was there before v18.64.
- Sized `max(2rem,32px)` for the same reason the 44px version used `max()`: the rem tracks Settings > Size so scaling the app up scales the button, but the app's root is 15px, so rem alone would land at 30px at the default and lower at the small end of the range.

## v18.66 - 2026-08-21
- **The beer has its foam everywhere it appears.** The Beer Round badge, its stripe and the CB Prize tag were opting out of the tint entirely and inheriting their own gold, on the v18.59 reasoning that the context was already saying "beer". That was the wrong call: a mug rendered in one flat gold has no foam, and the foam is most of what makes it read as a mug rather than a tankard-shaped blob. All three take the full tint now — amber body, cream head — like every other beer in the app.
- The reason for that exemption was real, and is handled properly instead of by dropping the colour. Amber on the Beer Round wash measured 2.94:1 — a miss by 0.06, and only in LIGHT blue-yellow mode, where the wash is a color-mix off `--accent-gold` and therefore pink and light rather than deep gold. `--tint-beer` is darkened to #9a6300 for that one mode: 3.30:1 on the pink wash, still 3.68:1 on the darkest ordinary light surface it renders on, hue untouched. A mode-scoped two-step darkening is a far smaller concession than dropping the colour in all six.
- XLSX's icon is a landscape spreadsheet with a filled header band, replacing the portrait document. The header is the one cue that separates "spreadsheet" from "generic table", and landscape is what stops it being indistinguishable from the PDF button beside it. Filled at 34% rather than solid so the two column dividers still show through the top row.
- Icon audit after both: **0 failures across all six theme x colour-vision combinations**, 11 icon-in-context pairs each, worst case 3.15:1. Fresh page load per mode.

## v18.65 - 2026-08-21
- **The team checkbox stays visible once ticked.** Its border was going to the fill colour on check — and the chip around it takes that exact same fill, so a box filled and bordered in it had nothing to separate it from the chip: the box vanished and the tick was left floating on a coloured pill. The border now takes `--check-icon-color`, the tick's own colour, so a visible box stays around the mark in both themes. That colour is already audited against both fills (it is what the tick is drawn in), so the outline inherits the same contrast rather than needing a value of its own.
- **Team Report's close button is a circle.** With the word "Close" gone (v18.55) it is a lone mark, and a round button reads as "dismiss this" the way a rounded rectangle — the shape every other labelled button in the app uses — does not. Explicit equal width/height rather than symmetric padding, since `border-radius:50%` on a content-sized box is only round while the content happens to be square. Matches `.resume-banner-close`, the app's other icon-only dismiss.
- **"Team 1" and "Guess" line up.** The two inputs on that row started 4.5px apart, which is the thing that actually looked wrong and is invisible in the markup because one side spaces with a flex `gap` and the other with a `margin-bottom`. Both are 7px now, measured back to a 0px delta.
- The two labels were also diverging on five counts at once — display font vs body, weight 400 vs 600, letter-spacing 1px vs .5px, sentence case vs upper, `--text-muted` vs `--text-secondary` — which is what made a matched pair of field labels read as two unrelated bits of text. "Team 1" now takes the same treatment as every other field label in the app, which does mean it renders as "TEAM 1".
- PDF's icon is a page with a download arrow through it, replacing the closed book. Of five candidates it was the only one that survived the 13px that button actually renders at, and the arrow is what keeps it distinct from the spreadsheet sitting immediately beside it.

## v18.64 - 2026-08-21
- **Entry and Shuffle in the Before Halftime / Before Final Wager blocks are a real touch target.** They were .65rem at 3px padding — about 20px tall, small enough to need a careful, deliberate tap, and they sit at the one moment in the night the host is reading scores aloud to the room rather than looking at the screen. Both are now 44px in each direction (68x44 for Entry, 47x44 for Shuffle, measured), with a larger label and icon and more space between them.
- Sized `max(2.75rem,44px)` rather than a plain 2.75rem: the rem tracks Settings > Size so scaling the app up scales the button, but rem alone lands at 41px at the shipped default (the app's root is 15px, not 16) and lower at the small end of the range. The px floor is what guarantees 44 whatever the size setting. Deliberately not narrowed on desktop — this app is used on a phone or tablet at a venue far more than at a desk.
- The Halftime and Final Wager pictographs move from beside "Q5" to the head of their own "BONUS WAGER (1-10)" / "(1-20)" line. The pause bars and the target say what kind of question this is, which is what that sub-line is for; next to "Q5" they were qualifying a number that is the same on every round.
- XLSX's spreadsheet icon takes Excel's green, on the stroke only — no fill. The green here is a hint about the file format rather than a picture of an object the way the mug and the drum are, and a 38% green wash inside a document outline reads as a highlighted page rather than as a spreadsheet.

## v18.63 - 2026-08-21
- **Light mode's accent-button pictographs are legible again, without changing how they look.** v18.62 traded contrast for appearance there and said so; this recovers the contrast and keeps the appearance. The fills stay exactly as they were — vivid amber mug, red drum — and only the outline flips direction: away from a bright cyan button means darker, away from a mid-dark teal one means lighter. The mug's outline on the light Choose Craft Prize Winner button goes from **1.43:1 to 3.37:1**, and in light blue-yellow mode from 1.07:1 (where it had effectively vanished into the green) to 5.17:1.
- Which direction the stroke goes is a property of the button, not of the icon, which is why it lives in `--icon-stroke-ink` / `--icon-stroke-mix` per theme rather than in the icon classes. The light share is much smaller than the dark one because #007ea8 gives even white only 4.4:1 — there is little room, so the outline has to go most of the way to white to clear 3:1 against it.
- That makes the icon audit fully clean for the first time: **0 failures across all six theme x colour-vision combinations**, 10 icon-in-context pairs each, worst case 3.15:1. Measured from a fresh page load per mode.
- **Final Results' flag is a checkered racing flag.** It was Lucide's plain pennant. Three checks across rather than four: at the 16px that header renders, a four-column checker closed up into a blob. The filled squares take currentColor and the alternating ones are left empty, so the empty half is whatever surface the header sits on — the checker reads as white-on-dark in the dark theme and black-on-light in the light one, from one set of paths, with no token to keep in sync. It is deliberately not one of the tinted pictographs: a racing flag has no colour of its own, and the two things it is made of are ink and not-ink.
- The flag rides a shallow wave — one offset curve applied to the top edge, the mid-row boundary and the bottom edge alike, so the checks bend with the cloth instead of sitting flat on it. The thin edge path is what stops it dissolving into three loose squares.
- Copy Prize Eligible List is gone from the Craft Prize Drawing section, where it rendered in all three states (pre-draw, mid-draw, winner shown). It stays in Advanced Settings > Craft Prize Eligible List, which is where it was exported from all along — one button in one place rather than the same action in two, in a section whose job is running the draw rather than exporting from it. Its now-unused `.cp-eligible-btn` rule is removed with it.

## v18.62 - 2026-08-21
- **Pictographs on a solid accent button are painted opaque.** At the 38% fill they use everywhere else, the button's own cyan came up through the mug and the drum shell and tinted them — the icon read as a cyan object rather than an amber or red one, which is the whole thing the tints were added to fix in v18.59. The 38% fill is unchanged on cards and every other surface; only solid fills go opaque.
- Opaque fills paint over each other, which exposed a path order that had never mattered before. Both icons are now ordered back-to-front: the mug body drawn last erased its own two vertical ridges and its foam, and the drum shell drawn after the head took a bite out of the cream oval. Beer is body, handle, ridges, foam; drum is shell, head, sticks. Translucent fills hid all of that — nothing about the old order looked wrong until the fills went solid.
- The stroke is pulled a further 38% towards black so the interior lines survive the fill rather than being swallowed by it. Without it an opaque icon is just a silhouette, and the two things worth keeping — the mug's ridges and the drum's cream head — are exactly what a silhouette loses.
- Both themes render these in the same vivid values on the button, rather than each theme using its own tints and its own foreground. Light mode's tints were tuned to sit on a near-white card; mixed towards white on the button they came out as a pale wash of the right shape. **This is a deliberate trade of measurement for appearance and it costs real contrast in light mode:** on the light Choose Craft Prize Winner button the mug's amber fill sits at 1.56:1 against the teal (2.39:1 in blue-yellow mode, where the fill is a dark green), its foam at 2.45:1, and its dark outline at 1.43:1. Dark mode is clean — 0 failures across its three modes, worst 3.15:1. These are decoration beside their own text label, not the information identifying the button, but the light-mode figures are low enough to be worth stating rather than burying. Lightening the stroke in light mode instead of darkening it would take the outline to roughly 3:1 while keeping the fill exactly as it is — say the word and it is a one-line change.
- Audited from a fresh page load per mode as usual: 10 icon-in-context pairs x 6 combinations.
- Team Report's Extras block gets a Subtotal line. Subtotal only, with no "total so far" beside it — Extras renders before Round 1, so at that point the two are the same number and printing both would state it twice, which is the same reason the Final Wager block skips its own running total. The block only renders when a team actually has extras, so the line never shows as a lone 0.

## v18.61 - 2026-08-21
- Tapping the progress bar pulses the ring twice instead of three times. At 2.2s a beat, three ran 6.6s — the ring was still going well after the host had started reading the row it pointed at. The cleanup in `scrollToAndPulse` listens for `animationend` rather than counting beats itself, so only the iteration count changed. `jumpToSection` shares the same cue and follows suit; two beats there and three from the progress bar would have read as two different signals.

## v18.60 - 2026-08-21
- Round 3's clover is green and Round 4's Final Wager target is red, leaving the round accents they were given in v18.57. A gold clover and an orange bullseye read as "whatever colour that round is" rather than as a clover and a dartboard. Both are multi-part like the other pictographs: a darker green stem and leaf crease on the clover, and a pale middle ring between the target's red outer ring and red bullseye, which is what makes it read as a dartboard rather than three circles.
- Round 1's gift and Round 2's Halftime pause keep their round accents. A red gift would fight the wager pills either side of it, and a pause bar has no emoji colour to go back to in the first place.
- Re-audited from a fresh page load per mode: 10 icon-in-context pairs x 6 theme/colour-vision combinations. The two new icons add no failures — the only case still under 3:1 is the same one as v18.59, the beer on the solid-cyan Choose Craft Prize Winner button at 2.52:1 in the two light modes, which is decoration beside its own label and cannot be fixed without giving up the hue entirely.

## v18.59 - 2026-08-21
- **The pictograph icons have their emoji's colours back, and are filled rather than outlined.** v18.55-57 replaced every emoji with drawn geometry, which fixed the real problem (a platform pictograph is a fixed-colour image no theme or colour-vision token can reach) but overcorrected: stroke-only icons inheriting whatever grey or white the surrounding label happened to be. A white outline of a mug does not read as a beer. Each pictograph now carries its own tint token — amber mug, red drum, gold trophy, silver mic, red heart, tan clipboard, red PDF book — and a fill at 38% of that colour underneath the stroke, so it reads as a coloured shape rather than a line drawing while the interior detail (the foam, the drum's tension rods) survives.
- Several use more than one colour, as their emoji did: cream foam on the beer, a cream drumhead and wooden sticks against the drum's red shell, a darker plinth under the trophy, a darker yoke under the mic capsule, a pale clip on the clipboard. Each part restates fill and stroke rather than inheriting them — both resolve `currentColor` at the element that declares them, so a child that only changed `color` would still have inherited the parent's already-resolved paint.
- These are the one set of colours in the app deliberately NOT swapped by colour-vision mode. Every other colour here encodes something, so a mode that cannot separate two of them loses information; these encode nothing — each icon sits directly beside its own text label, and remapping green would only stop a clover looking like a clover. Same exemption, same reasoning, as the podium metals.
- The primary colour of each icon clears 3:1 against every surface it can render on, in both themes; the secondaries are interior detail and only have to separate from the primary (the foam on a real beer emoji is white and vanishes on white too). Audited from a fresh page load per mode — switching theme at runtime and re-measuring reports stale computed values, as the v18.53 notes warn, and doing it that way here produced four phantom failures before the method was corrected. Result: 8 icon-in-context pairs x 6 theme/colour-vision combinations, **one** case under 3:1.
- That case: the beer on the solid-cyan "Choose Craft Prize Winner" button, 2.52:1 in the two light modes. On a solid accent fill the icon is mixed 45% towards the button's own audited foreground, because `--accent-cyan-solid` runs from #00ffff to #00654c across the six combinations and no fixed value is legible on all of them. Light mode's fill gives even white only 4.4:1, so no saturated colour can clear 3:1 there — a pastel would, but with no hue left to see. Left as-is: it is decoration beside the words "Choose Craft Prize Winner", not information, and it clears 3:1 in the other four modes.
- The Beer Round badge, its stripe and the CB Prize tag keep inheriting their own gold instead of taking the tint. They are already the beer's colour, and amber on a gold wash measured 2.94:1 in light blue-yellow mode, where that wash turns pink.
- Round 1 and Round 3's bonus gift and clover, and the Halftime pause and Final Wager target, are left on their round accents. Those were a deliberate v18.57 choice — each reuses the colour its own round is already tagged with — and a tint would undo it. Say the word if you would rather have a green clover than a gold one.
- **Play Horn goes back to an emoji** at your request. Three notes on it: the button carried a trumpet in every commit before v18.57, not the party popper, so it is now a popper rather than restored to what it had; and one of its three sites was inside a single-quoted string, so since v18.57 that button has literally rendered the text `${ICON_HORN} Play Horn` on screen — a template placeholder in a plain string, invisible to a search-and-replace and to `node --check` alike.

## v18.58 - 2026-08-21
- **A deployed build now appears on the first launch, not the second.** The service worker was stale-while-revalidate: always answer from cache, refresh behind it. Correct for offline, but it meant every deploy was invisible for one launch — a trap noted in the v18.51 changelog, hit again in v18.57, and expensive to debug mid-service because "the fix didn't land" and "the fix landed and you're looking at yesterday's build" are indistinguishable from the host's side.
- It is now fresh-if-fast: each same-origin GET races the network against a 1.5s timer, uses the network response if it arrives in time, and serves the cached copy if it doesn't — with the network request left running either way so the cache still refreshes. Deliberately not network-first, which was tried here before: with no deadline it waits on a slow-but-alive connection before falling back, which reads as the app hanging on a blank screen at a venue with bad signal. A fast connection gets the current build immediately, a bad one paints within 1.5s, a dead one paints instantly.
- One page load must not mix builds — a new index.html against an old app.js is worse than being one build behind — so the first request of a load records which side won and every request for the next 5s follows it, instead of each file racing on its own.
- Install now precaches with `cache:'reload'`, so a new worker fetches the shell from the network rather than picking the previous build back out of the browser's HTTP cache. `js/tutorial.js` and `css/tutorial.css` were never in the precache list, so a fresh install had no tutorial offline until each had been fetched once; both are in it now.
- Verified: with the new worker active, an edit to app.js showed up on the first reload (the old worker needed two), and with the server stopped the app still boots fully from cache.
- The last two emoji in the app are gone, which makes the v18.57 "every emoji is now drawn geometry" claim true rather than nearly true. Both warning banners carried a literal `\u26A0\uFE0F`. The Resume banner's markup in index.html had in fact been converted in v18.57 — but the JS that fills the banner in used `.textContent`, which overwrote the icon with the emoji again on every single load, so the conversion was never visible. Worth remembering as a shape: converting the markup is not the fix when something else writes over it. The autosave-off notice builds its own markup and was simply missed. Both now use a shared `ICON_ALERT`, and that notice's close button uses the app's own `X_ICON_SVG` instead of a `\u2715`. All four marks now take the amber those banners already draw themselves in, rather than the emoji's baked-in orange-and-black.
- The progress bar at 100% read "All 4 rounds scored — jump to Final Results". It now reads "220/220 100% - Jump to Final Results", carrying the same scored/total figure the per-round bar was showing a moment earlier instead of switching to a sentence.
- Team Report: **Diff Adj** loses the asterisk in the glossary line. The asterisk is a footnote marker on the figure itself, not part of the term's name, so printing it in the definition read as though the label were "Diff Adj *". The figure and its footnote are unchanged.
- Team Report: the **Diff** line is two sentences instead of one em-dashed run. "...against the team's Score Guess. A + means they guessed high, a − means they guessed low, and 0 means they called it exactly."

## v18.57 - 2026-08-21
- Team Report is one column now, on desktop as well, and the modal narrows from 680px to 32rem to suit it. 680 was not a design choice — it was the minimum two columns could fit in, since each needs ~314px for its widest row, and at that width every full-width element in the report had a few hundred pixels of dead space stretched through the middle of it. The width is in rem rather than px so it tracks Settings > Size instead of going sparse at the small end and overflowing at the large end. The container query and the divider hairline that only existed to separate the two columns are both gone.
- Team Report's Extras rows drop the leading +5/+3 and the words "brought" and "shown". The points were already stated at the end of the row, so printing them at both ends of a two-item line said the same thing twice, and the verbs only restated that the item is present — which the row existing at all already says.
- The Q5 Halftime/Final Wager blocks were still showing the old ↺ character instead of the Reset icon. Worth naming the cause: the escape was written `\u21BA` there and `\u21ba` in the other two blocks, so v18.55's search-and-replace matched two of the three sites and reported success. All three now use the shared icon.
- Shuffle is icon-only. With the word it was the widest of the four scoreboard sort buttons and squeezed Entry/Asc/Desc; the name is kept for screen readers and as a tooltip, and the icon runs slightly larger to hold the same optical weight as its neighbours.
- **Every emoji in the app is now drawn geometry** — 29 sites across 27 icons: Save, Load, gear, Try Example, Take the Tour, FAQ, Copy, TXT, XLSX, PDF, JD Upload, Clear Session, Scores, the two warning banners, the lock on Event Details, Beer Round (five places), the craft-prize horn/drum/trophy/mic/clipboard, Final Results' flag, the Halftime and Final Wager titles, Stop Drumroll, the bonus-question gift and clover, the banter mic and thanks, and the sort-mode label. Some were hidden as `\uD83C\uDF7A`-style escapes rather than literal characters, which is why the first sweep in v18.55 missed them. An emoji is a fixed-colour platform pictograph no theme or colour-vision token can reach, so each one was a spot in the interface that stayed the same two colours in all six modes.
- Blue-yellow mode had two things still rendering blue, both real. `--txt-cyan` was never overridden in the DARK blue-yellow block, so every piece of cyan text — the Scores heading, the score figures, Grand Total — kept the base theme's #00ffff in the one mode whose entire purpose is to remove blue. And the Round 1 "Wagers" pill's background was a literal `rgba(0,255,255,.13)`, so it stayed a blue wash under green text.
- That second one was systemic, so: every accent-derived tint in the stylesheet now mixes from its token instead of being hardcoded — 33 of them, across focus rings, hover washes, badge backgrounds, the Beer Round banner and stripe, the flash and pulse keyframes, the craft-prize flash and CB Prize tag, and Grand Total. The podium golds, silvers and bronzes are deliberately exempt and now say so: they are metals rather than accents, identical in every mode, and mixing them off --accent-gold would turn 1st place magenta in blue-yellow mode for nothing.
- Tapping the progress bar pulses much more slowly — 2.2s a cycle rather than 1s. At 1s the three pulses flickered fast enough to read as an error state, and were over almost before the smooth scroll that triggers them had finished.
- Removed "Beer Round! Everyone got all 4!" from the bonus questions. The Beer Round badge in the same header already says it.
- Two bugs found while doing the above, both mine. Moving the bonus-question icons into constants put `BONUS_Q_STYLE` above the `ICON_*` declarations it now referenced — a temporal-dead-zone throw at parse time that took the whole script down, which is the exact failure v18.46 fixed and the comment on that very declaration warns about; it now sits below them and says why. And tokenising the Round 2 and Round 4 wager pills "for consistency" dropped Round 2's text to 4.41:1 in light blue-yellow mode, because the light theme's magenta is far darker than the dark theme's that the original literal was picked against. Those two are back to literals: magenta and orange are the accents no colour-vision mode touches, so they had nothing to follow in the first place.
- Tutorial steps no longer tell you to tap glyphs that no longer exist ("tap ↕ Sort", "tap ↺", "the ⚙️ gear icon").
- Re-audited after all of it: 1,822-1,825 rendered text pairs checked per mode, 0 contrast failures in all six theme x colour-vision combinations, 0 icon failures, and 0 wrapped rows in Team Report at every one of the 14 font sizes.

## v18.56 - 2026-08-21
- Bolder stroke on the Reset icon (2.25 to 3), in the question Sort/Reset pair and on the Question Timer's own reset button. It read as thin next to Sort, which sits immediately beside it.
- Worth recording why, because the obvious explanation was wrong: Reset is not actually lighter. Rasterised at the 12px those buttons render it, the old 2.25 put down MORE ink than Sort at the same width — 0.243 coverage against 0.209, mean alpha .58 against .50. The difference is composition, not rendering. Reset is one big open circle, two strokes far apart around a large empty middle; Sort is four strokes packed into the same box. The sparse shape reads lighter even though per-pixel it is not, so the fix is a heavier nominal stroke on that one glyph to match the pair's apparent weight. Compared at 2.25 / 2.75 / 3 / 3.25 / 3.5: 3 is where the pair stops looking mismatched, and 3.5 overshoots and starts closing up the arc.

## v18.55 - 2026-08-21
- **Screen reader support.** The app was unusable for a blind host in one specific, fatal way: 297 controls — every section header, question header, team name, standings row and the mini-progress bar — are divs and spans carrying `role="button"` and `tabindex="0"`, so they could be focused, but a plain element does not fire on Enter/Space the way a real `<button>` does, so none of them could be activated. That is a WCAG 2.1.1 (Keyboard, Level A) failure across most of the interface. One delegated keydown handler now activates any `role="button"` on Enter or Space, covering all of them and anything added later; Space is preventDefault-ed so it fires the control instead of scrolling the page.
- 32 inputs had a visible `<label>` beside them, or only a placeholder, but nothing associating the two programmatically — so a screen reader announced most of the Event Details and team fields as unlabelled. Every one now carries an explicit `aria-label` (Level A, 4.1.2). Also added the `<h1>` the app never had (its heading list started at h2), a `role="main"` landmark to jump to, and a `.sr-only` live region.
- Scoring now announces itself. Marking a wager, a bonus, or Mark All changes the page without moving focus, so a blind host got no confirmation a tap had registered at all (WCAG 4.1.3 Status Messages, Level AA). A polite `role="status"` region — present from first paint, since a live region added later is not seen by the accessibility tree in time — now reads back e.g. "Sherlock Homies, round 2 question 3, wager 5, correct, plus 5 points. Total 71".
- **Non-text contrast (WCAG 1.4.11).** Auditing all 4,186 rendered control borders turned up 3,053 failures in dark mode alone: `--border`/`--border-light` manage 1.1-2.0:1 against the surfaces they are drawn on, and for a control like an unselected wager button — whose fill is the same colour as the row it sits on — that boundary is the only thing saying a control is there. Added a `--border-control` token per theme (#6f6f6f dark, #7b7b7b light: the least extreme neutral that clears 3:1 on every surface a control can sit on) and pointed all 20 interactive control rules at it. Decorative container edges (sections, cards, table rules, the audit modal) are deliberately left alone — those are not UI components, 1.4.11 does not cover them, and brightening them would have turned the app into a wireframe.
- Three solid fills were failing the same criterion because a fill is what identifies a filled button, and theirs were too close to their surroundings: dark `--danger-solid-bg` #a52c2c (2.4:1) becomes #eb0025, its red-green-mode counterpart #884900 (2.2:1) becomes #b16000, and light `--accent-green` #10a710 — the *selected* state's own outline, at 2.21:1 against the mint fill it outlines — becomes #008b02. All three keep white or their existing text at AA and gained saturation rather than losing it; hues are unchanged. Every border in the app is at least 1 physical pixel; there were no sub-pixel ones to fix.
- Final tally across all six theme x colour-vision combinations: **0 text-contrast failures, 0 icon failures, and 1 border failure** — the rule under the Scores sidebar header, a container divider rather than a control boundary, left as-is for the same reason as the other decorative edges.
- **Consistent marks.** Every checkmark and X in the app now draws from the two shared SVGs the question rows already used. The Halftime/Final Wager result buttons were still rendering ✓ and ✗ as text characters, as were the Final Results "closer" tie badge, the note describing it, and the "Copied" flash. `flashBtn` had to switch from `textContent` to `innerHTML` to carry an icon, which also stops it stripping an icon from any button it flashes over.
- **New icons.** Sort, Reset, banter Refresh and scoreboard Shuffle were ↕, ↺, 🔄 and 🎲. The two emoji are fixed-colour platform pictographs that no theme or colour-vision token could reach, so they stayed the same two colours while everything around them adapted; the two text glyphs sat wherever their own font metrics put them, which is why Sort and Reset looked off-centre next to their labels. All four are now stroke-only Lucide SVGs inheriting `currentColor`, so they take each button's already-audited text colour in every mode. The buttons became `inline-flex` with centring on both axes: measured across 65 instances, the icon centre now sits 0px from the button centre. The Question Timer's reset button lost the `padding-bottom:6px` nudge that used to counteract its glyph's metrics and would have pushed the new centred icon off-centre.
- **Random is now Shuffle** everywhere it appears — the scoreboard sort, both Halftime and Final standings blocks, and the tooltip.
- **Team Report** no longer breaks a result across two lines. From a 16px root font upward, "correct" / "incorrect" / "4 of 4 correct" wrapped, leaving rows of uneven height down the column, and at the top of the size range every row was doing it. The cause was the desktop two-column split, which halves the width available to text that grows with the font; the modal is capped at 680px so the columns cannot grow to meet it. The split is now a container query in `em` rather than a viewport media query, so it holds two columns through the default size and drops to one full-width column from 16px up, where the text fits again. Verified at all 14 font sizes: 0 wrapped rows, 0 overflowing rows.
- **Bonus zero** no longer shows a checkmark before the 0. A tick reads as "correct" everywhere else in the app, and a team that got none of the four right is the opposite of that; "submitted, not skipped" is already carried by the cell's own styling.

## v18.54 - 2026-08-21
- Default dark mode is now fully WCAG AA, which completes the set: all six theme x color-vision combinations pass. The two team chips were the last holdouts — the Bonus Item chip's text at 3.47:1, the NJCB chip's text at 4.31:1, and white on the ticked NJCB fill at 3.95:1.
- Those two tokens are each BOTH the chip's own text color (against `--bg-input`) and, once ticked, the fill sitting under the tick. With white ink the two roles pull in opposite directions and no single value satisfies both: lightening the token to fix the text sinks white-on-fill, darkening it does the reverse. `#5B84A8` was failing both at once. Fixed by flipping the ticked ink to black rather than splitting either token in two — the same resolution blue-yellow mode already uses, and with black ink both roles want the same thing (a lighter chip). The colors themselves then only needed the smallest lift that clears AA: OKLab dE 0.068 and 0.017, hue held exactly, so the terracotta and the slate still read as the same two colors. `--check-icon-color` now lives on each theme (black on dark, white on light) instead of one global white, which also lets blue-yellow drop its own override and inherit.
- Tutorial: the Color Vision step's tooltip no longer covers the dropdown it is telling you to look at. Three things were wrong, and each alone would have been enough. The callout defaulted to sitting below its target, which is exactly where the menu opens — measured at 375x812, it covered 89% of the menu, hiding both named modes entirely. It is now placed above.
- Above is not sufficient on its own, though: the dropdown flips to open *upward* when there is no room below it, and on a 640px-tall viewport that puts the menu exactly where the callout had just moved to — still a 90% overlap. Steps can now declare `calloutClears`, a selector for something the spotlighted control opens; the callout treats that element's rect as part of the target and clears whichever side the menu actually took. The spotlight ring and dimming bars keep using the control's own rect, so the highlight itself doesn't grow. The callout still sits directly against the menu (a 16px gap), so it stays visually tied to what it is describing.
- The menu also could not win a stacking contest it should never have been in. It is `position:fixed` with a z-index, but it sat inside two ancestor stacking contexts (`.settings-panel` at 150, `.header` at 260), so its own z-index counted for nothing against the tutorial's callout — a plain z-index 601 element on `<body>`. It is now re-parented to `<body>` while open and restored on close, and raised above the tutorial layer, so the options stay readable and clickable even if a callout is forced right on top of them.
- That same re-parenting fixes a positioning bug that had nothing to do with the tutorial: `position:fixed` is resolved against the nearest transformed ancestor rather than the viewport, and `.settings-panel` carries a transform for its slideDown animation. The menu's carefully computed viewport coordinates were being re-based onto the panel — told to sit at top 536.5 / left 187.7, it rendered at 587 / 205, out by exactly the panel's own offset, and the flip-when-it-would-overflow test was mis-firing for the same reason. From `<body>` there is no transformed ancestor, so fixed means the viewport again, as the code always assumed.

## v18.53 - 2026-08-21
- Blue-yellow (tritanopia) color-vision mode is now fully WCAG AA in both themes. Auditing every theme x color-vision combination — not just the light one v18.52 covered — turned up five failures, all of them in this mode and all on the same two team chips plus the tie-row score.
- Light: `--item-border` and `--njcb-border` each double as their chip's own text color (on `--bg-input`) and, once ticked, as the fill underneath the tick. They had been tuned for the fill role, leaving the text role at 3.76:1 and 3.78:1. Darkened just far enough to clear AA (4.60:1 and 4.65:1), which costs almost no chroma (.247 to .226, .111 to .102) and improves the fill role as well — white on them goes from 4.7:1 to 5.6:1 and 4.8:1 to 5.7:1. Hues are untouched, so the magenta/green split this mode depends on (a red-green distinction, which is exactly what tritanopes still see) is unchanged.
- Light: `--txt-cyan` sat at 4.49:1 on the Final Results tie row. This mode swaps gold for magenta, so that row's wash is pink (`#e799ca`) rather than the cream every other variant gets, and it's the one surface dark enough to bind. Two points of lightness clears it.
- Dark: once a chip was ticked, its white label and tick sat on this mode's two deliberately bright fills (`#ff66cc`, `#00cc88`) at 2.62:1 and 2.10:1 — far under AA, and the worst misses in the app. Those fills are bright on purpose, so a tritanope can tell them apart against black; dimming them to suit white ink would have undone that. Flipped the ink instead — `--check-icon-color:#000` for this mode only — which clears AA by a wide margin at 8.02:1 and 9.99:1 and leaves the fills exactly as they were.
- Still open, and untouched here because it isn't this mode: the *default* dark palette has three AA misses of its own on those same two chips — the Bonus Item chip's text at 3.47:1, the NJCB chip's text at 4.31:1, and white on the ticked NJCB fill at 3.95:1. They affect the default and red-green modes.
- Methodology note for anyone re-running this: audit each theme/mode from a fresh page load, with the mode set in storage before the page boots. Switching theme or color-vision mode at runtime and re-measuring in the same session reports stale values — Chrome keeps serving the previous computed `color` for properties derived from a custom property that changed. Two phantom failures in this pass (a white timer on light, a black one on dark) were that artifact, not real.

## v18.52 - 2026-08-21
- Light mode's colors were tuned to AAA (7:1) rather than AA, which is what made them read as muted rather than as this app's palette. Against a near-white card, 7:1 leaves almost no lightness to spend, so every hue collapsed toward black and rendered as its muddy neighbour: orange as brown (`#723300`), gold as olive (`#55420e`), cyan as navy (`#004b64`), the NJCB blue as slate (`#3B5B7A`). Retargeted 18 tokens to a comfortable AA instead — 4.6-5.2:1 as text, 3.2:1+ where a value is only a border or fill edge — which buys back 20-120% chroma each. Every hue angle is unchanged: the values were recomputed in OKLCh with the hue held fixed and chroma pushed to the most saturated point that still clears the floor against the darkest surface that token actually renders on, so this is the same palette with its saturation restored, not a different one.
- Checked by auditing all 1,895 rendered text pairs in the running app rather than reasoning from the token list — resolving each element's effective background through gradients, alpha layers and `color-mix()` instead of assuming the nearest `--bg-*`, and applying the real AA floor per element (3:1 for large text, 4.5:1 otherwise). Light mode now has **zero** AA failures, down from 6: `--item-border`'s "+5 Bonus" chip sat at 4.0:1 and is fixed here as a side effect of the same token getting more saturated. Red-green color-vision mode is likewise clean.
- Blue-yellow color-vision mode keeps the old, darker `--badge-green-fg`. That mode swaps gold for magenta, which turns the Final Results tie row from cream to pink, and the brighter green drops to 3.2:1 against it — under AA. One scoped exception rather than holding the whole palette back for it; every other light variant's tie row is light enough for the vivid green.
- Dark mode is untouched, as are every background, text, border and shadow token in both themes. Blue-yellow mode still has three AA misses of its own that predate this change and are left alone: its two team chips at ~3.8:1, and its tie-row score at 4.49:1.

## v18.51 - 2026-08-21
- Close the last gap in the scroll anchor. Its click listener only recognised scoring targets (`[data-ta]`, `[data-ti]`, `.question-block`, `.special-section`), so every control that lives directly in a collapsible `.section` — the whole Craft Prize Drawing block, Event Details, Export & Data — re-rendered with no anchor at all and fell back to the raw scrollTop restore: exactly the pre-v18.41 behaviour the anchor exists to replace, fine for as long as nothing above changed height and a jump to somewhere unrelated the moment something did. Added `.section` as the catch-all at the end of that selector list; `closest()` returns the nearest match, so a scoring row inside a section still anchors to the row, never to the whole section.
- Swept every re-rendering control in the left column for the same class of bug — wagers, result buttons, bonus choices, Sort/Reset, question and special-wager headers, banter refresh, team names, standings rows and their sort, Final Results' sort headers, section headers, the point-adjustment stepper, and all of Craft Prize Drawing's buttons and steppers — at three viewport positions in both the desktop (#mainContent scrolls) and mobile (window scrolls) layouts: zero movement everywhere. The only shifts left are unavoidable ones, where the page is already scrolled to the bottom and the content shrinks out from under it (collapsing the last section, or the "Top N places are excluded" note dropping from two lines to one) — no scroll position keeps those still. Worth knowing when a fix looks like it didn't land: the service worker is stale-while-revalidate, so the first launch after a deploy still runs the previous build and the new one appears on the launch after that.
- Question Timer: let the pulse finish its beat when the clock crosses 0:01 → 0:00. The flash lives on the qt-crit state and 0:00 swaps in qt-over, which doesn't pulse — so the animation was cut off wherever it happened to be in its 2.9s cycle, snapping the box back to full brightness mid-fade at the exact moment the host is looking at it. A `.qt-settling` class now re-declares the identical animation on qt-over (an unchanged animation-name across a style recalc is what makes the browser carry the running animation over rather than restart it) and is dropped on the next `animationiteration`, i.e. at the cycle's own end where the keyframes are already back at full brightness. Guarded so it only ever continues a pulse that was really running: a timer resumed already past zero doesn't start a fresh flash just to fade it out, and leaving the over state early (a +30s nudge, a reset) drops the hold and its pending listener.
- Team Report: even out the Diff Adj / Adj. Score / Diff / Score Guess row on phones and space it out on desktop. It used one packed, centered layout everywhere (v18.49); a phone-width panel is only ~355px, so four equal columns leave no dead space there and now give the figures even quarter-width slots with the dividers on the quarter lines. Desktop keeps the packed layout — at the panel's full 680px, equal columns would strand ~110px between neighbours — but the cells gain 26px of side padding, putting ~52px of clear space between neighbouring labels with each divider centered in the gap, so they read as four distinct figures in one chain rather than four words crowded together. Verified no clipping at either end of Settings > Size's font range in both layouts.
- Team Report: "Adjusted Score" is now "Adj. Score" — it was the longest label in that row by a wide margin, which is what made the row hard to space evenly in the first place.
- Team Report: split each round's "Subtotal N · total so far N" into two right-aligned lines, one per figure (the "After Halftime Bonus" line that shares the style follows suit). They're two different numbers — this round's points, and the running total across all rounds — and on one line they read as a single run-on figure. Right-aligned rather than centered so both values land in the same column as the +N point values on every question line above them, making a round's per-question scores and the totals they add up to one continuous right-hand column. Grand Total stays centered: it's a full-width band of its own with no column above it to line up with.
- Team Report: a faded hairline now runs down the middle of the desktop two-column breakdown, from the top of Round 1 / Round 3 to the bottom edge of the breakdown where Grand Total picks up. Without it the two halves just floated next to each other and the eye had to work out that Round 3 was a new column rather than a continuation of Round 2. The column gap widens from 12px to 24px to give the line ~12px of clear space either side; at 12px it sat almost against both round boxes and read as a border on one of them. It's absolutely positioned on the grid rather than being a border on a column, since the two halves are different heights and a border would stop at whichever column carried it.
- Team Report: spell out the figures in the closing note. It previously explained only why bonuses are stripped; it now defines Diff Adj (the Bonuses coming back off — Bonus Item +5, NJCB +3), Adj. Score (the Grand Total with those stripped out), and Diff (Adj. Score against the team's Score Guess — + if they guessed high, − if they guessed low, 0 if they called it exactly), with the bonus-free-footing note kept as the asterisk's own footnote.
- First-run banner now reads "New here? Take the tour." rather than "Take the 2-minute tour."

## v18.50 - 2026-08-20
- Rebuild the sample game so it demonstrates the game states the app can display, while still reading like a real night's quiz. It now contains: a team scoring 0 of 4 on a bonus question; a question every team got right and a bonus round every team aced (both Beer Rounds); a question every team got wrong and several where most did; the full spread of team extras (both bonuses, Bonus Item only, NJCB only, neither); and guesses landing over, under, and exactly on the mark. Halftime and the Final Wager are deliberately left as ordinary mixed results — a whole room getting either of those right is rare enough that faking one would make the sample read as invented.
- Added a score tie (Sherlock Homies and Powder Keg of Knowledge, both 124) resolved by whose guess came closest, so the tiebreak is visible in Final Results as 4th/5th with the "✓ closer" and "tie" badges instead of being a feature nobody ever sees fire.
- Wagers now vary from team to team on every question. Previously every team staked the same amount on the same question, so each column was a wall of identical numbers; teams now spend a round's four wagers in their own order, weighted (imperfectly) towards the questions they got right, the way a real table plays it. Every team still spends each wager exactly once per round.
- Scores now span 78-143 and track how well each team actually did, rather than the old sample's much flatter, luck-driven table.

## v18.49 - 2026-08-20
- Team Report: pull the Diff Adj / Adjusted Score / Diff / Score Guess figures together instead of spreading them across the whole card. They sat in four equal quarter-width columns, and since the labels are short and very uneven ("Diff" vs "Adjusted Score") that left ~110px of dead space between neighbours, reading as four scattered figures rather than one Diff Adj → Adjusted Score → Diff → Score Guess chain; the gaps are now a consistent 16px. The card itself still spans the full width, staying aligned with the correct/incorrect row below it. Columns are sized `auto` rather than `max-content` deliberately: max-content refuses to shrink, which clipped the end cells against the card's `overflow:hidden` on the narrow mobile audit panel and at the top of Settings > Size's font range — `auto` packs identically when there's room but lets a label wrap instead of getting cut off when there isn't.

## v18.48 - 2026-08-20
- Team Report: bring each round's "Subtotal" label next to its own score instead of stranding the two at opposite edges of the round box. Same `space-between` → centered-pair fix (and same reasoning) already applied to Grand Total in v18.39 — the gap between label and value grew with the panel's width, so they read as two unrelated ends of a bar rather than one label/value pair. The "After Halftime Bonus" line shares the same style and picks up the change too.

## v18.47 - 2026-08-20
- Actually fix the view jumping when scoring, which v18.45/v18.46 did not. The anchor mechanism was asking the browser to `scrollIntoView({block:"nearest"})` on the just-tapped row — but "nearest" means *bring this into view*, and a scroll container whose `scroll-padding` is `auto` (the default) explicitly lets the browser offset the target clear of obscuring `position:sticky` elements. This app stacks sticky bars at the top of the scroller — `.header`, and on mobile `.mini-progress` under it — so while the host is scrolled into a round (i.e. always, while scoring), a row sitting in that band is treated as obscured and every single tap on it snapped the view to push it clear. Measured on desktop: a hard snap to exactly the header's height, and up to 527px whenever the anchor sat outside the viewport. Worse, the same call did *nothing* in the case it was added for — a genuine layout shift above the anchor leaves the row still "in view", so nothing got corrected. Replaced it with an explicit pin: note the anchor's exact on-screen offset before the re-render, then subtract whatever it moved back out of the scroll position afterwards. That's zero movement by construction — it never asks the browser where the element "should" go, so sticky overlays, `scroll-margin`, content reflowing above it, and late-settling fonts are all equally irrelevant. Verified across ~500 scored interactions spanning every scoring path (Q1-4 wagers, bonus Q5, Halftime/Final Wager, Sort, point adjustments, wager selects, team/Event Details inputs) at every scroll offset in both the desktop and mobile layouts: worst case 0.25px, versus jumps of up to 527px before.

## v18.46 - 2026-08-20
- Fix a brand-new session (or any session after storage got cleared/evicted — e.g. iOS Safari's ~7-day eviction for a PWA that sits unopened between events) rendering completely blank on load. v18.44's click-anchor tracking variable (`lastClickAnchorSel`) was declared down next to `renderLeft()`, but a fresh session's very first render runs synchronously earlier in the same script, before that declaration executes — reading a `let` before its own line has run throws, and since nothing caught it, the whole rest of the script aborted before that declaration (and its click listener) ever ran. Every future render then hit the identical error, forever, since the variable never escaped its temporal dead zone — the entire scoring UI stayed permanently blank until a hard reload with a saved session already in storage. Returning users with an existing saved session never hit this (their first render is skipped in favor of the resume banner), which is why it went unnoticed. Moved the declaration and listener to the very top of the script, ahead of every code path that could trigger that first render.
- Also close the one scoring path v18.44's anchor genuinely missed: the point-adjustment stepper (Teams > the ± chip) lives outside every element the anchor's click listener was matching against, so adjusting a team's score still fell back to the old raw-scrollTop restore and could jump. Gave each team's row a stable `data-ti` so it's anchored the same way every other scoring path already is.

## v18.45 - 2026-08-20
- Replace the scroll-anchor's before/after pixel-delta math (v18.44) with the browser's own `scrollIntoView({block:"nearest"})` on the clicked row/block instead — the delta math trusted two `getBoundingClientRect()` readings taken a tick apart to line up exactly, and any place they didn't (a font metric settling late, a container-query breakpoint flipping, sub-pixel rounding) could reintroduce the exact jump it was meant to prevent. "nearest" is a no-op whenever the anchor is already fully in view, which it always is right after tapping it, so the common single-wager-click case is now provably zero movement instead of an approximation.

## v18.44 - 2026-08-20
- Fix the view still jumping to a random position when correcting a score any way other than a single Q1-4 wager tap — v18.41's scroll anchor only covered that one path (cycleW). Replaced it with a general click-delegated anchor that covers every scoring interaction (Mark All, bonus questions, Halftime/Final Wager, point adjustments, and any future one) automatically, without each needing its own wiring.

## v18.43 - 2026-08-20
- Change what tapping the mini-progress bar jumps to: back to the top of the first unanswered question's own block (its "X left" badge included) rather than a specific team's row inside it. Added scroll-margin-top (tracking both `--header-h` and a newly-tracked `--mini-progress-h`) so that badge always clears the sticky header/progress bar instead of landing right underneath them. The attention pulse now runs three times instead of two.

## v18.42 - 2026-08-20
- Fix the Question Timer shifting things around it as it counts down: its display had no border at rest, then gained a 3px one at the warning state and a 4px one at critical/expired, growing the box each time and jarring everything near it. It now reserves a transparent 4px border at all times and only ever changes that border's color, never its width, so the box's rendered size stays fully constant across every state.

## v18.41 - 2026-08-20
- Fix the view jarringly shifting whenever a question got scored: re-render restored scroll position by raw pixel offset alone, which assumed nothing above it had changed height between renders — a round badge's "N left" count changing width, a round/question flipping to its "Done" state, etc. all shift everything below by a few px, so the same offset ended up pointing at different content than before. Now anchors to the exact row just scored and corrects for any drift, regardless of what caused it. Also made the mini-progress jump/pulse question-specific: for a regular Q1-4 question it now lands on the exact team's row still missing a mark, not just the question block as a whole (which can hold 10+ teams).

## v18.40 - 2026-08-20
- Pulse the section/question the mini-progress bar jumps to (a brief cyan ring, twice) so it's obvious at a glance where the tap actually landed, instead of the host having to spot it themselves once the scroll settles. Also made the mobile Settings panel's X (top-right, closes the panel) red, matching every other close/dismiss X in the app.

## v18.39 - 2026-08-20
- Make the Team Report's close X and the saved-session resume banner's dismiss X both red (border + icon, same --accent-red/--txt-red pair as the remove-team button) instead of neutral gray, and swap the resume banner's ✕ for the same shared SVG icon as everywhere else. Also brought Team Report's Grand Total label and score closer together — they used to sit at opposite edges of the box (justify-content:space-between) regardless of how wide it was; now centered as a pair with a moderate gap.

## v18.38 - 2026-08-20
- Team Report: drop the round name from each round's "Round X subtotal" line — it's already inside that round's own block, so just "Subtotal" is enough.

## v18.37 - 2026-08-20
- Fix the Quiz ID "looks good" checkmark being a different (Unicode) glyph than every other check/X in the app — now the same shared SVG icon. Bumped that shared icon's size and stroke weight (was still noticeably smaller/thinner than the questions' own check/X even after v18.36's sweep). Also tightened Final Results' tied-teams row background in light theme — it was a full-strength solid gold fill, bolder/more saturated than the rest of the table; now a much paler mix of the same gold. Removed the redundant "(submitted)" from the Team Report's "0 of 4 correct" bonus line.

## v18.36 - 2026-08-20
- Replace every remaining ✓/✗ Unicode glyph with the same inline SVG check/X used in the questions: the mini-progress "all rounds scored" label, round/question "Done" badges, the per-question correct/incorrect stat pills, and every correct/incorrect line in the Team Report (including the bonus-question line fixed last build). Made the questions' correct checkmark itself a little bigger. Team Report's close button now shows just the X, not "X Close". Tapping the mini-progress bar while the game isn't finished now scrolls straight to the first unanswered item in the current round (a question, the Halftime/Final Wager, or the Bonus Question, whichever comes first) instead of just the round's header, expanding both the round section and that item's own block if either was collapsed.

## v18.35 - 2026-08-20
- Bump up the new SVG X icon's size and stroke weight (the incorrect wager badge and the remove-team button) — the v18.34 swap from a Unicode ✕ to an SVG read as noticeably smaller and thinner than the glyph it replaced.

## v18.34 - 2026-08-20
- Fix the bonus questions' "incorrect" indicator being inconsistent with Q1-4's: the Team Report's bonus line showed plain "0 of 4 correct (submitted)" with no glyph at all, while every Q1-4 line shows "✗ incorrect" — added the missing ✓/✗ prefix to the bonus line so it matches. Also replaced every `.wager-badge.bg-incorrect` ✕ (Q1-4, bonus questions, special wager) and the remove-team button's ✕ with the same shared inline SVG X icon, so it's centered by its own geometry instead of by font metrics that landed it slightly differently in each context.

## v18.33 - 2026-08-20
- Dark theme only: Final Results' score number on 1st/2nd/3rd rows now matches the same aqua `--txt-cyan` every other row's score already uses, instead of the plain white it was overridden to — the dark-theme medal row washes are translucent enough over this app's near-black background that cyan still reads at high contrast there. Light theme's much more opaque medal tints keep the white override, which is what it was protecting in the first place.

## v18.32 - 2026-08-20
- Tone down the Standings #1 badge, which read as too saturated/neon next to #2/#3's own muted look: reverted from the flat bright-gold-fill/dark-text design to the same muted-fill + lighter-accent-border + theme-flipped-text formula #2/#3 already use — a much paler gold fill in light theme, a muted dark gold-brown fill with a genuinely lighter bright-gold border and white text in dark theme.

## v18.31 - 2026-08-20
- Fix the mobile Settings panel's footer (version/date/disclaimer) being unreachable on iPhone: its max-height was sized against `100vh`, which mobile Safari reports as the viewport with its address bar already collapsed — with that bar actually on screen (the normal case), the real visible area is shorter, so the panel rendered taller than what was actually on screen and its footer ran off the bottom. Added a `100dvh` max-height (with the old `100vh` kept as the fallback for browsers that don't support it) to track the real, current visible viewport instead.

## v18.30 - 2026-08-20
- Fix the remove-team button's ✕ looking off-center: the button already centered its content with flex, but a text glyph's own font metrics never quite land it in the visual middle regardless. Replaced it with an inline SVG X (same icon family as this session's other glyph replacements), which is centered on its own geometry instead of a font's.

## v18.29 - 2026-08-20
- Tone down the Standings sidebar's #1 row background: it was mixing the full-saturation `--accent-gold` token, which read as noticeably more vividly yellow than 2nd/3rd's own muted silver/bronze washes. Switched it to a plain fixed muted-gold tint matching the same subtlety and alpha levels as its siblings — the #1 badge itself keeps the vivid, color-vision-aware gold; only the soft row background behind it is muted now.

## v18.28 - 2026-08-20
- Replace the Theme toggle's 🌑/☀️ Unicode emoji with inline SVG sun/moon icons (Feather/Lucide geometry, sized to match the old emoji's on-page footprint) colored via this app's existing AAA-on-bg-card token pair (`--badge-gold-fg`/`--txt-cyan`), so the icon now follows Settings > Color Vision instead of rendering as a fixed-color platform pictograph. Also: fixed the Standings #1 badge silently losing its gold (a same-specificity, later-declared dark-theme rule was winning the tie and falling back to plain gray); changed the new 1st/2nd/3rd podium tint to color the whole scoreboard row instead of just the name text; and added a border to Final Results' tie badge so it no longer disappears into a tied or #1-place row's own yellow background.

## v18.27 - 2026-08-20
- Standings sidebar: the #1 rank badge now uses the same `--accent-gold`/`--on-accent-gold` tokens the rest of the app's gold elements already do (was hardcoded hex with no colorblind-mode swap), so the actual winner's highlight now follows Settings > Color Vision. Also added a subtle 1st/2nd/3rd podium tint behind the team name itself, matching Final Results' gold/silver/bronze row treatment. Separately, fixed the v18.26 checkmark badge: its square was the same dark, low-contrast wash as the button underneath it and read as blending in — it's now a solid, vivid green (white check, AA-checked, colorblind-mode-aware) instead.

## v18.26 - 2026-08-20
- Replace the "correct" wager badge's ✅ Unicode emoji with an inline SVG rounded square + checkmark, colored via the already colorblind-audited `--btn-correct-bg`/`--badge-green-fg` pair instead of the emoji's own fixed-color platform artwork — so Settings > Color Vision now actually affects it, the way it already couldn't.

## v18.25 - 2026-08-20
- Add small color swatch squares next to the "Red-Green" and "Blue-Yellow" options in Settings > Color Vision, previewing the actual substitute colors each mode swaps to (WCAG AA-checked in both themes) so picking one is an informed choice instead of a guess. Also fixed the dropdown itself getting cut off at the bottom of the Settings panel: it was `position:absolute`, which is still clipped by a scrollable ancestor's box even though it visually floats above its row — switched it to `position:fixed` with JS-computed placement (flipping above the button, same as it already flipped left/right, when it would otherwise run past the viewport edge).

## v18.24 - 2026-08-20
- Remove the CLOSE button anchored at the bottom of the mobile Settings panel footer, leaving the X button at the top right of the Settings banner as the panel's single close affordance (plus re-tapping the gear icon).

## v18.23 - 2026-08-20
- Rebuild the mobile Settings panel around the same anchored-header/scrolling-middle/anchored-footer layout the mobile scores sheet already uses, instead of one long column with only a sticky heading bar: the "Settings" banner now stays pinned at the top and the version/date/disclaimer plus CLOSE button stay pinned at the bottom, with just the settings rows scrolling between them. Added an X button to the top right of the Settings banner as a second way to close the panel without scrolling down to CLOSE.

## v18.22 - 2026-08-20
- Replace the Question Timer's ▶/⏸ Unicode glyphs with inline SVG icons. Those glyphs default to a fixed-color platform emoji font on iOS/Android, so the button's own already theme/color-vision-audited text color had no effect on them — now the icon is a plain shape (`fill:currentColor`) that always renders in whatever color the button's state (idle/pause/resume) resolves to, correct in every theme and color-vision mode. Sized in `em` so it still scales with the Settings > Size font control.

## v18.21 - 2026-08-20
- Audited mobile for readability at Settings > Size's larger end (17px+ root, up to 30px). Found the Date field's pretty-printed overlay ("Aug 20, 2026") capped at a flat 170px while its own text scales with root font-size — at large sizes the text could bleed past the field's edge into Quiz ID beside it (10px gap, 2-column `.meta-grid` — mobile only drops to one column below a 600px container width). Switched Date and Quiz ID's width caps to rem so they scale with the text instead of against it, and gave the Date overlay an ellipsis backstop for the rare case that still isn't enough. Re-checked the flat-guess class of bug fixed in v18.19/v18.20 for any other instances — found none.

## v18.20 - 2026-08-20
- Audited the app for the same class of mobile bug just fixed (a flat pixel guess standing in for a dynamically-tracked size) and found one more: `.col-left`'s bottom padding on mobile — reserved so the last section can scroll clear of the fixed peek-strip+timer dock — was a flat 150px next to the dock's own already-tracked `--mobile-dock-h`. Timer Stepper Buttons, a larger Size setting, or a taller safe-area-inset-bottom could all push the real dock past 150px, permanently stranding the last section's bottom edge behind it. Swapped in `--mobile-dock-h` there too.

## v18.19 - 2026-08-20
- Fix the Settings panel's bottom content — the last Advanced Settings rows and the CLOSE button — being unreachable on mobile. Its max-height subtracted a flat guess at the header's height instead of the app's already-tracked real `--header-h`, so on a phone where the header wraps to two lines (Save/Load/⚙️ under the logo) or grows from a larger Size setting, the panel was let render taller than the actual space below it, with no scrollbar and no page scroll to reach the overflow.

## v18.18 - 2026-08-20
- Fix the Settings panel scrolling horizontally on mobile — rows with a long label or a two-button control cluster ("Copy"/"TXT", "Save"/"Load") could run past the narrower mobile panel width instead of shrinking to fit; let rows and controls wrap onto a second line instead, with `overflow-x:hidden` on the panel itself as a backstop.

## v18.17 - 2026-08-19
- Reorder the tutorial's closing step so the Clear Session instruction comes first and "Tap Close Tutorial to close this box" is the last line, instead of the close-box instruction sitting in the middle ahead of Clear Session.

## v18.15 - 2026-08-19
- Add scroll-direction cues to the tutorial's Teams, Round 1, Final Results, Craft Prize Drawing, and Export & Data steps, so each tooltip tells the host to scroll down to that section before it starts explaining what's there. Note in the step introducing it that the ⚙️ gear icon sits in the top right.

## v18.13 – v18.14 - 2026-08-18
- Reserve layout space for the Event Details lock note, on top of the mini-progress bar space already reserved the same day, to close out the first-scored-question layout jump for good.
- Gate the Craft Prize eligible-list copy button behind Manual Drumroll Control.
- Center the tutorial's closing step instead of spotlighting Clear Session, widen the Round 2 Q2 tutorial spotlight to the whole question card and then to Sort and Reset together, and fix more typos in the tutorial.

## v18.12 - 2026-08-18
- Redesign the Question Timer with halo-ring alert states, icon-only Start/Pause/Resume buttons, and a calmer 2.9s critical-state pulse.

## v18.11 - 2026-08-17
- Add two Question Timer steps to the tutorial — start the at-default 3-minute timer right after scoring the first question, then revisit it before Export & Data to see elapsed time and reset it.

## v18.0 – v18.10 - 2026-08-16
- Add Tutorial Mode: a hands-on spotlight walkthrough of a full practice game (own team, guess, +5 bonus, the whole wager cycle, halftime, Score Audit, light/dark and color-vision, craft prize drumroll, PDF/JD exports) that never touches the real session. Back navigation; typo-safe confirm steps that never silently auto-advance; Finish leaves the practice game live to keep playing with, while Clear Session starts a real one. Also makes Craft Prize Drawing start collapsed by default like every other section.
- A run of same-day refinements followed: confirm before starting the tour over a real game in progress, lighter spotlight dimming with centered no-target/off-screen support, Round 2 reordered before Halftime to match the real page layout, a watch-then-try-it-yourself Sort demo with a repositioned tooltip that measures its own real rendered height so it stops covering the Sort button, a bar-staff shout-out step, mobile-aware "tap"/"click" copy re-evaluated live on resize/rotation, and a fallback Next button on the PDF/JD Upload steps in case their click isn't detected.
- Rename "Score Audit" to "Team Report" throughout the app and its tooltips/comments.
- Force PDF/XLSX exports to open in a new tab instead of navigating the current one away — fixes iOS Safari wiping Tutorial Mode's practice game on a PDF tap, since it ignores the download attribute and reloads in place.
- Add an X close button to the resume/new game banner so it can be dismissed without picking either option.
- Note in the tutorial's PDF export step that the download is ready to send to JD, and move the Quiz ID/Host Name tutorial tooltips above their fields.

## v17.6 - 2026-08-16
- Fix the Settings panel running off the bottom of the screen on notched/Dynamic-Island phones, cutting off the CLOSE button — its max-height was a flat 80px guess at the header's height above it, which didn't grow when the header's own top padding grew to clear the Dynamic Island. Subtract `env(safe-area-inset-top)` from the panel's max-height so it shrinks in step with the taller header, and `env(safe-area-inset-bottom)` from both the max-height and the panel's own bottom padding so the CLOSE button lands above the home indicator instead of under it.

## v16.31 - 2026-07-29
- Add a "Craft Prize Eligible List" row to Advanced Settings — 📋 Copy and 📄 TXT — so the drawing can be handed off to a separate drumroll or name-picker app that owns its own audio. Both use the same pool the in-app drawing would, Exclude Top N included, so the outside draw is over exactly the teams this app would have drawn from.
- Names only, one per line: that's what those apps take on a paste, and CSV columns or JSON keys would just land on the wheel as junk. The filename follows the existing exports (`Venue - MM-DD-YYYY - Craft Prize Eligible.txt`).
- Copy falls back to a hidden-textarea `execCommand` when `navigator.clipboard` is missing — which is what a laptop serving this over plain http on venue wifi looks like — and confirms with a momentary "✓ Copied" on the button rather than a toast the app doesn't have. Exporting with no teams, or with every team inside the excluded top N, says which of the two it is instead of handing over an empty file.

## v16.30 - 2026-07-29
- Add a "Thank the Staff" prompt directly under the halftime wager — the one real pause in the night, and the point where the room still has drinks left to order. Three cheeky lines to rotate through with the 🔄 button, each naming the staff inline so the host reads the names off the same block they just finished scoring instead of scrolling back to Event Details mid-game.
- The block carries its own copy of the Restaurant Staff field, so a host who never filled it in can add the names on the spot. Both boxes write the same `meta.staffNames`: typing in one pushes the value into the other and re-words the line live, without a re-render — a full render mid-typing would take the caret with it. The editor is deliberately not gated behind the Event Details lock, since the whole point is entering the names late and no score depends on the field.
- With no names entered the line still reads aloud fine — it falls back to "your servers and bartenders tonight" rather than leaving a gap.

## v16.29 - 2026-07-26
- Ask WebKit to treat the app's audio as "ambient" (`navigator.audioSession.type`), so the drumroll mixes with whatever else the iPad is playing instead of taking the audio session for itself. Without it, iOS gives any page that plays audio an exclusive "playback" session and pauses the host's music app the moment the roll starts. This is the same failure the existing audio rules are written against, arriving by a different route: those rules keep the app from claiming a session before it is asked to, and this keeps the session it does eventually take from being an exclusive one. Neither one alone keeps the music playing.
- Set once at load rather than per-play, because the type applies to the page and has to be in force before the first play to have any effect. Assigning it is a declaration of intent, not a claim on the session — no element is built and nothing is decoded — so unlike a priming play() it is safe to do at load. Feature-detected and wrapped, so browsers without the API are unaffected and a partial implementation that rejects the assignment cannot block the drumroll.
- Still needs confirming on the iPad itself, as the installed PWA with music already playing — desktop Safari and Chrome do not exercise this path.

## v16.28 - 2026-07-26
- Close the last of the gap at both drumroll handovers. The audio was already starting within a millisecond of being asked to, but the roll was being left running over the top of it: the work that stops the roll is driven by the incoming clip's "playing" event, and that event waits its turn behind whatever else the main thread is doing. A full re-render (~10ms) and the name-flash and countdown repaints were all landing in exactly that window.
- Re-renders now always run in a later task than the handover they follow, and the flash and countdown intervals are stopped before the finale rather than after it. Pressing Stop Drumroll: the fade starts 0.2ms after the click and the roll stops 0.15-0.26ms after it, so the two line up within about a seventh of a millisecond — roughly seven samples. The automatic ending: the roll stops 0.01ms after the horn begins.
- Cued clips are also played through once, muted, when they are armed at the start of a draw. An element's first play after being given a new source blocks for around 10ms inside the call itself, and that was time spent with both clips audible.

## v16.27 - 2026-07-26
- Add a Drumroll Crossfade slider to Settings, from 0.2s to 3.0s (default 1.2s), controlling how long the roll takes to wind down when "Stop Drumroll" is pressed.
- To make the length adjustable, the fade is now built on demand instead of shipped finished: the app carries one seamless loop of the roll as raw PCM and renders the fade to a WAV in plain JavaScript, applying the envelope over a typed array. That is arithmetic, not audio playback, so it needs no Web Audio and touches nothing on the device's audio session. Pre-rendering a clip for every position the slider can reach would have cost megabytes and still quantised it. Only one built clip is kept alive at a time, so dragging the slider doesn't leak a blob per notch.
- The handover stays gapless at every setting, and the fade still opens at the roll's own level, so a longer setting just winds down more gradually rather than sounding different.
- Fix the Settings panel showing stale values until the first re-render. Prefs are applied on load now, so Row Density, Timer Pulse, the crossfade slider and the rest open showing what is actually saved rather than the defaults written into the page. The values were being saved correctly all along; only the panel was out of date.

## v16.26 - 2026-07-25
- Make "Stop Drumroll" hand over to the fade smoothly instead of sounding like one clip stopping and another starting. Two separate faults were doing that. Reassigning the src on the element that was mid-playback cost ~30ms of real silence while the browser tore down and reloaded it, and the roll lands a beat every ~47ms, so the swap punched a hole through most of a beat. On top of that the fade clip began at a quiet point in the roll, 2.8 dB below the roll's own level, so it audibly dropped in volume just as it started.
- Fade and finale clips are now pre-loaded into their own audio elements, unlocked during the drumroll tap and left sitting ready, so cueing one is just a play() on a warm element with nothing to load. The roll keeps playing until the incoming clip reports it is actually producing sound, so the two overlap by a fraction of a millisecond rather than leaving a gap; both clips open with an 8 ms ramp-in so that overlap sums cleanly. Both were rebuilt to start at a point in the roll matching its overall level, so there is no step either. Measured handover gap went from 29.5 ms of silence to none.
- The same treatment applies to the automatic ending, which had the identical gap in it.
- Remove the Date Format chooser from Settings. MM-DD-YYYY was already the default and the DD-Mon-YYYY alternative went unused, so the setting and the second format are gone rather than carried forever.

## v16.25 - 2026-07-25
- Overlap the drumroll's fade-out with the victory horn when the drawing ends on its own. The roll had been cut dead the instant the horn started, which read as choppy. The single `<audio>` element the app uses can only play one thing at a time, so the overlap is pre-rendered: the automatic ending is now one clip containing the horn with the roll fading out underneath it over 1.0s. The roll enters that clip at exactly the level it was already playing at, so the swap into it can't be heard. The manual "Play Horn" button is unchanged and still plays the horn on its own — by the time it's reachable the roll has already been faded out by "Stop Drumroll", so there's nothing to overlap.
- Re-encode the standalone horn clip from WAV to MP3 to pay for the new overlapped clip, keeping the bundle roughly the size it was. That clip always starts from silence, so unlike the roll-spliced clips it doesn't need to be uncompressed.

## v16.24 - 2026-07-25
- End the drawing on the horn instead of the old drum stinger. That stinger had a drum tail baked into it, and its beats didn't line up with wherever the roll happened to be when it was cut, so the handover sounded discordant. The automatic ending now plays the same drum-free horn the manual "Play Horn" button already used, and the unused stinger clip is gone from the bundle.
- Make "Stop Drumroll" wind the roll down over 1.2s instead of cutting it off. The previous fade ramped the audio element's volume, which does nothing on an iPad — iOS Safari ignores volume writes entirely and reserves playback level for the hardware buttons — so the roll just stopped dead there. The fade is now a pre-rendered clip of the same roll material under a raised-cosine envelope, which sounds the same on every device. It starts at the level the roll was already playing at and ends at true silence, so neither the splice nor the tail clicks.

## v16.23 - 2026-07-24
- Fix the drumroll skipping roughly every 2.4s. Moving off Web Audio in v16.22 left the middle section playing on an HTML5 audio element with `loop = true`, and a media element's loop restart is not gapless — it seeks back to zero and drops a few milliseconds each time, which on a continuous snare roll reads as a stutter. (Web Audio's loop had been sample-accurate, which is why this never happened before.) The roll is now a single pre-rendered 32.6s clip — the intro followed by 13 copies of the loop, butt-joined offline — so nothing loops or crosses a clip boundary while it plays, at any countdown length up to the 30s maximum.
- Lay the desktop Settings panel out vertically. It had been stretching to the full window width and flowing its rows into five side-by-side columns, with each label and its control pushed to opposite ends of a very wide row. It's now a 440px column anchored under the gear icon that opens it, matching the single-column list the same panel already used on phones.

## v16.22 - 2026-07-24
- Stop the app from taking over the device's audio session until the host asks for it. The drumroll had been building an AudioContext and decoding its ~1.1MB of clips at page load as a warm-up, and on iOS merely constructing an AudioContext claims audio priority — so simply opening Scorekeeper on an iPad ducked or stopped music playing on that same iPad. All Web Audio use is gone; the drumroll now runs on one plain `<audio>` element that is created lazily on the first tap of the drumroll button, reused for every clip and every draw after that, and never touched before then.
- Play the drumroll's first clip synchronously inside the button's own click handler, with nothing awaited in front of it, so iOS counts it as a direct user gesture and the later intro→loop→stinger swaps are allowed to fire from timers on that already-unlocked element.
- Replace the Craft Prize Drawing section's always-visible controls with a single "🍺 Choose Craft Prize Winner" button that reveals the flow when tapped; the drumroll button inside it is now labelled "🥁 Start Drumroll" so the two aren't confusable mid-show. A running draw or an already-picked winner opens the flow on its own, so a reload never hides a result behind the button.
- Known consequence of dropping Web Audio: because iOS Safari ignores writes to an audio element's volume, "Stop Drumroll" cuts immediately on iPad instead of fading out.

## v16.21 - 2026-07-20
- Move the Play Horn button in the winner block onto its own line below "🏆 Team won! ✕ Clear", instead of sharing that row.

## v16.20 - 2026-07-20
- Add a "Manual Drumroll Control" setting (Settings panel, off by default) that reveals "⏹ Stop Drumroll" and "🎺 Play Horn" buttons on the craft prize drawing. With it on, the host can cut the drum loop the moment a staff member reveals the winning paper and then fire the horn on their own cue, rather than being locked to the countdown's timing.
- Show those two buttons faded and disabled before a draw starts, so the host discovers the controls exist ahead of time instead of only once a drumroll is already running.
- Add a separate drum-free horn.wav for manual horn playback — the automatic end stinger has a drum tail baked in that reads fine as a loop→stinger transition but sounds wrong on its own.
- Fade the drum loop down over 0.5s on a manual stop instead of cutting it off mid-beat.
- (Versions v16.17–v16.19 were never released; the in-app label jumped from v16.16 to v16.20.)

## v16.16 - 2026-07-19
- Center-align Score Audit stat tile labels so wrapped two-line text ("Adjusted Score", "Score Guess") doesn't default to left-aligned at mobile widths.

## v16.15 - 2026-07-18
- Combine Score Audit's separate Bonus Item and NJCB tiles into a single "Diff Adj" figure shown alongside Adjusted Score, Diff, and Score Guess.

## v16.14 - 2026-07-18
- Redesign Score Audit's Adjusted Score/Diff/Score Guess and adjustment tiles as single divided cards separated by vertical rules, instead of a row of individually bordered boxes.

## v16.13 - 2026-07-17
- Fix the settings panel springing back open after loading sample or saved data and after re-scoring a team. Closing it only updated the DOM and left the persisted `settingsOpen` pref set, which every subsequent render reapplied.

## v16.12 - 2026-07-17
- Remove the redundant subtotal shown after Final Wager in Score Audit.
- Group the Score Audit stat tiles by relationship rather than listing them in a flat row.
- Fix the gap above the audit's sticky header that let content peek through while scrolling.

## v16.11 - 2026-07-16
- Fix the top header losing its sticky position in an installed (standalone) PWA — it was missing the same GPU-layer-promotion fix already used on the round-progress bar/audit header/settings header, which regular Safari tabs mostly get away without thanks to the address bar's collapse-on-scroll forcing frequent recalculation.

## v16.10 - 2026-07-16
- Reorder the Score Audit's Guess/Diff tiles: Diff then Score Guess when a team has no bonuses; Bonus Item/NJCB, Adjusted Score, Diff, then Score Guess when it does.
- Move the Extras (Bonus Item/NJCB/adjustment) block to sit full-width above the two-column round breakdown instead of inside column 1, so both columns start balanced at Round 1/Round 3.

## v16.9 - 2026-07-16
- Show Bonus Item/NJCB minuses and the resulting adjusted score in the Score Audit's Guess/Diff tiles, so it's clear why Diff isn't just Score − Guess.
- Add a drop shadow under the Score Audit's sticky team-name header so it visibly separates from content scrolling beneath it.
- Rework the mobile scores panel's drop shadow (docked and expanded) into three directional layers so the top/left/right edges actually show a visible glow in both themes, instead of a symmetric blur that mostly bled off past the narrow side margins.
- Split the Score Audit into two columns on desktop (Round 1/2/Halftime Bonus, then Round 3/4/Final Wager), with Grand Total and everything after it spanning both columns.
- Lower the desktop/mobile layout breakpoint from 900px to 768px — 900 was flipping ordinary laptop windows into the mobile single-column layout (and disabling the Final Results hover magnifying glass) well before they actually ran out of room.

## v16.8 - 2026-07-16
- Collapse the mobile scores sheet down to the docked panel's own height (instead of sliding fully offscreen) so it fades away right where the peek strip/timer are, instead of briefly overlapping them.
- Recenter the timer's reset icon, which sat visibly low in its button.
- Add a sticky "Settings" header in the mobile settings panel, and fix touch-scrolling inside it (especially with Advanced Settings expanded).
- Fix the round-progress bar occasionally detaching from the top and scrolling away with the page on mobile.
- Remove the whole-row hover highlight in Final Results and rely on the magnifying glass alone as the hover cue.
- Fix the Score Audit correct/incorrect breakdown to include the Round 1/3 Beer Round bonus answers and the Round 2/4 Halftime/Final wagers (26 questions total), not just the 16 regular round questions.

## v16.7 - 2026-07-16
- Hide the stray native file-picker button that was rendering on the main page (missing display:none on the new App Preferences file input).
- Widen the mobile docked scores peek strip and narrow the deployed scores sheet so their widths match instead of the sheet flaring out wider when opened.

## v16.6 - 2026-07-16
- Move Session Data save/load back to the header toolbar; keep only App Preferences in Advanced Settings.
- Add the final score guess and its difference below Grand Total in Score Audit.
- Restyle the timer's Pause button as a gold outline instead of a solid gold fill.

## v16.5 - 2026-07-16
- Fix the sticky round-progress bar changing height as its text changes between "in progress" and "all rounds scored".
- Reserve space for the timer's minus sign so it stops jumping in width once the countdown goes past 0:00.
- Add a Timer Pulse toggle in Advanced Settings to turn off the timer's low-time flashing.
- Add a way to save/load just app preferences (theme, size, timer settings, etc.) separately from a full game session.
- Move Session Data and App Preferences save/load buttons from the header into Advanced Settings.
- Lighten the "closer" tiebreaker badge's green on Final Results so its text passes WCAG AA.
- Add an overall correct/incorrect breakdown (count + percentage) under Grand Total in Score Audit.

## v15.6 - 2026-07-13
- Add a live correct/incorrect breakdown (count + percentage) for each question and for the halftime/final wager, updating in real time as teams are graded.

## v15.5 - 2026-07-10
- Inset the mobile scores peek strip to match the section box width and add breathing room between the last section and the peek strip when scrolling.

## v15.3 - 2026-07-10
- Split the Round 2/4 bonus wager header onto two lines instead of shrinking its font.
- Move the craft prize's golden background/border to the whole drawing section instead of just the winner line.

## v15.2 - 2026-07-10
- Round the mobile scores peek strip's corners and fix chevron/text size mismatches.
- Responsive-shrink the Round 2/4 wager header text.
- Add a golden beer-round background for dark mode and for the craft prize winner.
- Rename the settings close button to CLOSE.

## v15.1 - 2026-07-10
- Hide the standings chevron on desktop.
- Color-fill the result ✓/✕ buttons to match the wager buttons.

## v15.0 - 2026-07-10
- Rebuild the mobile scores view as a bottom sheet with a centered peek strip.
- Dim backgrounds behind expanded panels; fix and animate chevron directions throughout.
- Add NJ brewery + town autocomplete and a drumroll countdown.
- Fix scroll-jump, drag, and layout bugs across Final Results and the craft prize UI.

## v14.0 - 2026-07-09
- Fix a PWA loading bug, fix Sort/Reset not collapsing correctly, and fix resuming an existing game vs. New Game state.
- Add theme-aware panel shadows, a drumroll countdown, a draggable scores tab, and craft partner/town autocomplete.
- Fix scroll jump on collapse.

## v13.2 - 2026-07-06
- Swap Final Results' mobile Guess/Diff to inline mini-labels (e.g. "G 23 | D +4") instead of a labeled-sentence layout.
- Change Craft Prize's Clear button to a small rounded X so it fits alongside the winner's name; long names wrap onto a second line.
- Enlarge the small X used to remove a team.
- Rework the mobile Final Results Guess/Diff pairing to stay tightly and consistently spaced regardless of digit count.

## v13.0 - 2026-07-05
- Trim the standings sort controls down to Entry and Random on the before-halftime/before-final-wager scoreboards.
- Shorten the Q5 titles (Round 1/3 now reads "0-4 x 5 PTS"; Round 2/4 just shows its point range).
- Swap the Final Results column head to "| DIFF | / GUESS *".
- Collapse the tie-break/Diff explanation under Final Results into a "› Details" disclosure by default.
- Make the Craft Prize Drawing note name the excluded teams instead of just stating a count.
- Drop the "next question" banter from Q5 Bonus/Bonus Wager/Final Wager since they lead into a new round.
- Add a green "all answers finished" left-accent to Q5 Bonus questions; thicken that and the Beer Round gold accent from 3px to 6px.
- Split the merged Guess/Diff cell in Final Results back into two columns with a divider, keeping the +/- sign on Diff.
- Add an Advanced Settings "Edit Locked Fields" toggle to fix a typo in Event Details after scoring starts.
- Widen the Quiz ID format to also accept 4-letter/4-digit codes (e.g. ABCD-1234).
- Fix the beer-round highlight border color across themes.

## v12.0 - 2026-07-05
- Raise the header above the drag handle so the settings overlay doesn't get poked through.
- Give section/sidebar/question headers a distinct background; give every DONE/left/beer-round badge a matching stroke border and larger font for WCAG AA contrast in every theme and color-vision mode.
- Swap the beer-round badge/border to the AA-safe golden token everywhere it appears.
- Rework the halftime/final-wager standings into a narrower centered table with real vertical columns.
- Move that block's collapse chevron to the left to match question headers; fix its hover-state contrast.
- Rename the Final Results guess/diff column and align its Score column with the standings font/size/color.
- Shorten the sidebar's Random button label to RAND.
- Add Sort-by-Answer and Reset-Sort buttons to the Q5 bonus rounds.
- Move Point Adjustments and a hidden-by-default CSV/XLSM export toggle into a new collapsible Advanced Settings group.
- Add touch-action:manipulation app-wide to stop rapid taps from triggering double-tap-zoom.
- Add input validation and keyboard support so scoring can't start without a valid Quiz ID and Location.
- Fix the settings overlay's shadow and full-width close row.
- Give every top-level section and question container a real 3:1-contrast border.
- Cap the Event Details date picker's width; top-align the team-entry grid.
- Rebuild the halftime/final-wager standings to look like Final Results (full-width table, left-aligned names, real column headers).
- Make the whole title row (not just the chevron) collapse that section; move its banter/sort buttons inside the collapsible area.
- Add the same banter treatment to Q5 Bonus and Bonus/Final Wager sections.
- Trim DONE/left/beer-round badges so they no longer make their header row taller.
- Keep Final Results column headers visible on mobile.
- Force a synthetic mousemove after every re-render so the cursor doesn't get stuck on the default arrow after a tap replaces the DOM.
- Give the CB Prize badge/row a golden WCAG-AA border.
- Add a +/- sign to the Final Results |DIFF| value.

## v10.39 - 2026-07-04
- Fix web app install on iOS.
- Add a JD Jotform upload link.
- Add a bonus diff disclaimer; add mobile top/bottom padding.
- Add a searchable Location datalist, rename the section to Event Details, add a Craft Prize Clear button, and add a QA test plan.

## v10.36 - 2026-07-03
- Fix contrast and accessibility on text and numbers in the scoreboard.
- Run a full WCAG AAA audit and apply follow-up fixes.
- Replace native accent-color checkboxes with custom-drawn checkmarks to fix unverifiable/failing icon contrast.
- Brighten light-theme ITEM/NJCB colors to AA; add a real focus-visible ring.

## v10.33 - 2026-07-02
- Rank badges in the scoreboard are now rounded squares with a larger, bolder font.

## v10.32 - 2026-07-02
- Fix low-contrast gold/green text on tinted backgrounds (checkboxes, round wager labels, X-left/Done badges) across all themes and color-blind modes.

## v10.31 - 2026-07-02
- Add stepper buttons to craft prize sliders.
- Restyle team bonus/NJCB checkboxes for size and accessible contrast.
- Reflow the desktop settings panel into a grid with a 19px size option.
- Fix choppy drumroll looping via the Web Audio API.

## v10.30 - 2026-07-02
- Add PWA installability (manifest, offline service worker, icons).
- Add tritanopia color mode.
- Add keyboard accessibility for div-based controls.
- Cut craft-prize flash re-renders from full rebuilds down to a single text update.

## v10.29 - 2026-07-02
- Fix Final Results collapsing back open when changing exclude-top-N.
- Auto-sort the scoreboard ascending after a craft prize reveal.
- Clean up winner script wording.

## v10.26 – v10.28 - 2026-07-02
- Re-order the settings panel; add a sample game to load.
- Fix the drag-handle ghost line; freeze per-question sort until re-clicked.
- Add a craft prize randomizer with drumroll audio and a spoken winner script; exclude top-ranked teams from the drawing.
- Stop the end stinger from playing before the timer finishes.
- Make the craft prize randomizer single-winner only (no multi-draw) and move it from the mobile Scores sidebar to its own section under Final Results.

## v10.25 - 2026-06-30
- Restore the resizable score/scoring split.
- Revert XLSX naming back to XLSM.
- Narrow and enlarge the Before-Wager standings.
- Default both standings to entry-order sort.
- Stop the scroll jump on Round 1/3 bonus picks.

## v10.24 - 2026-06-30
- Relabel exports to New/Old XLSX and ship the macro template as .xlsx.
- Fix dark-mode sort button and light-mode active button contrast.
- Remove the drag handle and per-question All-correct/incorrect buttons.
- Enlarge and recolor points boxes across all themes.
- Restructure the bonus title onto two rows with a larger counter badge.
- Stack the settings panel into full-width rows on mobile.

## v10.22 – v10.23 - 2026-06-29
- Bonus round redesign, sort support, and a color-blind toggle.
- Add host banter throughout the app.
- Show remaining teams to grade on Round 2/4 Bonus Questions and make that question collapsible.
- Fix a bug where the desktop view scrolled to top on a scoring click.
- Fix the app misbehaving when adjusting column widths; require team final score guesses.
- Make the whole app mobile-responsive down to very narrow screens.
- Add PDF export; standardize export file naming to "Venue - MM-DD-YYYY".
- Standardize JSON save export naming to "MM-DD-YYYY-save".
- Fix a Chrome-specific bug where data wasn't displaying.
- Make the Round 1/3 bonus question collapsible; adjust Light Mode highlighter colors; increase contrast on the 1/2/3 rank badges.

## v9.8 - 2026-06-04
- Remove the developer's name from the title and page (renamed to "Score Keeper").
- Change the Round 2/4 wager picker to stepper buttons.
- Add beer-round visual feedback and collapsible questions; move the beer-round alert into the header.
- Add team audit, bonus wager typing, and Round 1/3 zero-correct-answer submission.
- Add a beer round for all bonus questions; add sorting for Round 2/4 score updates.
- Re-add XLSX export as an option; add a date display option; use an American-style date format in XLSX/XLSM exports.
- Fix zebra stripes on the final score table.

## v9.1 - 2026-05-27
- Add zebra-stripe row options.
- Fix the version label to correctly read v9.1.

## v6 - 2026-05-27
- Initial Claude-assisted refactor of the original prototype: bigger buttons, bigger numbers, bigger correct/incorrect wager badges, and general readability/layout cleanup.
- Rework the wager checkboxes.

## Pre-v6 - 2026-05-26
- First working version of the scorekeeper: initial HTML/CSS/JS, page title and heading.
