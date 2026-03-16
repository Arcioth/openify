import { state } from '../state.js';
import { play } from '../audio.js';

export function initSearch() {
    const searchInput = document.getElementById('song-search');
    const searchResultsUI = document.getElementById('search-results');
    const ctxMenu = document.getElementById('ctx');

    searchInput.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        if (!q) { searchResultsUI.style.display = 'none'; return; }
        const matches = state.allSongs.filter(s => s.title.toLowerCase().includes(q)).slice(0, 5);
        if (matches.length === 0) { searchResultsUI.style.display = 'none'; return; }
        searchResultsUI.innerHTML = '';
        matches.forEach(s => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            const artHtml = s.artwork
                ? `<img src="${s.artwork}">`
                : '<i class="fas fa-music" style="font-size:10px"></i>';
            item.innerHTML = `<div class="search-result-art">${artHtml}</div><div style="overflow:hidden"><div style="font-weight:600; white-space:nowrap; text-overflow:ellipsis">${s.title}</div><div style="font-size:10px; color:var(--text-sub)">${s.folder}</div></div>`;
            item.onclick = () => {
                play(state.allSongs.indexOf(s));
                searchResultsUI.style.display = 'none';
                searchInput.value = '';
            };
            item.oncontextmenu = (e) => {
                e.preventDefault();
                state.ctxIdx = state.allSongs.indexOf(s);
                ctxMenu.style.display = 'block';
                ctxMenu.style.left = e.pageX + 'px';
                ctxMenu.style.top = e.pageY + 'px';
                document.getElementById('cx-folder-add').style.display = 'none';
                ['cx-play', 'cx-next', 'cx-add'].forEach(id => document.getElementById(id).style.display = 'flex');
            };
            searchResultsUI.appendChild(item);
        });
        searchResultsUI.style.display = 'block';
    };

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) searchResultsUI.style.display = 'none';
    });
}
