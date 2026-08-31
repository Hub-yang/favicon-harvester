<h1 align="center">Favicon Harvester</h1>

<p align="center">Pull every icon a site is actually using.</p>

<p align="center">
  <a href="https://github.com/Hub-yang/favicon-harvester/releases"><img src="https://img.shields.io/github/v/release/Hub-yang/favicon-harvester?style=flat-square&color=1f6feb" alt="Release"></a>
  <a href="https://github.com/Hub-yang/favicon-harvester/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/Hub-yang/favicon-harvester/release.yml?style=flat-square" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Hub-yang/favicon-harvester?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/manifest-v3-brightgreen?style=flat-square" alt="Manifest V3">
</p>

<p align="center"><a href="./README.md">简体中文</a> | English</p>

<!-- Screenshot pending: capture the panel on an icon-rich site like github.com, save it to docs/screenshot.png, then enable the line below
<p align="center"><img src="./docs/screenshot.png" width="320" alt="Panel screenshot"></p>
-->

## Why this exists

Grabbing a site's icons usually goes like this: open DevTools, dig through `<head>` for `<link rel="icon">`, guess at `/favicon.ico` when that turns up nothing, then chase the `<link rel="manifest">` and pick URLs out of the JSON by hand if you want the larger sizes.

And even then some of those URLs are stale. The request succeeds; the image is broken.

This extension collapses all of that into one click.

## What it does

- **Four sources, probed in parallel.** `<link>` tags in the page, the Web App Manifest, well-known paths like `/favicon.ico`, and the `tab.favIconUrl` the browser already has.
- **Only live icons make the list.** Every candidate is fetched in the background to confirm it resolves, then rendered as an actual `<img>` in the panel. Both checks have to pass. The "request succeeded but the image is broken" case gets filtered out.
- **You get all of them.** Deduplicated candidates are listed in full, sorted largest first with SVG on top. Which one suits you is your call — the extension doesn't guess.
- **Downloads are byte-for-byte.** No transcoding, no resizing, no compression. Filenames follow `domain-source-size.ext`, and one click can grab everything at once.
- **It touches one tab, and only when asked.** The manifest declares `activeTab`, `scripting` and `downloads` — no `host_permissions`. Until you click the toolbar icon, no code runs.
- **No third parties.** Every icon URL comes from the site itself, never from a fallback service like Google S2. Which sites you inspect stays between you and your browser.

## Install

### From a release

1. Grab the latest `favicon-harvester-x.y.z-chrome.zip` from [Releases](https://github.com/Hub-yang/favicon-harvester/releases) and unzip it.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click "Load unpacked" and pick the unzipped folder.

### From source

```bash
pnpm install
pnpm build      # output lands in .output/chrome-mv3
```

Then load `.output/chrome-mv3` via steps 2 and 3 above. For development, `pnpm dev` launches a Chrome instance with the extension installed and hot-reloads on save.

## Usage

Open any page → click the toolbar icon → download icons one at a time or all at once, or just copy an icon's URL.

## How the discovery works

Clicking the icon kicks off four collectors at once:

| Source | What it reads |
| --- | --- |
| `link` | Injects a read-only script into the page and collects `href` and `sizes` from every `<link rel="icon">`, `apple-touch-icon`, and friends |
| `manifest` | Follows `<link rel="manifest">`, fetches the Web App Manifest, parses its `icons[]` |
| `well-known` | Tries the conventional paths directly: `/favicon.ico`, `/apple-touch-icon.png` |
| `tab` | Falls back to `tab.favIconUrl` when the first three come up empty |

Results are deduplicated by absolute URL — when the same URL shows up twice, the higher-priority source wins (link > manifest > well-known > tab). Each survivor is then fetched to confirm it resolves, with the real format read off the response headers or sniffed from the file's magic bytes, and dimensions parsed out. SVG sizes come from a regex over the root tag rather than `DOMParser`, because that code path ends up running in a service worker where there is no `document`.

That still isn't enough. A successful background fetch doesn't mean the popup's `<img>` can render it — different request context, and `<img>` sends a Referer that may trip the site's hotlink protection. So candidates get one more real render check inside the panel, and anything that breaks is dropped on the spot.

## Known limits

- Restricted pages (`chrome://`, the Chrome Web Store) can't be scanned. The panel says so instead of spinning forever.
- Only icons the site declares itself. If a site has no `<link>`, no manifest, and no `/favicon.ico`, there's nothing to find — this extension won't invent one from a third-party service.
- No format conversion. If you want a PNG of an SVG icon, that's on you.

## Development

Built with [WXT](https://wxt.dev), Vue 3 `<script setup>`, TypeScript, UnoCSS and Vitest.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev mode (Chrome) with hot reload |
| `pnpm dev:firefox` | Dev mode (Firefox) |
| `pnpm build` | Production build into `.output/chrome-mv3` |
| `pnpm zip` | Package a distributable zip |
| `pnpm compile` | Type check via `vue-tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm test` / `pnpm test:coverage` | Unit tests, with or without coverage |
| `pnpm release` | Bump the version, tag it, push — CI takes it from there |

Layout:

```
entrypoints/
  background/       MV3 service worker; orchestrates scanning and downloads
  scan-dom-icons/   read-only DOM scanner injected into the page
  popup/            panel UI (components + composables)
utils/
  candidate-sources/  one collector per source
  *.ts                dedupe, probe, sizing, MIME sniffing, naming, sorting, downloads
```

Every module has a sibling `*.test.ts` — 154 cases in total. Tests run under `happy-dom` with `browser.*` faked in memory by `WxtVitest()` from `wxt/testing`, so no real browser is needed.

The full Chrome Web Store submission process lives in [PUBLISHING.md](./PUBLISHING.md) (written in Chinese).

## License

[MIT](./LICENSE) © Hubery Yang
