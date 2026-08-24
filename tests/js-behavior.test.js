// JS behavior tests — real app code (js/shared-ui.js, js/app.js, js/tutorial.js, faq/js/*.js)
// loaded and exercised in jsdom via tests/helpers/load-app.js, not a reimplemented copy that
// could quietly drift from what actually ships. Grouped by area; each describe() shares one
// loaded window across its own tests for speed, since spinning up a fresh jsdom + a 2.5MB
// js/app.js is not free — see the file-level `before`/`after` in each block.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, loadFaqWindow, evalIn, ROOT } = require("./helpers/load-app");

// ============================================================================
// Shared UI (js/shared-ui.js) — the module this session's refactor extracted specifically
// because the app's and the FAQ's own copies of this logic had drifted and shipped two real
// bugs (see js/shared-ui.js's own top comment). These tests exercise BOTH pages' wrappers
// against the one real shared implementation.
// ============================================================================
describe("shared-ui: font size scale", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("SHARED_FONT_SIZES has 14 sizes, ascending", () => {
    const sizes = evalIn(window, "SHARED_FONT_SIZES");
    assert.equal(sizes.length, 14);
    for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1]);
  });
  it("SHARED_DEFAULT_SIZE_INDEX points at 15px (the app's documented default)", () => {
    const sizes = evalIn(window, "SHARED_FONT_SIZES");
    const di = evalIn(window, "SHARED_DEFAULT_SIZE_INDEX");
    assert.equal(sizes[di], 15);
  });
  it("js/app.js's FONT_SIZES is the exact same array object as SHARED_FONT_SIZES (not a copy)", () => {
    assert.ok(evalIn(window, "FONT_SIZES === SHARED_FONT_SIZES"));
  });
  it("adjustFontSize(1) increases the root font size by one step", () => {
    evalIn(window, "adjustFontSize(0)"); // reset to default first
    const before_ = window.getComputedStyle(window.document.documentElement).fontSize;
    window.adjustFontSize(1);
    const after_ = window.getComputedStyle(window.document.documentElement).fontSize;
    assert.equal(before_, "15px");
    assert.equal(after_, "16px");
  });
  it("adjustFontSize clamps at the top of the scale (repeated increases never exceed 30px)", () => {
    for (let i = 0; i < 30; i++) window.adjustFontSize(1);
    const size = window.getComputedStyle(window.document.documentElement).fontSize;
    assert.equal(size, "30px");
  });
  it("adjustFontSize clamps at the bottom of the scale (repeated decreases never go below 12px)", () => {
    for (let i = 0; i < 30; i++) window.adjustFontSize(-1);
    const size = window.getComputedStyle(window.document.documentElement).fontSize;
    assert.equal(size, "12px");
  });
  it("adjustFontSize(0) resets to the default 15px from anywhere on the scale", () => {
    window.adjustFontSize(1);
    window.adjustFontSize(1);
    window.adjustFontSize(0);
    assert.equal(
      window.getComputedStyle(window.document.documentElement).fontSize,
      "15px",
    );
  });
});

describe("shared-ui: Color Vision dropdown (main app's #cbSelect)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("starts closed", () => {
    assert.equal(
      window.document.getElementById("cbSelect").classList.contains("open"),
      false,
    );
  });
  it("toggleCvMenu(event) opens the menu and re-parents it to <body>", () => {
    window.toggleCvMenu({ stopPropagation() {} });
    const w = window.document.getElementById("cbSelect");
    const menu = window.document.querySelector(".cv-select-menu");
    assert.equal(w.classList.contains("open"), true);
    assert.equal(menu.parentElement.tagName, "BODY");
    assert.equal(menu.classList.contains("cv-open"), true);
  });
  it("the open menu's aria-expanded reflects open state on the button", () => {
    const btn = window.document.querySelector("#cbSelect .cv-select-btn");
    assert.equal(btn.getAttribute("aria-expanded"), "true");
  });
  it("the open menu is positioned with explicit left/top styles (the viewport-clamped placement math actually ran)", () => {
    const menu = window.document.querySelector(".cv-select-menu");
    assert.ok(menu.style.left.endsWith("px"));
    assert.ok(menu.style.top.endsWith("px"));
  });
  it("closeCvMenu() closes the menu and re-homes it back inside #cbSelect", () => {
    window.closeCvMenu();
    const w = window.document.getElementById("cbSelect");
    const menu = window.document.querySelector(".cv-select-menu");
    assert.equal(w.classList.contains("open"), false);
    assert.equal(menu.parentElement.id, "cbSelect");
    assert.equal(menu.classList.contains("cv-open"), false);
  });
  it("selectCvOption updates the closed button's label to the option's short name", () => {
    const li = window.document.querySelector('#cbSelect li[data-value="1"]');
    window.selectCvOption(li, "1");
    const label = window.document.querySelector("#cbSelect .cv-select-label");
    assert.equal(label.textContent, "Red-Green");
  });
  it("selectCvOption mirrors the chosen option's swatch pair into the closed button", () => {
    const swatch = window.document.querySelector("#cbSelect .cv-select-swatch");
    assert.ok(swatch.innerHTML.includes("cv-swatch"));
  });
  it("selecting Off clears the closed button's swatch (Off has no swatch pair of its own)", () => {
    const li = window.document.querySelector('#cbSelect li[data-value="0"]');
    window.selectCvOption(li, "0");
    const swatch = window.document.querySelector("#cbSelect .cv-select-swatch");
    assert.equal(swatch.innerHTML, "");
  });
  it("selectCvOption also applies the color-vision mode via data-cb on <html>", () => {
    const li = window.document.querySelector('#cbSelect li[data-value="2"]');
    window.selectCvOption(li, "2");
    assert.equal(window.document.documentElement.getAttribute("data-cb"), "2");
    // reset for any later test in this process
    window.selectCvOption(
      window.document.querySelector('#cbSelect li[data-value="0"]'),
      "0",
    );
  });
  it("the CV dropdown never positions itself past the right edge of the viewport (the bug this session fixed on the FAQ's own copy)", () => {
    window.toggleCvMenu({ stopPropagation() {} });
    const menu = window.document.querySelector(".cv-select-menu");
    const right = parseFloat(menu.style.left) + menu.getBoundingClientRect().width;
    assert.ok(right <= window.innerWidth - 8 + 1, `menu right edge ${right} vs viewport ${window.innerWidth}`);
    window.closeCvMenu();
  });
});

describe("shared-ui: Color Vision dropdown (FAQ's #faqCvSelect, same shared implementation)", () => {
  let window;
  before(async () => {
    window = await loadFaqWindow();
  });
  after(() => window.close());

  it("faqToggleCvMenu opens the menu and re-parents it to <body>, same as the app's", () => {
    window.faqToggleCvMenu({ stopPropagation() {} });
    const menu = window.document.querySelector(".cv-select-menu");
    assert.equal(menu.parentElement.tagName, "BODY");
  });
  it("faqSetCvSelectDisplay updates the FAQ's own closed-button label", () => {
    window.faqSetCvSelectDisplay("1");
    const label = window.document.querySelector("#faqCvSelect .cv-select-label");
    assert.equal(label.textContent, "Red-Green");
  });
  it("faqCloseCvMenu re-homes the menu back inside #faqCvSelect", () => {
    window.faqCloseCvMenu();
    assert.equal(
      window.document.querySelector(".cv-select-menu").parentElement.id,
      "faqCvSelect",
    );
  });
  it("the FAQ's dropdown never positions itself past the right edge either (the actual regression this session found and fixed)", () => {
    window.faqToggleCvMenu({ stopPropagation() {} });
    const menu = window.document.querySelector(".cv-select-menu");
    const right = parseFloat(menu.style.left) + menu.getBoundingClientRect().width;
    assert.ok(right <= window.innerWidth - 8 + 1);
    window.faqCloseCvMenu();
  });
});

// ============================================================================
// Theme migration (hc-dark/hc-light -> dark/light rename, this session) — a real returning
// visitor's browser has "hc-dark"/"hc-light" (or older "light"/"bw") stored under
// trivRev6_prefs; these tests simulate exactly that and check the renamed code still resolves
// it correctly instead of silently flipping their theme.
// ============================================================================
describe("theme migration: legacy stored values still resolve correctly", () => {
  const cases = [
    ["hc-dark", "dark"],
    ["hc-light", "light"],
    ["light", "light"],
    ["bw", "light"],
    ["dark", "dark"], // already-current value, not just a legacy alias
    ["light", "light"], // already-current value
    ["garbage-unknown-value", "dark"], // unrecognized falls back to dark, not light
    [undefined, "dark"], // no stored value at all
  ];
  for (const [stored, expected] of cases) {
    it(`main app: stored theme ${JSON.stringify(stored)} resolves to data-theme="${expected}"`, async () => {
      const window = await loadAppWindow();
      try {
        window.localStorage.setItem(
          "trivRev6_prefs",
          JSON.stringify({ theme: stored, sizeIndex: 3 }),
        );
        evalIn(window, "applyPrefs()");
        assert.equal(
          window.document.documentElement.getAttribute("data-theme"),
          expected,
        );
      } finally {
        window.close();
      }
    });
  }
  for (const [stored, expected] of cases) {
    it(`FAQ: stored theme ${JSON.stringify(stored)} resolves to data-theme="${expected}"`, async () => {
      const window = await loadFaqWindow();
      try {
        window.localStorage.setItem(
          "trivRev6_prefs",
          JSON.stringify({ theme: stored, sizeIndex: 3 }),
        );
        window.faqApplyDisplayPrefs();
        assert.equal(
          window.document.documentElement.getAttribute("data-theme"),
          expected,
        );
      } finally {
        window.close();
      }
    });
  }
});

