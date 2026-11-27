// v22.99 — the Winner Photos form, the PDF and Game Confirmation must never replace the app's own
// tab: a browser that navigates away reloads the page, and the host can lose their place mid-wrap-up.
"use strict";
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadAppWindow, loadFaqWindow, evalIn } = require("./helpers/load-app");

describe("v22.99 wrap-up links and downloads open away from the app tab", () => {
  let window;
  let clicked;
  before(async () => {
    window = await loadAppWindow();
    // Record what a programmatic download clicks, as it is at the moment of the click.
    window.HTMLAnchorElement.prototype.click = function () {
      clicked.push({ target: this.target, rel: this.rel, download: this.download, href: this.href });
    };
  });
  after(() => window.close());
  beforeEach(() => {
    clicked = [];
    evalIn(
      window,
      `gameState = freshState();
       gameState.meta = { ...gameState.meta, quizId: "AB-1", hostName: "H", location: "Bar" };
       gameState.teams = ["A", "B", "C"].map(freshTeam);
       gameState.gameStarted = true;
       finishDone.clear(); collapsedSections.delete("sec-export"); renderAll();`,
    );
  });

  it("every download made with dl() targets a new tab if the browser ignores `download`", () => {
    evalIn(window, `dl(new Blob(["x"], { type: "application/pdf" }), "a.pdf")`);
    assert.equal(clicked.length, 1);
    assert.equal(clicked[0].target, "_blank");
    assert.match(clicked[0].rel, /noopener/);
    assert.equal(clicked[0].download, "a.pdf", "still a download, with its file name");
  });

  it("Download PDF keeps its file name and cannot replace the app tab", async () => {
    await evalIn(window, "exportPDF()");
    assert.equal(clicked.length, 1);
    assert.equal(clicked[0].target, "_blank");
    assert.match(clicked[0].rel, /noopener/);
    assert.match(clicked[0].download, /\.pdf$/);
    assert.match(clicked[0].href, /^blob:/);
  });

  for (const [name, selector, step] of [
    ["Winner Photos form", "a.photo-upload-btn", "photos"],
    ["Game Confirmation", "a.jd-upload-btn", "confirm"],
  ]) {
    it(`${name} is a new-tab link, and tapping it leaves the click to the browser`, () => {
      const link = window.document.querySelector("#finishChecklist " + selector);
      assert.equal(link.target, "_blank");
      assert.match(link.rel, /noopener/);
      assert.match(link.href, /^https:\/\//);
      const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
      assert.equal(evalIn(window, `finishDone.has("${step}")`), true);
      assert.equal(evalIn(window, "gameState.teams.length"), 3, "the game is untouched");
    });
  }

  it("every link to another site, in the app and the FAQ, opens in a new tab", async () => {
    const faq = await loadFaqWindow();
    try {
      for (const doc of [window.document, faq.document]) {
        for (const a of doc.querySelectorAll('a[href^="http"]')) {
          // The app's own address (the FAQ's "open it from the website" help link) isn't "another site".
          if (["scorekeeper.test", "electricburgers.github.io"].includes(new URL(a.href).hostname)) continue;
          assert.equal(a.target, "_blank", a.href + " would replace the current tab");
        }
      }
    } finally {
      faq.close();
    }
  });
});
