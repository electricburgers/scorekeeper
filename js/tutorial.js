/* TUTORIAL MODE
   Spotlight walkthrough that runs a throwaway 5-team practice game start to finish, automating
   the tedious parts so the tour takes minutes instead of the length of a real match.

   Design note (see TUTORIAL_MODE_DESIGN.md for the original sketch and its review): this file
   is deliberately the ONLY thing that changes for this feature — app.js is untouched. That's
   possible because renderAll/renderLeft/renderSB/autosave/startNewGame are plain `function`
   declarations at global scope in a classic (non-module) script, which — like every other
   <script> tag on this page — shares one global lexical environment with app.js. That means:
     - reassigning them here (e.g. `renderAll = function(){...}`) is visible to every call site
       inside app.js too, since identifiers are resolved at call time, not bound at definition
       time — so wrapping them is a real, working hook, not a copy that nothing calls.
     - the practice game state can be swapped in with a plain `gameState = practiceState`
       assignment, and every function in app.js that reads `gameState` picks it up immediately.
   This is what lets the whole tour live in one additive file: it observes and drives the app
   through the exact same globals the app already exposes to itself.

   Re-`querySelector`ing the target after every render (rather than holding a node reference) is
   required, not a style choice — renderLeft/renderSB rebuild whole subtrees via innerHTML on
   nearly every tap (see the comment at js/app.js:4426), which destroys whatever node a spotlight
   was pointing at.
*/
const Tutorial = (function () {
  const SEEN_KEY = "trivRev6_tutorialSeen";
  // The first team is named (and guessed) by the host for real practice (see the "add + name
  // your first team" step) — these four fill out the rest of the 5-team roster automatically.
  const PRACTICE_TEAMS = [
    "Sample Size Six",
    "Dry Run Dynasty",
    "Tutorial Trivia Titans",
    "No Score No Foul",
  ];

  let active = false;
  let stepIndex = -1;
  let stepReady = false; // whether the current step's Next button should be showing yet
  let snapshot = null; // real app state, restored on Skip (kept as the live session on Finish)
  let orig = null; // original renderAll/renderLeft/renderSB/autosave/startNewGame, restored on exit
  let sidebarOpenedByTour = false;
  let repositionRaf = null;
  let advancing = false; // guards checkOnClickDone against scheduling more than one advance
  let origCraftDrawSeconds = null; // real saved drumroll length, restored on exit
  let sawSectionCollapsed = false; // tracks the collapse->expand sequence for that practice step
  let r1CycleSeen = null; // tracks correct->incorrect->cleared->incorrect-again on one question
  let auditOpened = false; // real click on a team name to open the Score Audit modal
  let pdfExportClicked = false; // real click on Export PDF, tracked via a listener (see below)
  let jdUploadClicked = false; // real click on the JD Upload Form link — opens in a new tab, so
  // there's no in-page state change to poll for the way every other on-click step has

  // ── PRACTICE STATE ──────────────────────────────────────────────────────────────────────
  // Built the same way loadSampleGame() builds its demo, but 5 teams instead of 11 and every
  // score empty — the tour fills them in live instead of loading a finished game.
  function buildPracticeState() {
    const s = migrateState(freshState());
    s.meta.date = new Date().toISOString().slice(0, 10);
    s.meta.location = "The Tutorial Tavern";
    s.meta.craftPartner = "Practice Run Brewing";
    s.meta.craftPartnerTown = "Sandboxville";
    s.meta.bonusItem = "A rubber duck";
    s.meta.staffNames = "your imaginary bar staff";
    // Quiz ID and Host Name are left blank on purpose — the tour has the host type these in
    // for real, since they're two of the fields every real game actually needs filled by hand.
    // gameStarted is deliberately left false here, same as a fresh real game: Event Details
    // (including the two fields above) locks the moment it flips true (see metaLocked in
    // renderLeft), so forcing it early would make Quiz ID/Host Name uneditable before the host
    // ever got to type them. It flips true on its own, exactly like a real game, the moment the
    // first real score is entered — by which point Quiz ID, Location and Host Name are already
    // filled, so canScore()'s gate never has anything left to block with an alert().
    // Teams start empty on purpose — the host adds and names (and guesses) the first one by
    // hand, and the tour adds the rest visibly, one at a time, rather than everyone being there
    // already.
    return s;
  }

  // steps() is rebuilt fresh on every call (see the STEP TABLE note below), so this can read
  // gameState.teams[0] live and always reflect whatever the host actually typed as their first
  // team's name, rather than a name baked in when the step table was first defined. Left
  // un-escaped here — renderCallout() escapes the whole step.text as one string, so escaping
  // this piece too would double-escape it (an apostrophe in a team name showing as &amp;#39;).
  function team0Name() {
    return gameState.teams[0]?.name || "your team";
  }

  // ── AUTO-FILL GENERATORS ────────────────────────────────────────────────────────────────
  // There's no existing "realistic score generator" in the app to reuse — loadSampleGame()'s
  // data is a static hand-authored fixture, not something built by runtime logic — so this is
  // new, tutorial-only logic. It drives the real cycleW/setB/setHW/setHC/setFW/setFC functions
  // rather than writing gameState by hand, so auto-filled answers are indistinguishable from
  // real ones to every other part of the app (audit trail, standings, exports, all of it).
  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  // Skewed towards "mostly right" so the tour's standings look like a real competent room,
  // not a coin flip.
  function plausibleCorrect() {
    return Math.random() < 0.72;
  }
  // skipCell: a single {ti, qi} slot to leave alone — used only for Round 1, where the host
  // hand-scores Q1 for their own team (through the full correct/incorrect/clear cycle) and this
  // only has to fill in that one skipped slot's teammates, the same team's other 3 questions.
  function autoFillRound(ri, skipCell) {
    const wagers = ROUND_WAGERS[ri].slice();
    gameState.teams.forEach((_, ti) => {
      const order = wagers.slice().sort(() => Math.random() - 0.5);
      let wi = 0;
      for (let qi = 0; qi < 4; qi++) {
        if (skipCell && skipCell.ti === ti && skipCell.qi === qi) continue;
        const already = gameState.rounds[ri].questions[qi][ti];
        if (already && already.wager != null) continue;
        while (
          wi < order.length &&
          usedW(ti, ri).some((u) => u.wager === order[wi] && u.qi !== qi)
        )
          wi++;
        const w = wi < order.length ? order[wi++] : wagers[qi];
        cycleW(ri, qi, ti, w); // 1st tap: select wager + mark correct
        if (!plausibleCorrect()) cycleW(ri, qi, ti, w); // 2nd tap on same wager: flip to incorrect
      }
    });
    if (BONUS_ROUNDS.has(ri)) autoFillBonus(ri);
  }
  function autoFillBonus(ri) {
    gameState.teams.forEach((_, ti) => {
      if (gameState.rounds[ri].bonus[ti] != null) return;
      setB(ri, ti, randInt(0, 4));
    });
  }
  function autoFillSpecialWager(type, skipTi) {
    const max = type === "final" ? 20 : 10;
    const wSet = type === "final" ? setFW : setHW;
    const cSet = type === "final" ? setFC : setHC;
    gameState.teams.forEach((_, ti) => {
      if (skipTi === ti) return; // already placed live
      const data = type === "final" ? gameState.finalWager : gameState.halftime;
      if (data[ti] && data[ti].wager != null) return;
      wSet(ti, randInt(1, max));
      cSet(ti, plausibleCorrect());
    });
  }
  // Forces two of the auto-filled teams to land on the exact same total (via the real manual
  // adjustment field grandTotal() already reads — this doesn't fake any answers) so Final
  // Results visibly demonstrates its "closer guess wins" tie-break rule instead of that only
  // ever showing up by chance. Teams 1 and 2 (both auto-added, both with distinct random score
  // guesses by construction) always exist by the time this runs.
  function forceTieBreakDemo() {
    const [a, b] = [1, 2];
    if (!gameState.teams[a] || !gameState.teams[b]) return;
    const diff = grandTotal(a) - grandTotal(b);
    gameState.teams[b].adjustment = (gameState.teams[b].adjustment || 0) + diff;
  }
  // Adds the remaining 4 practice teams after the host's own hand-added first one. Guarded
  // against re-running with a full roster already in place — going Back to the previous step
  // and forward again re-enters this step's fill(), and without the guard it would add a
  // second batch of 4 on top of the first.
  function addTeamsSequentially(ready) {
    if (gameState.teams.length > PRACTICE_TEAMS.length) {
      ready();
      return;
    }
    let i = 0;
    const step = () => {
      if (i >= PRACTICE_TEAMS.length) {
        ready();
        return;
      }
      addTeam(); // real function: pushes a fresh empty team and re-renders
      const t = gameState.teams[gameState.teams.length - 1];
      t.name = PRACTICE_TEAMS[i];
      t.scoreGuess = 60 + Math.floor(Math.random() * 60);
      renderAll();
      i++;
      setTimeout(step, 220);
    };
    step();
  }

  // ── STEP TABLE ───────────────────────────────────────────────────────────────────────────
  // Declarative: each step names what to spotlight, what to say, and how it ends.
  //   'manual' — waits on the callout's own Next button, always, even ones that run an
  //     auto-fill (fill(ready) does its work, real onclick/onchange handlers and all, then
  //     calls ready() to reveal Next; the host still has to tap it, the same as any other step,
  //     instead of the tour silently moving on by itself on a timer).
  //   'on-click' — waits on the real onclick handler already wired to the target — no shadow
  //     event system, the tour just watches the resulting state (done()) on every render — and
  //     advances on its own the moment that's satisfied, since that real tap already **is** the
  //     host's explicit action; nothing further to click. Reserved for button/checkbox-style
  //     taps where there's nothing to double-check afterward.
  //   'confirm' — a real action is required (typing into a typo-prone free-text field, or a
  //     click that opens something worth exploring, like the Score Audit), but the tour never
  //     auto-advances the instant done() goes true: it only reveals a Next/Done button, and the
  //     host reviews what they typed (or plays around with what just opened) and taps it
  //     themselves. waitHint/doneLabel on the step override the default "type here"/"Done →"
  //     copy for steps where that phrasing doesn't fit (e.g. a click-triggered one).
  function steps() {
    return [
      {
        target: ".logo",
        text: "Welcome to Scorekeeper! This is a short practice run with 5 fake teams — nothing here touches your real game. Let's fill out a night start to finish, hands-on.",
        advance: "manual",
      },
      {
        target: "#sec-meta",
        text: "Every game starts with Event Details — I've pre-filled the date, location, and craft partner for practice. Quiz ID and Host Name are left for you to fill in, since every real game needs those typed by hand.",
        advance: "manual",
      },
      {
        target: ".quiz-id-input",
        text: "Type a Quiz ID — any format works (the hint is just advisory). Tap Done once you're happy with it.",
        advance: "confirm",
        done: () => !!(gameState.meta.quizId || "").trim(),
      },
      {
        target: 'input[placeholder="Who\'s hosting"]',
        text: "Now type your own name in Host Name, then tap Done.",
        advance: "confirm",
        done: () => !!(gameState.meta.hostName || "").trim(),
      },
      {
        target: "#addTeamBtn",
        text: "Tap + Add Team to add your first team.",
        advance: "on-click",
        done: () => !!gameState.teams.length,
      },
      {
        target: '.team-entry:first-child input[type="text"]',
        text: "Type a name for your team, then tap Done.",
        advance: "confirm",
        done: () => !!(gameState.teams[0]?.name || "").trim(),
      },
      {
        target: '.team-entry:first-child input[type="number"]',
        text: "And a score guess — every team needs a final score guess before scoring can begin. Tap Done once it's in.",
        advance: "confirm",
        done: () => {
          const t = gameState.teams[0];
          return !!t && t.scoreGuess !== "" && t.scoreGuess != null;
        },
      },
      {
        // The label, not the bare checkbox — #bi0 itself is visually covered by its own
        // styled .check-box span (that's what's actually drawn), so a spotlight/click sized
        // around the native input alone would sit on a box the span intercepts pointer events
        // over. The label wraps both and is what real taps land on.
        target: "label.item-check:has(#bi0)",
        text: "Check the +5 Bonus box if your team brought tonight's bonus item — try it for your own team.",
        advance: "on-click",
        // The checkbox's own onchange calls renderSB(), which is already hooked (see
        // installHooks below), so nothing extra needs to be wired up here for the check to run.
        done: () => !!gameState.teams[0]?.bonusItem,
      },
      {
        target: "#addTeamBtn",
        text: "I'll add the rest of your teams, guesses included — every team needs one before scoring starts.",
        advance: "manual",
        fill: (ready) => addTeamsSequentially(ready),
      },
      {
        target: "#sec-r1 .section-header",
        text: "Every section header collapses and expands the section below it — handy once a round's fully scored and you want it out of the way. Tap Round 1's header to collapse it, then tap it again to bring it back.",
        advance: "on-click",
        fill: () => {
          sawSectionCollapsed = false;
          // toggleSection() flips collapsedSections and the element's own class directly — it
          // never calls a hooked render function, so nothing would otherwise re-check done()
          // after either tap (same issue as the audit/PDF/JD Upload steps further down).
          const header = document.querySelector("#sec-r1 .section-header");
          if (header) header.addEventListener("click", () => checkOnClickDone());
        },
        done: () => {
          if (collapsedSections.has("sec-r1")) sawSectionCollapsed = true;
          return sawSectionCollapsed && !collapsedSections.has("sec-r1");
        },
      },
      {
        target: '.team-answer[data-ta="0-0-0"] .wager-btn:nth-child(1)',
        text: `Tap the same wager amount repeatedly to cycle it: correct, then incorrect, then cleared entirely, then select it again and mark it wrong once more. Run the whole cycle on Q1 for "${team0Name()}".`,
        advance: "on-click",
        fill: () => {
          r1CycleSeen = { correct: false, incorrect: false, cleared: false, incorrectAgain: false };
        },
        done: () => {
          const a = gameState.rounds[0].questions[0][0];
          if (a && a.correct === true) r1CycleSeen.correct = true;
          else if (a && a.correct === false) {
            if (r1CycleSeen.cleared) r1CycleSeen.incorrectAgain = true;
            else r1CycleSeen.incorrect = true;
          } else if (!a && r1CycleSeen.correct) {
            r1CycleSeen.cleared = true;
          }
          return (
            r1CycleSeen.correct &&
            r1CycleSeen.incorrect &&
            r1CycleSeen.cleared &&
            r1CycleSeen.incorrectAgain
          );
        },
      },
      {
        target: '.team-answer[data-ta="0-0-0"] .ta-name-clickable',
        text: `Tap "${team0Name()}"'s name to open the Score Audit — a full point-by-point breakdown for that team.`,
        // 'confirm' rather than 'on-click' here on purpose: the audit is worth actually reading,
        // not something to blow straight past the instant it opens — this waits for the tap,
        // then leaves it open and lets the host look around, tapping Next whenever they're ready.
        advance: "confirm",
        waitHint: "Tap the highlighted name to open the Score Audit",
        doneLabel: "Next →",
        fill: () => {
          auditOpened = false;
          // openAudit() only toggles a class on the modal directly — no hooked render function
          // runs, so nothing would otherwise re-check done() after the tap (same reasoning as
          // the section-header step above).
          const nameEl = document.querySelector(
            '.team-answer[data-ta="0-0-0"] .ta-name-clickable',
          );
          if (nameEl)
            nameEl.addEventListener(
              "click",
              () => {
                auditOpened = true;
                checkOnClickDone();
              },
              { once: true },
            );
        },
        done: () => auditOpened,
      },
      {
        target: ".audit-close",
        text: "Take a look, then tap ✕ Close to dismiss it.",
        advance: "on-click",
        // closeAudit() only toggles the same class directly — same reasoning as the step that
        // opened it: nothing hooked runs on its own, so wire up a listener here too.
        fill: () => {
          const btn = document.querySelector(".audit-close");
          if (btn) btn.addEventListener("click", () => checkOnClickDone(), { once: true });
        },
        done: () => !document.getElementById("auditOverlay")?.classList.contains("show"),
      },
      {
        target: "#bqblock-0 .bonus-row:first-child .bonus-choice-btn:nth-child(1)",
        text: `Round 1 also has a Bonus Question (shown as Q5) — how many of the 4 sub-answers did "${team0Name()}" get right? Tap a number, worth 5 points each.`,
        advance: "on-click",
        done: () => gameState.rounds[0].bonus[0] != null,
      },
      {
        target: "#themeToggle",
        text: "One more thing worth trying: Light and Dark mode, right here in Settings. Flip it a few times, then tap Next once you've settled on the one you like.",
        advance: "manual",
        fill: (ready) => {
          if (!loadPrefs().settingsOpen) toggleSettings();
          ready();
        },
      },
      {
        target: "#cbSelect",
        text: "There's also a Color Vision mode here, for red-green or blue-yellow color blindness — take a look and pick one if it helps, or leave it Off. Tap Next when you're ready to keep going.",
        advance: "manual",
        fill: (ready) => {
          if (!loadPrefs().settingsOpen) toggleSettings();
          ready();
        },
      },
      {
        target: "#sec-r1",
        text: "Nicely done — that's every scoring move there is. Now I'll fill in the rest of Round 1, including the Bonus Question at the bottom (up to 4×5 points), so the standings start looking real.",
        advance: "manual",
        fill: (ready) => {
          document.getElementById("auditOverlay")?.classList.remove("show");
          if (loadPrefs().settingsOpen) toggleSettings();
          autoFillRound(0, { ti: 0, qi: 0 });
          ready();
        },
      },
      {
        target: '#swblock-halftime .special-wager-row:first-child',
        text: `At halftime, each team wagers 1-10 points on a single question. Pick an amount, then mark it right or wrong for ${team0Name()}.`,
        advance: "on-click",
        done: () => {
          const d = gameState.halftime[0];
          return !!(d && d.wager != null && d.correct != null);
        },
      },
      {
        target: "#swblock-halftime",
        text: "I'll fill in the rest of the halftime wagers.",
        advance: "manual",
        fill: (ready) => {
          autoFillSpecialWager("halftime", 0);
          ready();
        },
      },
      {
        target: "#sec-r2",
        text: "Round 2 is the same tap-to-pick-and-mark mechanic you just used — only the wager amounts change (1, 3, 5, 7 here). I'll fill it in.",
        advance: "manual",
        fill: (ready) => {
          autoFillRound(1);
          ready();
        },
      },
      {
        target: "#sec-r3",
        text: "Round 3 — same mechanic again, wagers 2, 4, 6, 8, plus another Bonus Question.",
        advance: "manual",
        fill: (ready) => {
          autoFillRound(2);
          ready();
        },
      },
      {
        target: "#sec-r4",
        text: "Round 4 — wagers 3, 6, 9, 12 — plus the Final Wager at the end, which uses the same pick-an-amount-then-mark-it mechanic as halftime (1-20 this time).",
        advance: "manual",
        fill: (ready) => {
          autoFillRound(3);
          autoFillSpecialWager("final");
          forceTieBreakDemo();
          renderAll();
          ready();
        },
      },
      {
        target: "#sec-final",
        text: "Final Results — ranked standings, guess-vs-actual, and a tie-break note when two teams land on the same score (two of your practice teams did, on purpose, so you can see it: whichever guessed closer to their real total ranks higher).",
        advance: "manual",
      },
      {
        target: "#sec-craftprize",
        text: "The Craft Prize drawing runs a drumroll and picks a winner from the eligible teams. Let's open it.",
        advance: "manual",
        fill: (ready) => {
          // Starts collapsed, same as a real game — expand it here, right when the tour
          // actually reaches it, rather than forcing it open from the very start of the tour.
          collapsedSections.delete("sec-craftprize");
          openCraftPrizeFlow();
          ready();
        },
      },
      {
        target: ".cp-draw-btn",
        text: "This step needs a real tap, on purpose — audio can only start from an actual tap, not something the tour can trigger for you. Tap Start Drumroll.",
        advance: "on-click",
        done: () => !!gameState.craftPrizeWinner,
      },
      {
        target: 'button[onclick="exportPDF()"]',
        text: "Every export lives in Export & Data. Tap 📕 PDF — it downloads a real scoresheet for this practice game.",
        advance: "on-click",
        fill: () => {
          pdfExportClicked = false;
          const b = document.querySelector('button[onclick="exportPDF()"]');
          // Exporting doesn't touch gameState or call any hooked render function, so nothing
          // would otherwise trigger checkOnClickDone() afterwards — call it directly here, same
          // as the JD Upload Form step below.
          if (b)
            b.addEventListener(
              "click",
              () => {
                pdfExportClicked = true;
                checkOnClickDone();
              },
              { once: true },
            );
        },
        done: () => pdfExportClicked,
      },
      {
        target: 'a[href="https://app.jotform.com/261954293403156"]',
        text: "Now tap 🔗 JD Upload Form — it opens in a new tab, which is where a finished scoresheet actually gets turned in.",
        advance: "on-click",
        fill: () => {
          // The app's own "Export complete. Clear session?" prompt appeared after that PDF tap
          // — dismiss it here rather than leaving two prompts competing for attention while this
          // step asks for a second real tap; the tour points at Clear Session on its own, below.
          document.getElementById("exportPrompt")?.classList.remove("show");
          jdUploadClicked = false;
          const a = document.querySelector(
            'a[href="https://app.jotform.com/261954293403156"]',
          );
          // Opening a new tab doesn't touch gameState or call any hooked render function either
          // — same reasoning as the PDF step above.
          if (a)
            a.addEventListener(
              "click",
              () => {
                jdUploadClicked = true;
                checkOnClickDone();
              },
              { once: true },
            );
        },
        done: () => jdUploadClicked,
      },
      {
        target: "#sec-export .btn-danger",
        text: "That's a full game. Tap Finish and keep playing around with this practice one for as long as you like — nothing bad happens. 🗑 Clear Session below is the way to wipe it and start a brand new real game whenever you're ready.",
        advance: "manual",
        last: true,
      },
    ];
  }

  // ── SNAPSHOT / RESTORE ──────────────────────────────────────────────────────────────────
  // More module-level state than just gameState/collapsedSections drives what's on screen —
  // every one of these is snapshotted and restored so the tour can never leak into, or leak
  // out of, the real session.
  function stateVars() {
    return [
      ["gameState", (v) => (gameState = v), () => gameState],
      ["scoreSortMode", (v) => (scoreSortMode = v), () => scoreSortMode],
      ["randomOrder", (v) => (randomOrder = v), () => randomOrder],
      ["standingsSortMode", (v) => (standingsSortMode = v), () => standingsSortMode],
      ["standingsRandomOrder", (v) => (standingsRandomOrder = v), () => standingsRandomOrder],
      ["collapsedStandings", (v) => (collapsedStandings = v), () => collapsedStandings],
      ["collapsedSections", (v) => (collapsedSections = v), () => collapsedSections],
      ["collapsedQuestions", (v) => (collapsedQuestions = v), () => collapsedQuestions],
      ["collapsedBonusQuestions", (v) => (collapsedBonusQuestions = v), () => collapsedBonusQuestions],
      ["collapsedSpecialWagers", (v) => (collapsedSpecialWagers = v), () => collapsedSpecialWagers],
      ["questionSortOrder", (v) => (questionSortOrder = v), () => questionSortOrder],
      ["adjOpenTeams", (v) => (adjOpenTeams = v), () => adjOpenTeams],
      ["beerRoundToasted", (v) => (beerRoundToasted = v), () => beerRoundToasted],
      ["lastAction", (v) => (lastAction = v), () => lastAction],
      ["banterState", (v) => (banterState = v), () => banterState],
      ["craftFlowOpen", (v) => (craftFlowOpen = v), () => craftFlowOpen],
    ];
  }
  function snapshotAppState() {
    const s = {};
    stateVars().forEach(([name, , get]) => (s[name] = get()));
    return s;
  }
  function restoreAppState(s) {
    stateVars().forEach(([name, set]) => set(s[name]));
  }

  // ── HOOKS ────────────────────────────────────────────────────────────────────────────────
  // Wraps the app's own render/autosave/startNewGame functions rather than editing them — see
  // the file-top note. autosave is suspended entirely for the tour (a no-op), and every render
  // additionally repositions the spotlight and checks whether the active 'on-click' step just
  // completed.
  function installHooks() {
    orig = { renderAll, renderLeft, renderSB, autosave, startNewGame };
    const afterRender = () => {
      if (active) {
        checkOnClickDone();
        reposition();
      }
    };
    renderAll = function (...a) {
      orig.renderAll.apply(this, a);
      afterRender();
    };
    renderLeft = function (...a) {
      orig.renderLeft.apply(this, a);
      afterRender();
    };
    renderSB = function (...a) {
      orig.renderSB.apply(this, a);
      afterRender();
    };
    autosave = function () {}; // real gameState is untouched; nothing to persist during a tour
    // The last step points the host at Clear Session, which calls startNewGame() — and
    // startNewGame() resets exactly the same module-level vars snapshotAppState() captured
    // (gameState, collapsedSections, sort modes, all of it) plus wipes real storage via
    // clearSaved(). Left alone, tapping it mid-tour would build the host a genuine fresh game
    // and then exit() would silently throw it away, restoring the stale pre-tour session
    // instead — exactly backwards from what tapping Clear Session is supposed to do. So: run
    // the real reset, keep its result as the state to carry forward, and end the tour
    // immediately since there's nothing meaningful left to spotlight in an empty game.
    startNewGame = function (...a) {
      orig.startNewGame.apply(this, a);
      if (active) exit({ keepCurrent: true });
    };
  }
  function removeHooks() {
    if (!orig) return;
    renderAll = orig.renderAll;
    renderLeft = orig.renderLeft;
    renderSB = orig.renderSB;
    autosave = orig.autosave;
    startNewGame = orig.startNewGame;
    orig = null;
  }

  // ── ENGINE ───────────────────────────────────────────────────────────────────────────────
  function start() {
    if (active) return;
    if (loadPrefs().settingsOpen) closeSettingsPanel();
    snapshot = snapshotAppState();
    installHooks();
    active = true;
    stepIndex = -1;
    gameState = buildPracticeState();
    // Round 1-4, Craft Prize, and Export all start collapsed by default on any fresh game (see
    // collapsedSections' own initial value in app.js) — every step below spotlights something
    // inside one of those, so leaving them collapsed would target a real element sitting at
    // zero size. Round 1-4 and Export stay open for the whole tour since steps reach into them
    // from early on; Craft Prize is left collapsed here on purpose, same as a real game, and
    // its own step below opens it right when the tour actually gets there.
    collapsedSections = new Set(["sec-craftprize"]);
    // The drumroll length is a Settings slider, not part of gameState, so it survives the
    // gameState swap untouched — left alone, the tour would run whatever the host's real game
    // is set to (3-30s). Pinning it to a fixed 6s here makes the one step that needs a real
    // gesture predictable to walk through; the host's real preference is restored on exit.
    const p = loadPrefs();
    origCraftDrawSeconds = p.craftDrawSeconds;
    p.craftDrawSeconds = 6;
    savePrefs(p);
    renderAll();
    goToStep(0);
  }
  // Shared teardown for both ways out of the tour.
  //   - Skip (bailing out early, at any point): restores the real pre-tour session untouched —
  //     the safe default when the host didn't actually finish setting anything up.
  //   - Finish (reached the last step and tapped it): keepCurrent leaves the practice game
  //     itself as the live session instead of discarding it, so the host can keep playing with
  //     it — Clear Session (pointed at on that last step) is the deliberate, explicit way to
  //     wipe it and start a real one. This is the same "keep whatever's current" pattern the
  //     startNewGame hook above already uses for the Clear Session case, just generalized.
  // Restoring gameState alone was never enough either way: the Craft Prize step leaves a real,
  // timer-driven async chain running (craftDrawTimeouts / drumAudio), keyed to team indices
  // from the throwaway practice roster. If that's still in flight when the tour exits, leaving
  // it to fire later would flag the wrong team (or index out of range) against whichever
  // gameState is now live — so it's torn down explicitly here, every time, not just when the
  // craft prize step happens to be current.
  function exit(opts) {
    if (!active) return;
    stopAllDrumAudio();
    clearCraftDrawTimers();
    craftDrawState = null;
    if (sidebarOpenedByTour) {
      toggleSidebar();
      sidebarOpenedByTour = false;
    }
    document.getElementById("auditOverlay")?.classList.remove("show");
    if (loadPrefs().settingsOpen) closeSettingsPanel();
    teardownOverlay();
    removeHooks();
    if (opts && opts.keepCurrent) snapshot = snapshotAppState();
    restoreAppState(snapshot);
    snapshot = null;
    if (origCraftDrawSeconds != null) {
      const p = loadPrefs();
      p.craftDrawSeconds = origCraftDrawSeconds;
      savePrefs(p);
      origCraftDrawSeconds = null;
    }
    active = false;
    stepIndex = -1;
    TRStore.setItem(SEEN_KEY, "1");
    renderAll();
    const el = document.getElementById("tutorialFirstRun");
    if (el) el.remove();
  }
  function skip() {
    exit();
  }

  function currentStep() {
    return steps()[stepIndex];
  }
  // opts.skipArrivalCheck: used when navigating Back to review an already-completed 'on-click'
  // step — without it, arriving would immediately re-trigger the "already done" catch-up below
  // and snap straight back forward again, defeating the point of going back to look at it.
  function goToStep(i, opts) {
    if (i < 0) return; // nothing before the first step
    const all = steps();
    if (i >= all.length) {
      // The only way to reach here is tapping Finish on the last step (see the step table's
      // own note — it's the sole 'last' step and nothing else advances past the end) — a
      // deliberate completion, so the practice game carries forward as the live session.
      exit({ keepCurrent: true });
      return;
    }
    stepIndex = i;
    advancing = false; // this step hasn't scheduled its own advance yet
    stepReady = false; // Next/Done stays hidden until fill() (if any) says it's ready
    const step = all[i];
    const markReady = () => {
      stepReady = true;
      renderCallout();
    };
    if (step.fill) step.fill(markReady);
    // 'type' steps show their Done button as soon as done() is already true — relevant on
    // arrival mainly when navigating Back to a text field the host already filled in.
    else if (step.advance === "confirm") stepReady = !!(step.done && step.done());
    else stepReady = true;
    renderCallout();
    reposition();
    // checkOnClickDone otherwise only runs from the render hook — if an on-click step's
    // condition is already true the moment the tour arrives here (a fast tap that landed
    // before this step became current, or a coincidental side effect of an earlier fill()),
    // nothing would ever re-check it and the tour would sit on an already-satisfied step
    // forever, since arriving at a step doesn't by itself trigger an app render.
    if (!(opts && opts.skipArrivalCheck)) checkOnClickDone();
  }
  function next() {
    goToStep(stepIndex + 1);
  }
  function back() {
    goToStep(stepIndex - 1, { skipArrivalCheck: true });
  }
  // Multiple renders can land while a step's done() stays true (e.g. the halftime step fires
  // one render from its <select> and another from its correct/incorrect tap) — without a guard,
  // each render would independently schedule its own advance, and stacked setTimeouts would
  // walk stepIndex forward more than once for a single completed step.
  function checkOnClickDone() {
    if (!active) return;
    const step = currentStep();
    if (!step || !step.done) return;
    if (step.advance === "on-click") {
      if (advancing) return;
      if (step.done()) {
        advancing = true;
        setTimeout(() => goToStep(stepIndex + 1), 500); // let the tap's own feedback land first
      }
    } else if (step.advance === "confirm") {
      // Text fields are typo-prone, so 'type' steps never auto-advance — this only reveals or
      // hides the Done button as the field's content changes; the host still has to tap it,
      // same as any other step, giving them a chance to fix a typo before moving on.
      const ready = step.done();
      if (ready !== stepReady) {
        stepReady = ready;
        renderCallout();
      }
    }
  }

  // ── SPOTLIGHT DOM ────────────────────────────────────────────────────────────────────────
  // The overlay's own bars/ring/callout are created once and held — only the app's TARGET
  // element has to be re-queried after every render (see file-top note).
  let dom = null;
  function ensureOverlay() {
    if (dom) return dom;
    const mk = (cls) => {
      const d = document.createElement("div");
      d.className = cls;
      document.body.appendChild(d);
      return d;
    };
    dom = {
      top: mk("tutorial-bar tutorial-bar-top"),
      bottom: mk("tutorial-bar tutorial-bar-bottom"),
      left: mk("tutorial-bar tutorial-bar-left"),
      right: mk("tutorial-bar tutorial-bar-right"),
      ring: mk("tutorial-ring"),
      callout: mk("tutorial-callout"),
    };
    return dom;
  }
  function teardownOverlay() {
    if (!dom) return;
    Object.values(dom).forEach((el) => el.remove());
    dom = null;
  }
  function renderCallout() {
    if (!dom) ensureOverlay();
    const all = steps();
    const step = currentStep();
    const showNext = step.advance !== "on-click" && stepReady;
    const showBack = stepIndex > 0;
    dom.callout.innerHTML =
      `<div class="tutorial-callout-step">Step ${stepIndex + 1} of ${all.length}</div>` +
      `<div class="tutorial-callout-text">${esc(step.text)}</div>` +
      `<div class="tutorial-callout-row">` +
      `<div class="tutorial-callout-nav">` +
      (showBack
        ? `<button class="tutorial-callout-back" onclick="Tutorial.back()">← Back</button>`
        : "") +
      (showNext
        ? `<button class="tutorial-callout-next" onclick="Tutorial.next()">${step.last ? "Finish" : step.doneLabel || (step.advance === "confirm" ? "Done →" : "Next →")}</button>`
        : step.advance === "on-click"
          ? `<span class="tutorial-callout-hint">Tap the highlighted button to continue</span>`
          : step.advance === "confirm"
            ? `<span class="tutorial-callout-hint">${step.waitHint || "Type in the highlighted field to continue"}</span>`
            : `<span class="tutorial-callout-hint">One moment…</span>`) +
      `</div>` +
      `<button class="tutorial-callout-skip" onclick="Tutorial.skip()">Skip tour</button>` +
      `</div>`;
  }
  // A step's target is usually a fixed selector, but some steps point at different elements
  // depending on state reached mid-step (see the "add your first team" step, which starts on
  // the Add Team button and has to follow the spotlight onto the name and guess fields as they
  // appear) — so target can be a selector string or a function returning one, resolved fresh on
  // every reposition.
  function stepTarget(step) {
    return typeof step.target === "function" ? step.target() : step.target;
  }
  // Waits a beat before measuring on mobile — spotlighting anything inside the sidebar sheet
  // needs toggleSidebar() first, and that panel animates open over ~280ms (see .col-right's
  // transition in styles.css); measuring immediately would grab a mid-transition rect.
  function withTargetReady(step, cb) {
    // Sidebar is only a separate surface on the mobile layout (.col-right becomes the bottom
    // sheet there) — on desktop the same markup is already visible in place, so there's
    // nothing to open or wait on. None of the current steps target it, but future ones (e.g.
    // spotlighting live standings) would need exactly this.
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const target = document.querySelector(stepTarget(step));
    const inSidebar = target && !!target.closest("#sidebar");
    if (mobile && inSidebar && !sidebarOpenedByTour) {
      toggleSidebar();
      sidebarOpenedByTour = true;
      setTimeout(cb, 300);
      return;
    }
    if ((!mobile || !inSidebar) && sidebarOpenedByTour) {
      toggleSidebar();
      sidebarOpenedByTour = false;
      setTimeout(cb, 300);
      return;
    }
    cb();
  }
  function reposition() {
    if (repositionRaf) cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      const step = currentStep();
      if (!step) return;
      withTargetReady(step, () => doReposition(step));
    });
  }
  function doReposition(step) {
    if (!dom) ensureOverlay();
    const el = document.querySelector(stepTarget(step));
    if (!el) {
      // Target not on screen yet (e.g. a render is still catching up) — try again next frame
      // rather than leaving the spotlight stranded on a stale rect.
      requestAnimationFrame(() => reposition());
      return;
    }
    // Never scrolls the page itself — only ever reads the target's current position and draws
    // the spotlight around wherever that is. This used to call scrollIntoView() to bring a new
    // target into view, but that fights the host's own scrolling: combined with the
    // capture-phase "scroll" listener below (which re-triggers reposition() on ANY scroll,
    // including the ones scrollIntoView itself produces), a forced scroll could settle into a
    // feedback loop — inside a nested scrollable container (the Settings panel, which has its
    // own overflow-y:auto) that stranded the callout off-screen and made the page feel stuck.
    // Leaving the view entirely under the host's control avoids that outright.
    const r = el.getBoundingClientRect();
    const pad = 6;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    // getBoundingClientRect() is viewport-relative, and with the forced scroll gone above, the
    // target can now genuinely sit outside the viewport (simply because the host hasn't
    // scrolled there yet) rather than always being wherever a scrollIntoView call just put it.
    // .tutorial-callout is position:fixed, so blindly computing its top/left from an off-screen
    // rect pins it at a viewport-relative offset that can land past the visible area — and
    // since fixed elements don't move with page scroll at all, no amount of scrolling would
    // ever bring it back; that's what "stuck off-screen" actually was. So: only draw a cutout
    // around the target when it's actually on screen, and always clamp the callout itself
    // (Next/Back/Skip) into the visible viewport regardless — the host can never lose access to
    // the controls, even while the thing being described is still scrolled out of view.
    const onScreen = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    if (onScreen) {
      dom.ring.style.display = "";
      dom.top.style.display = dom.bottom.style.display = dom.left.style.display = dom.right.style.display = "";
      dom.top.style.top = "0";
      dom.top.style.left = "0";
      dom.top.style.right = "0";
      dom.top.style.height = Math.max(0, r.top - pad) + "px";
      dom.bottom.style.top = r.bottom + pad + "px";
      dom.bottom.style.left = "0";
      dom.bottom.style.right = "0";
      dom.bottom.style.bottom = "0";
      dom.left.style.top = Math.max(0, r.top - pad) + "px";
      dom.left.style.left = "0";
      dom.left.style.width = Math.max(0, r.left - pad) + "px";
      dom.left.style.height = r.height + pad * 2 + "px";
      dom.right.style.top = Math.max(0, r.top - pad) + "px";
      dom.right.style.left = r.right + pad + "px";
      dom.right.style.right = "0";
      dom.right.style.height = r.height + pad * 2 + "px";
      dom.ring.style.top = r.top - pad + "px";
      dom.ring.style.left = r.left - pad + "px";
      dom.ring.style.width = r.width + pad * 2 + "px";
      dom.ring.style.height = r.height + pad * 2 + "px";
    } else {
      // Nothing on-screen to cut a hole around — dim the whole viewport in two bands instead of
      // computing a cutout position from an off-screen rect (a zero-width/height cutout at a
      // stale spot reads as a bug, not "scroll to find it").
      dom.ring.style.display = "none";
      dom.left.style.display = dom.right.style.display = "none";
      dom.top.style.top = "0";
      dom.top.style.left = "0";
      dom.top.style.right = "0";
      dom.top.style.height = "50%";
      dom.bottom.style.top = "50%";
      dom.bottom.style.left = "0";
      dom.bottom.style.right = "0";
      dom.bottom.style.bottom = "0";
    }
    // The callout is always clamped fully inside the viewport — never anchored purely off the
    // target's (possibly off-screen) rect the way the ring/bars are.
    let top = onScreen
      ? vh - r.bottom > 180
        ? r.bottom + pad + 10
        : Math.max(10, r.top - pad - 10 - 160)
      : vh / 2 - 90;
    let left = onScreen ? r.left : vw / 2 - 160;
    dom.callout.style.bottom = "auto";
    dom.callout.style.top = Math.min(Math.max(10, top), vh - 60) + "px";
    dom.callout.style.left = Math.min(Math.max(10, left), vw - 336) + "px";
  }

  window.addEventListener("resize", () => {
    if (active) reposition();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (active) reposition();
    },
    true,
  );

  // ── ENTRY POINTS ─────────────────────────────────────────────────────────────────────────
  // Runs once, on script load — by this point app.js's own top-level IIFE (js/app.js ~line
  // 784) has already run and either shown the real #resumeBanner (a saved session exists) or
  // rendered a fresh empty game (no saved session). That second case, with no tutorial_seen
  // flag either, is exactly first-time-user — and it's exactly the case #resumeBanner never
  // shows in, so this can't ride its "real estate" (that banner and this one are mutually
  // exclusive by construction); it gets its own small card instead, inserted right above it.
  function maybeOfferFirstRun() {
    if (TRStore.getItem(SEEN_KEY)) return;
    if (loadSaved()) return; // a real saved session exists — don't interrupt it
    const banner = document.getElementById("resumeBanner");
    if (!banner || document.getElementById("tutorialFirstRun")) return;
    const card = document.createElement("div");
    card.className = "tutorial-firstrun";
    card.id = "tutorialFirstRun";
    card.innerHTML =
      `<p>🎓 New here? Take the 2-minute tour.</p>` +
      `<div class="btn-row">` +
      `<button class="btn" onclick="Tutorial.start()">Take the Tour</button>` +
      `<button class="btn" onclick="Tutorial.dismissFirstRun()">Skip</button>` +
      `</div>`;
    banner.parentNode.insertBefore(card, banner);
  }
  function dismissFirstRun() {
    TRStore.setItem(SEEN_KEY, "1");
    const el = document.getElementById("tutorialFirstRun");
    if (el) el.remove();
  }

  return {
    start,
    finish: () => exit({ keepCurrent: true }),
    skip,
    next,
    back,
    maybeOfferFirstRun,
    dismissFirstRun,
  };
})();

Tutorial.maybeOfferFirstRun();