// ============================================================================
// Confirm/Alert modal (this session's replacement for window.confirm()/alert())
// ============================================================================
describe("appConfirm / appAlert", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("appConfirm shows the overlay with the given message", async () => {
    const p = window.appConfirm("Are you sure?");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmOverlay").classList.contains("show"),
      true,
    );
    assert.equal(
      window.document.getElementById("confirmMessage").textContent,
      "Are you sure?",
    );
    window.confirmDialogRespond(true);
    assert.equal(await p, true);
  });
  it("appConfirm resolves false when Cancel is clicked", async () => {
    const p = window.appConfirm("Cancel me");
    await new Promise((r) => setTimeout(r, 10));
    window.document.getElementById("confirmCancelBtn").click();
    assert.equal(await p, false);
  });
  it("appConfirm resolves false on Escape", async () => {
    const p = window.appConfirm("Escape me");
    await new Promise((r) => setTimeout(r, 10));
    window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(await p, false);
  });
  it("the overlay closes after responding", async () => {
    assert.equal(
      window.document.getElementById("confirmOverlay").classList.contains("show"),
      false,
    );
  });
  it("appConfirm defaults the OK button label to 'Confirm'", async () => {
    const p = window.appConfirm("msg");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(window.document.getElementById("confirmOkBtn").textContent, "Confirm");
    window.confirmDialogRespond(true);
    await p;
  });
  it("appConfirm honors a custom okLabel", async () => {
    const p = window.appConfirm("msg", { okLabel: "Remove" });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(window.document.getElementById("confirmOkBtn").textContent, "Remove");
    window.confirmDialogRespond(true);
    await p;
  });
  it("appConfirm's danger option adds btn-danger to the OK button", async () => {
    const p = window.appConfirm("msg", { danger: true });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmOkBtn").classList.contains("btn-danger"),
      true,
    );
    window.confirmDialogRespond(true);
    await p;
  });
  it("appConfirm without danger does not add btn-danger", async () => {
    const p = window.appConfirm("msg");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmOkBtn").classList.contains("btn-danger"),
      false,
    );
    window.confirmDialogRespond(true);
    await p;
  });
  it("appAlert hides the Cancel button (nothing to cancel)", async () => {
    const p = window.appAlert("Just so you know");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmModal").classList.contains("confirm-alert"),
      true,
    );
    window.confirmDialogRespond(true);
    await p;
  });
  it("appAlert's OK label defaults to 'OK', not 'Confirm'", async () => {
    const p = window.appAlert("msg");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(window.document.getElementById("confirmOkBtn").textContent, "OK");
    window.confirmDialogRespond(true);
    await p;
  });
  it("a subsequent appConfirm after an appAlert clears the confirm-alert styling (Cancel comes back)", async () => {
    const p = window.appConfirm("msg2");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      window.document.getElementById("confirmModal").classList.contains("confirm-alert"),
      false,
    );
    window.confirmDialogRespond(true);
    await p;
  });
});

