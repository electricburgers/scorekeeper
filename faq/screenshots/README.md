# FAQ screenshots

`index.html` references the files below by these exact names. Drop a WEBP in
here with the matching filename and it appears automatically — no HTML
changes needed. Until a file exists, that spot in the FAQ shows a small
dashed placeholder instead of a broken image.

Load the sample game first (Settings → 🧪 Try Example) so every screenshot
shows real, believable data instead of an empty form. For the tutorial and
mobile bottom dock shots specifically, use Settings → 🎓 Take the Tour (or
a phone-width window) instead — see the table below.

## Light theme variants

Every screenshot of the app UI ships **twice**: `<name>.webp` captured in Dark
theme, and `<name>-light.webp` captured in Light, from the same viewport and
scroll position so the two are the same frame in two themes. `js/faq.js`
(`faqApplyThemedShots`) swaps to the `-light` file whenever the reader's FAQ is
in Light theme and back again when it isn't, so a Light-theme reader never gets
a dark rectangle in the middle of a light page. The swap keys off the
`data-shot-base` attribute on the `<img>` — add one when you add a shot, and add
both files.

Three shots deliberately have **no** `-light` variant and no `data-shot-base`,
because none of them is a picture of the app UI and none changes with the
theme: `xlsx-export` (a workbook in a spreadsheet app), `pdf-export` (a rendered
PDF page) and `jd-upload-form` (a third-party form). Giving them the attribute
only makes the page probe for a file that will never exist.

The `theme-*` comparison shots below are likewise excluded — each one is
deliberately showing a specific theme, so swapping it would defeat the
comparison it exists to make.

