import { state } from '../state.js';
import { events } from '../events.js';
import { play } from '../audio.js';

export function initRecent() {
    events.on('recentChange', () => renderRecentlyPlayed());
}

export function renderRecentlyPlayed() {
    const grid = document.getElementById('recent-grid');
    if (!state.recentlyPlayed.length) {
        document.getElementById('recent-section').style.display = 'none';
        return;
    }
    document.getElementById('recent-section').style.display = 'block';
    grid.innerHTML = '';
    state.recentlyPlayed.forEach(s => {
        const card = document.createElement('div');
        card.className = 'recent-card';
        card.innerHTML = `<div class="recent-art">${s.artwork ? `<img src="${s.artwork}">` : '<i class="fas fa-play"></i>'}</div><div class="recent-title">${s.title}</div>`;
        card.onclick = () => {
            const idx = state.allSongs.findIndex(song => song.title === s.title);
            if (idx !== -1) play(idx);
        };
        grid.appendChild(card);
    });
}