// ============================================================================
// Confirmed real app flows that route through appConfirm — regression coverage for the
// specific call sites this session converted off window.confirm()/alert().
// ============================================================================
describe("confirm-gated app actions", () => {
  it("removeTeam asks for confirmation and does nothing if declined", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        'gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();',
      );
      const before_ = evalIn(window, "gameState.teams.length");
      const p = window.removeTeam(0);
      await new Promise((r) => setTimeout(r, 10));
      window.document.getElementById("confirmCancelBtn").click();
      await p;
      assert.equal(evalIn(window, "gameState.teams.length"), before_);
    } finally {
      window.close();
    }
  });
  it("removeTeam actually removes the team once confirmed", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const before_ = evalIn(window, "gameState.teams.length");
      const p = window.removeTeam(0);
      await new Promise((r) => setTimeout(r, 10));
      window.document.getElementById("confirmOkBtn").click();
      await p;
      assert.equal(evalIn(window, "gameState.teams.length"), before_ - 1);
    } finally {
      window.close();
    }
  });
  it("removeTeam's confirm dialog uses danger styling (a destructive, unrecoverable action)", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      window.removeTeam(0);
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(
        window.document.getElementById("confirmOkBtn").classList.contains("btn-danger"),
        true,
      );
      window.document.getElementById("confirmCancelBtn").click();
    } finally {
      window.close();
    }
  });
  it("loadSampleGame populates gameState.teams once confirmed", async () => {
    const window = await loadAppWindow();
    try {
      window.loadSampleGame();
      await new Promise((r) => setTimeout(r, 10));
      window.document.getElementById("confirmOkBtn").click();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(evalIn(window, "gameState.teams.length"), 11);
    } finally {
      window.close();
    }
  });
  it("loadSampleGame does nothing if the confirm is cancelled", async () => {
    const window = await loadAppWindow();
    try {
      const before_ = evalIn(window, "gameState.teams.length");
      window.loadSampleGame();
      await new Promise((r) => setTimeout(r, 10));
      window.document.getElementById("confirmCancelBtn").click();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(evalIn(window, "gameState.teams.length"), before_);
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Drumroll audio pipeline — silent/roll/finale/horn were base64 text inlined in js/app.js
// (~2.1MB of it) until this session's extraction moved them to real files under assets/audio/,
// referenced directly instead of decoded into a Blob on first use. The fade clip is the one
// exception: its length depends on a Settings slider, so it's still synthesised at runtime from
// DRUM_FADESRC_B64 (js/data/drum-clips.js) — these tests are the safety net for that split, and
// for the runtime envelope math, which had no coverage at all before this.
// ============================================================================
describe("Drumroll audio pipeline", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("b64Bytes round-trips a known string through atob/charCode", () => {
    const b64 = Buffer.from("hello scorekeeper", "utf-8").toString("base64");
    const bytes = evalIn(window, `b64Bytes(${JSON.stringify(b64)})`);
    assert.equal(Buffer.from(bytes).toString("utf-8"), "hello scorekeeper");
  });

  it("DRUM_CLIPS points silent/roll/finale/horn at real files under assets/audio/, not base64", () => {
    // Individual property checks, not assert.deepEqual(clips, {...}) — DRUM_CLIPS crossed the
    // jsdom/Node realm boundary via evalIn(), so it's a structurally-identical but not
    // reference-identical Object (different Object.prototype), which deepStrictEqual rejects.
    const clips = evalIn(window, "DRUM_CLIPS");
    assert.equal(clips.silent, "assets/audio/silent.wav");
    assert.equal(clips.roll, "assets/audio/roll.mp3");
    assert.equal(clips.finale, "assets/audio/finale.wav");
    assert.equal(clips.horn, "assets/audio/horn.mp3");
  });

  it("every DRUM_CLIPS file exists on disk with the right container for its extension", () => {
    const clips = evalIn(window, "DRUM_CLIPS");
    for (const [name, rel] of Object.entries(clips)) {
      const full = path.join(ROOT, rel);
      assert.ok(fs.existsSync(full), `${name}: ${rel} does not exist`);
      const head = Buffer.alloc(4);
      const fd = fs.openSync(full, "r");
      fs.readSync(fd, head, 0, 4, 0);
      fs.closeSync(fd);
      if (rel.endsWith(".wav")) {
        assert.equal(head.toString("ascii"), "RIFF", `${name}: expected a RIFF/WAV header`);
      } else if (rel.endsWith(".mp3")) {
        // MP3 with an ID3v2 tag starts "ID3"; a bare frame starts 0xFF Ex (sync word + MPEG-1
        // Layer III). This codebase's clips carry ID3 tags (see js/app.js's own DRUM_ROLL_B64
        // rebuild comment), but check both so a re-encode without one doesn't fail spuriously.
        const isId3 = head.slice(0, 3).toString("ascii") === "ID3";
        const isFrameSync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
        assert.ok(isId3 || isFrameSync, `${name}: expected an ID3 tag or MPEG frame sync`);
      }
    }
  });

  it("drumClipUrl returns the DRUM_CLIPS path directly for a finished clip (no decode, no blob:)", () => {
    const url = evalIn(window, 'drumClipUrl("roll")');
    assert.equal(url, "assets/audio/roll.mp3");
  });

  it("drumClipUrl(\"fade\") delegates to fadeClipUrl at the current craftFadeSec()", () => {
    const url = evalIn(window, 'drumClipUrl("fade")');
    assert.match(url, /^blob:mock-/);
  });

  it("fadeClipUrl builds a valid WAV: RIFF/WAVE header, 48kHz stereo 16-bit, correct data length", () => {
    const url = evalIn(window, "fadeClipUrl(2)");
    const blob = window.__mockBlobUrls.get(url);
    assert.equal(blob.type, "audio/wav");
    const buf = Buffer.from(blob.parts[0]);
    assert.equal(buf.toString("ascii", 0, 4), "RIFF");
    assert.equal(buf.toString("ascii", 8, 12), "WAVE");
    assert.equal(buf.readUInt16LE(20), 1); // PCM
    assert.equal(buf.readUInt16LE(22), 2); // FADE_CH
    assert.equal(buf.readUInt32LE(24), 48000); // FADE_SR
    assert.equal(buf.readUInt16LE(34), 16); // bits per sample
    const frames = Math.round(2 * 48000);
    const dataLen = frames * 2 * 2;
    assert.equal(buf.readUInt32LE(40), dataLen); // "data" chunk size
    assert.equal(buf.length, 44 + dataLen);
  });

  it("fadeClipUrl's envelope opens at exactly zero (the ramp-in's own start), not full level", () => {
    const url = evalIn(window, "fadeClipUrl(1.5)");
    const buf = Buffer.from(window.__mockBlobUrls.get(url).parts[0]);
    // First stereo frame, both channels, right after the 44-byte header.
    assert.equal(buf.readInt16LE(44), 0);
    assert.equal(buf.readInt16LE(46), 0);
  });

  it("fadeClipUrl caches: the same sec returns the identical url without building a new blob", () => {
    const url1 = evalIn(window, "fadeClipUrl(4)");
    const url2 = evalIn(window, "fadeClipUrl(4)");
    assert.equal(url1, url2);
  });

  it("fadeClipUrl rebuilds for a different sec (new url, correctly resized data)", () => {
    const url1 = evalIn(window, "fadeClipUrl(1)");
    const url2 = evalIn(window, "fadeClipUrl(6)");
    assert.notEqual(url1, url2);
    const buf2 = Buffer.from(window.__mockBlobUrls.get(url2).parts[0]);
    const frames = Math.round(6 * 48000);
    assert.equal(buf2.length, 44 + frames * 2 * 2);
  });

  it("WEB_AUDIO_CLIPS points start/loop/end/horn at real WAV files under assets/audio/", () => {
    const clips = evalIn(window, "WEB_AUDIO_CLIPS");
    assert.equal(clips.start, "assets/audio/drumroll-start.wav");
    assert.equal(clips.loop, "assets/audio/drumroll-loop.wav");
    assert.equal(clips.end, "assets/audio/drumroll-end.wav");
    assert.equal(clips.horn, "assets/audio/horn.wav");
  });

  it("every WEB_AUDIO_CLIPS file exists on disk as a valid WAV", () => {
    const clips = evalIn(window, "WEB_AUDIO_CLIPS");
    for (const [name, rel] of Object.entries(clips)) {
      const full = path.join(ROOT, rel);
      assert.ok(fs.existsSync(full), `${name}: ${rel} does not exist`);
      const head = Buffer.alloc(4);
      const fd = fs.openSync(full, "r");
      fs.readSync(fd, head, 0, 4, 0);
      fs.closeSync(fd);
      assert.equal(head.toString("ascii"), "RIFF", `${name}: expected a RIFF/WAV header`);
    }
  });

  it("Web Audio AudioContext is completely inert at initial page load (zero audio session theft)", () => {
    assert.equal(evalIn(window, "webAudioCtx"), null);
  });

  it("isWebAudioEngine defaults to true and setCraftAudioEngine toggles between engines", () => {
    assert.equal(evalIn(window, "isWebAudioEngine()"), true);
    evalIn(window, "setCraftAudioEngine('legacy')");
    assert.equal(evalIn(window, "isWebAudioEngine()"), false);
    evalIn(window, "setCraftAudioEngine('webaudio')");
    assert.equal(evalIn(window, "isWebAudioEngine()"), true);
  });
});

// ============================================================================
// Sample game data (this session's tweak: two more 0/4 Round 1 bonus scores)
// ============================================================================
describe("sample game data", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
    );
  });
  after(() => window.close());

  it("has 11 teams", () => {
    assert.equal(evalIn(window, "gameState.teams.length"), 11);
  });
  it("Round 1's bonus has exactly three teams scoring 0/4 (this session's addition of two more)", () => {
    const bonus = evalIn(window, "gameState.rounds[0].bonus");
    const zeroCount = Object.values(bonus).filter((v) => v === 0).length;
    assert.equal(zeroCount, 3);
  });
  it("Round 1's bonus zero-scorers are teams 4, 5, and 8 (Sherlock Homies, Mastermind Alliance, Two Heads One Trophy)", () => {
    const bonus = evalIn(window, "gameState.rounds[0].bonus");
    const zeroTeams = Object.entries(bonus)
      .filter(([, v]) => v === 0)
      .map(([k]) => Number(k))
      .sort();
    assert.deepEqual(zeroTeams, [4, 5, 8]);
  });
  it("the tie-critical teams (index 0 and 2) were left untouched by that change", () => {
    const bonus = evalIn(window, "gameState.rounds[0].bonus");
    assert.equal(bonus[0], 4);
    assert.equal(bonus[2], 4);
  });
  it("Round 2 Q2 (index 1,1) is a genuine 4/11 vs 7/11 split (this session's Crowd-Wisdom screenshot)", () => {
    const q = evalIn(window, "gameState.rounds[1].questions[1]");
    const correct = Object.values(q).filter((a) => a.correct === true).length;
    const incorrect = Object.values(q).filter((a) => a.correct === false).length;
    assert.equal(correct, 4);
    assert.equal(incorrect, 7);
  });
  it("Round 2 Q1 (index 1,0) is a genuine Beer Round (every team correct)", () => {
    const q = evalIn(window, "gameState.rounds[1].questions[0]");
    const n = evalIn(window, "gameState.teams.length");
    for (let ti = 0; ti < n; ti++) assert.equal(q[ti].correct, true);
  });
  it("Final Results has a genuine tie for the same grand total", () => {
    const rows = window.buildRows();
    const totals = rows.map((r) => r.pts);
    const dupes = totals.filter((t, i) => totals.indexOf(t) !== i);
    assert.ok(dupes.length > 0, "expected at least one tied total in the sample game");
  });
});

// ============================================================================
// Scoring math (pure-ish functions, exercised against real gameState)
// ============================================================================
describe("scoring math", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
    );
  });
  after(() => window.close());

  it("grandTotal(0) matches the Parliamentary Procedure total shown in the Team Report screenshot (143)", () => {
    assert.equal(window.grandTotal(0), 143);
  });
  it("scoreBreakdown reports correct+incorrect summing to the number of graded teams", () => {
    const s = window.scoreBreakdown(evalIn(window, "gameState.rounds[1].questions[1]"), 11);
    assert.equal(s.correct + s.incorrect, s.done);
  });
  it("scoreBreakdown's correctPct and incorrectPct always sum to exactly 100 (not two independently-rounded values)", () => {
    const s = window.scoreBreakdown(evalIn(window, "gameState.rounds[1].questions[1]"), 11);
    assert.equal(s.correctPct + s.incorrectPct, 100);
  });
  it("scoreBreakdown on an empty question returns done:0 and 0% both ways", () => {
    const s = window.scoreBreakdown({}, 11);
    assert.equal(s.done, 0);
    assert.equal(s.correctPct, 0);
    assert.equal(s.incorrectPct, 0);
  });
  it("rankMap places the higher score at a lower (better) rank", () => {
    const ranks = window.rankMap();
    const totals = evalIn(window, "gameState.teams").map((_, i) => window.grandTotal(i));
    const best = totals.indexOf(Math.max(...totals));
    assert.equal(ranks[best], 1);
  });
  it("sanitizeFile strips filesystem-hostile characters", () => {
    assert.equal(window.sanitizeFile('a/b\\c:d*e?f"g<h>i|j'), "a b c d e f g h i j");
  });
  it("sanitizeFile strips apostrophes outright rather than replacing with a space", () => {
    assert.equal(window.sanitizeFile("Guy's Tavern"), "Guys Tavern");
  });
  it("sanitizeFile collapses repeated whitespace from multiple stripped characters", () => {
    assert.equal(window.sanitizeFile("a///b"), "a b");
  });
});

