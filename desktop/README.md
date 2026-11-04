# Trivia Scorekeeper — desktop shell

A thin Electron window around the hosted app (`https://scorekeeper.triviarevolution.com/`). The web
app's own service worker handles offline use and web updates, so **web releases reach the desktop
app with no desktop release**. This shell only needs a new release when `desktop/` itself changes.

What the shell adds: installers for macOS (arm64 + Intel) and Windows, "Keep Screen Awake"
(View menu, on by default), remembered window size, an offline retry page, auto-update of the
shell, and file-backed saved data (below).

## Saved data bridge

`preload.js` exposes `window.TRDesktopStore` to the Scorekeeper origin only; `TRStore` in
`js/storage.js` uses it instead of `localStorage` when present. Data lives in
`<userData>/store.json` (previous copy kept as `store.json.bak`), so it does not depend on which
origin the shell is showing. This is groundwork for a bundled offline fallback ("option C"). In a
normal browser nothing changes.

The desktop app has its own data: games started in Chrome/Safari don't appear here. Move one with
Save to file in the browser, then import it in the desktop app.

## Develop

```
cd desktop && npm install
npm start                                            # loads the live site
DESKTOP_START_URL=http://localhost:8080/ npm start   # loads a local copy (unpackaged only)
```

## Release

1. Bump `version` in `desktop/package.json` (independent of the web app's `APP_VERSION`).
2. Commit, then `git tag desktop-vX.Y.Z && git push --tags`. The **Desktop build** workflow builds on
   macOS and Windows runners and publishes to a GitHub Release; installed apps pick it up within
   ~4 hours of launch (or via Help / app menu > Check for Updates).

The release repo must be **public** (auto-update reads it without a token). The feed location is
`publish:` in `electron-builder.yml`.

### Secrets to add (repo Settings > Secrets > Actions)

| Secret | What |
| --- | --- |
| `MAC_CSC_LINK` | base64 of your **Developer ID Application** certificate `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character team ID from the developer portal |

Mac auto-update requires the signed + notarized build. Windows builds are currently **unsigned**:
they install and update, but SmartScreen warns on first run. To sign, add Azure Trusted Signing
(`win.azureSignOptions` in `electron-builder.yml` plus its secrets) later.

Local unsigned test build: `npm run dist:mac` (set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing).
