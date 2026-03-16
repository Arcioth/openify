var api = null;
var barEl = null;
var originalHeader = null;
var searchOpen = false;
var queueOpen = false;
var accountOpen = false;
var totalPlayed = 0;

module.exports = {
    init(_api) {
        api = _api;

        api.events.on('trackChange', onTrackChange);
        api.events.on('queueChange', onQueueChange);
        api.events.on('libraryLoaded', onLibraryLoaded);

        loadStats();
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

// --- Stats persistence ---

async function loadStats() {
    if (!api) return;
    var stored = await api.storage.get('stats');
    if (stored && typeof stored.totalPlayed === 'number') {
        totalPlayed = stored.totalPlayed;
    }
}

async function saveStats() {
    if (!api) return;
    await api.storage.set('stats', { totalPlayed: totalPlayed });
}

function onTrackChange() {
    totalPlayed++;
    saveStats();
    renderBar();
}

function onQueueChange() {
    renderBar();
}

function onLibraryLoaded() {
    renderBar();
}

// --- Inject / Restore ---

function inject() {
    originalHeader = document.querySelector('.header');
    if (!originalHeader) return;

    originalHeader.style.display = 'none';

    barEl = document.createElement('header');
    barEl.id = 'bt-bar';
    barEl.className = 'header';
    barEl.style.cssText = 'height:56px; display:flex; align-items:center; justify-content:space-between; ' +
        'padding:0 24px; position:sticky; top:0; z-index:100; background:rgba(18,18,18,0.85); ' +
        'backdrop-filter:blur(24px); border-bottom:1px solid rgba(255,255,255,0.04); gap:12px';

    originalHeader.parentNode.insertBefore(barEl, originalHeader);

    renderBar();
    injectStyles();

    // Close dropdowns on outside click
    document.addEventListener('click', onDocClick);
}

function restore() {
    if (barEl) {
        barEl.remove();
        barEl = null;
    }
    if (originalHeader) {
        originalHeader.style.display = '';
        originalHeader = null;
    }
    document.removeEventListener('click', onDocClick);
    searchOpen = false;
    queueOpen = false;
    accountOpen = false;
}

function onDocClick(e) {
    if (!barEl) return;
    if (!e.target.closest('#bt-bar')) {
        if (searchOpen || queueOpen || accountOpen) {
            searchOpen = false;
            queueOpen = false;
            accountOpen = false;
            renderBar();
        }
    }
}

// --- Render ---

function renderBar() {
    if (!barEl || !api) return;

    var songs = api.library.getSongs();
    var current = api.playback.getCurrentTrack();
    var playbackState = api.playback.getState();

    // --- Left: Search ---
    var searchHtml = '<div class="bt-section" style="position:relative; flex:1; max-width:400px">' +
        '<div class="bt-search-box" style="display:flex; align-items:center; gap:10px; ' +
        'background:var(--bg-card); border-radius:24px; padding:6px 14px; cursor:text; ' +
        'border:1px solid ' + (searchOpen ? 'var(--accent)' : 'transparent') + '; transition:all 0.2s">' +
        '<i class="fas fa-search" style="color:var(--text-sub); font-size:12px"></i>' +
        '<input type="text" id="bt-search-input" placeholder="Search ' + songs.length + ' tracks..." ' +
        'style="background:none; border:none; color:var(--text-main); font-size:13px; outline:none; width:100%">' +
        '<kbd style="font-size:9px; color:var(--text-sub); background:rgba(255,255,255,0.06); padding:2px 6px; ' +
        'border-radius:4px; font-family:inherit; white-space:nowrap">/</kbd>' +
        '</div>' +
        '<div id="bt-search-results" class="bt-dropdown" style="display:none; position:absolute; top:calc(100% + 6px); ' +
        'left:0; width:100%; background:var(--bg-card); border-radius:12px; border:1px solid rgba(255,255,255,0.08); ' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.5); overflow:hidden; z-index:200; max-height:320px; overflow-y:auto"></div>' +
        '</div>';

    // --- Center: Now playing mini (if playing) ---
    var centerHtml = '';
    if (current) {
        var miniArt = current.artwork
            ? '<img src="' + current.artwork + '" style="width:100%; height:100%; object-fit:cover">'
            : '<i class="fas fa-music" style="font-size:10px; color:var(--accent); opacity:0.5"></i>';

        centerHtml = '<div class="bt-now-playing" style="display:flex; align-items:center; gap:10px; ' +
            'background:var(--bg-card); border-radius:20px; padding:4px 14px 4px 4px; max-width:240px; cursor:default">' +
            '<div style="width:32px; height:32px; border-radius:8px; overflow:hidden; flex-shrink:0; ' +
            'display:flex; align-items:center; justify-content:center; background:#1a1a1a">' + miniArt + '</div>' +
            '<div style="overflow:hidden">' +
            '<div style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px">' + esc(current.title) + '</div>' +
            '<div style="font-size:9px; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(current.folder) + '</div>' +
            '</div></div>';
    }

    // --- Right: Queue + Account ---
    // Queue count
    var queueCount = getQueueCount();

    var rightHtml = '<div class="bt-section" style="display:flex; align-items:center; gap:8px">';

    // Queue button
    rightHtml += '<div class="bt-queue-wrap" style="position:relative">' +
        '<div class="bt-icon-btn" id="bt-queue-btn" title="Queue" style="' + iconBtnStyle() + '">' +
        '<i class="fas fa-list-ul" style="font-size:14px"></i>' +
        (queueCount > 0 ? '<span class="bt-badge" style="position:absolute; top:-2px; right:-2px; background:var(--accent); ' +
        'color:#fff; font-size:8px; font-weight:800; width:16px; height:16px; border-radius:50%; ' +
        'display:flex; align-items:center; justify-content:center">' + queueCount + '</span>' : '') +
        '</div>' +
        '<div id="bt-queue-dropdown" class="bt-dropdown" style="display:' + (queueOpen ? 'block' : 'none') + '; ' +
        'position:absolute; top:calc(100% + 8px); right:0; width:280px; background:var(--bg-card); border-radius:12px; ' +
        'border:1px solid rgba(255,255,255,0.08); box-shadow:0 12px 40px rgba(0,0,0,0.5); z-index:200; padding:12px; ' +
        'max-height:360px; overflow-y:auto">' +
        renderQueueDropdown() +
        '</div></div>';

    // Account button
    rightHtml += '<div class="bt-account-wrap" style="position:relative">' +
        '<div class="bt-icon-btn" id="bt-account-btn" title="Account" style="' + iconBtnStyle() + ' ' +
        'background:' + (accountOpen ? 'var(--accent)' : 'rgba(255,255,255,0.08)') + '; ' +
        'color:' + (accountOpen ? '#fff' : 'var(--text-sub)') + '">' +
        '<i class="fas fa-user" style="font-size:13px"></i>' +
        '</div>' +
        '<div id="bt-account-dropdown" class="bt-dropdown" style="display:' + (accountOpen ? 'block' : 'none') + '; ' +
        'position:absolute; top:calc(100% + 8px); right:0; width:220px; background:var(--bg-card); border-radius:12px; ' +
        'border:1px solid rgba(255,255,255,0.08); box-shadow:0 12px 40px rgba(0,0,0,0.5); z-index:200; padding:16px">' +
        renderAccountDropdown(songs) +
        '</div></div>';

    rightHtml += '</div>';

    barEl.innerHTML = searchHtml + centerHtml + rightHtml;

    // --- Bind events ---
    bindSearch();
    bindQueue();
    bindAccount();
    bindKeyboard();
}

function iconBtnStyle() {
    return 'width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; ' +
        'cursor:pointer; transition:all 0.2s; position:relative; background:rgba(255,255,255,0.08); color:var(--text-sub);';
}

// --- Search ---

function bindSearch() {
    var input = document.getElementById('bt-search-input');
    var results = document.getElementById('bt-search-results');
    if (!input || !results) return;

    input.oninput = function() {
        var q = input.value.toLowerCase().trim();
        if (!q) { results.style.display = 'none'; searchOpen = false; return; }

        var songs = api.library.getSongs();
        var matches = [];
        for (var i = 0; i < songs.length && matches.length < 8; i++) {
            if (songs[i].title.toLowerCase().indexOf(q) !== -1 ||
                songs[i].folder.toLowerCase().indexOf(q) !== -1) {
                matches.push({ song: songs[i], idx: i });
            }
        }

        if (matches.length === 0) {
            results.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-sub); font-size:12px">' +
                '<i class="fas fa-search" style="opacity:0.3; display:block; margin-bottom:6px"></i>No results</div>';
            results.style.display = 'block';
            searchOpen = true;
            return;
        }

        var html = '';
        for (var m = 0; m < matches.length; m++) {
            var s = matches[m].song;
            var art = s.artwork
                ? '<img src="' + s.artwork + '" style="width:100%; height:100%; object-fit:cover">'
                : '<i class="fas fa-music" style="font-size:10px; color:var(--accent); opacity:0.4"></i>';

            html += '<div class="bt-result" data-idx="' + matches[m].idx + '" style="display:flex; align-items:center; gap:10px; ' +
                'padding:8px 12px; cursor:pointer; transition:background 0.15s">' +
                '<div style="width:36px; height:36px; border-radius:6px; overflow:hidden; flex-shrink:0; ' +
                'background:#1a1a1a; display:flex; align-items:center; justify-content:center">' + art + '</div>' +
                '<div style="overflow:hidden; flex:1">' +
                '<div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(s.title) + '</div>' +
                '<div style="font-size:10px; color:var(--text-sub)">' + esc(s.folder) + ' &middot; ' + s.duration + '</div>' +
                '</div>' +
                '<i class="fas fa-play" style="font-size:10px; color:var(--text-sub); opacity:0"></i>' +
                '</div>';
        }
        results.innerHTML = html;
        results.style.display = 'block';
        searchOpen = true;

        // Bind result clicks
        var resultEls = results.querySelectorAll('.bt-result');
        for (var r = 0; r < resultEls.length; r++) {
            (function(el) {
                el.onclick = function(e) {
                    e.stopPropagation();
                    var idx = parseInt(el.getAttribute('data-idx'));
                    api.playback.play(idx);
                    input.value = '';
                    results.style.display = 'none';
                    searchOpen = false;
                };
            })(resultEls[r]);
        }
    };

    input.onfocus = function() {
        if (input.value.trim()) input.oninput();
    };
}

