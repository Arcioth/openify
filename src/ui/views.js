import { state } from '../state.js';
import { events } from '../events.js';
import { play } from '../audio.js';
import { saveConfig } from '../config.js';

export function initViews() {
    events.on('trackChange', () => updateHighlights());
    events.on('metadataUpdate', (idx) => updateRowMetadataUI(idx));
    events.on('trackChange', (idx, song) => {
        if (song.artwork) {
            document.getElementById('banner-art').innerHTML = `<img src="${song.artwork}">`;
        } else {
            document.getElementById('banner-art').innerHTML = '<i class="fas fa-music"></i>';
        }
    });
}

export function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    const navBtn = document.getElementById('nav-' + view);
    if (navBtn) navBtn.classList.add('active');
}

export function setViewMode(mode) {
    state.config.viewMode = mode;
    document.getElementById('song-table-element').className = `song-table view-${mode}`;
    ['btn-view-compact', 'btn-view-normal', 'btn-view-big'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id.includes(mode));
    });
    renderSongs(state.playlists[state.activePl] || []);
    saveConfig();
}

export function toggleSort(column) {
    if (state.sortConfig.column === column) {
        state.sortConfig.direction = state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortConfig.column = column;
        state.sortConfig.direction = 'asc';
    }
    updateSortIcons();
    renderSongs(state.playlists[state.activePl] || []);
}

function updateSortIcons() {
    ['id', 'title', 'duration'].forEach(col => {
        const el = document.getElementById(`sort-${col}`);
        if (!el) return;
        if (state.sortConfig.column === col) {
            el.className = `fas fa-sort-${state.sortConfig.direction === 'asc' ? 'up' : 'down'}`;
            el.style.opacity = '1';
        } else {
            el.className = 'fas fa-sort';
            el.style.opacity = '0.3';
        }
    });
}

export function renderSongs(arr) {
    const sBody = document.getElementById('s-table-body');
    const ctxMenu = document.getElementById('ctx');
    sBody.innerHTML = '';
    const sorted = [...arr].sort((a, b) => {
        let vA, vB;
        if (state.sortConfig.column === 'title') { vA = a.title.toLowerCase(); vB = b.title.toLowerCase(); }
        else if (state.sortConfig.column === 'duration') { vA = a.durSec; vB = b.durSec; }
        else { vA = a.id; vB = b.id; }
        if (vA < vB) return state.sortConfig.direction === 'asc' ? -1 : 1;
        if (vA > vB) return state.sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    sorted.forEach((s) => {
        const gIdx = state.allSongs.indexOf(s);
        const tr = document.createElement('tr');
        tr.className = `song-row ${gIdx === state.currIdx ? 'active' : ''}`;
        tr.setAttribute('data-idx', gIdx);
        const artHtml = state.config.viewMode !== 'compact'
            ? `<div class="song-art-container">${s.artwork ? `<img src="${s.artwork}">` : getPlaceholder(s.title)}</div>`
            : '';
        tr.innerHTML = `<td>${s.id}</td><td><div style="display:flex; align-items:center">${artHtml}<div style="overflow:hidden"><div style="font-weight:600; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis">${s.title}</div><div style="font-size:11px; color:var(--text-sub)">Local File</div></div></div></td><td>${s.folder}</td><td class="dur-cell">${s.duration}</td>`;
        tr.onclick = () => play(gIdx);
        tr.oncontextmenu = (e) => {
            e.preventDefault();
            state.ctxIdx = gIdx;
            ctxMenu.style.display = 'block';
            ctxMenu.style.left = e.pageX + 'px';
            ctxMenu.style.top = e.pageY + 'px';
            document.getElementById('cx-folder-add').style.display = 'none';
            ['cx-play', 'cx-next', 'cx-add'].forEach(id => document.getElementById(id).style.display = 'flex');
        };
        sBody.appendChild(tr);
    });
}

export function updateHighlights() {
    document.querySelectorAll('.song-row').forEach((row) => {
        const s = state.allSongs[parseInt(row.getAttribute('data-idx'))];
        if (s && state.allSongs.indexOf(s) === state.currIdx) row.classList.add('active');
        else row.classList.remove('active');
    });
}

function updateRowMetadataUI(idx) {
    const row = document.querySelector(`tr[data-idx="${idx}"]`);
    if (row) {
        row.querySelector('.dur-cell').textContent = state.allSongs[idx].duration;
        if (state.allSongs[idx].artwork && state.config.viewMode !== 'compact') {
            const artContainer = row.querySelector('.song-art-container');
            if (artContainer) artContainer.innerHTML = `<img src="${state.allSongs[idx].artwork}">`;
        }
    }
}

export function getPlaceholder(title) {
    const h = Math.floor(Math.random() * 360);
    const chars = title.replace(/[^a-zA-Z]/g, '').padEnd(2, 'XX');
    const text = chars[0].toUpperCase() + chars[1].toLowerCase();
    return `<div class="song-placeholder" style="background:hsl(${h}, 30%, 40%)">${text}</div>`;
}
