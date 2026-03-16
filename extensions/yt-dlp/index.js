var api = null;
var container = null;
var results = [];
var searching = false;
var searchError = null;
var searchTimeout = null;

module.exports = {
    init(_api) {
        api = _api;
        registerUI();
        injectStyles();
        return module.exports;
    },

    enable(_api) {
        api = _api;
        registerUI();
    },

    disable: function() {
        container = null;
        results = [];
        searching = false;
        searchError = null;
        if (searchTimeout) clearTimeout(searchTimeout);
    },

    destroy: function() {
        container = null;
        results = [];
        api = null;
        if (searchTimeout) clearTimeout(searchTimeout);
        var style = document.querySelector('style[data-ext="yt-dlp"]');
        if (style) style.remove();
    }
};

function registerUI() {
    api.ui.registerSidebarItem({
        id: 'yt-dlp',
        label: 'YouTube',
        icon: 'fab fa-youtube',
        order: 55,
        onClick: function(el) {
            container = el;
            render();
        }
    });
    api.ui.registerSettingsPanel({
        id: 'yt-dlp-settings',
        label: 'YouTube Music',
        render: renderSettings
    });
}

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

async function searchYouTube(query) {
    if (!query || !query.trim()) {
        results = [];
        searchError = null;
        render();
        return;
    }

    searching = true;
    searchError = null;
    render();

    try {
        var resp = await fetch('/yt-api/search?q=' + encodeURIComponent(query));
        if (!resp.ok) throw new Error('Search failed (status ' + resp.status + ')');
        var data = await resp.json();
        if (data.error) throw new Error(data.error);

        // yt-dlp flat-playlist items have: id, title, duration, channel, thumbnails[]
        results = (data.items || []).filter(function(item) {
            return item.duration > 0;
        }).map(function(item) {
            var thumb = '';
            if (item.thumbnails && item.thumbnails.length > 0) {
                thumb = item.thumbnails[item.thumbnails.length - 1].url;
            }
            return {
                id: item.id,
                title: item.title || 'Unknown',
                thumbnail: thumb,
                channel: item.channel || item.uploader || '',
                duration: item.duration || 0,
            };
        });

        if (results.length === 0) searchError = 'No results found';
    } catch (e) {
        console.warn('YouTube search failed:', e);
        results = [];
        searchError = 'Search failed: ' + (e.message || e);
    }

    searching = false;
    render();
}

async function playVideo(item, btnEl) {
    var videoId = item.id;
    if (!videoId) return;

    if (btnEl) {
        btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btnEl.disabled = true;
    }

    try {
        var resp = await fetch('/yt-api/streams/' + videoId);
        if (!resp.ok) {
            var errData = await resp.json().catch(function() { return {}; });
            throw new Error(errData.error || 'Failed to get stream');
        }
        // yt-dlp -f bestaudio -j returns: url (direct stream), title, duration, thumbnail, uploader
        var data = await resp.json();
        if (!data.url) throw new Error('No stream URL in response');

        var proxiedUrl = '/yt-api/proxy?url=' + encodeURIComponent(data.url);

        // Check if already in library
        var songs = api.library.getSongs();
        var existingIdx = -1;
        for (var i = 0; i < songs.length; i++) {
            if (songs[i].filename === 'yt:' + videoId) {
                existingIdx = i;
                break;
            }
        }

        if (existingIdx !== -1) {
            api.library.updateSong(existingIdx, { assetUrl: proxiedUrl });
            api.playback.play(existingIdx);
        } else {
            var idx = api.library.addSongs([{
                title: data.title || item.title || 'Unknown',
                folder: 'YouTube',
                filename: 'yt:' + videoId,
                duration: formatDuration(data.duration || item.duration),
                durSec: data.duration || item.duration || 0,
                artwork: data.thumbnail || item.thumbnail || null,
                assetUrl: proxiedUrl
            }]);
            api.playback.play(idx);
        }
    } catch (e) {
        console.error('Failed to play YouTube video:', e);
        showError('Failed to play: ' + (e.message || e));
    }

    if (btnEl) {
        btnEl.innerHTML = '<i class="fas fa-play"></i>';
        btnEl.disabled = false;
    }
}

