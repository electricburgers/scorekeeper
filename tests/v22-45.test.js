// v22.45 — forward-compat save-file fields: schemaVersion, savedBy, gameId, createdAt/updatedAt,
// ext, meta.startedAt/endedAt/timezone/locale, teams[].id/notes, craft prize teamId.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

const j = (w, code) => JSON.parse(evalIn(w, `JSON.stringify(${code})`));

describe("v22.45 forward-compat save fields", () => {
  let window;
  before(async () => {
    window = await loadAppWindow();
  });
  after(() => window.close());

  it("a fresh game carries every new field", () => {
    const s = j(window, "freshState()");
    assert.equal(s.schemaVersion, 1);
    assert.match(s.gameId, /^[0-9a-f-]{36}$/);
    assert.ok(s.createdAt && s.updatedAt);
    assert.deepEqual(s.ext, {});
    for (const k of ["startedAt", "endedAt", "timezone", "locale"]) assert.equal(s.meta[k], "");
    const t = j(window, 'freshTeam("A")');
    assert.match(t.id, /^[0-9a-f-]{36}$/);
    assert.equal(t.notes, "");
  });

  it("migrateState fills the fields on an old file, with unique team ids, and keeps unknown keys", () => {
    const old = { meta: { date: "2026-01-01", mode: "regular" }, teams: [{ name: "A" }, { name: "B", id: "dup" }, { name: "C", id: "dup" }], futureThing: { x: 1 }, ext: { ios: { k: 1 } } };
    const s = j(window, `migrateState(${JSON.stringify(old)})`);
    assert.equal(s.schemaVersion, 1);
    assert.ok(s.gameId && s.createdAt && s.updatedAt);
    assert.deepEqual(s.ext, { ios: { k: 1 } });
    assert.deepEqual(s.futureThing, { x: 1 });
    const ids = s.teams.map((t) => t.id);
    assert.equal(new Set(ids).size, 3);
    assert.ok(ids.every((i) => typeof i === "string" && i));
    assert.ok(s.teams.every((t) => t.notes === ""));
  });

  it("a newer schemaVersion is left alone; a bad ext is repaired; notes are clamped", () => {
    const f = { meta: {}, teams: [{ name: "A", notes: "x".repeat(900) }], schemaVersion: 7, ext: [1] };
    const s = j(window, `migrateState(${JSON.stringify(f)})`);
    assert.equal(s.schemaVersion, 7);
    assert.deepEqual(s.ext, {});
    assert.equal(s.teams[0].notes.length, 500);
  });

  it("craft prize winner and legacy draws get a teamId next to ti", () => {
    const f = { meta: {}, teams: [{ name: "A", id: "a" }, { name: "B", id: "b" }], craftPrizeWinner: { ti: 1, script: "hi" }, craftPrizeDraws: [{ ti: 0 }, { ti: 1 }] };
    const s = j(window, `migrateState(${JSON.stringify(f)})`);
    assert.equal(s.craftPrizeWinner.teamId, "b");
    assert.deepEqual(s.craftPrizeDraws.map((d) => d.teamId), ["a", "b"]);
  });

  it("choosing a winner records teamId; removing an earlier team keeps the winner on the same team", () => {
    evalIn(window, `gameState = freshState(); gameState.meta.location="Pub";
      gameState.teams = [freshTeam("A"), freshTeam("B"), freshTeam("C")]; toggleCraftPrize(2);`);
    const id = evalIn(window, "gameState.teams[2].id");
    assert.equal(evalIn(window, "gameState.craftPrizeWinner.teamId"), id);
    evalIn(window, "removeTeamAt(0)");
    assert.equal(evalIn(window, "gameState.craftPrizeWinner.ti"), 1);
    assert.equal(evalIn(window, "gameState.teams[gameState.craftPrizeWinner.ti].id"), id);
    evalIn(window, "removeTeamAt(1)"); // the winner itself
    assert.equal(evalIn(window, "gameState.craftPrizeWinner"), null);
  });

  it("autosave stamps savedBy/updatedAt on a real change, and startedAt/timezone/locale on the first score", () => {
    evalIn(window, `gameState = freshState(); gameState.updatedAt = "2000-01-01T00:00:00.000Z"; gameState.teams=[freshTeam("A")]; autosave();`);
    const s1 = JSON.parse(evalIn(window, "TRStore.getItem(STORAGE_KEY)"));
    assert.match(s1.savedBy, /^web v\d+\.\d+/);
    assert.notEqual(s1.updatedAt, "2000-01-01T00:00:00.000Z");
    assert.equal(s1.meta.startedAt, "");
    evalIn(window, `gameState.gameStarted = true; autosave();`);
    const s2 = JSON.parse(evalIn(window, "TRStore.getItem(STORAGE_KEY)"));
    assert.ok(s2.meta.startedAt);
    assert.equal(typeof s2.meta.timezone, "string");
    // an autosave with nothing changed must not touch updatedAt
    evalIn(window, "autosave()");
    const s3 = JSON.parse(evalIn(window, "TRStore.getItem(STORAGE_KEY)"));
    assert.equal(s3.updatedAt, s2.updatedAt);
  });

  it("switching game mode keeps gameId and team ids/notes but restarts startedAt", () => {
    evalIn(window, `gameState = freshState(); gameState.teams=[freshTeam("A")]; gameState.teams[0].notes="vip"; gameState.meta.startedAt="2026-01-01T00:00:00.000Z";`);
    const before = j(window, "[gameState.gameId, gameState.teams[0].id]");
    evalIn(window, 'setGameMode("tune")');
    return new Promise((r) => setTimeout(r, 50)).then(() => {
      assert.deepEqual(j(window, "[gameState.gameId, gameState.teams[0].id]"), before);
      assert.equal(evalIn(window, "gameState.teams[0].notes"), "vip");
      assert.equal(evalIn(window, "gameState.meta.startedAt"), "");
    });
  });
});
