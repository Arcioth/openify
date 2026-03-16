import { state } from '../state.js';
import { saveConfig } from '../config.js';
import { events } from '../events.js';
import { getAllThemes } from '../extensions/theme-registry.js';

export function initThemes() {
    populateThemePicker();
    events.on('extensionsChanged', () => populateThemePicker());
}

export function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    state.config.theme = theme;
    saveConfig();
    populateThemePicker();
    events.emit('themeChange', theme);
}

export function populateThemePicker() {
    const container = document.getElementById('theme-picker-container');
    // If better-themes has injected its UI, don't overwrite it
    if (document.getElementById('btheme-root')) return;
    container.innerHTML = '';
    getAllThemes().forEach(t => {
        const opt = document.createElement('div');
        opt.className = `theme-option ${state.config.theme === t.id ? 'active' : ''}`;
        opt.style.background = t.color;
        opt.title = t.label;
        opt.onclick = () => setTheme(t.id);
        container.appendChild(opt);
    });
}
