var container = null;
var currentTrack = null;
var syncedLines = null;
var plainText = null;
var activeLine = -1;
var tickInterval = null;
var api = null;

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'lyrics',
            label: 'Lyrics',
            icon: 'fas fa-align-left',
            order: 60,
            onClick: function(el) {
                container = el;
                render();
            }
        });

        api.events.on('trackChange', onTrackChange);

        return module.exports;
    },

    disable: function() {
        stopTick();
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

function onTrackChange(idx, song) {
    currentTrack = song;
    syncedLines = null;
    plainText = null;
    activeLine = -1;
    fetchLyrics(song);
}

function startTick() {
    stopTick();
    if (!syncedLines) return;
    tickInterval = setInterval(updateActiveLine, 200);
}

function stopTick() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}

function updateActiveLine() {
    if (!syncedLines || !api || !container) return;
    if (!container.classList.contains('active')) return;

    var state = api.playback.getState();
    var time = state.currentTime;
    var newActive = -1;

    for (var i = 0; i < syncedLines.length; i++) {
        if (syncedLines[i].time <= time) {
            newActive = i;
        } else {
            break;
        }
    }

    if (newActive !== activeLine) {
        activeLine = newActive;
        highlightLine();
    }
}

function highlightLine() {
    if (!container) return;
    var lines = container.querySelectorAll('.lyric-line');
    for (var i = 0; i < lines.length; i++) {
        if (i === activeLine) {
            lines[i].classList.add('lyric-active');
            lines[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            lines[i].classList.remove('lyric-active');
        }
    }
}

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

async function fetchLyrics(song) {
    if (!song) return;

    // Check cache first
    var cacheKey = 'lyrics:' + song.filename;
    var cached = await api.storage.get(cacheKey);
    if (cached) {
        if (cached.synced) {
            syncedLines = parseLRC(cached.synced);
        }
        plainText = cached.plain || null;
        render();
        startTick();
        return;
    }

    render(); // Show loading state

    // Clean up title for search — remove common junk from filenames
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
            if (best.syncedLyrics) {
                syncedLines = parseLRC(best.syncedLyrics);
            }
            plainText = best.plainLyrics || null;

            // Cache it
            await api.storage.set(cacheKey, {
                synced: best.syncedLyrics || null,
                plain: best.plainLyrics || null
            });
        } else {
            plainText = null;
            syncedLines = null;
        }
    } catch (e) {
        console.warn('Lyrics fetch failed:', e);
        plainText = null;
        syncedLines = null;
    }

    render();
    startTick();
}

function render() {
    if (!container) return;

    var track = currentTrack || api.playback.getCurrentTrack();

    if (!track) {
        container.innerHTML = '<div style="text-align:center; padding:80px 20px; color:var(--text-sub)">' +
            '<i class="fas fa-align-left" style="font-size:48px; opacity:0.2; display:block; margin-bottom:16px"></i>' +
            '<div>Play a track to see lyrics</div></div>';
        return;
    }

    var header = '<div style="margin-bottom:24px; text-align:center">' +
        '<div style="font-size:18px; font-weight:800">' + track.title + '</div>' +
        '<div style="font-size:12px; color:var(--text-sub); margin-top:4px">' + track.folder + '</div>' +
        '</div>';

    if (syncedLines && syncedLines.length > 0) {
        var linesHtml = '';
        for (var i = 0; i < syncedLines.length; i++) {
            linesHtml += '<div class="lyric-line" data-idx="' + i + '" style="' +
                'padding:8px 0; font-size:18px; font-weight:600; color:var(--text-sub); ' +
                'transition:all 0.3s ease; cursor:pointer; line-height:1.6' +
                '">' + syncedLines[i].text + '</div>';
        }
        container.innerHTML = '<div style="max-width:600px; margin:0 auto">' + header +
            '<div class="lyrics-body" style="text-align:center; padding-bottom:200px">' + linesHtml + '</div></div>';

        // Click to seek
        var lineEls = container.querySelectorAll('.lyric-line');
        for (var j = 0; j < lineEls.length; j++) {
            (function(idx) {
                lineEls[idx].onclick = function() {
                    var state = api.playback.getState();
                    if (state.duration > 0) {
                        // We don't have seek via playback:control, so this is view-only
                    }
                };
            })(j);
        }

        // Add styles for active line
        injectStyles();
        return;
    }

    if (plainText) {
        var escaped = plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        container.innerHTML = '<div style="max-width:600px; margin:0 auto">' + header +
            '<div style="text-align:center; font-size:16px; line-height:2; color:var(--text-sub); padding-bottom:60px">' +
            escaped + '</div></div>';
        injectStyles();
        return;
    }

    // No lyrics state — could be loading or not found
    if (!currentTrack) return;

    container.innerHTML = '<div style="max-width:600px; margin:0 auto">' + header +
        '<div style="text-align:center; padding:40px 20px; color:var(--text-sub)">' +
        '<i class="fas fa-search" style="font-size:32px; opacity:0.2; display:block; margin-bottom:12px"></i>' +
        '<div style="font-size:14px">No lyrics found for this track</div>' +
        '<div style="font-size:11px; margin-top:8px; opacity:0.5">Powered by LRCLIB</div>' +
        '</div></div>';
    injectStyles();
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent = '.lyric-active { color: var(--accent) !important; transform: scale(1.08); filter: brightness(1.3); }' +
        '.lyric-line:hover { color: var(--text-main) !important; }';
    document.head.appendChild(style);
}
