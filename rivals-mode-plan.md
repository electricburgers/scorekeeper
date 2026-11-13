# Revolution Rivals mode: reuse assessment and plan

Status: plan only, no code changed. Written against v21.62.

## TL;DR

- **Keep it in this repo as a fourth Game Mode** (`rivals`, alongside `regular`, `theme`, `tune`). Don't make a separate repo.
- **Roughly 75-80% of the app is reused as-is.** Teams, Event Details, Craft Prize drawing, Q5 wagers, ranking and tiebreak, sidebar, save/load/backups, timer, PWA and desktop wrapper all carry over.
- **The one real difference is the Q1-4 scoring input.** Regular, Theme and Tune score "pick a wager, then mark correct or wrong". Rivals scores "which survey place did the team's answer land on": #1 = 10, #2 = 7, #3 = 4, anything else = 0. That means a new button row, a small scoring branch, and mode-specific export columns. Everything else is wiring.
- Rivals is structurally **closer to Name That Tune than Tune was to Regular**. Tune already has 4 rounds, each closed by a Q5 wager capped 5/10/15/20, which is exactly Rivals' wager schedule.

## The rules, reduced to what the scorekeeper must compute

| Rule from the script | Meaning for the app |
|---|---|
| 4 rounds, each 4 regular questions + 1 wager question | Same shape as Tune. Four round slots, Q1-4 plus one Q5 wager each. |
| Regular question: #1 = 10, #2 = 7, #3 = 4, beyond top 3 = 0 | New per-team input: a place, not a wager. No "use each wager once per round" rule. |
| Wager question: wager on the **#1 answer only**; win = +wager, lose = -wager | Identical to the existing Q5 wager block. "Correct" simply means "team had the #1 answer". |
| Wager caps: R1 1-5, R2 1-10, R3 1-15, R4 1-20 | Identical to `TUNE_WAGER_MAX`. |
| Perfect score is 210 | 16 x 10 = 160, plus 5+10+15+20 = 50. So `GUESS_LIMITS.rivals = 210` (before bonus items). |
| Score guess breaks ties, closest wins | Already implemented (`teamScoreRows`, `rankedRaw`). Reused untouched. |
| Bonus item = 5 points | Already implemented (`team.bonusItem`). |
| NJCB card = "extra bonus points" | Already implemented as 3 (`team.njcb`). **Confirmed: 3 points in Rivals too.** |
| Weekly craft partner + drawing at the end | Already implemented (Craft Prize, drumroll, Event Details craft partner fields). Reused untouched. |

## Why not a separate repo

- The mode machinery already exists and is battle-tested. `gameState.meta.mode`, `gameMode()`, `gameModeName()`, the Settings Game Mode dropdown, and the wipe-on-switch rule were all built for exactly this. Rivals is one more entry in `GAME_MODES`.
- A split would fork about 20k lines of JS/CSS plus the service worker, desktop wrapper, FAQ site, 40-odd tests and WCAG theme work. Every future fix (autosave, a11y, export bugs) would then have to be made twice.
- Hosts who run both formats on the same night want one installed PWA and one saved-backups list, not two apps.
- A separate GitHub Pages URL only buys separate branding or a standalone install. If that's wanted, a cheaper route is a deep link such as `?mode=rivals`, which preselects the mode on a fresh board. A separate repo should only be reconsidered if Rivals needs its own release cadence or its own audience or branding, or its own host accounts. Nothing in the rules suggests that.

## Reuse map

### Reused with no changes

- **Teams**: add, rename, pause, sort, A-Z, per-question re-sort, team report modal shell.
- **Event Details**: date, location, quiz ID, host, craft partner and town, bonus item, staff names, validation, `canScore()` gate.
- **Q5 wager block** (`renderSpecialWager`, `setW1/HW/W3/FW`, `setC*`): wager dropdown capped by `wagerMax`, correct/incorrect buttons, plus/minus points. Rivals reuses Tune's stores and caps. Only the label wording changes (see below).
- **Totals and ranking**: `grandTotal`, `w1Pts/htPts/w3Pts/fwPts`, `ranked`, `rankMap`, `teamScoreRows`, tie-break by guess, Final Results, sidebar scoreboard, phone swipe-up sheet.
- **Craft Prize drawing**, drumroll audio, "delete teams with no final score guess" Advanced Setting.
- **Bonus item (+5) and NJCB**, manual adjustment.
- **Autosave, backups, save/load .json, resume banner, migrations** (`migrateState` already tolerates an unknown mode by falling back to regular, so it just needs `rivals` added to `GAME_MODES`).
- **Question timer, progress chart, keyboard shortcuts, jump-to-unanswered, collapse/expand, themes, colour-vision modes, text size, PWA, Electron wrapper**.
- **Round shell** in `renderLeftBody`: 4 rounds, `ROUND_COLORS`, round progress, banter between rounds.

