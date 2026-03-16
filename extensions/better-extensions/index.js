var api = null;
var styleEl = null;
var viewMode = 'normal'; // compact, normal, large
var searchText = '';
var injected = false;
var observer = null;

module.exports = {
    init: function(_api) {
        api = _api;
        loadSettings();
        api.events.on('extensionsChanged', onExtensionsChanged);
        api.events.on('extensionsReady', onExtensionsChanged);
        // Try to inject immediately and also when settings view opens
        setTimeout(tryInject, 200);
        watchSettingsView();
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

// --- Settings persistence ---

async function loadSettings() {
    if (!api) return;
    var stored = await api.storage.get('bextSettings');
    if (stored) {
        if (stored.viewMode) viewMode = stored.viewMode;
    }
}

function saveSettings() {
    if (!api) return;
    api.storage.set('bextSettings', { viewMode: viewMode });
}

// --- Watch for settings view becoming active ---

function watchSettingsView() {
    // Use MutationObserver on the settings view to detect when it becomes visible
    var settingsView = document.getElementById('view-settings');
    if (!settingsView) return;

    observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].attributeName === 'class') {
                if (settingsView.classList.contains('active')) {
                    setTimeout(tryInject, 50);
                }
            }
        }
    });
    observer.observe(settingsView, { attributes: true });
}

function onExtensionsChanged() {
    if (injected) render();
}

// --- Inject / Restore ---

function tryInject() {
    var container = document.getElementById('ext-manager-container');
    if (!container) return;

    // Only inject if we haven't already
    if (injected && document.getElementById('bext-root')) {
        render();
        return;
    }

    injected = true;

    // Clear the original extension manager content
    container.innerHTML = '';

    // Create our root
    var root = document.createElement('div');
    root.id = 'bext-root';
    container.appendChild(root);

    injectStyles();
    render();
}

function restore() {
    injected = false;

    if (observer) {
        observer.disconnect();
        observer = null;
    }

    // Remove our root - the original settings.js will re-render on next extensionsChanged
    var root = document.getElementById('bext-root');
    if (root) root.remove();

    if (styleEl) {
        styleEl.remove();
        styleEl = null;
    }
}

// --- Render ---

function render() {
    var root = document.getElementById('bext-root');
    if (!root || !window.getExtensions) return;

    var exts = window.getExtensions();
    var nameMap = {};
    exts.forEach(function(e) { nameMap[e.id] = e.name; });

    // Filter
    var visible = exts;
    if (searchText) {
        var q = searchText.toLowerCase();
        visible = exts.filter(function(e) {
            return e.name.toLowerCase().indexOf(q) !== -1 ||
                   e.description.toLowerCase().indexOf(q) !== -1 ||
                   e.id.toLowerCase().indexOf(q) !== -1 ||
                   e.author.toLowerCase().indexOf(q) !== -1;
        });
    }

    // Stats
    var enabledCount = exts.filter(function(e) { return e.status === 'enabled'; }).length;
    var errorCount = exts.filter(function(e) { return e.status === 'error'; }).length;

    var html = '';

    // Toolbar
    html += '<div class="bext-toolbar">';

    // Search
    html += '<div class="bext-search-wrap">' +
        '<i class="fas fa-search bext-search-icon"></i>' +
        '<input type="text" class="bext-search" placeholder="Search extensions..." value="' + esc(searchText) + '">' +
        '</div>';

    // View mode buttons
    html += '<div class="bext-view-modes">' +
        viewModeBtn('compact', 'fas fa-list', 'Compact') +
        viewModeBtn('normal', 'fas fa-th-large', 'Normal') +
        viewModeBtn('large', 'fas fa-square', 'Large') +
        '</div>';

    // Bulk actions
    html += '<div class="bext-bulk">' +
        '<button class="bext-bulk-btn bext-enable-all" title="Enable All"><i class="fas fa-toggle-on"></i> All On</button>' +
        '<button class="bext-bulk-btn bext-disable-all" title="Disable All"><i class="fas fa-toggle-off"></i> All Off</button>' +
        '</div>';

    html += '</div>'; // toolbar

    // Stats bar
    html += '<div class="bext-stats">' +
        '<span>' + exts.length + ' extensions</span>' +
        '<span class="bext-stats-dot" style="background:var(--accent)"></span>' +
        '<span>' + enabledCount + ' enabled</span>' +
        (errorCount > 0 ? '<span class="bext-stats-dot" style="background:#ff4d4d"></span><span style="color:#ff4d4d">' + errorCount + ' error' + (errorCount !== 1 ? 's' : '') + '</span>' : '') +
        '</div>';

    // Extension list
    html += '<div class="bext-list bext-view-' + viewMode + '">';

    for (var i = 0; i < visible.length; i++) {
        html += renderCard(visible[i], nameMap, exts);
    }

    if (visible.length === 0 && searchText) {
        html += '<div class="bext-empty"><i class="fas fa-search"></i> No extensions match "' + esc(searchText) + '"</div>';
    }

    html += '</div>';

    root.innerHTML = html;
    bindEvents(root, exts);
}

