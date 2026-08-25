// Coverage for the v19.52 performance pass (js/storage.js autosave debounce, js/app.js
// renderLeft/renderSB no-op-write skip, js/question-timer.js display memoization + cached
// NodeLists) plus a handful of previously-untested behaviors surfaced while writing that pass:
// TRStore's error-swallowing, Quiz ID/missing-guess/Edit-Locked-Fields render states, and a
// migrateState() backfill not yet covered elsewhere. Same real-app-in-jsdom approach as
// tests/gameplay.test.js and tests/more-behavior.test.js.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

function evalJSON(window, expr) {
  return JSON.parse(evalIn(window, `JSON.stringify(${expr})`));
}

// ============================================================================
// autosave() / autosaveDebounced() / flushAutosave() — js/storage.js
// ============================================================================
describe("autosave(): stays synchronous, autosaveDebounced() coalesces bursts", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("a single autosave() call writes exactly once, synchronously — no timer needs to elapse", () => {
    evalIn(
      window,
      `const __orig = TRStore.setItem.bind(TRStore);
       TRStore.setItem = (...a) => { window.__writes++; return __orig(...a); };
       gameState = freshState(); addTeam();`, // addTeam() itself autosaves once — not what's under test
    );
    evalIn(window, "window.__writes = 0; autosave();"); // reset the counter, THEN measure just this call
    assert.equal(evalIn(window, "window.__writes"), 1);
    // Already landed — loadSaved() reflects it with no setTimeout/tick needed.
    assert.equal(evalJSON(window, "loadSaved()").teams.length, 1);
  });

  it("two autosave() calls back to back both write immediately (each is a discrete commit, not a keystroke burst)", () => {
    evalIn(window, "window.__writes = 0; gameState.teams[0].name = 'A';");
    evalIn(window, "autosave();");
    evalIn(window, "gameState.teams[0].name = 'AB'; autosave();");
    assert.equal(evalIn(window, "window.__writes"), 2);
    assert.equal(evalJSON(window, "loadSaved()").teams[0].name, "AB");
  });

  it("autosaveDebounced() does NOT write immediately, but flushAutosave() forces the pending write through right away", () => {
    evalIn(window, "window.__writes = 0; gameState.meta.staffNames = 'Alex';");
    evalIn(window, "autosaveDebounced();");
    assert.equal(
      evalIn(window, "window.__writes"),
      0,
      "a debounced call must not write synchronously",
    );
    evalIn(window, "flushAutosave();");
    assert.equal(evalIn(window, "window.__writes"), 1);
    assert.equal(evalJSON(window, "loadSaved()").meta.staffNames, "Alex");
  });

  it("repeated autosaveDebounced() calls (simulating a typing burst) collapse into a single deferred write reflecting the LAST value, not one write per call", () => {
    evalIn(window, "window.__writes = 0;");
    evalIn(window, `
      gameState.meta.staffNames = "A";  autosaveDebounced();
      gameState.meta.staffNames = "Al"; autosaveDebounced();
      gameState.meta.staffNames = "Ale"; autosaveDebounced();
      gameState.meta.staffNames = "Alex"; autosaveDebounced();
    `);
    assert.equal(evalIn(window, "window.__writes"), 0);
    evalIn(window, "flushAutosave();");
    assert.equal(
      evalIn(window, "window.__writes"),
      1,
      "four rapid calls must collapse into exactly one persisted write",
    );
    assert.equal(evalJSON(window, "loadSaved()").meta.staffNames, "Alex");
  });

  it("a synchronous autosave() call cancels a pending debounced write instead of it firing again later with stale intent", () => {
    evalIn(window, "window.__writes = 0;");
    evalIn(window, "gameState.meta.staffNames = 'Pending'; autosaveDebounced();");
    evalIn(window, "gameState.meta.staffNames = 'Committed'; autosave();");
    assert.equal(evalIn(window, "window.__writes"), 1);
    evalIn(window, "flushAutosave();"); // no-op: the debounce timer was already cleared
    assert.equal(evalIn(window, "window.__writes"), 1);
    assert.equal(evalJSON(window, "loadSaved()").meta.staffNames, "Committed");
  });
});

