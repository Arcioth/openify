# Openify - Project Context & Instructions

Openify is a modern, extensible, privacy-first music player that runs entirely in the browser. It reads audio files directly from local folders using the browser's File System Access API (or file picker fallback), meaning no servers or accounts are required.

## Project Overview

- **Core Technology:** Vanilla JavaScript (ES Modules), Vite, HTML5 Audio, and Web Audio API.
- **Architecture:** Zero-framework approach using direct DOM manipulation, a centralized state object, and a custom extension system.
- **Key Features:** Local file playback, ID3 metadata parsing, 25+ themes, synced lyrics (LRCLIB), audio visualizers, and a powerful plugin architecture.

## Architecture & Core Modules

- **Entry Point (`src/app.js`):** Initializes all core modules (Audio, UI, Extensions) and exposes global functions to the `window` object for extension access.
- **State Management (`src/state.js`):** A single mutable `state` object containing songs, playlists, queue, config, and current playback index.
- **Event Bus (`src/events.js`):** A simple pub/sub system for cross-module communication (e.g., `trackChange`, `playbackStateChange`, `libraryLoaded`).
- **Audio Engine (`src/audio.js`):** Wraps the HTML5 `<audio>` element and handles playback logic, including shuffle and loop modes.
- **Extension System (`src/extensions/`):**
    - **Manager (`manager.js`):** Handles lifecycle (discover, validate, topological sort, enable/disable).
    - **API (`api.js`):** Provides a permission-gated API object to each extension.
    - **Registries (`ui-registry.js`, `theme-registry.js`):** Manage UI injection points (sidebar, context menu, settings, player widgets) and dynamic theme registration.

## Building and Running

### Development
```bash
npm install    # Install Vite and other dev dependencies
npm run dev    # Start Vite dev server with custom extension middleware
```
The dev server includes middleware to serve extensions from the `extensions/` directory and a `yt-dlp` API for YouTube streaming (requires `yt-dlp` installed locally).

### Production
```bash
npm run build     # Build the project to the dist/ directory
npm run preview   # Preview the production build locally
```

## Development Conventions

- **Vanilla JS:** Avoid adding frameworks. All UI work should be direct DOM manipulation.
- **State & Events:** Always use `src/state.js` for data and `src/events.js` for notifications.
- **Extensions:**
    - Place new extensions in `extensions/<name>/`.
    - Every extension must have an `extension.json` manifest.
    - Add the directory name to the `bundledExtensions` array in `src/extensions/manager.js` to register it.
    - Use unique CSS prefixes (e.g., `myext-`) to avoid style collisions.
- **Vendored Dependencies:** Most libraries (FontAwesome, jsmediatags, fonts) are stored in `public/` and loaded locally to ensure offline capability.

## Project Structure

- `src/app.js`: Application entry point.
- `src/audio.js`: Audio engine logic.
- `src/state.js`: Global application state.
- `src/extensions/`: Core extension system logic.
- `src/ui/`: UI modules for player, views, themes, etc.
- `extensions/`: Bundled extensions (e.g., `lyrics`, `visualizer`, `better-ui`).
- `public/`: Vendored assets and libraries.
- `styles/main.css`: Global styles and built-in theme definitions.
