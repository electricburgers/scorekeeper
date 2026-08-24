

// Round 1 and Round 3's bonus question keep the colour each round is already tagged with
// elsewhere (rl-1 cyan, rl-3 gold) so the Q5 label is consistent with the rest of that round.
// No icon any more: all four Q5 blocks carried a pictograph (four squares, a poker chip, a
// horseshoe, a stack of chips) and they are gone at the host's request. They were decoration
// beside a label that already said what the block was — "BONUS (0-4 x 5)", "BONUS WAGER (1-20)"
// — and four different marks across four Q5s implied a distinction between them that does not
// exist. The colour classes stay; only the pictographs go.
// Declared up here, not next to renderBQ where it's used, because the very first render on a
// brand-new session — no saved game to resume — runs synchronously at script-parse time, before a
// `const` declared further down the file would be out of its temporal dead zone.
const BONUS_Q_STYLE = {
  0: { cls: "bq-r1" },
  2: { cls: "bq-r3" },
};
// Character limits for every field a host types free text into. Declared once and used twice:
// as the inputs' own maxlength, and again in migrateState to clamp values arriving from a saved
// file. The numbers are sized to what each field is for rather than to a round number — a quiz ID
// is a code, a team name has to fit the scoresheet's 220pt column, the staff list is a handful of
// first names, and the winner script is a paragraph read aloud.
const FIELD_MAX = {
  quizId: 24,
  hostName: 40,
  location: 60,
  craftPartner: 50,
  craftPartnerTown: 40,
  bonusItem: 60,
  staffNames: 200,
  teamName: 40,
  craftScript: 600,
};
const APP_VERSION = "v19.50"; // #Version Number — bump this manually when you release a new build
const APP_VERSION_DATE = "Aug 24, 2026"; // #Version Date — bump alongside APP_VERSION so folks can spot a stale build
// version.json (repo root) mirrors these two — see checkForUpdate() below for why, and bump it
// in the same commit as these two or the update-available check starts lying: it'd either miss
// a real new release (version.json still saying the old version) or nag a host running the
// build that just shipped it (version.json bumped ahead of what's actually deployed and
// cached). tests/js-behavior.test.js has a test that fails the build if the two ever disagree.
// Set once a real newer build is confirmed available (checkForUpdate(), far below, next to the
// service worker registration it sits beside conceptually) — declared all the way up here, not
// down there, because applyPrefs() (also below) reads it and applyPrefs() runs synchronously at
// script-parse time before that point in the file is ever reached; a `let` declared at its own
// point of use would still be in its temporal dead zone on that first call. Same reasoning as
// BONUS_Q_STYLE elsewhere in this file, which has the fuller explanation.
let latestVersion = null;

const SAMPLE_GAME_JSON = `{"meta":{"date":"2024-02-29","location":"The Fawkes & Firkin","quizId":"XYZ-000","hostName":"Guy Fawkes","craftPartner":"Trivia Rev Brew Co","craftPartnerTown":"Toon Town","bonusItem":"Guy Fawkes Mask","staffNames":"Josie, Valerie, Fred, Daphne, Velma"},"teams":[{"name":"Parliamentary Procedure","scoreGuess":131,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Lanterns & Lore","scoreGuess":110,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"The Fifth of November","scoreGuess":86,"bonusItem":true,"njcb":false,"adjustment":0},{"name":"Quizzy McQuizface","scoreGuess":120,"bonusItem":false,"njcb":true,"adjustment":0},{"name":"Sherlock Homies","scoreGuess":113,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Mastermind Alliance","scoreGuess":130,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"The Usual Suspecters","scoreGuess":66,"bonusItem":false,"njcb":true,"adjustment":0},{"name":"Trivia Newton John","scoreGuess":124,"bonusItem":true,"njcb":false,"adjustment":0},{"name":"Two Heads, One Trophy","scoreGuess":99,"bonusItem":false,"njcb":false,"adjustment":0},{"name":"Powder Keg of Knowledge","scoreGuess":127,"bonusItem":true,"njcb":true,"adjustment":0},{"name":"Remember Remember","scoreGuess":76,"bonusItem":false,"njcb":false,"adjustment":0}],"rounds":[{"questions":[{"0":{"wager":4,"correct":true},"1":{"wager":3,"correct":true},"2":{"wager":3,"correct":true},"3":{"wager":4,"correct":true},"4":{"wager":2,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":3,"correct":true},"7":{"wager":3,"correct":true},"8":{"wager":3,"correct":false},"9":{"wager":4,"correct":true},"10":{"wager":4,"correct":true}},{"0":{"wager":1,"correct":true},"1":{"wager":1,"correct":false},"2":{"wager":1,"correct":true},"3":{"wager":1,"correct":false},"4":{"wager":3,"correct":true},"5":{"wager":2,"correct":true},"6":{"wager":1,"correct":false},"7":{"wager":1,"correct":false},"8":{"wager":1,"correct":false},"9":{"wager":3,"correct":true},"10":{"wager":1,"correct":false}},{"0":{"wager":2,"correct":true},"1":{"wager":2,"correct":true},"2":{"wager":4,"correct":true},"3":{"wager":2,"correct":false},"4":{"wager":4,"correct":true},"5":{"wager":4,"correct":true},"6":{"wager":2,"correct":false},"7":{"wager":4,"correct":true},"8":{"wager":4,"correct":true},"9":{"wager":2,"correct":true},"10":{"wager":2,"correct":true}},{"0":{"wager":3,"correct":true},"1":{"wager":4,"correct":true},"2":{"wager":2,"correct":true},"3":{"wager":3,"correct":true},"4":{"wager":1,"correct":false},"5":{"wager":1,"correct":true},"6":{"wager":4,"correct":true},"7":{"wager":2,"correct":true},"8":{"wager":2,"correct":true},"9":{"wager":1,"correct":true},"10":{"wager":3,"correct":true}}],"bonus":{"0":4,"1":3,"2":4,"3":2,"4":0,"5":0,"6":2,"7":3,"8":0,"9":2,"10":2}},{"questions":[{"0":{"wager":7,"correct":true},"1":{"wager":7,"correct":true},"2":{"wager":5,"correct":true},"3":{"wager":7,"correct":true},"4":{"wager":3,"correct":true},"5":{"wager":5,"correct":true},"6":{"wager":7,"correct":true},"7":{"wager":7,"correct":true},"8":{"wager":7,"correct":true},"9":{"wager":3,"correct":true},"10":{"wager":5,"correct":true}},{"0":{"wager":5,"correct":false},"1":{"wager":3,"correct":false},"2":{"wager":7,"correct":true},"3":{"wager":1,"correct":false},"4":{"wager":7,"correct":true},"5":{"wager":7,"correct":true},"6":{"wager":3,"correct":false},"7":{"wager":3,"correct":false},"8":{"wager":1,"correct":false},"9":{"wager":5,"correct":false},"10":{"wager":3,"correct":true}},{"0":{"wager":3,"correct":false},"1":{"wager":1,"correct":false},"2":{"wager":1,"correct":false},"3":{"wager":3,"correct":false},"4":{"wager":1,"correct":false},"5":{"wager":1,"correct":false},"6":{"wager":5,"correct":false},"7":{"wager":1,"correct":false},"8":{"wager":5,"correct":false},"9":{"wager":1,"correct":false},"10":{"wager":1,"correct":false}},{"0":{"wager":1,"correct":false},"1":{"wager":5,"correct":true},"2":{"wager":3,"correct":true},"3":{"wager":5,"correct":true},"4":{"wager":5,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":1,"correct":false},"7":{"wager":5,"correct":true},"8":{"wager":3,"correct":false},"9":{"wager":7,"correct":true},"10":{"wager":7,"correct":true}}],"bonus":{}},{"questions":[{"0":{"wager":4,"correct":true},"1":{"wager":6,"correct":true},"2":{"wager":2,"correct":true},"3":{"wager":4,"correct":true},"4":{"wager":6,"correct":true},"5":{"wager":8,"correct":true},"6":{"wager":4,"correct":false},"7":{"wager":8,"correct":true},"8":{"wager":6,"correct":true},"9":{"wager":6,"correct":true},"10":{"wager":8,"correct":true}},{"0":{"wager":2,"correct":false},"1":{"wager":8,"correct":true},"2":{"wager":6,"correct":true},"3":{"wager":2,"correct":true},"4":{"wager":2,"correct":false},"5":{"wager":6,"correct":true},"6":{"wager":8,"correct":true},"7":{"wager":6,"correct":true},"8":{"wager":4,"correct":true},"9":{"wager":4,"correct":false},"10":{"wager":4,"correct":true}},{"0":{"wager":6,"correct":true},"1":{"wager":4,"correct":false},"2":{"wager":4,"correct":true},"3":{"wager":6,"correct":true},"4":{"wager":4,"correct":false},"5":{"wager":2,"correct":true},"6":{"wager":6,"correct":true},"7":{"wager":2,"correct":true},"8":{"wager":8,"correct":true},"9":{"wager":2,"correct":false},"10":{"wager":2,"correct":true}},{"0":{"wager":8,"correct":true},"1":{"wager":2,"correct":false},"2":{"wager":8,"correct":true},"3":{"wager":8,"correct":true},"4":{"wager":8,"correct":true},"5":{"wager":4,"correct":true},"6":{"wager":2,"correct":true},"7":{"wager":4,"correct":true},"8":{"wager":2,"correct":false},"9":{"wager":8,"correct":true},"10":{"wager":6,"correct":false}}],"bonus":{"0":4,"1":4,"2":4,"3":4,"4":4,"5":4,"6":4,"7":4,"8":4,"9":4,"10":4}},{"questions":[{"0":{"wager":12,"correct":true},"1":{"wager":12,"correct":true},"2":{"wager":12,"correct":true},"3":{"wager":6,"correct":true},"4":{"wager":9,"correct":true},"5":{"wager":9,"correct":true},"6":{"wager":12,"correct":true},"7":{"wager":12,"correct":true},"8":{"wager":6,"correct":false},"9":{"wager":9,"correct":true},"10":{"wager":12,"correct":true}},{"0":{"wager":6,"correct":true},"1":{"wager":6,"correct":false},"2":{"wager":6,"correct":true},"3":{"wager":12,"correct":true},"4":{"wager":12,"correct":true},"5":{"wager":3,"correct":true},"6":{"wager":6,"correct":true},"7":{"wager":3,"correct":false},"8":{"wager":9,"correct":true},"9":{"wager":12,"correct":true},"10":{"wager":6,"correct":false}},{"0":{"wager":3,"correct":true},"1":{"wager":9,"correct":false},"2":{"wager":9,"correct":true},"3":{"wager":3,"correct":false},"4":{"wager":3,"correct":false},"5":{"wager":12,"correct":true},"6":{"wager":9,"correct":true},"7":{"wager":9,"correct":true},"8":{"wager":12,"correct":true},"9":{"wager":3,"correct":false},"10":{"wager":9,"correct":true}},{"0":{"wager":9,"correct":true},"1":{"wager":3,"correct":false},"2":{"wager":3,"correct":false},"3":{"wager":9,"correct":true},"4":{"wager":6,"correct":false},"5":{"wager":6,"correct":true},"6":{"wager":3,"correct":true},"7":{"wager":6,"correct":false},"8":{"wager":3,"correct":false},"9":{"wager":6,"correct":true},"10":{"wager":3,"correct":false}}],"bonus":{}}],"halftime":{"0":{"wager":10,"correct":true},"1":{"wager":9,"correct":true},"2":{"wager":8,"correct":false},"3":{"wager":4,"correct":true},"4":{"wager":7,"correct":true},"5":{"wager":10,"correct":true},"6":{"wager":5,"correct":false},"7":{"wager":10,"correct":true},"8":{"wager":3,"correct":true},"9":{"wager":8,"correct":true},"10":{"wager":2,"correct":false}},"finalWager":{"0":{"wager":20,"correct":true},"1":{"wager":12,"correct":true},"2":{"wager":18,"correct":false},"3":{"wager":8,"correct":true},"4":{"wager":15,"correct":true},"5":{"wager":20,"correct":true},"6":{"wager":10,"correct":false},"7":{"wager":14,"correct":true},"8":{"wager":6,"correct":false},"9":{"wager":17,"correct":true},"10":{"wager":5,"correct":false}},"gameStarted":true}`;
// Both this array and DEFAULT_SI are shared with the FAQ (js/shared-ui.js's SHARED_FONT_SIZES/
// SHARED_DEFAULT_SIZE_INDEX) — same sizes, same default, so kept in one place instead of two
// copies of the same 14 numbers.
const FONT_SIZES = SHARED_FONT_SIZES,
  DEFAULT_SI = SHARED_DEFAULT_SIZE_INDEX;
const DENSITIES = ["normal", "compact", "relaxed"],
  DENSITY_LABELS = { normal: "Normal", compact: "Compact", relaxed: "Relaxed" };
const STRIPE_LEVELS = [0, 1, 2],
  STRIPE_LABELS = { 0: "Subtle", 1: "Medium", 2: "High" };

// collapsed question state: Set of "ri-qi" keys
let collapsedQuestions = new Set();
let collapsedBonusQuestions = new Set();
let collapsedSpecialWagers = new Set();
let questionSortOrder = {};

