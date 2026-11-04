// v21.33 — rolling backups: after each finished question + every 3 minutes, last 10 kept, restorable.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");
const tick = (w) => new Promise((r) => w.setTimeout(r, 10));

describe("rolling backups", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
    evalIn(window, `TRStore.removeItem(BACKUP_KEY); gameState = freshState(); gameState.teams=[freshTeam("A"),freshTeam("B")]; gameState.teams.forEach(t=>t.scoreGuess=50); gameState.meta.mode="regular"; gameState.meta.location="Pub"; gameState.meta.hostName="Host"; gameState.meta.quizId="AB-123"; renderAll(); autosave();`);
  });
  after(() => window.close());

  it("no backup for a roster that has not started scoring", async () => {
    await tick(window);
    assert.equal(evalIn(window, "loadBackups().length"), 0);
  });
  it("a question is only 'finished' once every active team has a wager and a result", async () => {
    evalIn(window, `cycleW(0,0,0,1);`);
    await tick(window);
    assert.equal(evalIn(window, "loadBackups().length"), 0, "only one of two teams scored");
    evalIn(window, `cycleW(0,0,1,2);`);
    await tick(window);
    assert.equal(evalIn(window, "loadBackups().length"), 1);
    assert.equal(evalIn(window, "loadBackups()[0].why"), "question");
    assert.equal(evalIn(window, "loadBackups()[0].q"), 1);
  });
  it("a paused team does not hold a question open", async () => {
    evalIn(window, `gameState.teams[1].paused=true; cycleW(0,1,0,2);`);
    await tick(window);
    assert.equal(evalIn(window, "loadBackups().length"), 2);
    evalIn(window, `gameState.teams[1].paused=false;`);
  });
  it("correcting a score (count going down) does not back up again", async () => {
    const n = evalIn(window, "loadBackups().length");
    evalIn(window, `cycleW(0,0,0,1); cycleW(0,0,0,1);`); // correct->incorrect->cleared
    await tick(window);
    assert.equal(evalIn(window, "loadBackups().length"), n);
  });
  it("the 3-minute timer backs up a changed game and skips an identical one", () => {
    evalIn(window, `gameState.meta.hostName="Zed"; autosave();`);
    const n = evalIn(window, "loadBackups().length");
    evalIn(window, `addBackup("timer", TRStore.getItem(STORAGE_KEY));`);
    assert.equal(evalIn(window, "loadBackups().length"), n + 1);
    evalIn(window, `addBackup("timer", TRStore.getItem(STORAGE_KEY));`);
    assert.equal(evalIn(window, "loadBackups().length"), n + 1, "identical to newest — skipped");
    assert.equal(evalIn(window, "BACKUP_INTERVAL_MS"), 180000);
  });
  it("keeps only the newest 10", () => {
    evalIn(window, `for (let i=0;i<15;i++){ gameState.meta.hostName="H"+i; addBackup("timer", JSON.stringify(gameState)); }`);
    assert.equal(evalIn(window, "loadBackups().length"), 10);
    assert.equal(evalIn(window, "JSON.parse(loadBackups()[0].state).meta.hostName"), "H14");
    assert.equal(evalIn(window, "JSON.parse(loadBackups()[9].state).meta.hostName"), "H5");
  });
  it("backups survive Clear Session and can be restored", async () => {
    evalIn(window, `gameState.meta.hostName="KEEP"; autosave(); addBackup("timer", TRStore.getItem(STORAGE_KEY)); startNewGame();`);
    assert.equal(evalIn(window, "gameState.teams.length"), 0);
    assert.equal(evalIn(window, "JSON.parse(loadBackups()[0].state).meta.hostName"), "KEEP");
    const p = evalIn(window, "restoreBackup(0)");
    // confirm dialog is up — accept it
    window.document.getElementById("confirmOkBtn").click();
    await p;
    assert.equal(evalIn(window, "gameState.meta.hostName"), "KEEP");
    assert.equal(evalIn(window, "gameState.teams.length"), 2);
  });
  it("storage that rejects writes never throws", () => {
    evalIn(window, `const o=TRStore.setItem; TRStore.setItem=()=>{}; try{ gameState.meta.hostName="X1"; addBackup("timer", JSON.stringify(gameState)); } finally { TRStore.setItem=o; }`);
  });
  it("openBackups lists the snapshots", () => {
    evalIn(window, "openBackups()");
    const o = window.document.getElementById("backupsOverlay");
    assert.ok(o.classList.contains("show"));
    assert.equal(o.querySelectorAll(".ht-backups li").length, evalIn(window, "loadBackups().length"));
  });
});
