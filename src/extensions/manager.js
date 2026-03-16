import { validateManifest } from './manifest.js';
import { createExtensionAPI } from './api.js';
import { initExtensionDB } from './storage.js';
import { loadModuleFromSource, loadModuleFromFunction } from './loader.js';
import { removeAllForExtension } from './ui-registry.js';
import { removeAllThemesForExtension } from './theme-registry.js';
import { events } from '../events.js';

const extensions = new Map();
const CONFIG_KEY = 'openify_extensions';

function loadExtensionConfig() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch {
        return {};
    }
}

function saveExtensionConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function initExtensionManager() {
    await initExtensionDB();
    await discoverBundledExtensions();

    // Resolve enable order via topological sort (dependencies first)
    const config = loadExtensionConfig();
    const enableOrder = getEnableOrder();

    for (const id of enableOrder) {
        if (config[id]?.enabled !== false) {
            await enableExtension(id);
        }
    }

    events.emit('extensionsReady');
}

async function discoverBundledExtensions() {
    const bundledExtensions = [
        'sample-now-playing',
        'sample-neon-theme',
        'lyrics',
        'better-folders',
        'better-home',
        'visualizer',
        'theme-festival',
        'compact-menu',
        'better-topbar',
        'better-layouts',
        'better-ui',
        'better-lyrics',
        'better-library',
        'better-visualizer',
        'better-extensions',
        'better-themes',
        'yt-dlp',
    ];

    for (const name of bundledExtensions) {
        try {
            const resp = await fetch(`/extensions/${name}/extension.json`);
            if (!resp.ok) continue;
            const manifest = await resp.json();
            const { valid, errors } = validateManifest(manifest);
            if (!valid) {
                console.warn(`Invalid bundled extension "${name}":`, errors);
                continue;
            }
            extensions.set(manifest.id, {
                manifest,
                dirPath: `/extensions/${name}`,
                status: 'loaded',
                instance: null,
                api: null,
                eventSubscriptions: new Set(),
                uiRegistrations: new Set(),
                themeRegistrations: new Set(),
                error: null,
            });
        } catch {}
    }
}

// --- Dependency resolution ---

function getRequires(extensionId) {
    const record = extensions.get(extensionId);
    if (!record) return [];
    return record.manifest.requires || [];
}

function getDependents(extensionId) {
    // Find all extensions that require this one
    const dependents = [];
    for (const [id, record] of extensions) {
        const requires = record.manifest.requires || [];
        if (requires.includes(extensionId)) {
            dependents.push(id);
        }
    }
    return dependents;
}

function getEnableOrder() {
    // Topological sort — dependencies come before dependents
    const visited = new Set();
    const order = [];

    function visit(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const record = extensions.get(id);
        if (!record) return;
        for (const dep of (record.manifest.requires || [])) {
            visit(dep);
        }
        order.push(id);
    }

    for (const [id] of extensions) {
        visit(id);
    }

    return order;
}

function checkCircularDeps(extensionId, chain = []) {
    if (chain.includes(extensionId)) {
        return [...chain, extensionId];
    }
    const requires = getRequires(extensionId);
    for (const dep of requires) {
        const circular = checkCircularDeps(dep, [...chain, extensionId]);
        if (circular) return circular;
    }
    return null;
}

function getMissingDeps(extensionId) {
    const requires = getRequires(extensionId);
    return requires.filter(dep => !extensions.has(dep));
}

// --- Module loading ---

async function loadExtensionModule(record) {
    const mainFile = record.manifest.main || 'index.js';
    const resp = await fetch(`${record.dirPath}/${mainFile}`);
    if (!resp.ok) throw new Error(`Failed to fetch ${record.dirPath}/${mainFile}`);
    const source = await resp.text();

    try {
        return await loadModuleFromSource(source, record.manifest.id);
    } catch {
        return await loadModuleFromFunction(source);
    }
}

// --- Enable / Disable ---

