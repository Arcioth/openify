var api = null;
var dashEl = null;
var history = [];
var MAX_HISTORY = 20;
var quickPicks = [];
var QUICK_PICK_COUNT = 8;
var isHome = true;
var bannerObserver = null;

module.exports = {
    init(_api) {
        api = _api;

        api.events.on('trackChange', onTrackChange);
        api.events.on('libraryLoaded', onLibraryLoaded);
        api.events.on('metadataUpdate', debounceRender);

        loadHistory();
        injectDashboard();
        return module.exports;
    },

    disable: function() {
        removeDashboard();
        quickPicks = [];
    },

    destroy: function() {
        removeDashboard();
        api = null;
        history = [];
        quickPicks = [];
    }
};

// --- Inject / remove dashboard into existing home view ---

function injectDashboard() {
    var homeView = document.getElementById('view-home');
    if (!homeView) return;

    // Create dashboard container (starts visible — default is Home/All Songs)
    dashEl = document.createElement('div');
    dashEl.id = 'bh-dashboard';
    dashEl.style.padding = '0 32px';

    var tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        homeView.insertBefore(dashEl, tableContainer);
    } else {
        homeView.appendChild(dashEl);
    }

    // Hook into Home nav button
    var homeNav = document.getElementById('nav-home');
    if (homeNav) {
        var origOnclick = homeNav.getAttribute('onclick');
        homeNav.onclick = function() {
            showDashboard();
            // Still call original switchView('home')
            if (typeof window.switchView === 'function') window.switchView('home');
        };
    }

    // Watch banner-title changes to detect folder switches
    var bannerTitle = document.getElementById('banner-title');
    if (bannerTitle) {
        bannerObserver = new MutationObserver(function() {
            var title = bannerTitle.textContent;
            // "My Music" and "All Songs" are the home states
            if (title === 'My Music' || title === 'All Songs') {
                showDashboard();
            } else {
                hideDashboard();
            }
        });
        bannerObserver.observe(bannerTitle, { childList: true, characterData: true, subtree: true });
    }

    // Also intercept clicks on playlist items in the sidebar
    watchPlaylistClicks();

    showDashboard();
    render();
    injectStyles();
}

function watchPlaylistClicks() {
    var plList = document.getElementById('pl-list');
    if (!plList) return;

    // Use event delegation — any click in the playlist list = folder selected
    plList.addEventListener('click', function() {
        // Give the playlist switch time to update the banner
        setTimeout(function() {
            var bannerTitle = document.getElementById('banner-title');
            if (bannerTitle) {
                var title = bannerTitle.textContent;
                if (title !== 'My Music' && title !== 'All Songs') {
                    hideDashboard();
                }
            }
        }, 250);
    });
}

function showDashboard() {
    isHome = true;
    if (dashEl) dashEl.style.display = '';

    var homeView = document.getElementById('view-home');
    if (homeView) {
        var banner = homeView.querySelector('.banner');
        if (banner) banner.style.display = 'none';
        var controlsHeader = homeView.querySelector('.controls-header');
        if (controlsHeader) controlsHeader.style.display = 'none';
    }

    generateQuickPicks();
    render();
}

function hideDashboard() {
    isHome = false;
    if (dashEl) dashEl.style.display = 'none';

    var homeView = document.getElementById('view-home');
    if (homeView) {
        var banner = homeView.querySelector('.banner');
        if (banner) banner.style.display = '';
        var controlsHeader = homeView.querySelector('.controls-header');
        if (controlsHeader) controlsHeader.style.display = '';
    }
}

function removeDashboard() {
    if (bannerObserver) { bannerObserver.disconnect(); bannerObserver = null; }

    if (dashEl) {
        dashEl.remove();
        dashEl = null;
    }

    // Restore original elements
    var homeView = document.getElementById('view-home');
    if (homeView) {
        var banner = homeView.querySelector('.banner');
        if (banner) banner.style.display = '';
        var controlsHeader = homeView.querySelector('.controls-header');
        if (controlsHeader) controlsHeader.style.display = '';
    }

    // Restore Home nav onclick
    var homeNav = document.getElementById('nav-home');
    if (homeNav) {
        homeNav.onclick = function() {
            if (typeof window.switchView === 'function') window.switchView('home');
        };
    }
}

// --- History persistence ---

async function loadHistory() {
    if (!api) return;
    var stored = await api.storage.get('history');
    if (stored && Array.isArray(stored)) {
        history = stored;
        render();
    }
}

async function saveHistory() {
    if (!api) return;
    await api.storage.set('history', history);
}

function onTrackChange(idx, song) {
    if (!song) return;

    var entry = {
        title: song.title,
        filename: song.filename,
        folder: song.folder,
        artwork: song.artwork || null,
        playedAt: Date.now()
    };

    history = history.filter(function(h) { return h.filename !== song.filename; });
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    saveHistory();
    render();
}

