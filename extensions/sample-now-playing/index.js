let container = null;
let unsub = null;

module.exports = {
    async init(api) {
        api.ui.registerSidebarItem({
            id: 'now-playing',
            label: 'Now Playing',
            icon: 'fas fa-info-circle',
            order: 50,
            onClick: (el) => {
                container = el;
                render(api);
            }
        });

        unsub = (idx, song) => {
            if (container && container.classList.contains('active')) {
                render(api);
            }
            // Increment play count
            incrementPlayCount(api, song);
        };
        api.events.on('trackChange', unsub);

        return module.exports;
    },

    disable() {
        container = null;
    },

    destroy() {
        container = null;
        unsub = null;
    }
};

async function render(api) {
    if (!container) return;
    const track = api.playback.getCurrentTrack();
    const pState = api.playback.getState();

    if (!track) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); padding:60px 0"><i class="fas fa-music" style="font-size:48px; opacity:0.3; display:block; margin-bottom:16px"></i>No track playing</div>';
        return;
    }

    const playCount = await api.storage.get('plays:' + track.filename) || 0;
    const totalPlays = await api.storage.get('total_plays') || 0;
    const songs = api.library.getSongs();
    const playlists = api.library.getPlaylists();

    container.innerHTML = `
        <div style="max-width:500px; margin:0 auto">
            <div style="text-align:center; margin-bottom:30px">
                <div style="width:200px; height:200px; border-radius:16px; overflow:hidden; margin:0 auto 20px; background:var(--bg-card); display:flex; align-items:center; justify-content:center; box-shadow:0 20px 60px rgba(0,0,0,0.4)">
                    ${track.artwork
                        ? '<img src="' + track.artwork + '" style="width:100%;height:100%;object-fit:cover">'
                        : '<i class="fas fa-compact-disc fa-spin" style="font-size:64px; color:var(--text-sub); opacity:0.3"></i>'}
                </div>
                <h2 style="font-size:24px; font-weight:800; margin-bottom:4px">${track.title}</h2>
                <p style="color:var(--text-sub); font-size:13px">${track.folder}</p>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
                <div style="background:var(--bg-card); border-radius:12px; padding:16px; text-align:center">
                    <div style="font-size:24px; font-weight:800; color:var(--accent)">${playCount}</div>
                    <div style="font-size:10px; color:var(--text-sub); text-transform:uppercase; letter-spacing:1px; margin-top:4px">Plays (this track)</div>
                </div>
                <div style="background:var(--bg-card); border-radius:12px; padding:16px; text-align:center">
                    <div style="font-size:24px; font-weight:800; color:var(--accent)">${totalPlays}</div>
                    <div style="font-size:10px; color:var(--text-sub); text-transform:uppercase; letter-spacing:1px; margin-top:4px">Total Plays</div>
                </div>
                <div style="background:var(--bg-card); border-radius:12px; padding:16px; text-align:center">
                    <div style="font-size:24px; font-weight:800; color:var(--accent)">${track.duration}</div>
                    <div style="font-size:10px; color:var(--text-sub); text-transform:uppercase; letter-spacing:1px; margin-top:4px">Duration</div>
                </div>
                <div style="background:var(--bg-card); border-radius:12px; padding:16px; text-align:center">
                    <div style="font-size:24px; font-weight:800; color:var(--accent)">${songs.length}</div>
                    <div style="font-size:10px; color:var(--text-sub); text-transform:uppercase; letter-spacing:1px; margin-top:4px">Library Size</div>
                </div>
            </div>
            <div style="margin-top:16px; background:var(--bg-card); border-radius:12px; padding:16px">
                <div style="font-size:10px; color:var(--text-sub); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px">File Info</div>
                <div style="font-size:12px; color:var(--text-main); word-break:break-all">${track.filename}</div>
            </div>
        </div>
    `;
}

async function incrementPlayCount(api, song) {
    if (!song) return;
    const key = 'plays:' + song.filename;
    const current = await api.storage.get(key) || 0;
    await api.storage.set(key, current + 1);
    const total = await api.storage.get('total_plays') || 0;
    await api.storage.set('total_plays', total + 1);
}
