// v21.6/v21.7: Settings > Import > From Saved Game opens a checklist overlay.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("import from saved game", () => {
  it("sits right under Color Vision and opens the file picker", () => {
    const html = read("index.html");
    const cv = html.indexOf('class="size-label">Color Vision');
    const imp = html.indexOf('class="size-label">Import');
    const qt = html.indexOf('class="size-label">Question Timer');
    assert.ok(cv < imp && imp < qt);
    assert.match(html, /id="importLoadInput"[^>]*onchange="openImportDialog\(event\)"/);
  });
  it("overlay has select all / none and the four fields", () => {
    const html = read("index.html");
    assert.match(html, /id="importOverlay"/);
    assert.match(html, /setImportChecks\(true\)[\s\S]*setImportChecks\(false\)/);
    const js = read("js/storage.js");
    for (const l of ["Brewery location", "Host name", "Restaurant staff", "Team names"]) assert.ok(js.includes(l), l);
  });
  it("version is bumped everywhere", () => {
    assert.match(read("js/app.js"), /APP_VERSION = "v21\.7"/);
    assert.equal(JSON.parse(read("version.json")).version, "v21.7");
  });
});

describe("hidden file inputs", () => {
  it("every <input type=file> in index.html is hidden by the stylesheet", () => {
    const html = read("index.html");
    const css = read("css/styles.css");
    for (const m of html.matchAll(/<input type="file" id="(\w+)"/g))
      assert.ok(new RegExp("#" + m[1] + "[,{]").test(css), m[1] + " is not display:none");
  });
});