function bindKeyboard() {
    // "/" shortcut to focus search
    if (!window._btKeyBound) {
        window._btKeyBound = true;
        document.addEventListener('keydown', function(e) {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                var active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                var input = document.getElementById('bt-search-input');
                if (input) input.focus();
            }
            if (e.key === 'Escape') {
                var input = document.getElementById('bt-search-input');
                if (input && document.activeElement === input) {
                    input.blur();
                    input.value = '';
                    var results = document.getElementById('bt-search-results');
                    if (results) results.style.display = 'none';
                    searchOpen = false;
                }
                queueOpen = false;
                accountOpen = false;
                renderBar();
            }
        });
    }
}

// --- Queue ---

function getQueueCount() {
    // Read manual queue from DOM since we can't access state directly
    var manualList = document.getElementById('manual-queue-list');
    if (!manualList) return 0;
    return manualList.querySelectorAll('.q-item').length;
}

function renderQueueDropdown() {
    var html = '<div style="font-weight:800; font-size:13px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between">' +
        '<span><i class="fas fa-list-ul" style="margin-right:6px; color:var(--accent)"></i>Queue</span>' +
        '<span class="bt-queue-toggle-full" style="font-size:10px; color:var(--accent); cursor:pointer; font-weight:600">Open Full</span>' +
        '</div>';

    // Read queue items from the existing queue sidebar DOM
    var manualList = document.getElementById('manual-queue-list');
    var playlistList = document.getElementById('playlist-queue-list');

    var manualItems = manualList ? manualList.querySelectorAll('.q-item') : [];
    var playlistItems = playlistList ? playlistList.querySelectorAll('.q-item') : [];

    if (manualItems.length > 0) {
        html += '<div style="font-size:9px; text-transform:uppercase; color:var(--text-sub); font-weight:700; letter-spacing:0.5px; margin-bottom:6px">Manual Queue</div>';
        for (var i = 0; i < Math.min(manualItems.length, 5); i++) {
            var titleEl = manualItems[i].querySelector('div[style*="font-weight"]');
            var title = titleEl ? titleEl.textContent : 'Track';
            html += '<div class="bt-q-item" style="padding:6px 0; font-size:12px; display:flex; align-items:center; gap:8px; color:var(--text-main)">' +
                '<i class="fas fa-grip-vertical" style="font-size:8px; color:var(--text-sub); opacity:0.4"></i>' +
                '<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(title) + '</span>' +
                '</div>';
        }
        if (manualItems.length > 5) {
            html += '<div style="font-size:10px; color:var(--text-sub); padding:4px 0">+' + (manualItems.length - 5) + ' more</div>';
        }
    }

    if (playlistItems.length > 0) {
        html += '<div style="font-size:9px; text-transform:uppercase; color:var(--text-sub); font-weight:700; letter-spacing:0.5px; margin:8px 0 6px">Coming Up</div>';
        for (var j = 0; j < Math.min(playlistItems.length, 5); j++) {
            var tEl = playlistItems[j].querySelector('div[style*="font-weight"]');
            var t = tEl ? tEl.textContent : 'Track';
            html += '<div class="bt-q-item" style="padding:6px 0; font-size:12px; display:flex; align-items:center; gap:8px; color:var(--text-sub)">' +
                '<span style="font-size:9px; opacity:0.5; width:14px; text-align:center">' + (j + 1) + '</span>' +
                '<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">' + esc(t) + '</span>' +
                '</div>';
        }
        if (playlistItems.length > 5) {
            html += '<div style="font-size:10px; color:var(--text-sub); padding:4px 0">+' + (playlistItems.length - 5) + ' more</div>';
        }
    }

    if (manualItems.length === 0 && playlistItems.length === 0) {
        html += '<div style="text-align:center; padding:16px 0; color:var(--text-sub); font-size:12px">' +
            '<i class="fas fa-inbox" style="display:block; font-size:20px; opacity:0.2; margin-bottom:8px"></i>' +
            'Queue is empty</div>';
    }

    return html;
}

