"use strict";


// ===== TEAM REPORT (formerly "Score Audit") =====
function openAudit(ti) {
  const el = document.getElementById("auditModal");
  if (!el) return;
  el.innerHTML = buildAudit(ti);
  document.getElementById("auditOverlay").classList.add("show");
}
function closeAudit() {
  document.getElementById("auditOverlay").classList.remove("show");
}

// Same guess/diff math as finalResultsRows() (Bonus Item/NJCB stripped out before comparing to
// the guess), just for one team instead of the whole sorted table — shown right under Grand
// Total so the host can see how close the team's pre-game guess landed without leaving the audit.
function auditGuessDiff(ti, score) {
  const t = gameState.teams[ti];
  const bonuses = (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0);
  const hasG = !(t.scoreGuess === "" || t.scoreGuess == null);
  const guess = hasG ? parseInt(t.scoreGuess, 10) : null;
  const adjusted = score - bonuses;
  const diff = hasG ? Math.abs(adjusted - guess) : null;
  const diffSign = hasG ? Math.sign(guess - adjusted) : 0;
  const diffTxt =
    diff == null
      ? "—"
      : diffSign > 0
        ? "+" + diff
        : diffSign < 0
          ? "-" + diff
          : diff;
  const guessCell = `<div class="aud-cell"><span class="aud-stat-n">${guess == null ? "—" : guess}</span><span class="aud-stat-pct">Score Guess</span></div>`;
  const diffCell = `<div class="aud-cell"><span class="aud-stat-n">${diffTxt}</span><span class="aud-stat-pct">Diff</span></div>`;
  // No bonuses: just Diff then Score Guess — Adj. Score would equal the raw score, so
  // there's nothing for it to clarify and it's left out entirely, and Grand Total above stays
  // the sole score anchor.
  if (!bonuses) return `<div class="aud-grid aud-grid-2">${diffCell}${guessCell}</div>`;
  // Bonus Item/NJCB collapse into one combined "Diff Adj *" figure instead of separate -5/-3
  // cells, sitting left of Adj. Score so the whole chain (adjustment -> adjusted score ->
  // diff -> guess) reads as a single divided card.
  const adjCell = `<div class="aud-cell aud-stat-wrong"><span class="aud-stat-n">-${bonuses}</span><span class="aud-stat-pct">Diff Adj *</span></div>`;
  const adjustedCell = `<div class="aud-cell"><span class="aud-stat-n">${adjusted}</span><span class="aud-stat-pct">Adj. Score</span></div>`;
  return `<div class="aud-grid aud-grid-4">${adjCell}${adjustedCell}${diffCell}${guessCell}</div>`;
}
// Tally of every question a team has been marked on — the 16 regular Q1-4 x Round 1-4 answers,
// the 4-question Beer Round bonus in Round 1 and Round 3 (rounds.bonus[ti] is a 0-4 count of how
// many of those 4 were correct), and the single Halftime/Final wagers after Round 2/4 — 26
// questions total when every one has been marked. Shown as a correct/incorrect count under the
// Grand Total.
function auditOverallStats(ti) {
  let correct = 0,
    incorrect = 0;
  for (let ri = 0; ri < 4; ri++) {
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[ri].questions[qi][ti];
      if (a && a.wager != null && a.wager !== "" && a.correct != null) {
        if (a.correct) correct++;
        else incorrect++;
      }
    }
    if (BONUS_ROUNDS.has(ri)) {
      const v = gameState.rounds[ri].bonus[ti];
      if (v != null) {
        correct += v;
        incorrect += 4 - v;
      }
    }
  }
  const h = gameState.halftime[ti];
  if (h && h.wager != null && h.wager !== "" && h.correct != null) {
    if (h.correct) correct++;
    else incorrect++;
  }
  const f = gameState.finalWager[ti];
  if (f && f.wager != null && f.wager !== "" && f.correct != null) {
    if (f.correct) correct++;
    else incorrect++;
  }
  const total = correct + incorrect;
  if (!total) return "";
  const correctPct = Math.round((correct / total) * 100);
  const incorrectPct = 100 - correctPct;
  return (
    `<div class="aud-grid aud-grid-2">` +
    `<div class="aud-cell aud-stat-correct"><span class="aud-stat-n">${correct}/${total} correct</span><span class="aud-stat-pct">${correctPct}%</span></div>` +
    `<div class="aud-cell aud-stat-wrong"><span class="aud-stat-n">${incorrect}/${total} incorrect</span><span class="aud-stat-pct">${incorrectPct}%</span></div>` +
    `</div>`
  );
}
function auditQLine(ri, qi, ti) {
  const a = gameState.rounds[ri].questions[qi][ti] || {};
  const hasW = a.wager !== undefined,
    hasR = a.correct !== undefined;
  let res, pts, pcls;
  if (!hasW) {
    res = '<span class="aud-res aud-none">no wager placed</span>';
    pts = "\u2014";
    pcls = "none";
  } else if (!hasR) {
    res =
      '<span class="aud-res aud-pending">wager ' +
      a.wager +
      " \u2014 not marked</span>";
    pts = "\u2014";
    pcls = "none";
  } else if (a.correct) {
    res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} correct</span>`;
    pts = "+" + a.wager;
    pcls = "pos";
  } else {
    res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} incorrect</span>`;
    pts = "0";
    pcls = "zero";
  }
  const wtxt = hasW ? "wager " + a.wager : "\u2014";
  return `<div class="aud-line"><span class="aud-q">Q${qi + 1}</span><span class="aud-wager">${wtxt}</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
}

function buildAudit(ti) {
  const t = gameState.teams[ti];
  if (!t) return "";
  const name = esc(t.name || "Team " + (ti + 1));
  const rm = rankMap();
  const rank = rm[ti];
  let h = `<div class="audit-head"><h2>${name}<span class="aud-sub">Team Report \u2014 rank #${rank} of ${gameState.teams.length} \u00B7 ${esc(gameState.meta.location || "")}${gameState.meta.quizId ? " \u00B7 Quiz " + esc(gameState.meta.quizId) : ""}</span></h2><button class="audit-close" onclick="closeAudit()" aria-label="Close" title="Close">${X_ICON_SVG}</button></div>`;
  h += `<div class="audit-body">`;

  let run = 0;
  function roundBlock(ri, label, colorCls) {
    let b = `<div class="aud-round"><div class="aud-round-h"><span class="round-label ${colorCls}">${label}</span><span style="color:var(--text-muted);font-weight:400;font-size:.68rem;letter-spacing:0;text-transform:none">wagers ${ROUND_WAGERS[ri].join(", ")}</span></div>`;
    for (let qi = 0; qi < 4; qi++) b += auditQLine(ri, qi, ti);
    if (BONUS_ROUNDS.has(ri)) {
      const v = gameState.rounds[ri].bonus[ti];
      let res, pts, pcls;
      if (v == null) {
        res = '<span class="aud-res aud-none">not marked</span>';
        pts = "\u2014";
        pcls = "none";
      } else if (v > 0) {
        res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} ${v} of 4 correct</span>`;
        pts = "+" + v * 5;
        pcls = "pos";
      } else {
        res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} 0 of 4 correct</span>`;
        pts = "0";
        pcls = "zero";
      }
      b += `<div class="aud-line"><span class="aud-q">B</span><span class="aud-wager">bonus \u00D75</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
    }
    const sub = roundSub(ti, ri);
    run += sub;
    b += `<div class="aud-subline"><span class="asl-row"><span class="lbl">Subtotal</span><span class="sub">${sub}</span></span><span class="asl-row"><span class="lbl">total so far</span><span class="run">${run}</span></span></div>`;
    return b + `</div>`;
  }
  function wagerBlock(data, label, colorCls, maxTxt, skipSub) {
    const w =
      data && data.wager != null && data.wager !== "" ? +data.wager : null;
    let res, pts, pcls;
    if (w == null) {
      res = '<span class="aud-res aud-none">no wager placed</span>';
      pts = "\u2014";
      pcls = "none";
    } else if (data.correct == null) {
      res =
        '<span class="aud-res aud-pending">wager ' +
        w +
        " \u2014 not marked</span>";
      pts = "\u2014";
      pcls = "none";
    } else if (data.correct) {
      res = `<span class="aud-res aud-correct">${CHECK_ICON_SVG} correct</span>`;
      pts = "+" + w;
      pcls = "pos";
    } else {
      res = `<span class="aud-res aud-wrong">${ICON_AUDIT_WRONG} incorrect</span>`;
      pts = "\u2212" + w;
      pcls = "neg";
    }
    const p = w != null && data.correct != null ? (data.correct ? w : -w) : 0;
    run += p;
    let b = `<div class="aud-round"><div class="aud-round-h"><span class="round-label ${colorCls}">${label}</span><span style="color:var(--text-muted);font-weight:400;font-size:.68rem;letter-spacing:0;text-transform:none">${maxTxt}</span></div>`;
    b += `<div class="aud-line"><span class="aud-q">\u2605</span><span class="aud-wager">${w != null ? "wager " + w : "\u2014"}</span>${res}<span class="aud-p ${pcls}">${pts}</span></div>`;
    // Final Wager's own running total always equals Grand Total (nothing scores after it), which
    // sits right below in its own callout \u2014 showing it again here would just repeat that number.
    if (!skipSub)
      b += `<div class="aud-subline"><span class="asl-row"><span class="lbl">after ${label}</span></span><span class="asl-row"><span class="lbl">total so far</span><span class="run">${run}</span></span></div>`;
    return b + `</div>`;
  }

  // Extras \u2014 bonus item and NJCB card are checked in before the game starts, so show them
  // first; the running "total so far" in every later block includes them from the start.
  // No value in the leading .aud-q cell the way scored rows carry a question number: the points
  // are already stated at the end of the row, and printing "+5" at both ends of a two-item line
  // just said the same thing twice. The label carries no verb for the same reason \u2014 "Bonus
  // item" and "NJCB Member Card" are the things being scored, and "brought"/"shown" only restated
  // that they are present, which the row's existence and its points already say.
  const item = t.bonusItem ? 5 : 0,
    nj = t.njcb ? 3 : 0,
    adj = t.adjustment || 0;
  if (item || nj || adj) {
    h += `<div class="aud-round"><div class="aud-round-h"><span class="round-label rl-3">Extras</span></div>`;
    if (item)
      h += `<div class="aud-line"><span class="aud-res aud-correct">Bonus item</span><span class="aud-p pos">+5</span></div>`;
    if (nj)
      h += `<div class="aud-line"><span class="aud-res aud-correct">NJCB Member Card</span><span class="aud-p pos">+3</span></div>`;
    if (adj)
      h += `<div class="aud-line"><span class="aud-res">Manual adjustment</span><span class="aud-p ${adj > 0 ? "pos" : "neg"}">${adj > 0 ? "+" : ""}${adj}</span></div>`;
    const extrasSub = item + nj + adj;
    run += extrasSub;
    // Subtotal only, no "total so far" — Extras is rendered before Round 1, so at this point the
    // two are the same number and printing both would state it twice. Same reason the Final
    // Wager block skips its own running total. The block itself only renders when the team has
    // extras at all, so this line never appears as a lone 0.
    h += `<div class="aud-subline"><span class="asl-row"><span class="lbl">Subtotal</span><span class="sub">${extrasSub}</span></span></div>`;
    h += `</div>`;
  }

  // Two-column desktop layout: column 1 runs through Halftime Bonus, column 2 picks up at
  // Round 3 \u2014 Grand Total and everything after it (Guess/Diff, overall stats, note) stays
  // full-width below both columns rather than living inside either one.
  let col1 = roundBlock(0, "Round 1", "rl-1");
  col1 += roundBlock(1, "Round 2", "rl-2");
  col1 += wagerBlock(
    gameState.halftime[ti],
    "Halftime Bonus",
    "rl-2",
    "win or lose, 1\u201310",
  );
  let col2 = roundBlock(2, "Round 3", "rl-3");
  col2 += roundBlock(3, "Round 4", "rl-4");
  col2 += wagerBlock(
    gameState.finalWager[ti],
    "Final Wager",
    "rl-4",
    "win or lose, 1\u201320",
    true,
  );
  h += `<div class="aud-columns"><div class="aud-col">${col1}</div><div class="aud-col">${col2}</div></div>`;

  const gt = grandTotal(ti);
  h += `<div class="aud-total"><span>Grand Total</span><span class="val">${gt}</span></div>`;
  h += auditGuessDiff(ti, gt);
  h += auditOverallStats(ti);
  if (run !== gt)
    h += `<div class="aud-note">Note: running figure (${run}) and grand total (${gt}) differ \u2014 if you see this, take a screenshot.</div>`;
  else {
    // Only define the terms this team's report actually shows. auditGuessDiff() renders the
    // "Diff Adj *" and "Adj. Score" cells (and Diff is then measured off Adj. Score) only when the
    // team has Bonus Item and/or NJCB points to strip back out — a manual adjustment alone
    // doesn't. For a team with no bonuses those cells, and the * footnote, never appear, so their
    // definitions are left out rather than explaining a figure that isn't on screen.
    const hasBonuses = !!(item || nj);
    let note =
      "Each round shows that question's wager, whether it was marked correct or incorrect, and the team's running score. To fix a wrong wager, close this and tap the wager button in the round itself. </br> </br>";
    if (hasBonuses)
      note +=
        "<strong>Diff Adj (Difference Adjustment)</strong> is the Bonuses coming back off — Bonus Item (+5) and NJCB (+3). </br><strong>Adj. Score (Adjusted Score)</strong> is the Grand Total with those stripped out. </br>";
    note +=
      "<strong>Diff</strong> is " +
      (hasBonuses ? "Adj. Score" : "the Grand Total") +
      " measured against the team's Score Guess. A plus (+) means they guessed high, a minus (−) means they guessed low, and 0 means they called it exactly.";
    if (hasBonuses)
      note +=
        " </br> </br>* Every team's guess is compared on the same bonus-free footing, which is why the bonuses come off before the guess is scored.";
    h += `<div class="aud-note">${note}</div>`;
  }
  h += `</div>`;
  return h;
}