function onLibraryLoaded() {
    generateQuickPicks();
    render();
}

var renderTimer = null;
function debounceRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function() { render(); }, 400);
}

function generateQuickPicks() {
    if (!api) return;
    var songs = api.library.getSongs();
    if (songs.length === 0) { quickPicks = []; return; }

    var shuffled = songs.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
    }
    quickPicks = shuffled.slice(0, QUICK_PICK_COUNT);
}

// --- Stats ---

function getStats() {
    if (!api) return null;
    var songs = api.library.getSongs();
    if (songs.length === 0) return null;

    var totalSec = 0;
    var folders = {};
    for (var i = 0; i < songs.length; i++) {
        totalSec += songs[i].durSec || 0;
        folders[songs[i].folder] = (folders[songs[i].folder] || 0) + 1;
    }

    var folderCount = Object.keys(folders).length;

    var topFolders = Object.keys(folders).map(function(name) {
        return { name: name, count: folders[name] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);

    return {
        totalSongs: songs.length,
        totalDuration: formatDuration(totalSec),
        folderCount: folderCount,
        topFolders: topFolders
    };
}

function formatDuration(sec) {
    if (!sec || sec <= 0) return '0 min';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + ' min';
}

function getGreeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
}

// --- Render ---

function render() {
    if (!dashEl || !isHome) return;
    if (!api) return;

    var songs = api.library.getSongs();
    var current = api.playback.getCurrentTrack();
    var stats = getStats();

    var html = '<div style="max-width:860px; margin:0 auto; padding-bottom:24px">';

    // Greeting + stats
    html += '<div style="margin-bottom:24px">' +
        '<div style="font-size:26px; font-weight:800">' + getGreeting() + '</div>';
    if (stats) {
        html += '<div style="font-size:12px; color:var(--text-sub); margin-top:4px">' +
            stats.totalSongs + ' songs &middot; ' + stats.totalDuration + ' &middot; ' + stats.folderCount + ' folders</div>';
    }
    html += '</div>';

    if (songs.length === 0) {
        html += '</div>';
        dashEl.innerHTML = html;
        return;
    }

    // Now Playing hero
    if (current) {
        var heroArt = current.artwork
            ? '<img src="' + current.artwork + '" style="width:100%; height:100%; object-fit:cover">'
            : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a">' +
              '<i class="fas fa-compact-disc" style="font-size:48px; color:var(--accent); opacity:0.5"></i></div>';

        html += '<div class="bh-hero" style="display:flex; gap:20px; align-items:center; background:var(--bg-card); ' +
            'border-radius:16px; padding:20px; margin-bottom:28px; overflow:hidden">' +
            '<div style="width:100px; height:100px; border-radius:12px; overflow:hidden; flex-shrink:0">' + heroArt + '</div>' +
            '<div style="overflow:hidden; flex:1">' +
            '<div style="font-size:10px; text-transform:uppercase; font-weight:800; color:var(--accent); letter-spacing:1px; margin-bottom:4px">Now Playing</div>' +
            '<div style="font-size:20px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(current.title) + '</div>' +
            '<div style="font-size:12px; color:var(--text-sub); margin-top:4px">' + esc(current.folder) + '</div>' +
            '</div></div>';
    }

    // Recently Played
    if (history.length > 0) {
        html += sectionHeader('Recently Played', 'fas fa-history');
        html += '<div class="bh-scroll" style="display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none; margin-bottom:28px">';
        for (var i = 0; i < history.length; i++) {
            var h = history[i];
            var art = h.artwork
                ? '<img src="' + h.artwork + '" style="width:100%; height:100%; object-fit:cover">'
                : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a">' +
                  '<i class="fas fa-music" style="font-size:20px; color:var(--accent); opacity:0.4"></i></div>';

            html += '<div class="bh-card" data-filename="' + escAttr(h.filename) + '" style="' +
                'flex-shrink:0; width:130px; cursor:pointer">' +
                '<div style="width:130px; height:130px; border-radius:10px; overflow:hidden; position:relative; margin-bottom:8px">' +
                art +
                '<div class="bh-card-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.45); display:flex; ' +
                'align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s">' +
                '<i class="fas fa-play" style="font-size:22px; color:white"></i></div>' +
                '</div>' +
                '<div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(h.title) + '</div>' +
                '<div style="font-size:10px; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(h.folder) + '</div>' +
                '</div>';
        }
        html += '</div>';
    }

    // Quick Picks
    if (quickPicks.length > 0) {
        html += sectionHeader('Quick Picks', 'fas fa-dice');
        html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; margin-bottom:28px">';
        for (var q = 0; q < quickPicks.length; q++) {
            var s = quickPicks[q];
            var qArt = s.artwork
                ? '<img src="' + s.artwork + '" style="width:100%; height:100%; object-fit:cover">'
                : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a">' +
                  '<i class="fas fa-music" style="font-size:14px; color:var(--accent); opacity:0.4"></i></div>';

            html += '<div class="bh-quick" data-filename="' + escAttr(s.filename) + '" style="' +
                'display:flex; align-items:center; gap:12px; background:var(--bg-card); border-radius:10px; ' +
                'padding:8px; cursor:pointer; transition:all 0.2s; overflow:hidden">' +
                '<div style="width:44px; height:44px; border-radius:6px; overflow:hidden; flex-shrink:0">' + qArt + '</div>' +
                '<div style="overflow:hidden; flex:1">' +
                '<div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(s.title) + '</div>' +
                '<div style="font-size:10px; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(s.folder) + '</div>' +
                '</div></div>';
        }
        html += '</div>';
    }

    // Top Folders
    if (stats && stats.topFolders.length > 0) {
        html += sectionHeader('Top Folders', 'fas fa-folder');
        html += '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:28px">';
        for (var f = 0; f < stats.topFolders.length; f++) {
            var folder = stats.topFolders[f];
            var folderSongs = api.library.getPlaylistSongs(folder.name);
            var fArt = null;
            for (var fi = 0; fi < folderSongs.length; fi++) {
                if (folderSongs[fi].artwork) { fArt = folderSongs[fi].artwork; break; }
            }
            var fArtHtml = fArt
                ? '<img src="' + fArt + '" style="width:100%; height:100%; object-fit:cover">'
                : '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center">' +
                  '<i class="fas fa-folder" style="font-size:18px; color:var(--accent); opacity:0.5"></i></div>';

            html += '<div class="bh-folder" data-folder="' + escAttr(folder.name) + '" style="' +
                'display:flex; align-items:center; gap:12px; background:var(--bg-card); border-radius:12px; ' +
                'padding:12px 16px; cursor:pointer; transition:all 0.2s; min-width:200px; flex:1">' +
                '<div style="width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#1a1a1a">' + fArtHtml + '</div>' +
                '<div style="overflow:hidden">' +
                '<div style="font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(folder.name) + '</div>' +
                '<div style="font-size:11px; color:var(--text-sub)">' + folder.count + ' songs</div>' +
                '</div></div>';
        }
        html += '</div>';
    }

    html += '</div>';
    dashEl.innerHTML = html;

    // --- Bind events ---

    var cards = dashEl.querySelectorAll('.bh-card');
    for (var ci = 0; ci < cards.length; ci++) {
        (function(card) {
            card.onclick = function() {
                playSongByFilename(card.getAttribute('data-filename'));
            };
        })(cards[ci]);
    }

    var quicks = dashEl.querySelectorAll('.bh-quick');
    for (var qi = 0; qi < quicks.length; qi++) {
        (function(el) {
            el.onclick = function() {
                playSongByFilename(el.getAttribute('data-filename'));
            };
        })(quicks[qi]);
    }

    var folderEls = dashEl.querySelectorAll('.bh-folder');
    for (var fi = 0; fi < folderEls.length; fi++) {
        (function(el) {
            el.onclick = function() {
                playFolderByName(el.getAttribute('data-folder'));
            };
        })(folderEls[fi]);
    }
}

function sectionHeader(label, icon) {
    return '<div style="display:flex; align-items:center; gap:8px; margin-bottom:14px">' +
        '<i class="' + icon + '" style="color:var(--accent); font-size:14px"></i>' +
        '<div style="font-size:16px; font-weight:800">' + label + '</div></div>';
}

function playSongByFilename(filename) {
    if (!api) return;
    var songs = api.library.getSongs();
    for (var i = 0; i < songs.length; i++) {
        if (songs[i].filename === filename) {
            api.playback.play(i);
            return;
        }
    }
}

function playFolderByName(name) {
    if (!api) return;
    var songs = api.library.getPlaylistSongs(name);
    if (songs.length > 0) {
        var allSongs = api.library.getSongs();
        for (var i = 0; i < allSongs.length; i++) {
            if (allSongs[i].filename === songs[0].filename) {
                api.playback.play(i);
                return;
            }
        }
    }
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
        '.bh-card:hover .bh-card-overlay { opacity: 1 !important; }' +
        '.bh-card:hover { transform: translateY(-3px); }' +
        '.bh-card { transition: transform 0.2s; }' +
        '.bh-quick:hover { background: var(--bg-card-hover) !important; transform: scale(1.02); }' +
        '.bh-folder:hover { background: var(--bg-card-hover) !important; transform: scale(1.02); }' +
        '.bh-hero { transition: all 0.3s; }' +
        '.bh-scroll::-webkit-scrollbar { display: none; }';
    document.head.appendChild(style);
}
