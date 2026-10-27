"use strict";

const ROUND_WAGERS = [
  [1, 2, 3, 4],
  [1, 3, 5, 7],
  [2, 4, 6, 8],
  [3, 6, 9, 12],
];
// Theme Night's point budgets (perfect night = 95 without CB/Bonus extras: 10+20+30 budgets +
// 5+10+20 Q5 wagers). Round 1 matches Regular; Rounds 2 and 3 use Regular's Round 3 and 4 sets.
const THEME_ROUND_WAGERS = [
  [1, 2, 3, 4],
  [2, 4, 6, 8],
  [3, 6, 9, 12],
];
const ROUND_COLORS = ["rl-1", "rl-2", "rl-3", "rl-4"];
const BONUS_ROUNDS = new Set([0, 2]);

// Theme Night: 3 rounds, each Q1-4 (same point budgets as Regular rounds 1-3) closed by a single
// Q5 bonus WAGER instead of Regular's 4-part bonus / halftime / final. Same game-state shape
// either way (4 round slots, Round 4 simply unused), so a saved game is never lost by flipping
// the mode and every scoring loop below stays correct without knowing about the mode.
// The three Q5 wagers reuse the two existing wager stores (halftime = Round 2, finalWager =
// Round 3 in Theme Night, caps 10 and 20 already match) plus a new wager1 store for Round 1 (cap 5).
const THEME_WAGER_MAX = { wager1: 5, halftime: 10, final: 20 };
// Name That Tune: 4 rounds on Regular's point budgets (ROUND_WAGERS), every round closed by a Q5
// wager capped 5 / 10 / 15 / 20 (no 4-part bonus). Perfect night = 10+16+20+30 budgets + 50 of
// wagers = 126. Round 1 and 2 and 4 reuse the wager1 / halftime / finalWager stores (caps 5, 10 and
// 20 line up with their Regular / Theme Night caps); Round 3 gets its own wager3 store.
const TUNE_WAGER_MAX = { wager1: 5, halftime: 10, wager3: 15, final: 20 };
// What a team has to name in each Name That Tune round (shown next to "Round N").
const TUNE_ROUND_TITLES = ["Song Title", "Artist", "Song Title", "Song Title & Artist"];
const GAME_MODES = ["regular", "theme", "tune"];
const MODE_NAMES = { regular: "Regular Trivia", theme: "Theme Night", tune: "Name That Tune" };
// Highest score guess a team may enter: a perfect night in that mode (Regular's 146 also covers
// its 4-part bonuses).
const GUESS_LIMITS = { regular: 146, theme: 95, tune: 126 };
function gameMode() {
  const m = gameState.meta.mode;
  return GAME_MODES.includes(m) ? m : "regular";
}
function gameModeName(mode) {
  return MODE_NAMES[mode || gameMode()];
}
function guessLimit() {
  return GUESS_LIMITS[gameMode()];
}
function isTheme() {
  return gameState.meta.mode === "theme";
}
function isTune() {
  return gameState.meta.mode === "tune";
}
// Theme Night and Name That Tune both close every round with a Q5 wager (no 4-part bonus).
function hasQ5Wagers() {
  return isTheme() || isTune();
}
function roundWagers(ri) {
  return isTheme() ? THEME_ROUND_WAGERS[ri] || [] : ROUND_WAGERS[ri];
}
function roundCount() {
  return isTheme() ? 3 : 4;
}
function hasBonusQ(ri) {
  return !hasQ5Wagers() && BONUS_ROUNDS.has(ri);
}
// "Round 1", or in Name That Tune "Round 1 - Song Title".
function roundTitle(ri) {
  return "Round " + (ri + 1) + (isTune() ? " - " + TUNE_ROUND_TITLES[ri] : "");
}
// Which special-wager block (if any) closes round ri in the current mode.
function roundWagerType(ri) {
  if (isTheme()) return ["wager1", "halftime", "final"][ri] || null;
  if (isTune()) return ["wager1", "halftime", "wager3", "final"][ri] || null;
  return ri === 1 ? "halftime" : ri === 3 ? "final" : null;
}
function wagerStore(type) {
  return type === "wager1"
    ? gameState.wager1
    : type === "wager3"
      ? gameState.wager3
      : type === "final"
        ? gameState.finalWager
        : gameState.halftime;
}
function wagerMax(type) {
  if (isTune()) return TUNE_WAGER_MAX[type];
  return isTheme() ? THEME_WAGER_MAX[type] : type === "final" ? 20 : 10;
}

