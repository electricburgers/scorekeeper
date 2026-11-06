# Architecture

A short orientation for reading the code. For features and history see `README.md` and `CHANGELOG.md`.

## Shape of the project

Plain HTML, CSS and JavaScript. No framework, no bundler, no build step.

- `index.html` holds the markup: the settings panel, modals and empty containers the JS fills in.
- `css/styles.css` holds the styling (themes, color-vision modes, layout).
- `js/*.js` holds the logic. Each file starts with a "READ ME FIRST" box describing its job.
- `sw.js` is the service worker that caches the app for offline use. `manifest.json` makes it installable.
- `faq/` is a separate help site that shares `js/shared-ui.js`. `desktop/` is an Electron wrapper.
- `tests/` runs with `npm test` (Node's test runner plus jsdom). `npm run lint` runs ESLint, Stylelint and html-validate.

## One shared global scope

`index.html` loads the scripts as classic `<script>` tags, not ES modules. Every top-level function
and `const` is therefore a global shared by every file, and there are no imports. `js/app.js` loads
last, because it holds the startup code and calls into the others.

## The data model

One global object, `gameState`, holds everything about the current game. `freshState()` in
`js/scoring.js` shows its shape: `meta` (date, location, quiz ID...), `teams[]`, `rounds[]`, plus the
halftime and final wager stores. Teams, rounds and questions are addressed by index: `ti`, `ri`, `qi`.

Preferences (theme, text size, toggles) are stored separately from the game. See `loadPrefs()` in `app.js`.

## The core loop

```
click -> handler in app.js -> mutate gameState -> autosave() -> renderAll()
```

1. A button in the HTML has an inline handler such as `onclick="cycleW(ri, qi, ti, w)"`.
2. The handler changes `gameState`. It checks `canScore()` first, which locks scoring until Event Details are valid.
3. `autosave()` writes `gameState` to storage.
4. `renderAll()` rebuilds the HTML from `gameState` as strings and assigns it to `innerHTML`.

The page is always redrawn from the data and nothing is remembered in the DOM. The scroll-anchoring
code in `renderLeftBody()` exists because a full redraw can otherwise make the view jump.

Anything a user typed must go through `esc()` (`js/dom-utils.js`) before it goes into an HTML string.

## Where things live

| Concern | File |
|---|---|
| Rules, wagers, totals, ranking | `js/scoring.js` (mostly pure functions of `gameState`) |
| Saving: autosave, backups, save/load file, import | `js/storage.js` |
| Rendering, handlers, startup | `js/app.js` |
| Craft prize draw + drumroll audio | `js/craft-prize.js` |
| PDF and Excel export | `js/export.js` (libraries load on first use) |
| Shortcuts, progress chart, backups dialog | `js/host-tools.js` |
| Guided tour | `js/tutorial.js` (lazy) + `js/tutorial-firstrun.js` |

## Autosave

- `autosave()` is synchronous. It calls `persistGameStateNow()`, which does `JSON.stringify(gameState)`
  and writes only if the string differs from what is already stored. That skips needless disk writes.
- The write goes through `TRStore`, a wrapper that uses localStorage, falls back to memory if the
  browser blocks it, and uses a file-backed store in the desktop app.
- After each write, `noteQuestionProgress()` checks whether another question has just been fully
  scored. If so it queues a backup. A timer also snapshots every 3 minutes. The last 10 backups
  are kept under their own key and restored from Settings > Backups.
- `autosaveDebounced()` exists for typing in the Staff Names field, which fires on every keystroke.
  It waits 400ms after the last keystroke. `flushAutosave()` forces the pending write when the page
  is hidden or closed.
- On load, `loadSaved()` reads the stored JSON and `migrateState()` upgrades older saves.

## Offline and updates

`sw.js` precaches the app shell. `checkForUpdate()` in `app.js` fetches `version.json` bypassing
caches and shows a dot on the gear icon when a newer build exists.
