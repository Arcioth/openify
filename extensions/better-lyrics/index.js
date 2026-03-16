var api = null;
var container = null;
var currentTrack = null;
var syncedLines = null;
var plainText = null;
var activeLine = -1;
var tickInterval = null;

// Per-track settings
var offset = 0;        // seconds (positive = lyrics earlier, negative = later)
var startLine = 0;     // skip N lines from the beginning
var offsets = {};       // { filename: { offset, startLine } }

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'better-lyrics',
            label: 'Lyrics',
            icon: 'fas fa-music',
            order: 60,
            replaces: 'lyrics',
            onClick: function(el) {
                container = el;
                render();
            }
        });

        api.ui.registerPlayerWidget({
            id: 'bl-player-line',
            render: function(el) {
                el.id = 'bl-player-widget';
                el.style.cssText = 'overflow:hidden; max-width:200px; cursor:pointer';
                el.title = 'Current lyric line';
                el.onclick = function() {
                    var navBtn = document.querySelector('.nav-item[data-ext="better-lyrics"]');
                    if (navBtn) navBtn.click();
                };
            }
        });

        api.events.on('trackChange', onTrackChange);

        loadOffsets();
        return module.exports;
    },

    disable: function() {
        stopTick();
        var widget = document.getElementById('bl-player-widget');
        if (widget) widget.innerHTML = '';
        container = null;
        currentTrack = null;
        syncedLines = null;
        plainText = null;
    },

    destroy: function() {
        stopTick();
        container = null;
        api = null;
    }
};

// --- Persist offsets ---

async function loadOffsets() {
    if (!api) return;
    var stored = await api.storage.get('offsets');
    if (stored && typeof stored === 'object') {
        offsets = stored;
    }
}

async function saveOffsets() {
    if (!api) return;
    await api.storage.set('offsets', offsets);
}

function loadTrackSettings() {
    if (!currentTrack) return;
    var key = currentTrack.filename;
    if (offsets[key]) {
        offset = offsets[key].offset || 0;
        startLine = offsets[key].startLine || 0;
    } else {
        offset = 0;
        startLine = 0;
    }
}

function saveTrackSettings() {
    if (!currentTrack) return;
    var key = currentTrack.filename;
    offsets[key] = { offset: offset, startLine: startLine };
    saveOffsets();
}

// --- Track change ---

function onTrackChange(idx, song) {
    currentTrack = song;
    syncedLines = null;
    plainText = null;
    activeLine = -1;
    loadTrackSettings();
    fetchLyrics(song);
}

// --- Tick ---

function startTick() {
    stopTick();
    if (!syncedLines) return;
    tickInterval = setInterval(updateActiveLine, 150);
}

function stopTick() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}

function getVisibleLines() {
    if (!syncedLines) return [];
    return syncedLines.slice(startLine);
}

function updateActiveLine() {
    if (!syncedLines || !api) return;

    var state = api.playback.getState();
    var time = state.currentTime + offset;
    var lines = getVisibleLines();
    var newActive = -1;

    for (var i = 0; i < lines.length; i++) {
        if (lines[i].time <= time) {
            newActive = i;
        } else {
            break;
        }
    }

    if (newActive !== activeLine) {
        activeLine = newActive;
        highlightLine();
        updatePlayerWidget();
    }
}

