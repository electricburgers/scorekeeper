# Changelog

All notable changes to the Scorekeeper FAQ site are documented here.

## [1.26] - 22 Aug 2026

Full re-audit against the main app, which had drifted ahead of this page across
v18.90–v18.101 (v19.16–v19.27 in the app's own renumbered changelog) — the last
real content sync here was v1.21, back at v18.80.

### Fixed

- **The Settings gear is pinned to the true top-right corner of the page now,
  matching the main app's own gear, at every width** — not just at the
  narrow widths it already handled correctly. It was positioned against
  `.faq-header-row`, which caps at `max-width:900px` and re-centers on wide
  screens; past ~930px wide that left the gear sitting well inside the page,
  at the centered column's edge, while the app's own gear (no such cap on its
  header) sits flush against the real viewport corner. Repositioned against
  `.faq-header` itself instead, inset by the same padding the app's header
  uses, so the two now land in the same spot at every screen size, not just
  on phones.
- **"What's in the main Settings list?" and the Settings panel screenshot's
  alt text both still described a layout from before the app's own Settings
  reorganization** — claiming Row Density and Row Zebra Stripes as main
  Settings rows (they moved into Advanced Settings a while back) and missing
  Icon Style and App Preferences entirely (both real main-Settings rows
  today). Rewritten to the actual current order: Theme, Size, Icon Style,
  Color Vision, Question Timer, Sample Data, Help, App Preferences, Advanced
  Settings.
- **The Advanced Settings screenshot and its alt text were further out of
  date still** — showing "Per-Question Percentage Correct Labels" (renamed to
  Crowd-Wisdom Percentage two names ago), Drumroll Crossfade always visible
  instead of gated behind Manual Drumroll Control, and App Preferences
  included as if it were an Advanced row rather than the main-Settings one it
  actually is.
- **Three Advanced Settings rows had no FAQ entry at all: Row Density, Row
  Zebra Stripes, and Point Adjustments.** The first two used to be documented
  as main Settings (see above, now corrected); Point Adjustments lost its
  entry back in 1.9 "ahead of its planned removal from the main app" — a
  removal that, checked against the app today, never actually happened. All
  three now have real entries.
- **The "App Preferences" entry was filed under Tips & Tricks → Advanced
  Settings, but App Preferences is a main-Settings row, not an Advanced one.**
  Moved it out to sit as a general tip alongside "Tap any team's name" and
  "Use the Sort button," and fixed a Manual Save & Load entry that repeated
  the same "in Advanced Settings" claim about it.
- **Timer Stepper Buttons, Timer Pulse, and Drumroll Crossfade don't mention
  that they're hidden until their parent toggle (Timer Widget, Timer Widget,
  and Manual Drumroll Control respectively) is on** — true in the app since
  those rows started gating on their parent, never caught here. Each entry
  now says so.
- **"Take the Tour" was still drawn as its old graduation cap, with a 🎓
  emoji fallback, in four places** — the app redrew it to an ℹ️ info icon a
  while back. Updated everywhere it appears (Getting Started ×2, Interactive
  Tutorial, Settings).
- **"Score Audit" survived in three spots** — two screenshot alt texts and one
  cross-link label — after the app renamed the feature to "Team Report" a
  long time ago; the rest of this page had already caught up. Now consistent
  everywhere.
- **The Team Report screenshot itself had stale baked-in text**: the note at
  the bottom still read "Tip: each round shows…" with bare "Diff Adj" and
  "Adj. Score" labels and unspelled +/− signs — the exact wording the app
  changed in its last two releases (dropped "Tip:", spelled out "Diff Adj
  (Difference Adjustment)" / "Adj. Score (Adjusted Score)", spelled out "A
  plus (+)" / "a minus (−)"). Recaptured against the live app, dark and
  light.

### Changed

- Recaptured `settings-panel.webp` and `advanced-settings.webp` (dark and
  light) against the current app to match the corrected order and content
  above — the old pair predated Icon Style existing at all and still showed
  v18.73 in its own footer.

### Changed

- **The drawn beer mug's handle is taller** in both places it appears here (the Beer Round
  callout, the CB Prize tag), matching the main app's own mug icon getting the same fix.