export async function enableExtension(extensionId) {
    const record = extensions.get(extensionId);
    if (!record) throw new Error(`Extension "${extensionId}" not found`);

    if (record.status === 'enabled') return;

    // Check for circular dependencies
    const circular = checkCircularDeps(extensionId);
    if (circular) {
        record.status = 'error';
        record.error = `Circular dependency: ${circular.join(' → ')}`;
        events.emit('extensionsChanged');
        return;
    }

    // Check for missing dependencies
    const missing = getMissingDeps(extensionId);
    if (missing.length > 0) {
        record.status = 'error';
        record.error = `Missing dependencies: ${missing.join(', ')}`;
        events.emit('extensionsChanged');
        return;
    }

    // Enable dependencies first
    const requires = getRequires(extensionId);
    for (const depId of requires) {
        const depRecord = extensions.get(depId);
        if (!depRecord) {
            record.status = 'error';
            record.error = `Required extension "${depId}" not found`;
            events.emit('extensionsChanged');
            return;
        }
        if (depRecord.status !== 'enabled') {
            try {
                await enableExtension(depId);
            } catch (e) {
                record.status = 'error';
                record.error = `Failed to enable dependency "${depId}": ${e.message}`;
                events.emit('extensionsChanged');
                return;
            }
            if (depRecord.status !== 'enabled') {
                record.status = 'error';
                record.error = `Dependency "${depId}" could not be enabled`;
                events.emit('extensionsChanged');
                return;
            }
        }
    }

    try {
        record.api = createExtensionAPI(extensionId, record.manifest.permissions || [], record);

        if (record.instance && typeof record.instance.enable === 'function') {
            await record.instance.enable(record.api);
        } else {
            record.instance = null;
            const mod = await loadExtensionModule(record);
            if (typeof mod.init === 'function') {
                record.instance = await mod.init(record.api) || mod;
            } else {
                record.instance = mod;
            }
        }

        record.status = 'enabled';
        record.error = null;
    } catch (e) {
        record.status = 'error';
        record.error = e.message || String(e);
        console.error(`Failed to enable extension "${extensionId}":`, e);
    }

    const config = loadExtensionConfig();
    config[extensionId] = { enabled: record.status === 'enabled' };
    saveExtensionConfig(config);
    events.emit('extensionsChanged');
}

export async function disableExtension(extensionId) {
    const record = extensions.get(extensionId);
    if (!record || record.status !== 'enabled') return;

    // Cascade: disable extensions that depend on this one first
    const dependents = getDependents(extensionId);
    for (const depId of dependents) {
        const depRecord = extensions.get(depId);
        if (depRecord && depRecord.status === 'enabled') {
            await disableExtension(depId);
        }
    }

    try {
        if (record.instance && typeof record.instance.disable === 'function') {
            await record.instance.disable();
        }
    } catch (e) {
        console.error(`Error disabling extension "${extensionId}":`, e);
    }

    // Force cleanup all event subscriptions
    for (const sub of record.eventSubscriptions) {
        events.off(sub.event, sub.fn);
    }
    record.eventSubscriptions.clear();

    // Force cleanup all UI registrations
    removeAllForExtension(extensionId);

    // Force cleanup all theme registrations
    removeAllThemesForExtension(extensionId);

    record.status = 'disabled';

    const config = loadExtensionConfig();
    config[extensionId] = { enabled: false };
    saveExtensionConfig(config);
    events.emit('extensionsChanged');
}

export async function unloadExtension(extensionId) {
    const record = extensions.get(extensionId);
    if (!record) return;

    if (record.status === 'enabled') await disableExtension(extensionId);

    try {
        if (record.instance && typeof record.instance.destroy === 'function') {
            await record.instance.destroy();
        }
    } catch (e) {
        console.error(`Error destroying extension "${extensionId}":`, e);
    }

    record.instance = null;
    record.api = null;
    extensions.delete(extensionId);
    events.emit('extensionsChanged');
}

export function getExtensions() {
    return [...extensions.entries()].map(([id, record]) => {
        const requires = record.manifest.requires || [];
        const dependents = getDependents(id);

        return Object.freeze({
            id,
            name: record.manifest.name,
            version: record.manifest.version,
            description: record.manifest.description || '',
            author: record.manifest.author || 'Unknown',
            permissions: record.manifest.permissions || [],
            requires,
            dependents,
            status: record.status,
            error: record.error,
            icon: record.manifest.icon,
        });
    });
}
