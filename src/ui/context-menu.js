import { state } from '../state.js';
import { play } from '../audio.js';
import { saveConfig } from '../config.js';
import { events } from '../events.js';

export function initContextMenu() {
    const ctxMenu = document.getElementById('ctx');

    window.addEventListener('click', () => { ctxMenu.style.display = 'none'; });

    document.getElementById('cx-play').onclick = () => play(state.ctxIdx);

    document.getElementById('cx-next').onclick = () => {
        state.manualQueue.unshift(state.allSongs[state.ctxIdx].filename);
        saveConfig();
        events.emit('queueChange');
    };

    document.getElementById('cx-add').onclick = () => {
        state.manualQueue.push(state.allSongs[state.ctxIdx].filename);
        saveConfig();
        events.emit('queueChange');
    };

    document.getElementById('cx-folder-add').onclick = () => {
        state.playlists[state.ctxFolder].forEach(s => state.manualQueue.push(s.filename));
        saveConfig();
        events.emit('queueChange');
    };

    document.getElementById('cx-clear').onclick = () => {
        state.manualQueue = [];
        saveConfig();
        events.emit('queueChange');
    };
}
