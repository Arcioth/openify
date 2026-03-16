import { state } from './state.js';
import { initDB } from './db.js';
import { loadConfig } from './config.js';
import { loadFromFiles } from './library.js';
import { initAudio, getAudio } from './audio.js';
import { initPlayer, updateLoopUI, updateShuffleUI } from './ui/player.js';
import { initViews, switchView, setViewMode, toggleSort } from './ui/views.js';
import { initThemes, setTheme } from './ui/themes.js';
import { initSearch } from './ui/search.js';
import { initContextMenu } from './ui/context-menu.js';
import { initQueue } from './ui/queue.js';
import { initRecent, renderRecentlyPlayed } from './ui/recent.js';
import { initPlaylists, switchPlaylist } from './ui/playlists.js';
import { initSettings } from './ui/settings.js';
import { initShortcuts } from './shortcuts.js';
import { initExtensionManager, getExtensions, enableExtension, disableExtension } from './extensions/manager.js';
import { getAllThemes } from './extensions/theme-registry.js';

// Expose functions needed by HTML onclick attributes and extensions
window.switchView = switchView;
window.setViewMode = setViewMode;
window.toggleSort = toggleSort;
window.switchPlaylist = switchPlaylist;
window.getExtensions = getExtensions;
window.enableExtension = enableExtension;
window.disableExtension = disableExtension;
window.setTheme = setTheme;
window.getAllThemes = getAllThemes;

// Logo
const logos = ['/open1.svg', '/open2.svg', '/open3.svg'];
function setRandomLogo() {
    document.getElementById('main-logo').src = logos[Math.floor(Math.random() * logos.length)];
}
document.getElementById('logo-btn').onclick = setRandomLogo;
setRandomLogo();

// Init audio engine
initAudio();

// Init all UI modules
initPlayer();
initViews();
initThemes();
initSearch();
initContextMenu();
initQueue();
initRecent();
initPlaylists();
initSettings();
initShortcuts();

// Library loading — browser file picker only
const btnLoad = document.getElementById('btn-load-library');
const fFallback = document.getElementById('f-fallback');

btnLoad.onclick = () => fFallback.click();
fFallback.onchange = (e) => loadFromFiles(e.target.files);

// Init DB and load config
initDB().then(async () => {
    loadConfig();
    const audio = getAudio();
    setTheme(state.config.theme);
    setViewMode(state.config.viewMode);
    audio.volume = state.config.volume;
    document.getElementById('v-fill').style.width = (state.config.volume * 100) + '%';
    document.getElementById('v-thumb').style.left = (state.config.volume * 100) + '%';
    updateLoopUI();
    updateShuffleUI();
    renderRecentlyPlayed();

    // Init extension system after core app is ready
    await initExtensionManager();
});

// Storage persistence
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