| File | What to capture | Used in |
|---|---|---|
| `event-details.webp` | The Event Details section, expanded, fully filled in (Date, Quiz ID, Host Name, Location, Craft Partner, Partner Town, Bonus Item, Restaurant Staff). | Event Details |
| `teams-list.webp` | A few rows of the Teams section — name field, the +5 Bonus / +3 NJCB checkboxes, the Score Guess field, and the ✕ remove button. | Teams |
| `round-scoring.webp` | One round expanded, with a mix of green (correct), red (incorrect), and idle wager buttons across a few teams/questions. | Scoring Rounds |
| `beer-round.webp` | A bonus (Q5) question where every team is marked correct, showing the gold wash and the 🍺 Beer Round! badge. The standalone "Everyone got it right!" banner was removed in app v18.57 — the badge and the gold block are the whole treatment now. Round 3's Q5 in the sample game is one; otherwise mark a question correct for every team by hand. | Scoring Rounds |
| `sort-buttons.webp` | Close-up of a single question's header, showing the ↕ Sort and ↺ Reset buttons. | Tips & Tricks |
| `crowd-wisdom-percentage.webp` | Close-up of a single question's header with Advanced Settings → Crowd-Wisdom Percentage on, showing the live correct/incorrect counts next to Sort/Reset. | Tips & Tricks |
| `question-timer.webp` | The question timer widget mid-countdown, showing the ⏸ Pause and ↺ Reset buttons (start it from Settings' default duration, or the sidebar/bottom-dock controls). | Question Timer |
| `timer-stepper-buttons.webp` | The question timer widget with the −30/+30 stepper buttons visible (Advanced Settings → Timer Stepper Buttons must be on). | Tips & Tricks |
| `halftime-wager.webp` | The Halftime Wager entry for one team — wager amount field plus the correct/incorrect toggle. | Halftime & Final Wager |
| `scores-sidebar.webp` | The 📊 Scores sidebar open, with live totals and the Entry / 🎲 RAND / ↑ Asc / ↓ Desc sort buttons visible. | Scores & Standings |
| `before-wager-scores.webp` | The "Scores — Before Halftime Wager" or "Before Final Wager" standings panel. | Scores & Standings |
| `mobile-bottom-dock.webp` | The mobile bottom dock — the scores peek strip pinned to the bottom of a phone-width screen. Resize the browser window (or use device emulation) to phone width first. | Scores & Standings |
| `final-results.webp` | The Final Results table. The sample game has a genuine tie for 2nd place built in (Parliamentary Procedure / The Fifth of November) — capture it so the tie badge and "✓ closer"/"tie" labels are visible, along with the "*Diff is minus Bonuses" footnote. | Final Results & Ties |
| `score-audit.webp` | The Team Report modal open for one team (tap any team name to open it) — the full round-by-round breakdown and the Guess/Diff tiles at the top. | Final Results & Ties, Tips & Tricks |
| `craft-prize-choose.webp` | The Craft Prize Drawing section before it's opened — the single square **Choose / Craft Prize / Winner** button with the beer icon (v19.65). Dark + light. | Craft Prize Drawing |
| `craft-prize.webp` | The Craft Prize Drawing section open pre-draw, showing the Exclude Top / Drumroll-seconds steppers and the square **Start Drumroll** button (v19.60). | Craft Prize Drawing |
| `craft-prize-drumroll.webp` | The Craft Prize drumroll actively playing, right after clicking Start Drumroll — the spinning name and countdown bar. | Craft Prize Drawing |
| `craft-prize-winner.webp` | The finished draw — winning team announced, with the **Clear** button next to the result and the Winner Announcement Script below. | Craft Prize Drawing |
| `export-bar.webp` | The Export & Data section — the square 📄 XLSX / 📕 PDF buttons and the 🎭 JD Upload Form link. | Exporting |
| `xlsx-export.webp` | The downloaded XLSX scoresheet, opened in a spreadsheet app — header (Location/Date/Quiz #/Host), a few zebra-striped team rows, and only as many team rows as the game has. | Exporting |
| `pdf-export.webp` | The downloaded PDF scoresheet — same header plus full standings. | Exporting |
| `jd-upload-form.webp` | The JD Upload Form page, opened in its own browser tab. | Exporting |
| `sound-test-buttons.webp` | The Craft Prize Drawing's Test Sounds bar — the square Roll / Fade out / Crash / Horn buttons (Advanced Settings → Manual Drumroll Control **and** Sound Test Buttons both on). | Tips & Tricks |
| `settings-panel.webp` | The main Settings panel open (⚙️ gear icon) — Theme, Size, Icon Style, Question Timer, Sample Data (🧪 Try Example and ℹ️ Take the Tour), Help, App Preferences, and the collapsed Advanced Settings toggle. | Getting Started |
| `tutorial-spotlight.webp` | Mid-tour: the dimmed spotlight overlay around a highlighted control, with the callout box (step text, "Step X of Y", Back/Next, Skip Tutorial) visible. | Interactive Tutorial |
| `advanced-settings.webp` | Advanced Settings expanded (the toggle takes its enabled cyan fill) — Row Density, Row Zebra Stripes, Craft Prize Eligible List, Crowd-Wisdom Percentage, Edit Locked Fields, timer controls, Manual Drumroll Control (on, so Drumroll Crossfade and Sound Test Buttons both show too), and Point Adjustments. | Tips & Tricks |
| `row-density-{relaxed,normal,compact}.webp` | The same completed Round 1 question at each Row Density, same frame height — the square wager buttons grow on Relaxed to fill the taller rows and shrink on Compact, always square (v19.65). | Row Density |
| `manual-drumroll-control.webp` | The Craft Prize drawing paused mid-roll with Manual Drumroll Control on — the square **Play Horn** button where Stop Drumroll was (Advanced Settings → Manual Drumroll Control must be on). | Tips & Tricks |
| `resume-banner.webp` | The "⚠️ Saved session found" banner with its Resume / New Game buttons (reload the page mid-session to see it). | Autosave & Resume |
| `save-load-toolbar.webp` | The top toolbar — 💾 Save and 📂 Load buttons next to the ⚙️ Settings gear. | Manual Save & Load |
| `theme-dark.webp` | The app in Dark theme (Settings → Theme → 🌑 Dark) — any full screen works, Event Details + a scored round is a good choice. | Light Mode & Dark Mode |
| `theme-light.webp` | The same view, switched to Light theme (Settings → Theme → ☀️ Light), ideally the *same* screen as `theme-dark.webp` so the two are a true side-by-side comparison. | Light Mode & Dark Mode |
