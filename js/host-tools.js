/* ==========================================================================
   js/host-tools.js — HOST EXTRAS: keyboard shortcuts, progress chart, backups dialog  (READ ME FIRST)

   Loaded after app.js because it only uses things app.js defines.
     - SHORTCUT_LIST + the '?' help overlay; shortcutsBlocked() stops letter shortcuts while typing.
     - Score progression chart: progressionData() computes each team's running score by round,
       drawChartCanvas() paints it on a <canvas> (no chart library), and the download/copy/share
       functions turn it into an image.
     - Backups dialog: openBackups()/restoreBackup() list and restore the snapshots made by storage.js.
   ========================================================================== */
"use strict";

// ===== HOST TOOLS: keyboard shortcuts + score progression chart / shareable image =====
// Loaded after js/app.js. Everything here only reads gameState through the same scoring helpers
// the rest of the app uses (roundSub, wagerPts, ranked, ...), so the chart's last point for a
// team is always exactly its grandTotal().

// ---------------------------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------------------------
const SHORTCUT_LIST = [
  ["N", "Jump to the next unscored question"],
  ["1 – 4", "Jump to Round 1 – 4"],
  ["F", "Jump to Final Results"],
  ["E", "Scoreboard: entry order"],
  ["R", "Scoreboard: shuffle"],
  ["A", "Scoreboard: ascending (reveal order)"],
  ["D", "Scoreboard: descending (leaderboard)"],
  ["G", "Score progression chart"],
  ["?", "Show / hide this list"],
  ["Esc", "Close the open panel"],
];

// True while typing into a field or while a modal/overlay owns the keyboard — plain-letter
// shortcuts must never fire then (a team named "Dragons" must not reshuffle the scoreboard).
function shortcutsBlocked(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (t && t.closest) {
    if (t.closest("input, textarea, select, [contenteditable]")) return true;
  }
  return !!document.querySelector(
    ".audit-overlay.show, .confirm-overlay.show, .tutorial-callout",
  );
}

function ensureOverlay(id) {
  let o = document.getElementById(id);
  if (o) return o;
  o = document.createElement("div");
  o.id = id;
  o.className = "audit-overlay";
  o.addEventListener("click", (ev) => {
    if (ev.target === o) o.classList.remove("show");
  });
  document.body.appendChild(o);
  return o;
}

function toggleShortcutsHelp(force) {
  const o = ensureOverlay("shortcutsOverlay");
  const show = force === undefined ? !o.classList.contains("show") : force;
  if (show) {
    o.innerHTML =
      `<div class="audit-modal ht-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">` +
      `<div class="ht-head"><h2>Keyboard shortcuts</h2><button type="button" class="btn" onclick="toggleShortcutsHelp(false)" aria-label="Close">Close</button></div>` +
      `<table class="ht-keys"><tbody>` +
      SHORTCUT_LIST.map(
        ([k, d]) => `<tr><th scope="row"><kbd>${esc(k)}</kbd></th><td>${esc(d)}</td></tr>`,
      ).join("") +
      `</tbody></table><p class="fr-note">Shortcuts pause while you are typing in a field or a panel is open.</p></div>`;
  }
  o.classList.toggle("show", show);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    ["shortcutsOverlay", "chartOverlay", "backupsOverlay"].forEach((id) =>
      document.getElementById(id)?.classList.remove("show"),
    );
    return;
  }
  if (shortcutsBlocked(e) || e.repeat) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const rounds = roundCount();
  let handled = true;
  if (k === "?") toggleShortcutsHelp();
  else if (k === "n") jumpToFirstUnanswered();
  else if (k === "f") jumpToSection("sec-final");
  else if (k === "e") setSortMode("entry");
  else if (k === "r") setSortMode("random");
  else if (k === "a") setSortMode("asc");
  else if (k === "d") setSortMode("desc");
  else if (k === "g") openProgressChart();
  else if (/^[1-4]$/.test(k) && +k <= rounds) jumpToSection("sec-r" + k);
  else handled = false;
  if (handled) e.preventDefault();
});

// ---------------------------------------------------------------------------------------------
// Score progression: data
// ---------------------------------------------------------------------------------------------
// Running total per team after each round (the wager that closes a round counts in that round).
// Bonus Item / NJCB / manual adjustments are not tied to a round, so they land on the last
// plotted point — that way the line always ends on the team's real grand total.
function progressionData() {
  let last = -1;
  for (let ri = 0; ri < roundCount(); ri++) {
    if (roundProgress(ri).done > 0) last = ri;
  }
  const labels = [];
  for (let ri = 0; ri <= last; ri++) labels.push("R" + (ri + 1));
  const series = gameState.teams.map((t, ti) => {
    let run = 0;
    const pts = [];
    for (let ri = 0; ri <= last; ri++) {
      run += roundSub(ti, ri);
      const wt = roundWagerType(ri);
      if (wt) run += wagerPts(wt, ti);
      pts.push(run);
    }
    if (pts.length) {
      pts[pts.length - 1] +=
        (t.bonusItem ? 5 : 0) + (t.njcb ? 3 : 0) + (t.adjustment || 0);
    }
    return { index: ti, name: t.name || "Team " + (ti + 1), pts };
  });
  return { labels, series };
}

