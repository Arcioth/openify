import { state } from '../state.js';
import { events } from '../events.js';
import { play } from '../audio.js';
import { saveConfig } from '../config.js';

export function initQueue() {
    [document.getElementById('q-toggle-header'),
     document.getElementById('q-toggle-player'),
     document.getElementById('q-close')
    ].forEach(t => {
        if (t) t.onclick = () => document.body.classList.toggle('queue-collapsed');
    });

    events.on('trackChange', () => updateQueueUI());
    events.on('queueChange', () => updateQueueUI());
    events.on('libraryLoaded', () => updateQueueUI());
}

export function updateQueueUI() {
    const manualQueueUI = document.getElementById('manual-queue-list');
    const playlistQueueUI = document.getElementById('playlist-queue-list');

    manualQueueUI.innerHTML = state.manualQueue.length
        ? '' : '<p style="font-size:10px; color:#555; text-align:center">No manual tracks</p>';

    state.manualQueue.forEach((fname, i) => {
        const s = state.allSongs.find(song => song.filename === fname);
        if (!s) return;
        const d = document.createElement('div');
        d.className = 'q-item manual';
        d.innerHTML = `<div style="flex-grow:1; overflow:hidden"><div style="font-size:12px; font-weight:700; white-space:nowrap; text-overflow:ellipsis; overflow:hidden">${s.title}</div></div><i class="fas fa-times" style="cursor:pointer; color:#555; font-size:10px"></i>`;
        d.querySelector('.fa-times').onclick = (e) => { e.stopPropagation(); removeQ(i); };
        d.onclick = () => {
            state.manualQueue.splice(0, i);
            play(state.allSongs.indexOf(s));
            state.manualQueue.shift();
            updateQueueUI();
        };
        manualQueueUI.appendChild(d);
    });

    playlistQueueUI.innerHTML = '';
    const cPl = state.playlists[state.activePl] || [];
    const lIdx = cPl.findIndex(s => state.allSongs.indexOf(s) === state.currIdx);
    for (let i = lIdx + 1; i < lIdx + 10 && i < cPl.length; i++) {
        const s = cPl[i];
        const d = document.createElement('div');
        d.className = 'q-item';
        d.innerHTML = `<div style="flex-grow:1; overflow:hidden"><div style="font-size:12px; font-weight:500; white-space:nowrap; text-overflow:ellipsis; overflow:hidden">${s.title}</div><div style="font-size:9px; color:#555">${s.folder}</div></div>`;
        d.onclick = () => play(state.allSongs.indexOf(s));
        playlistQueueUI.appendChild(d);
    }
}

function removeQ(i) {
    state.manualQueue.splice(i, 1);
    saveConfig();
    updateQueueUI();
}