## [1.24] - 22 Aug 2026

### Changed

- **The "Crowd-Wisdom Percentage Tags" entry is now titled "Crowd-Wisdom Percentage"**, matching
  the main app dropping "Tags" from the same Advanced Settings row. Same answer text underneath,
  unchanged.

## [1.23] - 22 Aug 2026

### Changed

- **The "Per-Question Percentage Correct Labels" entry is now titled "Crowd-Wisdom Percentage
  Tags"**, matching the Advanced Settings row it documents after the main app renamed it. Same
  answer text underneath, unchanged.

## [1.22] - 22 Aug 2026

### Changed

- **Craft Prize Drawing's manual-pick paragraph (new last version) now says outright when to
  reach for it**: whenever the winner isn't coming from this app's own random draw, most often
  because a bar or restaurant staff member is the one actually choosing — from behind the bar, a
  jar of tickets, however that venue runs it. Tap their team in once staff announces it, and the
  winner banner and exports reflect the real result.

## [1.21] - 22 Aug 2026

### Fixed

- **A real factual error, not just stale wording: the Score Audit entry claimed tapping a team's
  name in the Scores sidebar opened the Team Report, and it doesn't.** Checked against the actual
  running app rather than assumed from a first code read (the first pass here missed it too —
  `buildScores()` renders the sidebar's own rows through a different path than every other team
  name, and it wires them to `toggleCraftPrize()`, not `openAudit()`). Tapping a name there sets —
  or clears — that team as the Craft Beer Prize winner directly, no drumroll. Fixed in two spots:
  the Score Audit entry no longer lists the sidebar among the places it opens from, and a new
  paragraph in Craft Prize Drawing documents the manual pick itself, cross-linked from both
  directions.

## [1.20] - 22 Aug 2026

### Fixed

- **Icon Style's emoji center properly now**, same fix as the main app: `.faq-emoji-ph` gets
  `line-height:1` so the flex-centered gear and round X buttons center the actual glyph, not a
  taller inherited line-box with the glyph riding off-center inside it.

### Added

- **The main Settings list now mentions Icon Style** (Pictograph/Emoji) — it existed in the app
  and on this very page already, but nothing in the FAQ's own settings rundown said so. Also
  notes that this page has the same toggle, in its own panel, and that this page's own icons
  follow it.

## [1.19] - 22 Aug 2026

### Fixed

- **The gear button now stays pinned to the top-right corner at every width.** It used to be a
  flex child of `.faq-header-actions`, riding along with "← Back to Scorekeeper" — at narrow
  widths where the header wraps (the logo drops to its own line), the whole actions group wrapped
  with it, landing the gear wherever "Back to Scorekeeper" happened to end rather than the corner
  of the page. It's `position:absolute` against `.faq-header-row` now (not `.faq-header` itself,
  which would have pinned it to the raw viewport edge instead of the row's own max-width:900px
  centered content on wide screens) — out of the wrapping flow entirely, so it can't drift.
- **One more audit pass, this time for engineering language rather than emoji** — the Question
  Timer entry (rewritten last version to describe the real icon-only button) mentioned
  `aria-label`, an HTML attribute name with no reason to appear in a reader-facing answer. Reworded
  to just say what the button does. A full pass over the rest of the page's wording didn't turn up
  other cases of implementation detail standing in for plain description.

## [1.18] - 22 Aug 2026

### Fixed

