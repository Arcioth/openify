import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'fs';

export default defineConfig({
    publicDir: 'public',
    server: {
        fs: {
            allow: ['.'],
        },
    },
    plugins: [
        {
            name: 'serve-extensions',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (!req.url.startsWith('/extensions/')) return next();
                    const filePath = resolve('extensions', req.url.replace('/extensions/', ''));
                    if (existsSync(filePath)) {
                        const ext = filePath.split('.').pop();
                        const types = { js: 'application/javascript', json: 'application/json', css: 'text/css', png: 'image/png', svg: 'image/svg+xml' };
                        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
                        res.end(readFileSync(filePath));
                        return;
                    }
                    next();
                });
            },
        },
        {
            name: 'copy-extensions',
            closeBundle() {
                const src = resolve('extensions');
                const dest = resolve('dist/extensions');
                if (existsSync(src)) {
                    cpSync(src, dest, { recursive: true });
                }
            },
        },
    ],
});