// ---------------------------------------------------------------------------------------------
// Chart modal (team picker + canvas preview + share/download)
// ---------------------------------------------------------------------------------------------
const CHART_COLORS = [
  "#56B4E9", "#E69F00", "#2ECC9A", "#F0E442", "#CC79A7",
  "#FF6B5B", "#9AA8FF", "#B0B0B0", "#7FD1B9", "#F4A6C0",
];
const CHART_DASHES = [[], [], [], [], [], [], [], [], [7, 5], [7, 5]];
let chartSelection = null; // Set of team indices; null = pick the default on first open

function chartDefaultSelection() {
  const top = ranked().map((r) => r.index);
  return new Set(top.slice(0, top.length <= 8 ? top.length : 5));
}

function openProgressChart() {
  const o = ensureOverlay("chartOverlay");
  if (!chartSelection) chartSelection = chartDefaultSelection();
  // Teams can be removed between opens — drop any index that no longer exists.
  chartSelection = new Set(
    [...chartSelection].filter((i) => i < gameState.teams.length),
  );
  o.classList.add("show");
  renderChartModal();
}
function closeProgressChart() {
  document.getElementById("chartOverlay")?.classList.remove("show");
}
function chartPick(ti, on) {
  if (on) chartSelection.add(ti);
  else chartSelection.delete(ti);
  renderChartModal(true);
}
function chartPickPreset(kind) {
  const order = ranked().map((r) => r.index);
  chartSelection =
    kind === "all"
      ? new Set(order)
      : kind === "none"
        ? new Set()
        : new Set(order.slice(0, kind === "top3" ? 3 : 5));
  renderChartModal();
}

function renderChartModal(keepFocus) {
  const o = document.getElementById("chartOverlay");
  if (!o) return;
  const prevFocus = keepFocus && document.activeElement?.id;
  const { labels, series } = progressionData();
  const order = ranked().map((r) => r.index);
  const chips = order
    .map((ti) => {
      const s = series[ti];
      const on = chartSelection.has(ti);
      const col = CHART_COLORS[order.indexOf(ti) % CHART_COLORS.length];
      return (
        `<label class="ht-chip${on ? " on" : ""}"><input type="checkbox" id="chartTeam${ti}" ${on ? "checked" : ""} onchange="chartPick(${ti},this.checked)">` +
        `<span class="ht-dot" style="background:${col}" aria-hidden="true"></span>${esc(s.name)}</label>`
      );
    })
    .join("");
  o.innerHTML =
    `<div class="audit-modal ht-modal ht-modal-wide" role="dialog" aria-modal="true" aria-label="Score progression">` +
    `<div class="ht-head"><h2>Score progression</h2><button type="button" class="btn" onclick="closeProgressChart()">Close</button></div>` +
    (labels.length
      ? `<canvas id="chartCanvas" class="ht-canvas" width="1200" height="675" role="img" aria-label="${esc(chartAltText(series, labels))}"></canvas>`
      : `<p class="fr-note">Score a round to see how the teams are progressing.</p>`) +
    `<div class="ht-presets"><span class="ht-sub">Teams</span>` +
    `<button type="button" class="btn" onclick="chartPickPreset('top3')">Top 3</button>` +
    `<button type="button" class="btn" onclick="chartPickPreset('top5')">Top 5</button>` +
    `<button type="button" class="btn" onclick="chartPickPreset('all')">All</button>` +
    `<button type="button" class="btn" onclick="chartPickPreset('none')">None</button></div>` +
    `<div class="ht-chips">${chips}</div>` +
    (labels.length
      ? `<div class="ht-actions"><button type="button" class="btn btn-accent" onclick="downloadChartImage()">Download image</button>` +
        `<button type="button" class="btn" id="chartCopyBtn" onclick="copyChartImage()" hidden>Copy image</button>` +
        `<button type="button" class="btn" id="chartShareBtn" onclick="shareChartImage()" hidden>Share…</button></div>`
      : "") +
    `</div>`;
  const share = document.getElementById("chartShareBtn");
  if (share && navigator.canShare && typeof File === "function")
    share.hidden = false;
  const copy = document.getElementById("chartCopyBtn");
  if (copy && navigator.clipboard && typeof ClipboardItem === "function")
    copy.hidden = false;
  drawChartCanvas();
  if (prevFocus) document.getElementById(prevFocus)?.focus();
}

