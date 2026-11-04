"use strict";
// Electron shell for Trivia Scorekeeper (option "B"): a thin window around the hosted site. The
// site's own service worker handles offline use and web updates; this shell adds a real
// installer, sleep prevention, file-backed saved data (see store.js / preload.js) and
// auto-update of the shell itself via electron-updater.
const path = require("path");
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  net,
  powerSaveBlocker,
  session,
  shell,
  screen,
} = require("electron");
const fs = require("fs");
const { FileStore } = require("./store");

const PROD_URL = "https://scorekeeper.triviarevolution.com/";
// Dev override (unpackaged only): DESKTOP_START_URL=http://localhost:8080/ npm start
const START_URL =
  !app.isPackaged && process.env.DESKTOP_START_URL ? process.env.DESKTOP_START_URL : PROD_URL;
const START_ORIGIN = new URL(START_URL).origin;
const OFFLINE_PAGE = path.join(__dirname, "offline.html");

let win = null;
let store = null;
let settings = { keepAwake: true, bounds: null, maximized: false };
let settingsFile = null;
let awakeId = null;
let retryTimer = null;
let manualUpdateCheck = false;

// ---------------------------------------------------------------- settings (window + sleep)
function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile, "utf8")));
  } catch {
    /* first run */
  }
}
function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}
function boundsAreVisible(b) {
  if (!b) return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 50 && b.x + b.width > a.x + 50 && b.y < a.y + a.height - 50 && b.y + b.height > a.y;
  });
}
function applyKeepAwake() {
  if (awakeId !== null && powerSaveBlocker.isStarted(awakeId)) powerSaveBlocker.stop(awakeId);
  awakeId = settings.keepAwake ? powerSaveBlocker.start("prevent-display-sleep") : null;
}

// ------------------------------------------------------------------------------ IPC (store)
// Only the Scorekeeper site's top-level page may read or write saved data.
function trusted(event) {
  try {
    const f = event.senderFrame;
    return !!f && f.parent === null && new URL(f.url).origin === START_ORIGIN;
  } catch {
    return false;
  }
}
function registerIpc() {
  ipcMain.on("store:snapshot", (event) => {
    event.returnValue = trusted(event) ? store.snapshot() : null;
  });
  ipcMain.on("store:set", (event, k, v) => {
    if (trusted(event)) store.set(k, v);
  });
  ipcMain.on("store:remove", (event, k) => {
    if (trusted(event)) store.remove(k);
  });
}

// --------------------------------------------------------------------------------- window
function isSameOrigin(url) {
  try {
    return new URL(url).origin === START_ORIGIN;
  } catch {
    return false;
  }
}
function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") shell.openExternal(url);
  } catch {
    /* ignore malformed */
  }
}
function hardenContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSameOrigin(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isSameOrigin(url)) return;
    event.preventDefault();
    openExternal(url);
  });
}

function startRetryLoop() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    if (!win || win.isDestroyed()) return stopRetryLoop();
    try {
      const res = await net.fetch(START_URL, { method: "HEAD", signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status < 500) {
        stopRetryLoop();
        win.loadURL(START_URL);
      }
    } catch {
      /* still offline */
    }
  }, 5000);
}
function stopRetryLoop() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

function createWindow() {
  const b = boundsAreVisible(settings.bounds) ? settings.bounds : { width: 1280, height: 860 };
  win = new BrowserWindow({
    ...b,
    minWidth: 480,
    minHeight: 480,
    show: false,
    title: "Trivia Scorekeeper",
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required", // Name That Tune audio
    },
  });
  if (settings.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  // hardenContents() is applied by the app-level "web-contents-created" hook below, which covers
  // this window and any same-origin child window.

  win.webContents.on("did-fail-load", (_e, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted (a newer navigation took over)
    win.loadFile(OFFLINE_PAGE);
    startRetryLoop();
  });

  const remember = () => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    settings.maximized = win.isMaximized();
    if (!win.isMaximized()) settings.bounds = win.getBounds();
  };
  win.on("resize", remember);
  win.on("move", remember);
  win.on("close", () => {
    remember();
    saveSettings();
  });
  win.on("closed", () => {
    win = null;
    stopRetryLoop();
  });

  win.loadURL(START_URL);
}

// ------------------------------------------------------------------------------------ menu
function buildMenu() {
  const isMac = process.platform === "darwin";
  const checkItem = { label: "Check for Updates…", click: () => checkForUpdates(true) };
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              checkItem,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Keep Screen Awake",
          type: "checkbox",
          checked: settings.keepAwake,
          click: (item) => {
            settings.keepAwake = item.checked;
            saveSettings();
            applyKeepAwake();
          },
        },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Scorekeeper FAQ", click: () => openExternal(START_ORIGIN + "/faq/") },
        ...(isMac ? [] : [{ type: "separator" }, checkItem]),
        { type: "separator" },
        { label: `Desktop shell v${app.getVersion()}`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------------------- updating
let autoUpdater = null;
function setupUpdater() {
  if (!app.isPackaged) return;
  ({ autoUpdater } = require("electron-updater"));
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // "Later" still installs at the next quit
  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox(win || undefined, {
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: `Scorekeeper desktop ${info.version} is ready`,
        detail: "Restart to finish updating. If you choose Later, it installs the next time you quit.",
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on("update-not-available", () => {
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    dialog.showMessageBox(win || undefined, { type: "info", message: "You’re up to date.", detail: `Desktop shell v${app.getVersion()}` });
  });
  autoUpdater.on("error", (err) => {
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    dialog.showMessageBox(win || undefined, { type: "warning", message: "Couldn’t check for updates.", detail: String((err && err.message) || err) });
  });
  setTimeout(() => checkForUpdates(false), 10000);
  setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
}
function checkForUpdates(manual) {
  if (!autoUpdater) {
    if (manual) dialog.showMessageBox(win || undefined, { type: "info", message: "Updates are only checked in the installed app." });
    return;
  }
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {});
}

// ------------------------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    const userData = app.getPath("userData");
    settingsFile = path.join(userData, "settings.json");
    loadSettings();
    store = new FileStore(path.join(userData, "store.json"));
    registerIpc();

    // Deny everything except what the app actually uses.
    const allowed = new Set(["fullscreen", "clipboard-sanitized-write"]);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

    buildMenu();
    applyKeepAwake();
    createWindow();
    setupUpdater();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("web-contents-created", (_e, contents) => {
    if (contents.getType() === "window") hardenContents(contents);
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    if (store) store.flush();
    saveSettings();
  });
}
