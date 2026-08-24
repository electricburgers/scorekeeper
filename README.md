# Scorekeeper

A live scoring tool for trivia nights — a static, no-build-step web app built with plain HTML, CSS, and JavaScript. Scorekeeper runs in any modern browser and works on both desktop and mobile devices.

**Live app:** [electricburgers.github.io/scorekeeper](https://electricburgers.github.io/scorekeeper/)  
**FAQ & Tips:** [electricburgers.github.io/scorekeeper/faq](https://electricburgers.github.io/scorekeeper/faq/)  
**Current version:** v19.49 (as of 2026-08-24) — see [CHANGELOG.md](CHANGELOG.md)

## What it does

Scorekeeper is designed for a trivia host managing a game with multiple teams:

- **Real-time score tracking** — enter team names, track scores, and watch standings update live across all devices.
- **Question flow** — mark questions correct/incorrect, adjust scores per team, and navigate through halftime and final standings.
- **Drumroll & prize drawing** — built-in drumroll animation with Web Audio playback (no HTML5 `<audio>` lag) for announcing prize winners.
- **Mobile & desktop UI** — responsive design adapts from a phone-sized sidebars-and-scoreboard layout on mobile to a full side-by-side view on tablet/desktop.
- **Dark & light themes** — built-in theme switcher, plus color-vision accessibility modes (red-green and blue-yellow) for inclusive reading on any display.
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
| `js/scorekeeper.js` | Core game state, rendering, and event handling. |
| `js/data/` | Bundled audio clips and clips metadata for drumroll playback. |
| `audio/` | Source audio files (drumroll start/loop/end, horn, sound-test clips). |
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
- Shuffle teams, sort by score (ascending/descending), or restore original order.

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
- **Node.js test runner** for unit tests (e.g., drumroll audio, scroll anchoring).

### No build step required
All HTML, CSS, and JS are served as-is. The only pre-processing is:
- Audio clips are encoded to base64 and bundled in `js/data/drum-clips.js` (generated once, checked in).
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
