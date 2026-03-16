module.exports = {
    init(api) {

        // --- Sakura ---
        api.themes.registerTheme({
            id: 'sakura',
            label: 'Sakura',
            color: '#ffb7c5',
            cssVariables: {
                '--bg-base': '#1a0f14',
                '--bg-sidebar': '#1a0f14',
                '--bg-main': '#211519',
                '--bg-card': '#2d1c22',
                '--bg-card-hover': '#3d2830',
                '--text-main': '#fce4ec',
                '--text-sub': '#c48b9f',
                '--accent': '#ffb7c5',
                '--accent-hover': '#ffc8d6',
            }
        });

        // --- Ocean Deep ---
        api.themes.registerTheme({
            id: 'ocean-deep',
            label: 'Ocean Deep',
            color: '#006994',
            cssVariables: {
                '--bg-base': '#020e18',
                '--bg-sidebar': '#020e18',
                '--bg-main': '#041825',
                '--bg-card': '#082438',
                '--bg-card-hover': '#0c3350',
                '--text-main': '#d0ecf8',
                '--text-sub': '#5a8ca8',
                '--accent': '#00b4d8',
                '--accent-hover': '#48cae4',
            }
        });

        // --- Retrowave ---
        api.themes.registerTheme({
            id: 'retrowave',
            label: 'Retrowave',
            color: '#f72585',
            cssVariables: {
                '--bg-base': '#0b0014',
                '--bg-sidebar': '#0b0014',
                '--bg-main': '#10001e',
                '--bg-card': '#1a0830',
                '--bg-card-hover': '#261040',
                '--text-main': '#edc4ff',
                '--text-sub': '#9a5abf',
                '--accent': '#f72585',
                '--accent-hover': '#b5179e',
            }
        });

        // --- Forest ---
        api.themes.registerTheme({
            id: 'forest',
            label: 'Forest',
            color: '#2d6a4f',
            cssVariables: {
                '--bg-base': '#080f0b',
                '--bg-sidebar': '#080f0b',
                '--bg-main': '#0e1a13',
                '--bg-card': '#14261b',
                '--bg-card-hover': '#1c3425',
                '--text-main': '#d8f3dc',
                '--text-sub': '#74a383',
                '--accent': '#52b788',
                '--accent-hover': '#74c69d',
            }
        });

        // --- Sunset Beach ---
        api.themes.registerTheme({
            id: 'sunset-beach',
            label: 'Sunset Beach',
            color: '#ff6b35',
            cssVariables: {
                '--bg-base': '#1a0e08',
                '--bg-sidebar': '#1a0e08',
                '--bg-main': '#24140c',
                '--bg-card': '#321c10',
                '--bg-card-hover': '#44281a',
                '--text-main': '#ffe0cc',
                '--text-sub': '#b87d5e',
                '--accent': '#ff6b35',
                '--accent-hover': '#ff8c5a',
            }
        });

        // --- Lavender Dream ---
        api.themes.registerTheme({
            id: 'lavender-dream',
            label: 'Lavender Dream',
            color: '#b4a7d6',
            cssVariables: {
                '--bg-base': '#12101a',
                '--bg-sidebar': '#12101a',
                '--bg-main': '#1a1724',
                '--bg-card': '#242030',
                '--bg-card-hover': '#302a40',
                '--text-main': '#e8e0f0',
                '--text-sub': '#9088a8',
                '--accent': '#b4a7d6',
                '--accent-hover': '#c8bde6',
            }
        });

        // --- Volcano ---
        api.themes.registerTheme({
            id: 'volcano',
            label: 'Volcano',
            color: '#dc2f02',
            cssVariables: {
                '--bg-base': '#0a0000',
                '--bg-sidebar': '#0a0000',
                '--bg-main': '#140200',
                '--bg-card': '#1e0500',
                '--bg-card-hover': '#300a00',
                '--text-main': '#ffd6cc',
                '--text-sub': '#aa6050',
                '--accent': '#dc2f02',
                '--accent-hover': '#e85d04',
            }
        });

        // --- Arctic ---
        api.themes.registerTheme({
            id: 'arctic',
            label: 'Arctic',
            color: '#a2d2ff',
            cssVariables: {
                '--bg-base': '#e8f0f8',
                '--bg-sidebar': '#dce8f4',
                '--bg-main': '#f0f6fc',
                '--bg-card': '#ffffff',
                '--bg-card-hover': '#e2ecf5',
                '--text-main': '#1a2a3a',
                '--text-sub': '#5a7a9a',
                '--accent': '#3a86c8',
                '--accent-hover': '#5a9ad8',
            }
        });

        // --- Candy Pop ---
        api.themes.registerTheme({
            id: 'candy-pop',
            label: 'Candy Pop',
            color: '#ff85a1',
            cssVariables: {
                '--bg-base': '#fff0f3',
                '--bg-sidebar': '#ffe5ea',
                '--bg-main': '#fff5f7',
                '--bg-card': '#ffffff',
                '--bg-card-hover': '#ffe0e8',
                '--text-main': '#3d1525',
                '--text-sub': '#a05070',
                '--accent': '#ff85a1',
                '--accent-hover': '#ff9db5',
            }
        });

        return module.exports;
    },

    disable() {},
    destroy() {}
};