describe("TRStore swallows storage errors instead of throwing (private-browsing / quota-exceeded style failures)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    // Patch the shared Storage PROTOTYPE, not the localStorage instance itself — Storage
    // instances are legacy platform objects with their own named-property [[Set]]/[[Get]]
    // (that's what makes `localStorage.foo = 'x'` sugar for setItem('foo','x')), so assigning
    // `window.localStorage.setItem = ...` doesn't override the method at all; it silently
    // stores a "setItem" key instead. The prototype has no such trap, so patching it there is
    // what actually makes every call through TRStore's own backing.setItem/getItem throw.
    evalIn(
      window,
      `const __proto = Object.getPrototypeOf(window.localStorage);
       window.__origSetItem = __proto.setItem;
       window.__origGetItem = __proto.getItem;`,
    );
  });
  after(() => window.close());

  it("TRStore.setItem does not throw when the underlying localStorage.setItem throws", () => {
    evalIn(
      window,
      `Object.getPrototypeOf(window.localStorage).setItem = () => { throw new Error('boom'); };`,
    );
    assert.doesNotThrow(() => evalIn(window, "TRStore.setItem('k', '1')"));
  });

  it("autosave() itself does not throw either, with the same broken backing store", () => {
    assert.doesNotThrow(() => evalIn(window, "gameState = freshState(); autosave();"));
  });

  it("TRStore.getItem returns null (not a thrown error) when localStorage.getItem throws", () => {
    evalIn(
      window,
      `Object.getPrototypeOf(window.localStorage).setItem = window.__origSetItem;
       Object.getPrototypeOf(window.localStorage).getItem = () => { throw new Error('boom'); };`,
    );
    assert.equal(evalIn(window, "TRStore.getItem('some-key-that-was-never-set')"), null);
  });
});

// ============================================================================
// renderLeft() / renderSB(): skip the innerHTML write (and the reflow it costs) when a
// re-render produces markup identical to what's already on screen.
// ============================================================================
describe("renderLeft()/renderSB(): a no-op re-render doesn't replace the DOM subtree", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("renderLeft() called twice with no state change in between leaves the same DOM node in place (object identity, not just equal content)", () => {
    evalIn(window, "gameState = freshState(); addTeam(); renderAll();");
    const before_ = window.document.querySelector('[data-ti="0"] input[type="text"]');
    evalIn(window, "renderLeft();");
    const after_ = window.document.querySelector('[data-ti="0"] input[type="text"]');
    assert.equal(after_, before_);
  });

  it("...but a render that DOES change something still replaces the node, proving the skip isn't unconditional", () => {
    const before_ = window.document.querySelector('[data-ti="0"] input[type="text"]');
    evalIn(window, "gameState.teams[0].name = 'Changed'; renderLeft();");
    const after_ = window.document.querySelector('[data-ti="0"] input[type="text"]');
    assert.notEqual(after_, before_);
    assert.equal(after_.value, "Changed");
  });

  it("renderSB() called twice with no state change leaves .scores-list in place", () => {
    evalIn(window, "renderSB();");
    const before_ = window.document.getElementById("sidebarBody").querySelector(".scores-list");
    evalIn(window, "renderSB();");
    const after_ = window.document.getElementById("sidebarBody").querySelector(".scores-list");
    assert.equal(after_, before_);
  });
});