- **A full wording audit for leftover emoji and stale UI descriptions.** The Question Timer entry
  described the Start/Pause/Resume/Reset controls as labeled `▶ Start`/`⏸ Pause`/`↺ Reset`
  buttons — the app dropped those Unicode glyphs (and the text labels) versions ago in favor of
  icon-only buttons whose shape swaps with state, so the entry now shows the actual play/pause/
  reset pictographs and describes the one-button-two-states behavior for real. Three more spots
  ("trying the Sort button", "Use the Sort button to find who hasn't answered", "Sort and Reset
  buttons") had the same bare `↕`/`↺` characters in place of the drawn icons the buttons have
  used since the main app's own icon sweep; Manual Drumroll Control's "▶ Play Horn" mention gets
  the actual play-triangle pictograph in place of a plain triangle character. All five are tagged
  `data-emoji` like everything else, so Icon Style reaches them too.
- Checked the rest of the page against the current app for description drift — no other stale
  feature references turned up (the removed Q5 pictographs, the old up/down guess-field spinners,
  and the team-name hover magnifier are all correctly absent already).

## [1.17] - 22 Aug 2026

### Fixed

- **Fixed the huge, wrong gaps around a question's inline pictograph/emoji** — e.g. `What
  happens when I click 🥁 Start Drumroll?` was rendering as the icon and the trailing text each
  shoved out to their own far corner. `.faq-item summary` is `display:flex;
  justify-content:space-between`, built for exactly two children (the question text, the
  `.faq-q-arrow` chevron) — every Icon Style `data-emoji` svg or emoji span sitting mid-question
  was a direct child of that flex row too, so space-between spread however many text-runs and
  icons a question had evenly across the whole row instead of just pushing the arrow to the end.
  The question text (icons and all) is now wrapped in one `.faq-q-text` span, so the row is back
  to exactly its intended two flex items regardless of how many pictographs a question's title
  has.

## [1.16] - 22 Aug 2026

### Fixed

- **The Theme button now follows Icon Style too.** It was hardcoded plain-text emoji
  (`"🌑 Dark"` / `"☀️ Light"`) set directly in `faqApplyDisplayPrefs`, wired up before Icon Style
  existed and never brought in line with it — the one pictograph on the page the toggle couldn't
  reach. It now renders the same drawn sun/moon `.icon-ui` svg (tagged `data-emoji`, same as
  everything else) in Pictograph mode and swaps with the rest in Emoji mode.
- **Dark uses 🌙 (crescent moon), not 🌑 (new moon).** 🌑 is a plain dark disc with no crescent
  shape at all — barely reads as "moon" next to ☀️'s sun. 🌙 is also what the main app's own
  Icon Style toggle already uses for Dark (`THEME_ICON_MOON_EMOJI`), so the two now match.

## [1.15] - 22 Aug 2026

### Added

- **Settings > Icon Style, same Pictograph/Emoji toggle the main app got.** Every one of this
  page's 38 drawn pictographs — content and settings-panel icons alike — is tagged
  `data-emoji="…"` in the markup; toggling swaps each `<svg>` for a plain text span holding that
  emoji (caching the svg's own markup on the span so switching back restores the exact element,
  rather than keeping a second copy of every icon in this file). Shares the same `iconStyle` field
  in `trivRev6_prefs` the main app's toggle writes, so a choice made on either page carries over
  to the other, same as Theme/Color Vision/Text Size already do.

### Changed

- **The Color Vision entry is three four-panel images now, one per mode, not one four-panel
  image comparing the three modes.** Each image — Off, Red-Green, Blue-Yellow — shows four
  DIFFERENT parts of the app changed by that one mode: the real wager correct/incorrect buttons
  (an actual screenshot crop), the Bonus/NJCB team checkboxes, the Beer Round section, and the
  Final Results tie badge, each panel's colors pulled directly from that mode's own CSS tokens
  (`--item-border`, `--njcb-border`, `--beer-bg`/`--beer-border`, `--badge-green-fg`) rather than
  screenshotted live, since three of the four never render together on one screen at once. This
  also makes the "nothing changes here" cases visible on their own terms: the checkboxes and Beer
  Round panels are pixel-identical between Off and Red-Green (that mode only swaps green/red),
  and the tie badge is identical between Off and Blue-Yellow (that mode only swaps the blue/gold
  pair) — each image shows its mode's real footprint, not a padded four-for-four.

## [1.14] - 22 Aug 2026

### Changed

- **This page is no longer a separate site.** It moved from its own repo (`scorekeeper-faq`,
  checked out at `faq/scorekeeper-faq/` and git-ignored by the app) into the Scorekeeper repo
  itself, at `faq/`, tracked like every other file here. `css/styles.css` — a byte-for-byte copy
  kept in sync by hand across two repos — is gone; this page now links `../css/styles.css`
  directly, so the two can never drift again. The main app's Settings > Help link now opens
  `faq/index.html` instead of the old GitHub Pages URL, and this page's own "← Back to
  Scorekeeper" link points at `../index.html`.
- **Every remaining emoji became a drawn pictograph**, matching the sweep the main app finished
  across v18.57-v18.73: the gear, the Try Example flask, the Take the Tour cap, Save, Load, the
  FAQ/help mark, the alert triangle, Sort/Reset's arrows, the beer mug, the drum, the PDF/XLSX/
  TXT icons, the shuffle die, and the rest. Two orphans with no in-app equivalent ("🙏 Thank the
  Staff", the "📊 Scores panel") lost the emoji outright rather than getting a pictograph invented
  for the occasion — the Scores panel one traded up for the sidebar's own bar-chart mark, which
  does have a real counterpart.
- **The Settings panel now matches the main app's**, not just its color tokens: a round red X in
  the header closes it (`.settings-x-btn`, restyled in from the app's own mobile-sheet CSS since
  this panel is never wide enough to earn a separate desktop layout), and the unstyled "Close"
  button that used to sit at the very bottom is gone — the app dropped that pattern in favor of
  the header X a while ago and this page had not caught up. The toggle button itself is icon-only
  now (a gear, nothing else), same as the app's own.
- **Color Vision gets its swatch preview in the closed dropdown**, not just inside the open menu:
  picking Red-Green or Blue-Yellow now shows the two colors it swaps to right next to the label,
  mirrored from the main app's own Settings > Color Vision row.
- **The Color Vision FAQ entry's three separate screenshots became one four-panel comparison
  image** — the same wager row in Off, Red-Green, and Blue-Yellow, plus a fourth legend panel
  spelling out every swapped pair (including ones the first three panels don't show on their own,
  like the Beer Round gold and the NJCB checkbox border). The entry also now says outright that
  this one comparison image is fixed and does not follow the reader's own theme the way every
  other screenshot on this page does — see the next point.
- **A first for this page: an explicit mention that screenshots change with Light/Dark theme.**
  `faqApplyThemedShots()` has quietly done this since v1.13, but nothing on the page ever told a
  reader it was happening — a Light-theme reader comparing what they see against a Dark-captured
  shot elsewhere (the fixed comparison images, this page's own README) had no way to know why they
  didn't match. Called out both on the Color Vision entry and in the intro.
- Settings gained one screenshot — the main Settings panel — since that whole section had none
  before.

## [1.13] - Aug 2026

### Added

- **Screenshots now follow the reader's theme.** Every shot of the app UI ships twice —
  `<name>.webp` in Dark and `<name>-light.webp` in Light, same viewport, same scroll position,
  same 2x pixel ratio, so the pair is one frame in two themes rather than two loosely similar
  pictures. `faqApplyThemedShots()` already knew how to swap; what was missing was the files,
  so a reader on the Light theme got a page of dark rectangles. All 23 now exist, and the swap
  is live on load and on every toggle in both directions.
- `xlsx-export`, `pdf-export` and `jd-upload-form` lost their `data-shot-base` instead of
  gaining a Light variant. None of the three is a picture of the app — a workbook in a
  spreadsheet application, a rendered PDF page, a third-party form — so none of them changes
  with the theme, and keeping the attribute only made the page probe for a `-light` file that
  will never exist and 404 on every switch into Light.
- `mobile-bottom-dock.webp`, which `index.html` had referenced all along without the file ever
  existing — every visitor got the dashed placeholder in its place. Captured at 390x844 as the
  whole phone viewport rather than the dock alone, so the dock reads as pinned to the bottom of
  a screen instead of as a floating strip.
- Event Details: an "Is there a limit on how much I can type into a field?" entry covering the
  per-field character limits Scorekeeper added in v18.71 (Quiz ID 24, Host Name 40, Location 60,
  Craft Partner 50, Partner Town 40, Bonus Item 60, Restaurant Staff 200, team names 40, winner
  announcement script 600), the at-limit note the app shows on reaching one, and the fact that
  the limits also clamp values arriving from a loaded `.json`.

### Changed

- **`css/styles.css` re-synced from the app**, which it had not been since 15 Aug — 127K against
  the app's 208K. This page vendors the app's stylesheet precisely so it does not drift into its
  own palette, and it had drifted through the entire visual overhaul: every screenshot on the
  page showed the new look while the page's own chrome still showed the old one.
- The app moved its fonts from two variable files to five static weights and declares them in
  that stylesheet, so `fonts/` gains `inter-400/600/700` and `space-grotesk-500/700`. Without
  them the synced `@font-face` rules 404'd four times per load and silently fell back to the
  variable faces `css/fonts.css` still declares.
- **Every screenshot recaptured against Scorekeeper v18.73**, at a 2x pixel ratio from the app
  served over `localhost` with the sample game loaded, default text size, and animations frozen
  so repeat runs are identical. v18.73 removed all four Q5 pictographs, split the Beer Round
  header band on the special sections, and redrew Play Horn as a plain play triangle — all three
  were visible in the previous set.
- `theme-dark` / `theme-light` are now the same viewport, scroll position and pixel ratio as
  each other, so they read as a true side-by-side. They are captured at 1100 CSS px wide because
  below ~1040 a scoring row wraps its team name above its buttons, which is not how the pair
  used to show them.
- The colour-vision trio now frames a question whose first row is an incorrect wager and second
  row a correct one, and differs in nothing but the Color Vision setting. The sample game's
  bonus Q5 no longer puts an incorrect answer near the top, so the old crop had drifted into
  showing two correct rows — the one thing these three shots exist to contrast.
- `teams-list` was a Light-theme capture, the only one in the set, and still showed the up/down
  spinners v18.72 removed from the team guess field.
- `pdf-export` is re-rendered from a freshly exported PDF, so it shows the v18.70 layout — one
  four-field header row, with Craft Partner and Bonus Item beside the Standings table instead of
  in a second header row.
- `manual-drumroll-control` shows the paused half of the draw. Stop Drumroll and Play Horn are
  one button in two states, not two side by side, so the old shot and its alt text promised a
  pairing that cannot appear; the paused state is also the only one this setting adds. Its FAQ
  entry now says so, and names the button's two states in order.
- `score-audit` is narrower and taller than before. `.audit-modal` is capped at `32rem`, so the
  old, wider shot was taken at a larger Settings > Size than the rest of the set; this one is at
  the shipped default like its neighbours.
- `screenshots/README.md`: the Light variants section is no longer written as an optional extra,
  the Beer Round row no longer asks for a banner removed in app v18.57, and the
  `point-adjustments` row is gone — `index.html` stopped referencing that file in 1.9.0.

## [1.12] - Aug 2026

### Changed

- All screenshots converted from PNG to WEBP; every reference in `index.html`, `js/faq.js`,
  `README.md`, and `screenshots/README.md` updated to match (including the light-theme
  `-light.webp` naming convention).

## [1.11] - Aug 2026

### Added

- A manual Theme row (🌑 Dark / ☀️ Light) at the top of this page's own Settings panel, so a
  reader can flip the FAQ's theme directly instead of only ever inheriting whatever the main
  Scorekeeper app last set. Writes into the same `trivRev6_prefs` localStorage key the app
  reads/writes, so the choice carries over between the FAQ and the app in both directions —
  the same two-way match Text Size and Color Vision already had.

### Fixed

- `faqApplyThemedShots()` now also reverts a screenshot back to its dark-captured default when
  switching back to Dark mid-visit — previously it only ever swapped *to* the light variant,
  so a shot that had been swapped to `-light.png` stayed stuck there after toggling back.

## [1.10] - Aug 2026

### Added

- A version/date/disclaimer line in the Settings panel itself (`settings-meta`, right above
  Close), matching the pattern the main Scorekeeper app already uses in its own Settings panel.
  Both it and the page footer now read from one `FAQ_VERSION`/`FAQ_VERSION_DATE` pair in
  `js/faq.js` instead of two hand-written copies of the version string.

### Fixed

- Search highlighting shoving a matched question title away from its neighboring words. Each
  `<summary>` is a flex row (for the ▶ arrow's `justify-content: space-between`), and wrapping a
  mid-string match in a `<mark>` split that one run of text into three flex items — text before,
  the mark, text after — with the row's own `gap` landing between all three. `faqHighlightMatches()`
  now skips any text node whose parent computes to `display: flex`/`inline-flex`, so a question
  match no longer highlights (the same hit still highlights fine in the answer body below it).

## [1.9] - Aug 2026

### Added

- Search matches are now highlighted inline (`<mark class="faq-hl">`, wrapped by `js/faq.js`'s
  `faqHighlightMatches()`) instead of just filtering the list down — a fixed yellow/black pair
  that passes WCAG AAA contrast (~17.5:1) in every theme this page ships: Dark, Light, and both
  Color Vision modes.
- Two more host-driven steps named in the Interactive Tutorial's "is it real?" answer: flipping
  the Light/Dark theme and checking a Bonus box, matching what `Tutorial.start()` actually walks
  through in `scorekeeper/js/tutorial.js`.

### Changed

- The Interactive Tutorial section now says "Team Report" instead of "Score Audit," matching the
  app's current naming for that modal.

### Removed

- The dedicated **Point Adjustments** entry in Tips & Tricks → Advanced Settings, and its
  mentions elsewhere, ahead of that feature's planned removal from the main Scorekeeper app.

## [1.8] - Aug 2026

### Added

- A new **Interactive Tutorial** section covering the app's 🎓 Take the Tour spotlight
  walkthrough: how to start it (Settings → Sample Data row, or the automatic first-run offer
  for new visitors), what it actually does (drives a real throwaway practice game through the
  app's own scoring/export functions, mixing host-driven steps with auto-filled ones, and
  deliberately engineering a Beer Round and a Final Results tie), and what happens to a real
  game in progress depending on whether the tour is skipped or finished.
- A **Point Adjustments** entry in Tips & Tricks → Advanced Settings — the manual ± per-team
  score nudge, previously shown in the Advanced Settings screenshot's own alt text but never
  actually documented as its own FAQ item.
- A mobile bottom dock entry in Scores & Standings, explaining the scores peek strip pinned to
  the bottom of phone-width screens.
- Two entries in Autosave & Resume: the app keeps scoring with no signal after it's loaded once
  (it registers as an installable offline app), and why the "autosave is off" warning appears
  when the app is opened directly as a local `file://` page instead of a real address.
- An Esc-key tip appended to the Score Audit item — closes the audit modal (and the mobile
  Scores sidebar) without hunting for the ✕.
- Optional Light-theme screenshot variants: any screenshot can now have a `<name>-light.png`
  sibling that `js/faq.js` shows automatically to Light-theme readers, with the existing
  Dark-captured file staying the fallback for everyone else. See
  [screenshots/README.md](screenshots/README.md).
- Three new suggested screenshots: `tutorial-spotlight.png`, `point-adjustments.png`,
  `mobile-bottom-dock.png`.

### Fixed

- Search: filtering to a query that only matched an item elsewhere in Tips & Tricks left the
  "Advanced Settings" subsection heading and its intro paragraph stranded above nothing, since
  neither is itself a `.faq-item` the search loop hides. Wrapped that heading + intro + its
  items in a `.faq-subgroup` that `faqFilter()` now hides as a unit whenever none of its items
  survive the filter.

### Changed

- Moved Expand All / Collapse All out of the search toolbar (where they competed with search
  for primary billing) to their own row directly above the section list they control, styled
  as lighter secondary links instead of bordered buttons.
- Removed `js/app.js`, `js/data/`, and `js/vendor/` (~2.8 MB) — dead weight left over from when
  this page used to fetch `js/app.js` as text for the footer's app-version display; that fetch
  was removed in 1.7, and nothing else in this repo has referenced those files since. `README.md`
  updated to match.

## [1.7] - Aug 2026

### Removed

- The footer no longer fetches and displays the main app's `APP_VERSION` (e.g. "Scorekeeper —
  v17.3"). That version number tracked the app build, not this FAQ site, and was confusing next
  to the FAQ's own version line.

## [1.6] - Aug 2026

### Added

- A "Built with Claude AI" disclaimer in the footer, next to the version number, and in the
  README, disclosing that the FAQ content and site code were developed with AI assistance.

## [1.5] - Aug 2026

### Added

- Today's date (e.g. "August 15, 2026") in the footer, computed client-side at load via
  `Intl`/`toLocaleDateString` rather than hardcoded, so it always reflects the day the page is
  actually being viewed.

### Changed

- Footer version line now shows the exact release date — `FAQ v1.5 (15 Aug 2026)` — instead of
  just the month.

## [1.4] - Aug 2026

### Changed

- Replaced the Google Fonts `@import` (Inter + Space Grotesk, loaded live from
  `fonts.googleapis.com`/`fonts.gstatic.com`) with the same two fonts self-hosted from
  `fonts/inter-var.woff2` and `fonts/space-grotesk-var.woff2`, declared via `@font-face` in the
  new `css/fonts.css`. No requests to Google at runtime — the fonts load from this site instead,
  so there's no dependency on a third-party CDN being reachable, and one less external origin
  for the browser to connect to before text renders in its final font.

### Fixed

- The Color Vision dropdown in the new Settings panel was getting clipped by
  `#faqSettingsPanel`'s inherited `overflow-y:auto` (sized in the shared `.settings-panel` rule
  for the main app's much longer Advanced Settings panel). Scoped an `overflow: visible` override
  plus extra padding to the FAQ's own panel so the dropdown always renders in full, opening
  downward.

### Added

- An "Advanced Settings" subsection heading in Tips & Tricks, grouping the nine
  previously-individually-tagged "Advanced" items under one heading instead of a repeated
  per-item badge.

## [1.3] - Aug 2026

### Added

- A ⚙️ Settings panel on the FAQ page itself, matching the main app's own gear/panel
  pattern exactly (same CSS classes, same behavior): a Text Size control (A−/A/A+) and a
  Color Vision selector (Off / Red-Green / Blue-Yellow). Both persist to the same
  `trivRev6_prefs` localStorage key the main app reads and writes, so a change made from
  either the FAQ or the app carries over to the other.
- "← Back to Scorekeeper" link restored in the header, now pointing at the live app
  (`https://electricburgers.github.io/scorekeeper/`) instead of a local path.

### Changed

- Split the page's inline `<style>` and `<script>` blocks out of `index.html` into their
  own files: `css/faq.css` (page-specific layout/components), `js/faq-bootstrap.js` (the
  tiny pre-paint theme/color-vision/size bootstrap, still a blocking script so there's no
  flash of the wrong look), and `js/faq.js` (search/filter, expand/collapse, lightbox,
  version label, and the new settings panel logic). `index.html` is now markup only.

## [1.2] - Aug 2026

### Added

- Full FAQ content across all 15 sections: Getting Started, Event Details, Teams, Scoring
  Rounds, Question Timer, Halftime & Final Wager, Scores & Standings, Final Results &
  Ties, Craft Prize Drawing, Exporting, Autosave & Resume, Manual Save & Load, Settings,
  Light Mode & Dark Mode, and Tips & Tricks (covering every Advanced Settings toggle).
- Search/filter toolbar (live search plus Expand All / Collapse All) with a "no results"
  state.
- Table of contents linking to every section.
- Lightbox for the paired (Light/Dark theme) and trio (Color Vision mode) screenshot
  comparisons.

## [1.1] - Aug 2026

### Added

- Initial standalone FAQ site, split out of the main Scorekeeper app repository into this
  one: `index.html`, `css/styles.css` (the shared design system, reused as-is so this page
  always matches the live app's theme/color-vision settings), `js/app.js` and its
  `js/data`/`js/vendor` dependencies, and the `screenshots/` folder.
