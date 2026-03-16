var api = null;
var activeLayout = 'table';
var LAYOUTS = [
    { id: 'table',   icon: 'fas fa-list',        label: 'Table' },
    { id: 'cards',   icon: 'fas fa-th',           label: 'Cards' },
    { id: 'gallery', icon: 'fas fa-images',       label: 'Gallery' },
    { id: 'minimal', icon: 'fas fa-align-left',   label: 'Minimal' },
];
var customContainer = null;
var toolbarEl = null;
var currentPlaylist = null;
var sortCol = 'id';
var sortDir = 'asc';

module.exports = {
    init(_api) {
        api = _api;

        api.events.on('libraryLoaded', onLibraryChange);
        api.events.on('metadataUpdate', debounceRender);
        api.events.on('trackChange', onTrackChange);

        loadLayout();
        inject();
        return module.exports;
    },

    disable: function() {
        restore();
    },

    destroy: function() {
        restore();
        api = null;
    }
};

// --- Persist layout ---

async function loadLayout() {
    if (!api) return;
    var stored = await api.storage.get('layout');
    if (stored && typeof stored === 'string') {
        activeLayout = stored;
    }
    // Re-render if already injected
    if (customContainer) renderLayout();
}

function saveLayout() {
    if (!api) return;
    api.storage.set('layout', activeLayout);
}

// --- Inject / Restore ---

function inject() {
    var homeView = document.getElementById('view-home');
    if (!homeView) return;

    // Replace original controls-header buttons with our toolbar
    var controlsHeader = homeView.querySelector('.controls-header');
    if (controlsHeader) {
        // Hide original view buttons
        var origBtns = controlsHeader.querySelectorAll('.view-btn');
        origBtns.forEach(function(b) { b.style.display = 'none'; });

        // Insert our toolbar
        toolbarEl = document.createElement('div');
        toolbarEl.id = 'bl-toolbar';
        toolbarEl.style.cssText = 'display:flex; align-items:center; gap:4px';
        controlsHeader.insertBefore(toolbarEl, controlsHeader.firstChild);
        renderToolbar();
    }

    // Create custom container that sits over the table
    var tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        customContainer = document.createElement('div');
        customContainer.id = 'bl-container';
        customContainer.style.cssText = 'padding:0 32px 40px; display:none';
        tableContainer.parentNode.insertBefore(customContainer, tableContainer.nextSibling);
    }

    // Observe playlist switches via the banner title
    observePlaylistSwitch();

    injectStyles();
    applyLayout();
}

function restore() {
    var homeView = document.getElementById('view-home');
    if (!homeView) return;

    // Show original view buttons
    var controlsHeader = homeView.querySelector('.controls-header');
    if (controlsHeader) {
        controlsHeader.querySelectorAll('.view-btn').forEach(function(b) { b.style.display = ''; });
    }

    if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }
    if (customContainer) { customContainer.remove(); customContainer = null; }

    // Show original table
    var tableContainer = document.getElementById('table-container');
    if (tableContainer) tableContainer.style.display = '';
}

// --- Observe playlist changes ---

function observePlaylistSwitch() {
    var bannerTitle = document.getElementById('banner-title');
    if (!bannerTitle) return;
    var obs = new MutationObserver(function() {
        renderLayout();
    });
    obs.observe(bannerTitle, { childList: true, characterData: true, subtree: true });
}

// --- Toolbar ---

