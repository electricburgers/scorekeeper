# Scorekeeper Test Plan

Manual QA checklist for Score Keeper (v10.38). This is a static HTML/CSS/JS app with no
build step or test runner, so these are browser-executable test cases rather than automated
specs. Run the **Desktop** cases in a normal browser window (≥1024px wide) and the **Mobile**
cases on an actual phone or a resized/emulated viewport (≤430px wide). Cases marked **Both**
should be run once on each.

Legend: **Platform** = Desktop / Mobile / Both.

## Event Details & Location Field

1. **(Both)** Open the app — the section previously called "Session Info" now reads
   **Event Details**.
2. **(Both)** Click into the Location field and start typing "cap" — a native dropdown
   appears listing "Capital Craft East Hanover" and "Capital Craft Green brook".
3. **(Both)** Select "Village Saloon" from the dropdown — the input fills with the exact
   value and the dropdown closes.
4. **(Both)** Type a venue not on the list (e.g. "My Backyard BBQ") and tab out — the value
   is accepted, no validation error appears, and it persists after a page reload.
5. **(Both)** Confirm the value typed/selected in Location is what appears in the exported
   CSV/PDF/XLSX `Location` field (Export & Data section).
6. **(Both)** Clear the Location field entirely and tab out — field stays empty, no console
   errors.
7. **(Both)** Switch through every theme (Dark, Light, High-Contrast Dark, High-Contrast
   Light — via Settings → Theme) and confirm the Location field's dropdown chevron and
   text color remain legible (not black-on-black or white-on-white) in each.
8. **(Desktop)** Tab to the Location field via keyboard only (no mouse) — the dropdown is
   reachable and navigable with arrow keys + Enter.

## Team Management

9. **(Both)** Add a new team — it appears in the Teams list and in the Scores sidebar.
10. **(Both)** Remove a team mid-session — a confirm dialog appears; confirming removes the
    team and re-indexes all round/bonus/wager data without throwing errors.
11. **(Both)** Add teams up to `MAX_TEAMS` — the "Add Team" control stops adding beyond the
    cap instead of erroring.
12. **(Both)** Rename a team mid-game — the new name propagates to Scores sidebar, Final
    Results, and Craft Prize Drawing immediately.

## Round Scoring

13. **(Both)** Mark a question correct for a wager value — the team's round subtotal updates
    live in the sidebar.
14. **(Both)** Re-click the same wager on a scored question — it cycles correct → incorrect →
    cleared, per the existing cycle behavior.
15. **(Both)** Attempt to assign the same wager value twice in one round for one team — the
    second attempt is blocked (no duplicate wager slot created).
16. **(Both)** Complete all 4 questions in Round 1 for every team — the round header shows a
    "✓ Done" badge.
17. **(Desktop)** Use a wide viewport to confirm all 4 rounds' wager columns are visible
    without horizontal scrolling in the main content column.
18. **(Mobile)** Confirm each round's question grid stacks/scrolls usably on a narrow screen
    without overlapping text.

## Halftime & Final Wager

19. **(Both)** Enter a halftime wager and mark it correct — the point total adds `+wager` to
    the team's running score.
20. **(Both)** Enter a halftime wager and mark it incorrect — the point total subtracts
    `wager` from the team's running score.
21. **(Both)** Leave a team's final wager blank — that team's final-wager contribution is `0`,
    not an error or `NaN`.
22. **(Both)** Confirm "Scores — Before Halftime Wager" and "Scores — Before Final Wager"
    standings panels reflect point totals excluding the wager not yet resolved.

## Final Results & the "Diff is minus Bonuses" Rule

23. **(Both)** With at least one team having Bonus Item and/or NJCB checked, open Final
    Results — the `|Diff|*` column value equals `|(score − bonuses) − guess|`, not
    `|score − guess|`.
