var container = null;
var api = null;
var folders = [];
var filterText = '';

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'better-folders',
            label: 'Folders',
            icon: 'fas fa-folder-open',
            order: 50,
            onClick: function(el) {
                container = el;
                refresh();
            }
        });

        api.events.on('libraryLoaded', onLibraryChange);
        api.events.on('metadataUpdate', onLibraryChange);
        api.events.on('trackChange', onTrackChange);

        return module.exports;
    },

    disable: function() {
        container = null;
        folders = [];
    },

    destroy: function() {
        container = null;
        api = null;
        folders = [];
    }
};

var refreshTimer = null;
function onLibraryChange() {
    // Debounce metadata updates since they fire per-song
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function() {
        buildFolders();
        render();
    }, 300);
}

function onTrackChange() {
    render();
}

function refresh() {
    buildFolders();
    render();
}

function buildFolders() {
    if (!api) return;
    var playlists = api.library.getPlaylists();
    folders = [];

    for (var i = 0; i < playlists.length; i++) {
        var name = playlists[i].name;
        if (name === 'All Songs') continue;

        var songs = api.library.getPlaylistSongs(name);
        var totalSec = 0;
        var artworks = [];

        for (var j = 0; j < songs.length; j++) {
            totalSec += songs[j].durSec || 0;
            if (artworks.length < 4 && songs[j].artwork) {
                artworks.push(songs[j].artwork);
            }
        }

        folders.push({
            name: name,
            count: songs.length,
            totalSec: totalSec,
            duration: formatDuration(totalSec),
            artworks: artworks
        });
    }

    // Sort by name
    folders.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
}

function formatDuration(sec) {
    if (!sec || sec <= 0) return '';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + ' min';
}

function render() {
    if (!container) return;
    if (!api) return;

    var allSongs = api.library.getSongs();
    if (!allSongs || allSongs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:80px 20px; color:var(--text-sub)">' +
            '<i class="fas fa-folder-open" style="font-size:48px; opacity:0.2; display:block; margin-bottom:16px"></i>' +
            '<div>Load a library to browse folders</div></div>';
        return;
    }

    var current = api.playback.getCurrentTrack();
    var currentFolder = current ? current.folder : null;

    // Filter
    var visible = folders;
    if (filterText) {
        var q = filterText.toLowerCase();
        visible = folders.filter(function(f) {
            return f.name.toLowerCase().indexOf(q) !== -1;
        });
    }

    var html = '<div style="max-width:800px; margin:0 auto; padding:0 8px">';

    // Header
    html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px">' +
        '<div><div style="font-size:22px; font-weight:800">Folders</div>' +
        '<div style="font-size:12px; color:var(--text-sub); margin-top:2px">' + folders.length + ' folders</div></div>' +
        '<div style="position:relative">' +
        '<input type="text" class="bf-search" placeholder="Filter folders..." value="' + escapeAttr(filterText) + '" ' +
        'style="background:var(--bg-card); border:1px solid #333; border-radius:20px; padding:8px 16px 8px 32px; ' +
        'color:var(--text-main); font-size:12px; width:180px; outline:none">' +
        '<i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-sub); font-size:11px"></i>' +
        '</div></div>';

    // Grid
    html += '<div class="bf-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:16px; padding-bottom:60px">';

    for (var i = 0; i < visible.length; i++) {
        var f = visible[i];
        var isPlaying = f.name === currentFolder;

        // Build artwork mosaic
        var artHtml = '';
        if (f.artworks.length >= 4) {
            artHtml = '<div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; width:100%; height:100%">';
            for (var a = 0; a < 4; a++) {
                artHtml += '<img src="' + f.artworks[a] + '" style="width:100%; height:100%; object-fit:cover">';
            }
            artHtml += '</div>';
        } else if (f.artworks.length > 0) {
            artHtml = '<img src="' + f.artworks[0] + '" style="width:100%; height:100%; object-fit:cover">';
        } else {
            artHtml = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a">' +
                '<i class="fas fa-folder" style="font-size:40px; color:var(--accent); opacity:0.4"></i></div>';
        }

        html += '<div class="bf-card" data-folder="' + escapeAttr(f.name) + '" style="' +
            'background:var(--bg-card); border-radius:12px; overflow:hidden; cursor:pointer; ' +
            'transition:all 0.2s ease; position:relative; ' +
            (isPlaying ? 'box-shadow:0 0 0 2px var(--accent);' : '') +
            '">' +
            '<div class="bf-art" style="aspect-ratio:1; overflow:hidden; position:relative">' +
            artHtml +
            '<div class="bf-play-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; ' +
            'align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s">' +
            '<i class="fas fa-play" style="font-size:28px; color:white"></i></div>' +
            '</div>' +
            '<div style="padding:10px 12px">' +
            '<div style="font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' +
            escapeHtml(f.name) + '</div>' +
            '<div style="font-size:11px; color:var(--text-sub); margin-top:3px; display:flex; justify-content:space-between">' +
            '<span>' + f.count + ' song' + (f.count !== 1 ? 's' : '') + '</span>' +
            (f.duration ? '<span>' + f.duration + '</span>' : '') +
            '</div>' +
            '</div></div>';
    }

    html += '</div></div>';

    container.innerHTML = html;

    // Bind search
    var searchInput = container.querySelector('.bf-search');
    if (searchInput) {
        searchInput.oninput = function() {
            filterText = this.value;
            render();
            // Re-focus after re-render
            var newInput = container.querySelector('.bf-search');
            if (newInput) {
                newInput.focus();
                newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
            }
        };
    }

    // Bind card clicks
    var cards = container.querySelectorAll('.bf-card');
    for (var c = 0; c < cards.length; c++) {
        (function(card) {
            var folderName = card.getAttribute('data-folder');

            // Single click on play overlay = play folder
            var overlay = card.querySelector('.bf-play-overlay');
            if (overlay) {
                overlay.onclick = function(e) {
                    e.stopPropagation();
                    playFolder(folderName);
                };
            }

            // Click card = play folder
            card.onclick = function() {
                playFolder(folderName);
            };
        })(cards[c]);
    }

    injectStyles();
}

function playFolder(name) {
    if (!api) return;
    var songs = api.library.getPlaylistSongs(name);
    if (songs.length > 0) {
        // Find the song index in the full library to play it
        var allSongs = api.library.getSongs();
        for (var i = 0; i < allSongs.length; i++) {
            if (allSongs[i].filename === songs[0].filename) {
                api.playback.play(i);
                break;
            }
        }
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
        '.bf-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }' +
        '.bf-card:hover .bf-play-overlay { opacity: 1 !important; }' +
        '.bf-card:active { transform: translateY(-2px); }' +
        '.bf-search:focus { border-color: var(--accent) !important; }';
    document.head.appendChild(style);
}
