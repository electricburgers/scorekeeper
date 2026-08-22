# Scorekeeper FAQ

The standalone FAQ &amp; Tips site for [Scorekeeper](https://electricburgers.github.io/scorekeeper/),
a live scoring tool for trivia nights. It's a static site — searchable, collapsible questions
organized by section, plus screenshots for the harder-to-describe parts of the app.

Current version: **v1.8 (17 Aug 2026)** — see [CHANGELOG.md](CHANGELOG.md).

Built with [Claude AI](https://www.anthropic.com/claude) — the FAQ content and site code were
developed with AI assistance.

## What's here

| Path | What it is |
|---|---|
| `index.html` | The FAQ page itself — markup only. |
| `css/styles.css` | The shared Scorekeeper design system (colors, fonts, buttons, the settings panel, etc.), copied over from the main app so this page always matches its live theme/color-vision/text-size settings instead of drifting into its own look. |
| `css/faq.css` | Page-specific layout: header, search/TOC toolbar, accordion items, screenshot cards, lightbox, footer. |
| `css/fonts.css` | `@font-face` declarations for the self-hosted fonts below — no Google Fonts CDN request at runtime. |
| `fonts/` | The two font files themselves (`inter-var.woff2`, `space-grotesk-var.woff2`) — variable fonts, one file per family covers every weight this page uses. |
| `js/faq-bootstrap.js` | A tiny blocking script that applies the saved theme/color-vision/text-size *before* first paint, so the page never flashes the wrong look. |
| `js/faq.js` | Page behavior: search/filter, expand/collapse, the screenshot lightbox, the version label, the optional light-mode screenshot swap, and the Settings panel (Text Size + Color Vision). |
| `screenshots/` | Screenshots referenced by the FAQ. See [screenshots/README.md](screenshots/README.md) for the full shot list, capture instructions, and the optional light/dark naming convention. |

## Running it locally

No build step — it's plain HTML/CSS/JS. Serve the folder over a real origin so
`localStorage` (theme/settings persistence) works — opening `index.html` directly via
`file://` can block that in some browsers (notably Chromium):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Settings

The ⚙️ Settings panel in the header lets a reader adjust **Text Size** (A−/A/A+) and
**Color Vision** (Off / Red-Green / Blue-Yellow) for this page. Both settings are stored
in the same `trivRev6_prefs` localStorage key the main Scorekeeper app uses, so a change
made here also applies the next time the app itself is opened in the same browser, and
vice versa.

## Design system

Dark and light themes, plus red-green and blue-yellow color-vision-safe palettes, are all
driven by CSS custom properties in `css/styles.css`, toggled via `data-theme`/`data-cb`
attributes on `<html>`. Every accent color has a separate, darker/more-saturated
"text-safe" token (`--txt-*`) so text sitting on a card independently clears WCAG AA/AAA
contrast in every theme × color-vision combination.

Fonts (Inter for body text, Space Grotesk for headings/logo/numbers) are self-hosted from
`fonts/` via `css/fonts.css` — no request to Google Fonts or any other third party at
runtime. Each family ships as a single variable-weight `.woff2` file covering every
weight this page uses, so it's still just two font downloads total despite five
`@font-face` declarations.

## Screenshots in Light theme

Every screenshot is captured once, in Dark theme (the app default), and that's what every
reader sees regardless of their own theme — with one opt-in exception: dropping a
`<name>-light.webp` file next to an existing `<name>.webp` in `screenshots/` makes `js/faq.js`
show that variant automatically to readers with Light theme active, no HTML changes needed.
See [screenshots/README.md](screenshots/README.md) for the full convention.

## License

MIT — see [LICENSE](LICENSE).
