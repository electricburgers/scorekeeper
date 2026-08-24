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
  let origCraftManualEnd = null; // real saved Manual Drumroll Control setting, restored on exit
  let origQtState = null; // real Question Timer's idle/running/paused state, restored on exit
  let origQtDurationSec = null; // real Question Timer's configured duration, restored on exit
  let origQtEndEpoch = 0; // real Question Timer's absolute end time (if running), restored on exit
  let origQtRemainMs = 0; // real Question Timer's frozen remaining time (if paused), restored on exit
  let sawSectionCollapsed = false; // tracks the collapse->expand sequence for that practice step
  let r1CycleSeen = null; // tracks correct->incorrect->cleared->back-to-correct on one question
  let auditOpened = false; // real click on a team name to open the Team Report modal
  let batching = false; // see runBatched() below
  let pendingRenderKind = null; // "all"|"left"|"sb" — the broadest render still owed once batching ends
  // Note for the PDF export / JD Upload Form steps further down: neither tracks a
  // clicked/not-clicked flag the way every other on-click step does. PDF export and the JD
  // link (opens in a new tab) both leave no in-page state change to poll for, so those two
  // steps lean on fallbackNext (see the STEP TABLE note on it) instead — an always-available
  // Next button — rather than real click detection.

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

  // Same live-rebuild reasoning as team0Name() above: read at steps()-call time (not baked in
  // once) so resizing the window — or rotating a tablet — between steps still gets the right
  // word next render. 768px matches the app's own mobile-layout breakpoint (see styles.css).
  function isMobileViewport() {
    return window.innerWidth <= 768;
  }
  function tapWord() {
    return isMobileViewport() ? "tap" : "click";
  }
  function tapWordCap() {
    return isMobileViewport() ? "Tap" : "Click";
  }
  function tappingWord() {
    return isMobileViewport() ? "tapping" : "clicking";
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
  // The first unused wager for this team/round — shared by every fill helper below so none of
  // them ever hand out a wager amount a team has already spent on another question this round.
  function nextUnusedWager(ri, ti) {
    return ROUND_WAGERS[ri].find(
      (w) => !usedW(ti, ri).some((u) => u.wager === w),
    );
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
  // Marks every team correct on one question, no matter what — the only way to guarantee the
  // Beer Round banner actually appears (isBeerRound() requires every team's answer to be
  // correct) rather than leaving it to the usual ~72% chance and maybe never showing up at all.
  function forceBeerRound(ri, qi) {
    gameState.teams.forEach((_, ti) => {
      if (gameState.rounds[ri].questions[qi][ti]?.wager != null) return;
      // Picking nextUnusedWager() straight would hand every team the same lowest amount, since
      // nothing's used yet this early in the round — shuffle towards the higher wagers instead
      // so the forced beer round doesn't look suspiciously uniform.
      const preferred = [7, 5, 3].sort(() => Math.random() - 0.5);
      const w =
        preferred.find((x) => !usedW(ti, ri).some((u) => u.wager === x)) ??
        nextUnusedWager(ri, ti);
      if (w == null) return;
      cycleW(ri, qi, ti, w); // 1st tap: correct
    });
  }
  // Answers a question for only the given team indices — used to demonstrate the Sort button
  // with a realistic "some teams answered, some didn't" spread rather than the tidy top-to-
  // bottom fills every other auto-fill does.
  function partialFillTeams(ri, qi, tis) {
    tis.forEach((ti) => {
      if (gameState.rounds[ri].questions[qi][ti]?.wager != null) return;
      const w = nextUnusedWager(ri, ti);
      if (w == null) return;
      cycleW(ri, qi, ti, w);
      if (!plausibleCorrect()) cycleW(ri, qi, ti, w);
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
      // Varied on purpose (independent coin flips, not "half get one, half get the other") so
      // the roster ends up with a realistic mix: some teams with neither bonus, some with one,
      // a couple maybe with both — not a tidy, unrealistic pattern.
      t.bonusItem = Math.random() < 0.5;
      t.njcb = Math.random() < 0.4;
      renderAll();
      i++;
      setTimeout(step, 220);
    };
    step();
  }

  // Runs fn() with renderAll/renderLeft/renderSB (installHooks' own wrappers, active for the
  // whole tour) swallowed instead of actually rendering, then does exactly one real render
  // afterward — the broadest one anything inside fn() asked for. autoFillRound alone calls
  // cycleW() up to 20 times (5 practice teams × 4 questions), and every real cycleW() call
  // renders AND (via installHooks' afterRender) reflows the spotlight via reposition()'s
  // getBoundingClientRect() — up to 20 full re-renders plus 20 forced layouts, synchronously,
  // for a single step, before the host ever sees any of the intermediate frames. The step at
  // "Round 4" chains three of these bulk-fill calls back to back (~45 cycleW/setFW/setFC calls
  // total) and was the worst of it. Wrapping each fill() body that calls an auto-fill helper in
  // this collapses that down to the one render that was ever actually going to be visible.
  function runBatched(fn) {
    batching = true;
    pendingRenderKind = null;
    try {
      fn();
    } finally {
      batching = false;
      const kind = pendingRenderKind;
      pendingRenderKind = null;
      if (kind === "all") renderAll();
      else if (kind === "left") renderLeft();
      else if (kind === "sb") renderSB();
    }
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
  //     click that opens something worth exploring, like the Team Report), but the tour never
  //     auto-advances the instant done() goes true: it only reveals a Next/Done button, and the
  //     host reviews what they typed (or plays around with what just opened) and taps it
  //     themselves. waitHint/doneLabel on the step override the default "type here"/"Next →"
  //     copy for steps where that phrasing doesn't fit (e.g. a click-triggered one).
  //     alwaysShowDone: true renders that Done button from the very start of the step too,
  //     just disabled until done() goes true — for the free-text fields, where a host typing a
  //     typo-prone value benefits from seeing the control is coming, not having it pop in.
  //   target/targetEnd — target is a selector (or a function returning one, for steps that
  //     follow the spotlight across a sequence of elements). targetEnd, when present, unions
  //     the two elements' rects into one spotlight box spanning both — e.g. a section's header
  //     together with one specific row below it, without the whole section in between.
  //   calloutPosition: "above" — forces the callout above the target even when there'd be room
  //     to place it below, for steps where the host needs to watch content sitting just below
  //     the target itself (e.g. the Sort demo) that the callout would otherwise cover.
  function steps() {
    return [
      {
        target: null,
        text: "Welcome to the Scorekeeper tutorial! Let's go through a game from start to finish.",
        advance: "manual",
      },
      {
        target: "#sec-meta",
        text: "Every game starts with Event Details — I've pre-filled the date, location, craft partner, bonus item, and restaurant staff. You'll fill in Quiz ID and Host Name next.",
        advance: "manual",
      },
      {
        target: ".quiz-id-input",
        calloutPosition: "above",
        text: `Type a Quiz ID — the format is generally ABC-012. ${tapWordCap()} Next once you're done.`,
        advance: "manual",
        alwaysShowDone: true,
        done: () => !!(gameState.meta.quizId || "").trim(),
      },
      {
        target: 'input[placeholder="Who\'s hosting"]',
        calloutPosition: "above",
        text: `Type your name in Host Name, then ${tapWord()} Next.`,
        advance: "manual",
        alwaysShowDone: true,
        done: () => !!(gameState.meta.hostName || "").trim(),
      },
      {
        // Starts on the ⚙️ gear icon; once the host actually taps it open, follows the
        // spotlight onto the theme toggle inside. toggleSettings() doesn't call any hooked
        // render function (it only flips a class via applyPrefs()), so nothing would otherwise
        // notice the panel opened and move the spotlight — the listener in fill() below does.
        target: () =>
          loadPrefs().settingsOpen ? "#themeToggle" : "#settingsToggleBtn",
        text: `${tapWordCap()} the gear icon in the top right to open Settings. There's Light and Dark modes. Flip between them a few times, then ${tapWord()} Next once you've settled on one you like.`,
        advance: "manual",
        fill: (ready) => {
          const gear = document.getElementById("settingsToggleBtn");
          if (gear)
            gear.addEventListener("click", () => reposition(), { once: true });
          ready();
        },
      },
      {
        target: "#cbSelect",
        // Above, not the default below: this is the one step whose target OPENS something
        // downward. The callout's default placement put it directly over the dropdown it is
        // telling the host to look at — measured at 375x812, it covered 89% of the open menu
        // (both named modes entirely, leaving only part of "Off" visible), and at z-index 601
        // against the menu's own layer it painted on top rather than behind. Placing it above
        // clears the menu completely. The menu also now outranks the tutorial layer (see
        // .cv-select-menu in styles.css), which covers the case this flag cannot: a viewport
        // too short for the callout to fit above, where reposition() falls back to below.
        calloutPosition: "above",
        calloutClears: ".cv-select-menu.cv-open",
        text: `There's also a Color Vision mode here, for red-green or blue-yellow color blindness. ${tapWordCap()} Next when you're ready to keep going.`,
        advance: "manual",
        fill: (ready) => {
          if (!loadPrefs().settingsOpen) toggleSettings();
          // Nothing else notices the dropdown opening — it only flips a class and re-parents the
          // menu — so the callout would otherwise keep the position it took while the menu was
          // still shut. Same pattern as the gear icon on the theme step above.
          const cvBtn = document.querySelector("#cbSelect .cv-select-btn");
          if (cvBtn && !cvBtn.dataset.tutHooked) {
            cvBtn.dataset.tutHooked = "1";
            cvBtn.addEventListener("click", () => setTimeout(reposition, 0));
          }
          ready();
        },
      },
      {
        target: "#addTeamBtn",
        text: `Scroll down to Teams. ${tapWordCap()} + Add Team to add your first team.`,
        advance: "on-click",
        // Settings may still be open from the Color Vision step just before this one — close it
        // here rather than leaving it open through the whole Teams section.
        fill: () => {
          if (loadPrefs().settingsOpen) toggleSettings();
        },
        done: () => !!gameState.teams.length,
      },
      {
        target: '.team-entry:first-child input[type="text"]',
        text: `Enter a name for your team, then ${tapWord()} Next.`,
        advance: "manual",
        alwaysShowDone: true,
        doneLabel: "Next →",
        done: () => !!(gameState.teams[0]?.name || "").trim(),
      },
      {
        target: '.team-entry:first-child input[type="number"]',
        text: `Add a Final Score Guess from 1-146 — every team needs a Final Score Guess before scoring can begin. ${tapWordCap()} Next once it's in.`,
        advance: "manual",
        alwaysShowDone: true,
        doneLabel: "Next →",
        done: () => {
          const t = gameState.teams[0];
          return !!t && t.scoreGuess !== "" && t.scoreGuess != null;
        },
      },
      {
        // The labels, not the bare checkboxes — #bi0/#nj0 themselves are visually covered by
        // their own styled .check-box span (that's what's actually drawn), so a spotlight/click
        // sized around a native input alone would sit on a box the span intercepts pointer
        // events over. The labels wrap both and are what real taps land on.
        target: "label.item-check:has(#bi0)",
        targetEnd: "label.njcb-check:has(#nj0)",
        text: `Check one or both of these Bonus boxes if a team has brought them — try it for ${team0Name()}. ${tapWordCap()} Next when you're done.`,
        // 'confirm' rather than 'on-click' here on purpose: there are two boxes, and checking
        // the first one shouldn't immediately whisk the host past the second before they get a
        // chance to check that one too.
        advance: "confirm",
        // The checkboxes' own onchange calls renderSB(), which is already hooked (see
        // installHooks below), so nothing extra needs to be wired up here for the check to run.
        done: () =>
          !!(gameState.teams[0]?.bonusItem || gameState.teams[0]?.njcb),
      },
      {
        target: "#sec-teams",
        text: "I'll add the rest of the teams and guesses.",
        advance: "manual",
        fill: (ready) => addTeamsSequentially(ready),
      },
      {
        target: "#sec-r1 .section-header",
        text: `Scroll down to Round 1. Every section header collapses and expands the section below it. Handy once a round or question is completed to get it out of the way. ${tapWordCap()} Round 1's header to collapse it, then ${tapWord()} it again to bring it back.`,
        advance: "on-click",
        fill: () => {
          sawSectionCollapsed = false;
          // toggleSection() flips collapsedSections and the element's own class directly — it
          // never calls a hooked render function, so nothing would otherwise re-check done()
          // after either tap (same issue as the audit/PDF/JD Upload steps further down).
          const header = document.querySelector("#sec-r1 .section-header");
          if (header)
            header.addEventListener("click", () => checkOnClickDone());
        },
        done: () => {
          if (collapsedSections.has("sec-r1")) sawSectionCollapsed = true;
          return sawSectionCollapsed && !collapsedSections.has("sec-r1");
        },
      },
      {
        // The whole row — all four wager amounts plus the points box on the right, so the host
        // can see a score land there as they go, not just the buttons themselves.
        target: '.team-answer[data-ta="0-0-0"]',
        text: `${tapWordCap()} any of the four wager amounts. ${tapWordCap()} the same one again to cycle it through: correct, then incorrect, then cleared. Let's say ${team0Name()} got it correct, ${tapWord()} it again to land back on correct. Then ${tapWord()} Next.`,
        advance: "confirm",
        waitHint:
          "Cycle through the states and land back on correct — Next shows up once you do",
        fill: () => {
          r1CycleSeen = { correct: false, incorrect: false, cleared: false };
        },
        done: () => {
          const a = gameState.rounds[0].questions[0][0];
          if (a && a.correct === true) r1CycleSeen.correct = true;
          else if (a && a.correct === false) r1CycleSeen.incorrect = true;
          else if (!a && r1CycleSeen.correct) r1CycleSeen.cleared = true;
          return !!(
            r1CycleSeen.correct &&
            r1CycleSeen.incorrect &&
            r1CycleSeen.cleared &&
            a &&
            a.correct === true
          );
        },
      },
      {
        // Right after the host scores their first real question — a natural pause to show
        // where the Question Timer lives before autofill takes over the rest of Round 1.
        // start() above already forced it to a clean idle state at the true 3-minute default,
        // so this reliably demonstrates that default regardless of any real customized setting.
        target: () =>
          isMobileViewport() ? ".qtimer-mobile" : ".qtimer-desktop",
        text: `The Question Timer is here. ${tapWordCap()} the play button to start a countdown. We'll come back to it at the end.`,
        advance: "on-click",
        // toggleQTimer() only flips module-level timer state and updates the qtimer-* elements
        // directly — it never calls a hooked render function, so nothing would otherwise
        // re-check done() after the tap (same reasoning as the section-header/Team-Report steps
        // above).
        fill: () => {
          const btn = document.querySelector(
            `${isMobileViewport() ? ".qtimer-mobile" : ".qtimer-desktop"} .qtimer-toggle`,
          );
          if (btn)
            btn.addEventListener("click", () => checkOnClickDone(), {
              once: true,
            });
        },
        done: () => qtState === "running",
      },
      {
        target: "#bqblock-0 .q-header",
        targetEnd: "#bqblock-0 .bonus-row:first-child",
        text: `Scroll down to the Q5 Bonus at the end of Round 1. Score this question for ${team0Name()}. Each part is worth 5 points. The total points show up on the right. ${tapWordCap()} Next once you've scored them.`,
        advance: "confirm",
        waitHint: `${tapWordCap()} a number to continue`,
        doneLabel: "Next →",
        done: () => gameState.rounds[0].bonus[0] != null,
      },
      {
        target: "#sec-r1",
        text: `Now I'll fill in the rest of Round 1. Take a look around before ${tappingWord()} Next.`,
        advance: "manual",
        fill: (ready) => {
          document.getElementById("auditOverlay")?.classList.remove("show");
          runBatched(() => autoFillRound(0, { ti: 0, qi: 0 }));
          ready();
        },
      },
      {
        target: "#sec-r2",
        text: "Scroll down to Round 2. Everything's the same, only the wager amounts change (1, 3, 5, 7). I'll fill in everyone's Q1.",
        advance: "manual",
        fill: (ready) => {
          runBatched(() => forceBeerRound(1, 0));
          ready();
        },
      },
      {
        target: "#qblock-1-0 .q-badge.q-beer",
        text: "The Beer Round badge shows up when every team correctly answers a question. It's a fun moment to call out.",
        advance: "manual",
      },
      {
        // The whole card (header + every team row), not just the header-right strip — the step's
        // own text talks about "scanning every row", so the spotlight should actually show every
        // row while saying that, not just the Sort/Reset corner those rows are about to justify.
        target: "#qblock-1-1",
        calloutPosition: "above",
        text: `For Q2, I'll fill in answers only for two teams. With a full room of teams, scanning every row to find a specific team to score gets tedious. ${tapWordCap()} Next, then we'll try out Sorting.`,
        advance: "manual",
        fill: (ready) => {
          runBatched(() => partialFillTeams(1, 1, [0, 2]));
          ready();
        },
      },
      {
        // targetEnd unions Sort with Reset — the step already talks the host through both
        // buttons ("Sort... or ↺ Reset to go back to entry order"), so the spotlight now covers
        // both instead of leaving Reset unspotlighted while the text describes it.
        target: "#qblock-1-1 .q-sort-btn",
        targetEnd: "#qblock-1-1 .q-reset-btn",
        calloutPosition: "above",
        text: `${tapWordCap()} Sort and see it shift the unanswered teams to the top, so you can easily find who's left to score. ${tapWordCap()} it again to re-sort as you score more teams, or Reset to go back to entry order. ${tapWordCap()} Next when you're ready to move on.`,
        // 'confirm' rather than 'on-click' here on purpose — the host might want to tap Sort a
        // few times (and try Reset) to get a feel for it, not get whisked away the instant it
        // sorts once.
        advance: "confirm",
        waitHint: `${tapWordCap()} Sort to continue`,
        done: () => !!questionSortOrder["1-1"],
      },
      {
        target: "#sec-r2",
        text: "I'll fill the rest of Round 2. Next, we'll cover the Before Halftime Wager scores and the Halftime Wager.",
        advance: "manual",
        fill: (ready) => {
          runBatched(() => autoFillRound(1));
          ready();
        },
      },
      {
        target: "#standings-halftime",
        text: "Scroll down to just before the end of Round 2 and you'll see the Before Halftime Wager scores. Read them out so teams know how many points to bet for the Halftime Wager.",
        advance: "manual",
      },
      {
        target: "#swblock-halftime .sw-header",
        targetEnd: "#swblock-halftime .special-wager-row:first-child",
        text: `Round 2's Q5 is the first time teams put their points on the line. Pick an amount from 1 to 10 for ${team0Name()}, mark it right or wrong, then ${tapWord()} Next.`,
        advance: "confirm",
        doneLabel: "Next →",
        waitHint: "Pick a wager and a result to continue",
        done: () => {
          const d = gameState.halftime[0];
          return !!(d && d.wager != null && d.correct != null);
        },
      },
      {
        target: "#swblock-halftime",
        text: `I'll fill in the rest of the halftime wagers.`,
        advance: "manual",
        fill: (ready) => {
          runBatched(() => autoFillSpecialWager("halftime", 0));
          ready();
        },
      },
      {
        target: "#staffThanksBlock",
        text: "Right after the Halftime Wager, there's a shout-out to the staff — a good moment for the room to thank them. It pulls the names entered in Event Details.",
        advance: "manual",
      },
      {
        target: "#sec-r3",
        text: "Scroll down to Round 3. Here the wagers are 2, 4, 6, and 8, plus another multi-part Bonus Question. I'll fill it all in.",
        advance: "manual",
        fill: (ready) => {
          runBatched(() => autoFillRound(2));
          ready();
        },
      },
      {
        target: "#sec-r4",
        text: "Scroll to Round 4. Just like Round 2, there's Before Final Wager scores to read out. For the final question of the night, players can bet up to 20 points. I'll fill it all in before we head down to Final Results.",
        advance: "manual",
        fill: (ready) => {
          // The worst offender before runBatched(): three bulk-fill calls back to back, ~45
          // cycleW/setFW/setFC calls between them, each one a real synchronous render+reflow —
          // see runBatched's own comment. forceTieBreakDemo() only mutates gameState directly
          // (no render of its own), which is exactly why the explicit renderAll() below used to
          // exist — runBatched's pending-kind tracking already covers it now: autoFillRound and
          // autoFillSpecialWager both ask for "all" during the batch, so the one real render
          // runBatched issues afterward already reflects forceTieBreakDemo's adjustment too.
          runBatched(() => {
            autoFillRound(3);
            autoFillSpecialWager("final");
            forceTieBreakDemo();
          });
          ready();
        },
      },
      {
        target: "#sec-final",
        text: "Scroll down to Final Results. It displays scores in ascending order, teams' guess-vs-actual score, and any tie-breakers; whoever guessed closer to their final total ranks higher on the standings.",
        advance: "manual",
        // Defensive: Craft Prize Drawing starts collapsed (see start(), below) and its own step
        // further down is what deliberately opens it — this just re-asserts that collapsed
        // state one more time on the way there, in case it ever got toggled open along the way.
        fill: (ready) => {
          collapsedSections.add("sec-craftprize");
          ready();
        },
      },
      {
        // The team's row in the Final Results table, not Round 1 Q1 — this step comes after
        // the whole game is scored, so the audit is naturally reached from the standings the
        // host is already looking at. openAudit(0) is baked into the row's own onclick
        // regardless of where that team lands in the ranking, so this is stable no matter the
        // final order.
        target: '#sec-final tr[onclick="openAudit(0)"] .ta-name-clickable',
        text: `${tapWordCap()} ${team0Name()}'s name in Final Results (or anywhere during a real game) to open a Team Report detailing every point. Useful in case a team asks you about a specific question.`,
        advance: "on-click",
        fill: () => {
          auditOpened = false;
          // openAudit() only toggles a class on the modal directly — no hooked render function
          // runs, so nothing would otherwise re-check done() after the tap (same reasoning as
          // the section-header step above).
          const nameEl = document.querySelector(
            '#sec-final tr[onclick="openAudit(0)"] .ta-name-clickable',
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
        text: `Take a look, then ${tapWord()} Close to dismiss it.`,
        advance: "on-click",
        // closeAudit() only toggles the same class directly — same reasoning as the step that
        // opened it: nothing hooked runs on its own, so wire up a listener here too.
        fill: () => {
          const btn = document.querySelector(".audit-close");
          if (btn)
            btn.addEventListener("click", () => checkOnClickDone(), {
              once: true,
            });
        },
        done: () =>
          !document.getElementById("auditOverlay")?.classList.contains("show"),
      },
      {
        target: "#sec-craftprize",
        text: `Scroll down to the Craft Prize Drawing. It plays a drumroll and picks a random winner. Let's check it out.`,
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
        target: "#sec-craftprize",
        text: `Here you can exclude the top teams who've already won gift cards. The names are listed to verify who isn't included in the  drawing. You can also set the drumroll duration. Try it out: ${tapWord()} Start Drumroll.`,
        advance: "on-click",
        done: () => !!gameState.craftPrizeWinner,
      },
      {
        target: ".cp-winner",
        targetEnd: ".cp-script",
        text: `There's the Craft Prize Drawing winner! And right below it, a ready-to-read announcement with the craft partner's name and town filled in. You can ${tapWord()} Clear to wipe the choice and draw again.`,
        advance: "manual",
      },
      {
        // One last look at the Question Timer before wrapping up — by now it's been running
        // (or overflowed past 0:00) since Round 1, a real demonstration of elapsed time rather
        // than a fresh countdown.
        target: () =>
          isMobileViewport() ? ".qtimer-mobile" : ".qtimer-desktop",
        text: `Before we wrap up, let's revisit the Question Timer to see how much time has elapsed since Round 1. ${tapWordCap()} the reset button to put it back to 3:00 for the next question.`,
        advance: "on-click",
        fill: () => {
          const btn = document.querySelector(
            `${isMobileViewport() ? ".qtimer-mobile" : ".qtimer-desktop"} .qtimer-reset`,
          );
          if (btn)
            btn.addEventListener("click", () => checkOnClickDone(), {
              once: true,
            });
        },
        done: () => qtState === "idle",
      },
      {
        target: 'button[onclick="exportPDF()"]',
        text: `Scroll down to Export & Data at the bottom. PDF downloads a scoresheet that's ready to send to JD. ${tapWordCap()} Next when you're ready.`,
        advance: "manual",
        // fallbackNext: this listener is the only thing that notices the tap (exporting doesn't
        // touch gameState or call any hooked render function, unlike almost every other step),
        // so if it ever doesn't fire — the button getting rebuilt by some unrelated render
        // between fill() wiring it and the host's tap, for instance — the host would otherwise
        // be stuck with no way to move on. Next is always available here as a way out either
        // way; the real tap still advances on its own the instant it's detected.
      },
      {
        target: 'a[href="https://app.jotform.com/261954293403156"]',
        text: `JD Upload Form sends you to where you submit your scoresheet. Take a look, then come back here to finish up. ${tapWordCap()} Next when you're ready.`,
        advance: "manual",
      },
      {
        // target: null — no spotlight on Clear Session itself; this closing step just narrates
        // where it lives, so the callout lands dead center on the page instead (same no-target
        // path the welcome step uses — see the comment on that path in doReposition()).
        target: null,
        text: `That's a full game! Feel free to keep playing around or check out the FAQ in Settings. To clear this Tutorial and start a new game, ${tapWord()} Clear Session in Export & Data. ${tapWordCap()} Close Tutorial to close this box.`,
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
      [
        "standingsSortMode",
        (v) => (standingsSortMode = v),
        () => standingsSortMode,
      ],
      [
        "standingsRandomOrder",
        (v) => (standingsRandomOrder = v),
        () => standingsRandomOrder,
      ],
      [
        "collapsedStandings",
        (v) => (collapsedStandings = v),
        () => collapsedStandings,
      ],
      [
        "collapsedSections",
        (v) => (collapsedSections = v),
        () => collapsedSections,
      ],
      [
        "collapsedQuestions",
        (v) => (collapsedQuestions = v),
        () => collapsedQuestions,
      ],
      [
        "collapsedBonusQuestions",
        (v) => (collapsedBonusQuestions = v),
        () => collapsedBonusQuestions,
      ],
      [
        "collapsedSpecialWagers",
        (v) => (collapsedSpecialWagers = v),
        () => collapsedSpecialWagers,
      ],
      [
        "questionSortOrder",
        (v) => (questionSortOrder = v),
        () => questionSortOrder,
      ],
      ["adjOpenTeams", (v) => (adjOpenTeams = v), () => adjOpenTeams],
      [
        "beerRoundToasted",
        (v) => (beerRoundToasted = v),
        () => beerRoundToasted,
      ],
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
    // While batching, swallow every render instead of running it — see runBatched() below for
    // why — but still remember the broadest one asked for ("all" beats "left" beats "sb", same
    // ordering the real functions nest in), so runBatched can run exactly that one for real once
    // the loop that triggered all of them is done.
    const rankOf = { all: 3, left: 2, sb: 1 };
    const noteRender = (kind) => {
      if (!pendingRenderKind || rankOf[kind] > rankOf[pendingRenderKind])
        pendingRenderKind = kind;
    };
    renderAll = function (...a) {
      if (batching) return noteRender("all");
      orig.renderAll.apply(this, a);
      afterRender();
    };
    renderLeft = function (...a) {
      if (batching) return noteRender("left");
      orig.renderLeft.apply(this, a);
      afterRender();
    };
    renderSB = function (...a) {
      if (batching) return noteRender("sb");
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
  async function start() {
    if (active) return;
    // Same "are you sure" pattern loadSampleGame() already uses for the same reason: starting
    // the tour swaps in a throwaway practice game, and while that's safely reversible via Skip
    // (the real one comes right back), finishing the tour normally instead keeps the practice
    // game as the live session — so a host with real, unsaved work in progress could genuinely
    // lose it if they don't realize that going in.
    if (
      gameState.teams.length &&
      !(await appConfirm(
        "Starting the tutorial clears your current game in progress and starts a fresh practice one. Skipping the tour brings your real game back, but finishing it normally keeps the practice game instead — export or save first if you need to keep this one. Continue?",
        { okLabel: "Start Tutorial" },
      ))
    )
      return;
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
    // The per-ITEM collapse sets have to be cleared too, and used not to be. Unlike
    // collapsedSections they start empty on a fresh game rather than pre-populated, so nothing
    // here re-created them — they simply carried the host's real session straight into the tour.
    // A host who had tidied away a couple of finished questions before opening the tutorial
    // (which is exactly what that control is for, and what the collapse step below teaches) got
    // a tour whose steps pointed at question blocks that were still shut: the spotlight lands on
    // a zero-height element and the instruction refers to controls that are not on screen.
    // All three are in stateVars() below, so the host's real collapse state is restored on exit
    // the same as everything else the tour touches.
    collapsedQuestions = new Set();
    collapsedBonusQuestions = new Set();
    collapsedSpecialWagers = new Set();
    // The drumroll length is a Settings slider, not part of gameState, so it survives the
    // gameState swap untouched — left alone, the tour would run whatever the host's real game
    // is set to (3-30s). Pinning it to a fixed 6s here makes the one step that needs a real
    // gesture predictable to walk through; the host's real preference is restored on exit.
    const p = loadPrefs();
    origCraftDrawSeconds = p.craftDrawSeconds;
    p.craftDrawSeconds = 6;
    // Manual Drumroll Control adds Stop Drumroll/Play Horn buttons alongside Start Drumroll —
    // real, useful for a host, but extra controls the drumroll step's single on-click detection
    // doesn't expect the host to reach for instead. Forced off for the tour regardless of the
    // host's real setting; restored on exit either way.
    origCraftManualEnd = !!p.craftManualEnd;
    p.craftManualEnd = false;
    savePrefs(p);
    // Same reasoning as the drumroll length above: the Question Timer isn't part of gameState
    // either, so a real countdown mid-flight — or a duration the host customized in Settings —
    // would otherwise carry straight into the tour's own timer steps untouched. Snapshot it and
    // force a clean idle state at the true 3-minute default; the host's real timer is restored
    // byte-for-byte on exit.
    origQtState = qtState;
    origQtDurationSec = qtDurationSec;
    origQtEndEpoch = qtEndEpoch;
    origQtRemainMs = qtRemainMs;
    qtDurationSec = QT_DEFAULT_SEC;
    resetQTimer();
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
  // timer-driven async chain running (craftDrawTimeouts / activeWebAudio), keyed to team indices
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
    if (origCraftDrawSeconds != null || origCraftManualEnd != null) {
      const p = loadPrefs();
      if (origCraftDrawSeconds != null)
        p.craftDrawSeconds = origCraftDrawSeconds;
      if (origCraftManualEnd != null) p.craftManualEnd = origCraftManualEnd;
      savePrefs(p);
      origCraftDrawSeconds = null;
      origCraftManualEnd = null;
    }
    if (origQtState != null) {
      // Byte-for-byte restore, not a fresh reset: qtEndEpoch/qtRemainMs are exactly what they
      // were the moment the tour started, so a real timer that was running keeps reflecting
      // genuine elapsed wall-clock time (as if the tour had never touched it) instead of losing
      // or gaining time relative to what the host actually experienced.
      qtState = origQtState;
      qtDurationSec = origQtDurationSec;
      qtEndEpoch = origQtEndEpoch;
      qtRemainMs = origQtRemainMs;
      qtSetDisplayText(
        fmtQt(
          qtState === "running"
            ? (qtEndEpoch - Date.now()) / 1000
            : qtState === "paused"
              ? qtRemainMs / 1000
              : qtDurationSec,
        ),
      );
      qtSetDisplayClass(null); // tickQTimer()'s own setInterval recomputes warn/crit/over next tick
      renderQtControls();
      origQtState = null;
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
    stepReady = false; // Next/Done stays hidden (or disabled) until fill() (if any) says ready
    const step = all[i];
    const markReady = () => {
      stepReady = true;
      renderCallout();
    };
    if (step.fill) step.fill(markReady);
    // 'confirm' steps show their Done button as soon as done() is already true — relevant on
    // arrival mainly when navigating Back to a field the host already filled in.
    else if (step.advance === "confirm")
      stepReady = !!(step.done && step.done());
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
      // Text fields are typo-prone, so 'confirm' steps never auto-advance — this only
      // reveals/enables the Done button as the field's content changes; the host still has to
      // tap it, same as any other step, giving them a chance to fix a typo before moving on.
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
    // fallbackNext: shows Next from the very start regardless of advance mode or stepReady —
    // for 'on-click' steps whose detection depends on a listener that isn't 100% guaranteed to
    // land (e.g. a step's target getting rebuilt by some unrelated render between fill() wiring
    // the listener and the host's tap, orphaning it) — see the PDF/JD Upload steps. The real
    // click, if it IS detected, still auto-advances as normal; this only guarantees the host is
    // never stuck if it isn't.
    const showNext =
      (step.advance !== "on-click" && stepReady) || step.fallbackNext;
    // alwaysShowDone renders the button from the very start of the step (disabled until
    // stepReady) instead of hiding it behind a hint — see the STEP TABLE note above.
    const showDisabledDone =
      !showNext && step.advance === "confirm" && step.alwaysShowDone;
    const showBack = stepIndex > 0;
    const nextLabel = step.last ? "Close Tutorial" : step.doneLabel || "Next →";
    dom.callout.innerHTML =
      `<div class="tutorial-callout-step">Step ${stepIndex + 1} of ${all.length}</div>` +
      `<div class="tutorial-callout-text">${esc(step.text)}</div>` +
      `<div class="tutorial-callout-row">` +
      `<div class="tutorial-callout-nav">` +
      (showBack
        ? `<button class="tutorial-callout-back" onclick="Tutorial.back()">← Back</button>`
        : "") +
      (showNext
        ? `<button class="tutorial-callout-next" onclick="Tutorial.next()">${nextLabel}</button>`
        : showDisabledDone
          ? `<button class="tutorial-callout-next" disabled>${nextLabel}</button>`
          : step.advance === "on-click"
            ? `<span class="tutorial-callout-hint">${tapWordCap()} the highlighted button to continue</span>`
            : step.advance === "confirm"
              ? `<span class="tutorial-callout-hint">${step.waitHint || "Type in the field and click Next when you're finished"}</span>`
              : `<span class="tutorial-callout-hint">One moment…</span>`) +
      `</div>` +
      // Nothing left to skip on the last step — Skip Tutorial there would just be a second,
      // confusing way to do the same thing Close Tutorial already does.
      (step.last
        ? ""
        : `<button class="tutorial-callout-skip" onclick="Tutorial.skip()">Skip Tutorial</button>`) +
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
  function stepTargetEnd(step) {
    if (!step.targetEnd) return null;
    return typeof step.targetEnd === "function"
      ? step.targetEnd()
      : step.targetEnd;
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
    const sel = stepTarget(step);
    const target = sel ? document.querySelector(sel) : null;
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
    // target: null is deliberate — a purely narrative step (the welcome step) with nothing to
    // spotlight. Distinct from "not rendered yet", which retries; a null target never will
    // resolve to an element, so retrying it would loop forever.
    const hasTarget = step.target !== null && step.target !== undefined;
    const sel = hasTarget ? stepTarget(step) : null;
    const el = sel ? document.querySelector(sel) : null;
    if (hasTarget && !el) {
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
    let r = el ? el.getBoundingClientRect() : null;
    // Some steps spotlight two adjacent elements as one box (e.g. a section header together
    // with one specific row below it) via targetEnd — union the two rects rather than the
    // whole section in between, which would sweep in every other team's row too.
    const endSel = el ? stepTargetEnd(step) : null;
    if (endSel) {
      const elEnd = document.querySelector(endSel);
      if (elEnd) {
        const r2 = elEnd.getBoundingClientRect();
        const top = Math.min(r.top, r2.top);
        const left = Math.min(r.left, r2.left);
        const right = Math.max(r.right, r2.right);
        const bottom = Math.max(r.bottom, r2.bottom);
        r = {
          top,
          left,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        };
      }
    }
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
    // the controls, even while the thing being described is still scrolled out of view. A
    // no-target step reuses this exact same "nothing to cut a hole around" path, landing the
    // callout dead center.
    const onScreen =
      !!r && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    if (onScreen) {
      dom.ring.style.display = "";
      dom.top.style.display =
        dom.bottom.style.display =
        dom.left.style.display =
        dom.right.style.display =
          "";
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
    // target's (possibly off-screen) rect the way the ring/bars are. calloutPosition:"above"
    // prefers the callout above the target — for steps that spotlight a header/button with
    // content the host actually needs to watch sitting right beneath it (e.g. the Sort demo),
    // where the callout landing below would cover exactly that.
    //
    // Measures the callout's REAL rendered height rather than guessing one: a fixed guess here
    // used to be shorter than the callout could actually get (longer step text, or the Back
    // button's row growing it), so "prefer above" could still compute a top that left the
    // callout's real bottom edge overlapping the ring — which is exactly what made the Sort
    // button unreachable. renderCallout() already ran before this (same afterRender() sequence
    // that calls reposition()), so the callout's content — and therefore its real height — is
    // already current.
    const calloutH = dom.callout.offsetHeight || 170;
    const gap = pad + 10;
    let top, left;
    // calloutClears: a selector for something the spotlighted control OPENS, which the callout
    // has to clear as well as the control itself — the Color Vision dropdown is the only one so
    // far. Placing against the button alone isn't enough: the whole point of that step is to look
    // at the open menu, and the menu is taller than the button and lands on whichever side has
    // room (toggleCvMenu flips it above when opening downward would overflow the viewport).
    // Unioning the two rects pushes the callout clear of whichever side the menu took, while
    // still leaving it directly against it. The ring and the dimming bars keep using the
    // control's own rect, so the spotlight itself doesn't grow.
    let cr = r;
    if (step.calloutClears) {
      const extra = document.querySelector(step.calloutClears);
      if (extra) {
        const e = extra.getBoundingClientRect();
        if (e.width && e.height)
          cr = {
            top: Math.min(r.top, e.top),
            bottom: Math.max(r.bottom, e.bottom),
            left: r.left,
          };
      }
    }
    if (onScreen) {
      const spaceBelow = vh - cr.bottom - gap;
      const spaceAbove = cr.top - gap;
      const preferAbove = step.calloutPosition === "above";
      if (preferAbove && spaceAbove >= calloutH) top = cr.top - gap - calloutH;
      else if (!preferAbove && spaceBelow >= calloutH) top = cr.bottom + gap;
      // Neither preferred side actually fits the real height — use whichever side has more
      // room instead of blindly clamping to the preferred one and risking an overlap anyway.
      else if (spaceBelow >= spaceAbove) top = cr.bottom + gap;
      else top = cr.top - gap - calloutH;
      left = cr.left;
    } else {
      top = vh / 2 - calloutH / 2;
      left = vw / 2 - 160;
    }
    dom.callout.style.bottom = "auto";
    dom.callout.style.top =
      Math.min(Math.max(10, top), vh - calloutH - 10) + "px";
    dom.callout.style.left = Math.min(Math.max(10, left), vw - 336) + "px";
  }

  window.addEventListener("resize", () => {
    if (!active) return;
    // Re-render the callout too, not just reposition it — crossing the mobile breakpoint
    // (e.g. rotating a tablet, or resizing a window mid-tour) should flip "tap"/"click" in the
    // step text immediately rather than waiting for the next step change to pick it up.
    renderCallout();
    reposition();
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
    // Same hand-wave pictograph as the Settings > Sample Data > Take the Tour button
    // (index.html) — this card used to draw the graduation cap that icon had before it changed.
    // Not wired into STATIC_ICON_TARGETS/Icon Style like that button is: this card is only ever
    // in the DOM briefly, for a first-time visitor, so it isn't worth the extra bookkeeping a
    // dynamically-inserted, one-time element would need to participate in that sweep.
    card.innerHTML =
      `<p><svg class="icon-ui icon-tinted icon-hand" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg> New here? Take the tour.</p>` +
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
