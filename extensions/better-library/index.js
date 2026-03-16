var api = null;
var sortMode = 'name'; // name, count, duration
var sortDir = 'asc';
var filterText = '';
var recentlyPlayed = [];
var MAX_RECENT = 5;
var styleEl = null;
var observer = null;
var injected = false;

module.exports = {
    init: function(_api) {
        api = _api;
        loadRecent();
        registerEvents();
        setTimeout(function() { inject(); }, 100);
        return module.exports;
    },

    enable: function(_api) {
        api = _api;
        loadRecent();
        registerEvents();
        setTimeout(function() { inject(); }, 100);
    },

    disable: function() {
        restore();
    },

    destroy: function() {
        restore();
        api = null;
    }
};

function registerEvents() {
    api.events.on('libraryLoaded', onLibraryLoad);
    api.events.on('metadataUpdate', debounceRefresh);
    api.events.on('trackChange', onTrackChange);
}

// --- State ---

function getFolderData() {
    if (!api) return [];
    var playlists = api.library.getPlaylists();
    var result = [];

    for (var i = 0; i < playlists.length; i++) {
        var name = playlists[i].name;
        if (name === 'All Songs') continue;

        var songs = api.library.getPlaylistSongs(name);
        var totalSec = 0;
        var artwork = null;

        for (var j = 0; j < songs.length; j++) {
            totalSec += songs[j].durSec || 0;
            if (!artwork && songs[j].artwork) {
                artwork = songs[j].artwork;
            }
        }

        result.push({
            name: name,
            count: songs.length,
            totalSec: totalSec,
            artwork: artwork
        });
    }

    // Sort
    result.sort(function(a, b) {
        var valA, valB;
        if (sortMode === 'count') { valA = a.count; valB = b.count; }
        else if (sortMode === 'duration') { valA = a.totalSec; valB = b.totalSec; }
        else { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // Filter
    if (filterText) {
        var q = filterText.toLowerCase();
        result = result.filter(function(f) {
            return f.name.toLowerCase().indexOf(q) !== -1;
        });
    }

    return result;
}

function getTotalStats() {
    if (!api) return { songs: 0, folders: 0, duration: 0 };
    var songs = api.library.getSongs();
    var playlists = api.library.getPlaylists();
    var totalSec = 0;
    for (var i = 0; i < songs.length; i++) {
        totalSec += songs[i].durSec || 0;
    }
    return {
        songs: songs.length,
        folders: Math.max(0, playlists.length - 1),
        duration: totalSec
    };
}

// --- Recent ---

async function loadRecent() {
    if (!api) return;
    var stored = await api.storage.get('recent');
    if (Array.isArray(stored)) {
        recentlyPlayed = stored;
    }
}

async function saveRecent() {
    if (!api) return;
    await api.storage.set('recent', recentlyPlayed);
}

function addRecent(folderName) {
    if (!folderName || folderName === 'All Songs') return;
    recentlyPlayed = recentlyPlayed.filter(function(n) { return n !== folderName; });
    recentlyPlayed.unshift(folderName);
    if (recentlyPlayed.length > MAX_RECENT) {
        recentlyPlayed = recentlyPlayed.slice(0, MAX_RECENT);
    }
    saveRecent();
}

// --- Events ---

var refreshTimer = null;
function debounceRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function() { render(); }, 300);
}

function onLibraryLoad() {
    if (!injected) inject();
    // Render immediately, plus a debounced one for metadata arriving after
    render();
    debounceRefresh();
}

function onTrackChange(idx, song) {
    if (song && song.folder) {
        addRecent(song.folder);
    }
    render();
}

// --- Inject / Restore ---
// Only hide #pl-list. The original Load Folder button and file input stay untouched.

function inject() {
    var plList = document.getElementById('pl-list');
    if (!plList) return;
    injected = true;

    // Watch #pl-list for changes so we re-render when the app updates it
    if (!observer) {
        observer = new MutationObserver(function() { render(); });
        observer.observe(plList, { childList: true });
    }

    // Hide only the original playlist list
    plList.style.display = 'none';

    // Insert our container right after pl-list (keeping Load Folder button visible above)
    var container = document.getElementById('blib-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'blib-container';
        container.style.cssText = 'display:flex; flex-direction:column; flex:1; overflow:hidden; margin-top:6px;';
        plList.parentElement.insertBefore(container, plList.nextSibling);
    }

    render();
    injectStyles();
}

function restore() {
    injected = false;

    if (observer) {
        observer.disconnect();
        observer = null;
    }

    var container = document.getElementById('blib-container');
    if (container) container.remove();

    var plList = document.getElementById('pl-list');
    if (plList) plList.style.display = '';

    if (styleEl) {
        styleEl.remove();
        styleEl = null;
    }
}

// --- Render ---

function render() {
    var container = document.getElementById('blib-container');
    if (!container || !api) return;

    var folders = getFolderData();
    var stats = getTotalStats();
    var current = api.playback.getCurrentTrack();
    var currentFolder = current ? current.folder : null;
    var activePl = api.library.getActivePlaylist();

    var html = '';

    // Search
    html += '<div class="blib-search-wrap">' +
        '<i class="fas fa-search blib-search-icon"></i>' +
        '<input type="text" class="blib-search" placeholder="Filter folders..." value="' + esc(filterText) + '">' +
        '</div>';

    // Sort bar
    html += '<div class="blib-sort-bar">' +
        sortBtn('name', 'A-Z') +
        sortBtn('count', '#') +
        sortBtn('duration', 'Time') +
        '</div>';

    // Recently played (only when no filter active and we have recent items)
    if (!filterText && recentlyPlayed.length > 0) {
        html += '<div class="blib-section-label">Recently Played</div>';
        html += '<div class="blib-recent-list">';
        for (var r = 0; r < recentlyPlayed.length; r++) {
            var rName = recentlyPlayed[r];
            var rArt = null;
            for (var fi = 0; fi < folders.length; fi++) {
                if (folders[fi].name === rName) { rArt = folders[fi].artwork; break; }
            }
            html += '<div class="blib-recent-item" data-folder="' + esc(rName) + '">' +
                '<div class="blib-recent-art">' +
                (rArt ? '<img src="' + rArt + '">' : '<i class="fas fa-folder"></i>') +
                '</div>' +
                '<div class="blib-recent-name">' + esc(rName) + '</div>' +
                '</div>';
        }
        html += '</div>';
    }

    // Folder list
    html += '<div class="blib-section-label">All Folders <span style="opacity:0.5;font-weight:400">(' + folders.length + ')</span></div>';
    html += '<div class="blib-folder-list">';

    // "All Songs" entry
    var allActive = activePl === 'All Songs';
    html += '<div class="blib-folder-item' + (allActive ? ' blib-active' : '') + '" data-folder="All Songs">' +
        '<div class="blib-folder-art blib-all-songs"><i class="fas fa-music"></i></div>' +
        '<div class="blib-folder-info">' +
        '<div class="blib-folder-name">All Songs</div>' +
        '<div class="blib-folder-meta">' + stats.songs + ' songs &middot; ' + fmtDur(stats.duration) + '</div>' +
        '</div></div>';

    for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        var isActive = activePl === f.name;
        var isPlaying = f.name === currentFolder;

        html += '<div class="blib-folder-item' +
            (isActive ? ' blib-active' : '') +
            (isPlaying ? ' blib-playing' : '') +
            '" data-folder="' + esc(f.name) + '">' +
            '<div class="blib-folder-art">' +
            (f.artwork ? '<img src="' + f.artwork + '">' : '<i class="fas fa-folder"></i>') +
            '</div>' +
            '<div class="blib-folder-info">' +
            '<div class="blib-folder-name">' + esc(f.name) + '</div>' +
            '<div class="blib-folder-meta">' + f.count + ' song' + (f.count !== 1 ? 's' : '') +
            (f.totalSec > 0 ? ' &middot; ' + fmtDur(f.totalSec) : '') + '</div>' +
            '</div>' +
            (isPlaying ? '<div class="blib-now-icon"><i class="fas fa-volume-up"></i></div>' : '') +
            '</div>';
    }

    html += '</div>';

    // Bottom stats
    html += '<div class="blib-bottom-stats">' +
        '<span>' + stats.folders + ' folders</span>' +
        '<span>' + fmtDur(stats.duration) + '</span>' +
        '</div>';

    container.innerHTML = html;
    bindEvents(container);
}