// ============================================================================
// Advanced Settings conditional visibility — regression coverage for three CHANGELOG-documented
// fixes: v18.92 (Drumroll Crossfade hidden until Manual Drumroll Control is on) and v18.93
// (Timer Stepper Buttons / Timer Pulse hidden until Timer Widget is on).
// ============================================================================
describe("Advanced Settings: rows gated on their own parent toggle", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("Drumroll Crossfade is hidden by default (Manual Drumroll Control starts off)", () => {
    assert.equal(window.document.getElementById("drumCrossfadeRow").style.display, "none");
  });
  it("Drumroll Crossfade appears once Manual Drumroll Control is switched on", () => {
    window.toggleCraftManualEnd();
    assert.notEqual(window.document.getElementById("drumCrossfadeRow").style.display, "none");
    window.toggleCraftManualEnd(); // restore
  });
  it("Timer Stepper Buttons and Timer Pulse are visible by default (Timer Widget starts on)", () => {
    assert.notEqual(window.document.getElementById("timerSteppersRow").style.display, "none");
    assert.notEqual(window.document.getElementById("timerPulseRow").style.display, "none");
  });
  it("Timer Stepper Buttons and Timer Pulse hide once Timer Widget is switched off", () => {
    window.toggleTimerVisible();
    assert.equal(window.document.getElementById("timerSteppersRow").style.display, "none");
    assert.equal(window.document.getElementById("timerPulseRow").style.display, "none");
    window.toggleTimerVisible(); // restore
  });
});