function bindQueue() {
    var qBtn = document.getElementById('bt-queue-btn');
    if (qBtn) {
        qBtn.onclick = function(e) {
            e.stopPropagation();
            queueOpen = !queueOpen;
            accountOpen = false;
            renderBar();
        };
    }

    // "Open Full" toggles the real queue sidebar
    var fullBtn = barEl ? barEl.querySelector('.bt-queue-toggle-full') : null;
    if (fullBtn) {
        fullBtn.onclick = function(e) {
            e.stopPropagation();
            document.body.classList.toggle('queue-collapsed');
            queueOpen = false;
            renderBar();
        };
    }
}

// --- Account ---

function renderAccountDropdown(songs) {
    var totalSec = 0;
    var folderSet = {};
    for (var i = 0; i < songs.length; i++) {
        totalSec += songs[i].durSec || 0;
        folderSet[songs[i].folder] = true;
    }
    var folderCount = Object.keys(folderSet).length;

    var html = '<div style="text-align:center; margin-bottom:14px">' +
        '<div style="width:48px; height:48px; border-radius:50%; background:var(--accent); margin:0 auto 8px; ' +
        'display:flex; align-items:center; justify-content:center">' +
        '<i class="fas fa-user" style="font-size:20px; color:#fff"></i></div>' +
        '<div style="font-size:14px; font-weight:800">Listener</div>' +
        '<div style="font-size:10px; color:var(--text-sub)">Local Collection</div></div>';

    // Stats grid
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px">';
    html += statCard('fas fa-music', songs.length, 'Songs');
    html += statCard('fas fa-folder', folderCount, 'Folders');
    html += statCard('fas fa-clock', formatDuration(totalSec), 'Duration');
    html += statCard('fas fa-play', totalPlayed, 'Played');
    html += '</div>';

    // Current playback info
    var ps = api.playback.getState();
    var loopLabels = ['Off', 'Loop All', 'Loop One'];
    var shuffleLabels = ['Off', 'Playlist', 'All'];

    html += '<div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:10px">';
    html += '<div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-sub); margin-bottom:4px">' +
        '<span><i class="fas fa-redo" style="margin-right:4px"></i>Loop: ' + loopLabels[ps.loopMode || 0] + '</span>' +
        '<span><i class="fas fa-random" style="margin-right:4px"></i>Shuffle: ' + shuffleLabels[ps.shuffleMode || 0] + '</span></div>';
    html += '</div>';

    return html;
}

