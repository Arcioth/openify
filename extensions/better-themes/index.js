var api = null;
var injected = false;
var observer = null;
var search = '';

module.exports = {
    init: function(_api) {
        api = _api;
        api.events.on('extensionsChanged', onExtChanged);
        api.events.on('themeChange', onThemeChange);
        setTimeout(function() { inject(); }, 120);
        return module.exports;
    },

    enable: function(_api) {
        api = _api;
        api.events.on('extensionsChanged', onExtChanged);
        api.events.on('themeChange', onThemeChange);
        setTimeout(function() { inject(); }, 120);
    },

    disable: function() {
        restore();
    },

    destroy: function() {
        restore();
        api = null;
    }
};

function onExtChanged() {
    if (injected) render();
}

function onThemeChange() {
    if (injected) render();
}

function restore() {
    var root = document.getElementById('btheme-root');
    if (root) root.remove();
    injected = false;
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    var style = document.getElementById('btheme-style');
    if (style) style.remove();
}

function inject() {
    var container = document.getElementById('theme-picker-container');
    if (!container) return;

    // Watch for settings view becoming visible
    var settingsView = document.getElementById('view-settings');
    if (settingsView && !observer) {
        observer = new MutationObserver(function() {
            if (settingsView.classList.contains('active') && !document.getElementById('btheme-root')) {
                inject();
            }
        });
        observer.observe(settingsView, { attributes: true, attributeFilter: ['class'] });
    }

    injected = true;
    container.innerHTML = '';

    var root = document.createElement('div');
    root.id = 'btheme-root';
    container.appendChild(root);

    injectStyles();
    render();
}

function getActiveTheme() {
    return document.body.getAttribute('data-theme') || 'openify';
}

function groupThemes() {
    var all = window.getAllThemes ? window.getAllThemes() : [];
    var builtIn = [];
    var extGroups = {};

    for (var i = 0; i < all.length; i++) {
        var t = all[i];
        if (t._extensionId) {
            var extId = t._extensionId;
            if (!extGroups[extId]) extGroups[extId] = [];
            extGroups[extId].push(t);
        } else {
            builtIn.push(t);
        }
    }

    return { builtIn: builtIn, extGroups: extGroups };
}

function getExtensionName(extId) {
    var exts = window.getExtensions ? window.getExtensions() : [];
    for (var i = 0; i < exts.length; i++) {
        if (exts[i].id === extId) return exts[i].name;
    }
    return extId;
}

function matchesSearch(theme) {
    if (!search) return true;
    var q = search.toLowerCase();
    return theme.label.toLowerCase().indexOf(q) !== -1 ||
           theme.id.toLowerCase().indexOf(q) !== -1;
}

function render() {
    var root = document.getElementById('btheme-root');
    if (!root) return;

    var groups = groupThemes();
    var active = getActiveTheme();

    var html = '';

    // Search bar
    html += '<div class="btheme-search-bar">' +
        '<i class="fas fa-search btheme-search-icon"></i>' +
        '<input type="text" id="btheme-search" class="btheme-search-input" placeholder="Search themes..." value="' + esc(search) + '">' +
        '</div>';

    // Active theme indicator
    var activeTheme = null;
    var all = window.getAllThemes ? window.getAllThemes() : [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].id === active) { activeTheme = all[i]; break; }
    }
    if (activeTheme) {
        html += '<div class="btheme-active-bar">' +
            '<span class="btheme-active-dot" style="background:' + esc(activeTheme.color) + '"></span>' +
            '<span class="btheme-active-label">Active: <strong>' + esc(activeTheme.label) + '</strong></span>' +
            '</div>';
    }

    // Built-in themes
    var filteredBuiltIn = groups.builtIn.filter(matchesSearch);
    if (filteredBuiltIn.length > 0) {
        html += renderGroup('Built-in Themes', 'fas fa-palette', filteredBuiltIn, active, filteredBuiltIn.length);
    }

    // Extension theme groups
    var extIds = Object.keys(groups.extGroups);
    for (var j = 0; j < extIds.length; j++) {
        var extId = extIds[j];
        var themes = groups.extGroups[extId].filter(matchesSearch);
        if (themes.length === 0) continue;
        var name = getExtensionName(extId);
        html += renderGroup(name, 'fas fa-puzzle-piece', themes, active, groups.extGroups[extId].length);
    }

    // No results
    var totalFiltered = filteredBuiltIn.length;
    for (var k = 0; k < extIds.length; k++) {
        totalFiltered += groups.extGroups[extIds[k]].filter(matchesSearch).length;
    }
    if (totalFiltered === 0) {
        html += '<div class="btheme-empty">' +
            '<i class="fas fa-search" style="font-size:24px; opacity:0.2; margin-bottom:8px"></i>' +
            '<div>No themes match "' + esc(search) + '"</div>' +
            '</div>';
    }

    root.innerHTML = html;

    // Bind search
    var searchInput = document.getElementById('btheme-search');
    if (searchInput) {
        searchInput.oninput = function() {
            search = searchInput.value;
            render();
        };
        // Preserve cursor position after re-render
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }

    // Bind theme clicks
    var cards = root.querySelectorAll('.btheme-card');
    for (var c = 0; c < cards.length; c++) {
        (function(card) {
            card.onclick = function() {
                var id = card.getAttribute('data-theme-id');
                if (id && window.setTheme) window.setTheme(id);
            };
        })(cards[c]);
    }
}

