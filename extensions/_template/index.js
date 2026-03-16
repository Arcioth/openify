// ============================================================
//  Openify Extension Template
// ============================================================
//
//  HOW TO CREATE AN EXTENSION:
//
//  1. Copy this _template folder and rename it (e.g. "my-cool-ext")
//  2. Edit extension.json — set your id, name, description, permissions
//  3. Write your code in this file
//  4. Register your folder name in src/extensions/manager.js
//     → add 'my-cool-ext' to the bundledExtensions array
//  5. Run `npm run dev` and your extension will load automatically
//
// ============================================================
//
//  LIFECYCLE:
//    init(api)    → called once when the extension first loads
//    disable()    → called when the user toggles the extension off
//    destroy()    → called when the extension is fully unloaded
//
//  The api object gives you access to everything (based on permissions).
//  Always store it so your other functions can use it.
//
// ============================================================
//
//  DEPENDENCIES:
//
//  Add "requires" to extension.json to depend on other extensions:
//    "requires": ["openify.better-ui", "openify.theme-festival"]
//
//  - Dependencies are auto-enabled when your extension is enabled
//  - If a dependency fails, your extension won't load (error shown in UI)
//  - When a dependency is disabled, your extension is disabled too (cascade)
//  - Circular dependencies are detected and blocked
//  - The settings UI shows "Requires:" and "Used by:" tags on each card
//
// ============================================================
//
//  AVAILABLE PERMISSIONS:
//
//  "playback:read"      → api.playback.getCurrentTrack(), getState()
//  "playback:control"   → api.playback.play(idx), pause(), next(), prev(), seek(), setVolume()
//  "events:subscribe"   → api.events.on(event, fn), off(event, fn)
//  "events:emit"        → api.events.emit('ext:your-id:eventName', data)
//  "library:read"       → api.library.getSongs(), getPlaylists(), getPlaylistSongs(name)
//  "ui:sidebar"         → api.ui.registerSidebarItem({ id, label, icon, order, onClick, replaces })
//  "ui:contextMenu"     → api.ui.registerContextMenuItem({ id, label, icon, onClick })
//  "ui:settingsPanel"   → api.ui.registerSettingsPanel({ id, label, render(el) })
//  "ui:playerWidget"    → api.ui.registerPlayerWidget({ id, render(el) })
//  "themes:register"    → api.themes.registerTheme({ id, label, color, cssVariables })
//  "storage"            → api.storage.get(key), set(key, val), remove(key), getAll()
//
// ============================================================
//
//  EVENTS YOU CAN LISTEN TO:
//
//  "trackChange"          → (index, song)  — a new track started playing
//  "playbackStateChange"  → (playing)      — play/pause toggled
//  "timeUpdate"           → (percent, sec) — playback position changed
//  "durationChange"       → (seconds)      — track duration loaded
//  "volumeChange"         → (volume, muted)
//  "queueChange"          → queue was modified
//  "libraryLoaded"        → user loaded a folder of music
//  "metadataUpdate"       → (index)        — artwork/duration loaded for a song
//  "themeChange"          → (themeId)      — user switched theme
//  "extensionsReady"      → all extensions finished loading
//  "extensionsChanged"    → an extension was enabled/disabled
//
// ============================================================
//
//  SONG OBJECT SHAPE (from getCurrentTrack / getSongs):
//  {
//      title:    "Song Name",
//      filename: "song.mp3",
//      folder:   "Album Folder",
//      duration: "3:42",
//      durSec:   222,
//      artwork:  "data:image/jpeg;base64,..." or null,
//      id:       1
//  }
//
// ============================================================
//
//  TIPS:
//  - You can access the DOM directly (document.getElementById etc.)
//  - Use api.storage for persistent data — it survives page reloads
//  - Clean up everything in disable/destroy (remove DOM elements, intervals, etc.)
//  - Use module.exports to export your lifecycle methods
//  - For CSS, create a <style> element and append to document.head
//  - Use "replaces" in registerSidebarItem to replace another extension's tab:
//    api.ui.registerSidebarItem({ id:'my-tab', replaces:'other-tab', ... })
//    When your extension is disabled, the original tab is automatically restored
//
// ============================================================

var api = null;

module.exports = {
    init(_api) {
        api = _api;

        // --- Your init code here ---
        // Example: listen for track changes
        // api.events.on('trackChange', onTrackChange);

        // Example: register a sidebar tab
        // api.ui.registerSidebarItem({
        //     id: 'my-tab',
        //     label: 'My Tab',
        //     icon: 'fas fa-star',
        //     order: 70,
        //     onClick: function(el) {
        //         el.innerHTML = '<h2>Hello from my extension!</h2>';
        //     }
        // });

        // Example: register a theme
        // api.themes.registerTheme({
        //     id: 'my-theme',
        //     label: 'My Theme',
        //     color: '#ff6600',
        //     cssVariables: {
        //         '--bg-base': '#1a0f00',
        //         '--bg-sidebar': '#1a0f00',
        //         '--bg-main': '#241500',
        //         '--bg-card': '#2e1c00',
        //         '--bg-card-hover': '#3a2400',
        //         '--text-main': '#ffe0b3',
        //         '--text-sub': '#b38050',
        //         '--accent': '#ff6600',
        //         '--accent-hover': '#ff8833',
        //     }
        // });

        return module.exports;
    },

    disable: function() {
        // Called when user toggles extension OFF
        // Clean up DOM changes, but keep state for re-enable
    },

    destroy: function() {
        // Called when extension is fully unloaded
        // Clean up everything
        api = null;
    }
};
