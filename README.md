# Scorekeeper

A live scoring tool for trivia nights — a static, no-build-step web app built with plain HTML, CSS, and JavaScript. Scorekeeper runs in any modern browser and works on both desktop and mobile devices.

**Current version:** v22.22 (as of 2026-11-14) — see [CHANGELOG.md](CHANGELOG.md)

## What it does

Scorekeeper is designed for a trivia host managing a game with multiple teams:

- **Real-time score tracking** — enter team names, track scores, and watch standings update live across all devices.
- **Four game modes** — pick from the Game Mode dropdown: **Regular Trivia** (4 rounds, 4-part bonuses, halftime/final wagers), **Theme Night** (3 rounds, each closed by a Q5 wager), **Name That Tune** (4 rounds, each closed by a Q5 wager) and **Revolution Rivals** (survey-style: Q1–4 score by the answer's place — #1/#2/#3/Other = 10/7/4/0 — with a Q5 wager on the #1 answer; perfect night 210). Each mode has its own accent colour, score-guess limit, exports and tutorial, and switching modes with scores on the board asks first.
- **Question flow** — mark questions correct/incorrect, adjust scores per team, and navigate through halftime and final standings.
- **Drumroll & prize drawing** — built-in drumroll animation with Web Audio playback (no HTML5 `<audio>` lag) for announcing prize winners.
- **Mobile & desktop UI** — responsive design adapts from a phone-sized sidebars-and-scoreboard layout on mobile to a full side-by-side view on tablet/desktop.
- **Dark & light themes** — built-in theme switcher, plus color-vision accessibility modes (red-green and blue-yellow) for inclusive reading on any display.
- **Teams tools** — pause a team that sits out, sort the roster A–Z (ignoring a leading The/An/A) or by missing guess, track Bonus Item/CB, and open a per-team Team Report with a rename pencil.
- **Safety nets** — rolling auto-backups (last 10, restorable from Settings), import team names/host/location from a saved game, and save/load the whole session as a file.
- **Insights & exports** — score-progression chart (shareable image), keyboard shortcuts (`?` lists them), and XLSX / PDF / JD Form exports named after the mode.
- **Customizable settings** — adjust text size, sound levels, timer widgets, and manual drumroll controls in Advanced Settings, all persisted to browser storage.
- **No backend required** — all game state lives in the browser; no login, no account, no server sync needed.

## Running locally

No build step — it's plain HTML/CSS/JS. Serve the folder over HTTP (so `localStorage` and service worker registration work properly):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

Or use any other HTTP server you prefer (`npx http-server`, Node.js, Ruby, PHP, etc.).

## Project structure

| Path | What it is |
|---|---|
| `index.html` | The main app — markup only. |
| `css/styles.css` | Shared design system (colors, fonts, buttons, settings panel). |
| `js/app.js` | Main app: rendering, settings, event handling and the score-changing actions. |
| `js/scoring.js` | Pure scoring, ranking and game-mode rules. |
| `js/storage.js` | Autosave, rolling backups, save/load, import and sample games. |
| `js/export.js`, `js/craft-prize.js`, `js/team-audit.js`, `js/question-timer.js`, `js/tutorial*.js`, … | Exports (XLSX/PDF), Craft Prize drawing, Team Report, timer and guided tour. See [ARCHITECTURE.md](ARCHITECTURE.md). |
| `js/data/` | Bundled XLSX templates for export. |
| `assets/audio/` | Drumroll start/loop/end and horn clips. |
| `desktop/` | Electron wrapper for the desktop app (see `desktop/README.md`). |
| `tests/` | Node test suite (jsdom exercises of the real app). |
| `sw.js` | Service worker for offline use. |
| `icons/` | App icon in multiple sizes (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). |
| `fonts/` | Self-hosted variable fonts (`inter-var.woff2`, `space-grotesk-var.woff2`) — no Google Fonts request at runtime. |
| `assets/` | Static assets (social sharing images, etc.). |
| `faq/` | Standalone FAQ & Tips site — searchable, collapsible sections, screenshots, and the same design system as the main app. |
| `manifest.json` | Web app manifest for PWA installation and home-screen bookmarking. |
| `CHANGELOG.md` | Full version history. |

## Features

### Core Scoring
- Add teams and track scores in real time.
- Entry by entry: log who answered, mark correct/incorrect, adjust score per team.
- Sort teams and standings by score (ascending/descending) or restore entry order.
- Mode-specific scoring: wagers per question (Regular/Theme/Tune) or survey places (Rivals).

### Question Answering Flow
- **Before the question:** Set up the points and confirm the team.
- **During:** Hit the correct/incorrect button when a team answers.
- **Per-team adjustments:** Award or deduct bonus points for any team without re-entering the Q/A flow.
- **Question review:** See all Q/A history and undo if needed.

### Standings
- Live main scoreboard (desktop: always visible on the right; mobile: tap to see).
- Halftime and final standings screens — show the full team list, sorted by score.
- Craft Prize winner drawing — built-in drumroll with Web Audio engine, manual or automatic finish.

### Settings & Customization
- **Theme:** Dark (default) or Light.
- **Color Vision:** Off, Red-Green (deuteranopia/protanopia), or Blue-Yellow (tritanopia).
- **Text Size:** A−, A (default), A+.
- **Advanced Settings:**
  - Manual Drumroll Control — start/stop/fade the drumroll on demand.
  - Sound Test Buttons — quick audio checks without a full game setup.
  - Timer Widget — optional question timer with manual stepper buttons.
  - Sound adjustments — separate volume controls for drumroll, effects, and alerts.

### Accessibility
- High-contrast, readable in any light.
- Color-vision-safe palettes (tested against CVD simulators).
- Text-size adjustment built-in (no browser zoom needed).
- Touch-friendly on mobile (large hit targets, no hover-only controls).
- Full keyboard navigation (Tab, Enter, Escape all work).
- Works without JavaScript (core HTML structure remains interactive).

### Progressive Web App
- Installable on home screen on iOS, Android, and desktop (Chrome, Edge, etc.).
- Works offline once loaded (service worker caches all assets).
- Runs at full screen, hides browser chrome for a native app feel.

## Development

### Linting & Testing
```bash
# Install dev dependencies
npm install

# Lint everything (JavaScript, CSS, HTML)
npm run lint

# Run tests
npm test
```

- **ESLint** for JavaScript code style.
- **Stylelint** for CSS consistency.
- **html-validate** for HTML structure and accessibility.
- **Node.js test runner + jsdom** — `npm test` loads the real page and covers scoring/ranking unit tests (`tests/unit-scoring.test.js`), end-to-end flows (`tests/integration-flows.test.js`), exports, PWA/service-worker integrity, accessibility contrast and HTML/CSS structure. `TESTING.md` holds the manual QA checklist.

### No build step required
All HTML, CSS, and JS are served as-is. The only pre-processing is:
- Audio clips are plain WAV files under `assets/audio/`, precached by the service worker.
- Icons are pre-generated at standard sizes (`icon-192.png` from `icons/icon-source.svg`).

## Browser support

- Modern browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile.
- iOS 12.2+ (Web Audio, localStorage, service workers all supported).
- Android 5.0+ (Chrome/Firefox with the same features).

## License

MIT — see [LICENSE](LICENSE) (if one exists in the project root).

## Built with

- **Claude AI** — the app and FAQ were developed with AI assistance.
- Pure **JavaScript** (no frameworks, no build tools).
- **Web Audio API** for gapless drumroll playback.
- **CSS custom properties** for theming and color-vision modes.
- **Service Worker** for offline support and PWA functionality.

---

**Questions?** Check the [FAQ & Tips](faq/index.html) in the app, or open an issue on GitHub.
