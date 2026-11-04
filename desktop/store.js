"use strict";
// File-backed key/value store for the desktop shell. Holds the same string->string pairs the web
// app keeps in localStorage (see TRStore in js/storage.js). One JSON file, written atomically
// (temp file + rename) and debounced, with the previous good copy kept as <file>.bak so a crash
// or corrupt write can never take the saved game with it.
const fs = require("fs");
const path = require("path");

const MAX_VALUE_BYTES = 8 * 1024 * 1024; // one game blob is tens of KB; this is just a sanity cap
const MAX_KEYS = 200;

class FileStore {
  constructor(file, { debounceMs = 250 } = {}) {
    this.file = file;
    this.debounceMs = debounceMs;
    this.data = Object.create(null);
    this.timer = null;
    this.dirty = false;
    this._load();
  }

  _read(file) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad shape");
    const out = Object.create(null);
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") out[k] = v;
    return out;
  }

  _load() {
    for (const f of [this.file, this.file + ".bak"]) {
      try {
        this.data = this._read(f);
        return;
      } catch {
        /* missing or corrupt: fall through to the backup, then to empty */
      }
    }
  }

  snapshot() {
    return Object.assign({}, this.data);
  }

  set(key, value) {
    if (typeof key !== "string" || typeof value !== "string") return false;
    if (!key || key.length > 200 || Buffer.byteLength(value) > MAX_VALUE_BYTES) return false;
    if (!(key in this.data) && Object.keys(this.data).length >= MAX_KEYS) return false;
    this.data[key] = value;
    this._schedule();
    return true;
  }

  remove(key) {
    if (typeof key !== "string" || !(key in this.data)) return false;
    delete this.data[key];
    this._schedule();
    return true;
  }

  _schedule() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
    if (this.timer.unref) this.timer.unref();
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + ".bak");
      fs.renameSync(tmp, this.file);
    } catch {
      this.dirty = true; // try again on the next change or at quit
    }
  }
}

module.exports = { FileStore };