24. **(Both)** Confirm the footnote reading "*|Diff| is minus Bonuses — Bonus Item (+5) and
    NJCB (+3) are stripped from a team's score before it's compared to their guess, for every
    team." is visible under the Final Results table.
25. **(Both)** Create a tie in total score between two teams with different guesses — the
    team whose bonus-adjusted diff is smaller is marked "✓ closer" and placed higher.
26. **(Both)** Leave a team's score guess blank — its Guess and `|Diff|*` cells show "—"
    instead of `0` or blank-causing errors.
27. **(Mobile)** Confirm the Final Results table collapses into the card/list layout (Place,
    Team, Score, Guess, Diff stacked) instead of a clipped horizontal table.

## Craft Prize Drawing

28. **(Both)** With teams scored, click "🥁 Choose Craft Prize Winner" — the drumroll
    animation runs and audio plays (where supported) for the configured duration.
29. **(Both)** After the drawing completes, a winner is shown with a "🏆 … won!" banner and a
    **Clear** button next to it.
30. **(Both)** Click **Clear** — a confirmation prompt appears; confirming resets
    `craftPrizeWinner` to null, unchecks every team's `craftPrize` flag, and re-shows the
    "🥁 Choose Craft Prize Winner" button.
31. **(Both)** After clearing, run the drawing again — a new (potentially different) winner
    can be chosen without needing a page reload.
32. **(Both)** Dismiss the Clear confirmation prompt (Cancel) — the existing winner and
    script remain unchanged.
33. **(Both)** Change "Exclude Top" to exclude more teams than exist — the draw button
    disables with no eligible pool instead of crashing.

## Export & Data

34. **(Both)** Export PDF — the scoresheet PDF downloads, and the printed "** DIFF is minus
    Bonuses" note is visible near the DIFF column header.
35. **(Both)** Export XLSX (backup format) — file downloads without throwing a console error.
36. **(Both)** Click "🔗 JD Upload Form" — it opens `form.jotform.com/261746701455055` in a
    new tab; the Scorekeeper app tab remains open and unaffected.
37. **(Both)** After any export, confirm the "Export complete. Clear session?" prompt appears
    and both "Yes" and "No" behave correctly.

## Settings & Themes

38. **(Both)** Toggle Dark → Light → High-Contrast Dark → High-Contrast Light and confirm no
    section (Event Details, Teams, Rounds, Final Results, Craft Prize, Export) has
    unreadable/invisible text in any theme.
39. **(Both)** Adjust font size (A−/A/A+) — layout doesn't break or overlap at either extreme.
40. **(Both)** Toggle Density (Normal/Compact) — spacing changes without clipping content.
41. **(Both)** Enable Color Vision mode (deuteranopia/tritanopia) — pass/fail score colors
    remain distinguishable.

## PWA / Safe-Area & Responsive Layout (Mobile-focused)

42. **(Mobile)** Install the app to the home screen on an iPhone with a Dynamic Island/notch
    — the header (Score Keeper title, Save/Load/Settings buttons) is not clipped by the
    notch.
43. **(Mobile)** With the Scores sidebar minimized, confirm the "📊 SCORES ▲" bar is fully
    visible above the home-indicator area, not partially clipped.
44. **(Mobile)** Expand the Scores sidebar to its max height (50vh) and scroll — content
    scrolls internally without the page double-scrolling.
45. **(Mobile)** Rotate the device/viewport between portrait and landscape — layout
    reflows without leaving dead space or clipped controls.
46. **(Desktop)** Resize the browser window down to ~900px width — the layout switches from
    the two-column desktop layout to the stacked mobile layout at the expected breakpoint.
47. **(Desktop)** Drag the column resize handle between the main content and the Scores
    sidebar — the sidebar resizes smoothly and respects its min/max width.
48. **(Both)** Reload the page mid-session — the "Saved session found" resume banner appears,
    and clicking Resume restores all team scores, Event Details, and Craft Prize state
    exactly as left.
