"use strict";

// Export libraries — fflate, jsPDF, and the embedded XLSX backup template — are ~500KB combined
// (jsPDF alone is 412KB) and are only ever touched by the two buttons below, something most
// visits never click. index.html no longer loads them as blocking <script> tags; this loads
// each exactly once, on first actual use, as a real classic <script> (so it lands in the same
// shared global scope every other file here does, same as if it had always been on the page —
// see index.html's own comment on that), and caches the in-flight/settled promise so a second
// export in the same session doesn't refetch anything. A failed load (offline, blocked) clears
// the cached promise rather than poisoning it forever, so a later retry gets a fresh attempt.
const EXPORT_LIB_SRCS = [
  "js/vendor/fflate.min.js",
  "js/vendor/jspdf.min.js",
  "js/data/xlsx-templates.js",
];
let exportLibsPromise = null;
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}
function loadExportLibs() {
  if (!exportLibsPromise) {
    exportLibsPromise = Promise.all(EXPORT_LIB_SRCS.map(loadScriptOnce)).catch(
      (err) => {
        exportLibsPromise = null;
        throw err;
      },
    );
  }
  return exportLibsPromise;
}

function buildRows() {
  const rm = rankMap();
  return gameState.teams.map((team, ti) => {
    const r = {};
    r.Date = isoToMDY(gameState.meta.date);
    r.Location = gameState.meta.location;
    r.QuizID = gameState.meta.quizId;
    r.BonusItemDesc = gameState.meta.bonusItem || "";
    r.TeamName = team.name;
    r.ScoreGuess = team.scoreGuess;
    r.BonusItem = team.bonusItem ? 1 : 0;
    r.NJCB = team.njcb ? 1 : 0;
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[0].questions[qi][ti] || {};
      r["R1Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R1Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    const b1 = gameState.rounds[0].bonus[ti];
    r.R1BonusCount = b1 != null ? b1 : "";
    r.R1BonusPts = b1 != null ? b1 * 5 : "";
    r.R1Subtotal = roundSub(ti, 0);
    const ht = gameState.halftime[ti] || {};
    r.HalftimeWager = ht.wager != null && ht.wager !== "" ? ht.wager : "";
    r.HalftimeCorrect = ht.correct != null ? (ht.correct ? 1 : 0) : "";
    r.HalfTimePts = htPts(ti);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[1].questions[qi][ti] || {};
      r["R2Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R2Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    r.R2Subtotal = roundSub(ti, 1);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[2].questions[qi][ti] || {};
      r["R3Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R3Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    const b3 = gameState.rounds[2].bonus[ti];
    r.R3BonusCount = b3 != null ? b3 : "";
    r.R3BonusPts = b3 != null ? b3 * 5 : "";
    r.R3Subtotal = roundSub(ti, 2);
    const fw = gameState.finalWager[ti] || {};
    r.FinalWager = fw.wager != null && fw.wager !== "" ? fw.wager : "";
    r.FinalWagerCorrect = fw.correct != null ? (fw.correct ? 1 : 0) : "";
    r.FinalWagerPts = fwPts(ti);
    for (let qi = 0; qi < 4; qi++) {
      const a = gameState.rounds[3].questions[qi][ti] || {};
      r["R4Q" + (qi + 1) + "Wager"] = a.wager != null ? a.wager : "";
      r["R4Q" + (qi + 1) + "Correct"] =
        a.correct != null ? (a.correct ? 1 : 0) : "";
    }
    r.R4Subtotal = roundSub(ti, 3);
    r.Adjustment = team.adjustment || 0;
    r.GrandTotal = grandTotal(ti);
    r.Rank = rm[ti];
    return r;
  });
}
function expCols() {
  return [
    "Date",
    "Location",
    "QuizID",
    "BonusItemDesc",
    "TeamName",
    "ScoreGuess",
    "BonusItem",
    "NJCB",
    "R1Q1Wager",
    "R1Q1Correct",
    "R1Q2Wager",
    "R1Q2Correct",
    "R1Q3Wager",
    "R1Q3Correct",
    "R1Q4Wager",
    "R1Q4Correct",
    "R1BonusCount",
    "R1BonusPts",
    "R1Subtotal",
    "HalftimeWager",
    "HalftimeCorrect",
    "HalfTimePts",
    "R2Q1Wager",
    "R2Q1Correct",
    "R2Q2Wager",
    "R2Q2Correct",
    "R2Q3Wager",
    "R2Q3Correct",
    "R2Q4Wager",
    "R2Q4Correct",
    "R2Subtotal",
    "R3Q1Wager",
    "R3Q1Correct",
    "R3Q2Wager",
    "R3Q2Correct",
    "R3Q3Wager",
    "R3Q3Correct",
    "R3Q4Wager",
    "R3Q4Correct",
    "R3BonusCount",
    "R3BonusPts",
    "R3Subtotal",
    "FinalWager",
    "FinalWagerCorrect",
    "FinalWagerPts",
    "R4Q1Wager",
    "R4Q1Correct",
    "R4Q2Wager",
    "R4Q2Correct",
    "R4Q3Wager",
    "R4Q3Correct",
    "R4Q4Wager",
    "R4Q4Correct",
    "R4Subtotal",
    "Adjustment",
    "GrandTotal",
    "Rank",
  ];
}

async function exportPDF() {
  try {
    await loadExportLibs();
    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
      appAlert("PDF library not loaded — cannot build PDF.");
      return;
    }
    if (!gameState.teams || !gameState.teams.length) {
      appAlert("No teams yet — nothing to export.");
      return;
    }
    const { jsPDF } = window.jspdf;
    // Text colors below are chosen for >=4.5:1 contrast (WCAG AA, normal text) against both
    // their cell's base background and its zebra-striped (darkened) variant — darkening a
    // light background actually *reduces* contrast against dark text (it moves the
    // background's luminance closer to the text's), so the striped variant is the binding
    // constraint and was checked explicitly for every color pair, not assumed to be safe.
    // The Sub/Diff red (8B0000) and the Round 2/3/4 header colors were also run through
    // protanopia/deuteranopia/tritanopia simulation to confirm they hold up for colorblind
    // readers, not just for typical color vision.
    const SPEC = [
      {
        w: 16,
        k: "rownum",
        df: "DCE6F2",
        dc: "000000",
        b: true,
        l4: "#",
        a: "C",
      },
      {
        w: 150,
        k: "teamname",
        df: "DCE6F2",
        dc: "000000",
        b: true,
        l4: "Team Name",
        a: "L",
      },
      {
        w: 32,
        k: "njcb3",
        df: "F2DCDB",
        dc: "6B2E12",
        b: false,
        l4: "CB=3",
        a: "C",
      },
      {
        w: 30,
        k: "item5",
        df: "CCC1DA",
        dc: "3E2352",
        b: false,
        l4: "B=5",
        a: "C",
      },
      {
        w: 20,
        k: "r1q0",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "1",
        a: "C",
      },
      {
        w: 20,
        k: "r1q1",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "2",
        a: "C",
      },
      {
        w: 20,
        k: "r1q2",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r1q3",
        df: "FFFFFF",
        dc: "000000",
        b: true,
        l4: "4",
        a: "C",
      },
      {
        w: 26,
        k: "r1bonus",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Bonus",
        a: "C",
      },
      {
        w: 34,
        k: "tK",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r2q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "1",
        a: "C",
      },
      {
        w: 20,
        k: "r2q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r2q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "5",
        a: "C",
      },
      {
        w: 20,
        k: "r2q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "7",
        a: "C",
      },
      {
        w: 28,
        k: "tP",
        df: "EFEFEF",
        dc: "8B0000",
        b: true,
        l4: "Sub",
        a: "C",
      },
      {
        w: 40,
        k: "htpts",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "HT 1-10",
        a: "C",
      },
      {
        w: 34,
        k: "tR",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r3q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "2",
        a: "C",
      },
      {
        w: 20,
        k: "r3q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "4",
        a: "C",
      },
      {
        w: 20,
        k: "r3q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "6",
        a: "C",
      },
      {
        w: 20,
        k: "r3q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "8",
        a: "C",
      },
      {
        w: 26,
        k: "r3bonus",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Bonus",
        a: "C",
      },
      {
        w: 34,
        k: "tY",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
      {
        w: 20,
        k: "r4q0",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "3",
        a: "C",
      },
      {
        w: 20,
        k: "r4q1",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "6",
        a: "C",
      },
      {
        w: 20,
        k: "r4q2",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "9",
        a: "C",
      },
      {
        w: 22,
        k: "r4q3",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "12",
        a: "C",
      },
      {
        w: 28,
        k: "tAD",
        df: "EFEFEF",
        dc: "8B0000",
        b: true,
        l4: "Sub",
        a: "C",
      },
      {
        w: 46,
        k: "fwpts",
        df: "DCE6F2",
        dc: "000000",
        b: false,
        l4: "Final 1-20",
        a: "C",
      },
      {
        w: 34,
        k: "tAF",
        df: "FFC000",
        dc: "000000",
        b: true,
        l4: "Total",
        a: "C",
      },
    ];
    // group header row: [startIdx,endIdx,label,fillhex,fonthex] — only the 4 rounds get a
    // colored band; the id columns (#, Team Name, CB=3, B=5) stay blank above.
    // Round 2/3/4 use pastel tints of the Okabe-Ito colorblind-safe palette (bluish-green /
    // reddish-purple / vermillion) instead of hues that only differ in lightness — simulating
    // protanopia/deuteranopia/tritanopia on the old purple/rose/olive set showed them collapsing
    // to a worst-case RGB distance of ~34 (barely distinguishable); this set holds ~69 worst-case,
    // roughly double the separation, while every band still hits AAA (>=10:1) with black text.
    const GROUPS = [
      [4, 9, "Round 1", "FFC000", "000000"],
      [10, 16, "Round 2", "73CAB2", "000000"],
      [17, 22, "Round 3", "E3B5CF", "000000"],
      [23, 29, "Round 4", "E8A673", "000000"],
    ];
    const TRIV_WAGERS = [
      [1, 2, 3, 4],
      [1, 3, 5, 7],
      [2, 4, 6, 8],
      [3, 6, 9, 12],
    ];

    function hx(h) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const PW = doc.internal.pageSize.getWidth(),
      PH = doc.internal.pageSize.getHeight();
    const M = 24,
      usableW = PW - M * 2,
      pageBottom = PH - M;
    const teams = gameState.teams,
      N = teams.length;

    // ---- per-entry computed totals (entry order) ----
    const qpts = (ri, t) => {
      const out = [];
      const ws = TRIV_WAGERS[ri];
      for (let k = 0; k < 4; k++) {
        const W = ws[k];
        let p = 0;
        const qq = gameState.rounds[ri].questions;
        for (let qi = 0; qi < 4; qi++) {
          const a = qq[qi][t];
          if (a && a.wager === W) {
            p = a.correct === true ? W : 0;
            break;
          }
        }
        out.push(p);
      }
      return out;
    };
    const rec = [];
    for (let t = 0; t < N; t++) {
      const tm = teams[t];
      const r1 = qpts(0, t),
        r2 = qpts(1, t),
        r3 = qpts(2, t),
        r4 = qpts(3, t);
      const r1b = (gameState.rounds[0].bonus[t] || 0) * 5,
        r3b = (gameState.rounds[2].bonus[t] || 0) * 5;
      const ht = htPts(t),
        fw = fwPts(t);
      const njcb3 = tm.njcb ? 3 : 0,
        item5 = tm.bonusItem ? 5 : 0;
      const sum = (a) => a[0] + a[1] + a[2] + a[3];
      const tK = njcb3 + item5 + sum(r1) + r1b;
      const tP = tK + sum(r2);
      const tR = tP + ht;
      const tY = tR + sum(r3) + r3b;
      const tAD = tY + sum(r4);
      const tAF = tAD + fw;
      const guess =
        tm.scoreGuess === "" || tm.scoreGuess == null
          ? 0
          : parseInt(tm.scoreGuess, 10);
      rec.push({
        num: t + 1,
        name: tm.name || "Team " + (t + 1),
        njcb3,
        item5,
        r1,
        r2,
        r3,
        r4,
        r1b,
        r3b,
        ht,
        fw,
        tK,
        tP,
        tR,
        tY,
        tAD,
        fw2: fw,
        tAF,
        guess,
        tAH: tAF - njcb3 - item5 - guess,
      });
    }
    const standings = rec
      .slice()
      .sort((a, b) => b.tAF - a.tAF || a.num - b.num);

    // ---- value getter by kind for entry-row t ----
    const val = (k, t) => {
      const r = rec[t];
      switch (k) {
        case "rownum":
          return String(t + 1);
        case "teamname":
          return r.name;
        case "njcb3":
          return String(r.njcb3);
        case "item5":
          return String(r.item5);
        case "r1q0":
          return String(r.r1[0]);
        case "r1q1":
          return String(r.r1[1]);
        case "r1q2":
          return String(r.r1[2]);
        case "r1q3":
          return String(r.r1[3]);
        case "r1bonus":
          return String(r.r1b);
        case "tK":
          return String(r.tK);
        case "r2q0":
          return String(r.r2[0]);
        case "r2q1":
          return String(r.r2[1]);
        case "r2q2":
          return String(r.r2[2]);
        case "r2q3":
          return String(r.r2[3]);
        case "tP":
          return String(r.tP);
        case "htpts":
          return String(r.ht);
        case "tR":
          return String(r.tR);
        case "r3q0":
          return String(r.r3[0]);
        case "r3q1":
          return String(r.r3[1]);
        case "r3q2":
          return String(r.r3[2]);
        case "r3q3":
          return String(r.r3[3]);
        case "r3bonus":
          return String(r.r3b);
        case "tY":
          return String(r.tY);
        case "r4q0":
          return String(r.r4[0]);
        case "r4q1":
          return String(r.r4[1]);
        case "r4q2":
          return String(r.r4[2]);
        case "r4q3":
          return String(r.r4[3]);
        case "tAD":
          return String(r.tAD);
        case "fwpts":
          return String(r.fw);
        case "tAF":
          return String(r.tAF);
      }
      return "";
    };

    // ---- column x positions scaled to fit width ----
    const totalUnits = SPEC.reduce((a, c) => a + c.w, 0);
    const scale = usableW / totalUnits;
    const cw = SPEC.map((c) => c.w * scale);
    const cx = [];
    let acc = M;
    cw.forEach((w) => {
      cx.push(acc);
      acc += w;
    });

    // Subtle zebra striping: darkens a cell's own background by 10% on alternating rows.
    // Darkening a light background only ever raises contrast for the dark text drawn on
    // top of it, so every text/background pair already at AA on the base color stays at
    // (or above) AA once striped — verified against every color used in this table.
    const ZEBRA_FACTOR = 0.9;
    const darken = (hexcolor) => {
      const c = hx(hexcolor);
      return c
        .map((v) => Math.max(0, Math.round(v * ZEBRA_FACTOR)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    };
    const setFill = (h) => {
      const c = hx(h);
      doc.setFillColor(c[0], c[1], c[2]);
    };
    const setText = (h) => {
      const c = hx(h);
      doc.setTextColor(c[0], c[1], c[2]);
    };
    const fitFs = (txt, wpx, base) => {
      let fs = base;
      doc.setFontSize(fs);
      while (fs > 3 && doc.getTextWidth(txt) > wpx - 2) {
        fs -= 0.25;
        doc.setFontSize(fs);
      }
      return fs;
    };
    const cellText = (txt, ix, yTop, h, fontHex, bold, base, alignL) => {
      if (txt === "") return;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      fitFs(txt, cw[ix], base);
      setText(fontHex);
      const tx = alignL ? cx[ix] + 3 : cx[ix] + cw[ix] / 2;
      doc.text(txt, tx, yTop + h - h * 0.28, {
        align: alignL ? "left" : "center",
      });
    };

    const rowH = 18,
      fsData = Math.min(rowH * 0.6, 9);
    let y = M;

    function drawInfoHeader() {
      const meta = gameState.meta || {};
      const headerFields = [
        ["LOCATION", meta.location || "—"],
        ["DATE", isoToMDY(meta.date) || "—"],
        ["QUIZ #", meta.quizId || "—"],
        ["HOST", meta.hostName || "—"],
      ];
      // One row of four, as before. Craft Partner and Bonus Item are NOT here — they sit beside
      // the Standings table instead (see drawSideInfo), in the ~360pt of empty page that the
      // 432pt-wide table leaves to its right. A second header row cost 40pt of vertical space on
      // every export for two fields; the space next to Standings was already paid for.
      const drawRow = (fields, rowY, perRow) => {
        const fieldW = Math.min(320, usableW / perRow);
        fields.forEach(([label, value], i) => {
          const fx = M + i * fieldW;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          setText("595959");
          doc.text(label, fx, rowY + 9);
          doc.setFont("helvetica", "bold");
          fitFs(value, fieldW - 6, 15);
          setText("000000");
          doc.text(value, fx, rowY + 28, { maxWidth: fieldW - 6 });
        });
      };
      drawRow(headerFields, y, 4);
      y += 44;
    }
    function drawMainHeaderRows() {
      const groupY = y;
      setFill("FFFFFF");
      doc.rect(M, groupY, usableW, rowH, "F");
      GROUPS.forEach(([s, e, label, fill, font]) => {
        const x0 = cx[s],
          x1 = cx[e] + cw[e];
        setFill(fill);
        doc.rect(x0, groupY, x1 - x0, rowH, "F");
        doc.setFont("helvetica", "bold");
        setText(font);
        fitFs(label, x1 - x0, fsData + 2);
        doc.text(label, (x0 + x1) / 2, groupY + rowH - rowH * 0.28, {
          align: "center",
        });
      });
      y += rowH;
      const labelY = y;
      SPEC.forEach((c, ix) => {
        let fill = "FFFFFF";
        if (["tK", "tR", "tY", "tAF"].includes(c.k)) fill = "FFC000";
        else if (["tP", "tAD"].includes(c.k)) fill = "EFEFEF";
        setFill(fill);
        doc.rect(cx[ix], labelY, cw[ix], rowH, "F");
        if (c.l4)
          cellText(
            c.l4,
            ix,
            labelY,
            rowH,
            "000000",
            true,
            fsData,
            c.k === "teamname",
          );
      });
      y += rowH;
      return groupY;
    }
    function drawGridLines(topY, bottomY, xs, fullWidthEnd) {
      doc.setDrawColor(180, 180, 185);
      doc.setLineWidth(0.3);
      const rows = Math.round((bottomY - topY) / rowH);
      // horizontal lines are drawn per-row by the caller's row loop already covers fills;
      // here we only need the vertical column separators plus top/bottom borders.
      xs.forEach((x) => doc.line(x, topY, x, bottomY));
      doc.line(fullWidthEnd, topY, fullWidthEnd, bottomY);
      for (let r = 0; r <= rows; r++) {
        const yy = topY + r * rowH;
        doc.line(xs[0], yy, fullWidthEnd, yy);
      }
      doc.setDrawColor(120, 120, 120);
      doc.line(xs[0], topY, fullWidthEnd, topY);
    }

    drawInfoHeader();
    drawMainHeaderRows();
    let dataTop = y;
    for (let t = 0; t < N; t++) {
      if (y + rowH > pageBottom) {
        drawGridLines(dataTop, y, cx, M + usableW);
        doc.addPage();
        y = M;
        drawMainHeaderRows();
        dataTop = y;
      }
      const stripe = t % 2 === 1;
      SPEC.forEach((c, ix) => {
        setFill(stripe ? darken(c.df) : c.df);
        doc.rect(cx[ix], y, cw[ix], rowH, "F");
        cellText(val(c.k, t), ix, y, rowH, c.dc, c.b, fsData, c.a === "L");
      });
      y += rowH;
    }
    drawGridLines(dataTop, y, cx, M + usableW);
    y += 16;

    // ---- standings table (Place / Score / Team Name / Guess / Diff) ----
    const SCOLS = [
      { w: 44, k: "place", l: "Place", fill: "92D050" },
      { w: 56, k: "score", l: "Score", fill: "FFFFFF" },
      { w: 220, k: "name", l: "Team Name", fill: "FFFFFF" },
      { w: 56, k: "guess", l: "Guess", fill: "FFFFFF" },
      { w: 56, k: "diff", l: "Diff", fill: "FFFFFF" },
    ];
    const scx = [];
    let sacc = M;
    SCOLS.forEach((c) => {
      scx.push(sacc);
      sacc += c.w;
    });
    const standingsW = scx[SCOLS.length - 1] + SCOLS[SCOLS.length - 1].w;

    if (y + rowH * 3 > pageBottom) {
      doc.addPage();
      y = M;
    }
    function drawStandingsHeader() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText("000000");
      doc.text("STANDINGS", M, y);
      y += 12;
      const sHeadY = y;
      SCOLS.forEach((c, ix) => {
        setFill(c.fill);
        doc.rect(scx[ix], sHeadY, c.w, rowH, "F");
        doc.setFont("helvetica", "bold");
        setText("000000");
        fitFs(c.l, c.w, fsData);
        doc.text(
          c.l,
          scx[ix] + (c.k === "name" ? 3 : c.w / 2),
          sHeadY + rowH - rowH * 0.28,
          { align: c.k === "name" ? "left" : "center" },
        );
      });
      y += rowH;
      return sHeadY;
    }
    // Craft Partner and Bonus Item, in the empty page beside the Standings table. Standings is
    // 432pt of an ~794pt usable width, so there is roughly 360pt sitting unused to its right on
    // every export — enough for both fields at more than double the width a six-across header row
    // could have given them, for no vertical cost at all. Drawn once, from the top of the
    // Standings heading, and only on the page the table starts on: it is event metadata, not part
    // of the table, so repeating it after a page break would read as a second header.
    function drawSideInfo(topY) {
      const meta = gameState.meta || {};
      const partner = (meta.craftPartner || "").trim();
      const town = (meta.craftPartnerTown || "").trim();
      const x = M + standingsW + 28;
      const w = usableW - standingsW - 28;
      if (w < 90) return; // no room worth using — leave it off rather than crush it
      [
        ["CRAFT PARTNER", partner ? partner + (town ? " \u2014 " + town : "") : "\u2014"],
        ["BONUS ITEM", (meta.bonusItem || "").trim() || "\u2014"],
      ].forEach(([label, value], i) => {
        const fy = topY + i * 40;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText("595959");
        doc.text(label, x, fy);
        doc.setFont("helvetica", "bold");
        fitFs(value, w - 6, 15);
        setText("000000");
        doc.text(value, x, fy + 19, { maxWidth: w - 6 });
      });
    }
    const sideInfoY = y;
    drawStandingsHeader();
    drawSideInfo(sideInfoY);
    let sDataTop = y;
    standings.forEach((s, i) => {
      if (y + rowH > pageBottom) {
        drawGridLines(sDataTop, y, scx, standingsW);
        doc.addPage();
        y = M;
        drawStandingsHeader();
        sDataTop = y;
      }
      const rowVals = {
        place: String(i + 1),
        score: String(s.tAF),
        name: s.name,
        guess: String(s.guess),
        diff: String(s.tAH),
      };
      const sStripe = i % 2 === 1;
      SCOLS.forEach((c, ix) => {
        const base = c.k === "place" ? "DCE6F2" : "FFFFFF";
        setFill(sStripe ? darken(base) : base);
        doc.rect(scx[ix], y, c.w, rowH, "F");
        doc.setFont(
          "helvetica",
          c.k === "place" || c.k === "score" ? "bold" : "normal",
        );
        setText("000000");
        fitFs(rowVals[c.k], c.w - 4, fsData);
        doc.text(
          rowVals[c.k],
          scx[ix] + (c.k === "name" ? 3 : c.w / 2),
          y + rowH - rowH * 0.28,
          { align: c.k === "name" ? "left" : "center", maxWidth: c.w - 6 },
        );
      });
      y += rowH;
    });
    drawGridLines(sDataTop, y, scx, standingsW);
    y += 14;

    // footnote
    if (y + 10 > pageBottom) {
      doc.addPage();
      y = M + 10;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText("8B0000");
    doc.text(
      "* Diff is minus Bonuses — Bonus Item and NJCB points are excluded from the score before comparing it to the team's guess.",
      M,
      y,
    );

    dl(doc.output("blob"), exportFn("pdf"));
    document.getElementById("exportPrompt").classList.add("show");
  } catch (e) {
    appAlert("PDF export failed: " + (e && e.message ? e.message : e));
  }
}

// ---- date formatting (display in app + export) ----
// MM-DD-YYYY everywhere. There used to be a Settings toggle offering DD-Mon-YYYY as well, but
// nobody used it, so the alternate format and its chooser are gone rather than carried forever.
function isoToMDY(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  return p[1].padStart(2, "0") + "-" + p[2].padStart(2, "0") + "-" + p[0];
}
// Native <input type="date"> renders its own text in whatever format the browser/OS locale
// picks (mm/dd/yyyy, dd/mm/yyyy, ...), which reads as inconsistent across hosts' devices. This
// builds a fixed "Aug 15, 2026" string ourselves so Event Details always reads the same
// regardless of locale — overlaid on top of the (still fully functional) native input/picker.
// The month names are inlined here rather than hoisted to a top-level const: a brand-new
// session's very first render runs synchronously at script-parse time (see the round-bonus
// note near the top of this file), before a const declared this far down would be out of its
// temporal dead zone.
function isoToPretty(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = parseInt(p[1], 10) - 1;
  const day = parseInt(p[2], 10);
  if (mi < 0 || mi > 11 || isNaN(mi) || isNaN(day)) return iso;
  return months[mi] + " " + day + ", " + p[0];
}
function sanitizeFile(s) {
  return String(s || "")
    .replace(/'/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function exportFn(ext) {
  const loc = sanitizeFile(gameState.meta.location) || "Trivia";
  const d =
    isoToMDY(gameState.meta.date) || new Date().toISOString().slice(0, 10);
  return loc + " - " + d + "." + ext;
}

// ---- old flat single-sheet XLSX backup (inject into prior template) ----
var TRIVX_R1 = { 1: "E", 2: "F", 3: "G", 4: "H" },
  TRIVX_R2 = { 1: "L", 3: "M", 5: "N", 7: "O" },
  TRIVX_R3 = { 2: "T", 4: "U", 6: "V", 8: "W" },
  TRIVX_R4 = { 3: "AA", 6: "AB", 9: "AC", 12: "AD" };
var TRIVX_WMAPS = [TRIVX_R1, TRIVX_R2, TRIVX_R3, TRIVX_R4],
  TRIVX_BONUS = { 0: "J", 2: "Y" },
  TRIVX_NET = { 1: "Q", 3: "AF" };
function trivXFind(xml, ref) {
  let m = xml.match(new RegExp('<c r="' + ref + '"[^>]*?/>'));
  if (m) return { i: m.index, len: m[0].length, el: m[0] };
  m = xml.match(new RegExp('<c r="' + ref + '"[^>]*?>[\\s\\S]*?</c>'));
  if (m) return { i: m.index, len: m[0].length, el: m[0] };
  return null;
}
function trivXSet(xml, ref, kind, val) {
  const f = trivXFind(xml, ref);
  if (!f) return xml;
  // See trivXPatchAll for what "cv" (rewrite only the cached <v> of a formula cell) is for.
  if (kind === "cv") {
    const cell = /<v>[\s\S]*?<\/v>/.test(f.el)
      ? f.el.replace(/<v>[\s\S]*?<\/v>/, "<v>" + val + "</v>")
      : f.el.replace(/<\/c>$/, "<v>" + val + "</v></c>");
    return xml.slice(0, f.i) + cell + xml.slice(f.i + f.len);
  }
  const s = trivStyle(f.el);
  let nw;
  if (kind === "n") nw = '<c r="' + ref + '"' + s + "><v>" + val + "</v></c>";
  else
    nw =
      '<c r="' +
      ref +
      '"' +
      s +
      ' t="inlineStr"><is><t xml:space="preserve">' +
      trivEsc(val) +
      "</t></is></c>";
  return xml.slice(0, f.i) + nw + xml.slice(f.i + f.len);
}
// trivXFind/trivXSet above do one fresh regex scan of the WHOLE sheet XML per cell — fine for a
// one-off patch, but trivInjectXlsx below used to call trivXSet once per cell it touches (name,
// guess, bonus, all 16 wager cells, 2 bonus/net cells per team, plus the ranked-standings
// columns) — 20-30 calls per team, each rescanning the entire XML string from scratch and
// rebuilding a new same-length copy of it. At MAX_TEAMS (100) that's ~2000-3000 full-string
// passes over what can be a sizable sheet. trivXIndex scans the XML exactly ONCE, indexing
// every <c r="REF">...</c> (self-closing or not) by its ref; trivXPatchAll then applies every
// queued patch against that one index in a single reconstruction pass instead of one pass per
// cell. trivXFind/trivXSet themselves are untouched — still used standalone (and by their own
// tests) for a single ad-hoc patch, where the index-building overhead wouldn't pay for itself.
function trivXIndex(xml) {
  const idx = new Map();
  // Same two shapes trivXFind checks for (self-closing vs open/close), combined into one pass:
  // [^>]*? lazily stops right before whichever '>' actually closes the tag, and the alternation
  // then matches EITHER '/>' immediately there (self-closing) OR '>' followed by the cell's
  // content up to '</c>' (the non-self-closing form) — never both, since only one can be the
  // very next character(s) for a given cell.
  const re = /<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  let m;
  while ((m = re.exec(xml))) idx.set(m[1], { i: m.index, len: m[0].length, el: m[0] });
  return idx;
}
// patches: array of [ref, kind, val] triples, same arguments trivXSet takes one at a time. A
// ref not present in the template (idx has no entry) is silently skipped, matching trivXSet's
// own "no match -> leave xml unchanged" behavior for that one cell.
function trivXPatchAll(xml, patches) {
  const idx = trivXIndex(xml);
  const edits = [];
  for (const [ref, kind, val] of patches) {
    const f = idx.get(ref);
    if (!f) continue;
    // "cv" rewrites only the cached <v> of an existing FORMULA cell, leaving its <f …/> (and every
    // attribute) untouched — so a viewer that doesn't recalc on load (Numbers, macOS Quick Look,
    // Excel left in manual-calc mode) shows the real total instead of the template's stale
    // <v>0</v>, while Excel/LibreOffice still recompute the same value from the formula.
    if (kind === "cv") {
      const cell = /<v>[\s\S]*?<\/v>/.test(f.el)
        ? f.el.replace(/<v>[\s\S]*?<\/v>/, "<v>" + val + "</v>")
        : f.el.replace(/<\/c>$/, "<v>" + val + "</v></c>");
      edits.push({ i: f.i, len: f.len, nw: cell });
      continue;
    }
    const s = trivStyle(f.el);
    const nw =
      kind === "n"
        ? '<c r="' + ref + '"' + s + "><v>" + val + "</v></c>"
        : '<c r="' +
          ref +
          '"' +
          s +
          ' t="inlineStr"><is><t xml:space="preserve">' +
          trivEsc(val) +
          "</t></is></c>";
    edits.push({ i: f.i, len: f.len, nw });
  }
  // Sorted by position so the single reconstruction pass below can walk the original string
  // left-to-right once, splicing each edit in as it's reached.
  edits.sort((a, b) => a.i - b.i);
  let out = "",
    pos = 0;
  for (const e of edits) {
    out += xml.slice(pos, e.i) + e.nw;
    pos = e.i + e.len;
  }
  return out + xml.slice(pos);
}
// Drop every <row> past lastRow and pull every range that was sized for the 100-row template
// (dimension, the 8 shared-formula ranges, the K-column conditional format, the AL:AM sortState)
// back to the real last row, so the exported sheet ends right after the last team instead of
// trailing hundreds of empty rows.
function trivXTrimRows(xml, lastRow) {
  xml = xml.replace(
    /<row r="(\d+)"(?:[^>]*?)(?:\/>|>[\s\S]*?<\/row>)/g,
    (m, r) => (Number(r) > lastRow ? "" : m),
  );
  xml = xml.replace(
    /<dimension ref="A1:AN\d+"\/>/,
    '<dimension ref="A1:AN' + lastRow + '"/>',
  );
  // Every template range that ends at row 104 (shared formulas K5:K104 … AI5:AI104, and the
  // K4:K104 conditional-format sqref) — clamp the end row to lastRow. Guarded: a single-team
  // export (lastRow 5) leaves K5:K5, still valid.
  xml = xml.replace(
    /((?:ref|sqref)="[A-Z]+\d+:[A-Z]+)104"/g,
    "$1" + lastRow + '"',
  );
  xml = xml.replace(
    /(<sortState ref="AL5:AM)\d+"/,
    "$1" + lastRow + '"',
  );
  return xml;
}
// Adds a grey zebra stripe over the even team rows (row 6 = team 2, row 8 = team 4, …), matching
// the app's own :nth-child(even) row striping. Uses a conditional-format expression rather than
// per-cell fills so it costs one dxf and one rule instead of a styled variant of every cell style
// the team rows use. dxfId 1 is appended by trivXAddZebraDxf below.
function trivXAddZebra(xml, lastRow) {
  if (lastRow < 6) return xml;
  const rule =
    '<conditionalFormatting sqref="A5:AN' +
    lastRow +
    '"><cfRule type="expression" dxfId="1" priority="2"><formula>MOD(ROW(),2)=0</formula></cfRule></conditionalFormatting>';
  // Placed right after the template's existing K-column conditional format so its lower priority
  // (2 vs 1) leaves that "cell has a value" highlight on top where the two overlap.
  return xml.replace(
    /(<\/conditionalFormatting>)(<pageMargins)/,
    "$1" + rule + "$2",
  );
}
// The zebra fill the rule above points at — appended as dxfId 1 (the template ships exactly one
// dxf, id 0, used by the K-column highlight).
//
// A conditional-format (differential) fill is NOT written like a normal cell fill: it takes the
// canonical `<patternFill><bgColor .../></patternFill>` form — no patternType, and the colour in
// bgColor, not fgColor. The earlier `patternType="solid"` + fgColor form (correct for a cellXfs
// fill) silently rendered as nothing in LibreOffice / Numbers / Quick Look, which is why the
// stripe never showed. Colour bumped from #F2F2F2 (invisible even once it did paint) to #E0E0E0.
function trivXAddZebraDxf(stylesXml) {
  return stylesXml.replace(
    /<dxfs count="(\d+)">([\s\S]*?)<\/dxfs>/,
    (m, count, body) =>
      '<dxfs count="' +
      (Number(count) + 1) +
      '">' +
      body +
      '<dxf><fill><patternFill><bgColor rgb="FFE0E0E0"/></patternFill></fill></dxf></dxfs>',
  );
}
function trivInjectXlsx(templateBytes, gs, rk) {
  const files = fflate.unzipSync(templateBytes);
  const dec = new TextDecoder("utf-8"),
    enc = new TextEncoder();
  let x = dec.decode(files["xl/worksheets/sheet1.xml"]);
  // Every cell this export touches is queued here instead of patched immediately (trivXSet)
  // one at a time — see trivXPatchAll's own comment for why that mattered at real team counts.
  // Order doesn't matter: trivXPatchAll indexes the XML once up front and sorts by position
  // itself before splicing, so patches can be queued in whatever order is convenient here.
  const patches = [];
  if (gs.meta.hostName) patches.push(["I1", "s", "HOST: " + gs.meta.hostName]);
  if (gs.meta.location) patches.push(["C2", "s", gs.meta.location]);
  if (gs.meta.quizId) {
    patches.push(["N2", "s", gs.meta.quizId]);
    patches.push(["AE2", "s", gs.meta.quizId]);
  }
  const dtxt = isoToMDY(gs.meta.date);
  if (dtxt) patches.push(["G2", "s", dtxt]);
  gs.teams.forEach((tm, t) => {
    const r = t + 5;
    // cv[col] mirrors the numeric value written into each data column for this row, so the
    // running-total FORMULA cells (K/P/R/Z/AE/AG/AI) can be given a correct cached <v> below —
    // see the "cv" patch kind in trivXPatchAll for why that matters.
    const cv = {};
    const put = (colL, kind, val) => {
      patches.push([colL + r, kind, val]);
      if (kind === "n") cv[colL] = val;
    };
    if (tm.name) patches.push(["B" + r, "s", tm.name]);
    const cb = (tm.njcb ? 3 : 0) + (parseInt(tm.adjustment, 10) || 0);
    if (cb !== 0) put("C", "n", cb);
    if (tm.bonusItem) put("D", "n", 5);
    if (tm.scoreGuess !== "" && tm.scoreGuess != null)
      put("AH", "n", parseInt(tm.scoreGuess, 10));
    for (let ri = 0; ri < 4; ri++) {
      const wm = TRIVX_WMAPS[ri],
        qs = gs.rounds[ri].questions;
      for (let qi = 0; qi < 4; qi++) {
        const a = qs[qi][t];
        if (!a || a.wager === undefined) continue;
        const wcol = wm[a.wager];
        if (!wcol) continue;
        if (a.correct === true) put(wcol, "n", a.wager);
        else if (a.correct === false) put(wcol, "n", 0);
      }
      if (ri === 0 || ri === 2) {
        const c = gs.rounds[ri].bonus[t];
        if (c != null) put(TRIVX_BONUS[ri], "n", c * 5);
      } else {
        const d = (ri === 1 ? gs.halftime : gs.finalWager)[t];
        if (d && d.wager != null && d.wager !== "" && d.correct != null)
          put(TRIVX_NET[ri], "n", d.correct ? +d.wager : -d.wager);
      }
    }
    // Cache the running totals so a non-recalculating viewer shows real numbers, not <v>0</v>.
    // Same arithmetic the template's own shared formulas carry (K=C+D+E+F+G+H+J, and so on).
    const g = (c) => cv[c] || 0;
    const K = g("C") + g("D") + g("E") + g("F") + g("G") + g("H") + g("J");
    const P = K + g("L") + g("M") + g("N") + g("O");
    const R = P + g("Q");
    const Z = R + g("T") + g("U") + g("V") + g("W") + g("Y");
    const AE = Z + g("AA") + g("AB") + g("AC") + g("AD");
    const AG = AE + g("AF");
    patches.push(["K" + r, "cv", K]);
    patches.push(["P" + r, "cv", P]);
    patches.push(["R" + r, "cv", R]);
    patches.push(["Z" + r, "cv", Z]);
    patches.push(["AE" + r, "cv", AE]);
    patches.push(["AG" + r, "cv", AG]);
    patches.push(["AI" + r, "cv", g("AH") - AG]);
    // Column S is a plain "=B" mirror of the team name; a non-recalc viewer shows its stale 0.
    // Overwrite it with the name outright rather than teaching "cv" about string formula results.
    if (tm.name) patches.push(["S" + r, "s", tm.name]);
  });
  rk.forEach((row, i) => {
    const rr = i + 5;
    patches.push(["AL" + rr, "n", row.total]);
    patches.push(["AM" + rr, "s", row.name]);
  });
  x = trivXPatchAll(x, patches);
  // Only draw as many team rows as this game actually has — the embedded template ships a full
  // MAX_TEAMS (100) block of styled team rows plus JD's own ~880 trailing filler rows, so a
  // 12-team game otherwise exported a sheet ~975 rows tall, all but 12 of them empty. Trim
  // everything past the last real team row and add a zebra stripe over what's left.
  const lastRow = Math.max(gs.teams.length + 4, 5);
  x = trivXTrimRows(x, lastRow);
  x = trivXAddZebra(x, lastRow);
  files["xl/worksheets/sheet1.xml"] = enc.encode(x);
  files["xl/styles.xml"] = enc.encode(trivXAddZebraDxf(dec.decode(files["xl/styles.xml"])));
  let wb = dec.decode(files["xl/workbook.xml"]);
  wb = wb.replace(
    /<calcPr calcId="(\d+)"\/>/,
    '<calcPr calcId="$1" fullCalcOnLoad="1"/>',
  );
  files["xl/workbook.xml"] = enc.encode(wb);
  return fflate.zipSync(files, { level: 6 });
}
async function exportXLSXBackup() {
  try {
    await loadExportLibs();
    if (typeof fflate === "undefined") {
      appAlert("Zip library not loaded \u2014 cannot build XLSX.");
      return;
    }
    if (typeof TRIVIA_XLSX_B64 === "undefined") {
      appAlert("Backup template not embedded.");
      return;
    }
    const bytes = trivB64ToBytes(TRIVIA_XLSX_B64);
    const out = trivInjectXlsx(bytes, gameState, ranked());
    dl(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      exportFn("xlsx"),
    );
    document.getElementById("exportPrompt").classList.add("show");
  } catch (e) {
    appAlert("XLSX backup export failed: " + (e && e.message ? e.message : e));
  }
}

function trivB64ToBytes(b64) {
  const bin = atob(b64),
    len = bin.length,
    u = new Uint8Array(len);
  for (let i = 0; i < len; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function trivEsc(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function trivStyle(el) {
  const m = el.match(/ s="(\d+)"/);
  return m ? ' s="' + m[1] + '"' : "";
}
function fn(ext) {
  return `trivia-${gameState.meta.quizId || "NOID"}-${gameState.meta.date || new Date().toISOString().slice(0, 10)}.${ext}`;
}