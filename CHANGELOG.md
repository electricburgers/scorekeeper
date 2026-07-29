# Changelog

All notable changes to Scorekeeper are documented here, newest first. Versions
match the in-app "Scorekeeper vX.X" label (Settings panel). Reconstructed from
git history — dates are commit dates, and entries bundle the commits that
landed between one version bump and the next.

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