function loadPrefs() {
  try {
    const r = TRStore.getItem(PREFS_KEY);
    if (r) {
      const p = JSON.parse(r);
      // "hc-dark"/"hc-light" ("hc" for high contrast, from back when that was a separate,
      // optional theme rather than the only one) were the stored values every real returning
      // visitor's browser has under this key as of the rename that dropped the prefix — without
      // them listed here too, a real saved "hc-light" preference would fail the now-current
      // ["dark","light"] check above and fall through to the wrong branch below (anything not
      // recognized as light-ish defaults dark), flipping actual visitors from Light to Dark the
      // first time they load the renamed build. "light"/"bw" predate that and are kept for the
      // same reason, one rename further back.
      if (!["dark", "light"].includes(p.theme))
        p.theme = ["light", "bw", "hc-light"].includes(p.theme)
          ? "light"
          : "dark";
      if (p.sizeIndex == null) p.sizeIndex = DEFAULT_SI;
      if (!p.density) p.density = "normal";
      if (p.settingsOpen == null) p.settingsOpen = false;
      if (p.stripeLevel == null) p.stripeLevel = 0;
      if (p.cbMode == null) p.cbMode = p.colorblind ? 1 : 0;
      if (!p.craftDrawSeconds) p.craftDrawSeconds = 6;
      if (p.showAdjustments == null) p.showAdjustments = false;
      if (p.advancedOpen == null) p.advancedOpen = false;
      if (p.unlockEventDetails == null) p.unlockEventDetails = false;
      // qtDurationSec replaces the old whole-minutes-only qtDurationMin now that the base
      // duration is set from a 30-second-increment dropdown in Settings — migrate an existing
      // saved qtDurationMin rather than resetting it.
      if (!p.qtDurationSec)
        p.qtDurationSec = p.qtDurationMin ? p.qtDurationMin * 60 : 180;
      if (p.showTimer == null) p.showTimer = true;
      if (p.showTimerSteppers == null) p.showTimerSteppers = false;
      if (p.timerPulse == null) p.timerPulse = true;
      if (p.craftManualEnd == null) p.craftManualEnd = false;
      if (p.craftFadeSec == null) p.craftFadeSec = CRAFT_FADE_DEFAULT;
      if (p.craftSoundTest == null) p.craftSoundTest = false;
      if (p.qResultToggle == null) p.qResultToggle = false;
      return p;
    }
  } catch (e) {}
  return {
    theme: "dark",
    sizeIndex: DEFAULT_SI,
    density: "normal",
    settingsOpen: false,
    stripeLevel: 0,
    cbMode: 0,
    craftDrawSeconds: 6,
    showAdjustments: false,
    advancedOpen: false,
    unlockEventDetails: false,
    qtDurationSec: 180,
    showTimer: true,
    showTimerSteppers: false,
    timerPulse: true,
    craftManualEnd: false,
    craftFadeSec: CRAFT_FADE_DEFAULT,
    craftSoundTest: false,
    qResultToggle: false,
  };
}
function savePrefs(p) {
  TRStore.setItem(PREFS_KEY, JSON.stringify(p));
}
function applyPrefs() {
  const p = loadPrefs();
  // data-theme set BEFORE applyIconStyle below: ICON_DONE's own emoji picks between ✔️/☑️ by
  // reading data-theme off the DOM (see applyIconStyle), so the new theme has to already be
  // live on <html> the moment that read happens — otherwise a theme change made in the same tick
  // this runs (setTheme calls applyPrefs synchronously) would apply icons for the THEME BEING
  // LEFT rather than the one being switched to.
  document.documentElement.setAttribute("data-theme", p.theme);
  // Before the theme toggle's innerHTML write below reads THEME_ICON_SUN/MOON (and every other
  // ICON_* use further down this function and in renderAll()), so a saved "emoji" preference is
  // already in effect for the very first paint instead of flashing the pictograph first.
  applyIconStyle(p.iconStyle === "emoji" ? "emoji" : "pictograph");
  const dn = p.density || "normal";
  if (dn === "normal") document.documentElement.removeAttribute("data-density");
  else document.documentElement.setAttribute("data-density", dn);
  const tb = document.getElementById("themeToggle");
  if (tb)
    tb.innerHTML =
      p.theme === "light"
        ? THEME_ICON_SUN + " Light"
        : THEME_ICON_MOON + " Dark";
  const cbm = p.cbMode || 0;
  if (cbm) document.documentElement.setAttribute("data-cb", String(cbm));
  else document.documentElement.removeAttribute("data-cb");
  setCvSelectDisplay(String(cbm));
  const si = Math.max(
    0,
    Math.min(FONT_SIZES.length - 1, p.sizeIndex ?? DEFAULT_SI),
  );
  document.documentElement.style.fontSize = FONT_SIZES[si] + "px";
  const sr = document.getElementById("sizeResetBtn");
  if (sr) sr.textContent = si === DEFAULT_SI ? "A" : FONT_SIZES[si] + "px";
  const dt = document.getElementById("densityToggle");
  if (dt) dt.textContent = DENSITY_LABELS[dn] || "Normal";
  const panel = document.getElementById("settingsPanel");
  if (panel) panel.classList.toggle("settings-visible", !!p.settingsOpen);
  document
    .getElementById("settingsBackdrop")
    ?.classList.toggle("show", !!p.settingsOpen);
  const stb = document.getElementById("settingsToggleBtn");
  if (stb) {
    stb.classList.toggle("active", !!p.settingsOpen);
    // See checkForUpdate()'s own comment (below the service worker registration) for what sets
    // latestVersion and why this stays a quiet dot rather than a banner.
    stb.classList.toggle("has-update", !!latestVersion);
  }
  const sl = p.stripeLevel ?? 0;
  if (sl === 0) document.documentElement.removeAttribute("data-stripe");
  else document.documentElement.setAttribute("data-stripe", String(sl));
  const slt = document.getElementById("stripeToggle");
  if (slt) slt.textContent = STRIPE_LABELS[sl] || "Subtle";
  const adt = document.getElementById("adjToggle");
  if (adt) {
    adt.classList.toggle("active", !!p.showAdjustments);
    adt.textContent = p.showAdjustments ? "Shown" : "Hidden";
  }
  const advBtn = document.getElementById("advToggleBtn"),
    advGroup = document.getElementById("advancedGroup");
  if (advBtn && advGroup) {
    advBtn.classList.toggle("open", !!p.advancedOpen);
    advBtn.setAttribute("aria-expanded", String(!!p.advancedOpen));
    advGroup.classList.toggle("open", !!p.advancedOpen);
  }
  const unlockToggle = document.getElementById("unlockEventDetailsToggle");
  if (unlockToggle) {
    unlockToggle.classList.toggle("active", !!p.unlockEventDetails);
    unlockToggle.textContent = p.unlockEventDetails ? "Unlocked" : "Locked";
  }
  const timerToggle = document.getElementById("timerVisibleToggle");
  if (timerToggle) {
    timerToggle.classList.toggle("active", !!p.showTimer);
    timerToggle.textContent = p.showTimer ? "Shown" : "Hidden";
  }
  if (p.showTimer)
    document.documentElement.removeAttribute("data-timer-hidden");
  else document.documentElement.setAttribute("data-timer-hidden", "1");
  // Both rows below configure the timer widget itself — Timer Stepper Buttons decides whether IT
  // shows -30/+30 nudges, Timer Pulse decides whether IT flashes — so neither means anything with
  // Timer Widget off, same reasoning as Drumroll Crossfade needing Manual Drumroll Control on.
  const steppersRow = document.getElementById("timerSteppersRow");
  if (steppersRow) steppersRow.style.display = p.showTimer ? "" : "none";
  const pulseRow = document.getElementById("timerPulseRow");
  if (pulseRow) pulseRow.style.display = p.showTimer ? "" : "none";
  const stepperToggle = document.getElementById("timerSteppersToggle");
  if (stepperToggle) {
    stepperToggle.classList.toggle("active", !!p.showTimerSteppers);
    stepperToggle.textContent = p.showTimerSteppers ? "Shown" : "Hidden";
  }
  if (p.showTimerSteppers)
    document.documentElement.setAttribute("data-timer-steppers", "1");
  else document.documentElement.removeAttribute("data-timer-steppers");
  const pulseToggle = document.getElementById("timerPulseToggle");
  if (pulseToggle) {
    pulseToggle.classList.toggle("active", !!p.timerPulse);
    pulseToggle.textContent = p.timerPulse ? "Shown" : "Hidden";
  }
  if (p.timerPulse)
    document.documentElement.removeAttribute("data-timer-no-pulse");
  else document.documentElement.setAttribute("data-timer-no-pulse", "1");
  const fadeRange = document.getElementById("craftFadeRange");
  if (fadeRange) {
    fadeRange.value = String(craftFadeSec());
    previewCraftFadeSec(fadeRange.value);
  }
  const qResultToggle = document.getElementById("qResultToggleBtn");
  if (qResultToggle) {
    qResultToggle.classList.toggle("active", !!p.qResultToggle);
    qResultToggle.textContent = p.qResultToggle ? "On" : "Off";
  }
  const manualEndToggle = document.getElementById("craftManualEndToggle");
  if (manualEndToggle) {
    manualEndToggle.classList.toggle("active", !!p.craftManualEnd);
    manualEndToggle.textContent = p.craftManualEnd ? "On" : "Off";
  }
  // The crossfade length only ever matters once Manual Drumroll Control is on — it's Stop
  // Drumroll's own fade-out duration, and that button doesn't exist until manual control does —
  // so the row stays hidden rather than sitting there configuring a feature that isn't active.
  const crossfadeRow = document.getElementById("drumCrossfadeRow");
  if (crossfadeRow) crossfadeRow.style.display = p.craftManualEnd ? "" : "none";
  // Same reasoning as the crossfade row above: Sound Test Buttons is a Manual Drumroll Control
  // companion setting, so it stays hidden until that's on rather than sitting there configuring
  // a row the host hasn't opted into yet.
  const soundTestRow = document.getElementById("soundTestRow");
  if (soundTestRow) soundTestRow.style.display = p.craftManualEnd ? "" : "none";
  const soundTestToggle = document.getElementById("craftSoundTestToggle");
  if (soundTestToggle) {
    soundTestToggle.classList.toggle("active", !!p.craftSoundTest);
    soundTestToggle.textContent = p.craftSoundTest ? "Shown" : "Hidden";
  }
  const vl = document.getElementById("versionLabel");
  if (vl) {
    let html = "Scorekeeper " + APP_VERSION + " · " + APP_VERSION_DATE;
    // Not a "tap to refresh" button — reloading doesn't reliably update an installed home-screen
    // app (the icon specifically never does, and a plain reload of an already-open instance
    // isn't guaranteed to either), so offering that as "the fix" was actively misleading. Points
    // at the FAQ's own real instructions instead: remove the installed app and add it again.
    if (latestVersion)
      html +=
        ` <a class="update-available-btn" href="faq/index.html#q-how-do-i-update-the-installed-app" target="_blank" rel="noopener">${esc(latestVersion)} available — see how to update</a>`;
    vl.innerHTML = html;
  }
  const qts = document.getElementById("qtDurationSelect");
  if (qts && document.activeElement !== qts) qts.value = p.qtDurationSec;
}
function setTheme(t) {
  if (!["dark", "light"].includes(t)) t = "dark";
  const p = loadPrefs();
  p.theme = t;
  savePrefs(p);
  applyPrefs();
  // ICON_DONE's own emoji depends on theme now (see applyIconStyle), so a theme change has to
  // rebuild every already-rendered Done badge/mini-progress banner, not just flip CSS variables
  // the way every other theme-driven visual in this app can get away with — renderAll() re-reads
  // the ICON_DONE applyPrefs above just updated, the same order setIconStyle already uses
  // (applyIconStyle direct, then renderAll) so this isn't a new pattern, just the same one theme
  // changes hadn't needed before.
  renderAll();
}
function toggleTheme() {
  const p = loadPrefs();
  setTheme(p.theme === "dark" ? "light" : "dark");
}
function toggleAdjSetting() {
  const p = loadPrefs();
  p.showAdjustments = !p.showAdjustments;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
function toggleAdvancedSettings() {
  const p = loadPrefs();
  p.advancedOpen = !p.advancedOpen;
  savePrefs(p);
  toggleClassPreserveScroll(
    document.getElementById("settingsPanel"),
    document.getElementById("advToggleBtn"),
    () => applyPrefs(),
  );
}
function toggleUnlockEventDetails() {
  const p = loadPrefs();
  p.unlockEventDetails = !p.unlockEventDetails;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
function toggleTimerVisible() {
  const p = loadPrefs();
  p.showTimer = !p.showTimer;
  savePrefs(p);
  applyPrefs();
  syncQtimerH();
}
function toggleTimerSteppers() {
  const p = loadPrefs();
  p.showTimerSteppers = !p.showTimerSteppers;
  savePrefs(p);
  applyPrefs();
  syncQtimerH();
}
function toggleTimerPulse() {
  const p = loadPrefs();
  p.timerPulse = !p.timerPulse;
  savePrefs(p);
  applyPrefs();
}
function toggleQResultButtons() {
  const p = loadPrefs();
  p.qResultToggle = !p.qResultToggle;
  savePrefs(p);
  applyPrefs();
  renderAll();
}
function toggleCraftManualEnd() {
  const p = loadPrefs();
  p.craftManualEnd = !p.craftManualEnd;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
function toggleCraftSoundTest() {
  const p = loadPrefs();
  p.craftSoundTest = !p.craftSoundTest;
  savePrefs(p);
  applyPrefs();
  renderLeft();
}
// Drumroll fade-out length, in seconds — the Settings slider's range and its default.
const CRAFT_FADE_MIN = 0.2;
const CRAFT_FADE_MAX = 3;
const CRAFT_FADE_DEFAULT = 1.2;
function craftFadeSec() {
  const v = parseFloat(loadPrefs().craftFadeSec);
  if (!isFinite(v)) return CRAFT_FADE_DEFAULT;
  return Math.max(CRAFT_FADE_MIN, Math.min(CRAFT_FADE_MAX, Math.round(v * 10) / 10));
}
// Live readout while the slider is being dragged. Deliberately does not rebuild the clip —
// re-rendering a multi-hundred-KB WAV on every pointer move would stutter the drag for nothing,
// since the value isn't committed until release.
function previewCraftFadeSec(v) {
  const el = document.getElementById("craftFadeVal");
  if (el) el.textContent = parseFloat(v).toFixed(1) + "s";
}
// Committed on release. Rebuilds the clip at the new length and re-arms the cue if one is already
// loaded, so the next "Stop Drumroll" uses it. Deliberately does NOT create a cue element if none
// exists — that needs a user gesture on the drumroll button and would claim the iOS audio session
// from a Settings slider, which is exactly what the AUDIO POLICY forbids. The next draw picks the
// new length up on its own.
function setCraftFadeSec(v) {
  const p = loadPrefs();
  p.craftFadeSec = Math.max(
    CRAFT_FADE_MIN,
    Math.min(CRAFT_FADE_MAX, Math.round(parseFloat(v) * 10) / 10),
  );
  savePrefs(p);
  applyPrefs();
}
function setCbMode(v) {
  const p = loadPrefs();
  p.cbMode = parseInt(v, 10) || 0;
  savePrefs(p);
  applyPrefs();
}

// Thin, page-named wrappers around js/shared-ui.js's sharedToggleCvMenu/sharedCloseCvMenu/
// sharedSetCvSelectDisplay — same widget, same markup, same positioning logic as the FAQ's own
// #faqCvSelect, so the actual implementation lives there once instead of as two independently
// hand-maintained copies (see that file's own top comment for why). Kept as same-named
// functions here rather than calling the shared ones directly from index.html's onclick=""
// attributes, so nothing in the markup had to change for this.
function closeCvMenu() {
  sharedCloseCvMenu("cbSelect");
}
function toggleCvMenu(e) {
  sharedToggleCvMenu(e, "cbSelect");
}
function selectCvOption(li, v) {
  setCvSelectDisplay(v);
  closeCvMenu();
  setCbMode(v);
}
function setCvSelectDisplay(v) {
  sharedSetCvSelectDisplay("cbSelect", v);
}
document.addEventListener("click", (e) => {
  // .cv-select-menu is checked separately from .cv-select: while open the menu is a child of
  // <body>, so it is no longer inside .cv-select for closest() to find.
  if (!e.target.closest(".cv-select") && !e.target.closest(".cv-select-menu"))
    closeCvMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCvMenu();
});
// The menu is now position:fixed (placed against the viewport, not the Settings panel — see
// .cv-select-menu's CSS comment), so it no longer scrolls along with the button that opened it.
// Close it on scroll rather than let it drift away from — or overlap — its own button. Capture
// phase is required: scroll doesn't bubble, and .settingsPanel/.settings-panel-body, not
// document, are what actually receive it.
document.getElementById("settingsPanel")?.addEventListener(
  "scroll",
  closeCvMenu,
  true,
);
function toggleDensity() {
  const p = loadPrefs();
  const ci = DENSITIES.indexOf(p.density || "normal");
  p.density = DENSITIES[(ci + 1) % DENSITIES.length];
  savePrefs(p);
  applyPrefs();
}
function toggleStripe() {
  const p = loadPrefs();
  const ci = STRIPE_LEVELS.indexOf(p.stripeLevel ?? 0);
  p.stripeLevel = STRIPE_LEVELS[(ci + 1) % STRIPE_LEVELS.length];
  savePrefs(p);
  applyPrefs();
}
function adjustFontSize(d) {
  const p = loadPrefs();
  if (d === 0) p.sizeIndex = DEFAULT_SI;
  else
    p.sizeIndex = Math.max(
      0,
      Math.min(FONT_SIZES.length - 1, (p.sizeIndex ?? DEFAULT_SI) + d),
    );
  savePrefs(p);
  applyPrefs();
}
function toggleSettings() {
  const p = loadPrefs();
  p.settingsOpen = !p.settingsOpen;
  savePrefs(p);
  applyPrefs();
}
// Closing the panel by removing its "settings-visible" class alone doesn't stick — settingsOpen
// is a persisted pref, and every renderAll() calls applyPrefs(), which re-reads that pref and
// re-shows the panel on the very next render if it's still true. Loading a saved/sample game
// (below) needs the pref itself flipped, not just the DOM, or the panel pops back open the
// moment the next score is entered and renderAll() fires.
function closeSettingsPanel() {
  const p = loadPrefs();
  if (p.settingsOpen) {
    p.settingsOpen = false;
    savePrefs(p);
  }
  applyPrefs();
}

(function () {
  const p = loadPrefs();
  document.documentElement.setAttribute("data-theme", p.theme);
  if (p.cbMode)
    document.documentElement.setAttribute("data-cb", String(p.cbMode));
  if (p.density && p.density !== "normal")
    document.documentElement.setAttribute("data-density", p.density);
  if (p.stripeLevel && p.stripeLevel > 0)
    document.documentElement.setAttribute("data-stripe", String(p.stripeLevel));
  document.documentElement.style.fontSize =
    FONT_SIZES[
      Math.max(0, Math.min(FONT_SIZES.length - 1, p.sizeIndex ?? DEFAULT_SI))
    ] + "px";
})();

let gameState = freshState(),
  scoreSortMode = "entry",
  randomOrder = null;
let standingsSortMode = { halftime: "entry", final: "entry" };
let standingsRandomOrder = { halftime: null, final: null };
let collapsedStandings = new Set();
let collapsedSections = new Set([
  "sec-r1",
  "sec-r2",
  "sec-r3",
  "sec-r4",
  "sec-craftprize",
  "sec-export",
]);
let adjOpenTeams = new Set(),
  lastAction = null;
// Tracks the nearest identifiable ancestor (a team's own row, or failing that the whole
// question/bonus/special-wager/team-entry block, or failing that the whole collapsible
// .section) of whatever was just clicked inside #mainContent — used by renderLeft()'s scroll
// anchor further down this file. Delegated + capture phase (not each scoring function setting
// this individually, the way lastAction above
// only covers cycleW) so EVERY scoring path is covered automatically: cycleW, markAll, bonus
// choices, special-wager correct/incorrect, point adjustments, any future one — all of them
// re-render through renderLeft(), and all of them can shift content the same way.
//
// `.section` is the catch-all at the end of that selector list, and it covers every re-rendering
// control that isn't a scoring row at all: Craft Prize Drawing's buttons and steppers, Event
// Details' fields, Export & Data's. Without it those matched nothing, so renderLeft() ran with
// no anchor and fell back to the raw sy/wy restore — i.e. exactly the pre-v18.41 behaviour this
// anchor exists to replace: right for as long as nothing above them changed height, and a jump
// to somewhere unrelated the moment something did. closest() returns the NEAREST match, so a
// scoring row inside a section still anchors to the row, never to the whole section.
//
// Capture phase runs before the click's own onclick handler (cycleW/markAll/etc., which is what actually
// triggers the re-render), so this is always set to the right target before renderLeft() ever
// reads it. Not document.activeElement: Safari deliberately doesn't focus a <button> on a plain
// mouse/touch click, so that would silently miss this exact interaction on iOS, the platform
// this was reported from.
//
// Declared here, at the very top of the script, rather than down next to renderLeft() itself
// (where this used to live): the very first render on a brand-new session (no saved game — see
// the IIFE below) runs synchronously during initial script evaluation, and that first
// renderLeft() call reads this variable. A `let` declared later in the same script is in its
// temporal dead zone until its own statement executes, so reading it any earlier — even from a
// function invoked before that point — throws a ReferenceError. With this block previously
// positioned after renderLeft()'s definition (i.e. after that first synchronous render call),
// every brand-new session crashed on load with a blank #mainContent and never recovered, since
// the thrown error aborted the rest of the script before this declaration (and the click
// listener below) ever ran — leaving every future render call hitting the exact same
// ReferenceError forever. Returning users were unaffected (their saved session skips that first
// synchronous render, see the IIFE below), which is why this went unnoticed: it only bites the
// very first launch, or any time storage gets cleared/evicted (e.g. iOS Safari's ~7-day
// eviction for a PWA that sits unopened between events).
// KEYBOARD ACTIVATION for every role="button" in the app. These are divs and spans (section
// headers, question headers, team names, the mini-progress bar, standings rows) that carry
// role="button" and tabindex="0", so a keyboard or screen-reader user can focus them — but a
// plain element does not activate on Enter/Space the way a real <button> does, so before this
// they could be reached and then not used at all. That is a WCAG 2.1.1 (Keyboard, Level A)
// failure, and it covered 297 controls.
// Delegated on document rather than an onkeydown per element for the same reason the click
// anchor above is delegated: it covers every one of them, including any added later, from one
// place. Space is preventDefault-ed because its default action on a focused non-button is to
// scroll the page, which would fire the control AND jump the view.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  const el = e.target.closest('[role="button"]');
  if (!el) return;
  // A real <button>/<a> inside the region handles its own keys; don't fire both.
  if (e.target.closest("button,a,input,textarea,select") ) return;
  e.preventDefault();
  el.click();
});

// Screen-reader announcements for things that change on screen without moving focus — scoring a
// team, clearing a mark, the craft prize winner. Sighted hosts see the row update; without a live
// region a blind host taps a wager and gets no confirmation the tap landed at all (WCAG 4.1.3
// Status Messages, Level AA).
// The element is in the static HTML rather than created on demand: an aria-live region has to be
// in the DOM and observed by the accessibility tree BEFORE text is put into it, or the first
// message is silently missed. polite, so it queues behind whatever the reader is already saying
// instead of cutting it off — every message here is a confirmation, never an emergency.
// Re-announcing an identical string is a no-op in most readers, so a trailing space is toggled to
// force each one through even when the same message repeats (e.g. two teams both scoring "+4").
let __srToggle = false;
function announce(msg) {
  const el = document.getElementById("srAnnouncer");
  if (!el || !msg) return;
  __srToggle = !__srToggle;
  el.textContent = msg + (__srToggle ? " " : "");
}

// ---- CHARACTER-LIMIT FEEDBACK ------------------------------------------------------------
// Every host-typed field carries a maxlength (Team name 40, Location 60, Quiz ID 24, the
// announcement script 600, and so on). The browser enforces those silently: at the limit the
// field simply stops accepting characters, with no cue at all. Typing a team name that is one
// word too long therefore looks identical to a dropped keypress or a wedged app, and the host
// finds out only when they read back a name that stops mid-word.
//
// One delegated listener rather than a handler per field: the fields are re-rendered from
// scratch on nearly every interaction (renderLeft swaps #mainContent's innerHTML), so anything
// bound to the elements themselves would have to be re-bound every time. Delegation on document
// survives all of it and picks up fields added later for free.
//
// The note is one shared element that gets moved to whichever field is at its limit, not a node
// per field, so there is never more than one on screen and nothing to clean up if a re-render
// takes the old parent away. It is removed when the value drops back under the limit, when focus
// leaves, and on a timer — whichever happens first, because a message about what you just typed
// stops being about what you just typed fairly quickly.
(function () {
  let noteEl = null,
    noteTimer = null,
    noteField = null;
  function clearLimitNote() {
    clearTimeout(noteTimer);
    noteTimer = null;
    if (noteField) noteField.classList.remove("at-limit");
    noteField = null;
    if (noteEl) noteEl.remove();
    noteEl = null;
  }
  function showLimitNote(el, max) {
    // Already showing for this same field — leave it alone rather than restarting the timer on
    // every further keystroke, which would keep a note up indefinitely while the host holds a
    // key down against the limit.
    if (noteField === el) return;
    clearLimitNote();
    noteEl = document.createElement("span");
    noteEl.className = "limit-note";
    // aria-hidden and a separate announce(): the note is inserted mid-edit, and a live region
    // that appears inside the field's own labelling context can make a screen reader re-read the
    // whole field. #srAnnouncer is the app's existing single announcement channel.
    noteEl.setAttribute("aria-hidden", "true");
    noteEl.textContent = `Limit reached — ${max} characters max`;
    el.insertAdjacentElement("afterend", noteEl);
    el.classList.add("at-limit");
    noteField = el;
    announce(`Character limit reached, ${max} maximum`);
    noteTimer = setTimeout(clearLimitNote, 3200);
  }
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (
      !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    )
      return;
    // maxLength is -1 on a field that does not declare one, and number inputs (the team guess)
    // have no meaningful length limit even though they have min/max.
    const max = el.maxLength;
    if (!max || max < 0 || el.type === "number") return;
    if (el.value.length >= max) showLimitNote(el, max);
    else if (noteField === el) clearLimitNote();
  });
  // Capture, because focusout does not bubble in the same way from every field type here, and
  // because the field may be gone by the time a bubbled event would arrive.
  document.addEventListener("focusout", clearLimitNote, true);
})();

