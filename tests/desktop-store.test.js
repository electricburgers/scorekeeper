// Desktop shell saved-data bridge: desktop/store.js (file-backed store) and TRStore's use of
// window.TRDesktopStore (what desktop/preload.js exposes) in js/storage.js.
"use strict";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { FileStore } = require("../desktop/store");
const { loadAppWindow, evalIn } = require("./helpers/load-app");

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trs-store-"));
  return { dir, file: path.join(dir, "store.json") };
}

describe("desktop FileStore", () => {
  it("persists set/remove across instances after flush", () => {
    const { dir, file } = tmpFile();
    const a = new FileStore(file);
    assert.equal(a.set("trivRev6_session", '{"x":1}'), true);
    a.set("gone", "1");
    a.remove("gone");
    a.flush();
    const b = new FileStore(file);
    assert.deepEqual(b.snapshot(), { trivRev6_session: '{"x":1}' });
    fs.rmSync(dir, { recursive: true });
  });

  it("debounces: nothing on disk until flush or the timer fires", async () => {
    const { dir, file } = tmpFile();
    const s = new FileStore(file, { debounceMs: 20 });
    s.set("k", "v");
    assert.equal(fs.existsSync(file), false);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).k, "v");
    fs.rmSync(dir, { recursive: true });
  });

  it("recovers from a corrupt main file using the .bak copy", () => {
    const { dir, file } = tmpFile();
    const a = new FileStore(file);
    a.set("k", "first");
    a.flush();
    a.set("k", "second"); // second flush copies the "first" file to .bak
    a.flush();
    fs.writeFileSync(file, "{not json");
    const b = new FileStore(file);
    assert.equal(b.snapshot().k, "first");
    fs.rmSync(dir, { recursive: true });
  });

  it("starts empty when there is no usable file", () => {
    const { dir, file } = tmpFile();
    assert.deepEqual(new FileStore(file).snapshot(), {});
    fs.rmSync(dir, { recursive: true });
  });

  it("rejects non-string and oversize input", () => {
    const { dir, file } = tmpFile();
    const s = new FileStore(file);
    assert.equal(s.set("k", 5), false);
    assert.equal(s.set(5, "v"), false);
    assert.equal(s.set("", "v"), false);
    assert.equal(s.set("big", "x".repeat(8 * 1024 * 1024 + 1)), false);
    assert.equal(s.remove("missing"), false);
    assert.deepEqual(s.snapshot(), {});
    fs.rmSync(dir, { recursive: true });
  });
});

describe("TRStore with the desktop bridge", () => {
  let window;
  const calls = [];
  before(async () => {
    window = await loadAppWindow((w) => {
      w.TRDesktopStore = {
        snapshot: { trivRev6_prefs: '{"theme":"dark"}' },
        set: (k, v) => calls.push(["set", k, v]),
        remove: (k) => calls.push(["remove", k]),
      };
    });
  });
  after(() => window.close());

  it("reads the injected snapshot, reports persistent, and leaves localStorage alone", () => {
    assert.equal(evalIn(window, "TRStore.persistent"), true);
    assert.equal(evalIn(window, 'TRStore.getItem("trivRev6_prefs")'), '{"theme":"dark"}');
    assert.equal(evalIn(window, 'TRStore.getItem("nope")'), null);
  });

  it("writes through to the bridge and reads back from memory", () => {
    evalIn(window, 'TRStore.setItem("trivRev6_sideW", 321)');
    assert.equal(evalIn(window, 'TRStore.getItem("trivRev6_sideW")'), "321");
    assert.deepEqual(calls.find((c) => c[1] === "trivRev6_sideW"), ["set", "trivRev6_sideW", "321"]);
    assert.equal(window.localStorage.getItem("trivRev6_sideW"), null);
    evalIn(window, 'TRStore.removeItem("trivRev6_sideW")');
    assert.equal(evalIn(window, 'TRStore.getItem("trivRev6_sideW")'), null);
    assert.deepEqual(calls[calls.length - 1], ["remove", "trivRev6_sideW"]);
  });

  it("the game save round-trips through the bridge", () => {
    evalIn(window, "autosave()");
    assert.ok(calls.some((c) => c[0] === "set" && c[1] === "trivRev6_session"));
    assert.ok(evalIn(window, "loadSaved()"));
  });
});
