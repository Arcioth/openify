<p align="center">
  <img src="public/open1.svg" alt="Openify Logo" width="80">
</p>

<h1 align="center">Openify</h1>

<p align="center">
  <strong>A modern, extensible, privacy-first music player.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-1db954?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-ISC-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/extensions-17-blueviolet?style=flat-square" alt="Extensions">
  <img src="https://img.shields.io/badge/themes-25+-orange?style=flat-square" alt="Themes">
  <img src="https://img.shields.io/badge/zero-dependencies-green?style=flat-square" alt="Zero Dependencies">
</p>

---

Openify is a privacy-first music player that reads audio files directly from your local folders. No accounts, no streaming, no servers — just your music. It is built as a lightweight desktop application using **Tauri**, which leverages your system's native WebView for a zero-bloat experience.

## Features

### Core Player
- **Local file playback** — load any folder of audio files from your computer.
- **ID3 metadata** — automatic parsing of titles, albums, and embedded artwork.
- **Queue management** — manual queue, play next, and playlist queue preview.
- **Playback modes** — shuffle (per-playlist or all songs) and loop (off, playlist, single track).
- **Keyboard shortcuts** — Space (play/pause), Arrow keys (next/prev).
- **Search** — instant search across all loaded tracks.
- **Multiple view modes** — compact, normal, and big track list layouts.
- **Data portability** — export/import all preferences as JSON.

### Extension System
- **Permission-based API** — extensions only access what they declare.
- **Dynamic Themes** — register and switch between 25+ built-in and extension themes.
- **UI Injection** — sidebar tabs, context menu items, player bar widgets, and settings panels.
- **YouTube Integration** — search and stream audio using a proxied yt-dlp backend.
- **Audio Visualizers** — multiple modes including Bars, Wave, Circle, and Particles.
- **Synced Lyrics** — automatic fetching from LRCLIB with local caching.

---

## Dependencies & Requirements

### Runtime Dependencies
- **WebView2** (Windows) / **WebKit2GTK 4.1** (Linux): Required for the desktop app.
- **GStreamer plugins** (Linux): `gst-plugins-good` and `gst-plugins-bad` — required for audio playback in the WebView. Without these, **no audio will play**.
- **yt-dlp** (optional): Required for YouTube Music streaming features.

### Build Dependencies (Developers)
- **Node.js** (v18+)
- **Rust** (v1.77+)
- **Linux only**: `webkit2gtk-4.1`, `gtk3`, `pkg-config`, `base-devel`.

---

## Installation & Setup

### Arch Linux (AUR)
Install the git version directly (includes all dependencies):
```bash
git clone https://aur.archlinux.org/openify-git.git
cd openify-git
makepkg -si
```

### Flatpak
Build and install the Flatpak bundle:
```bash
flatpak-builder --user --install --force-clean build packaging/flatpak/com.arcioth.openify.yaml
```

### Windows & macOS (Standard)
1. Install [Node.js](https://nodejs.org/) and [Rust](https://rustup.rs/).
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Arcioth/openify.git
   cd openify
   npm install
   ```
3. Run the desktop app in development mode:
   ```bash
   npm run tauri dev
   ```

---

## Usage Guide

### How to run the Tauri version
To run Openify as a native desktop app on your device:
1. Ensure you have the **Build Dependencies** installed (Rust & Node.js).
2. Run `npm install` to set up the project.
3. Use `npm run tauri dev` to launch the application.
4. To create a permanent installation, run `npm run tauri build`. The executable will be in `src-tauri/target/release/`.

### How to run the Flatpak version
1. Install `flatpak` and `flatpak-builder` on your Linux system.
2. Run the build command:
   ```bash
   flatpak-builder --user --install --force-clean build packaging/flatpak/com.arcioth.openify.yaml
   ```
3. Once installed, launch it via your application menu or run:
   ```bash
   flatpak run com.arcioth.openify
   ```

### How to run the Browser version
If you don't want to use the desktop app, you can run it as a local web server:
1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://localhost:5173` in your browser.

---

## License
[ISC](LICENSE)

<p align="center">Made by <a href="https://github.com/Arcioth">Arcioth</a></p>