let lastClickAnchorSel = null;
// Same idea, scoped to the scoreboard sidebar's own scroller (#sidebarBody) — see renderSB's use
// of it. A separate variable rather than reusing lastClickAnchorSel: renderAll() calls
// renderLeft() before renderSB(), and renderLeft() reads-then-clears lastClickAnchorSel on every
// call, which would silently eat a sidebar click's anchor before renderSB ever got to it.
let lastSBClickAnchorSel = null;
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest(
      "[data-ta], [data-ti], .question-block, .special-section, .standings-sort-btns, .standings-block, .section",
    );
    if (!el) return;
    const sel = el.hasAttribute("data-ta")
      ? `[data-ta="${el.getAttribute("data-ta")}"]`
      : el.hasAttribute("data-ti")
        ? `[data-ti="${el.getAttribute("data-ti")}"]`
        : el.id
          ? "#" + el.id
          : null;
    if (el.closest("#sidebarBody")) lastSBClickAnchorSel = sel;
    else lastClickAnchorSel = sel;
  },
  true,
);
// Track which (ri,qi) combos we've already toasted for Beer Round
let beerRoundToasted = new Set();

(function () {
  const s = loadSaved();
  if (s) {
    // innerHTML, not textContent: the icon is markup, and a saved location is host-entered
    // free text, so it goes through esc() on the way in.
    document.getElementById("resumeText").innerHTML =
      ICON_ALERT +
      " Saved session from " +
      esc(s.meta?.date ? isoToMDY(s.meta.date) : "?") +
      " at " +
      esc(s.meta?.location || "(no location)") +
      ". Resume or start fresh?";
    document.getElementById("resumeBanner").classList.add("show");
  } else {
    gameState = freshState();
    renderAll();
  }
})();

// Keeps --qtimer-h in sync with the real rendered height of the desktop question timer, which
// .scores-list (see styles.css) reserves as bottom padding so the last team row can always
// scroll clear of the timer instead of being permanently stranded behind it. A ResizeObserver
// (not a one-time measurement) because the timer's height isn't fixed — it changes with
// font-size settings and with row-density/text-size changes elsewhere in Settings. Also called
// directly from toggleTimerVisible(): a display:none element reports 0 here, so hiding the
// timer collapses that reserved padding back down instead of leaving a gap behind it.
function syncQtimerH() {
  const qtEl = document.querySelector(".qtimer-desktop");
  if (!qtEl) return;
  document.documentElement.style.setProperty(
    "--qtimer-h",
    qtEl.offsetHeight + "px",
  );
}
(function () {
  const qtEl = document.querySelector(".qtimer-desktop");
  if (!qtEl) return;
  new ResizeObserver(syncQtimerH).observe(qtEl);
  syncQtimerH();
})();

// Keeps --header-h in sync with the real rendered height of .header, which .mini-progress
// (see styles.css) uses on mobile to sit just below it instead of underneath it. A
// ResizeObserver (not a one-time measurement) because the header's height isn't fixed — it
// changes with font-size settings and with the safe-area inset on notched phones.
(function () {
  const headerEl = document.querySelector(".header");
  if (!headerEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--header-h",
      headerEl.offsetHeight + "px",
    );
  new ResizeObserver(sync).observe(headerEl);
  sync();
})();

