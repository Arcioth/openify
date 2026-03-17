module.exports = {
    init(api) {
        api.themes.registerTheme({
            id: 'neon-pink',
            label: 'Neon Pink',
            color: '#ff69b4',
            cssVariables: {
                '--bg-base': '#0d0010',
                '--bg-sidebar': '#0d0010',
                '--bg-main': '#130018',
                '--bg-card': '#1a0025',
                '--bg-card-hover': '#2a0040',
                '--text-main': '#ffc0e0',
                '--text-sub': '#b06090',
                '--accent': '#ff69b4',
                '--accent-hover': '#ff8cc8',
            }
        });

        api.themes.registerTheme({
            id: 'neon-cyan',
            label: 'Neon Cyan',
            color: '#00ffff',
            cssVariables: {
                '--bg-base': '#000d0d',
                '--bg-sidebar': '#000d0d',
                '--bg-main': '#001318',
                '--bg-card': '#001a25',
                '--bg-card-hover': '#002a40',
                '--text-main': '#c0ffff',
                '--text-sub': '#609090',
                '--accent': '#00ffff',
                '--accent-hover': '#40ffff',
            }
        });

        api.themes.registerTheme({
            id: 'twin',
            label: 'Twin',
            color: '#b48eff',
            cssVariables: {
                '--bg-base': '#0a0612',
                '--bg-sidebar': '#0e0818',
                '--bg-main': '#110a1e',
                '--bg-card': '#1a1030',
                '--bg-card-hover': '#251845',
                '--text-main': '#e0d0ff',
                '--text-sub': '#8a70b0',
                '--accent': '#b48eff',
                '--accent-hover': '#c9a8ff',
            }
        });

        api.themes.registerTheme({
            id: 'vegza',
            label: 'Vegza',
            color: '#7cff6b',
            cssVariables: {
                '--bg-base': '#060d05',
                '--bg-sidebar': '#081008',
                '--bg-main': '#0a140a',
                '--bg-card': '#122012',
                '--bg-card-hover': '#1a3018',
                '--text-main': '#d0ffc8',
                '--text-sub': '#6a9a60',
                '--accent': '#7cff6b',
                '--accent-hover': '#a0ff90',
            }
        });

        return module.exports;
    },

    disable() {
        // Theme cleanup is handled automatically by the extension manager
    },

    destroy() {}
};