function renderToolbar() {
    if (!toolbarEl) return;
    var html = '';
    for (var i = 0; i < LAYOUTS.length; i++) {
        var l = LAYOUTS[i];
        var isActive = l.id === activeLayout;
        html += '<button class="bl-btn' + (isActive ? ' bl-active' : '') + '" data-layout="' + l.id + '" title="' + l.label + '" style="' +
            'width:32px; height:32px; border:none; border-radius:8px; cursor:pointer; display:flex; ' +
            'align-items:center; justify-content:center; font-size:13px; transition:all 0.15s; ' +
            'background:' + (isActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)') + '; ' +
            'color:' + (isActive ? '#fff' : 'var(--text-sub)') + '">' +
            '<i class="' + l.icon + '"></i></button>';
    }

    // Sort dropdown for non-table layouts
    if (activeLayout !== 'table') {
        html += '<div style="margin-left:8px; display:flex; align-items:center; gap:4px">' +
            '<select id="bl-sort" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); ' +
            'border-radius:6px; color:var(--text-sub); font-size:11px; padding:4px 8px; cursor:pointer; outline:none">' +
            '<option value="id"' + (sortCol === 'id' ? ' selected' : '') + '># Number</option>' +
            '<option value="title"' + (sortCol === 'title' ? ' selected' : '') + '>Title</option>' +
            '<option value="duration"' + (sortCol === 'duration' ? ' selected' : '') + '>Duration</option>' +
            '<option value="folder"' + (sortCol === 'folder' ? ' selected' : '') + '>Folder</option>' +
            '</select>' +
            '<button id="bl-sort-dir" style="width:28px; height:28px; border:none; border-radius:6px; cursor:pointer; ' +
            'background:rgba(255,255,255,0.06); color:var(--text-sub); font-size:11px; display:flex; align-items:center; justify-content:center">' +
            '<i class="fas fa-sort-' + (sortDir === 'asc' ? 'up' : 'down') + '"></i></button>' +
            '</div>';
    }

    toolbarEl.innerHTML = html;

    // Bind layout buttons
    var btns = toolbarEl.querySelectorAll('.bl-btn');
    for (var b = 0; b < btns.length; b++) {
        (function(btn) {
            btn.onclick = function() {
                activeLayout = btn.getAttribute('data-layout');
                saveLayout();
                renderToolbar();
                applyLayout();
            };
        })(btns[b]);
    }

    // Bind sort
    var sortSelect = document.getElementById('bl-sort');
    if (sortSelect) {
        sortSelect.onchange = function() {
            sortCol = this.value;
            renderLayout();
        };
    }
    var sortDirBtn = document.getElementById('bl-sort-dir');
    if (sortDirBtn) {
        sortDirBtn.onclick = function() {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            renderToolbar();
            renderLayout();
        };
    }
}

// --- Apply layout switch ---

function applyLayout() {
    var tableContainer = document.getElementById('table-container');

    if (activeLayout === 'table') {
        // Show original table, hide custom
        if (tableContainer) tableContainer.style.display = '';
        if (customContainer) customContainer.style.display = 'none';
    } else {
        // Hide table, show custom
        if (tableContainer) tableContainer.style.display = 'none';
        if (customContainer) customContainer.style.display = '';
        renderLayout();
    }
}

// --- Events ---

function onLibraryChange() {
    renderLayout();
}

var renderTimer = null;
function debounceRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function() { renderLayout(); }, 300);
}

function onTrackChange() {
    renderLayout();
}

// --- Get current songs ---

function getCurrentSongs() {
    if (!api) return [];
    // Read active playlist from banner title
    var bannerTitle = document.getElementById('banner-title');
    var plName = bannerTitle ? bannerTitle.textContent : 'All Songs';
    var songs = api.library.getPlaylistSongs(plName);
    if (!songs || songs.length === 0) songs = api.library.getSongs();
    return sortSongs(songs);
}