// Keeps --layout-top in sync with where .app-layout actually starts down the viewport, which is
// what its desktop height subtracts from 100dvh (see the note on .app-layout in styles.css for
// what the hardcoded 60px this replaces got wrong, and why the blank strip it left below the
// layout was reachable by scrolling with the cursor over the Scores column).
//
// One measurement of the panel's own top edge, rather than adding up the heights of the things
// above it: the sticky .header and the Resume banner are what sit there today, but a single
// "where does it begin" number stays right for whatever is ever added, shown or hidden up there,
// with no list to keep in step.
//
// getBoundingClientRect().top + scrollY, not offsetTop, because offsetTop is rounded to a whole
// pixel and this needs the fraction: the header is 46.5px at the default text size, and half a
// pixel of leftover height is enough for the document's rounded-up scrollHeight to exceed the
// viewport and make the page scrollable by 1px again — the exact thing being fixed. Adding
// scrollY makes it the document-relative top, so a measurement taken while the page happens to
// be scrolled (the very state this corrects, on the first pass after load) still reads true.
//
// Observed rather than measured once, for the same reason as --header-h above: the header grows
// with the font-size setting, and the Resume banner appears on load with a saved session and
// disappears on Resume/New Game/dismiss — a display:none toggle, which a ResizeObserver reports
// as a resize to zero. The window listener covers viewport changes that resize nothing being
// observed, and the two together are idempotent: re-running sync with nothing changed writes the
// same value back.
(function () {
  const layoutEl = document.querySelector(".app-layout");
  if (!layoutEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--layout-top",
      layoutEl.getBoundingClientRect().top + window.scrollY + "px",
    );
  const ro = new ResizeObserver(sync);
  // The two things in flow above the panel, and deliberately NOT the panel itself: a
  // ResizeObserver reports size, not position, so observing the panel could not detect it being
  // MOVED anyway — and since its height is what this variable sets, observing it would only feed
  // every write back in as another callback.
  for (const el of [
    document.querySelector(".header"),
    document.getElementById("resumeBanner"),
  ]) {
    if (el) ro.observe(el);
  }
  window.addEventListener("resize", sync);
  sync();
  // This first sync() can still be measuring a page that hasn't fully settled: the resume
  // banner's own text renders in Inter (font-display:swap) starting from a fallback system font,
  // and the fallback's metrics are narrower per character on every measured case — so the very
  // first paint can wrap the banner's one sentence onto one FEWER line than the webfont it swaps
  // into a few dozen ms later. That swap is a genuine resize of #resumeBanner and the observer
  // above does catch most of them, but the ones that land in the gap between this synchronous
  // sync() call and the observer's own first async callback are missed entirely, leaving
  // --layout-top permanently undershooting the panel's real top by however many lines the swap
  // added — which makes .app-layout (height:calc(100vh - var(--layout-top))) render that many
  // lines TALLER than the viewport actually has room for, and the document becomes scrollable by
  // exactly that overshoot: this is the "I can still scroll down past the bottom" bug. Nothing
  // else in the page re-triggers sync() once that initial race is lost — document.fonts.ready
  // resolves once every @font-face this page declares has actually swapped in, so this adds the
  // one guaranteed re-measurement that closes it, independent of whichever element's resize the
  // observer happened to miss.
  if (document.fonts?.ready) document.fonts.ready.then(sync);
  // Belt-and-braces for the same race from the other end: the window "load" event (all
  // resources, not just fonts, finished) fires after fonts.ready in every case that matters here
  // and costs nothing extra to also resync on, in case something other than a font swap is ever
  // the thing that lands late.
  window.addEventListener("load", sync);
})();

// Keeps --mobile-dock-h in sync with the real rendered height of .mobile-bottom-dock (the peek
// strip + timer docked at the bottom of the screen on mobile). The collapsing scores sheet (see
// .col-right in the mobile media query in styles.css) closes to this height rather than sliding
// fully offscreen, so it visually shrinks down to exactly the docked panel's own size and fades
// out right there instead of a slice of it lingering on top of the now-revealed dock. A
// ResizeObserver (not a one-time measurement) because the dock's height varies with the timer's
// visibility/steppers settings and the safe-area inset on notched phones.
(function () {
  const dockEl = document.getElementById("mobileBottomDock");
  if (!dockEl) return;
  const sync = () =>
    document.documentElement.style.setProperty(
      "--mobile-dock-h",
      dockEl.offsetHeight + "px",
    );
  new ResizeObserver(sync).observe(dockEl);
  sync();
})();

// Closes the banner without picking Resume or New Game — for a host who's about to start the
// tutorial or a practice game instead and just wants it out of the way. The saved session stays
// untouched in storage either way; this only reveals the fresh empty game already sitting in
// gameState (see the top-level IIFE above), same as what's behind the banner until a choice is made.
function dismissResumeBanner() {
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}
function resumeSession() {
  const s = loadSaved();
  if (s) gameState = migrateState(s);
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}
function startNewGame() {
  clearSaved();
  gameState = freshState();
  scoreSortMode = "entry";
  randomOrder = null;
  standingsSortMode = { halftime: "entry", final: "entry" };
  standingsRandomOrder = { halftime: null, final: null };
  collapsedStandings = new Set();
  collapsedSections = new Set([
    "sec-r1",
    "sec-r2",
    "sec-r3",
    "sec-r4",
    "sec-craftprize",
    "sec-export",
  ]);
  collapsedQuestions = new Set();
  collapsedBonusQuestions = new Set();
  collapsedSpecialWagers = new Set();
  questionSortOrder = {};
  beerRoundToasted = new Set();
  adjOpenTeams = new Set();
  clearCraftDrawTimers();
  stopAllDrumAudio();
  craftDrawState = null;
  craftFlowOpen = false;
  document.getElementById("resumeBanner").classList.remove("show");
  renderAll();
}
function renderFinalResults() {
  if (!gameState.teams.length)
    return '<p class="fr-note">Add teams and score the game to see final results.</p>';
  const rows = finalResultsRows();
  let h =
    '<table class="final-table"><thead><tr><th>Place</th><th>Team</th><th>Score</th><th class="fr-guess-h">Guess</th><th class="fr-diff-h">Diff *</th></tr></thead><tbody>';
  rows.forEach((r) => {
    const medal =
      r.place === 1
        ? " fr-gold"
        : r.place === 2
          ? " fr-silver"
          : r.place === 3
            ? " fr-bronze"
            : "";
    const diffSigned =
      r.diffSign > 0 ? "+" + r.diff : r.diffSign < 0 ? "-" + r.diff : r.diff;
    h +=
      `<tr class="${r.tie ? "fr-tie" : ""}${medal}" role="button" tabindex="0" title="${esc(r.name)} \u2014 tap to view team report" onclick="openAudit(${r.index})">` +
      `<td class="fr-place" data-label="Place">${ordinal(r.place)}</td>` +
      `<td class="fr-name" data-label="Team"><span class="ta-name-clickable">${esc(r.name)}</span>${r.tie ? ` <span class="fr-tiebadge${r.tieWinner ? " fr-win" : ""}">${r.tieWinner ? CHECK_ICON_SVG + " closer" : "tie"}</span>` : ""}</td>` +
      `<td class="fr-score" data-label="Score">${r.score}</td>` +
      `<td class="fr-guess" data-label="Guess">${r.guess == null ? "\u2014" : r.guess}</td>` +
      `<td class="fr-diff${r.tieWinner ? " fr-diff-win" : ""}" data-label="Diff *">${r.guess == null ? "\u2014" : diffSigned}</td>` +
      `</tr>`;
  });
  h += "</tbody></table>";
  h +=
    '<details class="fr-details"><summary>Diff *</summary>' +
    `<p class="fr-note">Listed lowest \u2192 highest score (reveal order). Equal scores are broken by whose final guess is closest to their actual score \u2014 the smallest <strong>Diff</strong> takes the higher place (marked <span style="color:var(--badge-green-fg);font-weight:700;">${CHECK_ICON_SVG} closer</span>, with the rest of that tied group marked <strong>tie</strong>). A team tied on BOTH score and Diff shares a place number outright.</p>` +
    "<p class=\"fr-note\">* <strong>Diff</strong> is minus Bonuses \u2014 Bonus Item (+5) and NJCB (+3) are stripped from a team's score before it's compared to their guess, for every team.</p>" +
    "</details>";
  return h;
}

function renderStandings(type) {
  if (!gameState.teams.length) return "";
  const label =
    type === "halftime"
      ? "Scores \u2014 Before Halftime Wager"
      : "Scores \u2014 Before Final Wager";
  const mode = standingsSortMode[type] || "entry";
  const base = gameState.teams.map((t, ti) => ({
    ti,
    name: t.name || "Team " + (ti + 1),
    pts: preWagerTotal(ti, type),
  }));
  let list;
  if (mode === "random") {
    const ro = standingsRandomOrder[type];
    list = ro && ro.length === base.length ? ro.map((ti) => base[ti]) : base;
  } else list = base;
  const btns = [
    ["entry", "Entry"],
    ["random", `${ICON_SHUFFLE}<span class="sr-only">Shuffle</span>`],
  ]
    .map(
      ([m, lbl]) =>
        `<button class="standings-sort-btn${mode === m ? " active" : ""}" title="${m === "random" ? "Shuffle" : ""}" onclick="setStandingsSort('${type}','${m}')">${lbl}</button>`,
    )
    .join("");
  const isCollapsed = collapsedStandings.has(type);
  let h =
    `<div class="standings-block${isCollapsed ? " collapsed" : ""}" id="standings-${type}">` +
    `<div class="standings-title-row" role="button" tabindex="0" onclick="toggleStandingsCollapse('${type}')" title="${isCollapsed ? "Expand" : "Collapse"}" aria-label="${isCollapsed ? "Expand" : "Collapse"} ${esc(label)}"><span class="chevron standings-chevron">\u25BC</span><span class="standings-title">${label}</span></div>` +
    `<div class="standings-collapsible">` +
    renderBanter("scores", "sc-" + type, { sm: true }) +
    `<div class="standings-sort-btns" id="standings-sortbtns-${type}">${btns}</div>` +
    `<table class="standings-table"><thead><tr><th>Team</th><th>Score</th></tr></thead><tbody>`;
  list.forEach((t) => {
    h += `<tr class="standings-row" role="button" tabindex="0" title="${esc(t.name)} — tap to view team report" onclick="openAudit(${t.ti})"><td class="standings-name ta-name-clickable">${esc(t.name)}</td><td class="standings-pts">${t.pts}</td></tr>`;
  });
  return h + "</tbody></table></div></div>";
}
function toggleStandingsCollapse(type) {
  if (collapsedStandings.has(type)) collapsedStandings.delete(type);
  else collapsedStandings.add(type);
  const el = document.getElementById("standings-" + type);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (!el) return;
    const nowCollapsed = el.classList.toggle("collapsed");
    const row = el.querySelector(".standings-title-row");
    const label = row?.querySelector(".standings-title")?.textContent || "";
    if (row) {
      const verb = nowCollapsed ? "Expand" : "Collapse";
      row.title = verb + " " + label;
      row.setAttribute("aria-label", verb + " " + label);
    }
  });
}

function setSortMode(mode) {
  if (mode === "random") {
    randomOrder = gameState.teams.map((_, i) => i);
    for (let i = randomOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomOrder[i], randomOrder[j]] = [randomOrder[j], randomOrder[i]];
    }
  }
  scoreSortMode = mode;
  renderSB();
}
function getDisplayOrder() {
  const n = gameState.teams.length;
  if (scoreSortMode === "random" && randomOrder && randomOrder.length === n)
    return randomOrder.slice();
  if (scoreSortMode === "asc" || scoreSortMode === "desc") {
    // Sorts by rankMap()'s own place number (already tie-broken by score then guess-closeness)
    // rather than grandTotal alone — otherwise a tied pair could land in an order that
    // contradicts their #1/#2 rank badges, and Ascending's "dramatic reveal" could end on the
    // 2nd-place team instead of the actual winner.
    const rm = rankMap();
    const order = gameState.teams.map((_, i) => i);
    order.sort((a, b) => rm[a] - rm[b] || a - b);
    if (scoreSortMode === "asc") order.reverse();
    return order;
  }
  return gameState.teams.map((_, i) => i);
}
function sortModeLabel() {
  switch (scoreSortMode) {
    case "random":
      return `${ICON_SHUFFLE_TINTED} Shuffled order \u2014 for mid-game reads`;
    case "asc":
      return `${ICON_ARROW_UP} Lowest to highest \u2014 dramatic reveal`;
    case "desc":
      return `${ICON_ARROW_DOWN} Highest to lowest \u2014 leaderboard order`;
    default:
      return `${ICON_CLIPBOARD} Entry order \u2014 matches your scoresheet`;
  }
}

function setStandingsSort(type, mode) {
  if (mode === "random") {
    const order = gameState.teams.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    standingsRandomOrder[type] = order;
  }
  standingsSortMode[type] = mode;
  renderLeft();
}

function renderAll() {
  renderLeft();
  renderSB();
  applyPrefs();
}