function renderGroup(title, icon, themes, active, totalCount) {
    var html = '<div class="btheme-group">';
    html += '<div class="btheme-group-header">' +
        '<i class="' + icon + ' btheme-group-icon"></i>' +
        '<span class="btheme-group-title">' + esc(title) + '</span>' +
        '<span class="btheme-group-count">' + totalCount + '</span>' +
        '</div>';

    html += '<div class="btheme-grid">';
    for (var i = 0; i < themes.length; i++) {
        var t = themes[i];
        var isActive = t.id === active;
        var colorStyle = '';
        // Handle gradient colors (like RGB theme)
        if (t.color && t.color.indexOf('gradient') !== -1) {
            colorStyle = 'background:' + t.color;
        } else {
            colorStyle = 'background:' + esc(t.color || '#888');
        }

        html += '<div class="btheme-card' + (isActive ? ' btheme-card-active' : '') + '" data-theme-id="' + esc(t.id) + '">' +
            '<div class="btheme-card-swatch" style="' + colorStyle + '">' +
            (isActive ? '<i class="fas fa-check btheme-card-check"></i>' : '') +
            '</div>' +
            '<div class="btheme-card-label">' + esc(t.label) + '</div>' +
            '</div>';
    }
    html += '</div></div>';
    return html;
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.id = 'btheme-style';
    style.textContent =
        '#btheme-root { font-family: var(--font-main, Inter, sans-serif); }' +

        '.btheme-search-bar { position:relative; margin-bottom:16px; }' +
        '.btheme-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-sub); font-size:13px; pointer-events:none; }' +
        '.btheme-search-input { width:100%; box-sizing:border-box; padding:10px 14px 10px 36px; background:var(--bg-card); border:1px solid rgba(255,255,255,0.06); border-radius:10px; color:var(--text-main); font-size:13px; outline:none; transition:border-color 0.2s; }' +
        '.btheme-search-input:focus { border-color:var(--accent); }' +
        '.btheme-search-input::placeholder { color:var(--text-sub); opacity:0.6; }' +

        '.btheme-active-bar { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--bg-card); border-radius:10px; margin-bottom:18px; border:1px solid rgba(255,255,255,0.04); }' +
        '.btheme-active-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; border:2px solid rgba(255,255,255,0.15); }' +
        '.btheme-active-label { font-size:13px; color:var(--text-sub); }' +
        '.btheme-active-label strong { color:var(--text-main); }' +

        '.btheme-group { margin-bottom:20px; }' +
        '.btheme-group-header { display:flex; align-items:center; gap:8px; margin-bottom:12px; }' +
        '.btheme-group-icon { font-size:12px; color:var(--accent); }' +
        '.btheme-group-title { font-size:12px; font-weight:700; color:var(--text-sub); text-transform:uppercase; letter-spacing:0.5px; }' +
        '.btheme-group-count { font-size:11px; color:var(--text-sub); opacity:0.5; margin-left:auto; }' +

        '.btheme-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:10px; }' +

        '.btheme-card { display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; padding:10px 6px; border-radius:10px; border:2px solid transparent; transition:all 0.2s ease; background:var(--bg-card); }' +
        '.btheme-card:hover { border-color:rgba(255,255,255,0.1); transform:translateY(-2px); background:var(--bg-card-hover); }' +
        '.btheme-card-active { border-color:var(--accent) !important; }' +

        '.btheme-card-swatch { width:42px; height:42px; border-radius:50%; border:2px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; transition:transform 0.2s; flex-shrink:0; }' +
        '.btheme-card:hover .btheme-card-swatch { transform:scale(1.1); }' +
        '.btheme-card-check { color:#fff; font-size:14px; text-shadow:0 1px 4px rgba(0,0,0,0.5); }' +

        '.btheme-card-label { font-size:11px; font-weight:600; color:var(--text-sub); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }' +
        '.btheme-card-active .btheme-card-label { color:var(--accent); }' +

        '.btheme-empty { text-align:center; padding:30px 20px; color:var(--text-sub); font-size:13px; display:flex; flex-direction:column; align-items:center; }';
    document.head.appendChild(style);
}