function sortSongs(songs) {
    var col = sortCol;
    var dir = sortDir;
    return songs.slice().sort(function(a, b) {
        var vA, vB;
        if (col === 'title') { vA = a.title.toLowerCase(); vB = b.title.toLowerCase(); }
        else if (col === 'duration') { vA = a.durSec || 0; vB = b.durSec || 0; }
        else if (col === 'folder') { vA = a.folder.toLowerCase(); vB = b.folder.toLowerCase(); }
        else { vA = a.id; vB = b.id; }
        if (vA < vB) return dir === 'asc' ? -1 : 1;
        if (vA > vB) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

// --- Render ---

function renderLayout() {
    if (!customContainer || activeLayout === 'table') return;
    if (!api) return;

    var songs = getCurrentSongs();
    var current = api.playback.getCurrentTrack();
    var currentFile = current ? current.filename : null;

    switch (activeLayout) {
        case 'cards':   renderCards(songs, currentFile); break;
        case 'gallery': renderGallery(songs, currentFile); break;
        case 'minimal': renderMinimal(songs, currentFile); break;
    }

    bindPlayClicks();
}

// --- Cards Layout ---

function renderCards(songs, currentFile) {
    var html = '<div class="bl-cards" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:16px">';

    for (var i = 0; i < songs.length; i++) {
        var s = songs[i];
        var isPlaying = s.filename === currentFile;
        var art = s.artwork
            ? '<img src="' + s.artwork + '" style="width:100%; height:100%; object-fit:cover">'
            : placeholder(s.title);

        html += '<div class="bl-card" data-filename="' + escAttr(s.filename) + '" style="' +
            'background:var(--bg-card); border-radius:12px; overflow:hidden; cursor:pointer; ' +
            'transition:all 0.2s; position:relative; ' +
            (isPlaying ? 'box-shadow:0 0 0 2px var(--accent);' : '') + '">' +
            '<div style="aspect-ratio:1; overflow:hidden; position:relative; background:#111">' +
            art +
            '<div class="bl-card-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.5); ' +
            'display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s">' +
            (isPlaying
                ? '<i class="fas fa-volume-up" style="font-size:24px; color:var(--accent)"></i>'
                : '<i class="fas fa-play" style="font-size:24px; color:white"></i>') +
            '</div></div>' +
            '<div style="padding:10px 12px">' +
            '<div style="font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ' +
            (isPlaying ? 'color:var(--accent)' : '') + '">' + esc(s.title) + '</div>' +
            '<div style="display:flex; justify-content:space-between; margin-top:4px">' +
            '<span style="font-size:10px; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(s.folder) + '</span>' +
            '<span style="font-size:10px; color:var(--text-sub); flex-shrink:0; margin-left:6px">' + s.duration + '</span>' +
            '</div></div></div>';
    }

    html += '</div>';
    customContainer.innerHTML = html;
}

// --- Gallery Layout ---

function renderGallery(songs, currentFile) {
    var html = '<div class="bl-gallery" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px">';

    for (var i = 0; i < songs.length; i++) {
        var s = songs[i];
        var isPlaying = s.filename === currentFile;
        var art = s.artwork
            ? '<img src="' + s.artwork + '" style="width:100%; height:100%; object-fit:cover">'
            : placeholder(s.title);

        html += '<div class="bl-gal-item" data-filename="' + escAttr(s.filename) + '" style="' +
            'position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; cursor:pointer; ' +
            'background:#111; transition:all 0.2s; ' +
            (isPlaying ? 'box-shadow:0 0 0 2px var(--accent);' : '') + '">' +
            art +
            '<div class="bl-gal-info" style="position:absolute; bottom:0; left:0; right:0; ' +
            'background:linear-gradient(transparent, rgba(0,0,0,0.85)); padding:24px 8px 8px; ' +
            'opacity:0; transition:opacity 0.2s">' +
            '<div style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff">' + esc(s.title) + '</div>' +
            '<div style="font-size:9px; color:rgba(255,255,255,0.6)">' + s.duration + '</div>' +
            '</div>' +
            (isPlaying ? '<div style="position:absolute; top:6px; right:6px; width:20px; height:20px; border-radius:50%; ' +
            'background:var(--accent); display:flex; align-items:center; justify-content:center">' +
            '<i class="fas fa-volume-up" style="font-size:8px; color:#fff"></i></div>' : '') +
            '<div class="bl-gal-play" style="position:absolute; inset:0; display:flex; align-items:center; ' +
            'justify-content:center; opacity:0; transition:opacity 0.15s; background:rgba(0,0,0,0.3)">' +
            '<i class="fas fa-play" style="font-size:20px; color:#fff"></i></div>' +
            '</div>';
    }

    html += '</div>';
    customContainer.innerHTML = html;
}

// --- Minimal Layout ---

function renderMinimal(songs, currentFile) {
    var html = '<div class="bl-minimal" style="max-width:700px">';

    var currentFolder = '';
    for (var i = 0; i < songs.length; i++) {
        var s = songs[i];
        var isPlaying = s.filename === currentFile;

        // Folder divider when sorting by folder
        if (sortCol === 'folder' && s.folder !== currentFolder) {
            currentFolder = s.folder;
            html += '<div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--accent); ' +
                'letter-spacing:1px; padding:16px 0 6px; border-bottom:1px solid rgba(255,255,255,0.04); margin-bottom:4px">' +
                esc(s.folder) + '</div>';
        }

        html += '<div class="bl-min-row" data-filename="' + escAttr(s.filename) + '" style="' +
            'display:flex; align-items:center; gap:12px; padding:7px 8px; border-radius:6px; ' +
            'cursor:pointer; transition:all 0.15s; ' +
            (isPlaying ? 'background:rgba(255,255,255,0.04);' : '') + '">' +
            '<span style="width:24px; text-align:right; font-size:11px; color:' + (isPlaying ? 'var(--accent)' : 'var(--text-sub)') + '; flex-shrink:0">' +
            (isPlaying ? '<i class="fas fa-volume-up" style="font-size:10px"></i>' : s.id) + '</span>' +
            '<span style="flex:1; font-size:13px; font-weight:' + (isPlaying ? '700' : '500') + '; ' +
            'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ' +
            'color:' + (isPlaying ? 'var(--accent)' : 'var(--text-main)') + '">' + esc(s.title) + '</span>' +
            '<span style="font-size:11px; color:var(--text-sub); flex-shrink:0">' + s.duration + '</span>' +
            '</div>';
    }

    html += '</div>';
    customContainer.innerHTML = html;
}

// --- Bind play clicks ---

function bindPlayClicks() {
    if (!customContainer || !api) return;

    var items = customContainer.querySelectorAll('[data-filename]');
    for (var i = 0; i < items.length; i++) {
        (function(el) {
            el.onclick = function() {
                var filename = el.getAttribute('data-filename');
                var allSongs = api.library.getSongs();
                for (var j = 0; j < allSongs.length; j++) {
                    if (allSongs[j].filename === filename) {
                        api.playback.play(j);
                        return;
                    }
                }
            };
        })(items[i]);
    }
}

// --- Helpers ---

function placeholder(title) {
    var hue = 0;
    for (var i = 0; i < title.length; i++) hue = (hue + title.charCodeAt(i) * 37) % 360;
    var chars = title.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X');
    var text = chars[0].toUpperCase() + chars[1].toLowerCase();
    return '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; ' +
        'background:hsl(' + hue + ', 25%, 30%); font-weight:800; font-size:24px; color:rgba(255,255,255,0.7)">' + text + '</div>';
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
        '.bl-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }' +
        '.bl-card:hover .bl-card-overlay { opacity: 1 !important; }' +
        '.bl-gal-item:hover .bl-gal-info { opacity: 1 !important; }' +
        '.bl-gal-item:hover .bl-gal-play { opacity: 1 !important; }' +
        '.bl-gal-item:hover { transform: scale(1.03); z-index: 1; }' +
        '.bl-min-row:hover { background: rgba(255,255,255,0.05) !important; }' +
        '.bl-btn:hover { opacity: 0.85; transform: scale(1.06); }' +
        '#bl-sort:hover { border-color: var(--accent) !important; }' +
        '#bl-sort option { background: var(--bg-card); color: var(--text-main); }';
    document.head.appendChild(style);
}