function renderCard(ext, nameMap, allExts) {
    var statusColor = ext.status === 'enabled' ? 'var(--accent)' : (ext.status === 'error' ? '#ff4d4d' : 'var(--text-sub)');
    var statusLabel = ext.status === 'enabled' ? 'Enabled' : (ext.status === 'error' ? 'Error' : 'Disabled');
    var isEnabled = ext.status === 'enabled';

    var html = '<div class="bext-card bext-status-' + ext.status + '" data-ext-id="' + esc(ext.id) + '">';

    // Icon area (for compact/normal shows a small icon, large shows bigger)
    var iconClass = ext.icon || 'fas fa-puzzle-piece';
    html += '<div class="bext-card-icon"><i class="' + iconClass + '"></i></div>';

    // Info
    html += '<div class="bext-card-info">';
    html += '<div class="bext-card-title">' + esc(ext.name) +
        '<span class="bext-card-ver">v' + esc(ext.version) + '</span></div>';

    // Author + description (hidden in compact)
    html += '<div class="bext-card-author">by ' + esc(ext.author) + '</div>';
    html += '<div class="bext-card-desc">' + esc(ext.description) + '</div>';

    // Error
    if (ext.error) {
        html += '<div class="bext-card-error"><i class="fas fa-exclamation-triangle"></i> ' + esc(ext.error) + '</div>';
    }

    // Dependencies
    if (ext.requires && ext.requires.length > 0) {
        html += '<div class="bext-card-deps">' +
            '<span class="bext-dep-label">Requires:</span>';
        for (var r = 0; r < ext.requires.length; r++) {
            var dep = ext.requires[r];
            var depName = nameMap[dep] || dep;
            var depExt = null;
            for (var d = 0; d < allExts.length; d++) {
                if (allExts[d].id === dep) { depExt = allExts[d]; break; }
            }
            var depOk = depExt && depExt.status === 'enabled';
            html += '<span class="bext-dep-tag" style="border-color:' + (depOk ? 'var(--accent)' : '#ff4d4d') +
                '; color:' + (depOk ? 'var(--accent)' : '#ff4d4d') + '">' + esc(depName) + '</span>';
        }
        html += '</div>';
    }
    if (ext.dependents && ext.dependents.length > 0) {
        html += '<div class="bext-card-deps">' +
            '<span class="bext-dep-label">Used by:</span>';
        for (var u = 0; u < ext.dependents.length; u++) {
            var depName2 = nameMap[ext.dependents[u]] || ext.dependents[u];
            html += '<span class="bext-dep-tag">' + esc(depName2) + '</span>';
        }
        html += '</div>';
    }

    // Permissions (large mode only, shown via CSS)
    if (ext.permissions && ext.permissions.length > 0) {
        html += '<div class="bext-card-perms">';
        for (var p = 0; p < ext.permissions.length; p++) {
            html += '<span class="bext-perm-tag">' + esc(ext.permissions[p]) + '</span>';
        }
        html += '</div>';
    }

    html += '</div>'; // info

    // Actions
    html += '<div class="bext-card-actions">' +
        '<span class="bext-badge" style="color:' + statusColor + '; border-color:' + statusColor + '">' + statusLabel + '</span>' +
        '<label class="ext-toggle">' +
        '<input type="checkbox" ' + (isEnabled ? 'checked' : '') + ' data-ext-toggle="' + esc(ext.id) + '">' +
        '<span class="ext-toggle-slider"></span>' +
        '</label>' +
        '</div>';

    html += '</div>'; // card
    return html;
}

// --- Event binding ---

