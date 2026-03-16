var api = null;
var styleEl = null;

module.exports = {
    init(_api) {
        api = _api;
        injectStyles();

        api.events.on('trackChange', onTrackChange);
        api.events.on('playbackStateChange', onPlaybackState);

        return module.exports;
    },

    disable: function() {
        removeStyles();
        removeGlow();
    },

    destroy: function() {
        removeStyles();
        removeGlow();
        api = null;
    }
};

function onTrackChange(idx, song) {
    updateArtGlow(song);
    pulsePlayBtn();
}

function onPlaybackState(playing) {
    var playBtn = document.querySelector('.play-btn');
    if (!playBtn) return;
    if (playing) {
        playBtn.classList.add('bui-playing');
    } else {
        playBtn.classList.remove('bui-playing');
    }
}

// --- Artwork glow on player bar ---

function updateArtGlow(song) {
    var pArt = document.getElementById('p-art');
    if (!pArt) return;

    // Remove old glow
    removeGlow();

    if (song && song.artwork) {
        // Extract a color hint from the artwork using a tiny canvas
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            try {
                var c = document.createElement('canvas');
                c.width = 1; c.height = 1;
                var ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, 1, 1);
                var d = ctx.getImageData(0, 0, 1, 1).data;
                var color = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
                pArt.style.boxShadow = '0 4px 24px ' + color + ', 0 0 60px rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ', 0.3)';
                pArt.setAttribute('data-bui-glow', '1');
            } catch(e) {}
        };
        img.src = song.artwork;
    }
}

function removeGlow() {
    var pArt = document.getElementById('p-art');
    if (pArt && pArt.getAttribute('data-bui-glow')) {
        pArt.style.boxShadow = '';
        pArt.removeAttribute('data-bui-glow');
    }
}

function pulsePlayBtn() {
    var btn = document.querySelector('.play-btn');
    if (!btn) return;
    btn.classList.add('bui-pulse');
    setTimeout(function() { btn.classList.remove('bui-pulse'); }, 400);
}

// --- Styles ---

function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'bui-styles';
    styleEl.textContent = getCss();
    document.head.appendChild(styleEl);
}

function removeStyles() {
    if (styleEl) { styleEl.remove(); styleEl = null; }
}

