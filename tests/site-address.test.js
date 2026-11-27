// The app is hosted at one address. Links, share previews and search tags have to use it.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const SITE = "https://electricburgers.github.io/scorekeeper/";

describe("site address", () => {
  it("no site file or FAQ readme mentions the old address, which doesn't resolve", () => {
    for (const f of ["index.html", "faq/index.html", "faq/README.md", "sw.js", "_headers"])
      assert.ok(!read(f).includes("scorekeeper.triviarevolution.com"), f);
  });

  for (const [file, page] of [["index.html", SITE], ["faq/index.html", SITE + "faq/"]]) {
    it(`${file}: canonical, share URL and preview images use the live address`, () => {
      const html = read(file);
      const value = (re) => html.match(re)?.[1];
      assert.equal(value(/<link rel="canonical" href="([^"]+)"/), page);
      assert.equal(value(/<meta property="og:url" content="([^"]+)"/), page);
      for (const re of [/<meta property="og:image" content="([^"]+)"/, /<meta name="twitter:image" content="([^"]+)"/]) {
        const image = value(re);
        assert.ok(image.startsWith(SITE), image);
        assert.ok(fs.existsSync(path.join(__dirname, "..", image.slice(SITE.length))), image + " has no file");
      }
    });
  }

  it("the FAQ's open-from-the-website link goes to the live address", () => {
    assert.match(read("faq/index.html"), new RegExp(`<a href="${SITE}"\\s*>electricburgers\\.github\\.io/scorekeeper</a>`));
  });

  // GitHub serves 404.html for a missing page at any depth, so only full addresses work from it.
  // A root link ("/faq/") leaves out /scorekeeper/ and lands on another missing page.
  it("the Page not found links go to the live app and FAQ", () => {
    const hrefs = [...read("404.html").matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, [SITE, SITE + "faq/"]);
  });
});
