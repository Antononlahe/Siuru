# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Vironia lauluraamat" — an Estonian-language songbook web app for the student corporation Korp! Vironia. It's a static single-page site that loads a song database from `songs.yaml`, lets users search, view lyrics, and optionally play audio recordings.

The UI language is Estonian (e.g. "Otsi laulu..." = search for a song, "Kustuta" = clear, "Otsi sõnades" = search within lyrics).

## Running locally

For **local development** there is no build step — it's plain HTML/CSS/JS. Serve the directory with any static server (the app uses `fetch()`, so `file://` won't work):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

In dev, `app.js` loads the song data straight from `songs.yaml`, lazily pulling `js-yaml` from a CDN only for that fallback path.

**Production** is built and served by a Dockerfile (lives outside this repo, alongside it): a `node:alpine` stage minifies the HTML/CSS/JS and converts `songs.yaml` → `songs.json`, then an `nginx:alpine` stage serves the result with gzip. So in production `app.js` fetches the pre-built `songs.json` (native `JSON.parse`, no CDN). The YAML→JSON conversion is the build's job — **do not commit `songs.json`**; keep editing `songs.yaml`.

## Architecture

- **`index.html`** — the single page. Defines the search bar, song list (`#songs`), lyrics pane (`#lyrics-display`), dark/light toggle, lyrics font-size controls, and audio player.
- **`app.js`** — all application logic (no framework, global `songs` array). On load `fetchSongs()` tries `songs.json` (production) and falls back to `songs.yaml` (dev); it then sorts by title with `localeCompare`, renders the list, and applies any URL params. Also registers the service worker.
- **`styles.css`** — styling, including dark/light mode and responsive layout.
- **`songs.yaml`** — the entire song database (the "backend") and the source of truth. Editing this file is how content is added or changed.
- **`sw.js` / `manifest.json`** — PWA layer: installable app, offline support via a stale-while-revalidate service worker that precaches the app shell and `songs.json`. Bump `CACHE_VERSION` in `sw.js` when shell assets change. The app icon is referenced as a cross-origin PNG on `media.voog.com` (not a repo file), so it's cached at runtime rather than precached. Note service workers only run over HTTPS or `localhost` (not `file://`).
- **`laulud.html`** — a standalone debug page that lists every song title by string-parsing `songs.yaml`.

### Search internals

Search is accent-insensitive: `fold()` lowercases and maps Estonian diacritics (`õäöüšž`) to their base letters via a **length-preserving** char map, so "ohtu" matches "õhtu". Because the fold is 1:1, the same folded indices are reused by `highlightTitle()` to `<mark>` the match in the original accented title.

### Song schema (`songs.yaml`)

Each entry is a YAML list item:

```yaml
- title: Song title
  artist:              # string OR list of strings (both handled in code)
    - Author / Composer
  path: "https://...opus"   # optional; audio URL. Presence adds a 🎵 to the title
  lyrics: |            # multiline block scalar, rendered verbatim in a <pre>
    Line one
    Line two
```

`artist` may be a single string or an array — `app.js` normalizes both via `Array.isArray(...) ? song.artist : [song.artist]` everywhere it reads artists. Audio `path` is optional; the play button and 🎵 marker only appear when it's set.

### Behavior notes

- **Search** (`performSearch`): matches title + artist by default. Prefix the query with `a:` to search by artist only (clicking an artist name triggers this). The "Otsi sõnades" toggle additionally searches lyrics text.
- **Responsive split-view**: below 768px the app switches between a list view and a full-screen lyrics view with a back button and View Transitions API animation; at ≥768px both panes show side by side. Resize handling lives in the `resize` listener at the bottom of `app.js`.
- **URL state**: the current song (`?song=`) and search term (`?search=`) are pushed to the URL via `history.pushState`, and restored on load / `popstate` by `handleUrlParams`. Deep links to a specific song work this way.
- **Dark/light mode**: toggled via the `light-mode` body class and persisted in `localStorage` under the `mode` key.