function renderLeft() {
  const m = document.getElementById("mainContent");
  if (!m) return;
  let sy = m.scrollTop;
  let wy = window.scrollY || document.documentElement.scrollTop || 0;
  // sy/wy alone assume nothing ABOVE the scroll position changed height between renders — but a
  // round badge's "N left" count changing width, a round or question flipping to its "Done"
  // state, sort re-ordering a question's rows, etc. all shift everything below them by a few px,
  // which is what "the view moves"/"jumps to somewhere random" whenever a score gets corrected —
  // sy/wy end up numerically right but pointing at different content than before. So instead we
  // anchor on whatever was just clicked (see lastClickAnchorSel above): note exactly where it
  // sits on screen now, and after the re-render put the scroll back so it sits in that same
  // place again. Consumed once, then cleared — so an unrelated later re-render (an onchange
  // handler elsewhere, say) never reuses a stale anchor from a click that has nothing to do
  // with it.
  //
  // NOT scrollIntoView({block:"nearest"}), which is what v18.45 used and what was still causing
  // the reported jump. Two separate problems with it, and they pull in opposite directions:
  //
  //   1. "nearest" asks the browser to bring the anchor *into view*, and a scroll container
  //      whose scroll-padding is `auto` (the default) explicitly permits the UA to place the
  //      target clear of obscuring position:sticky elements. This app stacks sticky bars at the
  //      top of the scroller — .header, and .mini-progress under it on mobile — so once the host
  //      is scrolled into a round (i.e. the entire time they're scoring), a row in that band
  //      counts as obscured and every tap on it snapped the view to push it clear. Measured on
  //      desktop: a hard snap by exactly .header's height, landing every start offset on the
  //      same final scrollTop. And whenever the anchor was outside the viewport for any reason,
  //      "nearest" yanked the whole view to it — up to 527px in testing.
  //   2. In the case it was actually added for it did nothing at all: if content above the
  //      anchor changes height, the anchor moves on screen but stays "in view", so "nearest" is
  //      satisfied and the shift goes uncorrected.
  //
  // Pinning the anchor to its own previous on-screen offset has neither problem — it's zero
  // movement by construction, and it never asks the browser where the element "should" go, so
  // sticky overlays, scroll-margin, content reflowing above it, and late-settling fonts are all
  // equally irrelevant.
  const anchorSel = lastClickAnchorSel;
  lastClickAnchorSel = null;
  // Where the anchor sits on screen right now, measured before anything is replaced. Viewport
  // coordinates (getBoundingClientRect) rather than offsetTop: they stay valid no matter which
  // ancestor actually ends up scrolling, which matters because the scroller differs by layout —
  // #mainContent scrolls on desktop, the window scrolls on mobile.
  const anchorBefore = anchorSel
    ? m.querySelector(anchorSel)?.getBoundingClientRect().top
    : undefined;
  const gs = checkGameStarted();
  let h = "";

  // Only VISIBLE once scoring has actually begun — before that there's no "current round" to
  // report, and showing it during team setup would just be clutter above Event Details. Still
  // rendered (just visibility:hidden via .mp-pending) rather than omitted outright once teams
  // exist, though: omitting it entirely until the first score landed was making Event Details
  // and everything below it jump down the moment that first badge popped in. Reserving the same
  // real markup — not a guessed placeholder height — the whole time guarantees the space it
  // claims once visible is exactly the space already held for it.
  h += renderMiniProgress(gs);

  // Quiz ID's format is free-entry — it never blocks scoring, just hinted: a soft warning
  // when it doesn't match the usual pattern, a green confirmation once it does. Being EMPTY
  // is a separate matter, though: like Location and Host Name, something has to be there
  // before scoring can start (checked in canScore()) — quizIdInvalid covers that, entirely
  // independent of quizIdWarn/quizIdGood, which only ever apply once something's typed.
  const quizIdEntered = !!(gameState.meta.quizId || "").trim();
  const quizIdGood = quizIdEntered && isQuizIdValid(gameState.meta.quizId);
  const quizIdWarn = quizIdEntered && !quizIdGood;
  const quizIdInvalid = !gs && !quizIdEntered;
  const locInvalid = !gs && !isLocationValid(gameState.meta.location);
  const hostInvalid = !gs && !isHostNameValid(gameState.meta.hostName);
  // Once scoring starts, Event Details normally locks (so it can't drift mid-game) — but a
  // typo can still happen, so the "Edit Locked Fields" setting lets the host reopen just these.
  const metaLocked = gs && !loadPrefs().unlockEventDetails;
  h += `<div class="section ${collapsedSections.has("sec-meta") ? "collapsed" : ""}" id="sec-meta"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-meta')"><h2>Event Details</h2><span class="chevron">▼</span></div><div class="section-body"><div class="meta-grid">
    <div class="field"><label>Date</label><div class="date-native-wrap"><input type="date" class="date-native" aria-label="Date" value="${esc(gameState.meta.date || "")}" ${metaLocked ? "disabled" : ""} onchange="setGameDateISO(this.value)"><span class="date-display-text${gameState.meta.date ? "" : " is-placeholder"}">${esc(isoToPretty(gameState.meta.date) || "Select date")}</span></div></div>
    <div class="field${quizIdInvalid ? " field-invalid" : quizIdWarn ? " field-warn" : quizIdGood ? " field-good" : ""}"><label>Quiz ID</label><input type="text" class="quiz-id-input" maxlength="24" aria-label="Quiz ID" value="${esc(gameState.meta.quizId)}" placeholder="AB-123" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.quizId=this.value;autosave();renderLeft();">${quizIdInvalid ? '<span class="guess-warn">&#9888; required</span>' : quizIdWarn ? '<span class="guess-warn">&#9888; unusual format — typically 1-5 letters + 1-4 numbers, e.g. AB-123</span>' : quizIdGood ? `<span class="guess-good">${CHECK_ICON_SVG} looks good</span>` : ""}</div>
    <div class="field${hostInvalid ? " field-invalid" : ""}"><label>Host Name</label><input type="text" maxlength="40" aria-label="Host Name" value="${esc(gameState.meta.hostName || "")}" placeholder="Who's hosting" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.hostName=this.value;autosave();renderLeft();">${hostInvalid ? '<span class="guess-warn">&#9888; required</span>' : ""}</div>
    <div class="field full${locInvalid ? " field-invalid" : ""}"><label>Location</label><input type="text" maxlength="60" aria-label="Location" list="locationList" autocomplete="off" value="${esc(gameState.meta.location)}" placeholder="Bar name — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.location=this.value;autosave();renderLeft();">${locInvalid ? '<span class="guess-warn">&#9888; required</span>' : ""}</div>
    <div class="field"><label>Craft Partner</label><input type="text" maxlength="50" aria-label="Craft Partner" list="craftPartnerList" autocomplete="off" value="${esc(gameState.meta.craftPartner)}" placeholder="Brewery — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.craftPartner=this.value;autosave();"></div>
    <div class="field"><label>Partner Town</label><input type="text" maxlength="40" aria-label="Partner Town" list="partnerTownList" autocomplete="off" value="${esc(gameState.meta.craftPartnerTown)}" placeholder="Town — search or type your own" ${metaLocked ? "disabled" : ""} onchange="gameState.meta.craftPartnerTown=this.value;autosave();"></div>
    <div class="field full"><label>Bonus Item (+5)</label><input type="text" maxlength="60" aria-label="Bonus Item description" value="${esc(gameState.meta.bonusItem)}" placeholder="e.g., something red, deck of cards" onchange="gameState.meta.bonusItem=this.value;autosave();"></div>
    <div class="field full"><label>Restaurant Staff</label><textarea class="meta-textarea staff-names-input" maxlength="200" aria-label="Restaurant staff names" rows="2" placeholder="Server / bartender names to shout out" oninput="setStaffNames(this.value)">${esc(gameState.meta.staffNames || "")}</textarea></div>
  </div><p class="fr-note${metaLocked ? "" : " fr-note-pending"}"><svg class="icon-ui" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Locked once scoring starts, so it can't drift mid-game. Typo? <a href="#" onclick="event.preventDefault();toggleUnlockEventDetails();">Unlock to fix it</a>.</p></div></div>`;

  // Flagged the whole game, not just before scoring starts — a guess left blank stops blocking
  // anything once scoring begins, but it still silently shows as "—" in Final Results, which
  // reads as a display bug rather than a data-entry gap if the host was never told.
  const missingGuessCount = gameState.teams.filter(
    (t) => t.scoreGuess === "" || t.scoreGuess == null,
  ).length;
  h += `<div class="section ${collapsedSections.has("sec-teams") ? "collapsed" : ""}" id="sec-teams"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-teams')"><h2>Teams (${gameState.teams.length})${missingGuessCount ? ` <span style="font-size:.65rem;font-weight:700;color:var(--txt-orange);background:rgba(255,170,0,.12);border:1px solid var(--accent-orange);border-radius:4px;padding:1px 6px;vertical-align:middle">&#9888; ${missingGuessCount} missing guess${missingGuessCount > 1 ? "es" : ""}</span>` : ""}</h2><span class="chevron">▼</span></div><div class="section-body">`;
  const showAdj = !!loadPrefs().showAdjustments;
  gameState.teams.forEach((t, i) => {
    const adj = t.adjustment || 0,
      adjOpen = adjOpenTeams.has(i);
    h += `<div class="team-entry${showAdj ? " has-adj" : ""}" data-ti="${i}">
      <div class="team-name-cell">
        <span class="team-number">Team ${i + 1}</span>
        <input type="text" maxlength="40" value="${esc(t.name)}" placeholder="Team name" aria-label="Team ${i + 1} name" onchange="gameState.teams[${i}].name=this.value;autosave();renderSB();">
        <div class="team-checks">
          <label class="check-label item-check${t.bonusItem ? " is-checked" : ""}">
            <input type="checkbox" class="check-input" id="bi${i}" ${t.bonusItem ? "checked" : ""} onchange="gameState.teams[${i}].bonusItem=this.checked;this.closest('.check-label').classList.toggle('is-checked',this.checked);autosave();renderSB();"><span class="check-box" aria-hidden="true"></span>+5 Bonus
          </label>
          <label class="check-label njcb-check${t.njcb ? " is-checked" : ""}">
            <input type="checkbox" class="check-input" id="nj${i}" ${t.njcb ? "checked" : ""} onchange="gameState.teams[${i}].njcb=this.checked;this.closest('.check-label').classList.toggle('is-checked',this.checked);autosave();renderSB();"><span class="check-box" aria-hidden="true"></span>+3 NJCB
          </label>
        </div>
      </div>
      <div class="team-guess-cell${t.scoreGuess === "" || t.scoreGuess == null ? " guess-missing" : ""}"><label>Guess</label><input type="number" aria-label="Team ${i + 1} final score guess, 1 to 146" min="1" max="146" value="${t.scoreGuess !== "" ? t.scoreGuess : ""}" placeholder="1-146" onchange="gameState.teams[${i}].scoreGuess=this.value?parseInt(this.value):'';autosave();renderLeft();">${t.scoreGuess === "" || t.scoreGuess == null ? `<span class="guess-warn">&#9888; ${gs ? "missing" : "required"}</span>` : ""}</div>
      ${
        showAdj
          ? `<div class="adj-wrap">
        <button class="adj-chip${adj !== 0 ? " adj-active" : ""}" onclick="toggleAdj(${i})" title="${adj !== 0 ? "Adj: " + (adj > 0 ? "+" : "") + adj + " \u2014 click to edit" : "Manual point adjustment"}">${adj !== 0 ? (adj > 0 ? "+" + adj : adj) : "\u00B1"}</button>
        ${adjOpen ? `<div class="adj-stepper"><button onclick="adjPts(${i},-1)" aria-label="Decrease point adjustment">\u2212</button><span class="adj-val${adj > 0 ? " pos" : adj < 0 ? " neg" : ""}">${adj > 0 ? "+" + adj : adj}</span><button onclick="adjPts(${i},1)" aria-label="Increase point adjustment">+</button></div>` : ""}
      </div>`
          : ""
      }
      <div class="remove-team"><button onclick="removeTeam(${i})" title="Remove team" aria-label="Remove team ${i + 1}">${X_ICON_SVG}</button></div>
    </div>`;
  });
  if (gameState.teams.length < MAX_TEAMS)
    h += `<button class="btn" id="addTeamBtn" onclick="addTeam()">+ Add Team</button>`;
  else
    h += `<p class="fr-note">${MAX_TEAMS}-team max reached — remove a team to add another.</p>`;
  h += `</div></div>`;

  for (let ri = 0; ri < 4; ri++) {
    const rn = ri + 1,
      rp = roundProgress(ri),
      rComplete = rp.total > 0 && rp.done === rp.total;
    let rpBadge = "";
    if (rp.total > 0) {
      if (rComplete)
        rpBadge = `<span class="round-badge rb-done">${ICON_DONE} Done</span>`;
      else if (rp.done > 0)
        rpBadge =
          '<span class="round-badge rb-partial">' +
          (rp.total - rp.done) +
          " left</span>";
    }
    h += `<div class="section ${collapsedSections.has("sec-r" + rn) ? "collapsed" : ""} ${rComplete ? "round-complete" : ""}" id="sec-r${rn}"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-r${rn}')"><h2><span>Round ${rn}</span>${rpBadge}<span class="round-break"></span><span class="round-label ${ROUND_COLORS[ri]} round-wager-label">Wagers: ${ROUND_WAGERS[ri].join(", ")}</span></h2><span class="chevron">▼</span></div><div class="section-body">`;
    for (let qi = 0; qi < 4; qi++) h += renderWQ(ri, qi);
    if (ri === 1)
      h += renderStandings("halftime") + renderHT() + renderStaffThanks();
    else if (ri === 3) h += renderStandings("final") + renderFW();
    if (BONUS_ROUNDS.has(ri)) h += renderBQ(ri);
    if (ri < 3) h += renderBanter("round", "rbot-" + ri, {}); // outro after every round except the last
    h += `</div></div>`;
  }

  h += `<div class="section ${collapsedSections.has("sec-final") ? "collapsed" : ""}" id="sec-final"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-final')"><h2>${ICON_FLAG} Final Results</h2><span class="chevron">▼</span></div><div class="section-body">${renderFinalResults()}</div></div>`;

  h += `<div class="section ${collapsedSections.has("sec-craftprize") ? "collapsed" : ""}" id="sec-craftprize"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-craftprize')"><h2>${ICON_BEER} Craft Prize Drawing</h2><span class="chevron">\u25BC</span></div><div class="section-body">${renderCraftPrizeBlock()}</div></div>`;

  h += `<div class="section ${collapsedSections.has("sec-export") ? "collapsed" : ""}" id="sec-export"><div class="section-header" role="button" tabindex="0" onclick="toggleSection('sec-export')"><h2>Export &amp; Data</h2><span class="chevron">▼</span></div><div class="section-body">
    <div class="export-bar"><button class="btn" onclick="exportXLSXBackup()">${ICON_SHEET} XLSX</button><button class="btn" onclick="exportPDF()">${ICON_PDF} PDF</button><a class="btn" href="https://app.jotform.com/261954293403156" target="_blank" rel="noopener noreferrer">${ICON_LINK} JD Upload Form</a></div>
    <div class="export-prompt" id="exportPrompt"><p>Export complete. Clear session?</p><div style="display:flex;gap:8px;"><button class="btn btn-accent" onclick="startNewGame();">Yes</button><button class="btn" onclick="document.getElementById('exportPrompt').classList.remove('show');">No</button></div></div>
    <div style="margin-top:14px;text-align:center;"><button class="btn btn-danger" onclick="confirmClearSession()">${ICON_TRASH} Clear Session</button></div>
  </div></div>`;

  m.innerHTML = h;
  // Keeps --mini-progress-h in sync with .mini-progress's real rendered height, the same way
  // --header-h/--mobile-dock-h already are elsewhere — used by .section/.question-block/
  // .special-section's scroll-margin-top (styles.css) so jumpToSection/jumpToFirstUnanswered
  // never lands a target underneath this bar, which is sticky wherever it scrolls to. A plain
  // measurement here (not a ResizeObserver) is enough: .mini-progress is this function's own
  // markup, entirely replaced on every call, so this already re-measures it exactly when its
  // content (and so its height) can actually change.
  document.documentElement.style.setProperty(
    "--mini-progress-h",
    (m.querySelector(".mini-progress")?.offsetHeight || 0) + "px",
  );
  const anchorEl =
    anchorBefore === undefined ? null : m.querySelector(anchorSel);
  // Puts the anchor back at the exact on-screen offset it had before the re-render. Reading
  // getBoundingClientRect() here forces layout, so the comparison is against fully settled
  // post-render geometry rather than a stale guess. Whatever the difference is — content above
  // changing height, a badge rewrapping, rows re-sorting — it gets subtracted straight out of
  // the scroll position, so the anchor cannot visually move. Returns nothing and does nothing
  // when there's no anchor; callers fall back to the raw sy/wy restore below.
  const pinAnchor = () => {
    if (!anchorEl) return false;
    const delta = anchorEl.getBoundingClientRect().top - anchorBefore;
    // Sub-pixel noise is not worth a scroll write (and writing it back can itself round the
    // other way, which is how a "correction" turns into a slow drift over many taps).
    if (Math.abs(delta) < 0.5) return true;
    // Apply to whichever scroller can actually absorb it: #mainContent owns the scroll on
    // desktop, the window does on mobile. Taking the container's real applied movement (rather
    // than assuming it took the whole delta) means hitting its top/bottom clamp just passes the
    // remainder on to the window instead of silently dropping it.
    const prev = m.scrollTop;
    m.scrollTop = prev + delta;
    const rest = delta - (m.scrollTop - prev);
    if (Math.abs(rest) >= 0.5) window.scrollBy(0, rest);
    return true;
  };
  // Restore synchronously so the browser never paints a frame at the wrong offset. (Both
  // branches force layout while JS is still running, so no jump is ever visible.)
  if (!pinAnchor()) {
    m.scrollTop = sy;
    if (wy) window.scrollTo(0, wy);
  }
  // Re-assert after layout settles (fonts/container-queries) — same target, so no visible motion.
  requestAnimationFrame(() => {
    if (!pinAnchor()) {
      m.scrollTop = sy;
      if (wy) window.scrollTo(0, wy);
    }
    refreshPointerHover();
  });
}
// Which round the host is presumably actively working on: the first one that isn't fully
// scored yet. Based on scoring state, not scroll position — so it reads the same regardless
// of where in the page the host has scrolled to (e.g. up to check Teams, or ahead to Final
// Results), which is simpler and more useful than trying to detect "what's on screen".
function currentProgressSummary() {
  if (!gameState.teams.length) return null;
  for (let ri = 0; ri < 4; ri++) {
    const rp = roundProgress(ri);
    if (rp.done < rp.total) return { ri, done: rp.done, total: rp.total };
  }
  // Complete: carry the game-wide total rather than the 0/0 this used to return, so the
  // finished bar can show the same scored/total figure the per-round bar was showing a
  // moment earlier instead of jumping to a sentence.
  let all = 0;
  for (let ri = 0; ri < 4; ri++) all += roundProgress(ri).total;
  return { ri: null, done: all, total: all };
}
// Shared by jumpToSection/jumpToFirstUnanswered below: scrolls to whatever matches selector.
// It used to also ring the target with a .jump-pulse cyan box-shadow that beat twice over 4.4s.
// That is gone at the host's request, along with its CSS: the smooth scroll itself already
// shows where the jump landed — you watch it arrive — so the ring was restating something the
// motion had just said, and it kept going for seconds after the host had started reading the
// row it pointed at. requestAnimationFrame stays: the callers re-render first, so the element
// this looks up does not exist until after that render.
function scrollToJumpTarget(selector) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
function jumpToSection(id) {
  collapsedSections.delete(id);
  renderAll();
  scrollToJumpTarget("#" + id);
}
// Tapping the mini-progress bar used to just jump to the current round's section header,
// leaving the host to scroll and expand their way to whatever's actually unscored inside it.
// This finds the first unanswered item within that round instead — in the same order it's
// rendered (Q1-4, then Halftime/Final Wager on round 2/4, then the Bonus Question on round 1/3)
// — and expands both the round section AND that item's own block if either is collapsed, same
// as jumpToSection does for a single section. Lands on the TOP of that item's own block (its
// "X left" badge included) rather than a specific team's row inside it — .question-block/
// .special-section's own scroll-margin-top (styles.css) keeps that badge clear of the sticky
// header instead of landing right underneath it.
function jumpToFirstUnanswered() {
  const s = currentProgressSummary();
  if (!s || s.ri == null) return jumpToSection("sec-final");
  const ri = s.ri,
    n = gameState.teams.length;
  let targetSel = null;
  for (let qi = 0; qi < 4 && !targetSel; qi++) {
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager !== undefined && a.correct !== undefined) done++;
    }
    if (done < n) {
      targetSel = "#qblock-" + ri + "-" + qi;
      collapsedQuestions.delete(ri + "-" + qi);
    }
  }
  if (!targetSel && (ri === 1 || ri === 3)) {
    const type = ri === 1 ? "halftime" : "final";
    const store = ri === 1 ? gameState.halftime : gameState.finalWager;
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      const d = store[ti];
      if (d && d.wager != null && d.wager !== "" && d.correct != null) done++;
    }
    if (done < n) {
      targetSel = "#swblock-" + type;
      collapsedSpecialWagers.delete(type);
    }
  }
  if (!targetSel && BONUS_ROUNDS.has(ri)) {
    let done = 0;
    for (let ti = 0; ti < n; ti++) {
      if (gameState.rounds[ri].bonus[ti] != null) done++;
    }
    if (done < n) {
      targetSel = "#bqblock-" + ri;
      collapsedBonusQuestions.delete("b" + ri);
    }
  }
  const sectionId = "sec-r" + (ri + 1);
  collapsedSections.delete(sectionId);
  renderAll();
  scrollToJumpTarget(targetSel || "#" + sectionId);
}
// visible: false renders the exact same markup the real, scored-at-least-once state uses (never
// a guessed/simplified placeholder) but with the .mp-pending class, which visibility:hidden's
// the whole thing while still letting it claim its real layout height — see the call site in
// renderLeft() for why. visibility:hidden also drops it out of tab order/the accessibility tree
// on its own, so no extra aria-hidden/tabindex handling is needed for the pending state.
function renderMiniProgress(visible) {
  const s = currentProgressSummary();
  if (!s) return "";
  const pendingCls = visible ? "" : " mp-pending";
  if (s.ri == null) {
    return `<div class="mini-progress mp-complete${pendingCls}" role="button" tabindex="0" onclick="jumpToSection('sec-final')">
      <span class="mp-label">${ICON_DONE} ${s.done}/${s.total} 100% - Jump to Final Results</span>
    </div>`;
  }
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return `<div class="mini-progress${pendingCls}" role="button" tabindex="0" onclick="jumpToFirstUnanswered()">
    <span class="mp-round ${ROUND_COLORS[s.ri]}">Round ${s.ri + 1}</span>
    <span class="mp-count">${s.done}/${s.total} scored</span>
    <div class="mp-bar"><div class="mp-fill" style="width:${pct}%"></div></div>
    <span class="mp-pct">${pct}%</span>
  </div>`;
}
function renderQStatsRow(s) {
  if (!s.done) return "";
  return `<span class="q-stats-row">
    <span class="q-stat q-stat-correct">${CHECK_ICON_SVG} ${s.correct}/${s.done} (${s.correctPct}%)</span>
    <span class="q-stat q-stat-incorrect">${ICON_INCORRECT} ${s.incorrect}/${s.done} (${s.incorrectPct}%)</span>
  </span>`;
}
function renderWQ(ri, qi) {
  const wagers = ROUND_WAGERS[ri];
  const qs = qScored(ri, qi);
  const beer = isBeerRound(ri, qi);
  const qKey = ri + "-" + qi;
  const isCollapsed = collapsedQuestions.has(qKey);
  // Crowd-Wisdom Percentage (Advanced Settings): shows/hides the live
  // correct/incorrect percentage next to Sort/Reset below — see renderQStatsRow.
  const qResultToggle = !!loadPrefs().qResultToggle;

  // Block-level state class
  let blockCls = "question-block";
  if (beer) blockCls += " beer-round";
  else if (qs.total > 0 && qs.done === qs.total) blockCls += " q-done";
  else if (qs.done > 0) blockCls += " q-active";
  if (isCollapsed) blockCls += " q-collapsed";

  const badgeCls = beer
    ? "q-badge q-beer"
    : qs.done === qs.total
      ? "q-badge q-complete"
      : "q-badge q-remaining";
  const badgeText =
    qs.total === 0
      ? ""
      : beer
        ? `${ICON_BEER} Beer Round!`
        : qs.done === qs.total
          ? `${ICON_DONE} Done`
          : qs.total - qs.done + " left";

  let h = `<div class="${blockCls}" id="qblock-${ri}-${qi}">`;

  // Collapsible header
  h += `<div class="q-header">
    <div class="q-header-left" role="button" tabindex="0" onclick="toggleQuestion(${ri},${qi})">
      <span class="q-chevron">▼</span>
      <div class="question-title">
        <span>Q${qi + 1}</span>
        ${qs.total ? `<span class="${badgeCls}">${badgeText}</span>` : ""}
      </div>
    </div>
    <div class="q-header-right">
      ${qResultToggle ? renderQStatsRow(scoreBreakdown(gameState.rounds[ri].questions[qi], gameState.teams.length)) : ""}
      <button class="q-sort-btn${questionSortOrder[qKey] ? " active" : ""}" onclick="sortQuestion(${ri},${qi})" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button>
      <button class="q-reset-btn" onclick="resetQuestionSort(${ri},${qi})" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button>
    </div>
  </div>`;

  // Body (collapsible)
  h += `<div class="q-body">`;
  const entryOrder = gameState.teams.map((_, i) => i);
  let teamOrder = questionSortOrder[qKey]
    ? questionSortOrder[qKey].filter((ti) => ti < gameState.teams.length)
    : entryOrder;
  if (questionSortOrder[qKey]) {
    // include any teams added after the sort was taken (e.g. new team) at the end
    entryOrder.forEach((ti) => {
      if (!teamOrder.includes(ti)) teamOrder.push(ti);
    });
  }
  teamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const ans = gameState.rounds[ri].questions[qi][ti] || {};
    const uw = usedW(ti, ri);
    const sel = ans.wager;
    const hasW = sel !== undefined,
      hasR = ans.correct !== undefined;
    const isFlash =
      lastAction &&
      lastAction.ri === ri &&
      lastAction.qi === qi &&
      lastAction.ti === ti;
    const isBeerFlash =
      lastAction &&
      lastAction.ri === ri &&
      lastAction.qi === qi &&
      lastAction.beerRound &&
      !isFlash;
    let ptsHtml;
    if (hasW && hasR) {
      const p = ans.correct ? ans.wager : 0;
      ptsHtml =
        p > 0
          ? `<span class="ta-pts pts-pos">+${p}</span>`
          : `<span class="ta-pts pts-nil">0</span>`;
    } else ptsHtml = `<span class="ta-pts pts-zero">\u2014</span>`;

    let rowCls = "team-answer";
    if (isBeerFlash) rowCls += " beer-flash";
    else if (isFlash) rowCls += " flash";

    h += `<div class="${rowCls}" data-ta="${ri}-${qi}-${ti}"><span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} — tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span><div class="ta-wagers">`;
    wagers.forEach((w) => {
      const isSel = sel === w,
        isUsed = !isSel && uw.some((u) => u.wager === w && u.qi !== qi);
      let cls = "wager-btn",
        badge = "";
      if (isSel && ans.correct === true) {
        cls += " correct";
        badge = `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>`;
      } else if (isSel && ans.correct === false) {
        cls += " incorrect";
        badge = `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>`;
      } else if (isUsed) cls += " used";
      h += `<button class="${cls}" onclick="cycleW(${ri},${qi},${ti},${w})" ${isUsed ? "disabled" : ""}>${w}${badge}</button>`;
    });
    h += `</div>${ptsHtml}</div>`;
  });
  // Banter lives inside .q-body (not after it) so collapsing the question via CSS
  // (.q-collapsed .q-body{display:none}) hides the banter along with the rest of
  // the body instead of leaving it visible as an orphaned sibling.
  const v = qVerdict(ri, qi);
  h += renderBanter(v, `q-${ri}-${qi}-${v}`, { sm: true });
  h += `</div>`;
  h += `</div>`;
  return h;
}

