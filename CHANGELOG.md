# Changelog

All notable changes to Scorekeeper are documented here, newest first. Versions
match the in-app "Scorekeeper vX.X" label (Settings panel). Reconstructed from
git history — dates are commit dates, and entries bundle the commits that
landed between one version bump and the next.

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
