# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev       # Start Vite dev server (serves extensions via custom middleware)
npm run build     # Production build (copies extensions/ into dist/extensions/)
npm run preview   # Preview production build
```

No test runner or linter is configured.

## Architecture

Openify is a browser-based music player built with vanilla JS (ES modules), Vite, and a custom extension system. No framework — all DOM manipulation is direct.

### Core App Flow

`index.html` → `src/app.js` (entry point) → initializes all modules in sequence:
1. Audio engine (`src/audio.js`) — wraps `<audio>` element
2. UI modules (`src/ui/*.js`) — player controls, views, themes, search, queue, playlists, settings
3. IndexedDB (`src/db.js`) + localStorage config (`src/config.js`)
4. Extension manager (`src/extensions/manager.js`) — discovers, loads, enables bundled extensions

### State & Events

- **`src/state.js`**: Single mutable state object (`state`) holding songs, playlists, queue, config, current index. Imported directly by modules that need it.
- **`src/events.js`**: Simple pub/sub EventBus. Core events: `trackChange`, `playbackStateChange`, `timeUpdate`, `libraryLoaded`, `metadataUpdate`, `queueChange`, `extensionsReady`, `extensionsChanged`, `themeChange`.

### Extension System (`src/extensions/`)

Extensions live in `extensions/<name>/` with an `extension.json` manifest and a `main` JS file (CommonJS-style `module.exports`).

**Lifecycle**: discover → validate manifest → topological sort by `requires` → enable (create API, load module via blob URL import or Function fallback, call `init(api)`) → disable (call `disable()`, clean up events/UI/themes) → optionally `destroy()`.

**Key files**:
- `manager.js` — orchestrates lifecycle, dependency resolution, enable/disable with cascade
- `api.js` — creates permission-gated API object per extension (`createExtensionAPI`)
- `ui-registry.js` — 4 registration types: sidebar items, context menu items, settings panels, player widgets
- `loader.js` — two loading strategies: blob URL dynamic import, Function constructor fallback
- `manifest.js` — validates required fields (`id`, `name`, `version`, `main`) and permissions
- `storage.js` — per-extension IndexedDB storage namespaced by extension ID
- `theme-registry.js` — dynamic CSS variable injection via `<style>` tags

**Extension module interface**:
```js
module.exports = {
    init(api) { },      // Called on first enable. Return value becomes the instance.
    enable(api) { },    // Optional: called on re-enable (skips re-fetching module)
    disable() { },      // Optional: cleanup
    destroy() { }       // Optional: full teardown
};
```

**Re-enable behavior**: Extensions WITHOUT `enable()` get full re-init (re-fetch, re-eval, call `init`). Extensions WITH `enable()` must re-register event listeners manually since the manager cleans up all event subscriptions on disable.

**Sidebar `replaces` system**: `registerSidebarItem({ replaces: 'other-id' })` hides the target item and restores it when the replacer unregisters. Used by better-lyrics (replaces lyrics) and better-visualizer (replaces visualizer).

### Bundled Extensions

Registered in `manager.js` `bundledExtensions` array. Currently 15 extensions. When adding a new extension:
1. Create `extensions/<name>/extension.json` and `extensions/<name>/index.js`
2. Add the directory name to the `bundledExtensions` array in `src/extensions/manager.js`

**Dependency graph** (extension → requires):
- `better-library` → `openify.better-ui`
- `better-lyrics` → `openify.lyrics`
- `better-visualizer` → `openify.visualizer`

### Globals Exposed on `window`

`src/app.js` exposes: `switchView`, `setViewMode`, `toggleSort`, `switchPlaylist`, `getExtensions`, `enableExtension`, `disableExtension`. Extensions use these for cross-cutting operations.

### Persistence

- **localStorage** (`openify_user_data`): volume, theme, viewMode, loopMode, shuffleMode, recently played, manual queue
- **localStorage** (`openify_extensions`): per-extension enabled/disabled state
- **IndexedDB** (`OpenifyDB`): cached ID3 metadata
- **IndexedDB** (`OpenifyExtensionsDB`): per-extension key-value storage

### Theming

CSS variables on `[data-theme="name"]` selectors. 14 built-in themes defined in `styles/main.css`. Extensions register themes dynamically via `theme-registry.js` which injects `<style data-ext-theme="id">` tags.

### Vendored Dependencies

All external libraries are local in `public/`: FontAwesome 6.4.0, jsmediatags (ID3 parser), Inter font, JetBrains Mono font. The only runtime external call is `https://lrclib.net/api/search` (lyrics extension).

## Extension Development Conventions

- Extension IDs use `openify.` prefix (e.g., `openify.better-library`)
- CSS class names should use a unique prefix per extension to avoid conflicts (e.g., `blib-` for better-library, `bext-` for better-extensions)
- Extensions that enhance existing ones should use `requires` in manifest and `replaces` in sidebar registration
- Template at `extensions/_template/` shows the extension structure and available API