function toggleQuestion(ri, qi) {
  const key = ri + "-" + qi;
  if (collapsedQuestions.has(key)) collapsedQuestions.delete(key);
  else collapsedQuestions.add(key);
  const el = document.getElementById("qblock-" + ri + "-" + qi);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("q-collapsed");
  });
}
function sortQuestion(ri, qi) {
  const key = ri + "-" + qi;
  const answered = (ti) => {
    const a = gameState.rounds[ri].questions[qi][ti];
    return !!(a && a.wager !== undefined && a.correct !== undefined);
  };
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetQuestionSort(ri, qi) {
  delete questionSortOrder[ri + "-" + qi];
  renderAll();
}
function sortBonusQuestion(ri) {
  const key = "b" + ri;
  const answered = (ti) => gameState.rounds[ri].bonus[ti] != null;
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetBonusQuestionSort(ri) {
  delete questionSortOrder["b" + ri];
  renderAll();
}
function sortSpecialWager(type) {
  const key = "sw-" + type;
  const data = type === "final" ? gameState.finalWager : gameState.halftime;
  const answered = (ti) => {
    const d = data[ti];
    return !!(d && d.wager != null && d.wager !== "" && d.correct != null);
  };
  questionSortOrder[key] = gameState.teams
    .map((_, ti) => ti)
    .sort((a, b) => {
      const aa = answered(a) ? 1 : 0,
        bb = answered(b) ? 1 : 0;
      return aa - bb || a - b;
    });
  renderAll();
}
function resetSpecialWagerSort(type) {
  delete questionSortOrder["sw-" + type];
  renderAll();
}
function toggleBonusQ(ri) {
  const key = "b" + ri;
  if (collapsedBonusQuestions.has(key)) collapsedBonusQuestions.delete(key);
  else collapsedBonusQuestions.add(key);
  const el = document.getElementById("bqblock-" + ri);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("bq-collapsed");
  });
}

function renderBQ(ri) {
  const n = gameState.teams.length;
  let subDone = 0;
  for (let ti = 0; ti < n; ti++) {
    if (gameState.rounds[ri].bonus[ti] != null) subDone++;
  }
  const beer = isBonusBeerRound(ri);
  let badge = "";
  if (n) {
    if (beer)
      badge =
        `<span class="q-badge q-badge-lg q-beer">${ICON_BEER} Beer Round!</span>`;
    else if (subDone === n)
      badge = `<span class="q-badge q-badge-lg q-complete">${ICON_DONE} Done</span>`;
    else
      badge = `<span class="q-badge q-badge-lg q-remaining">${n - subDone} left</span>`;
  }
  const isCollapsedBQ = collapsedBonusQuestions.has("b" + ri);
  let blockCls = "question-block";
  if (beer) blockCls += " beer-round";
  else if (n > 0 && subDone === n) blockCls += " q-done";
  else if (subDone > 0) blockCls += " q-active";
  if (isCollapsedBQ) blockCls += " bq-collapsed";
  const bqStyle = BONUS_Q_STYLE[ri] || { cls: "" };
  const bqKey = "b" + ri;
  let h = `<div class="${blockCls}" id="bqblock-${ri}"><div class="q-header"><div class="q-header-left" role="button" tabindex="0" onclick="toggleBonusQ(${ri})"><span class="q-chevron">\u25BC</span><div class="question-title bonus-title"><div class="bonus-title-top"><span class="${bqStyle.cls}">Q5</span>${badge}</div><span class="${bqStyle.cls} bonus-title-sub">BONUS (0-4 \u00D7 5)</span></div></div><div class="q-header-right"><button class="q-sort-btn${questionSortOrder[bqKey] ? " active" : ""}" onclick="sortBonusQuestion(${ri})" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button><button class="q-reset-btn" onclick="resetBonusQuestionSort(${ri})" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button></div></div><div class="q-body">`;
  const bqEntryOrder = gameState.teams.map((_, i) => i);
  let bqTeamOrder = questionSortOrder[bqKey]
    ? questionSortOrder[bqKey].filter((ti) => ti < gameState.teams.length)
    : bqEntryOrder;
  if (questionSortOrder[bqKey]) {
    bqEntryOrder.forEach((ti) => {
      if (!bqTeamOrder.includes(ti)) bqTeamOrder.push(ti);
    });
  }
  bqTeamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const v = gameState.rounds[ri].bonus[ti];
    const submitted = v != null;
    const c = submitted ? v : 0;
    let ptsHtml;
    if (!submitted) ptsHtml = `<span class="bonus-pts pts-zero">\u2014</span>`;
    else if (c > 0)
      ptsHtml = `<span class="bonus-pts pts-pos">+${c * 5}</span>`;
    // No tick before the 0. A checkmark reads as "correct" everywhere else in this app, and a
    // team that got none of the four bonus questions right is the opposite of that — the mark
    // was only ever there to say "submitted, not skipped", which .submitted-zero's own styling
    // (and the row's .is-submitted state) already carry.
    else ptsHtml = `<span class="bonus-pts submitted-zero">0</span>`;
    const choices = [0, 1, 2, 3, 4]
      .map((k) => {
        const isSel = submitted && c === k;
        let cls = "bonus-choice-btn",
          cbadge = "";
        if (isSel && k === 0) {
          cls += " incorrect";
          cbadge = `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>`;
        } else if (isSel && k > 0) {
          cls += " correct";
          cbadge = `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>`;
        }
        return `<button class="${cls}" onclick="setB(${ri},${ti},${k})" title="${k} correct \u2014 +${k * 5} pts \u2014 tap again to unselect">${k}${cbadge}</button>`;
      })
      .join("");
    h += `<div class="bonus-row${submitted ? " is-submitted" : ""}"><span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} \u2014 tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span>
      <div class="bonus-right"><div class="bonus-choice">${choices}</div>
      ${ptsHtml}</div></div>`;
  });
  // Only a Beer Round gets banter here — "next question" doesn't fit since a bonus question
  // is immediately followed by a new round, not another question.
  if (beer) h += renderBanter("beer", `bq-${ri}-beer`, { sm: true });
  return h + `</div></div>`;
}