function bindEvents(root, exts) {
    // Search
    var searchInput = root.querySelector('.bext-search');
    if (searchInput) {
        searchInput.oninput = function() {
            searchText = this.value;
            render();
            var newInput = document.querySelector('#bext-root .bext-search');
            if (newInput) {
                newInput.focus();
                newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
            }
        };
    }

    // View mode buttons
    var vmBtns = root.querySelectorAll('.bext-vm-btn');
    for (var v = 0; v < vmBtns.length; v++) {
        (function(btn) {
            btn.onclick = function() {
                viewMode = btn.getAttribute('data-mode');
                saveSettings();
                render();
            };
        })(vmBtns[v]);
    }

    // Enable all
    var enableAllBtn = root.querySelector('.bext-enable-all');
    if (enableAllBtn) {
        enableAllBtn.onclick = async function() {
            enableAllBtn.disabled = true;
            var ordered = getEnableOrder(exts);
            for (var i = 0; i < ordered.length; i++) {
                if (ordered[i].status !== 'enabled' && window.enableExtension) {
                    try { await window.enableExtension(ordered[i].id); } catch(e) {}
                }
            }
            enableAllBtn.disabled = false;
        };
    }

    // Disable all
    var disableAllBtn = root.querySelector('.bext-disable-all');
    if (disableAllBtn) {
        disableAllBtn.onclick = async function() {
            disableAllBtn.disabled = true;
            // Disable in reverse dependency order
            var ordered = getEnableOrder(exts).reverse();
            for (var i = 0; i < ordered.length; i++) {
                if (ordered[i].status === 'enabled' && window.disableExtension) {
                    // Don't disable ourselves
                    if (ordered[i].id === 'openify.better-extensions') continue;
                    try { await window.disableExtension(ordered[i].id); } catch(e) {}
                }
            }
            disableAllBtn.disabled = false;
        };
    }

    // Individual toggles
    var toggles = root.querySelectorAll('input[data-ext-toggle]');
    for (var t = 0; t < toggles.length; t++) {
        (function(toggle) {
            toggle.onchange = async function() {
                toggle.disabled = true;
                var id = toggle.getAttribute('data-ext-toggle');
                if (toggle.checked) {
                    if (window.enableExtension) await window.enableExtension(id);
                } else {
                    if (window.disableExtension) await window.disableExtension(id);
                }
                toggle.disabled = false;
            };
        })(toggles[t]);
    }
}

// Topological sort for enable order
function getEnableOrder(exts) {
    var visited = {};
    var order = [];
    var byId = {};
    exts.forEach(function(e) { byId[e.id] = e; });

    function visit(id) {
        if (visited[id]) return;
        visited[id] = true;
        var ext = byId[id];
        if (!ext) return;
        var deps = ext.requires || [];
        for (var i = 0; i < deps.length; i++) visit(deps[i]);
        order.push(ext);
    }

    exts.forEach(function(e) { visit(e.id); });
    return order;
}

// --- Helpers ---

