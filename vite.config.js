import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

const execFileAsync = promisify(execFile);

function getTdLPPath() {
    const binDir = resolve('bin');
    const isWin = process.platform === 'win32';
    const localPath = resolve(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
    return existsSync(localPath) ? localPath : 'yt-dlp';
}

export default defineConfig({
    publicDir: 'public',
    server: {
        fs: {
            allow: ['.'],
        },
    },
    plugins: [
        {
            name: 'yt-dlp-api',
            configureServer(server) {
                server.middlewares.use('/yt-api', async (req, res) => {
                    const url = new URL(req.url, 'http://localhost');
                    const ytdlp = getTdLPPath();

                    if (url.pathname.startsWith('/search')) {
                        res.setHeader('Content-Type', 'application/json');
                        const query = url.searchParams.get('q');
                        if (!query) {
                            res.end(JSON.stringify({ items: [] }));
                            return;
                        }
                        try {
                            const { stdout } = await execFileAsync(ytdlp, [
                                `ytsearch10:${query}`,
                                '--flat-playlist',
                                '-j',
                                '--no-warnings',
                            ], { timeout: 30000 });
                            const items = stdout.trim().split('\n')
                                .filter(Boolean)
                                .map(line => JSON.parse(line));
                            res.end(JSON.stringify({ items }));
                        } catch (e) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: e.stderr || e.message }));
                        }
                    } else if (url.pathname.startsWith('/streams/')) {
                        res.setHeader('Content-Type', 'application/json');
                        const videoId = url.pathname.split('/').pop();
                        if (!videoId || !/^[\w-]+$/.test(videoId)) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Invalid video ID' }));
                            return;
                        }
                        try {
                            const { stdout } = await execFileAsync(ytdlp, [
                                '-f', 'bestaudio',
                                '-j',
                                '--no-warnings',
                                `https://www.youtube.com/watch?v=${videoId}`,
                            ], { timeout: 30000 });
                            res.end(stdout.trim());
                        } catch (e) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: e.stderr || e.message }));
                        }
                    } else if (url.pathname.startsWith('/proxy')) {
                        const targetUrl = url.searchParams.get('url');
                        if (!targetUrl) {
                            res.writeHead(400);
                            res.end('Missing url parameter');
                            return;
                        }

                        const client = targetUrl.startsWith('https') ? https : http;
                        const proxyReq = client.get(targetUrl, (proxyRes) => {
                            // Copy headers from the target response
                            res.writeHead(proxyRes.statusCode, {
                                'Content-Type': proxyRes.headers['content-type'],
                                'Content-Length': proxyRes.headers['content-length'],
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'public, max-age=3600'
                            });
                            proxyRes.pipe(res);
                        });

                        proxyReq.on('error', (e) => {
                            res.writeHead(500);
                            res.end('Proxy error: ' + e.message);
                        });
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.writeHead(404);
                        res.end(JSON.stringify({ error: 'Not found' }));
                    }
                });
            },
        },
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
