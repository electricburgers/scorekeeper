"use strict";
const STORAGE_KEY = "trivRev6_session",
  PREFS_KEY = "trivRev6_prefs",
  MAX_TEAMS = 100;
/* Storage shim. Chromium throws "SecurityError: localStorage is not available for opaque
   origins" when the page is opened straight off disk (file:// is an opaque origin). Firefox
   permits it, which is why this app persists in Firefox but not in Chrome from file://.
   Serving over http://localhost (e.g. `python3 -m http.server`) gives a real origin and makes
   native storage work everywhere. When native storage is unavailable we fall back to an
   in-memory store so the app still runs for the current session (it just can't resume after a
   reload). TRStore.persistent reports whether real cross-session persistence is available. */
const TRStore = (function () {
  let backing = null,
    persistent = false;
  try {
    const k = "__trs_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    backing = window.localStorage;
    persistent = true;
  } catch (e) {
    const mem = Object.create(null);
    backing = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => {
        mem[k] = String(v);
      },
      removeItem: (k) => {
        delete mem[k];
      },
    };
    persistent = false;
  }
  return {
    get persistent() {
      return persistent;
    },
    getItem: (k) => {
      try {
        return backing.getItem(k);
      } catch (e) {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        backing.setItem(k, v);
      } catch (e) {}
    },
    removeItem: (k) => {
      try {
        backing.removeItem(k);
      } catch (e) {}
    },
  };
})();

