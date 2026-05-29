# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Vironia lauluraamat" — an Estonian-language songbook web app for the student corporation Korp! Vironia. It's a static single-page site that loads a song database from `songs.yaml`, lets users search, view lyrics, and optionally play audio recordings.

The UI language is Estonian (e.g. "Otsi laulu..." = search for a song, "Kustuta" = clear, "Otsi sõnades" = search within lyrics).

## Running locally

There is **no build system, package manager, or test suite** — it's plain HTML/CSS/JS with `js-yaml` pulled from a CDN at runtime.

Because `app.js` fetches `songs.yaml` with `fetch()`, the app **must be served over HTTP** — opening `index.html` via `file://` will fail with a CORS/fetch error. Serve the directory with any static server, e.g.:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Architecture

- **`index.html`** — the single page. Defines the search bar, song list (`#songs`), lyrics pane (`#lyrics-display`), dark/light toggle, and audio player. Loads `js-yaml` from CDN then `app.js`.
- **`app.js`** — all application logic (no framework, global `songs` array). On load it fetches `songs.yaml`, parses it, sorts by title with `localeCompare`, renders the list, and applies any URL params.
- **`styles.css`** — styling, including dark/light mode and responsive layout.
- **`songs.yaml`** — the entire song database (the "backend"). Editing this file is how content is added or changed.
- **`laulud.html`** — a standalone debug page that lists every song title parsed from `songs.yaml`.

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
