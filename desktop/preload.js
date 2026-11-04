"use strict";
// Runs before the page, in an isolated context. Hands the web app a synchronous snapshot of the
// saved data plus fire-and-forget set/remove, as window.TRDesktopStore (consumed by TRStore in
// js/storage.js). The main process refuses to answer for any page that isn't the Scorekeeper
// origin, in which case nothing is exposed and the page falls back to its own localStorage.
const { contextBridge, ipcRenderer } = require("electron");

const snapshot = ipcRenderer.sendSync("store:snapshot");
if (snapshot) {
  contextBridge.exposeInMainWorld("TRDesktopStore", {
    snapshot,
    set: (k, v) => ipcRenderer.send("store:set", String(k), String(v)),
    remove: (k) => ipcRenderer.send("store:remove", String(k)),
  });
  contextBridge.exposeInMainWorld("TRDesktop", { platform: process.platform });
}