function freshState() {
  return {
    meta: {
      date: new Date().toISOString().slice(0, 10),
      location: "",
      quizId: "",
      hostName: "",
      craftPartner: "",
      craftPartnerTown: "",
      bonusItem: "",
      staffNames: "",
      excludeTopN: 2,
      mode: "regular",
      themeName: "",
    },
    teams: [],
    rounds: [0, 1, 2, 3].map(() => ({
      questions: [{}, {}, {}, {}],
      bonus: {},
    })),
    halftime: {},
    finalWager: {},
    wager1: {},
    wager3: {},
    gameStarted: false,
    craftPrizeWinner: null,
  };
}
function freshTeam(n) {
  return {
    name: n || "",
    scoreGuess: "",
    bonusItem: false,
    njcb: false,
    paused: false,
    adjustment: 0,
    craftPrize: false,
  };
}
// A paused team stays on the roster (and in the report) but sits out scoring: no entry rows,
// and it never holds up a Beer Round or a "left" count for a question it can't answer.
function isPaused(ti) {
  return !!gameState.teams[ti]?.paused;
}
function activeTeamCount() {
  return gameState.teams.filter((t) => !t.paused).length;
}
// Name sort for a question card's team list. dir is "az" / "za" / falsy (off). pending, when the
// "unanswered first" sort is also on, is the set of teams that were unanswered when it was taken:
// they stay grouped above the answered ones and the name sort orders within each group.
const ALPHA_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});
function applyAlphaSort(order, dir, pending) {
  if (!dir) return order;
  const sign = dir === "za" ? -1 : 1;
  // Labels built once per sort (O(n)) instead of re-derived inside every comparison
  // (O(n log n) lookups), and one shared Collator instead of a fresh locale resolution per
  // localeCompare call — same ordering as localeCompare(…, {sensitivity:"base", numeric:true}).
  const labels = new Map(order.map((ti) => [ti, teamLabel(ti)]));
  return order.slice().sort((a, b) => {
    const g = pending ? (pending.has(a) ? 0 : 1) - (pending.has(b) ? 0 : 1) : 0;
    if (g) return g;
    const c = ALPHA_COLLATOR.compare(labels.get(a), labels.get(b));
    return sign * c || a - b;
  });
}
function teamLabel(ti) {
  return (gameState.teams[ti] && gameState.teams[ti].name) || "Team " + (ti + 1);
}