// ============================================================================
// Icon Style — theme-dependent emoji selection (v18.94: "Fix Done's checkmark vanishing in
// dark theme Emoji mode") and the waving-hand icon this session gave Take the Tour.
// ============================================================================
describe("Icon Style: theme-dependent emoji selection", () => {
  it("ICON_DONE picks the dark-safe ☑️ variant in dark theme Emoji mode", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, 'document.documentElement.setAttribute("data-theme","dark")');
      evalIn(window, 'applyIconStyle("emoji")');
      assert.match(evalIn(window, "ICON_DONE"), /☑️/);
    } finally {
      window.close();
    }
  });
  it("ICON_DONE picks the plain ✔️ variant in light theme Emoji mode", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, 'document.documentElement.setAttribute("data-theme","light")');
      evalIn(window, 'applyIconStyle("emoji")');
      assert.match(evalIn(window, "ICON_DONE"), /✔️/);
      assert.doesNotMatch(evalIn(window, "ICON_DONE"), /☑️/);
    } finally {
      window.close();
    }
  });
  it("STATIC_ICON_TARGETS maps Take the Tour's emoji to 👋, not the old 🎓 or ℹ️", async () => {
    const window = await loadAppWindow();
    try {
      const targets = evalIn(window, "STATIC_ICON_TARGETS");
      const tourTarget = targets.find((t) =>
        t.sel.includes("Tutorial.start"),
      );
      assert.ok(tourTarget, "Take the Tour target not found in STATIC_ICON_TARGETS");
      assert.match(tourTarget.emoji, /👋/);
    } finally {
      window.close();
    }
  });
  it("Team Report's incorrect marks use ❌ in Emoji mode (v18.92)", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, 'applyIconStyle("emoji")');
      assert.match(evalIn(window, "ICON_AUDIT_WRONG"), /❌/);
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Advanced Settings naming (v18.86/v18.87: renamed away from "Per-Question Percentage Correct
// Labels" / "...Tags" to plain "Crowd-Wisdom Percentage")
// ============================================================================
describe("Crowd-Wisdom Percentage naming", () => {
  it("the Advanced Settings row label is exactly 'Crowd-Wisdom Percentage', no leftover 'Tags'", async () => {
    const window = await loadAppWindow();
    try {
      const row = window.document
        .getElementById("qResultToggleBtn")
        .closest(".settings-row");
      const label = row.querySelector(".size-label").textContent.trim();
      assert.equal(label, "Crowd-Wisdom Percentage");
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Tutorial (js/tutorial.js) step table structural validity
// ============================================================================
describe("Tutorial step table", () => {
  // Tutorial is a top-level `const` (js/tutorial.js), same non-window-property lexical binding
  // as APP_VERSION/gameState — evalIn() gets the real object reference once; calling its own
  // methods off that reference works normally from there.
  let window, Tutorial;
  before(async () => {
    window = await loadAppWindow();
    Tutorial = evalIn(window, "Tutorial");
  });
  after(() => window.close());

  it("Tutorial exposes start/skip/next/back/finish", () => {
    assert.equal(typeof Tutorial.start, "function");
    assert.equal(typeof Tutorial.skip, "function");
    assert.equal(typeof Tutorial.next, "function");
    assert.equal(typeof Tutorial.back, "function");
    assert.equal(typeof Tutorial.finish, "function");
  });
  it("starting the tutorial with no teams skips the confirmation (nothing to lose)", async () => {
    evalIn(window, "gameState = freshState();");
    const p = Tutorial.start();
    await new Promise((r) => setTimeout(r, 20));
    // No confirm overlay should be showing — it should have gone straight in.
    assert.equal(
      window.document.getElementById("confirmOverlay").classList.contains("show"),
      false,
    );
    Tutorial.skip();
    await p;
  });
  it("starting the tutorial WITH a real team in progress asks for confirmation first", async () => {
    evalIn(
      window,
      'gameState = freshState(); addTeam(); gameState.teams[0].name = "Real Team";',
    );
    const p = Tutorial.start();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(
      window.document.getElementById("confirmOverlay").classList.contains("show"),
      true,
    );
    window.document.getElementById("confirmCancelBtn").click();
    await p;
  });
  it("declining that confirmation leaves the real team untouched", () => {
    assert.equal(evalIn(window, "gameState.teams[0]?.name"), "Real Team");
  });
});

// ============================================================================
// Tutorial render batching — the early bulk-fill steps (Round 1's autoFillRound, its forced
// Beer Round, its partial-fill Sort demo) each used to call the real, expensive cycleW()
// (js/app.js) once per team/question — up to ~20 times for one step — and every one of those
// calls independently triggered a full renderAll() *and* a forced-reflow reposition() via
// installHooks' own render hook, entirely synchronously, before the host ever saw any of the
// intermediate frames: real, measurable jank on exactly the steps a host reported as "feels
// slow". runBatched() (js/tutorial.js) collapses each fill() step's whole burst of calls down
// to the one render that was ever going to be visible. This test's own render count is
// deterministic (confirmed by running it three times) precisely because that's what the fix
// guarantees — it depends on how many runBatched()-wrapped fill() calls ran, not on how many
// individual cycleW/setB calls happened inside them, so a regression that goes back to calling
// autoFillRound() etc. directly (unbatched) would make this count balloon into the dozens.
// ============================================================================
// ============================================================================
// Tutorial full walkthrough — drives the real practice tour start to finish, the same one a
// host clicking "Take the Tour" runs, and checks the two things a host actually cares about:
// it never errors, and it genuinely leaves a fully-played practice game behind (every round
// scored, halftime/final wagers placed, gameStarted flips true) — not a tour that narrates over
// empty data. Tutorial.next() bypasses the UI's own Next-button gating (it doesn't check
// stepReady), which is what makes driving the whole thing from a test tractable at all — real
// per-step pacing (typing, clicking, waiting for a render) doesn't have to be reproduced, only
// the two things next() genuinely can't fake: Quiz ID/Host Name (real keystrokes into a text
// input — canScore() blocks every scoring tap in the whole app, tutorial included, without
// them) and the 220ms-paced team-adding / 300ms sidebar-toggle timers the app itself uses.
// One shared walkthrough for the whole describe block (before(), not beforeEach) — it costs
// several real seconds because of those waits, and every it() below only reads its result.
// ============================================================================
describe("Tutorial full walkthrough", () => {
  let window;
  let renderCounts;
  let stoppedNaturally;
  let jsErrors;
  let clickedTargets;

  before(async () => {
    window = await loadAppWindow();
    jsErrors = [];
    window.addEventListener("error", (e) =>
      jsErrors.push((e.error && e.error.message) || e.message || String(e)),
    );
    // Installed BEFORE Tutorial.start() so installHooks() (js/tutorial.js) captures these as
    // its own `orig` — every real render, batched or not, funnels through them.
    evalIn(
      window,
      `window.__rc = { all: 0, left: 0, sb: 0 };
       (function () {
         const _all = renderAll, _left = renderLeft, _sb = renderSB;
         renderAll = function (...a) { window.__rc.all++; return _all.apply(this, a); };
         renderLeft = function (...a) { window.__rc.left++; return _left.apply(this, a); };
         renderSB = function (...a) { window.__rc.sb++; return _sb.apply(this, a); };
       })();`,
    );
    await evalIn(window, "Tutorial.start()");
    // The one thing next() can't simulate: real keystrokes into Quiz ID/Host Name. Without
    // these, canScore() (js/app.js) blocks every single scoring tap app-wide — the tour would
    // "complete" in the sense of reaching step 37, but leave every round genuinely empty.
    evalIn(
      window,
      'gameState.meta.quizId = "TEST-001"; gameState.meta.hostName = "Test Host";',
    );
    // The other thing next() can't simulate: real 'on-click' steps wait on the target's own
    // real onclick handler (see the STEP TABLE's own note on why), and next() bypasses that
    // gating entirely — it advances regardless of whether anything was ever actually clicked.
    // That gap is exactly how the Team Report's <script> tag went missing without a single test
    // failing (see the dedicated "Team Report" describe block's own comment): nothing in this
    // suite had ever actually called openAudit() the way a host's real tap does. Dispatching a
    // real click on each of these targets closes that gap generally instead of only for the one
    // step that already broke once — gated on the callout's own narration text (below), not
    // bare DOM presence: #sec-r1's header exists in the page from the very first step (it's
    // ordinary static UI, not tutorial-created), so clicking on sight — an earlier version of
    // this loop — clicked it far too early. #addTeamBtn is deliberately NOT in this list: unlike
    // the others, its real onclick (addTeam(), js/app.js) adds a genuine extra team the rest of
    // this exact walkthrough doesn't expect (the tour's own "type a name for it" steps that
    // follow are narration-only here, same as every other typing step — see the Quiz ID/Host
    // Name note above), which cascades into an unnamed team[0] and downstream state this test
    // isn't trying to model. addTeam() itself is already exercised directly elsewhere (the
    // "starting the tutorial WITH a real team in progress" case above calls it the same way).
    const CLICK_TARGETS = [
      { sel: "#sec-r1 .section-header", when: /Round 1's header to collapse it/ },
      {
        sel: '#sec-final tr[onclick="openAudit(0)"] .ta-name-clickable',
        when: /to open a Team Report/,
      },
      // Not /tap Close/ — tapWord() (js/tutorial.js) renders "click" on a desktop-width
      // viewport (jsdom's default), so the real narration here reads "...then click Close...".
      { sel: ".audit-close", when: /Close to dismiss it/ },
    ];
    const alreadyClicked = new Set();
    let i = 0;
    for (; i < 50; i++) {
      const callout = window.document.querySelector(".tutorial-callout");
      if (!callout) break;
      const text = callout.textContent || "";
      for (const { sel, when } of CLICK_TARGETS) {
        if (alreadyClicked.has(sel) || !when.test(text)) continue;
        const el = window.document.querySelector(sel);
        if (el) {
          el.click();
          alreadyClicked.add(sel);
        }
      }
      evalIn(window, "Tutorial.next()");
      await new Promise((r) => setTimeout(r, 250));
    }
    stoppedNaturally = i < 50; // false would mean the safety cap fired, not a real Finish
    renderCounts = evalIn(window, "window.__rc");
    clickedTargets = alreadyClicked;
  });
  after(() => window.close());

  it("reaches the end of the step table on its own (the loop's safety cap never fired)", () => {
    assert.equal(stoppedNaturally, true);
  });
  it("actually fired all three real clicks (Round 1 header, open Team Report, close Team Report) — confirms the text-gated matching above found its moment for each, not that it silently skipped all of them", () => {
    assert.equal(clickedTargets.size, 3);
  });
  it("throws no errors anywhere in the walkthrough", () => {
    assert.deepEqual(jsErrors, []);
  });
  it("every tutorial DOM element is cleaned up after Finish (no leftover overlay/callout/ring)", () => {
    assert.equal(window.document.querySelectorAll("[class*='tutorial-']").length, 0);
  });
  it("flips gameStarted true (a real score was entered, not just narrated over)", () => {
    assert.equal(evalIn(window, "gameState.gameStarted"), true);
  });
  it("adds the practice roster (host's own team plus the 4 auto-added ones)", () => {
    assert.ok(evalIn(window, "gameState.teams.length") >= 4);
  });
  it("scores all four rounds for nearly every team (one cell per round is deliberately left for the host to fill by hand)", () => {
    for (let ri = 0; ri < 4; ri++) {
      const filled = evalIn(
        window,
        `Object.keys(gameState.rounds[${ri}].questions[0]).length`,
      );
      const teams = evalIn(window, "gameState.teams.length");
      assert.ok(filled >= teams - 1, `round ${ri + 1} Q1: only ${filled}/${teams} teams scored`);
    }
  });
  it("places both the halftime and final wagers", () => {
    assert.ok(evalIn(window, "Object.keys(gameState.halftime).length") > 0);
    assert.ok(evalIn(window, "Object.keys(gameState.finalWager).length") > 0);
  });
  it("keeps total real render calls well under what unbatched bulk-fills would cost (regression guard for runBatched — see js/tutorial.js)", () => {
    const total = renderCounts.all + renderCounts.left + renderCounts.sb;
    // Measured directly, both ways, against this exact walkthrough: 52 with runBatched() doing
    // its job (stable across repeated runs), 316 with every runBatched() call unwrapped back to
    // a bare call — the six bulk-fill steps' cycleW/setB/setHW/setFW calls each triggering their
    // own real render again. 100 sits comfortably above real-world drift and just as
    // comfortably below "batching broke."
    assert.ok(
      total < 100,
      `expected batched rendering to stay well under 100, got ${total} (${JSON.stringify(renderCounts)})`,
    );
  });
});

// ============================================================================
// No leftover emoji-as-picto narration in the tutorial (this session's audit)
// ============================================================================
describe("Tutorial narration text", () => {
  it("contains no bare ▶/↺/✕/🗑 glyphs standing in for a button name", async () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "js", "tutorial.js"),
      "utf8",
    );
    const textBlocks = [...src.matchAll(/text:\s*`([^`]*)`/g)].map((m) => m[1]);
    assert.ok(textBlocks.length > 20, "expected the real step table's text strings");
    const offenders = textBlocks.filter((t) => /[▶↺✕🗑]/u.test(t));
    assert.deepEqual(offenders, []);
  });
});

// ============================================================================
// FAQ search (this session's additions: clear button, "/" shortcut, ?q= param, deep-link ids)
// ============================================================================
describe("FAQ search", () => {
  let window;
  before(async () => {
    window = await loadFaqWindow();
  });
  after(() => window.close());

  it("faqFilter with an empty query shows every item and hides the clear button", () => {
    window.faqFilter("");
    assert.equal(window.document.getElementById("faqSearchClear").hidden, true);
    assert.equal(window.document.querySelectorAll(".faq-item[hidden]").length, 0);
  });
  it("faqFilter with a real query hides non-matching items and shows the clear button", () => {
    window.faqFilter("wager");
    assert.ok(window.document.querySelectorAll(".faq-item[hidden]").length > 0);
    assert.equal(window.document.getElementById("faqSearchClear").hidden, false);
  });
  it("faqFilter matches are case-insensitive", () => {
    window.faqFilter("WAGER");
    const visible = window.document.querySelectorAll(".faq-item:not([hidden])").length;
    window.faqFilter("wager");
    const visibleLower = window.document.querySelectorAll(".faq-item:not([hidden])").length;
    assert.equal(visible, visibleLower);
  });
  it("faqClearSearch empties the box and shows every item again", () => {
    window.document.getElementById("faqSearch").value = "wager";
    window.faqFilter("wager");
    window.faqClearSearch();
    assert.equal(window.document.getElementById("faqSearch").value, "");
    assert.equal(window.document.querySelectorAll(".faq-item[hidden]").length, 0);
  });
  it("a query matching nothing shows the no-results message", () => {
    window.faqFilter("xyzzyimpossiblequery");
    assert.equal(
      window.document.getElementById("faqNoResults").classList.contains("show"),
      true,
    );
    window.faqFilter("");
  });
  // jsdom's window.location is non-configurable (Object.defineProperty(window, "location", ...)
  // throws) and location.search specifically silently no-ops on direct assignment (unlike
  // location.hash, which does take a direct assignment — see the two tests below). The faithful
  // way to test query-string handling is therefore to load a fresh window with the string
  // already on the URL and let the page's own real load-time call exercise it, rather than
  // poking at location after the fact.
  it("faqApplyQueryParam reads ?q= from the URL and pre-filters (real load-time URL)", async () => {
    const qWindow = await loadFaqWindow("?q=wager");
    try {
      assert.equal(qWindow.document.getElementById("faqSearch").value, "wager");
    } finally {
      qWindow.close();
    }
  });
  it("faqOpenLinkedItem opens the .faq-item whose id matches location.hash", () => {
    const anyItem = window.document.querySelector(".faq-item[id]");
    assert.ok(anyItem, "expected at least one .faq-item with an id");
    anyItem.open = false;
    // Direct assignment to location.hash (unlike location.search) does take effect in jsdom.
    window.location.hash = "#" + anyItem.id;
    window.faqOpenLinkedItem();
    assert.equal(anyItem.open, true);
    window.location.hash = "";
  });
  it("faqOpenLinkedItem does nothing (does not throw) with an empty hash", () => {
    window.location.hash = "";
    assert.doesNotThrow(() => window.faqOpenLinkedItem());
  });
});

// ============================================================================
// FAQ Icon Style — the preview swatch this session added (beer icon next to the label)
// ============================================================================
describe("FAQ Icon Style preview swatch", () => {
  let window;
  before(async () => {
    window = await loadFaqWindow();
  });
  after(() => window.close());

  it("the toggle button starts with an svg icon and 'Pictograph' label", () => {
    const btn = window.document.getElementById("faqIconStyleToggle");
    assert.ok(btn.querySelector("svg"));
    assert.equal(window.document.getElementById("faqIconStyleLabel").textContent, "Pictograph");
  });
  it("toggling to emoji swaps the icon to a span and updates the label to 'Emoji', without destroying the label element", () => {
    window.faqApplyIconStyle("emoji");
    const btn = window.document.getElementById("faqIconStyleToggle");
    assert.equal(btn.querySelector("svg"), null);
    assert.ok(btn.querySelector("span.faq-emoji-ph"));
    assert.equal(window.document.getElementById("faqIconStyleLabel").textContent, "Emoji");
  });
  it("toggling back to pictograph restores the svg and the label text, with zero broken <use> refs", () => {
    window.faqApplyIconStyle("pictograph");
    const btn = window.document.getElementById("faqIconStyleToggle");
    assert.ok(btn.querySelector("svg"));
    assert.equal(window.document.getElementById("faqIconStyleLabel").textContent, "Pictograph");
    const broken = [...window.document.querySelectorAll("svg use")].filter(
      (u) => !window.document.getElementById((u.getAttribute("href") || "").replace("#", "")),
    );
    assert.deepEqual(broken, []);
  });
});

// ============================================================================
// Team Report (js/team-audit.js, formerly "Score Audit") — openAudit/closeAudit/buildAudit had
// zero coverage before this, and that gap is exactly how a real bug shipped: this session's
// js/app.js module split moved these three into their own file correctly, but never added its
// <script src> tag to index.html — every static/string check that only reads *.js files off
// disk (lint, the onclick-handler-exists check, grep) passed anyway, since the file and its
// functions genuinely existed on disk. Only a real click surfaced "openAudit is not defined".
// loadAppWindow() runs index.html's actual <script> tags exactly as a browser would, so this is
// the one kind of test that fails the same way that real click did — see
// tests/html-structure.test.js's "every top-level js/*.js file... has a <script src> tag" for
// the complementary static check, which catches the next file before anyone has to click it.
// ============================================================================
describe("Team Report (js/team-audit.js)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
    );
  });
  after(() => window.close());

  it("openAudit/closeAudit/buildAudit are actually defined (would have caught the missing <script> tag directly)", () => {
    assert.equal(evalIn(window, "typeof openAudit"), "function");
    assert.equal(evalIn(window, "typeof closeAudit"), "function");
    assert.equal(evalIn(window, "typeof buildAudit"), "function");
  });

  it("openAudit(0) shows the overlay and builds Parliamentary Procedure's report, matching the app's own grandTotal(0)", () => {
    evalIn(window, "openAudit(0)");
    assert.equal(
      window.document.getElementById("auditOverlay").classList.contains("show"),
      true,
    );
    const html = window.document.getElementById("auditModal").innerHTML;
    assert.match(html, /Parliamentary Procedure/);
    const total = evalIn(window, "grandTotal(0)");
    assert.match(html, new RegExp(String(total)));
  });

  it("closeAudit() hides the overlay again", () => {
    evalIn(window, "openAudit(0); closeAudit();");
    assert.equal(
      window.document.getElementById("auditOverlay").classList.contains("show"),
      false,
    );
  });

  it("every onclick=\"openAudit(N)\" row in a freshly rendered page actually opens the right team (index round-trips correctly)", () => {
    evalIn(window, "openAudit(2)");
    const html = window.document.getElementById("auditModal").innerHTML;
    const name = evalIn(window, "gameState.teams[2].name");
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    evalIn(window, "closeAudit()");
  });
});

// ============================================================================
// Autosave round-trip — gameState survives a save/load cycle through TRStore/localStorage
// unchanged. No coverage of this existed before, despite it being the one piece of state every
// other feature in the app depends on. A literal close-this-window-open-a-new-one reload isn't
// tested here: jsdom gives each `new JSDOM()` its own isolated localStorage backing (confirmed
// directly — a value autosave()'d in one loadAppWindow() is invisible to a second one against
// the same fake origin), so this instead calls the app's own loadSaved() against what autosave()
// actually wrote within one window, which is exactly the JSON.stringify/parse round trip a real
// reload's TRStore.getItem would perform.
// ============================================================================
describe("Autosave round-trip", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("autosave() then loadSaved() returns the exact same state, not just an equivalent one", () => {
    evalIn(
      window,
      `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
       gameState.meta.hostName = "Round-Trip Test Host";
       gameState.teams[0].scoreGuess = 999;
       autosave();`,
    );
    const original = evalIn(window, "JSON.stringify(gameState)");
    const restored = evalIn(window, "JSON.stringify(loadSaved())");
    assert.equal(restored, original);
  });

  it("clearSaved() removes it — loadSaved() afterward returns null", () => {
    evalIn(window, "autosave(); clearSaved();");
    assert.equal(evalIn(window, "loadSaved()"), null);
  });

  it("TRStore reports persistent:true against the fake http: origin (confirms this test is exercising real storage, not the in-memory fallback)", () => {
    assert.equal(evalIn(window, "TRStore.persistent"), true);
  });
});

// ============================================================================
// Export smoke test — exportXLSXBackup()/exportPDF() actually run against a real game state
// end to end (fflate zip, jsPDF page-building) instead of only checking their buttons exist.
// This is what caught a real bug during this session's work: with a naive cross-realm
// TextEncoder stub (see tests/helpers/load-app.js's beforeParse), fflate.zipSync silently
// exploded a 17-entry, 36KB XLSX into a 31MB, 29,148-entry one — entirely a test-harness defect,
// never reachable by a real user (browsers' native TextEncoder is already same-realm), but only
// exportXLSXBackup() actually running here would ever have surfaced it.
// ============================================================================
describe("Export smoke test", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
    );
  });
  after(() => window.close());

  it("exportXLSXBackup() produces a zip fflate can read back, with the template's own entry count (no corruption)", () => {
    // Everything below runs inside the window's own realm via one evalIn() call, deliberately —
    // fflate.zipSync/unzipSync do their own `instanceof Uint8Array` checks against THEIR OWN
    // realm's Uint8Array (see beforeParse's TextEncoder comment for the same issue elsewhere),
    // so handing them a Node-side-reconstructed typed array here would risk masking exactly the
    // class of bug this test exists to catch. Only the small JSON summary crosses the boundary.
    evalIn(window, "exportXLSXBackup()");
    const result = JSON.parse(
      evalIn(
        window,
        `JSON.stringify((function () {
          const blob = [...window.__mockBlobUrls.values()].find((b) =>
            b.type.includes("spreadsheetml"),
          );
          if (!blob) return { found: false };
          const unzipped = fflate.unzipSync(blob.parts[0]);
          return {
            found: true,
            entries: Object.keys(unzipped).length,
            hasSheet: !!unzipped["xl/worksheets/sheet1.xml"],
          };
        })())`,
      ),
    );
    assert.ok(result.found, "expected exportXLSXBackup to build an xlsx-typed blob");
    // The unmodified template itself has 17 entries — real injected data only ever overwrites
    // two existing files (xl/worksheets/sheet1.xml, xl/workbook.xml), never adds new ones, so
    // this must stay exactly 17 regardless of team/round count.
    assert.equal(result.entries, 17);
    assert.ok(result.hasSheet);
  });

  it("exportXLSXBackup() shows the export-complete prompt", () => {
    assert.ok(
      window.document.getElementById("exportPrompt").classList.contains("show"),
    );
  });

  it("exportPDF() runs to completion against an 11-team game without throwing", () => {
    assert.doesNotThrow(() => evalIn(window, "exportPDF()"));
    const found = evalIn(
      window,
      '[...window.__mockBlobUrls.values()].some((b) => b.parts && b.parts.length > 0)',
    );
    assert.ok(found, "expected exportPDF to build a blob for download");
  });
});

// ============================================================================
// Desktop "scroll void" bug — .app-layout's height used to be `100vh - 60px`, a flat guess at
// the sticky header (+ Resume banner, when shown) that undershot in both directions and, when
// too small, left the *document itself* scrollable by the difference: up to 89px of rendered
// nothing below the layout, reachable by scrolling with the cursor anywhere in the right-hand
// Scores column. The fix (js/app.js, the IIFE right above --mobile-dock-h's own) replaces the
// guess with --layout-top, one real measurement of .app-layout's own on-screen top kept in sync
// by a ResizeObserver on .header/#resumeBanner, a window resize listener, and a document.fonts.
// ready/window-load resync (that last one closing a real follow-up bug of its own: the very
// first sync() can run before Inter has swapped in over its font-display:swap fallback, and on
// loads where the Resume banner wraps a different number of lines under the fallback font, that
// undershoots --layout-top by exactly enough to reopen the same scrollable strip).
//
// jsdom does no real CSS layout (getBoundingClientRect is always zero), so nothing here can
// assert the actual pixel gap is closed the way a real browser reflow could — these instead
// guard the two things that broke this exact bug before and are invisible in a screenshot taken
// on any display tall enough not to need the fallback in the first place: that the sync
// mechanism actually runs and writes a real value (not silently leaving --layout-top unset, so
// the CSS fallback undershoot line 703's own hardcoded ", 60px" — quietly wins), and that all
// three of its resync paths are still wired up.
// ============================================================================
describe('Desktop "scroll void" bug (--layout-top sync)', () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("--layout-top is explicitly set on <html> after load, not left for the CSS fallback to silently win", () => {
    const val = window.document.documentElement.style.getPropertyValue(
      "--layout-top",
    );
    assert.notEqual(val, "");
    assert.match(val, /^-?\d+(\.\d+)?px$/);
  });

  it("the sync IIFE observes both .header and #resumeBanner for resize (the two things in flow above .app-layout)", () => {
    const appSrc = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
    const m = appSrc.match(/Keeps --layout-top in sync[\s\S]*?\n\}\)\(\);/);
    assert.ok(m, "the --layout-top sync IIFE was not found in js/app.js");
    const block = m[0];
    assert.match(block, /querySelector\(["']\.header["']\)/);
    assert.match(block, /getElementById\(["']resumeBanner["']\)/);
    assert.match(block, /new ResizeObserver\(sync\)/);
  });

  it("the sync IIFE re-syncs on window resize, document.fonts.ready, and window load (the font-swap race's own fix)", () => {
    const appSrc = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
    const m = appSrc.match(/Keeps --layout-top in sync[\s\S]*?\n\}\)\(\);/);
    assert.ok(m, "the --layout-top sync IIFE was not found in js/app.js");
    const block = m[0];
    assert.match(block, /addEventListener\(["']resize["'],\s*sync\)/);
    assert.match(block, /document\.fonts\?\.ready.*\.then\(sync\)/);
    assert.match(block, /addEventListener\(["']load["'],\s*sync\)/);
  });
});

// ============================================================================
// Update check (checkForUpdate, js/app.js) — fetches version.json (cache-busted, cache:
// "no-store") and, if it names a version different from APP_VERSION, sets latestVersion and
// drives a quiet gear-icon dot + a "vX.X available" note under the version line in Settings
// (see the CHANGELOG entry this shipped with for why it's deliberately not a banner). jsdom has
// no native fetch — tests/helpers/load-app.js stubs window.fetch to reject by default (the same
// "offline, or the venue's own WiFi is down" path checkForUpdate() already handles gracefully in
// a real browser), so each test below overrides it locally to exercise a specific real response.
// ============================================================================
describe("Update check (checkForUpdate)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("does nothing when version.json reports the same version already running", async () => {
    evalIn(
      window,
      `window.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: APP_VERSION }),
      });`,
    );
    await evalIn(window, "checkForUpdate()");
    assert.equal(evalIn(window, "latestVersion"), null);
    assert.equal(
      window.document
        .getElementById("settingsToggleBtn")
        .classList.contains("has-update"),
      false,
    );
  });

  it("sets latestVersion and shows the gear-icon dot + version-line note when a newer version is reported", async () => {
    evalIn(
      window,
      `window.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ version: "v99.99" }),
      });`,
    );
    await evalIn(window, "checkForUpdate()");
    assert.equal(evalIn(window, "latestVersion"), "v99.99");
    assert.equal(
      window.document
        .getElementById("settingsToggleBtn")
        .classList.contains("has-update"),
      true,
    );
    const html = window.document.getElementById("versionLabel").innerHTML;
    assert.match(html, /v99\.99 available/);
    // Not a "tap to refresh" reload button — reloading doesn't reliably update an installed
    // home-screen app (the icon specifically never does that way), so this links to the FAQ's
    // real instructions (remove the installed app, add it again) instead.
    assert.match(
      html,
      /href="faq\/index\.html#q-how-do-i-update-the-installed-app"/,
    );
    assert.doesNotMatch(html, /tap to refresh/);
    assert.doesNotMatch(html, /onclick="location\.reload\(\)"/);
  });

  it("silently no-ops (no throw, no latestVersion change) when the fetch fails, matching real offline/venue-WiFi-down behavior", async () => {
    evalIn(window, "latestVersion = null;");
    evalIn(
      window,
      'window.fetch = () => Promise.reject(new Error("offline"));',
    );
    await assert.doesNotReject(() => evalIn(window, "checkForUpdate()"));
    assert.equal(evalIn(window, "latestVersion"), null);
  });

  it("silently no-ops when version.json's response isn't ok (e.g. a 404 on a dev/preview host with no version.json)", async () => {
    evalIn(window, "latestVersion = null;");
    evalIn(window, 'window.fetch = () => Promise.resolve({ ok: false });');
    await evalIn(window, "checkForUpdate()");
    assert.equal(evalIn(window, "latestVersion"), null);
  });
});

// ============================================================================
// Five new tests (per this session's "think about and describe... implement all of these").
// ============================================================================

// ---- Static TDZ sweep — generalizes the exact bug hit twice now (BONUS_Q_STYLE, then
// latestVersion, both js/app.js — see their own top-of-file comments) into a real test instead
// of needing a third live crash to catch the next one. applyPrefs() runs synchronously at
// script-parse time (the `else applyPrefs();` at the very end of js/app.js — see its own
// comment), so any top-level `const`/`let` in js/app.js that a function reachable from
// applyPrefs() reads has to be declared BEFORE that line, or it's still in its temporal dead
// zone the first time the page ever loads. Reachability is a static call-graph BFS over
// js/app.js's own top-level `function` declarations (the ones a load-time call chain can
// actually reach — cross-file calls into shared-ui.js/storage.js/etc. don't need checking here,
// since every other <script> tag has already fully run, top to bottom, by the time js/app.js
// itself starts executing).
describe("Static TDZ sweep: applyPrefs()'s load-time call chain (js/app.js)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");

  function extractTopLevelFunctions(text) {
    const map = new Map();
    const re = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
    let m;
    while ((m = re.exec(text))) {
      const braceStart = text.indexOf("{", m.index);
      if (braceStart === -1) continue;
      let depth = 0,
        i = braceStart;
      for (; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      map.set(m[1], { body: text.slice(braceStart, i + 1) });
    }
    return map;
  }
  function topLevelDecls(text) {
    const decls = new Map(); // name -> char offset of the `const`/`let` keyword
    const re = /^(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=,;]/gm;
    let m;
    while ((m = re.exec(text))) decls.set(m[1], m.index);
    return decls;
  }
  // Strips string/template literal and comment contents (but keeps `${...}` interpolation, since
  // an identifier read inside one is a real read) so identifier-matching below doesn't trip over
  // prose in a string that happens to spell a variable's name.
  function stripNonCode(text) {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, (m) =>
        (m.match(/\$\{[^}]*\}/g) || []).join(" "),
      )
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");
  }

  const funcs = extractTopLevelFunctions(src);
  const decls = topLevelDecls(src);
  const entryMatch = [...src.matchAll(/^else applyPrefs\(\);/gm)].pop();
  it("finds applyPrefs()'s synchronous load-time entry point (`else applyPrefs();` at end of file)", () => {
    assert.ok(entryMatch, "expected `else applyPrefs();` at the end of js/app.js");
  });
  it("finds applyPrefs and a substantial top-level function set to search", () => {
    assert.ok(funcs.has("applyPrefs"), "applyPrefs() itself not found");
    assert.ok(funcs.size > 20, "expected many top-level functions in js/app.js");
  });

  const entryIndex = entryMatch ? entryMatch.index : src.length;
  // BFS over the call graph starting at applyPrefs, following any identifier-followed-by-"("
  // that names another top-level function in this same file.
  const reachable = new Set();
  const queue = ["applyPrefs"];
  while (queue.length) {
    const name = queue.pop();
    if (reachable.has(name)) continue;
    reachable.add(name);
    const f = funcs.get(name);
    if (!f) continue;
    const code = stripNonCode(f.body);
    for (const m of code.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
      if (funcs.has(m[1]) && !reachable.has(m[1])) queue.push(m[1]);
    }
  }

  it("every top-level const/let read by a function reachable from applyPrefs() is declared before applyPrefs()'s own load-time call", () => {
    const violations = [];
    for (const name of reachable) {
      const f = funcs.get(name);
      if (!f) continue;
      const code = stripNonCode(f.body);
      const read = new Set(
        [...code.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)].map((m) => m[1]),
      );
      for (const id of read) {
        if (!decls.has(id)) continue;
        if (decls.get(id) > entryIndex) {
          violations.push(`${name}() reads ${id}, declared after the load-time applyPrefs() call`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});

// ---- Settings round-trip sweep — one systematic test instead of a bespoke persistence test per
// toggle. For each control: change it, then simulate a reload by calling applyPrefs() again (the
// same real load-time sync function tested above, and the same "call applyPrefs() again against
// whatever's in localStorage now" pattern the theme-migration tests above already use) after
// first clobbering the DOM's own reflection of it — so this is actually testing that the
// PERSISTED value round-trips through a reload, not just that the toggle function's own
// synchronous DOM update worked.
describe("Settings round-trip: every Settings control's change survives reapplying prefs (reload-equivalent)", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("Theme", () => {
    window.toggleTheme();
    const theme = window.document.documentElement.getAttribute("data-theme");
    window.document.documentElement.setAttribute("data-theme", "bogus");
    evalIn(window, "applyPrefs()");
    assert.equal(window.document.documentElement.getAttribute("data-theme"), theme);
  });
  it("Icon Style", () => {
    window.toggleIconStyle();
    const label = window.document.getElementById("iconStyleToggle").innerHTML;
    window.document.getElementById("iconStyleToggle").innerHTML = "bogus";
    evalIn(window, "applyPrefs()");
    assert.equal(window.document.getElementById("iconStyleToggle").innerHTML, label);
  });
  it("Row Density", () => {
    window.toggleDensity();
    const text = window.document.getElementById("densityToggle").textContent;
    const attr = window.document.documentElement.getAttribute("data-density");
    window.document.getElementById("densityToggle").textContent = "bogus";
    window.document.documentElement.removeAttribute("data-density");
    evalIn(window, "applyPrefs()");
    assert.equal(window.document.getElementById("densityToggle").textContent, text);
    assert.equal(window.document.documentElement.getAttribute("data-density"), attr);
  });
  it("Row Zebra Stripes", () => {
    window.toggleStripe();
    const text = window.document.getElementById("stripeToggle").textContent;
    window.document.getElementById("stripeToggle").textContent = "bogus";
    evalIn(window, "applyPrefs()");
    assert.equal(window.document.getElementById("stripeToggle").textContent, text);
  });
  it("Color Vision", () => {
    const li = window.document.querySelector('#cbSelect li[data-value="2"]');
    window.selectCvOption(li, "2");
    const attr = window.document.documentElement.getAttribute("data-cb");
    window.document.documentElement.removeAttribute("data-cb");
    evalIn(window, "applyPrefs()");
    assert.equal(window.document.documentElement.getAttribute("data-cb"), attr);
    // restore for any later test in this process
    window.selectCvOption(
      window.document.querySelector('#cbSelect li[data-value="0"]'),
      "0",
    );
  });
  it("Question Timer default duration", () => {
    window.setQtDurationSec(420);
    const sec = evalIn(window, "qtDurationSec");
    assert.equal(sec, 420);
    evalIn(window, "qtDurationSec = 60;");
    evalIn(window, "applyPrefs()");
    // applyPrefs() itself doesn't re-sync qtDurationSec (only setQtDurationSec/storage.js's own
    // restore path does, on load) — this asserts the PERSISTED value is what a real reload's own
    // restore path reads, the same TRStore.getItem(PREFS_KEY) round-trip storage.js performs.
    const persisted = JSON.parse(evalIn(window, "TRStore.getItem(PREFS_KEY)"));
    assert.equal(persisted.qtDurationSec, 420);
  });
});

// ============================================================================
// Save/Load round-trip — nothing above exercised loadFromFile() at all (only Save/Export). A
// real File is constructed and fed through the real FileReader path exactly as a host's file
// picker would, guarding the whole format from silent data loss as team/round fields get added.
// ============================================================================
describe("Save/Load round-trip", () => {
  it("a file exported from gameState loads back to a deep-equal gameState", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        `gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON));
         gameState.meta.hostName = "Round-Trip File Test";
         renderAll();`,
      );
      const original = evalIn(window, "JSON.stringify(gameState)");
      const file = new window.File([original], "save.json", {
        type: "application/json",
      });
      evalIn(window, "gameState = freshState(); renderAll();");
      assert.notEqual(evalIn(window, "JSON.stringify(gameState)"), original);
      window.loadFromFile({ target: { files: [file], value: "" } });
      await new Promise((r) => setTimeout(r, 50));
      const restored = evalIn(window, "JSON.stringify(gameState)");
      assert.equal(restored, original);
    } finally {
      window.close();
    }
  });

  it("loading a file with invalid JSON leaves gameState untouched and shows an alert, rather than throwing", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      const before_ = evalIn(window, "JSON.stringify(gameState)");
      const file = new window.File(["not valid json{{{"], "bad.json", {
        type: "application/json",
      });
      assert.doesNotThrow(() =>
        window.loadFromFile({ target: { files: [file], value: "" } }),
      );
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(evalIn(window, "JSON.stringify(gameState)"), before_);
      assert.equal(
        window.document.getElementById("confirmOverlay").classList.contains("show"),
        true,
      );
      window.document.getElementById("confirmOkBtn").click();
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Render idempotency — calling the real render entry points twice with no state change in
// between must produce byte-identical HTML. Catches non-determinism (a stray Math.random()/
// Date.now()-derived id, an unstable object-key iteration order feeding a template) that would
// otherwise only ever show up as intermittent flicker or orphaned event listeners in a real
// browser, never as a clean test failure.
// ============================================================================
describe("Render idempotency", () => {
  it("renderAll() called twice in a row with no state change produces byte-identical #mainContent and #sidebarBody HTML", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(
        window,
        "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
      );
      evalIn(window, "renderAll()");
      const main1 = window.document.getElementById("mainContent").innerHTML;
      const sb1 = window.document.getElementById("sidebarBody").innerHTML;
      evalIn(window, "renderAll()");
      const main2 = window.document.getElementById("mainContent").innerHTML;
      const sb2 = window.document.getElementById("sidebarBody").innerHTML;
      assert.equal(main2, main1);
      assert.equal(sb2, sb1);
    } finally {
      window.close();
    }
  });

  it("renderAll() on a freshly-started (empty) game is also idempotent", async () => {
    const window = await loadAppWindow();
    try {
      evalIn(window, "gameState = freshState(); renderAll();");
      const main1 = window.document.getElementById("mainContent").innerHTML;
      evalIn(window, "renderAll()");
      const main2 = window.document.getElementById("mainContent").innerHTML;
      assert.equal(main2, main1);
    } finally {
      window.close();
    }
  });
});

// ============================================================================
// Reentrancy smoke test — most of this app's UI is bare onclick with no disable-while-pending
// guard. Every handler exercised here is a synchronous Set add/delete (toggleSection/
// toggleBonusQ/toggleQuestion) or a synchronous DOM write (Save), so a rapid double-invocation
// from a real double-tap can never actually interleave mid-toggle the way an async handler
// could — but a regression that made one of these async (an added await, a setTimeout) would
// reopen exactly that risk silently. This is cheap insurance either way: two calls back-to-back
// must never throw, and — since two toggles of the same boolean/Set-membership state are a
// no-op overall — must leave state exactly as it started, not half-flipped.
// ============================================================================
describe("Reentrancy smoke test: rapid double-invocation of a toggle handler", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(
      window,
      "gameState = migrateState(JSON.parse(SAMPLE_GAME_JSON)); renderAll();",
    );
  });
  after(() => window.close());

  it("double-invoking toggleSection('sec-r1') back-to-back doesn't throw and restores the original collapsed state", () => {
    const before_ = window.document
      .getElementById("sec-r1")
      .classList.contains("collapsed");
    assert.doesNotThrow(() => {
      window.toggleSection("sec-r1");
      window.toggleSection("sec-r1");
    });
    assert.equal(
      window.document.getElementById("sec-r1").classList.contains("collapsed"),
      before_,
    );
  });

  it("double-invoking toggleBonusQ(0) back-to-back doesn't throw and restores the original collapsed state", () => {
    const before_ = window.document
      .getElementById("bqblock-0")
      .classList.contains("bq-collapsed");
    assert.doesNotThrow(() => {
      window.toggleBonusQ(0);
      window.toggleBonusQ(0);
    });
    assert.equal(
      window.document.getElementById("bqblock-0").classList.contains("bq-collapsed"),
      before_,
    );
  });

  it("double-invoking toggleQuestion(0,0) back-to-back doesn't throw and restores the original collapsed state", () => {
    const before_ = window.document
      .getElementById("qblock-0-0")
      .classList.contains("q-collapsed");
    assert.doesNotThrow(() => {
      window.toggleQuestion(0, 0);
      window.toggleQuestion(0, 0);
    });
    assert.equal(
      window.document.getElementById("qblock-0-0").classList.contains("q-collapsed"),
      before_,
    );
  });

  it("double-clicking Save (saveToFile) back-to-back doesn't throw", () => {
    assert.doesNotThrow(() => {
      window.saveToFile();
      window.saveToFile();
    });
  });
});
