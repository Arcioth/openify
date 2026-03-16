<p align="center">
  <img src="public/open1.svg" alt="Openify Logo" width="80">
</p>

<h1 align="center">Openify</h1>

<p align="center">
  <strong>A modern, extensible music player that runs entirely in the browser.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-1db954?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-ISC-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/extensions-16-blueviolet?style=flat-square" alt="Extensions">
  <img src="https://img.shields.io/badge/themes-25+-orange?style=flat-square" alt="Themes">
  <img src="https://img.shields.io/badge/zero-dependencies-green?style=flat-square" alt="Zero Dependencies">
</p>

---

Openify is a privacy-first music player that reads audio files directly from your local folders. No accounts, no streaming, no servers — just your music and your browser. It ships with a powerful extension system, 25+ themes, synced lyrics, audio visualizers, and a fully customizable UI.

## Features

### Core Player
- **Local file playback** — load any folder of audio files from your computer
- **ID3 metadata** — automatic parsing of titles, albums, and embedded artwork
- **Queue management** — manual queue, play next, and playlist queue preview
- **Playback modes** — shuffle (per-playlist or all songs) and loop (off, playlist, single track)
- **Keyboard shortcuts** — Space (play/pause), Arrow keys (next/prev)
- **Search** — instant search across all loaded tracks
- **Multiple view modes** — compact, normal, and big track list layouts
- **Data portability** — export/import all preferences as JSON

### Themes
14 built-in themes with 11+ more from extensions:

| Built-in | Extension Themes |
|----------|-----------------|
| Openify, AMOLED, Light, Midnight, Purple Haze, Blood Red, Sunset Gold, Cyberpunk, Liquid Glass, Terminal, RGB, Pharoh, Turk, Clouds | Neon Pink, Neon Cyan, Sakura, Ocean Deep, Retrowave, Forest, Sunset Beach, Lavender Dream, Volcano, Arctic, Candy Pop |

### Extension System
A full-featured plugin architecture with:
- **Permission-based API** — extensions only access what they declare
- **Dependency management** — automatic resolution with topological sorting
- **Hot enable/disable** — toggle extensions without reloading
- **4 UI injection points** — sidebar tabs, context menu items, player bar widgets, settings panels
- **Dynamic theme registration** — extensions can add new themes at runtime
- **Per-extension storage** — isolated IndexedDB storage for each extension

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (required for the YouTube Music extension)

---

### Option 1: Automatic Setup (Recommended)
This method automatically downloads the correct `yt-dlp` binary for your OS and installs all project dependencies.

```bash
git clone https://github.com/Arcioth/openify.git
cd openify
npm run setup
npm run dev
```

### Option 2: Manual Setup
If you prefer to manage your own dependencies or already have `yt-dlp` installed system-wide:

1. **Clone & Install:**
   ```bash
   git clone https://github.com/Arcioth/openify.git
   cd openify
   npm install
   ```

