import { state } from '../state.js';
import { events } from '../events.js';
import { play } from '../audio.js';
import { renderSongs, switchView } from './views.js';
import { updateQueueUI } from './queue.js';

export function initPlaylists() {
    events.on('libraryLoaded', () => {
        renderPlaylists();
        switchPlaylist('All Songs');
    });
}

export function renderPlaylists() {
    const plList = document.getElementById('pl-list');
    const ctxMenu = document.getElementById('ctx');
    plList.innerHTML = '';
    Object.keys(state.playlists).sort().forEach(name => {
        const div = document.createElement('div');
        div.className = `playlist-item ${state.activePl === name ? 'active' : ''}`;
        div.innerHTML = `<div class="folder-icon"><i class="fas fa-folder"></i></div><div style="overflow:hidden; flex-grow:1"><div style="font-weight:700; font-size:13px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden">${name}</div><div style="font-size:10px; color:var(--text-sub)">${state.playlists[name].length} songs</div></div>`;
        let timer = null;
        div.onclick = () => {
            if (timer) return;
            timer = setTimeout(() => { switchPlaylist(name); switchView('home'); timer = null; }, 200);
        };
        div.ondblclick = () => {
            clearTimeout(timer);
            timer = null;
            switchPlaylist(name);
            switchView('home');
            play(state.allSongs.indexOf(state.playlists[name][0]));
        };
        div.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.ctxFolder = name;
            ctxMenu.style.display = 'block';
            ctxMenu.style.left = e.pageX + 'px';
            ctxMenu.style.top = e.pageY + 'px';
            document.getElementById('cx-folder-add').style.display = 'flex';
            ['cx-play', 'cx-next', 'cx-add'].forEach(id => document.getElementById(id).style.display = 'none');
        };
        plList.appendChild(div);
    });
}

export function switchPlaylist(name) {
    state.activePl = name;
    document.getElementById('banner-title').textContent = name;
    renderSongs(state.playlists[name]);
    renderPlaylists();
    updateQueueUI();
}
