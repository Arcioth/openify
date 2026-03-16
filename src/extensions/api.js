import { events } from '../events.js';
import { state } from '../state.js';
import * as audio from '../audio.js';
import { extStorageGet, extStorageSet, extStorageRemove, extStorageGetAll } from './storage.js';
import {
    registerSidebarItem, unregisterSidebarItem,
    registerContextMenuItem, unregisterContextMenuItem,
    registerSettingsPanel, unregisterSettingsPanel,
    registerPlayerWidget, unregisterPlayerWidget,
} from './ui-registry.js';
import { registerTheme, unregisterTheme } from './theme-registry.js';

function freezeCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return Object.freeze(obj.map(item => freezeCopy(item)));
    const copy = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val !== 'function') copy[key] = val;
    }
    return Object.freeze(copy);
}

function copySong(s) {
    if (!s) return null;
    return Object.freeze({
        title: s.title,
        filename: s.filename,
        folder: s.folder,
        duration: s.duration,
        durSec: s.durSec,
        artwork: s.artwork,
        id: s.id,
    });
}

export function createExtensionAPI(extensionId, permissions, record) {
    const perms = new Set(permissions || []);
    const api = { openify: { version: '2.0.0', extensionId } };

    // --- Events ---
    if (perms.has('events:subscribe')) {
        api.events = {
            on(event, fn) {
                events.on(event, fn);
                record.eventSubscriptions.add({ event, fn });
            },
            off(event, fn) {
                events.off(event, fn);
                for (const sub of record.eventSubscriptions) {
                    if (sub.event === event && sub.fn === fn) {
                        record.eventSubscriptions.delete(sub);
                        break;
                    }
                }
            },
        };
        if (perms.has('events:emit')) {
            api.events.emit = (event, ...args) => {
                if (!event.startsWith(`ext:${extensionId}:`)) {
                    throw new Error(`Extensions can only emit events prefixed with "ext:${extensionId}:"`);
                }
                events.emit(event, ...args);
            };
        }
    }

    // --- Playback ---
    if (perms.has('playback:read') || perms.has('playback:control')) {
        api.playback = {
            getCurrentTrack() {
                if (state.currIdx < 0 || state.currIdx >= state.allSongs.length) return null;
                return copySong(state.allSongs[state.currIdx]);
            },
            getState() {
                const a = audio.getAudio();
                return Object.freeze({
                    playing: a ? !a.paused : false,
                    currentTime: a ? a.currentTime : 0,
                    duration: a ? a.duration || 0 : 0,
                    volume: a ? a.volume : 0,
                    muted: a ? a.muted : false,
                    loopMode: state.config.loopMode,
                    shuffleMode: state.config.shuffleMode,
                    currentIndex: state.currIdx,
                });
            },
        };
        if (perms.has('playback:control')) {
            Object.assign(api.playback, {
                play(idx) { audio.play(idx); },
                pause() { const a = audio.getAudio(); if (a && !a.paused) audio.togglePlayPause(); },
                next() { audio.next(); },
                prev() { audio.prev(); },
                seek(fraction) { audio.seek(fraction); },
                setVolume(v) { audio.setVolume(Math.max(0, Math.min(1, v))); },
            });
        }
    }

    // --- Library ---
    if (perms.has('library:read')) {
        api.library = {
            getSongs() {
                return state.allSongs.map(copySong);
            },
            getPlaylists() {
                return Object.freeze(
                    Object.keys(state.playlists).map(name => Object.freeze({
                        name,
                        count: state.playlists[name].length,
                    }))
                );
            },
            getPlaylistSongs(name) {
                const pl = state.playlists[name];
                if (!pl) return [];
                return pl.map(copySong);
            },
            getActivePlaylist() {
                return state.activePl;
            },
        };
    }

    // --- UI ---
    if (perms.has('ui:sidebar')) {
        api.ui = api.ui || {};
        api.ui.registerSidebarItem = (config) => registerSidebarItem(extensionId, config);
        api.ui.unregisterSidebarItem = (id) => unregisterSidebarItem(id);
    }
    if (perms.has('ui:contextMenu')) {
        api.ui = api.ui || {};
        api.ui.registerContextMenuItem = (config) => registerContextMenuItem(extensionId, config);
        api.ui.unregisterContextMenuItem = (id) => unregisterContextMenuItem(id);
    }
    if (perms.has('ui:settingsPanel')) {
        api.ui = api.ui || {};
        api.ui.registerSettingsPanel = (config) => registerSettingsPanel(extensionId, config);
        api.ui.unregisterSettingsPanel = (id) => unregisterSettingsPanel(id);
    }
    if (perms.has('ui:playerWidget')) {
        api.ui = api.ui || {};
        api.ui.registerPlayerWidget = (config) => registerPlayerWidget(extensionId, config);
        api.ui.unregisterPlayerWidget = (id) => unregisterPlayerWidget(id);
    }

    // --- Themes ---
    if (perms.has('themes:register')) {
        api.themes = {
            registerTheme: (config) => registerTheme(extensionId, config),
            unregisterTheme: (id) => unregisterTheme(id),
        };
    }

    // --- Storage ---
    if (perms.has('storage')) {
        api.storage = {
            get: (key) => extStorageGet(extensionId, key),
            set: (key, value) => extStorageSet(extensionId, key, value),
            remove: (key) => extStorageRemove(extensionId, key),
            getAll: () => extStorageGetAll(extensionId),
        };
    }

    return Object.freeze(api);
}