2. **Install yt-dlp:**
   - **Linux:** `sudo apt install yt-dlp` (or use your distro's package manager)
   - **macOS:** `brew install yt-dlp`
   - **Windows:** `pip install yt-dlp` or download `yt-dlp.exe` from their [releases](https://github.com/yt-dlp/yt-dlp/releases) and add it to your PATH.

3. **Run:**
   ```bash
   npm run dev
   ```

### Arch Linux (AUR)
If you are on Arch Linux, you can install the git version directly (includes all dependencies):
```bash
git clone https://aur.archlinux.org/openify-git.git
cd openify-git
makepkg -si
```

---

Open `http://localhost:5173` in your browser, click **Load Folder**, and select a folder containing audio files.


### Build for Production

```bash
npm run build
npm run preview    # preview the build locally
```

The production build outputs to `dist/` with all extensions bundled.

## Bundled Extensions

Openify ships with 16 extensions that enhance every part of the player:

### UI Enhancements
| Extension | Description |
|-----------|-------------|
| **Better UI** | Global UI polish — smoother animations, refined spacing, enhanced cards |
| **Better Home** | Redesigned home view with hero banner, stats, and quick actions |
| **Better Topbar** | Enhanced header with breadcrumbs and track info |
| **Better Layouts** | Additional layout options and responsive grid improvements |
| **Better Library** | Enhanced sidebar library with artwork thumbnails, search/filter, sort, folder stats, and recently played tracking. *Requires Better UI* |
| **Better Extensions** | Enhanced extension manager with search, compact/normal/large view modes, and enable/disable all |
| **Better Themes** | Categorized theme picker with search and grouped lists (built-in vs. extension themes) |
| **Compact Menu** | Condensed sidebar navigation for smaller screens |
| **Better Folders** | Improved folder display with metadata-rich cards |

### Music Features
| Extension | Description |
|-----------|-------------|
| **Lyrics** | Fetches synced and plain lyrics from [LRCLIB](https://lrclib.net) with local caching |
| **Better Lyrics** | Enhanced lyrics view with synced highlighting, seek-on-click, timing offset/skip controls, and a mini lyric line in the player bar. *Requires Lyrics* |
| **Visualizer** | Audio visualizer with Bars, Wave, Circle, and Particles modes via Web Audio API |
| **Better Visualizer** | 5 additional visualizer modes (Snow, Flame, Runner, Boulder, Bicycle) plus a mini player-bar visualizer. *Requires Visualizer* |

### Theme Packs
| Extension | Description |
|-----------|-------------|
| **Neon Theme Pack** | Neon Pink and Neon Cyan themes |
| **Theme Festival** | 9 themes — Sakura, Ocean Deep, Retrowave, Forest, Sunset Beach, Lavender Dream, Volcano, Arctic, Candy Pop |

### Samples
| Extension | Description |
|-----------|-------------|
| **Sample Now Playing** | Example sidebar extension showing current track info |

## Creating Extensions

Copy the `extensions/_template/` folder and you're ready to go.

### 1. Define the manifest

```json
{
    "id": "your-name.extension-name",
    "name": "My Extension",
    "version": "1.0.0",
    "description": "What it does.",
    "author": "Your Name",
    "main": "index.js",
    "permissions": ["events:subscribe", "ui:sidebar"],
    "requires": []
}
```

### 2. Write the extension

```js
var api = null;

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'my-tab',
            label: 'My Tab',
            icon: 'fas fa-star',
            order: 70,
            onClick: function(el) {
                el.innerHTML = '<h2>Hello from my extension!</h2>';
            }
        });

        return module.exports;
    },

    disable() {
        // clean up DOM, intervals, etc.
    },

    destroy() {
        api = null;
    }
};
```

### 3. Register it

Add your folder name to the `bundledExtensions` array in `src/extensions/manager.js`.

### Available Permissions

| Permission | API Surface |
|-----------|-------------|
| `playback:read` | `api.playback.getCurrentTrack()`, `getState()` |
| `playback:control` | `api.playback.play()`, `pause()`, `next()`, `prev()`, `seek()`, `setVolume()` |
| `events:subscribe` | `api.events.on(event, fn)`, `off(event, fn)` |
| `events:emit` | `api.events.emit('ext:your-id:*', data)` |
| `library:read` | `api.library.getSongs()`, `getPlaylists()`, `getPlaylistSongs(name)` |
| `ui:sidebar` | `api.ui.registerSidebarItem(config)` |
| `ui:contextMenu` | `api.ui.registerContextMenuItem(config)` |
| `ui:settingsPanel` | `api.ui.registerSettingsPanel(config)` |
| `ui:playerWidget` | `api.ui.registerPlayerWidget(config)` |
| `themes:register` | `api.themes.registerTheme(config)` |
| `storage` | `api.storage.get(key)`, `set(key, val)`, `remove(key)`, `getAll()` |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `trackChange` | `(index, song)` | New track started playing |
| `playbackStateChange` | `(playing)` | Play/pause toggled |
| `timeUpdate` | `(percent, seconds)` | Playback position changed |
| `durationChange` | `(seconds)` | Track duration loaded |
| `volumeChange` | `(volume, muted)` | Volume or mute changed |
| `queueChange` | — | Queue was modified |
| `libraryLoaded` | — | User loaded a folder |
| `metadataUpdate` | `(index)` | Artwork/duration parsed for a song |
| `themeChange` | `(themeId)` | Theme switched |
| `extensionsReady` | — | All extensions finished loading |
| `extensionsChanged` | — | Extension enabled/disabled |

## Tech Stack

| | |
|---|---|
| **Runtime** | Vanilla JavaScript (ES Modules) — zero frameworks |
| **Build** | [Vite](https://vite.dev/) |
| **Audio** | HTML5 `<audio>` + Web Audio API (visualizers) |
| **Storage** | IndexedDB + localStorage |
| **Metadata** | [jsmediatags](https://github.com/aadsm/jsmediatags) (vendored) |
| **Icons** | [Font Awesome 6.4.0](https://fontawesome.com/) (vendored) |
| **Fonts** | [Inter](https://rsms.me/inter/), [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (vendored) |
| **Lyrics API** | [LRCLIB](https://lrclib.net) (only external runtime dependency) |

All dependencies are vendored locally. The app works fully offline after the initial load — the only network call is the optional lyrics search.

## Project Structure

```
openify/
├── src/
│   ├── app.js              # Entry point — initializes all modules
│   ├── audio.js             # Audio engine (play, pause, next, prev, shuffle, loop)
│   ├── state.js             # Centralized app state + built-in theme definitions
│   ├── events.js            # Pub/sub event bus
│   ├── config.js            # localStorage persistence
│   ├── db.js                # IndexedDB setup
│   ├── library.js           # Folder loading + ID3 metadata scanning
│   ├── shortcuts.js         # Keyboard shortcuts
│   ├── ui/                  # UI modules (player, views, themes, search, queue, etc.)
│   └── extensions/          # Extension system core
│       ├── manager.js       # Lifecycle, dependency resolution, enable/disable
│       ├── api.js           # Permission-gated API factory
│       ├── ui-registry.js   # Sidebar, context menu, settings, player widget registration
│       ├── theme-registry.js# Dynamic theme injection
│       ├── loader.js        # Module loading (blob URL import + Function fallback)
│       ├── manifest.js      # Manifest validation
│       └── storage.js       # Per-extension IndexedDB storage
├── extensions/              # All bundled extensions (+ _template for development)
├── styles/main.css          # Global styles + all built-in theme CSS variables
├── public/                  # Vendored libraries (FontAwesome, jsmediatags, fonts)
├── index.html               # Single-page HTML shell
└── vite.config.js           # Vite config with extension serving/copying plugins
```

## License

[ISC](LICENSE)

---

<p align="center">Made by <a href="https://github.com/Arcioth">Arcioth</a></p>