function getCss() {
    return [

        // --- Scrollbars ---
        '::-webkit-scrollbar { width: 6px; height: 6px; }',
        '::-webkit-scrollbar-track { background: transparent; }',
        '::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }',
        '::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }',
        '* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }',

        // --- Smoother transitions ---
        '.nav-item, .playlist-item, .song-row, .q-item, .ctx-item, .ext-card, .recent-card {',
        '  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;',
        '}',

        // --- Song row enhancements ---
        '.song-row:hover {',
        '  background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)) !important;',
        '  border-radius: 8px;',
        '}',
        '.song-row.active {',
        '  background: linear-gradient(90deg, rgba(var(--accent-rgb, 29,185,84), 0.12), transparent) !important;',
        '  border-radius: 8px;',
        '}',

        // --- Player bar ---
        '.player-bar {',
        '  background: linear-gradient(180deg, rgba(18,18,18,0.95), rgba(0,0,0,1)) !important;',
        '  border-top: 1px solid rgba(255,255,255,0.05) !important;',
        '}',
        '.p-art {',
        '  border-radius: 8px !important;',
        '  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;',
        '}',
        '.p-art:hover { transform: scale(1.06); }',

        // --- Play button polish ---
        '.play-btn {',
        '  box-shadow: 0 2px 12px rgba(255,255,255,0.15);',
        '  transition: all 0.15s ease !important;',
        '}',
        '.play-btn:hover {',
        '  box-shadow: 0 4px 20px var(--accent) !important;',
        '  transform: scale(1.12) !important;',
        '}',
        '@keyframes bui-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }',
        '.bui-pulse { animation: bui-pulse 0.35s ease !important; }',
        '.bui-playing { box-shadow: 0 0 16px var(--accent), 0 2px 12px rgba(255,255,255,0.15) !important; }',

        // --- Slider improvements ---
        '.slider-fill {',
        '  transition: width 0.1s linear;',
        '  box-shadow: 0 0 6px rgba(255,255,255,0.1);',
        '}',
        '.custom-slider:hover .slider-fill {',
        '  box-shadow: 0 0 10px var(--accent) !important;',
        '}',
        '.slider-thumb { transition: opacity 0.15s, transform 0.15s !important; }',
        '.custom-slider:hover .slider-thumb { transform: translate(-50%, -50%) scale(1.3) !important; }',

        // --- Context menu ---
        '#ctx {',
        '  background: rgba(30,30,30,0.95) !important;',
        '  backdrop-filter: blur(20px) !important;',
        '  border: 1px solid rgba(255,255,255,0.08) !important;',
        '  border-radius: 10px !important;',
        '  padding: 6px !important;',
        '  box-shadow: 0 16px 48px rgba(0,0,0,0.6) !important;',
        '}',
        '.ctx-item {',
        '  border-radius: 6px !important;',
        '  padding: 9px 14px !important;',
        '  font-size: 13px !important;',
        '  gap: 10px !important;',
        '  transition: all 0.15s !important;',
        '}',
        '.ctx-item:hover {',
        '  background: rgba(255,255,255,0.08) !important;',
        '  transform: translateX(2px);',
        '}',
        '.ctx-item i { width: 16px; text-align: center; }',

        // --- Queue sidebar ---
        '.queue-sidebar {',
        '  background: linear-gradient(180deg, var(--bg-main), rgba(0,0,0,0.3)) !important;',
        '  border-left: 1px solid rgba(255,255,255,0.04) !important;',
        '}',
        '.q-item:hover {',
        '  background: rgba(255,255,255,0.06) !important;',
        '  border-radius: 8px !important;',
        '}',
        '.q-item.manual {',
        '  border-left: 2px solid var(--accent) !important;',
        '  background: rgba(255,255,255,0.03) !important;',
        '  border-radius: 0 8px 8px 0 !important;',
        '}',

        // --- Sidebar polish ---
        '.side-panel {',
        '  border: 1px solid rgba(255,255,255,0.03);',
        '}',
        '.nav-item:hover {',
        '  transform: translateX(3px) !important;',
        '  filter: none !important;',
        '}',
        '.nav-item.active {',
        '  transform: none !important;',
        '  filter: none !important;',
        '  border-left: 3px solid var(--accent);',
        '  padding-left: 9px;',
        '}',

        // --- Playlist items ---
        '.playlist-item:hover {',
        '  transform: none !important;',
        '  filter: none !important;',
        '  background: rgba(255,255,255,0.05) !important;',
        '}',
        '.playlist-item.active .folder-icon {',
        '  background: var(--accent) !important;',
        '  color: #000 !important;',
        '}',

        // --- Header blur ---
        '.header {',
        '  backdrop-filter: blur(24px) saturate(1.5) !important;',
        '  background: rgba(18,18,18,0.6) !important;',
        '  border-bottom: 1px solid rgba(255,255,255,0.03);',
        '}',

        // --- Search polish ---
        '.search-container {',
        '  transition: all 0.2s !important;',
        '  border: 1px solid transparent;',
        '}',
        '.search-container:focus-within {',
        '  border-color: var(--accent) !important;',
        '  background: #1a1a1a !important;',
        '  box-shadow: 0 0 20px rgba(var(--accent-rgb, 29,185,84), 0.15);',
        '}',
        '.search-results-overlay {',
        '  backdrop-filter: blur(16px) !important;',
        '  border: 1px solid rgba(255,255,255,0.08) !important;',
        '  border-radius: 12px !important;',
        '  box-shadow: 0 16px 48px rgba(0,0,0,0.5) !important;',
        '}',

        // --- Banner art hover ---
        '.banner-art { transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important; }',
        '.banner-art:hover {',
        '  transform: scale(1.05) rotate(1deg) !important;',
        '  box-shadow: 0 16px 40px rgba(0,0,0,0.6);',
        '}',

        // --- Buttons ---
        '.btn-sync {',
        '  transition: all 0.2s !important;',
        '  box-shadow: 0 2px 10px rgba(0,0,0,0.2);',
        '}',
        '.btn-sync:hover {',
        '  box-shadow: 0 4px 20px var(--accent) !important;',
        '  transform: translateY(-1px) !important;',
        '}',

        // --- Theme picker ---
        '.theme-option {',
        '  transition: all 0.2s !important;',
        '}',
        '.theme-option:hover {',
        '  transform: scale(1.15) !important;',
        '}',

        // --- Extension cards ---
        '.ext-card {',
        '  transition: all 0.2s !important;',
        '}',
        '.ext-card:hover {',
        '  border-color: rgba(255,255,255,0.08) !important;',
        '  transform: translateY(-1px);',
        '  box-shadow: 0 4px 16px rgba(0,0,0,0.2);',
        '}',

        // --- View fade ---
        '@keyframes bui-fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }',
        '.view-section.active { animation: bui-fadeIn 0.25s ease !important; }',

        // --- Selection color ---
        '::selection { background: var(--accent); color: #000; }',

    ].join('\n');
}