function bindEvents(container) {
    // Search
    var searchInput = container.querySelector('.blib-search');
    if (searchInput) {
        searchInput.oninput = function() {
            filterText = this.value;
            render();
            var newInput = document.querySelector('#blib-container .blib-search');
            if (newInput) {
                newInput.focus();
                newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
            }
        };
    }

    // Sort buttons
    var sortBtns = container.querySelectorAll('.blib-sort-btn');
    for (var s = 0; s < sortBtns.length; s++) {
        (function(btn) {
            btn.onclick = function() {
                var m = btn.getAttribute('data-sort');
                if (sortMode === m) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortMode = m;
                    sortDir = 'asc';
                }
                render();
            };
        })(sortBtns[s]);
    }

    // Folder clicks
    var items = container.querySelectorAll('.blib-folder-item, .blib-recent-item');
    for (var f = 0; f < items.length; f++) {
        (function(item) {
            var name = item.getAttribute('data-folder');
            var clickTimer = null;
            item.onclick = function() {
                if (clickTimer) return;
                clickTimer = setTimeout(function() {
                    clickTimer = null;
                    goToFolder(name);
                }, 200);
            };
            item.ondblclick = function() {
                clearTimeout(clickTimer);
                clickTimer = null;
                goToFolder(name);
                playFolder(name);
            };
        })(items[f]);
    }
}

function goToFolder(name) {
    // Use the globally exposed switchPlaylist and switchView
    if (window.switchPlaylist) {
        window.switchPlaylist(name);
        window.switchView('home');
    }
    render();
}

function playFolder(name) {
    if (!api) return;
    var songs = api.library.getPlaylistSongs(name);
    if (songs.length > 0) {
        var allSongs = api.library.getSongs();
        for (var i = 0; i < allSongs.length; i++) {
            if (allSongs[i].filename === songs[0].filename) {
                api.playback.play(i);
                break;
            }
        }
    }
}