function statCard(icon, value, label) {
    return '<div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px; text-align:center">' +
        '<i class="' + icon + '" style="font-size:12px; color:var(--accent); display:block; margin-bottom:4px"></i>' +
        '<div style="font-size:14px; font-weight:800">' + value + '</div>' +
        '<div style="font-size:9px; color:var(--text-sub); text-transform:uppercase">' + label + '</div></div>';
}

function bindAccount() {
    var aBtn = document.getElementById('bt-account-btn');
    if (aBtn) {
        aBtn.onclick = function(e) {
            e.stopPropagation();
            accountOpen = !accountOpen;
            queueOpen = false;
            renderBar();
        };
    }
}

// --- Helpers ---

function formatDuration(sec) {
    if (!sec || sec <= 0) return '0m';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
        '.bt-icon-btn:hover { background: rgba(255,255,255,0.15) !important; color: var(--text-main) !important; transform: scale(1.08); }' +
        '.bt-icon-btn { transition: all 0.15s !important; }' +
        '.bt-result:hover { background: var(--bg-card-hover) !important; }' +
        '.bt-result:hover .fa-play { opacity: 1 !important; color: var(--accent) !important; }' +
        '.bt-search-box:hover { border-color: rgba(255,255,255,0.1) !important; }' +
        '.bt-dropdown { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }' +
        '.bt-dropdown::-webkit-scrollbar { width: 4px; }' +
        '.bt-dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }' +
        '#bt-bar .bt-now-playing { transition: all 0.2s; }' +
        '#bt-bar .bt-now-playing:hover { background: var(--bg-card-hover); }';
    document.head.appendChild(style);
}
