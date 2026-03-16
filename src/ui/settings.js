import { state } from '../state.js';
import { saveConfig } from '../config.js';
import { events } from '../events.js';
import { setTheme } from './themes.js';
import { setViewMode } from './views.js';
import { updateLoopUI, updateShuffleUI } from './player.js';
import { renderRecentlyPlayed } from './recent.js';
import { updateQueueUI } from './queue.js';
import { getAudio } from '../audio.js';
import { getExtensions, enableExtension, disableExtension } from '../extensions/manager.js';

export function initSettings() {
    document.getElementById('btn-export-json').onclick = () => {
        const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'openify_preferences.json';
        a.click();
    };

    document.getElementById('config-in').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const loaded = JSON.parse(ev.target.result);
                state.config = Object.assign({}, state.config, loaded);
                setTheme(state.config.theme);
                setViewMode(state.config.viewMode);
                getAudio().volume = state.config.volume;
                updateLoopUI();
                updateShuffleUI();
                renderRecentlyPlayed();
                updateQueueUI();
                saveConfig();
                alert('Preferences Restored!');
            } catch (err) {
                alert('Invalid Config File');
            }
        };
        reader.readAsText(file);
    };

    // Extensions UI
    events.on('extensionsReady', () => renderExtensionsUI());
    events.on('extensionsChanged', () => renderExtensionsUI());
}

function renderExtensionsUI() {
    const container = document.getElementById('ext-manager-container');
    if (!container) return;

    // If better-extensions has injected its UI, don't overwrite it
    if (document.getElementById('bext-root')) return;

    const exts = getExtensions();
    container.innerHTML = '';

    if (exts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-sub); font-size:13px">No extensions installed. Place extension folders in the extensions directory.</p>';
        return;
    }

    // Build a name lookup for dependency display
    const nameMap = {};
    exts.forEach(e => { nameMap[e.id] = e.name; });

    exts.forEach(ext => {
        const card = document.createElement('div');
        card.className = 'ext-card';

        const statusColor = ext.status === 'enabled' ? 'var(--accent)' : (ext.status === 'error' ? '#ff4d4d' : 'var(--text-sub)');
        const statusLabel = ext.status === 'enabled' ? 'Enabled' : (ext.status === 'error' ? 'Error' : 'Disabled');
        const isEnabled = ext.status === 'enabled';

        // Dependency tags
        let depsHtml = '';
        if (ext.requires && ext.requires.length > 0) {
            depsHtml += '<div class="ext-card-deps" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px">' +
                '<span style="font-size:10px; color:var(--text-sub); font-weight:700; margin-right:2px">Requires:</span>' +
                ext.requires.map(dep => {
                    const depName = nameMap[dep] || dep;
                    const depExt = exts.find(e => e.id === dep);
                    const depOk = depExt && depExt.status === 'enabled';
                    const color = depOk ? 'var(--accent)' : '#ff4d4d';
                    return `<span class="ext-perm-tag" style="border-color:${color}; color:${color}">${depName}</span>`;
                }).join('') +
                '</div>';
        }
        if (ext.dependents && ext.dependents.length > 0) {
            depsHtml += '<div class="ext-card-deps" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px">' +
                '<span style="font-size:10px; color:var(--text-sub); font-weight:700; margin-right:2px">Used by:</span>' +
                ext.dependents.map(dep => {
                    const depName = nameMap[dep] || dep;
                    return `<span class="ext-perm-tag" style="border-color:var(--text-sub)">${depName}</span>`;
                }).join('') +
                '</div>';
        }

        card.innerHTML = `
            <div class="ext-card-header">
                <div class="ext-card-info">
                    <div class="ext-card-name">${ext.name} <span class="ext-card-version">v${ext.version}</span></div>
                    <div class="ext-card-author">by ${ext.author}</div>
                    <div class="ext-card-desc">${ext.description}</div>
                    ${ext.error ? `<div class="ext-card-error">${ext.error}</div>` : ''}
                    ${depsHtml}
                </div>
                <div class="ext-card-actions">
                    <span class="ext-badge" style="color:${statusColor}; border-color:${statusColor}">${statusLabel}</span>
                    <label class="ext-toggle">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''}>
                        <span class="ext-toggle-slider"></span>
                    </label>
                </div>
            </div>
            <div class="ext-card-perms">
                ${(ext.permissions || []).map(p => `<span class="ext-perm-tag">${p}</span>`).join('')}
            </div>
        `;

        const toggle = card.querySelector('input[type="checkbox"]');
        toggle.onchange = async () => {
            toggle.disabled = true;
            if (toggle.checked) {
                await enableExtension(ext.id);
            } else {
                await disableExtension(ext.id);
            }
            toggle.disabled = false;
        };

        container.appendChild(card);
    });
}