// --- Helpers ---

function sortBtn(mode, label) {
    var active = sortMode === mode;
    var arrow = active ? (sortDir === 'asc' ? ' <i class="fas fa-sort-up" style="font-size:9px"></i>' : ' <i class="fas fa-sort-down" style="font-size:9px"></i>') : '';
    return '<button class="blib-sort-btn' + (active ? ' active' : '') + '" data-sort="' + mode + '">' +
        label + arrow + '</button>';
}

function fmtDur(sec) {
    if (!sec || sec <= 0) return '0m';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Styles ---

function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'blib-styles';
    styleEl.textContent =
        '#blib-container { font-size: 12px; }' +

        '.blib-search-wrap { position:relative; margin-bottom:6px; }' +
        '.blib-search-icon { position:absolute; left:8px; top:50%; transform:translateY(-50%); color:var(--text-sub); font-size:10px; }' +
        '.blib-search { width:100%; padding:6px 8px 6px 26px; background:var(--bg-card); border:1px solid rgba(255,255,255,0.06); ' +
        'border-radius:8px; color:var(--text-main); font-size:11px; outline:none; box-sizing:border-box; transition:border-color 0.2s; }' +
        '.blib-search:focus { border-color: var(--accent); }' +

        '.blib-sort-bar { display:flex; gap:4px; margin-bottom:6px; }' +
        '.blib-sort-btn { flex:1; padding:3px 0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); ' +
        'border-radius:6px; color:var(--text-sub); font-size:10px; font-weight:600; cursor:pointer; transition:all 0.15s; }' +
        '.blib-sort-btn:hover { background:rgba(255,255,255,0.08); color:var(--text-main); }' +
        '.blib-sort-btn.active { background:var(--accent); color:white; border-color:var(--accent); }' +

        '.blib-section-label { font-size:10px; font-weight:700; color:var(--text-sub); text-transform:uppercase; ' +
        'letter-spacing:0.5px; padding:4px 0; opacity:0.7; }' +

        '.blib-recent-list { display:flex; gap:6px; overflow-x:auto; padding:2px 0 8px 0; scrollbar-width:thin; }' +
        '.blib-recent-item { flex-shrink:0; width:56px; cursor:pointer; text-align:center; transition:transform 0.15s; }' +
        '.blib-recent-item:hover { transform: translateY(-2px); }' +
        '.blib-recent-art { width:56px; height:56px; border-radius:8px; overflow:hidden; background:var(--bg-card); ' +
        'display:flex; align-items:center; justify-content:center; margin-bottom:4px; }' +
        '.blib-recent-art img { width:100%; height:100%; object-fit:cover; }' +
        '.blib-recent-art i { font-size:18px; color:var(--accent); opacity:0.4; }' +
        '.blib-recent-name { font-size:9px; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }' +

        '.blib-folder-list { flex:1; overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; padding-right:2px; }' +

        '.blib-folder-item { display:flex; align-items:center; gap:8px; padding:6px; border-radius:8px; ' +
        'cursor:pointer; transition:all 0.15s; position:relative; }' +
        '.blib-folder-item:hover { background:var(--bg-card-hover); }' +
        '.blib-folder-item.blib-active { background:var(--bg-card); }' +
        '.blib-folder-item.blib-active .blib-folder-name { color:var(--accent); }' +
        '.blib-folder-item.blib-playing { box-shadow: inset 2px 0 0 var(--accent); }' +

        '.blib-folder-art { width:36px; height:36px; border-radius:6px; overflow:hidden; flex-shrink:0; ' +
        'background:var(--bg-card); display:flex; align-items:center; justify-content:center; }' +
        '.blib-folder-art img { width:100%; height:100%; object-fit:cover; }' +
        '.blib-folder-art i { font-size:14px; color:var(--accent); opacity:0.4; }' +
        '.blib-folder-art.blib-all-songs { background: linear-gradient(135deg, var(--accent), rgba(255,255,255,0.1)); }' +
        '.blib-folder-art.blib-all-songs i { color:white; opacity:0.9; font-size:16px; }' +

        '.blib-folder-info { overflow:hidden; flex:1; }' +
        '.blib-folder-name { font-size:12px; font-weight:600; color:var(--text-main); white-space:nowrap; ' +
        'overflow:hidden; text-overflow:ellipsis; }' +
        '.blib-folder-meta { font-size:10px; color:var(--text-sub); margin-top:1px; }' +

        '.blib-now-icon { color:var(--accent); font-size:10px; flex-shrink:0; animation: blib-pulse 1.5s ease infinite; }' +
        '@keyframes blib-pulse { 0%, 100% { opacity:0.6; } 50% { opacity:1; } }' +

        '.blib-bottom-stats { display:flex; justify-content:space-between; padding:6px 4px; border-top:1px solid rgba(255,255,255,0.06); ' +
        'font-size:10px; color:var(--text-sub); opacity:0.6; flex-shrink:0; }';

    document.head.appendChild(styleEl);
}