// Halftime and final wagers are identical except for range, labels and setters.
function renderSpecialWager(type) {
  const isFinal = type === "final";
  const data = isFinal ? gameState.finalWager : gameState.halftime;
  const max = isFinal ? 20 : 10;
  const sectionCls = isFinal
    ? "special-section final-wager"
    : "special-section";
  const titleSub = isFinal ? "BONUS WAGER (1-20)" : "BONUS WAGER (1-10)";
  const wSet = isFinal ? "setFW" : "setHW",
    cSet = isFinal ? "setFC" : "setHC";
  const beer = isSpecialBeerRound(type);
  const swN = gameState.teams.length;
  let swDone = 0;
  for (let ti = 0; ti < swN; ti++) {
    const d = data[ti];
    if (d && d.wager != null && d.wager !== "" && d.correct != null) swDone++;
  }
  let swBadge = "";
  if (swN) {
    if (beer)
      swBadge = `<span class="q-badge q-beer">${ICON_BEER} Beer Round!</span>`;
    else if (swDone === swN)
      swBadge = `<span class="q-badge q-complete">${ICON_DONE} Done</span>`;
    else
      swBadge = `<span class="q-badge q-remaining">${swN - swDone} left</span>`;
  }
  const swCollapsed = collapsedSpecialWagers.has(type);
  const swKey = "sw-" + type;
  // Same "Crowd-Wisdom Percentage" gate the regular Q1-4 rows use (see
  // renderQStatsRow's other call site) — this row was showing the correct/incorrect tally unconditionally,
  // ignoring the toggle entirely, so turning the setting Off didn't hide it here like it does
  // everywhere else.
  const swResultToggle = !!loadPrefs().qResultToggle;
  let h = `<div class="${sectionCls}${beer ? " beer-round" : ""}${swCollapsed ? " sw-collapsed" : ""}" id="swblock-${type}"><div class="sw-header"><div class="sw-header-left" role="button" tabindex="0" onclick="toggleSpecialWager('${type}')"><span class="q-chevron">\u25BC</span><h3 class="sw-title"><span class="sw-title-row">Q5${swBadge}</span><span class="sw-title-sub">${titleSub}</span></h3></div><div class="q-header-right">${swResultToggle ? renderQStatsRow(scoreBreakdown(data, swN)) : ""}<button class="q-sort-btn${questionSortOrder[swKey] ? " active" : ""}" onclick="sortSpecialWager('${type}')" title="Move currently unanswered teams to the top (one-time, click again to re-sort)" aria-label="Sort by answer">${ICON_SORT}<span class="btn-label">Sort</span></button><button class="q-reset-btn" onclick="resetSpecialWagerSort('${type}')" title="Restore entry order" aria-label="Reset sort order">${ICON_RESET}<span class="btn-label">Reset</span></button></div></div>`;
  // No "Beer Round! Everyone got it right!" stripe under the header. The header's own Beer Round
  // badge is two inches away and says the same thing, and the whole block is already washed gold
  // with a gold border — three statements of one fact. Same call, same reasoning, as removing the
  // bonus questions' version of this line in v18.57.
  h += `<div class="sw-body">`;
  const swEntryOrder = gameState.teams.map((_, i) => i);
  let swTeamOrder = questionSortOrder[swKey]
    ? questionSortOrder[swKey].filter((ti) => ti < gameState.teams.length)
    : swEntryOrder;
  if (questionSortOrder[swKey]) {
    swEntryOrder.forEach((ti) => {
      if (!swTeamOrder.includes(ti)) swTeamOrder.push(ti);
    });
  }
  swTeamOrder.forEach((ti) => {
    const t = gameState.teams[ti];
    const d = data[ti] || {};
    const w = d.wager != null && d.wager !== "" ? +d.wager : null;
    let pts = `<span class="ta-pts pts-zero">\u2014</span>`;
    if (w != null && d.correct != null) {
      const p = d.correct ? w : -w;
      pts = `<span class="ta-pts ${p > 0 ? "pts-pos" : p < 0 ? "pts-neg" : "pts-nil"}">${p > 0 ? "+" : ""}${p}</span>`;
    }
    let selOpts = `<option value=""${w == null ? " selected" : ""}>\u2014</option>`;
    for (let n = 1; n <= max; n++) {
      selOpts += `<option value="${n}"${w === n ? " selected" : ""}>${n}</option>`;
    }
    const selectHtml = `<select class="sw-select" aria-label="Wager amount (1\u2013${max})" onchange="${wSet}(${ti},this.value)">${selOpts}</select>`;
    h += `<div class="special-wager-row" data-ta="${type}-${ti}">
      <span class="ta-name ta-name-clickable" role="button" tabindex="0" title="${esc(t.name || "Team " + (ti + 1))} \u2014 tap to view team report" onclick="openAudit(${ti})">${esc(t.name || "T" + (ti + 1))}</span>
      ${selectHtml}
      <div class="ta-result">
        <button class="result-btn ${d.correct === true ? "correct-sel" : ""}" onclick="${cSet}(${ti},true)" aria-label="Mark correct">${ICON_MARK_CORRECT}${d.correct === true ? `<span class="wager-badge bg-correct">${CORRECT_BADGE_SVG}</span>` : ""}</button>
        <button class="result-btn ${d.correct === false ? "incorrect-sel" : ""}" onclick="${cSet}(${ti},false)" aria-label="Mark incorrect">${ICON_MARK_INCORRECT}${d.correct === false ? `<span class="wager-badge bg-incorrect">${ICON_INCORRECT}</span>` : ""}</button>
      </div>
      ${pts}
    </div>`;
  });
  // Only a Beer Round gets banter here — "next question" doesn't fit since this wager is
  // immediately followed by a new round (or Final Results), not another question.
  if (beer) h += renderBanter("beer", `sw-${type}-beer`, { sm: true });
  return h + `</div></div>`;
}
function toggleSpecialWager(type) {
  if (collapsedSpecialWagers.has(type)) collapsedSpecialWagers.delete(type);
  else collapsedSpecialWagers.add(type);
  const el = document.getElementById("swblock-" + type);
  toggleClassPreserveScroll(document.getElementById("mainContent"), el, () => {
    if (el) el.classList.toggle("sw-collapsed");
  });
}
function renderHT() {
  return renderSpecialWager("halftime");
}
function renderFW() {
  return renderSpecialWager("final");
}

function toggleSidebar() {
  // A just-finished swipe on the peek strip or the sheet's grab handle (see the drag IIFE near
  // the bottom of this file) fires a click on release — swallow that one so the drag doesn't
  // also re-toggle right back.
  if (suppressNextSheetClick) {
    suppressNextSheetClick = false;
    return;
  }
  const sb = document.getElementById("sidebar");
  const open = sb.classList.toggle("open");
  document.getElementById("sidebarBackdrop")?.classList.toggle("show", open);
  const peek = document.getElementById("mobileScoresPeek");
  if (peek) {
    peek.setAttribute("aria-expanded", String(open));
    peek.setAttribute("aria-label", open ? "Close scores" : "Open scores");
    peek.classList.toggle("msp-hidden", open);
  }
}

function renderSB() {
  const body = document.getElementById("sidebarBody");
  if (!body) return;
  // .scores-list — not sidebarBody — is the element that actually scrolls (see its own CSS
  // comment in styles.css): sidebarBody is a flex column sized to exactly fit its children
  // (sort-controls + sort-mode-label + scores-list), so its own scrollTop is always 0 and a
  // write to it is a no-op. buildScores() below rebuilds .scores-list from scratch on every
  // render — a brand-new element via innerHTML — which silently resets ITS scrollTop to 0
  // unless something restores it on THAT element specifically. Nothing did: every tap on Entry/
  // Shuffle/Asc/Desc (and, at enough teams to actually overflow the list, every craft-prize tap
  // too) was snapping the scores list back to its very top, which read as "the view moves" —
  // sidebarBody's own scrollTop, the thing this used to read/write, never moved at all.
  const oldList = body.querySelector(".scores-list");
  const sy = oldList ? oldList.scrollTop : 0;
  // Anchor on whatever score-row was just tapped (see lastSBClickAnchorSel / the shared click
  // listener above), the same technique renderLeft's pinAnchor uses and for the same reason —
  // see the comment on renderSB above.
  const anchorSel = lastSBClickAnchorSel;
  lastSBClickAnchorSel = null;
  const anchorBefore = anchorSel
    ? body.querySelector(anchorSel)?.getBoundingClientRect().top
    : undefined;
  body.innerHTML = `<div class="sort-controls">
    <button class="sort-btn ${scoreSortMode === "entry" ? "active" : ""}" onclick="setSortMode('entry')">Entry</button>
    <button class="sort-btn ${scoreSortMode === "random" ? "active" : ""}" onclick="setSortMode('random')" title="Shuffle" aria-label="Shuffle">${ICON_SHUFFLE}<span class="sr-only">Shuffle</span></button>
    <button class="sort-btn ${scoreSortMode === "asc" ? "active" : ""}" onclick="setSortMode('asc')">${ICON_ARROW_UP} Asc</button>
    <button class="sort-btn ${scoreSortMode === "desc" ? "active" : ""}" onclick="setSortMode('desc')">${ICON_ARROW_DOWN} Desc</button>
  </div><div class="sort-mode-label">${sortModeLabel()}</div>${buildScores()}`;
  const list = body.querySelector(".scores-list");
  const anchorEl =
    anchorBefore === undefined ? null : body.querySelector(anchorSel);
  // Puts the anchor back at the exact on-screen offset it had before the re-render — see
  // renderLeft's pinAnchor for the full reasoning. Returns false (never moving anything) when
  // there's no anchor or no list, so callers fall back to the raw sy restore below.
  const pinAnchor = () => {
    if (!anchorEl || !list) return false;
    const delta = anchorEl.getBoundingClientRect().top - anchorBefore;
    // list is a brand-new element (buildScores() rebuilt it via innerHTML above), not the same
    // node sy was read from — its scrollTop starts at 0, so this has to be sy+delta, not the
    // += renderLeft's pinAnchor uses on #mainContent, which (unlike .scores-list) persists
    // across the render and so already carries sy into this line on its own.
    if (Math.abs(delta) < 0.5) {
      list.scrollTop = sy;
      return true;
    }
    list.scrollTop = sy + delta;
    return true;
  };
  if (!pinAnchor() && list) list.scrollTop = sy;
  requestAnimationFrame(() => {
    if (!pinAnchor() && list) list.scrollTop = sy;
    refreshPointerHover();
  });
}

function buildScores() {
  if (!gameState.teams.length)
    return '<div class="scores-list" style="color:var(--text-muted);padding:12px;">Add teams to begin.</div>';
  const rm = rankMap();
  const order = getDisplayOrder();
  let h = '<div class="scores-list">';
  order.forEach((ti) => {
    const t = gameState.teams[ti],
      tot = grandTotal(ti),
      rank = rm[ti],
      rc = rank <= 3 ? "sr-rank-" + rank : "";
    const r1 = roundSub(ti, 0),
      r2 = roundSub(ti, 1),
      r3 = roundSub(ti, 2),
      r4 = roundSub(ti, 3);
    const ht = htPts(ti),
      fw = fwPts(ti),
      bi = t.bonusItem ? 5 : 0,
      nj = t.njcb ? 3 : 0,
      adj = t.adjustment || 0;
    const tip = [
      "R1:" + r1,
      "HT:" + (ht >= 0 ? "+" : "") + ht,
      "R2:" + r2,
      "R3:" + r3,
      "FW:" + (fw >= 0 ? "+" : "") + fw,
      "R4:" + r4,
    ];
    if (bi) tip.push("Item:+5");
    if (nj) tip.push("NJCB:+3");
    if (adj) tip.push("Adj:" + (adj > 0 ? "+" : "") + adj);
    const cb = t.craftPrize ? " cb-prize" : "";
    const cbTag = t.craftPrize
      ? ` <span class="cb-tag">${ICON_BEER} CB Prize</span>`
      : "";
    h += `<div class="score-row${cb}${rc ? " " + rc : ""}" data-ti="${ti}" title="${tip.join(" | ")}"><span class="sr-rank ${rc}">${rank}</span><span class="sr-name sr-name-clickable" role="button" tabindex="0" title="Tap to set or clear the Craft Beer prize winner" onclick="toggleCraftPrize(${ti})">${esc(t.name || "Team " + (ti + 1))}${cbTag}</span><span class="sr-score">${tot}</span></div>`;
  });
  return h + "</div>";
}