### Reused with small, mode-aware tweaks

| Piece | Change |
|---|---|
| `scoring.js` constants | Add `"rivals"` to `GAME_MODES`; `MODE_NAMES.rivals = "Revolution Rivals"`; `GUESS_LIMITS.rivals = 210`; add `isRivals()`. |
| `hasQ5Wagers()`, `roundWagerType()`, `wagerMax()`, `roundCount()` | Treat Rivals like Tune (4 rounds, Q5 wagers 5/10/15/20, same four stores). Mostly `isTune() \|\| isRivals()`. |
| `roundSubRaw`, `roundProgress`, `qScored`, `checkGameStarted` | Rivals sums place points instead of `correct ? wager : 0` (see data model). |
| Mode dropdown + confirm text in Settings (`setGameMode`, `resumeModeLabel`, Try Example, Take Tour prompts) | Add the Rivals option, icon and label via `gameModeName()`. Wipe-on-switch is already enforced. |
| Round header pill ("Wagers: 1,2,3,4") | Replace with a "10 / 7 / 4 / 0 + Q5 wager 1-N" pill in Rivals. |
| Q5 label | Say "wager on the #1 answer" instead of "bonus wager". |
| Beer Round | **Decided: no Beer Round in Rivals.** Gate `isBeerRound` / `isSpecialBeerRound` / the badge and banter on `!isRivals()`, so Q1-4 and Q5 never show it. |
| Crowd-Wisdom Percentage stats | Currently correct vs incorrect %. In Rivals show the share of teams on #1/#2/#3/other, or simply hide it for Q1-4 and keep it on Q5. |
| `qVerdict` banter | "Everyone wrong" has no meaning here. Map "nobody in the top 3" to it, or skip banter for Q1-4. |
| Team report (`team-audit.js`) | Add a Rivals branch beside the Tune/Theme ones. Per-question cells show place and points. |

### New work

1. **Place picker for Q1-4** (the one genuinely new UI). Per team per question, four buttons: `#1 10`, `#2 7`, `#3 4`, `Other 0`. It's a lighter relative of `renderWQ`: same row layout (`.team-answer`, `.ta-name`, `.ta-pts`), different button set, and no used-wager disabling.
   - Tapping the selected button again clears it. The old correct, incorrect, clear cycle doesn't apply because a place is a single choice.
   - New handler `setPlace(ri, qi, ti, place)`, mirroring `cycleW`: gate on `canScore()`, mutate, `announce()`, `autosave()`, `renderAll()`.
   - **Optional speed-up for host use:** since each survey answer has a fixed rank, a "mark all #1" style helper is less useful than it was. A per-question "everyone Other" bulk button may help instead.
2. **Rivals export columns** (`export.js`, PDF and XLSX). Tune's branch is the template: it already relabels the Q5 slots and adds Sub columns. Rivals needs the Q1-4 cells to show points (10/7/4/0) instead of wager values, and the sub-header to read `10/7/4/0` instead of `1,2,3,4`. The XLSX uses a template (`js/data/xlsx-templates.js`), so check which cells it hard-codes before assuming the Tune relabel is enough.
3. **FAQ**: new section on Rivals (rules, place picker, Q5), screenshots per `faq-screenshot-generation.md`, FAQ version bump.
4. **Styling** for the place buttons: needs WCAG AA in every theme x colour-vision combination. This repo audits that strictly (`wcag-aa.test.js`, `contrast-modes.test.js`), so expect real time here. Reuse `.wager-btn` classes where possible to inherit the existing audited colours.
5. **Tests**: a `v21-xx.test.js` for Rivals scoring (210 perfect score, wager loss, tie-break), mode switch wipe, migration, and export column labels.
6. **Release bookkeeping** per `scorekeeper-versioning.md`: `APP_VERSION`/date in `app.js`, `version.json`, `CHANGELOG.md`, Settings What's new (last two versions only), `faq/CHANGELOG.md` and `FAQ_VERSION`.