function highlightLine() {
    if (!container) return;
    var lineEls = container.querySelectorAll('.bl-line');
    for (var i = 0; i < lineEls.length; i++) {
        if (i === activeLine) {
            lineEls[i].classList.add('bl-active');
            lineEls[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            lineEls[i].classList.remove('bl-active');
        }
    }
}

function updatePlayerWidget() {
    var widget = document.getElementById('bl-player-widget');
    if (!widget) return;

    var lines = getVisibleLines();
    if (activeLine >= 0 && activeLine < lines.length) {
        var text = lines[activeLine].text;
        widget.innerHTML = '<div style="font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; ' +
            'text-overflow:ellipsis; color:var(--accent); max-width:200px">' +
            '<i class="fas fa-music" style="margin-right:4px; font-size:9px; opacity:0.6"></i>' + esc(text) + '</div>';
    } else {
        widget.innerHTML = '';
    }
}

// --- LRC Parsing (same as base lyrics) ---

function parseLRC(lrc) {
    var lines = lrc.split('\n');
    var result = [];
    for (var i = 0; i < lines.length; i++) {
        var match = lines[i].match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
        if (match) {
            var mins = parseInt(match[1], 10);
            var secs = parseInt(match[2], 10);
            var ms = parseInt(match[3], 10);
            if (match[3].length === 2) ms *= 10;
            var time = mins * 60 + secs + ms / 1000;
            var text = match[4].trim();
            if (text) result.push({ time: time, text: text });
        }
    }
    result.sort(function(a, b) { return a.time - b.time; });
    return result;
}

// --- Fetch lyrics ---
// Reads from the base lyrics extension's storage (openify.lyrics namespace).
// Falls back to its own fetch if the base hasn't cached yet.

function readBaseLyricsCache(filename) {
    // Read directly from IndexedDB using the base lyrics extension namespace
    return new Promise(function(resolve) {
        var request = indexedDB.open('OpenifyExtensionsDB', 1);
        request.onsuccess = function(e) {
            try {
                var db = e.target.result;
                var tx = db.transaction('ext_data', 'readonly');
                var store = tx.objectStore('ext_data');
                var key = 'openify.lyrics:lyrics:' + filename;
                var req = store.get(key);
                req.onsuccess = function() { resolve(req.result || null); };
                req.onerror = function() { resolve(null); };
            } catch(err) { resolve(null); }
        };
        request.onerror = function() { resolve(null); };
    });
}

async function fetchLyrics(song) {
    if (!song || !api) return;

    // Check own cache first
    var ownKey = 'lyrics:' + song.filename;
    var own = await api.storage.get(ownKey);
    if (own) {
        applyCache(own);
        return;
    }

    // Try base lyrics extension cache
    var baseCached = await readBaseLyricsCache(song.filename);
    if (baseCached) {
        // Copy to own cache
        await api.storage.set(ownKey, baseCached);
        applyCache(baseCached);
        return;
    }

    render(); // show loading

    // Wait for base lyrics to fetch, then retry
    setTimeout(function() { retryFetch(song, 1); }, 2500);
}

async function retryFetch(song, attempt) {
    if (!song || !api) return;
    if (currentTrack !== song) return;

    var baseCached = await readBaseLyricsCache(song.filename);
    if (baseCached) {
        await api.storage.set('lyrics:' + song.filename, baseCached);
        applyCache(baseCached);
        return;
    }

    // After 2 retries, fetch directly
    if (attempt < 3) {
        setTimeout(function() { retryFetch(song, attempt + 1); }, 2000);
        return;
    }

    // Direct fetch as fallback
    var query = song.title
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\d{3,}kbps/gi, '')
        .replace(/official\s*(video|audio|music\s*video)/gi, '')
        .replace(/lyric\s*video/gi, '')
        .replace(/ft\.?\s*/gi, '')
        .replace(/feat\.?\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    try {
        var resp = await fetch('https://lrclib.net/api/search?q=' + encodeURIComponent(query));
        if (!resp.ok) throw new Error('API error');
        var results = await resp.json();
        if (results && results.length > 0) {
            var best = results[0];
            var data = { synced: best.syncedLyrics || null, plain: best.plainLyrics || null };
            await api.storage.set('lyrics:' + song.filename, data);
            applyCache(data);
        } else {
            render();
        }
    } catch(e) {
        render();
    }
}

function applyCache(cached) {
    if (cached.synced) {
        syncedLines = parseLRC(cached.synced);
    } else {
        syncedLines = null;
    }
    plainText = cached.plain || null;
    render();
    startTick();
}

// --- Render ---

function render() {
    if (!container) return;
    if (!api) return;

    var track = currentTrack || api.playback.getCurrentTrack();

    if (!track) {
        container.innerHTML = '<div style="text-align:center; padding:80px 20px; color:var(--text-sub)">' +
            '<i class="fas fa-music" style="font-size:48px; opacity:0.2; display:block; margin-bottom:16px"></i>' +
            '<div>Play a track to see lyrics</div></div>';
        return;
    }

    var lines = getVisibleLines();

    var html = '<div style="max-width:640px; margin:0 auto">';

    // Header
    html += '<div style="margin-bottom:16px; text-align:center">' +
        '<div style="font-size:20px; font-weight:800">' + esc(track.title) + '</div>' +
        '<div style="font-size:12px; color:var(--text-sub); margin-top:4px">' + esc(track.folder) + '</div>' +
        '</div>';

    // Controls bar
    html += renderControls();

    // Lyrics body
    if (lines.length > 0) {
        html += '<div class="bl-body" style="text-align:center; padding-bottom:200px; margin-top:16px">';
        for (var i = 0; i < lines.length; i++) {
            html += '<div class="bl-line" data-idx="' + i + '" style="' +
                'padding:8px 0; font-size:18px; font-weight:600; color:var(--text-sub); ' +
                'transition:all 0.3s ease; cursor:pointer; line-height:1.6' +
                '">' + esc(lines[i].text) + '</div>';
        }
        html += '</div>';
    } else if (plainText) {
        var escaped = plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        html += '<div style="text-align:center; font-size:16px; line-height:2; color:var(--text-sub); padding-bottom:60px; margin-top:16px">' +
            escaped + '</div>';
    } else if (currentTrack) {
        html += '<div style="text-align:center; padding:40px 20px; color:var(--text-sub)">' +
            '<i class="fas fa-search" style="font-size:32px; opacity:0.2; display:block; margin-bottom:12px"></i>' +
            '<div style="font-size:14px">Waiting for lyrics...</div>' +
            '<div style="font-size:11px; margin-top:8px; opacity:0.5">Make sure the Lyrics extension is enabled</div>' +
            '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind line clicks (seek to line time)
    var lineEls = container.querySelectorAll('.bl-line');
    for (var j = 0; j < lineEls.length; j++) {
        (function(idx) {
            lineEls[idx].onclick = function() {
                if (!api || !syncedLines) return;
                var visLines = getVisibleLines();
                if (idx < visLines.length) {
                    var seekTime = visLines[idx].time - offset;
                    var state = api.playback.getState();
                    if (state.duration > 0) {
                        api.playback.seek(Math.max(0, seekTime) / state.duration);
                    }
                }
            };
        })(j);
    }

    // Bind controls
    bindControls();

    injectStyles();
}

function renderControls() {
    var hasSync = syncedLines && syncedLines.length > 0;

    var html = '<div class="bl-controls" style="display:flex; align-items:center; justify-content:center; gap:8px; ' +
        'flex-wrap:wrap; padding:10px 12px; background:var(--bg-card); border-radius:12px; margin-bottom:4px">';

    // Offset controls
    html += '<div style="display:flex; align-items:center; gap:6px">' +
        '<span style="font-size:10px; color:var(--text-sub); font-weight:700; text-transform:uppercase; letter-spacing:0.5px">Offset</span>' +
        '<button class="bl-ctrl-btn" id="bl-offset-down" title="-0.5s" style="' + ctrlBtnStyle() + '">-</button>' +
        '<span id="bl-offset-val" style="font-size:12px; font-weight:700; min-width:50px; text-align:center; ' +
        'color:' + (offset !== 0 ? 'var(--accent)' : 'var(--text-sub)') + '">' + formatOffset(offset) + '</span>' +
        '<button class="bl-ctrl-btn" id="bl-offset-up" title="+0.5s" style="' + ctrlBtnStyle() + '">+</button>' +
        '<button class="bl-ctrl-btn" id="bl-offset-reset" title="Reset to 0" style="' + ctrlBtnStyle() + ' font-size:10px">0</button>' +
        '</div>';

    // Separator
    html += '<div style="width:1px; height:20px; background:rgba(255,255,255,0.08); margin:0 4px"></div>';

    // Start line control
    if (hasSync) {
        html += '<div style="display:flex; align-items:center; gap:6px">' +
            '<span style="font-size:10px; color:var(--text-sub); font-weight:700; text-transform:uppercase; letter-spacing:0.5px">Skip</span>' +
            '<button class="bl-ctrl-btn" id="bl-start-down" style="' + ctrlBtnStyle() + '">-</button>' +
            '<span id="bl-start-val" style="font-size:12px; font-weight:700; min-width:30px; text-align:center; ' +
            'color:' + (startLine > 0 ? 'var(--accent)' : 'var(--text-sub)') + '">' + startLine + '</span>' +
            '<button class="bl-ctrl-btn" id="bl-start-up" style="' + ctrlBtnStyle() + '">+</button>' +
            '</div>';

        html += '<div style="width:1px; height:20px; background:rgba(255,255,255,0.08); margin:0 4px"></div>';
    }

    // Save button
    html += '<button class="bl-ctrl-btn" id="bl-save" style="' + ctrlBtnStyle() + ' padding:4px 12px; font-size:10px; font-weight:700">' +
        '<i class="fas fa-save" style="margin-right:4px"></i>Save</button>';

    html += '</div>';
    return html;
}

function bindControls() {
    var hasSync = syncedLines && syncedLines.length > 0;

    var offDown = document.getElementById('bl-offset-down');
    var offUp = document.getElementById('bl-offset-up');
    var offReset = document.getElementById('bl-offset-reset');
    var startDown = document.getElementById('bl-start-down');
    var startUp = document.getElementById('bl-start-up');
    var saveBtn = document.getElementById('bl-save');

    if (offDown) offDown.onclick = function(e) {
        e.stopPropagation();
        offset = Math.round((offset - 0.5) * 10) / 10;
        updateControlsDisplay();
    };
    if (offUp) offUp.onclick = function(e) {
        e.stopPropagation();
        offset = Math.round((offset + 0.5) * 10) / 10;
        updateControlsDisplay();
    };
    if (offReset) offReset.onclick = function(e) {
        e.stopPropagation();
        offset = 0;
        updateControlsDisplay();
    };

    if (startDown && hasSync) startDown.onclick = function(e) {
        e.stopPropagation();
        startLine = Math.max(0, startLine - 1);
        activeLine = -1;
        render();
    };
    if (startUp && hasSync) startUp.onclick = function(e) {
        e.stopPropagation();
        startLine = Math.min((syncedLines ? syncedLines.length - 1 : 0), startLine + 1);
        activeLine = -1;
        render();
    };

    if (saveBtn) saveBtn.onclick = function(e) {
        e.stopPropagation();
        saveTrackSettings();
        // Flash feedback
        saveBtn.innerHTML = '<i class="fas fa-check" style="margin-right:4px"></i>Saved';
        saveBtn.style.color = 'var(--accent)';
        setTimeout(function() {
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save" style="margin-right:4px"></i>Save';
                saveBtn.style.color = '';
            }
        }, 1500);
    };
}

function updateControlsDisplay() {
    var offVal = document.getElementById('bl-offset-val');
    if (offVal) {
        offVal.textContent = formatOffset(offset);
        offVal.style.color = offset !== 0 ? 'var(--accent)' : 'var(--text-sub)';
    }
}

function ctrlBtnStyle() {
    return 'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:6px; ' +
        'color:var(--text-sub); cursor:pointer; width:26px; height:26px; font-size:14px; font-weight:700; ' +
        'display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s;';
}

function formatOffset(val) {
    if (val === 0) return '0.0s';
    var sign = val > 0 ? '+' : '';
    return sign + val.toFixed(1) + 's';
}

// --- Helpers ---

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
        '.bl-active { color: var(--accent) !important; transform: scale(1.08); filter: brightness(1.3); }' +
        '.bl-line:hover { color: var(--text-main) !important; }' +
        '.bl-ctrl-btn:hover { background: rgba(255,255,255,0.12) !important; color: var(--text-main) !important; transform: scale(1.08); }' +
        '.bl-ctrl-btn:active { transform: scale(0.95); }' +
        '#bl-player-widget { transition: all 0.3s; }';
    document.head.appendChild(style);
}
