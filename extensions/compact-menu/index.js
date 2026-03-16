var api = null;
var observer = null;
var compactEl = null;

module.exports = {
    init(_api) {
        api = _api;
        apply();

        // Re-apply when extensions change (new sidebar items may appear)
        api.events.on('extensionsChanged', apply);
        api.events.on('extensionsReady', apply);

        // Watch for DOM changes in the panel (extension nav items are added dynamically)
        var panel = getNavPanel();
        if (panel) {
            observer = new MutationObserver(function() { apply(); });
            observer.observe(panel, { childList: true });
        }

        return module.exports;
    },

    disable: function() {
        restore();
        if (observer) { observer.disconnect(); observer = null; }
    },

    destroy: function() {
        restore();
        if (observer) { observer.disconnect(); observer = null; }
        api = null;
    }
};

function getNavPanel() {
    return document.querySelector('.sidebar .side-panel');
}

function apply() {
    var panel = getNavPanel();
    if (!panel) return;

    // Collect all items to show: logo, built-in navs, extension navs
    var items = [];

    // Logo
    var logo = panel.querySelector('.logo-container');
    var logoImg = logo ? logo.querySelector('.logo-img') : null;
    var logoSrc = logoImg ? logoImg.src : null;

    // Built-in nav items (Home, Settings)
    var builtIns = panel.querySelectorAll('.nav-item:not([data-ext])');
    builtIns.forEach(function(nav) {
        var icon = nav.querySelector('i');
        var iconClass = icon ? icon.className : 'fas fa-circle';
        var label = nav.textContent.trim();
        var id = nav.id || '';
        var isActive = nav.classList.contains('active');
        items.push({
            type: 'builtin',
            iconClass: iconClass,
            label: label,
            id: id,
            isActive: isActive,
            el: nav
        });
    });

    // Extension nav items
    var extNavs = panel.querySelectorAll('.nav-item[data-ext]');
    extNavs.forEach(function(nav) {
        var icon = nav.querySelector('i');
        var iconClass = icon ? icon.className : 'fas fa-puzzle-piece';
        var label = nav.textContent.trim();
        var extId = nav.getAttribute('data-ext');
        var isActive = nav.classList.contains('active');
        items.push({
            type: 'ext',
            iconClass: iconClass,
            label: label,
            extId: extId,
            isActive: isActive,
            el: nav
        });
    });

    // Hide originals
    if (logo) logo.style.display = 'none';
    builtIns.forEach(function(n) { n.style.display = 'none'; });
    extNavs.forEach(function(n) { n.style.display = 'none'; });

    // Build or update compact grid
    if (!compactEl) {
        compactEl = document.createElement('div');
        compactEl.id = 'compact-menu-grid';
        // Insert at top of panel
        panel.insertBefore(compactEl, panel.firstChild);
    }

    var html = '';

    // Logo row (small)
    if (logoSrc) {
        html += '<div class="cm-logo" id="cm-logo-btn" style="display:flex; align-items:center; justify-content:center; margin-bottom:8px; cursor:pointer">' +
            '<img src="' + logoSrc + '" style="width:28px; height:28px">' +
            '</div>';
    }

    // Icon grid
    html += '<div class="cm-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(40px, 1fr)); gap:4px">';

    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var activeClass = it.isActive ? ' cm-active' : '';
        var dataAttr = it.type === 'ext'
            ? 'data-ext="' + it.extId + '"'
            : 'data-id="' + it.id + '"';

        html += '<div class="cm-btn' + activeClass + '" ' + dataAttr + ' title="' + escAttr(it.label) + '" style="' +
            'display:flex; align-items:center; justify-content:center; width:40px; height:40px; ' +
            'border-radius:10px; cursor:pointer; transition:all 0.2s; position:relative; ' +
            'background:' + (it.isActive ? 'var(--accent)' : 'transparent') + '; ' +
            'color:' + (it.isActive ? '#fff' : 'var(--text-sub)') + '; font-size:15px">' +
            '<i class="' + it.iconClass + '"></i>' +
            '</div>';
    }

    html += '</div>';

    compactEl.innerHTML = html;

    // Bind logo click
    var cmLogo = compactEl.querySelector('#cm-logo-btn');
    if (cmLogo) {
        var origLogoBtn = document.getElementById('logo-btn');
        cmLogo.onclick = function() {
            if (origLogoBtn && origLogoBtn.onclick) origLogoBtn.onclick();
        };
    }

    // Bind button clicks — trigger original element's onclick
    var btns = compactEl.querySelectorAll('.cm-btn');
    for (var b = 0; b < btns.length; b++) {
        (function(btn) {
            btn.onclick = function() {
                var extId = btn.getAttribute('data-ext');
                var navId = btn.getAttribute('data-id');
                var target = null;

                if (extId) {
                    target = panel.querySelector('.nav-item[data-ext="' + extId + '"]');
                } else if (navId) {
                    target = document.getElementById(navId);
                }

                if (target && target.onclick) {
                    target.onclick();
                } else if (target) {
                    target.click();
                }

                // Update active states after a tick
                setTimeout(updateActiveStates, 50);
            };
        })(btns[b]);
    }

    // Reduce panel padding for compact look
    panel.style.padding = '10px 8px';

    injectStyles();
}

function updateActiveStates() {
    if (!compactEl) return;
    var panel = getNavPanel();
    if (!panel) return;

    var btns = compactEl.querySelectorAll('.cm-btn');
    for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var extId = btn.getAttribute('data-ext');
        var navId = btn.getAttribute('data-id');
        var target = null;

        if (extId) {
            target = panel.querySelector('.nav-item[data-ext="' + extId + '"]');
        } else if (navId) {
            target = document.getElementById(navId);
        }

        var isActive = target ? target.classList.contains('active') : false;
        btn.style.background = isActive ? 'var(--accent)' : 'transparent';
        btn.style.color = isActive ? '#fff' : 'var(--text-sub)';
        if (isActive) {
            btn.classList.add('cm-active');
        } else {
            btn.classList.remove('cm-active');
        }
    }
}

function restore() {
    var panel = getNavPanel();
    if (!panel) return;

    // Show originals
    var logo = panel.querySelector('.logo-container');
    if (logo) logo.style.display = '';

    panel.querySelectorAll('.nav-item').forEach(function(n) {
        n.style.display = '';
    });

    // Remove compact grid
    if (compactEl) {
        compactEl.remove();
        compactEl = null;
    }

    // Restore panel padding
    panel.style.padding = '';
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
        '.cm-btn:hover { background: var(--bg-card-hover) !important; color: var(--text-main) !important; transform: scale(1.1); }' +
        '.cm-btn.cm-active:hover { background: var(--accent) !important; color: #fff !important; filter: brightness(1.15); }' +
        '.cm-btn { transition: all 0.15s ease !important; }' +
        '.cm-logo:hover { transform: scale(1.08); }' +
        '.cm-logo { transition: transform 0.15s; }';
    document.head.appendChild(style);
}