function chartAltText(series, labels) {
  const picked = series.filter((s) => chartSelection.has(s.index));
  if (!picked.length || !labels.length) return "No teams selected";
  return (
    "Line chart of running score after " +
    labels.join(", ") +
    ". " +
    picked
      .map((s) => s.name + " finishes at " + s.pts[s.pts.length - 1])
      .join("; ")
  );
}

// Picks "nice" y-axis tick values covering [0, max] in roughly `want` steps.
function niceTicks(min, max, want) {
  const span = Math.max(1, max - min);
  const raw = span / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

// The one renderer for both the on-screen preview and the exported PNG. Always drawn on a fixed
// dark card (not the app theme) so the image looks and reads the same wherever it is shared.
function drawChartCanvas(canvasArg) {
  const cv = canvasArg || document.getElementById("chartCanvas");
  const ctx = cv && cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  const { labels, series } = progressionData();
  const order = ranked().map((r) => r.index);
  const picked = order.filter((ti) => chartSelection.has(ti));
  const W = cv.width,
    H = cv.height;
  const BG = "#111418",
    FG = "#F2F4F7",
    MUTED = "#A9B0BB",
    GRID = "#2A2F37";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  const font = (px, w) => `${w || 400} ${px}px Inter, system-ui, sans-serif`;

  // Header
  ctx.fillStyle = FG;
  ctx.font = font(34, 700);
  ctx.fillText("Score progression", 40, 56);
  const sub = [gameState.meta.location, isoToPretty(gameState.meta.date)]
    .filter(Boolean)
    .join("  ·  ");
  if (sub) {
    ctx.fillStyle = MUTED;
    ctx.font = font(20, 400);
    ctx.fillText(sub, 40, 86);
  }

  // Plot area (left) and legend column (right)
  const legendW = 330;
  const px0 = 90,
    px1 = W - legendW - 50,
    py0 = 120,
    py1 = H - 70;
  if (!picked.length) {
    ctx.fillStyle = MUTED;
    ctx.font = font(24, 400);
    ctx.fillText("Pick one or more teams below", px0, (py0 + py1) / 2);
    return;
  }
  let max = 0,
    min = 0;
  picked.forEach((ti) =>
    series[ti].pts.forEach((v) => {
      if (v > max) max = v;
      if (v < min) min = v;
    }),
  );
  const ticks = niceTicks(min, max, 5);
  const yMin = ticks[0],
    yMax = ticks[ticks.length - 1];
  const X = (i) =>
    labels.length === 1
      ? (px0 + px1) / 2
      : px0 + ((px1 - px0) * i) / (labels.length - 1);
  const Y = (v) => py1 - ((py1 - py0) * (v - yMin)) / (yMax - yMin || 1);

  ctx.font = font(18, 400);
  ctx.textAlign = "right";
  ticks.forEach((v) => {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px0, Y(v));
    ctx.lineTo(px1, Y(v));
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(String(v), px0 - 12, Y(v) + 6);
  });
  ctx.textAlign = "center";
  labels.forEach((l, i) => {
    ctx.fillStyle = MUTED;
    ctx.fillText(l, X(i), py1 + 32);
  });
  ctx.textAlign = "left";

  // Lines. Colors follow the team's overall rank so the legend order and colors line up.
  picked.forEach((ti) => {
    const rank = order.indexOf(ti);
    const col = CHART_COLORS[rank % CHART_COLORS.length];
    const pts = series[ti].pts;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.setLineDash(CHART_DASHES[rank % CHART_DASHES.length]);
    ctx.beginPath();
    pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(X(i), Y(v), 6, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Legend: ranked best-first, with the final score. Row height shrinks to fit many teams, and
  // anything that still will not fit is summarized rather than clipped.
  const lx = W - legendW - 10;
  const avail = H - 120 - 40;
  const rowH = Math.min(34, avail / Math.max(1, picked.length));
  const fs = Math.max(12, Math.min(20, Math.floor(rowH * 0.62)));
  const fit = Math.max(1, Math.floor(avail / Math.max(rowH, 18)));
  const shown = picked.length > fit ? picked.slice(0, fit - 1) : picked;
  shown.forEach((ti, n) => {
    const y = 140 + n * Math.max(rowH, 18);
    const rank = order.indexOf(ti);
    ctx.fillStyle = CHART_COLORS[rank % CHART_COLORS.length];
    ctx.fillRect(lx, y - fs * 0.7, 14, 14);
    ctx.fillStyle = FG;
    ctx.font = font(fs, 400);
    let nm = series[ti].name;
    const maxNameW = legendW - 120;
    while (nm.length > 1 && ctx.measureText(nm).width > maxNameW)
      nm = nm.slice(0, -1);
    if (nm !== series[ti].name) nm = nm.trimEnd() + "…";
    ctx.textAlign = "left";
    ctx.fillText(nm, lx + 24, y + 4);
    ctx.textAlign = "right";
    ctx.font = font(fs, 700);
    const pts = series[ti].pts;
    ctx.fillText(String(pts[pts.length - 1]), lx + legendW - 14, y + 4);
  });
  if (shown.length < picked.length) {
    ctx.textAlign = "left";
    ctx.fillStyle = MUTED;
    ctx.font = font(fs, 400);
    ctx.fillText(
      "+" + (picked.length - shown.length) + " more",
      lx + 24,
      140 + shown.length * Math.max(rowH, 18) + 4,
    );
  }
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = font(16, 400);
  ctx.fillText("Scorekeeper · triviarevolution.com", W - 40, H - 22);
  ctx.textAlign = "left";
}

function chartImageName() {
  const d = gameState.meta.date || new Date().toISOString().slice(0, 10);
  return "score-progression-" + d + ".png";
}
// Draws a fresh full-size canvas (never the on-screen element, which CSS may scale) and hands
// back the PNG blob.
function chartImageBlob() {
  return new Promise((resolve) => {
    const cv = document.createElement("canvas");
    cv.width = 1200;
    cv.height = 675;
    drawChartCanvas(cv);
    if (!cv.toBlob) return resolve(null);
    cv.toBlob((b) => resolve(b), "image/png");
  });
}
async function downloadChartImage() {
  const b = await chartImageBlob();
  if (!b) return appAlert("Your browser could not create the image.");
  dl(b, chartImageName());
}
async function copyChartImage() {
  const b = await chartImageBlob();
  if (!b) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
    announce("Chart image copied");
  } catch (e) {
    appAlert("Could not copy the image — use Download image instead.");
  }
}
async function shareChartImage() {
  const b = await chartImageBlob();
  if (!b) return;
  const file = new File([b], chartImageName(), { type: "image/png" });
  try {
    if (navigator.canShare({ files: [file] }))
      await navigator.share({ files: [file], title: "Score progression" });
    else dl(b, chartImageName());
  } catch (e) {
    /* share sheet dismissed */
  }
}

// ---------------------------------------------------------------------------------------------
// Backups (Settings > Backups): restore one of the rolling snapshots from js/storage.js
// ---------------------------------------------------------------------------------------------
const BACKUP_WHY = {
  question: "After a question",
  timer: "Every 3 minutes",
  restore: "Before a restore",
};
function backupWhen(ts) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function openBackups() {
  const o = ensureOverlay("backupsOverlay");
  const list = loadBackups();
  o.innerHTML =
    `<div class="audit-modal ht-modal" role="dialog" aria-modal="true" aria-label="Backups">` +
    `<div class="ht-head"><h2>Backups</h2><button type="button" class="btn" onclick="closeBackups()">Close</button></div>` +
    `<p class="fr-note">The last ${BACKUP_MAX} snapshots, saved after each finished question and every 3 minutes while a game is running. Restoring replaces the current game (it is backed up first).</p>` +
    (list.length
      ? `<ul class="ht-backups">` +
        list
          .map(
            (b, i) =>
              `<li><div class="ht-b-info"><b>${esc(backupWhen(b.ts))}</b><span>${esc(BACKUP_WHY[b.why] || b.why)} · ${b.q} question${b.q === 1 ? "" : "s"} scored · ${b.teams} team${b.teams === 1 ? "" : "s"}</span></div>` +
              `<button type="button" class="btn" onclick="restoreBackup(${i})">Restore</button></li>`,
          )
          .join("") +
        `</ul>`
      : `<p class="fr-note">No backups yet — the first one is saved when a question is fully scored.</p>`) +
    `</div>`;
  o.classList.add("show");
}
function closeBackups() {
  document.getElementById("backupsOverlay")?.classList.remove("show");
}
async function restoreBackup(i) {
  const entry = loadBackups()[i];
  if (!entry) return;
  const ok = await appConfirm(
    "Restore the backup from " +
      backupWhen(entry.ts) +
      "? This replaces the game on screen with that snapshot (" +
      entry.q +
      " question" +
      (entry.q === 1 ? "" : "s") +
      " scored). The current game is backed up first.",
    { okLabel: "Restore" },
  );
  if (!ok) return;
  let restored;
  try {
    restored = migrateState(JSON.parse(entry.state));
  } catch (e) {
    return appAlert("That backup could not be read.");
  }
  addBackup("restore", TRStore.getItem(STORAGE_KEY));
  gameState = restored;
  resetBoardUi();
  autosave();
  renderAll();
  closeBackups();
  closeSettingsPanel();
  announce("Backup restored");
}