function viewModeBtn(mode, icon, label) {
    var active = viewMode === mode;
    return '<button class="bext-vm-btn' + (active ? ' active' : '') + '" data-mode="' + mode + '" title="' + label + '">' +
        '<i class="' + icon + '"></i></button>';
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Styles ---

function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'bext-styles';
    styleEl.textContent = [

        // Toolbar
        '.bext-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }',
        '.bext-search-wrap { position:relative; flex:1; min-width:180px; }',
        '.bext-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-sub); font-size:12px; }',
        '.bext-search { width:100%; padding:8px 12px 8px 32px; background:var(--bg-card); border:1px solid rgba(255,255,255,0.06); border-radius:10px; color:var(--text-main); font-size:13px; outline:none; box-sizing:border-box; transition:border-color 0.2s; }',
        '.bext-search:focus { border-color:var(--accent); }',

        // View mode buttons
        '.bext-view-modes { display:flex; gap:4px; }',
        '.bext-vm-btn { width:32px; height:32px; border:1px solid rgba(255,255,255,0.06); border-radius:8px; background:var(--bg-card); color:var(--text-sub); cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }',
        '.bext-vm-btn:hover { background:var(--bg-card-hover); color:var(--text-main); }',
        '.bext-vm-btn.active { background:var(--accent); color:white; border-color:var(--accent); }',

        // Bulk buttons
        '.bext-bulk { display:flex; gap:6px; }',
        '.bext-bulk-btn { padding:6px 12px; border:1px solid rgba(255,255,255,0.06); border-radius:8px; background:var(--bg-card); color:var(--text-sub); cursor:pointer; font-size:11px; font-weight:600; transition:all 0.15s; white-space:nowrap; }',
        '.bext-bulk-btn:hover { background:var(--bg-card-hover); color:var(--text-main); }',
        '.bext-bulk-btn:disabled { opacity:0.4; cursor:not-allowed; }',
        '.bext-enable-all:hover { border-color:var(--accent); color:var(--accent); }',
        '.bext-disable-all:hover { border-color:#ff4d4d; color:#ff4d4d; }',

        // Stats
        '.bext-stats { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--text-sub); margin-bottom:12px; }',
        '.bext-stats-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }',

        // List container
        '.bext-list { display:flex; flex-direction:column; gap:8px; }',

        // Empty state
        '.bext-empty { text-align:center; padding:40px 20px; color:var(--text-sub); font-size:14px; }',
        '.bext-empty i { display:block; font-size:24px; opacity:0.3; margin-bottom:8px; }',

        // --- Card base ---
        '.bext-card { display:flex; align-items:flex-start; gap:12px; background:var(--bg-card); border-radius:12px; padding:14px 16px; border:1px solid transparent; transition:all 0.2s; }',
        '.bext-card:hover { border-color:rgba(255,255,255,0.08); }',
        '.bext-card.bext-status-enabled { border-left:3px solid var(--accent); }',
        '.bext-card.bext-status-error { border-left:3px solid #ff4d4d; }',

        '.bext-card-icon { width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.04); display:flex; align-items:center; justify-content:center; font-size:16px; color:var(--text-sub); flex-shrink:0; }',
        '.bext-status-enabled .bext-card-icon { color:var(--accent); background:rgba(var(--accent-rgb,29,185,84),0.1); }',

        '.bext-card-info { flex:1; overflow:hidden; min-width:0; }',
        '.bext-card-title { font-weight:700; font-size:14px; color:var(--text-main); }',
        '.bext-card-ver { font-size:10px; color:var(--text-sub); font-weight:400; margin-left:6px; }',
        '.bext-card-author { font-size:11px; color:var(--text-sub); margin-top:1px; }',
        '.bext-card-desc { font-size:12px; color:var(--text-sub); margin-top:4px; line-height:1.4; }',
        '.bext-card-error { font-size:11px; color:#ff4d4d; margin-top:6px; background:rgba(255,77,77,0.1); padding:4px 8px; border-radius:6px; }',
        '.bext-card-error i { margin-right:4px; }',

        '.bext-card-deps { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; align-items:center; }',
        '.bext-dep-label { font-size:10px; color:var(--text-sub); font-weight:700; margin-right:2px; }',
        '.bext-dep-tag { font-size:10px; padding:1px 6px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:var(--text-sub); }',

        '.bext-card-perms { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }',
        '.bext-perm-tag { font-size:9px; padding:1px 6px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:8px; color:var(--text-sub); }',

        '.bext-card-actions { display:flex; align-items:center; gap:10px; flex-shrink:0; }',
        '.bext-badge { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:2px 7px; border:1px solid; border-radius:10px; }',

        // --- COMPACT view ---
        '.bext-view-compact .bext-card { padding:8px 12px; align-items:center; gap:10px; border-radius:8px; }',
        '.bext-view-compact .bext-card-icon { width:28px; height:28px; font-size:12px; border-radius:6px; }',
        '.bext-view-compact .bext-card-title { font-size:13px; }',
        '.bext-view-compact .bext-card-author { display:none; }',
        '.bext-view-compact .bext-card-desc { display:none; }',
        '.bext-view-compact .bext-card-deps { display:none; }',
        '.bext-view-compact .bext-card-perms { display:none; }',
        '.bext-view-compact .bext-card-error { font-size:10px; padding:2px 6px; margin-top:3px; }',
        '.bext-view-compact .bext-badge { display:none; }',

        // --- NORMAL view (default) ---
        '.bext-view-normal .bext-card-perms { display:none; }',

        // --- LARGE view ---
        '.bext-view-large .bext-card { flex-direction:column; padding:20px; }',
        '.bext-view-large .bext-card-icon { width:48px; height:48px; font-size:22px; border-radius:12px; }',
        '.bext-view-large .bext-card-title { font-size:16px; }',
        '.bext-view-large .bext-card-desc { font-size:13px; margin-top:6px; }',
        '.bext-view-large .bext-card-actions { align-self:flex-end; margin-top:8px; }',

    ].join('\n');
    document.head.appendChild(styleEl);
}
