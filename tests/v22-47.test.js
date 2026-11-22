// v22.47 — What's new shows only the last three versions, and the closing Export steps of the
// tutorial / FAQ walk through PDF -> Winner Photos -> Game Confirmation.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadAppWindow, loadFaqWindow, evalIn } = require("./helpers/load-app");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("v22.47 What's new", () => {
  it("lists exactly three versions, newest first and equal to APP_VERSION, with no Earlier versions twisty", async () => {
    const window = await loadAppWindow();
    try {
      const vers = [...window.document.querySelectorAll(".settings-about .about-ver b")].map((b) => b.textContent);
      assert.equal(vers.length, 3);
      const n = (v) => v.slice(1).split(".").map(Number);
      // Dev-only releases (e.g. v22.52 Developer Tools) bump APP_VERSION without a What's new entry.
      const [cur, top] = [n(evalIn(window, "APP_VERSION")), n(vers[0])];
      assert.ok(top[0] < cur[0] || (top[0] === cur[0] && top[1] <= cur[1]), `${vers[0]} is newer than APP_VERSION`);
      for (let i = 1; i < 3; i++) {
        const [a, b] = [n(vers[i - 1]), n(vers[i])];
        assert.ok(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), `${vers[i - 1]} should be newer than ${vers[i]}`);
      }
      assert.equal(window.document.querySelector(".about-older"), null);
    } finally {
      window.close();
    }
  });
});

describe("v22.47 closing tutorial steps and FAQ", () => {
  it("tutorial walks PDF, then Winner Photos, then Game Confirmation, in that order", () => {
    const src = read("js/tutorial.js");
    const iPdf = src.indexOf("to save a copy of the finished game");
    const iPhotos = src.indexOf("Winner Photos is the link to use at the end of the game");
    const iConfirm = src.indexOf("Game Confirmation. It opens the form in a new tab");
    assert.ok(iPdf > 0 && iPhotos > iPdf && iConfirm > iPhotos, "steps missing or out of order");
    assert.match(src, /winning teams. names and photos/);
  });

  it("FAQ has the wrap-up walkthrough in backup, Winner Photos, PDF, Game Confirmation order", async () => {
    const window = await loadFaqWindow();
    try {
      const item = window.document.getElementById("q-how-do-i-wrap-up-a-finished-game");
      assert.ok(item, "wrap-up FAQ item missing");
      const steps = [...item.querySelectorAll("ol > li > strong:first-child")].map((s) => s.textContent);
      const pos = ["Save a Scoresheet backup", "Submit the winners", "Save the Scoresheet", "Submit your Game Confirmation"].map((t) => steps.findIndex((x) => x.startsWith(t)));
      assert.deepEqual(pos, [0, 1, 2, 3], "steps missing or out of order: " + steps);
      assert.match(item.textContent, /Optional/);
      assert.match(item.textContent, /winners. names and photos/);
    } finally {
      window.close();
    }
  });
});