function migrateState(s) {
  if (!s.meta)
    s.meta = {
      date: "",
      location: "",
      quizId: "",
      hostName: "",
      craftPartner: "",
      craftPartnerTown: "",
      bonusItem: "",
      staffNames: "",
    };
  [
    "hostName",
    "craftPartner",
    "craftPartnerTown",
    "bonusItem",
    "staffNames",
    "themeName",
  ].forEach((k) => {
    s.meta[k] = s.meta[k] || "";
  });
  if (!GAME_MODES.includes(s.meta.mode)) s.meta.mode = "regular";
  // The same limits the inputs carry as maxlength, applied again to whatever comes IN. maxlength
  // only stops a person typing past it — it does nothing for a value arriving from a loaded .json
  // file, an older session saved before these limits existed, or a paste handled by script. The
  // PDF header and the scoresheet's team column size their text to fit a fixed box, so a runaway
  // value doesn't overflow, it shrinks until it can't be read; clamping on the way in is what
  // keeps that from being reachable at all.
  Object.entries(FIELD_MAX).forEach(([k, max]) => {
    if (typeof s.meta[k] === "string" && s.meta[k].length > max)
      s.meta[k] = s.meta[k].slice(0, max);
  });
  if (Array.isArray(s.teams))
    s.teams.forEach((t) => {
      if (typeof t.name === "string" && t.name.length > FIELD_MAX.teamName)
        t.name = t.name.slice(0, FIELD_MAX.teamName);
    });
  if (!s.meta.excludeTopN) s.meta.excludeTopN = s.meta.giftCardCount || 2;
  if (!s.teams) s.teams = [];
  s.teams.forEach((t) => {
    if (t.adjustment === undefined) t.adjustment = 0;
    if (t.njcb === undefined) t.njcb = false;
    if (t.paused === undefined) t.paused = false;
    if (t.craftPrize === undefined) t.craftPrize = false;
  });
  if (!s.rounds || s.rounds.length < 4)
    s.rounds = [0, 1, 2, 3].map(
      (i) => s.rounds?.[i] || { questions: [{}, {}, {}, {}], bonus: {} },
    );
  s.rounds.forEach((r) => {
    if (!r.questions || r.questions.length < 4) r.questions = [{}, {}, {}, {}];
    if (!r.bonus) r.bonus = {};
  });
  if (!s.halftime) s.halftime = {};
  if (!s.finalWager) s.finalWager = {};
  if (!s.wager1) s.wager1 = {};
  if (!s.wager3) s.wager3 = {};
  if (s.gameStarted === undefined) s.gameStarted = false;
  if (s.craftPrizeWinner === undefined)
    s.craftPrizeWinner =
      s.craftPrizeDraws && s.craftPrizeDraws.length
        ? s.craftPrizeDraws[s.craftPrizeDraws.length - 1]
        : null;
  return s;
}

function checkGameStarted() {
  // Once the flag is set the scan below can only ever return true (it falls through to this same
  // flag when it finds nothing), so skip the O(16n) walk over every answer on every render.
  if (gameState.gameStarted) return true;
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++) {
      const q = gameState.rounds[ri].questions[qi];
      for (const k in q) {
        if (q[k] && (q[k].wager !== undefined || q[k].correct !== undefined)) {
          gameState.gameStarted = true;
          return true;
        }
      }
    }
    if (hasBonusQ(ri)) {
      const b = gameState.rounds[ri].bonus;
      for (const k in b) {
        if (b[k] != null) {
          gameState.gameStarted = true;
          return true;
        }
      }
    }
  }
  for (const store of [gameState.wager1, gameState.halftime, gameState.wager3, gameState.finalWager]) {
    for (const k in store) {
      if (store[k]?.wager) {
        gameState.gameStarted = true;
        return true;
      }
    }
  }
  return gameState.gameStarted;
}

// BEER ROUND: question is a beer round if every team has been marked AND all are correct
function isBeerRound(ri, qi) {
  const n = gameState.teams.length;
  if (activeTeamCount() === 0) return false;
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    const a = gameState.rounds[ri].questions[qi][ti];
    if (!a || a.wager === undefined || a.correct !== true) return false;
  }
  return true;
}

function checkBeerRound(ri, qi) {
  const key = ri + "-" + qi;
  if (isBeerRound(ri, qi)) beerRoundToasted.add(key);
}

