# Openify - Project Context & Instructions

Openify is a modern, extensible, privacy-first music player that runs as a lightweight desktop application. It reads audio files directly from local folders, requiring no servers or accounts.

## Project Overview

- **Core Technology:** Vanilla JavaScript (Frontend), **Tauri** (Rust Backend), HTML5 Audio, and Web Audio API.
- **Architecture:** Zero-framework approach using direct DOM manipulation, a centralized state object, and a custom extension system.
- **Native Experience:** Uses the system's native WebView for a zero-bloat experience (smaller footprint than Electron).
- **Key Features:** Local file playback, ID3 metadata parsing, 25+ themes, synced lyrics (LRCLIB), audio visualizers, and a powerful plugin architecture.

## Architecture & Core Modules

- **Entry Point (`src/app.js`):** Initializes all core modules (Audio, UI, Extensions).
- **Desktop Entry (`src-tauri/`):** Contains the Rust/Tauri wrapper that provides native windowing and system access.
- **State Management (`src/state.js`):** A single mutable `state` object containing songs, playlists, queue, config, and current playback index.
- **Event Bus (`src/events.js`):** A simple pub/sub system for cross-module communication (e.g., `trackChange`, `playbackStateChange`, `libraryLoaded`).
- **Audio Engine (`src/audio.js`):** Wraps the HTML5 `<audio>` element and handles playback logic.
- **Extension System (`src/extensions/`):**
    - **Manager (`manager.js`):** Handles lifecycle (discover, validate, topological sort, enable/disable).
    - **API (`api.js`):** Provides a permission-gated API object to each extension.
    - **Registries (`ui-registry.js`, `theme-registry.js`):** Manage UI injection points and dynamic theme registration.

## Building and Running

### Development (Desktop App)
```bash
npm install
npm run tauri dev
```
The `tauri dev` command automatically starts the Vite dev server and the Tauri window.

### Production Build
```bash
npm run tauri build
```
Binaries will be available in `src-tauri/target/release/`.

### Browser-only (Web Server)
```bash
npm run dev
```

## Development Conventions

- **Vanilla JS:** Avoid frameworks. UI should be direct DOM manipulation.
- **Rust Backend:** Use Tauri's IPC for any native system functionality if needed.
- **Extensions:**
    - Place in `extensions/<name>/` with an `extension.json` manifest.
    - Register in `bundledExtensions` array in `src/extensions/manager.js`.
- **Theming:** CSS variables on `[data-theme="name"]` selectors.
- **Vendored Dependencies:** Most libraries are in `public/` and loaded locally.

## Project Structure

- `src-tauri/`: Rust/Tauri desktop app configuration and source.
- `src/app.js`: Application entry point.
- `src/audio.js`: Audio engine logic.
- `src/state.js`: Global application state.
- `src/extensions/`: Core extension system logic.
- `src/ui/`: UI modules for player, views, themes, etc.
- `extensions/`: Bundled extensions (e.g., `lyrics`, `visualizer`, `yt-dlp`).
- `packaging/`: AUR `PKGBUILD`, Flatpak manifest, and `.desktop` entry.
- `public/`: Vendored assets and libraries.
- `styles/main.css`: Global styles and built-in theme definitions.

## Version Management (UPDATE ON EVERY RELEASE)

The version must be kept in sync across all of these files:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` under `[package]` |

Current version: **2.0.0**

When bumping a version:
1. Update all three files above to the same version string.
2. Ensure `packaging/PKGBUILD` `pkgver()` resolves correctly from git tags (tag format: `v2.0.0`).
3. If the Flatpak manifest pins a yt-dlp version, verify it's still current.
4. Back up the pre-release state to `~/Documents/musicplayer/old_versions/` before major changes.

## Release Checklist

Before publishing a release build:
- [ ] All version strings synced (see above).
- [ ] `src-tauri/tauri.conf.json` identifier is `com.arcioth.openify` (NOT `com.tauri.dev`).
- [ ] `LICENSE` file exists in repo root.
- [ ] `packaging/openify.desktop` has `Terminal=false`.
- [ ] Flatpak `sha256` is pinned (not `SKIP` or `FIXME`).
- [ ] `bin/yt-dlp` is NOT committed (listed in `.gitignore`).
- [ ] No `console.log()` debug statements in `src/`.
- [ ] Run `npm run tauri build` and verify the binary launches correctly.
