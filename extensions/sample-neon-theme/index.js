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

        return module.exports;
    },

    disable() {
        // Theme cleanup is handled automatically by the extension manager
    },

    destroy() {}
};