function persistGameStateNow() {
  TRStore.setItem(STORAGE_KEY, JSON.stringify(gameState));
}
// autosave() itself stays synchronous — nearly every caller is an onchange/onclick handler
// (one discrete user action = one commit), and callers throughout the app (loadFromFile,
// loadSampleGame, the test suite, etc.) rely on the write having already landed by the time
// autosave() returns. Delaying those would trade a real durability guarantee (the save surviving
// an immediate refresh/close) for a save that's rarely called often enough to need debouncing.
function autosave() {
  // A pending debounced write (see autosaveDebounced() below) is now stale — this synchronous
  // call is about to persist current gameState anyway, so drop the timer instead of letting it
  // fire again later and do the identical write a second time.
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = null;
  }
  persistGameStateNow();
}
// The one real exception is Staff Names (js/content.js setStaffNames), wired to oninput rather
// than onchange so both copies of the field stay in sync as the host types — that means one
// synchronous localStorage write (a blocking main-thread call) per keystroke instead of per
// field edit. autosaveDebounced() coalesces a typing burst into a single write after
// AUTOSAVE_DEBOUNCE_MS of no further input, with flushAutosave() (below) guaranteeing that
// write still happens if the page is hidden/closed mid-burst rather than being silently lost.
const AUTOSAVE_DEBOUNCE_MS = 400;
let autosaveDebounceTimer = null;
function autosaveDebounced() {
  if (autosaveDebounceTimer) clearTimeout(autosaveDebounceTimer);
  autosaveDebounceTimer = setTimeout(() => {
    autosaveDebounceTimer = null;
    persistGameStateNow();
  }, AUTOSAVE_DEBOUNCE_MS);
}
function flushAutosave() {
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = null;
    persistGameStateNow();
  }
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAutosave();
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAutosave);
}
function loadSaved() {
  try {
    const r = TRStore.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return null;
}
function clearSaved() {
  TRStore.removeItem(STORAGE_KEY);
}

function saveToFile() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(gameState, null, 2)], {
      type: "application/json",
    }),
  );
  a.download = exportFn("json").replace(".json", "-save.json");
  a.click();
}
async function triggerLoadFile() {
  const msg = gameState.teams.length
    ? "Replace current session? This wipes every team, score, and Event Details field currently entered — it can’t be undone."
    : "Replace current session?";
  // The file input's own .click() below needs to run off a real user gesture or the browser
  // silently refuses to open the picker — the OK button's own click, which is what resolves
  // this await, still counts (a browser's "transient activation" survives a promise resolving
  // synchronously off a real click, same as it would survive any other microtask hop), so this
  // works the same as it did calling window.confirm() synchronously.
  if (await appConfirm(msg, { okLabel: "Replace" }))
    document.getElementById("fileLoadInput").click();
}
function loadFromFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function (ev) {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch (err) {
      appAlert(
        "Bad JSON \u2014 this file isn\u2019t a valid save: " + err.message,
      );
      return;
    }
    try {
      gameState = migrateState(data);
      autosave();
      renderAll();
      document.getElementById("resumeBanner")?.classList.remove("show");
      closeSettingsPanel();
    } catch (err) {
      appAlert("Couldn\u2019t load this save: " + err.message);
      console.error("loadFromFile render error:", err);
    }
  };
  r.readAsText(f);
  e.target.value = "";
}
// Settings > Team Names > Import: reads a saved game (.json from Save) and keeps ONLY its team
// names - for a venue where the same teams show up every week. Scores, wagers and guesses are not
// imported, Event Details and the game mode stay as they are, and the current roster is replaced.
async function triggerImportTeamNames() {
  const msg = hasBoardData()
    ? "Replace the current teams with the names from a saved game? This erases every score, wager, guess and bonus entered so far - it can\u2019t be undone."
    : "Replace the current teams with the names from a saved game?";
  if (!gameState.teams.length || (await appConfirm(msg, { okLabel: "Import", danger: hasBoardData() })))
    document.getElementById("teamNamesLoadInput").click();
}
function importTeamNamesFromFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function (ev) {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch (err) {
      appAlert("Bad JSON \u2014 this file isn\u2019t a valid save: " + err.message);
      return;
    }
    const seen = new Set();
    const names = (Array.isArray(data && data.teams) ? data.teams : [])
      .map((t) => String((t && t.name) || "").trim())
      .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
      .slice(0, MAX_TEAMS);
    if (!names.length) {
      appAlert("No team names found in this file.");
      return;
    }
    const next = freshState();
    next.meta = { ...gameState.meta };
    next.teams = names.map((n) => freshTeam(n));
    gameState = next;
    resetBoardUi();
    autosave();
    renderAll();
    closeSettingsPanel();
    announce(names.length + " team names imported");
  };
  r.readAsText(f);
  e.target.value = "";
}
// App Preferences save/load — a separate file format from the Session Data save/load above:
// this one carries only the Settings-panel prefs blob (theme, size, timer duration, etc.), not
// team/score data, so a host can carry their preferred setup between events without dragging an
// old game's teams and scores along with it.
function savePrefsToFile() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(loadPrefs(), null, 2)], {
      type: "application/json",
    }),
  );
  // Prefs aren't tied to any one game (that's what saveToFile/exportFn's Location-based name is
  // for) — Host Name is the one Event Details field that identifies a PERSON rather than a game,
  // which is what makes it useful here: a host who saves their own preferences file once and
  // reuses it across events gets a filename naming them, not whatever game happened to be open
  // when they saved it. Falls back to the plain name whenever it's blank, same as exportFn falls
  // back to "Trivia" for an empty Location.
  const host = sanitizeFile(gameState.meta.hostName);
  a.download = (host ? host + " - " : "") + "Scorekeeper Preferences.json";
  a.click();
}
async function triggerLoadPrefsFile() {
  if (
    await appConfirm("Replace current app preferences?", {
      okLabel: "Replace",
    })
  )
    document.getElementById("prefsLoadInput").click();
}
function loadPrefsFromFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function (ev) {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch (err) {
      appAlert(
        "Bad JSON — this file isn’t a valid preferences file: " + err.message,
      );
      return;
    }
    try {
      savePrefs(data);
      applyPrefs();
      setQtDurationSec(loadPrefs().qtDurationSec);
    } catch (err) {
      appAlert("Couldn’t load these preferences: " + err.message);
      console.error("loadPrefsFromFile error:", err);
    }
  };
  r.readAsText(f);
  e.target.value = "";
}
// The same finished game, as a Theme Night: identical teams, guesses and Q1-4 results for
// Rounds 1-3, Simpsons as the theme. Round 1's Q5 wager is derived from that round's bonus score
// (the sample has no Round 1 wager of its own); Round 2/3 reuse the halftime/final wagers, whose
// sizes already fit the 10 / 20 caps. Round 4 and the 4-part bonuses don't exist in this mode.
// Shrinks every sample guess proportionally so the highest equals `limit` (leaves them alone when
// they already fit), keeping each team's spread instead of piling several onto the cap.
function scaleSampleGuesses(s, limit) {
  const topGuess = Math.max(...s.teams.map((t) => +t.scoreGuess || 0), 0);
  if (topGuess <= limit) return;
  s.teams.forEach((t) => {
    if (t.scoreGuess !== "" && t.scoreGuess != null)
      t.scoreGuess = Math.max(1, Math.round((+t.scoreGuess * limit) / topGuess));
  });
}
function toThemeSample(s) {
  s.meta.mode = "theme";
  s.meta.themeName = "The Simpsons";
  s.wager1 = {};
  // The Regular example's guesses run higher than Theme Night's 95-point ceiling, so scale them
  // all down together (highest guess becomes 95) rather than piling several teams onto 95.
  scaleSampleGuesses(s, 95);
  s.teams.forEach((_, ti) => {
    const b = s.rounds[0].bonus[ti] || 0;
    s.wager1[ti] = { wager: Math.min(5, b + 1), correct: b >= 2 };
  });
  // The Regular example was played on Regular's point budgets; re-key each answer to the same
  // position in Theme Night's set (Round 2: 1-3-5-7 -> 2-4-6-8, Round 3: 2-4-6-8 -> 3-6-9-12) so
  // the sheet matches this mode's rules and every team keeps its right/wrong pattern.
  [1, 2].forEach((ri) =>
    s.rounds[ri].questions.forEach((q) =>
      Object.values(q).forEach((a) => {
        const i = ROUND_WAGERS[ri].indexOf(a.wager);
        if (i >= 0) a.wager = THEME_ROUND_WAGERS[ri][i];
      }),
    ),
  );
  s.rounds[0].bonus = {};
  s.rounds[2].bonus = {};
  s.rounds[3] = { questions: [{}, {}, {}, {}], bonus: {} };
  return s;
}
// The same finished game as a Name That Tune night: identical teams, guesses (scaled to 126) and
// Q1-4 results in all four rounds - Regular's point budgets are this mode's too. The halftime /
// final wagers already fit the Round 2 / Round 4 caps (10 / 20); Round 1's Q5 wager comes from
// that round's bonus score, and Round 3 (cap 15) gets a varied wager since the sample has none.
// The 4-part bonuses don't exist in this mode.
function toTuneSample(s) {
  s.meta.mode = "tune";
  s.meta.themeName = "";
  scaleSampleGuesses(s, 126);
  s.wager1 = {};
  s.wager3 = {};
  s.teams.forEach((_, ti) => {
    const b = s.rounds[0].bonus[ti] || 0;
    s.wager1[ti] = { wager: Math.min(5, b + 1), correct: b >= 2 };
    s.wager3[ti] = { wager: 1 + ((ti * 7 + 4) % 15), correct: ti % 4 !== 1 };
  });
  s.rounds[0].bonus = {};
  s.rounds[2].bonus = {};
  return s;
}
async function loadSampleGame() {
  const modeName = gameModeName();
  const msg = gameState.teams.length
    ? "Load the sample game for " + modeName + "? This wipes every team, score, and Event Details field currently entered \u2014 it can\u2019t be undone."
    : "Load the sample game for " + modeName + "? This replaces your current session.";
  if (!(await appConfirm(msg, { okLabel: "Load" }))) return;
  const mode = gameMode();
  gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
  if (mode === "theme") toThemeSample(gameState);
  else if (mode === "tune") toTuneSample(gameState);
  autosave();
  renderAll();
  document.getElementById("resumeBanner")?.classList.remove("show");
  closeSettingsPanel();
}