import { state } from './state.js';
import { events } from './events.js';

export function saveConfig() {
    state.config.recent = state.recentlyPlayed;
    state.config.manualQueue = state.manualQueue;
    localStorage.setItem('openify_user_data', JSON.stringify(state.config));
    events.emit('configChange');
}

export function loadConfig() {
    const saved = localStorage.getItem('openify_user_data');
    if (saved) {
        const loaded = JSON.parse(saved);
        state.config = Object.assign({}, state.config, loaded);
        state.recentlyPlayed = state.config.recent || [];
        state.manualQueue = state.config.manualQueue || [];
    }
}
