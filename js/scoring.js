"use strict";

const ROUND_WAGERS = [
  [1, 2, 3, 4],
  [1, 3, 5, 7],
  [2, 4, 6, 8],
  [3, 6, 9, 12],
];
const ROUND_COLORS = ["rl-1", "rl-2", "rl-3", "rl-4"];
const BONUS_ROUNDS = new Set([0, 2]);

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
    },
    teams: [],
    rounds: [0, 1, 2, 3].map(() => ({
      questions: [{}, {}, {}, {}],
      bonus: {},
    })),
    halftime: {},
    finalWager: {},
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
    adjustment: 0,
    craftPrize: false,
  };
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
  ].forEach((k) => {
    s.meta[k] = s.meta[k] || "";
  });
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
  if (s.gameStarted === undefined) s.gameStarted = false;
  if (s.craftPrizeWinner === undefined)
    s.craftPrizeWinner =
      s.craftPrizeDraws && s.craftPrizeDraws.length
        ? s.craftPrizeDraws[s.craftPrizeDraws.length - 1]
        : null;
  return s;
}

function checkGameStarted() {
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
    if (BONUS_ROUNDS.has(ri)) {
      const b = gameState.rounds[ri].bonus;
      for (const k in b) {
        if (b[k] != null) {
          gameState.gameStarted = true;
          return true;
        }
      }
    }
  }
  for (const k in gameState.halftime) {
    if (gameState.halftime[k]?.wager) {
      gameState.gameStarted = true;
      return true;
    }
  }
  for (const k in gameState.finalWager) {
    if (gameState.finalWager[k]?.wager) {
      gameState.gameStarted = true;
      return true;
    }
  }
  return gameState.gameStarted;
}

// BEER ROUND: question is a beer round if every team has been marked AND all are correct
function isBeerRound(ri, qi) {
  const n = gameState.teams.length;
  if (n === 0) return false;
  for (let ti = 0; ti < n; ti++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (!a || a.wager === undefined || a.correct !== true) return false;
  }
  return true;
}

function checkBeerRound(ri, qi) {
  const key = ri + "-" + qi;
  if (isBeerRound(ri, qi)) beerRoundToasted.add(key);
}

function roundSub(ti, ri) {
  const rd = gameState.rounds[ri];
  let t = 0;
  for (let qi = 0; qi < 4; qi++) {
    const a = rd.questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined)
      t += a.correct ? a.wager : 0;
  }
  if (BONUS_ROUNDS.has(ri)) {
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
function grandTotal(ti) {
  let t = 0;
  for (let ri = 0; ri < 4; ri++) t += roundSub(ti, ri);
  t += htPts(ti) + fwPts(ti);
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
function preWagerTotal(ti, type) {
  let t = roundSub(ti, 0) + roundSub(ti, 1);
  if (type === "final") t += htPts(ti) + roundSub(ti, 2) + roundSub(ti, 3);
  if (gameState.teams[ti]?.bonusItem) t += 5;
  if (gameState.teams[ti]?.njcb) t += 3;
  t += gameState.teams[ti]?.adjustment || 0;
  return t;
}

function isBonusBeerRound(ri) {
  const n = gameState.teams.length;
  if (!n) return false;
  for (let ti = 0; ti < n; ti++) {
    if (gameState.rounds[ri].bonus[ti] !== 4) return false;
  }
  return true;
}
function isSpecialBeerRound(type) {
  const n = gameState.teams.length;
  if (!n) return false;
  const data = type === "halftime" ? gameState.halftime : gameState.finalWager;
  for (let ti = 0; ti < n; ti++) {
    const d = data[ti];
    if (!d || d.correct !== true) return false;
  }
  return true;
}

function qScored(ri, qi) {
  const n = gameState.teams.length;
  let done = 0;
  for (let ti = 0; ti < n; ti++) {
    const a = gameState.rounds[ri].questions[qi][ti];
    if (a && a.wager !== undefined && a.correct !== undefined) done++;
  }
  return { done, total: n };
}
function roundProgress(ri) {
  const n = gameState.teams.length;
  if (!n) return { done: 0, total: 0 };
  let done = 0,
    total = n * 4;
  for (let qi = 0; qi < 4; qi++)
    for (let ti = 0; ti < n; ti++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager !== undefined && a.correct !== undefined) done++;
    }
  if (BONUS_ROUNDS.has(ri)) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      if (gameState.rounds[ri].bonus[ti] != null) done++;
    }
  } else if (ri === 1) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      const h = gameState.halftime[ti];
      if (h && h.wager != null && h.wager !== "" && h.correct != null) done++;
    }
  } else if (ri === 3) {
    total += n;
    for (let ti = 0; ti < n; ti++) {
      const f = gameState.finalWager[ti];
      if (f && f.wager != null && f.wager !== "" && f.correct != null) done++;
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