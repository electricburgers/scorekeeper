// v21.9: A-Z view of the Teams section (entry order kept) and an editable name in the Team Report.
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("team name A-Z view", () => {
  const app = read("js/app.js");
  it("is view-only: ordering comes from teamEntryOrder, rows keep their entry index", () => {
    assert.match(app, /function teamEntryOrder\(\)/);
    assert.match(app, /teamEntryOrder\(\)\.forEach\(\(i\) => \{/);
    assert.match(app, /function cycleTeamAlphaSort/);
    assert.ok(!/gameState\.teams\.sort/.test(app));
  });
});
describe("Team Report rename", () => {
  it("name is an input wired to setAuditTeamName", () => {
    assert.match(read("js/team-audit.js"), /class="aud-name-input"[^>]*onchange="setAuditTeamName\(\$\{ti\},this\.value\)"/);
    assert.match(read("js/app.js"), /function setAuditTeamName/);
  });
});

const { loadAppWindow, evalIn } = require("./helpers/load-app");
describe("behaviour", () => {
  it("A-Z reorders the rows but not the data; Team Report rename updates the team", async () => {
    const w = await loadAppWindow();
    evalIn(w, `gameState = freshState(); gameState.teams = ["Zed","", "alpha","Mid"].map(freshTeam); renderAll(); cycleTeamAlphaSort();`);
    const d = w.document;
    const rows = () => [...d.querySelectorAll("#sec-teams .team-entry")].map((r) => r.querySelector(".team-number").textContent + ":" + r.querySelector("input[type=text]").value);
    assert.deepEqual(rows(), ["Team 3:alpha", "Team 4:Mid", "Team 1:Zed", "Team 2:"]);
    assert.deepEqual([...evalIn(w, "gameState.teams.map(t=>t.name)")], ["Zed", "", "alpha", "Mid"]);
    evalIn(w, "cycleTeamAlphaSort()");
    assert.equal(rows()[0], "Team 1:Zed");
    evalIn(w, "cycleTeamAlphaSort()");
    assert.equal(rows()[0], "Team 1:Zed");
    assert.equal(rows()[1], "Team 2:");
    evalIn(w, `openAudit(3); setAuditTeamName(3, "Middle")`);
    assert.equal(evalIn(w, "gameState.teams[3].name"), "Middle");
    assert.equal(d.querySelector(".aud-name-input").value, "Mid");
    w.close();
  });
});
