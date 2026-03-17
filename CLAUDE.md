# CLAUDE.md

This file provides guidance for development in this repository.

## Build & Dev Commands

```bash
npm install        # Install Node and Tauri dependencies
npm run tauri dev  # Start desktop app (re-optimized with Wayland fix)
npm run tauri build # Build production binaries
npm run dev        # Optional: Start standalone Vite server (browser-only)
```

No test runner or linter is configured.

## Architecture

Openify is a **Tauri-powered** desktop music player. It uses a **Rust** backend for native windowing and a **Vanilla JS** frontend for the UI. It features a custom plugin/extension architecture.

### Core App Flow

`index.html` → `src/app.js` (entry point) → initializes modules:
1. Audio engine (`src/audio.js`) — wraps `<audio>` element.
2. UI modules (`src/ui/*.js`) — player, views, themes, search, queue, playlists, settings.
3. IndexedDB (`src/db.js`) + localStorage config (`src/config.js`).
4. Extension manager (`src/extensions/manager.js`) — discovers, loads, and enables extensions.

### Desktop Wrapper (`src-tauri/`)

Tauri handles the native window and provides system APIs.
- **Wayland Fix**: `src-tauri/src/main.rs` sets `WEBKIT_DISABLE_COMPOSITING_MODE=1` to prevent crashes on some Linux/Wayland environments (including Arch).

### State & Events

- **`src/state.js`**: Central `state` object. Directly imported by modules.
- **`src/events.js`**: Pub/sub EventBus for cross-module communication.

### Extension System (`src/extensions/`)

Extensions are modular and use a permission-gated API.
- **Lifecycle**: discover → validate manifest → topological sort → enable (`init(api)`) → disable.
- **Key files**: `manager.js` (orchestrator), `api.js` (factory), `ui-registry.js` (UI injection points), `loader.js` (dynamic module loading).

### yt-dlp Extension & Backend

YouTube music streaming.
- **Backend Proxy**: `vite.config.js` includes a proxy and yt-dlp integration.
- **yt-dlp**: Required on the system or in the local `bin/` directory.

### Persistence

- **localStorage**: User preferences (volume, theme, etc.) and extension statuses.
- **IndexedDB**: Song metadata caching and per-extension storage.

### Theming

Managed through `styles/main.css` and dynamic injection via `theme-registry.js`. 25+ themes available.

## Development Conventions

- Avoid frameworks; use direct DOM manipulation in vanilla JS.
- Extension IDs use `openify.` prefix.
- All dependencies (FontAwesome, jsmediatags, fonts) are vendored in `public/`.
- Use unique CSS prefixes for extensions to avoid style collisions.

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
2. Ensure `packaging/PKGBUILD` `pkgver()` will resolve correctly from git tags (tag format: `v2.0.0`).
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