// ============================================================================
// Question timer display memoization (js/question-timer.js)
// ============================================================================
describe("qtSetDisplayText(): skips the DOM write when the formatted text hasn't changed", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("two calls with the same {text,neg} leave the display's child node in place", () => {
    evalIn(window, `qtSetDisplayText({ text: "2:30", neg: false });`);
    const before_ = window.document.querySelector(".qtimer-display .qt-sign");
    evalIn(window, `qtSetDisplayText({ text: "2:30", neg: false });`);
    const after_ = window.document.querySelector(".qtimer-display .qt-sign");
    assert.equal(after_, before_);
  });

  it("a call with different text DOES write, replacing the node — the skip isn't unconditional", () => {
    const before_ = window.document.querySelector(".qtimer-display .qt-sign");
    evalIn(window, `qtSetDisplayText({ text: "2:29", neg: false });`);
    const after_ = window.document.querySelector(".qtimer-display .qt-sign");
    assert.notEqual(after_, before_);
    assert.match(window.document.querySelector(".qtimer-display").textContent, /2:29/);
  });

  it("both the desktop and mobile .qtimer-display copies get updated together", () => {
    evalIn(window, `qtSetDisplayText({ text: "9:59", neg: false });`);
    const displays = [...window.document.querySelectorAll(".qtimer-display")];
    assert.equal(displays.length, 2);
    displays.forEach((d) => assert.match(d.textContent, /9:59/));
  });
});

describe("tickQTimer(): crosses into qt-over exactly at/after 0:00, and resetQTimer() cleans the state back up", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("a timer whose end epoch is already in the past ticks straight into qt-over", () => {
    evalIn(window, `resetQTimer(); qtState = "running"; qtEndEpoch = Date.now() - 5000;`);
    window.tickQTimer();
    const disp = window.document.querySelector(".qtimer-display");
    assert.equal(disp.classList.contains("qt-over"), true);
    assert.equal(disp.classList.contains("qt-crit"), false);
  });

  it("30s or less remaining is qt-crit, not yet qt-over", () => {
    evalIn(window, `resetQTimer(); qtState = "running"; qtEndEpoch = Date.now() + 15000;`);
    window.tickQTimer();
    const disp = window.document.querySelector(".qtimer-display");
    assert.equal(disp.classList.contains("qt-crit"), true);
    assert.equal(disp.classList.contains("qt-over"), false);
  });

  it("resetQTimer() returns to idle with no warn/crit/over class left over", () => {
    evalIn(window, `qtState = "running"; qtEndEpoch = Date.now() - 5000;`);
    window.tickQTimer();
    window.resetQTimer();
    assert.equal(evalIn(window, "qtState"), "idle");
    const disp = window.document.querySelector(".qtimer-display");
    assert.equal(disp.classList.contains("qt-over"), false);
    assert.equal(disp.classList.contains("qt-crit"), false);
    assert.equal(disp.classList.contains("qt-warn"), false);
  });

  it("tickQTimer() is a no-op while idle — it must not throw or touch display classes", () => {
    evalIn(window, `resetQTimer();`);
    const before_ = window.document.querySelector(".qtimer-display").className;
    assert.doesNotThrow(() => window.tickQTimer());
    assert.equal(window.document.querySelector(".qtimer-display").className, before_);
  });
});

// ============================================================================
// Quiz ID field render states, missing-guess badge, and Edit Locked Fields — js/app.js
// renderLeft()
// ============================================================================
describe("Quiz ID field: invalid/warn/good render states track isQuizIdValid + game-started", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  function quizIdField(window) {
    return window.document.querySelector(".quiz-id-input").closest(".field");
  }

  it("empty Quiz ID before scoring starts renders field-invalid", () => {
    evalIn(window, "gameState = freshState(); renderAll();");
    assert.equal(quizIdField(window).classList.contains("field-invalid"), true);
  });

  it("a malformed Quiz ID renders field-warn, not field-invalid or field-good", () => {
    evalIn(window, "gameState.meta.quizId = 'not-a-valid-id'; renderLeft();");
    const f = quizIdField(window);
    assert.equal(f.classList.contains("field-warn"), true);
    assert.equal(f.classList.contains("field-invalid"), false);
    assert.equal(f.classList.contains("field-good"), false);
  });

  it("a well-formed Quiz ID (e.g. AB-123) renders field-good", () => {
    evalIn(window, "gameState.meta.quizId = 'AB-123'; renderLeft();");
    const f = quizIdField(window);
    assert.equal(f.classList.contains("field-good"), true);
    assert.equal(f.classList.contains("field-warn"), false);
  });

  it("once gameStarted is true, a blank Quiz ID no longer renders field-invalid (scoring already began)", () => {
    evalIn(window, "gameState.meta.quizId = ''; gameState.gameStarted = true; renderLeft();");
    assert.equal(quizIdField(window).classList.contains("field-invalid"), false);
  });
});

