import { THEMES } from '../state.js';

export const extensionThemes = [];
const styleElements = new Map();

export function registerTheme(extensionId, themeConfig) {
    const { id, label, color, cssVariables } = themeConfig;
    if (!id || !label || !cssVariables) throw new Error('Theme requires id, label, and cssVariables');

    // Build CSS rule from variables
    const vars = Object.entries(cssVariables).map(([k, v]) => `${k}: ${v};`).join(' ');
    const css = `[data-theme="${id}"] { ${vars} }`;

    // Inject style tag
    const style = document.createElement('style');
    style.setAttribute('data-ext-theme', id);
    style.textContent = css;
    document.head.appendChild(style);
    styleElements.set(id, style);

    // Add to extension themes list
    extensionThemes.push({ id, color: color || cssVariables['--accent'] || '#888', label, _extensionId: extensionId });

    return id;
}

export function unregisterTheme(themeId) {
    const style = styleElements.get(themeId);
    if (style) {
        style.remove();
        styleElements.delete(themeId);
    }
    const idx = extensionThemes.findIndex(t => t.id === themeId);
    if (idx !== -1) extensionThemes.splice(idx, 1);

    // If active theme was removed, fall back
    if (document.body.getAttribute('data-theme') === themeId) {
        document.body.setAttribute('data-theme', 'openify');
    }
}

export function removeAllThemesForExtension(extensionId) {
    const toRemove = extensionThemes.filter(t => t._extensionId === extensionId).map(t => t.id);
    toRemove.forEach(id => unregisterTheme(id));
}

export function getAllThemes() {
    return [...THEMES, ...extensionThemes];
}
