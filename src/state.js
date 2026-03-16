export const state = {
    allSongs: [],
    playlists: {},
    activePl: 'All Songs',
    manualQueue: [],
    recentlyPlayed: [],
    currIdx: -1,
    ctxIdx: -1,
    ctxFolder: null,
    config: {
        volume: 0.7,
        theme: 'openify',
        recent: [],
        manualQueue: [],
        loopMode: 0,
        shuffleMode: 0,
        viewMode: 'normal'
    },
    sortConfig: { column: 'id', direction: 'asc' },
    db: null,
};

export const THEMES = [
    { id: 'openify', color: '#1db954', label: 'Openify' },
    { id: 'dark', color: '#000000', label: 'AMOLED' },
    { id: 'light', color: '#ffffff', label: 'Light' },
    { id: 'blue', color: '#112240', label: 'Midnight' },
    { id: 'purple', color: '#240b36', label: 'Purple Haze' },
    { id: 'red', color: '#120505', label: 'Blood Red' },
    { id: 'gold', color: '#1a1612', label: 'Sunset Gold' },
    { id: 'cyberpunk', color: '#050505', label: 'Cyberpunk' },
    { id: 'glass', color: 'rgba(255,255,255,0.5)', label: 'Liquid Glass' },
    { id: 'terminal', color: '#0f0', label: 'Terminal' },
    { id: 'rgb', color: 'linear-gradient(to right, red, green, blue)', label: 'RGB' },
    { id: 'pharoh', color: '#d4af37', label: 'Pharoh' },
    { id: 'turk', color: '#f00', label: 'Türk' },
    { id: 'clouds', color: '#add8e6', label: 'Clouds' },
];