describe("Teams section header: missing-guess count and its singular/plural wording", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  function teamsHeading(window) {
    return window.document.querySelector("#sec-teams h2").innerHTML;
  }

  it("two teams with no scoreGuess entered shows '2 missing guesses' (plural)", () => {
    evalIn(window, "gameState = freshState(); addTeam(); addTeam(); renderAll();");
    assert.match(teamsHeading(window), /2 missing guesses/);
  });

  it("filling in one team's guess drops the count to '1 missing guess' (singular, no trailing s)", () => {
    evalIn(window, "gameState.teams[0].scoreGuess = 42; renderLeft();");
    const h = teamsHeading(window);
    assert.match(h, /1 missing guess(?!es)/);
  });

  it("filling in the last team's guess removes the badge entirely", () => {
    evalIn(window, "gameState.teams[1].scoreGuess = 10; renderLeft();");
    assert.doesNotMatch(teamsHeading(window), /missing guess/);
  });
});

describe("Edit Locked Fields: metaLocked disables Event Details once scoring starts, and the toggle reopens them", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("Event Details inputs are enabled before scoring starts", () => {
    evalIn(window, "gameState = freshState(); addTeam(); gameState.gameStarted = false; renderAll();");
    const dateInput = window.document.querySelector('input[type="date"].date-native');
    assert.equal(dateInput.disabled, false);
  });

  it("Event Details inputs become disabled once gameStarted is true", () => {
    evalIn(window, "gameState.gameStarted = true; renderLeft();");
    const dateInput = window.document.querySelector('input[type="date"].date-native');
    assert.equal(dateInput.disabled, true);
  });

  it("toggleUnlockEventDetails() re-enables them without needing another render call", () => {
    window.toggleUnlockEventDetails();
    const dateInput = window.document.querySelector('input[type="date"].date-native');
    assert.equal(dateInput.disabled, false);
  });

  it("toggling it again re-locks them", () => {
    window.toggleUnlockEventDetails();
    const dateInput = window.document.querySelector('input[type="date"].date-native');
    assert.equal(dateInput.disabled, true);
  });
});

// ============================================================================
// migrateState(): a backfill not covered by tests/gameplay.test.js's own migrateState describe
// block — excludeTopN defaulting from the older giftCardCount field it replaced.
// ============================================================================
describe("migrateState: backfills meta.excludeTopN from the legacy giftCardCount field", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("an old save with giftCardCount but no excludeTopN carries the old value forward", () => {
    const result = evalJSON(
      window,
      `migrateState({ meta: { giftCardCount: 3 }, teams: [] })`,
    );
    assert.equal(result.meta.excludeTopN, 3);
  });

  it("a save with neither field defaults to 2, matching freshState()'s own default", () => {
    const result = evalJSON(window, `migrateState({ meta: {}, teams: [] })`);
    assert.equal(result.meta.excludeTopN, evalIn(window, "freshState().meta.excludeTopN"));
  });

  it("a save that already has excludeTopN keeps it as-is rather than overwriting from giftCardCount", () => {
    const result = evalJSON(
      window,
      `migrateState({ meta: { excludeTopN: 1, giftCardCount: 5 }, teams: [] })`,
    );
    assert.equal(result.meta.excludeTopN, 1);
  });
});
