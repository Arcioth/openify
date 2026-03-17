# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install          # Install Node and Tauri dependencies
npm run tauri dev    # Start desktop app (Vite dev server + Tauri window)
npm run tauri build  # Build production binaries (.deb, .rpm)
npm run dev          # Standalone Vite server (browser-only, no Tauri)
```

No test runner or linter is configured.

## Architecture

Openify is a **Tauri v2** desktop music player: **Rust** backend (native windowing, system commands) + **Vanilla JS** frontend (zero frameworks, direct DOM).

### Core Flow

`index.html` → `src/app.js` → initializes:
1. Audio engine (`src/audio.js`) — wraps `<audio>` element
2. UI modules (`src/ui/*.js`) — player, views, themes, search, queue, playlists, settings
3. IndexedDB (`src/db.js`) + localStorage config (`src/config.js`)
4. Extension manager (`src/extensions/manager.js`)

### Dual Mode: Tauri vs Browser

The app detects `window.__TAURI__` (`withGlobalTauri: true` in config) and switches behavior:
- **Folder loading**: Tauri uses native dialog + `scan_music_dir` Rust command + asset protocol. Browser uses `<input webkitdirectory>`.
- **yt-dlp**: Tauri uses `ytdlp_search`/`ytdlp_stream` Rust commands + direct URLs. Browser uses Vite middleware proxy.
- **Audio playback**: Tauri uses asset protocol URLs (`convertFileSrc`). Browser uses `URL.createObjectURL`.
- **Metadata**: Browser mode uses `jsmediatags` for ID3 tags. Tauri mode gets duration from Audio element only (jsmediatags can't XHR asset:// URLs).

### Rust Backend (`src-tauri/src/lib.rs`)

Three Tauri commands:
- `scan_music_dir(dir)` — recursively finds audio files, returns `{path, filename, folder}[]`
- `ytdlp_search(query)` — runs `yt-dlp ytsearch10:<query>`, returns raw stdout
- `ytdlp_stream(video_id)` — runs `yt-dlp -f bestaudio -j`, returns stream JSON

Plugins: `tauri-plugin-dialog` (native file picker), `tauri-plugin-log` (debug only).

### Audio Playback on Linux

WebKitGTK uses GStreamer for media decoding. Required system packages: `gst-plugins-good`, `gst-plugins-bad`. Without these, **no audio will play** in Tauri even though the same page works in a browser.

### Extension System (`src/extensions/`)

- **Lifecycle**: discover → validate manifest → topological sort → enable (`init(api)`) → disable
- **Default state**: All disabled on fresh install (config version gated in `manager.js`)
- **Key files**: `manager.js` (orchestrator), `api.js` (permission-gated API factory), `ui-registry.js` (UI injection), `loader.js` (dynamic module loading)
- Extensions live in `extensions/<name>/` with `extension.json` manifest
- 17 bundled extensions registered in `bundledExtensions` array in `manager.js`

### State & Events

- `src/state.js` — single mutable `state` object, directly imported
- `src/events.js` — pub/sub EventBus (`trackChange`, `libraryLoaded`, `metadataUpdate`, etc.)

### Theming

`styles/main.css` defines 25+ built-in themes via CSS variables on `[data-theme]`. Extensions register additional themes via `theme-registry.js`.

## Development Conventions

- Vanilla JS only. No frameworks. Direct DOM manipulation.
- Extension IDs use `openify.` prefix. CSS classes use unique prefixes (e.g., `ytdlp-`).
- Dependencies (FontAwesome, jsmediatags, fonts) vendored in `public/`.
- Wayland fix in `main.rs`: sets `WEBKIT_DISABLE_COMPOSITING_MODE=1`.

## Version Management (UPDATE ON EVERY RELEASE)

Sync version across all three files:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` under `[package]` |

Also bump `CONFIG_VERSION` in `src/extensions/manager.js` to reset extension state on upgrade.

Current version: **2.0.0**

## Release Checklist

- [ ] All version strings synced (see above)
- [ ] `tauri.conf.json` identifier is `com.arcioth.openify`
- [ ] `LICENSE` file exists
- [ ] `packaging/openify.desktop` has `Terminal=false`
- [ ] Flatpak `sha256` is pinned (not `SKIP` or `FIXME`)
- [ ] `bin/yt-dlp` NOT committed (in `.gitignore`)
- [ ] No `console.log()` debug statements in `src/`
- [ ] `npm run tauri build` succeeds and binary plays audio
- [ ] Back up pre-release state to `~/Documents/musicplayer/old_versions/`

## Packaging

- **AUR**: `packaging/PKGBUILD` → published as `openify-git`
- **Flatpak**: `packaging/flatpak/com.arcioth.openify.yaml`
- **Desktop entry**: `packaging/openify.desktop`
- AUR repo: `ssh://aur@aur.archlinux.org/openify-git.git` (local clone at `~/openify-git/`)
- GitHub: `https://github.com/Arcioth/openify` branch `v2.0`