// Per-render-pass memo for the totals every render asks for again and again. One renderAll used
// to recompute each team's grandTotal ~3x (sidebar ranking, Final Results, standings blocks) and
// each roundSub ~2x more through preWagerTotal and the sidebar tooltip; with the memo each
// (team, round) is summed once per pass. It exists ONLY while a render is running (see
// withScoreMemo) — nothing mutates scores mid-render, and any read outside a render (setters,
// exports, the tour's tie-break demo) always recomputes from live state, so it can never go stale.
let scoreMemo = null;
function withScoreMemo(fn) {
  if (scoreMemo) return fn();
  scoreMemo = { rs: new Map(), gt: new Map(), rk: null };
  try {
    return fn();
  } finally {
    scoreMemo = null;
  }
}
function roundSub(ti, ri) {
  if (!scoreMemo) return roundSubRaw(ti, ri);
  const key = ti * 4 + ri;
  let v = scoreMemo.rs.get(key);
  if (v === undefined) {
    v = roundSubRaw(ti, ri);
    scoreMemo.rs.set(key, v);
  }
  return v;
}
function roundSubRaw(ti, ri) {
  if (ri >= roundCount()) return 0; // Theme Night hides Round 4; its entries never count
  const rd = gameState.rounds[ri];
  let t = 0;
  for (let qi = 0; qi < 4; qi++) {
    const a = rd.questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined)
      t += a.correct ? a.wager : 0;
  }
  if (hasBonusQ(ri)) {
    const bc = rd.bonus[ti];
    if (bc != null) t += bc * 5;
  }
  return t;
}
function htPts(ti) {
  const h = gameState.halftime[ti];
  if (!h || h.wager == null || h.wager === "") return 0;
  if (h.correct == null) return 0;
  return h.correct ? +h.wager : -h.wager;
}
function fwPts(ti) {
  const f = gameState.finalWager[ti];
  if (!f || f.wager == null || f.wager === "") return 0;
  if (f.correct == null) return 0;
  return f.correct ? +f.wager : -f.wager;
}
function w1Pts(ti) {
  if (!hasQ5Wagers()) return 0;
  const w = gameState.wager1[ti];
  if (!w || w.wager == null || w.wager === "" || w.correct == null) return 0;
  return w.correct ? +w.wager : -w.wager;
}
// Name That Tune's Round 3 wager (its own store; Theme Night / Regular never write it).
function w3Pts(ti) {
  if (!isTune()) return 0;
  const w = gameState.wager3[ti];
  if (!w || w.wager == null || w.wager === "" || w.correct == null) return 0;
  return w.correct ? +w.wager : -w.wager;
}
// Net points of whichever wager store `type` names, for one team.
function wagerPts(type, ti) {
  return type === "wager1"
    ? w1Pts(ti)
    : type === "wager3"
      ? w3Pts(ti)
      : type === "final"
        ? fwPts(ti)
        : htPts(ti);
}
function grandTotal(ti) {
  if (!scoreMemo) return grandTotalRaw(ti);
  let v = scoreMemo.gt.get(ti);
  if (v === undefined) {
    v = grandTotalRaw(ti);
    scoreMemo.gt.set(ti, v);
  }
  return v;
}
function grandTotalRaw(ti) {
  let t = 0;
  for (let ri = 0; ri < 4; ri++) t += roundSub(ti, ri);
  t += htPts(ti) + fwPts(ti) + w1Pts(ti) + w3Pts(ti);
  if (gameState.teams[ti]?.bonusItem) t += 5;
  if (gameState.teams[ti]?.njcb) t += 3;
  t += gameState.teams[ti]?.adjustment || 0;
  return t;
}
// Teams level on total score are broken by Score Guess closeness (the same "closer guess wins
// the tie" rule the Final Results table already uses) — a team with no guess sorts last within
// its tied group (Infinity), same as there. Two teams that are ALSO tied on guess-closeness (or
// both have no guess at all) are a genuine, unbreakable tie and stay grouped for rankMap()
// below; a.index as the final fallback just keeps the sort stable/deterministic.
function ranked() {
  if (scoreMemo && scoreMemo.rk) return scoreMemo.rk;
  const out = rankedRaw();
  if (scoreMemo) scoreMemo.rk = out;
  return out;
}
function rankedRaw() {
  return gameState.teams
    .map((t, i) => {
      const total = grandTotal(i);
      const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
      const hasGuess = !(t.scoreGuess === "" || t.scoreGuess == null);
      const guessDiff = hasGuess
        ? Math.abs(total - bonuses - parseInt(t.scoreGuess, 10))
        : Infinity;
      return {
        index: i,
        name: t.name || "Team " + (i + 1),
        total,
        guessDiff,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total || a.guessDiff - b.guessDiff || a.index - b.index,
    );
}
// Dense ("1223") ranking on the (total, guessDiff) tie-broken order above: teams tied on BOTH
// total score and guess-closeness share a place, and the next genuinely-distinct team takes the
// very next place — no numbers get skipped for however many teams just tied. A closer guess now
// resolves a tied total into its own next place instead of sharing one (three teams "tied" for
// 5th by score alone, but one guessed closer, place as 5th/6th/6th instead of 5th/5th/5th) — no
// more than one team can hold 1st/2nd/etc. unless their guesses were ALSO tied.
function rankMap() {
  const rk = ranked();
  const rm = {};
  let place = 0,
    prevTotal = null,
    prevDiff = null;
  rk.forEach((r) => {
    if (prevTotal === null || r.total !== prevTotal || r.guessDiff !== prevDiff)
      place++;
    rm[r.index] = place;
    prevTotal = r.total;
    prevDiff = r.guessDiff;
  });
  return rm;
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function finalResultsRows() {
  const dv = (r) => (r.diff == null ? Infinity : r.diff);
  const rows = gameState.teams.map((t, i) => {
    const score = grandTotal(i);
    const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
    const hasG = !(t.scoreGuess === "" || t.scoreGuess == null);
    const guess = hasG ? parseInt(t.scoreGuess, 10) : null;
    const diff = hasG ? Math.abs(score - bonuses - guess) : null;
    // >0 = guess came in over the actual score, <0 = under, 0 = exact — display-only, the
    // tie-break sort above always uses the unsigned diff.
    const diffSign = hasG ? Math.sign(guess - (score - bonuses)) : 0;
    return {
      index: i,
      name: t.name || "Team " + (i + 1),
      score,
      guess,
      diff,
      diffSign,
    };
  });
  const byPlace = rows
    .slice()
    .sort((a, b) => b.score - a.score || dv(a) - dv(b) || a.index - b.index);
  // Place NUMBER is dense on the (score, diff) compound key — same rule as the sidebar's
  // rankMap(): a closer guess resolves a tied score into its own next place instead of sharing
  // one, so no more than one team can hold 1st/2nd/etc. unless their guesses were ALSO tied.
  // Only a genuinely unbreakable tie (same score AND same diff, or both teams with no guess at
  // all) still shares a place number and gets the "tie" badge below.
  let place = 0,
    prevScore = null,
    prevDiff = null;
  byPlace.forEach((r) => {
    const d = dv(r);
    if (prevScore === null || r.score !== prevScore || d !== prevDiff) place++;
    r.place = place;
    prevScore = r.score;
    prevDiff = d;
  });
  // .tie/.tieWinner are about the SCORE alone (not the compound place key above) — they flag
  // "this team's score was tied with another's" so the host can see at a glance where the
  // guess tiebreak actually did work, even though the place numbers are now always distinct.
  // .tieWinner marks whoever had the closest guess in that tied group (the one who got the
  // better place out of it); everyone else in the group just gets the plain "tie" badge.
  const cnt = {};
  rows.forEach((r) => {
    cnt[r.score] = (cnt[r.score] || 0) + 1;
  });
  const minD = {};
  rows.forEach((r) => {
    if (cnt[r.score] > 1) {
      const d = dv(r);
      if (minD[r.score] === undefined || d < minD[r.score]) minD[r.score] = d;
    }
  });
  rows.forEach((r) => {
    r.tie = cnt[r.score] > 1;
    r.tieWinner = r.tie && dv(r) === minD[r.score];
  });
  return byPlace
    .slice()
    .reverse(); /* ascending: lowest score (worst place) first */
}
function usedW(ti, ri) {
  const u = [];
  for (let qi = 0; qi < 4; qi++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined) u.push({ qi, wager: a.wager });
  }
  return u;
}
// The team's score going INTO the wager `type`: every round before it (with the wagers that closed
// them) plus the Q1-4 of the round the wager closes, then the Bonus Item / NJCB / adjustment.
function preWagerTotal(ti, type) {
  let t = 0;
  for (let ri = 0; ri < 4; ri++) {
    t += roundSub(ti, ri);
    const wt = roundWagerType(ri);
    if (wt === type) break;
    if (wt) t += wagerPts(wt, ti);
  }
  if (gameState.teams[ti]?.bonusItem) t += 5;
  if (gameState.teams[ti]?.njcb) t += 3;
  t += gameState.teams[ti]?.adjustment || 0;
  return t;
}

function isBonusBeerRound(ri) {
  const n = gameState.teams.length;
  if (!activeTeamCount()) return false;
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    if (gameState.rounds[ri].bonus[ti] !== 4) return false;
  }
  return true;
}
function isSpecialBeerRound(type) {
  const n = gameState.teams.length;
  if (!activeTeamCount()) return false;
  const data = wagerStore(type);
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    const d = data[ti];
    if (!d || d.correct !== true) return false;
  }
  return true;
}