function showError(msg) {
    if (!container) return;
    var existing = container.querySelector('.ytdlp-error');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'ytdlp-error';
    el.textContent = msg;
    el.style.cssText = 'color:#ff4444; padding:8px 16px; font-size:12px; text-align:center;';
    var wrap = container.querySelector('.ytdlp-wrap');
    if (wrap) wrap.insertBefore(el, wrap.children[1]);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 5000);
}

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function render() {
    if (!container) return;

    var html = '<div class="ytdlp-wrap">';

    html += '<div class="ytdlp-search-bar">' +
        '<div class="ytdlp-search-input-wrap">' +
        '<i class="fas fa-search ytdlp-search-icon"></i>' +
        '<input type="text" class="ytdlp-search-input" placeholder="Search YouTube..." />' +
        '</div></div>';

    if (searching) {
        html += '<div class="ytdlp-status">' +
            '<i class="fas fa-spinner fa-spin" style="font-size:24px; opacity:0.3; display:block; margin-bottom:12px"></i>' +
            '<div>Searching...</div></div>';
    } else if (results.length > 0) {
        html += '<div class="ytdlp-results">';
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var thumb = r.thumbnail || '';
            var title = escapeHtml(r.title);
            var channel = escapeHtml(r.channel);
            var dur = formatDuration(r.duration);

            html += '<div class="ytdlp-item" data-idx="' + i + '">' +
                '<div class="ytdlp-thumb">' +
                (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" />' : '<div class="ytdlp-thumb-ph"><i class="fas fa-music"></i></div>') +
                '<span class="ytdlp-dur">' + dur + '</span>' +
                '</div>' +
                '<div class="ytdlp-info">' +
                '<div class="ytdlp-title">' + title + '</div>' +
                '<div class="ytdlp-channel">' + channel + '</div>' +
                '</div>' +
                '<button class="ytdlp-play-btn" data-idx="' + i + '" title="Play">' +
                '<i class="fas fa-play"></i>' +
                '</button>' +
                '</div>';
        }
        html += '</div>';
    } else if (searchError) {
        html += '<div class="ytdlp-status">' +
            '<i class="fas fa-exclamation-triangle" style="font-size:32px; opacity:0.2; display:block; margin-bottom:12px"></i>' +
            '<div>' + escapeHtml(searchError) + '</div></div>';
    } else {
        html += '<div class="ytdlp-status">' +
            '<i class="fab fa-youtube" style="font-size:48px; opacity:0.15; display:block; margin-bottom:16px"></i>' +
            '<div>Search for music on YouTube</div>' +
            '<div style="font-size:11px; margin-top:8px; opacity:0.5">Powered by yt-dlp</div>' +
            '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    var input = container.querySelector('.ytdlp-search-input');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                if (searchTimeout) clearTimeout(searchTimeout);
                searchYouTube(input.value);
            }
        });
        input.addEventListener('input', function() {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                searchYouTube(input.value);
            }, 600);
        });
    }

    var playBtns = container.querySelectorAll('.ytdlp-play-btn');
    for (var j = 0; j < playBtns.length; j++) {
        (function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.getAttribute('data-idx'));
                if (results[idx]) playVideo(results[idx], btn);
            });
        })(playBtns[j]);
    }

    var items = container.querySelectorAll('.ytdlp-item');
    for (var k = 0; k < items.length; k++) {
        (function(item) {
            item.addEventListener('click', function() {
                var idx = parseInt(item.getAttribute('data-idx'));
                var btn = item.querySelector('.ytdlp-play-btn');
                if (results[idx]) playVideo(results[idx], btn);
            });
        })(items[k]);
    }
}

