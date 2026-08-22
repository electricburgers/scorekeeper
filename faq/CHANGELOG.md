# Changelog

All notable changes to the Scorekeeper FAQ site are documented here.

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