function addTeam() {
  if (gameState.teams.length >= MAX_TEAMS) return;
  gameState.teams.push(freshTeam(""));
  autosave();
  renderAll();
}
// Shift all integer keys above the removed index down by one (returns a new map).
function reindexAfterRemoval(map, ti) {
  const out = {};
  for (const k in map) {
    const i = parseInt(k, 10);
    if (i < ti) out[i] = map[k];
    else if (i > ti) out[i - 1] = map[k];
  }
  return out;
}
async function removeTeam(ti) {
  const name = gameState.teams[ti]?.name || "Team " + (ti + 1);
  const msg = checkGameStarted()
    ? 'Remove "' +
      name +
      '"? This also deletes every round, bonus, and wager score already entered for them — it can’t be undone.'
    : 'Remove "' + name + '"?';
  if (!(await appConfirm(msg, { danger: true, okLabel: "Remove" }))) return;
  gameState.teams.splice(ti, 1);
  const newAdj = new Set();
  adjOpenTeams.forEach((i) => {
    if (i < ti) newAdj.add(i);
    else if (i > ti) newAdj.add(i - 1);
  });
  adjOpenTeams = newAdj;
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++)
      gameState.rounds[ri].questions[qi] = reindexAfterRemoval(
        gameState.rounds[ri].questions[qi],
        ti,
      );
    gameState.rounds[ri].bonus = reindexAfterRemoval(
      gameState.rounds[ri].bonus,
      ti,
    );
  }
  gameState.halftime = reindexAfterRemoval(gameState.halftime, ti);
  gameState.finalWager = reindexAfterRemoval(gameState.finalWager, ti);
  // Exclude Top can never cover the whole remaining roster (at least one team must stay
  // eligible for the craft prize) — a removal can push a previously-valid setting over that
  // new N-1 ceiling, so pull it back in line rather than leaving a stale, now-invalid number.
  const maxExcludeN = Math.max(1, gameState.teams.length - 1);
  if ((gameState.meta.excludeTopN || 2) > maxExcludeN)
    gameState.meta.excludeTopN = maxExcludeN;
  autosave();
  renderAll();
}
function toggleAdj(ti) {
  if (adjOpenTeams.has(ti)) adjOpenTeams.delete(ti);
  else adjOpenTeams.add(ti);
  renderLeft();
}
function adjPts(ti, d) {
  if (!gameState.teams[ti]) return;
  gameState.teams[ti].adjustment = (gameState.teams[ti].adjustment || 0) + d;
  autosave();
  renderAll();
}
function cycleW(ri, qi, ti, w) {
  if (!canScore()) return;
  const q = gameState.rounds[ri].questions[qi];
  const a = q[ti] || {};
  if (a.wager === w) {
    // same wager re-clicked: correct -> incorrect -> fully cleared (remove the slot entirely)
    if (a.correct === true) a.correct = false;
    else delete q[ti];
  } else {
    // blocked duplicate returns without ever creating an empty slot
    if (usedW(ti, ri).find((u) => u.wager === w && u.qi !== qi)) return;
    a.wager = w;
    a.correct = true;
    q[ti] = a;
  }
  // Say what just happened. The row updates visually, but focus never moves, so without this a
  // screen-reader user gets nothing back from the tap that just scored a team.
  const now = q[ti];
  announce(
    !now
      ? `${teamLabel(ti)}, round ${ri + 1} question ${qi + 1} cleared`
      : `${teamLabel(ti)}, round ${ri + 1} question ${qi + 1}, wager ${now.wager}, ${now.correct ? "correct, plus " + now.wager : "incorrect, 0"} points. Total ${grandTotal(ti)}`,
  );
  const wasBeer = beerRoundToasted.has(ri + "-" + qi);
  lastAction = { ri, qi, ti };
  gameState.gameStarted = true;
  autosave();
  // Check beer round BEFORE re-render so we can set beer flash context
  const nowBeer = isBeerRound(ri, qi);
  if (nowBeer && !wasBeer) {
    lastAction.beerRound = true;
  }
  renderAll();
  checkBeerRound(ri, qi);
  setTimeout(() => {
    lastAction = null;
  }, 900);
}
function markAll(ri, qi, correct) {
  if (!canScore()) return;
  announce(
    `All wagered teams marked ${correct ? "correct" : "incorrect"} for round ${ri + 1} question ${qi + 1}`,
  );
  const wasBeer = beerRoundToasted.has(ri + "-" + qi);
  gameState.teams.forEach((_, ti) => {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined) a.correct = correct;
  });
  lastAction = null;
  gameState.gameStarted = true;
  autosave();
  renderAll();
  if (correct && !wasBeer) checkBeerRound(ri, qi);
}
// Accepts 1-5 letters, optional dash, 1-4 digits (e.g. "AB-123", "ABCDE1234").
function isQuizIdValid(v) {
  const s = (v || "").trim();
  return /^[A-Za-z]{1,5}-?\d{1,4}$/.test(s);
}
// Required-ness is just "something's in the field" — deliberately separate from isQuizIdValid
// so the format hint stays advisory-only and doesn't start blocking scoring on its own.
function isQuizIdEntered(v) {
  return !!(v || "").trim();
}
function isLocationValid(v) {
  return !!(v || "").trim();
}
function isHostNameValid(v) {
  return !!(v || "").trim();
}

// Guard: before the very first scoring action, a Quiz ID, Host Name, and Location must all be
// entered, and every team must have a guess. Quiz ID's format is still free-entry — it just
// has to be non-empty, not match any particular pattern. After the game has started once,
// this check is bypassed.
function canScore() {
  if (gameState.gameStarted) return true;
  // Required means entered, not "matches the pattern" — Quiz ID's format hint stays purely
  // advisory (v16.41), so a value that just doesn't look typical still satisfies this gate.
  if (!isQuizIdEntered(gameState.meta.quizId)) {
    appAlert("Please enter a Quiz ID in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  if (!isHostNameValid(gameState.meta.hostName)) {
    appAlert("Please enter a Host Name in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  if (!isLocationValid(gameState.meta.location)) {
    appAlert("Please enter a Location in Event Details before scoring begins.");
    const sec = document.getElementById("sec-meta");
    if (sec) {
      if (sec.classList.contains("collapsed"))
        sec.classList.remove("collapsed");
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderLeft();
    return false;
  }
  const missing = gameState.teams.reduce((acc, t, i) => {
    if (t.scoreGuess === "" || t.scoreGuess == null)
      acc.push(t.name || "Team " + (i + 1));
    return acc;
  }, []);
  if (missing.length === 0) return true;
  appAlert(
    "Please enter a score guess for all teams before scoring begins.\n\nMissing guess:\u00a0" +
      missing.join(", "),
  );
  // Scroll the Teams section into view so the user can fix it
  const sec = document.getElementById("sec-teams");
  if (sec) {
    if (sec.classList.contains("collapsed")) sec.classList.remove("collapsed");
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return false;
}
function setB(ri, ti, v) {
  if (!canScore()) return;
  const cur = gameState.rounds[ri].bonus[ti];
  if (cur === v) {
    delete gameState.rounds[ri].bonus[ti];
    announce(`${teamLabel(ti)}, round ${ri + 1} bonus cleared`);
  } else {
    gameState.rounds[ri].bonus[ti] = v;
    announce(
      `${teamLabel(ti)}, round ${ri + 1} bonus, ${v} of 4 correct, plus ${v * 5} points`,
    );
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function clearB(ri, ti) {
  delete gameState.rounds[ri].bonus[ti];
  autosave();
  renderAll();
}
function setHW(ti, v) {
  if (!canScore()) return;
  if (!gameState.halftime[ti]) gameState.halftime[ti] = {};
  if (("" + v).trim() === "") {
    delete gameState.halftime[ti].wager;
  } else {
    gameState.halftime[ti].wager = Math.max(1, Math.min(10, +v || 1));
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setHC(ti, v) {
  if (!canScore()) return;
  const d = gameState.halftime[ti];
  if (!d || d.wager == null || d.wager === "") return;
  /* need a wager first */ const c = d.correct;
  if (c === v) delete d.correct;
  else d.correct = v;
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setFW(ti, v) {
  if (!canScore()) return;
  if (!gameState.finalWager[ti]) gameState.finalWager[ti] = {};
  if (("" + v).trim() === "") {
    delete gameState.finalWager[ti].wager;
  } else {
    gameState.finalWager[ti].wager = Math.max(1, Math.min(20, +v || 1));
  }
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
function setFC(ti, v) {
  if (!canScore()) return;
  const d = gameState.finalWager[ti];
  if (!d || d.wager == null || d.wager === "") return;
  /* need a wager first */ const c = d.correct;
  if (c === v) delete d.correct;
  else d.correct = v;
  gameState.gameStarted = true;
  autosave();
  renderAll();
}
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    document.getElementById("confirmOverlay").classList.contains("show")
  )
    confirmDialogRespond(false);
});
// Native <input type="date"> always hands back either a valid ISO date or '' (never a
// half-typed/invalid string), so there's no parsing or validation left to do here — the
// browser's own calendar UI and keyboard navigation replace the old hand-rolled text parser.
function setGameDateISO(v) {
  if (!v) return;
  gameState.meta.date = v;
  autosave();
  renderLeft();
}
document.addEventListener("mousemove", (e) => {
  __lastPointerXY = [e.clientX, e.clientY];
});

// DRAG HANDLE
(function () {
  const handle = document.getElementById("dragHandle"),
    sidebar = document.getElementById("sidebar");
  if (!handle || !sidebar) return;
  let dragging = false,
    startX = 0,
    startW = 0;
  function onDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add("dragging");
    document.body.classList.add("col-resizing");
  }
  function onMove(e) {
    if (!dragging) return;
    let x;
    if (e.touches) {
      if (!e.touches[0]) return; // touch already lifted
      e.preventDefault(); // prevent page scroll fighting the drag
      x = e.touches[0].clientX;
    } else {
      // If mouse button was released outside the window, cancel drag
      if (typeof e.buttons !== "undefined" && e.buttons === 0) {
        onUp();
        return;
      }
      x = e.clientX;
    }
    const delta = startX - x;
    const newW = Math.max(
      200,
      Math.min(window.innerWidth * 0.6, startW + delta),
    );
    sidebar.style.width = newW + "px";
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.classList.remove("col-resizing");
    TRStore.setItem("trivRev6_sideW", sidebar.offsetWidth);
  }
  handle.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  handle.addEventListener("touchstart", onDown, { passive: false });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
  document.addEventListener("touchcancel", onUp); // reset if touch interrupted (notification, etc.)
  const saved = TRStore.getItem("trivRev6_sideW");
  if (saved) sidebar.style.width = saved + "px";
})();
bindSheetDrag(document.getElementById("mobileScoresPeek"), true, () => {
  if (!document.getElementById("sidebar")?.classList.contains("open"))
    toggleSidebar();
});
bindSheetDrag(document.getElementById("sheetGrabHandle"), false, () => {
  if (document.getElementById("sidebar")?.classList.contains("open"))
    toggleSidebar();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    const o = document.getElementById("auditOverlay");
    if (o && o.classList.contains("show")) closeAudit();
    const sb = document.getElementById("sidebar");
    if (sb && sb.classList.contains("open")) toggleSidebar();
  }
});

// Keyboard support for div/span controls styled as buttons (role="button"): Enter/Space activates them.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest('[role="button"]');
  if (!el) return;
  e.preventDefault();
  el.click();
});

/* If real storage is unavailable (opaque origin, e.g. Chrome opened from file://), warn once.
   The app still works for this session but won't autosave or offer Resume after a reload. */
(function () {
  if (TRStore.persistent) return;
  console.warn(
    "[Scorekeeper] Cross-session storage is unavailable (opaque origin). Autosave/Resume and saved preferences are disabled this session. Open this file over http://localhost (e.g. `python3 -m http.server`) or use Firefox to enable persistence.",
  );
  const n = document.createElement("div");
  n.setAttribute("role", "status");
  n.style.cssText =
    "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:560px;z-index:9999;background:#3a2a00;color:#ffe08a;border:1px solid #7a5a00;border-radius:10px;padding:10px 40px 10px 14px;font:600 12.5px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)";
  n.innerHTML =
    ICON_ALERT +
    ' <b>Autosave is off in this browser.</b> You opened this file directly, so this browser blocks storage. The game works, but it won\u2019t survive a reload. To enable Resume &amp; saved settings, serve it locally (<code style="background:rgba(0,0,0,.3);padding:1px 4px;border-radius:4px">python3 -m http.server</code> then open <code style="background:rgba(0,0,0,.3);padding:1px 4px;border-radius:4px">localhost:8000</code>) or use Firefox.';
  const x = document.createElement("button");
  x.innerHTML = X_ICON_SVG;
  x.setAttribute("aria-label", "Dismiss");
  x.style.cssText =
    "position:absolute;top:6px;right:8px;background:none;border:none;color:#ffe08a;font-size:15px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;padding:0";
  x.onclick = () => n.remove();
  n.appendChild(x);
  window.addEventListener("DOMContentLoaded", () =>
    document.body.appendChild(n),
  );
  if (document.readyState !== "loading") document.body.appendChild(n);
})();
setInterval(tickQTimer, 200);
(function initQTimer() {
  const p = loadPrefs();
  qtDurationSec = Math.max(
    QT_MIN_SEC,
    Math.min(QT_MAX_SEC, p.qtDurationSec || QT_DEFAULT_SEC),
  );
  const sel = document.getElementById("qtDurationSelect");
  if (sel) sel.value = qtDurationSec;
  qtSetDisplayText(fmtQt(qtDurationSec));
  renderQtControls();
})();

// Register the service worker so the app keeps working with no signal after it's been opened once.
// Requires http(s)/localhost — silently no-ops under file:// same as the storage warning above.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// UPDATE CHECK — checkForUpdate() sets latestVersion (declared up near APP_VERSION at the top of
// the file, not here, despite this being its only real use — applyPrefs() reads it, and runs
// synchronously at load time far earlier than this point in the file; a `let` declared here
// would still be in its temporal dead zone on that first call, throwing "Cannot access
// 'latestVersion' before initialization" the same way this file's own BONUS_Q_STYLE note (near
// the top) describes). Drives the gear icon's dot (applyPrefs below) and the "vX.X available" note under
// the version line in Settings. Quiet by design: a host running this mid-game gets an
// easy-to-miss dot, not a banner stealing attention from scoring — see the CHANGELOG entry this
// shipped with for why.
// Fetches version.json (repo root — kept in sync with APP_VERSION, see the note above it) with
// the service worker and every HTTP cache along the way bypassed on purpose: this exists
// specifically to answer "is there a real build newer than the one I'm currently running", and
// the SW's own cache — or a stale HTTP response — answering that question would always say no,
// since it'd just be reporting on itself. cache:"no-store" plus a cache-busting query string is
// belt-and-braces — the query string alone already guarantees the SW's own cache.match() (keyed
// on the exact request) never hits, since version.json was never precached under that exact URL
// to begin with (deliberately not in sw.js's SHELL_FILES).
function checkForUpdate() {
  // Returns the chain (nothing at either real call site below awaits it) purely so a test can:
  // callers that only fire-and-forget this are unaffected either way.
  return fetch("version.json?_=" + Date.now(), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.version && data.version !== APP_VERSION) {
        latestVersion = data.version;
        applyPrefs(); // cheap; picks up the gear-icon dot and version-line note below
      }
    })
    .catch(() => {}); // offline, or the venue's own WiFi down — try again next load/foreground
}
checkForUpdate();
// Re-checks when the host switches back to this tab/app after a while away — the one case a
// long-running session (a whole trivia night, easily hours) would otherwise never see a build
// that shipped after it opened, since nothing else re-runs this.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});

// Sync the Settings controls to the saved prefs once on load. applyPrefs had only ever been
// reached through renderAll(), so before the first render every control in the panel still showed
// the default baked into index.html — Row Density reading "Normal" while set to compact, Timer
// Pulse reading "Shown" while switched off, and the crossfade slider sitting at 1.2s whatever it
// had been dragged to. The values were saved correctly the whole time; only the panel was stale.
// The IIFE near the top of this file handles the root-element attributes early to avoid a flash;
// this handles the panel's own widgets, which need the DOM to exist.
if (document.readyState === "loading")
  window.addEventListener("DOMContentLoaded", () => applyPrefs());
else applyPrefs();

// Mark this page's audio as mixable before anything can play. Deliberately at load and not inside
// the drumroll tap: it has to be in force ahead of the first play to have any effect, and unlike
// building or priming an audio element it takes nothing from the device's audio session.
useAmbientAudioSession();