## Data model decision

`questions[qi][ti]` is currently `{ wager, correct }`, and `roundSubRaw` sums `correct ? wager : 0`.

**Recommendation: store `{ place: 1|2|3|0 }` and add a Rivals branch in `roundSubRaw`.**

- Clear semantics, and a place can be re-derived into points if the 10/7/4 table ever changes.
- Costs about five places that test `a.wager !== undefined` (`qScored`, `roundProgress`, `checkGameStarted`, `isBeerRound`, `qVerdict`, `scoreBreakdown`). Introduce one helper, `isAnswered(a)`, that knows both shapes.

**Alternative (cheaper, hackier):** store `{ wager: 10|7|4|0, correct: place > 0 }` so every existing sum and "answered" check works untouched. The trade-off is that "wager" then secretly means "points awarded", which will confuse the next reader. Not recommended unless speed matters most.

Either way no save-file migration is needed: old saves have no `rivals` mode and load as before.

## Suggested build order

1. `scoring.js`: constants, `isRivals()`, mode-aware helpers, `roundSubRaw` branch, `isAnswered()`. Unit-test the 210 perfect score first.
2. Mode plumbing: dropdown, labels, wipe-on-switch, `migrateState`.
3. Place picker UI + `setPlace` handler + round header pill + Q5 label.
4. Progress, skip Beer Round, banter adjustments, hide Theme Name, Rivals title/PDF branding.
5. Team report branch.
6. PDF and XLSX export.
7. Styling and AA audit across themes and colour-vision modes.
8. Tour and Try Example (needs a Rivals sample game), FAQ, tests, release bump.

Steps 1-3 give a playable scorekeeper. 4-8 are polish and parity with the other modes.

## Rough size

Roughly 10-15 hours of focused work, with most of the uncertainty in export and AA styling. For comparison, Tune took about the same shape of work with a bigger scoring delta.

| Area | Size |
|---|---|
| Scoring and mode plumbing | small |
| Place picker + handler | medium |
| Export (PDF and XLSX) | medium |
| Styling + AA audit | medium |
| Team report, tour, example | small-medium |
| FAQ + screenshots | small-medium |
| Tests | small-medium |

## Decisions (confirmed)

1. **NJCB** is 3 points, same as every other mode. No change.
2. **No Beer Round** in Rivals, on Q1-4 or Q5.
3. **No Theme Name** field in Rivals (`isTheme()` already gates it, so nothing to add).
4. **Branding:** the title and the PDF read **Revolution Rivals**.
   - PDF: the GAME box and the Standings title use `gameModeName()`, which returns "Revolution Rivals" once `MODE_NAMES.rivals` is added. The Theme Night special-casing in `pdfModeLabel` / `pdfGameLabel` stays Theme-only.
   - On screen: in Rivals mode the header logo (`<h1 class="logo">`, "Score Keeper" today) and the document title switch to "Revolution Rivals", and back when the mode changes. The app's installed name and manifest stay "Scorekeeper".
   - The team report header and resume banner already use `gameModeName()`.

## Still open (small)

1. **Ties in place.** Assumed two teams can both land on #1 for the same question, since each is scored independently.
2. ~~Script date.~~ **Confirmed:** 10/7/4 and the 5/10/15/20 caps are current.

(Ties in place: still unconfirmed; the app allows several teams on the same place.)

## Git procedure

- `main` auto-deploys to GitHub Pages (`.github/workflows/pages.yml` runs on every push to `main`), so work-in-progress on `main` goes live. Use a **feature branch**: `rivals-mode`.
- Commit on the branch per step of the build order, each with a `v22.x` subject, as in the usual release style. Don't amend commits that are already pushed.
- Versioning: Theme Night became the v20 line and Name That Tune the v21 line, so Rivals starts the **v22 line** (v22.0 for the first playable build).
- Because Rivals only adds a mode and old saves load unchanged, merging to `main` once it's complete is safe. Merge with a normal merge (or fast-forward) so the per-step history stays.
- Keep the untracked `_headers` file out of these commits unless it's intended.