function renderSettings(el) {
    el.innerHTML = '<div style="padding:16px">' +
        '<div style="font-size:13px; font-weight:600; color:var(--text-main); margin-bottom:12px">YouTube Music</div>' +
        '<div style="font-size:12px; color:var(--text-sub); line-height:1.6">' +
        'Uses <strong style="color:var(--text-main)">yt-dlp</strong> running locally on the dev server to search and stream YouTube audio. ' +
        'Requires <code>yt-dlp</code> installed on your system.' +
        '</div>' +
        '<button id="ytdlp-check-btn" style="margin-top:12px; padding:6px 16px; background:var(--accent); ' +
        'color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600">Test yt-dlp</button>' +
        '<div id="ytdlp-check-result" style="margin-top:8px; font-size:12px; color:var(--text-sub)"></div>' +
        '</div>';

    el.querySelector('#ytdlp-check-btn').addEventListener('click', function() {
        var resultEl = el.querySelector('#ytdlp-check-result');
        resultEl.textContent = 'Testing...';
        resultEl.style.color = 'var(--text-sub)';
        fetch('/yt-api/search?q=test').then(function(r) {
            return r.json();
        }).then(function(data) {
            if (data.error) throw new Error(data.error);
            resultEl.style.color = 'var(--accent)';
            resultEl.textContent = 'yt-dlp is working! Found ' + (data.items || []).length + ' results.';
        }).catch(function(e) {
            resultEl.style.color = '#ff4444';
            resultEl.textContent = 'Error: ' + (e.message || e);
        });
    });
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.setAttribute('data-ext', 'yt-dlp');
    style.textContent = [
        '.ytdlp-wrap { height:100%; display:flex; flex-direction:column; }',
        '.ytdlp-search-bar { padding:16px; flex-shrink:0; }',
        '.ytdlp-search-input-wrap { position:relative; }',
        '.ytdlp-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-sub); font-size:13px; pointer-events:none; }',
        '.ytdlp-search-input { width:100%; padding:10px 12px 10px 36px; background:var(--bg-card); border:1px solid var(--bg-card-hover); border-radius:8px; color:var(--text-main); font-size:14px; outline:none; box-sizing:border-box; }',
        '.ytdlp-search-input:focus { border-color:var(--accent); }',
        '.ytdlp-search-input::placeholder { color:var(--text-sub); }',
        '.ytdlp-results { flex:1; overflow-y:auto; padding:0 8px 16px; }',
        '.ytdlp-item { display:flex; align-items:center; gap:12px; padding:8px; border-radius:8px; cursor:pointer; transition:background 0.15s; }',
        '.ytdlp-item:hover { background:var(--bg-card-hover); }',
        '.ytdlp-thumb { position:relative; width:80px; height:45px; flex-shrink:0; border-radius:6px; overflow:hidden; background:var(--bg-card); }',
        '.ytdlp-thumb img { width:100%; height:100%; object-fit:cover; }',
        '.ytdlp-thumb-ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-sub); }',
        '.ytdlp-dur { position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; }',
        '.ytdlp-info { flex:1; min-width:0; }',
        '.ytdlp-title { font-size:13px; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
        '.ytdlp-channel { font-size:11px; color:var(--text-sub); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
        '.ytdlp-play-btn { flex-shrink:0; width:32px; height:32px; border:none; border-radius:50%; background:var(--accent); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; transition:transform 0.15s, background 0.15s; opacity:0; }',
        '.ytdlp-item:hover .ytdlp-play-btn { opacity:1; }',
        '.ytdlp-play-btn:hover { transform:scale(1.1); background:var(--accent-hover); }',
        '.ytdlp-status { text-align:center; padding:80px 20px; color:var(--text-sub); font-size:14px; }'
    ].join('\n');
    document.head.appendChild(style);
}