function qScored(ri, qi) {
  const n = gameState.teams.length;
  let done = 0;
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined) done++;
  }
  return { done, total: activeTeamCount() };
}
function roundProgress(ri) {
  const n = activeTeamCount(),
    len = gameState.teams.length;
  if (!n) return { done: 0, total: 0 };
  let done = 0,
    total = n * 4;
  for (let qi = 0; qi < 4; qi++)
    for (let ti = 0; ti < len; ti++) {
      if (isPaused(ti)) continue;
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager !== undefined && a.correct !== undefined) done++;
    }
  if (hasBonusQ(ri)) {
    total += n;
    for (let ti = 0; ti < len; ti++) {
      if (isPaused(ti)) continue;
      if (gameState.rounds[ri].bonus[ti] != null) done++;
    }
  } else if (roundWagerType(ri)) {
    const store = wagerStore(roundWagerType(ri));
    total += n;
    for (let ti = 0; ti < len; ti++) {
      if (isPaused(ti)) continue;
      const h = store[ti];
      if (h && h.wager != null && h.wager !== "" && h.correct != null) done++;
    }
  }
  return { done, total };
}

function qVerdict(ri, qi) {
  if (isBeerRound(ri, qi)) return "beer";
  const n = gameState.teams.length;
  let ans = 0,
    wrong = 0;
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.correct !== undefined) {
      ans++;
      if (a.correct === false) wrong++;
    }
  }
  if (ans === 0) return "next";
  if (wrong === ans) return "everyonewrong";
  if (wrong >= Math.ceil(ans / 2)) return "manywrong";
  return "next";
}
// Correct/incorrect breakdown for a single question, out of teams graded so far
// (not the full roster) so it reads accurately mid-grading instead of front-loading
// ungraded teams into the "incorrect" bucket. incorrectPct is 100-correctPct (not its
// own rounded value) so the two percentages always sum to exactly 100.
function scoreBreakdown(dataObj, n) {
  let correct = 0,
    incorrect = 0;
  for (let ti = 0; ti < n; ti++) {
    if (isPaused(ti)) continue;
    const a = dataObj[ti];
    if (a && a.correct != null) {
      if (a.correct) correct++;
      else incorrect++;
    }
  }
  const done = correct + incorrect;
  const correctPct = done ? Math.round((correct / done) * 100) : 0;
  const incorrectPct = done ? 100 - correctPct : 0;
  return { correct, incorrect, done, correctPct, incorrectPct };
}