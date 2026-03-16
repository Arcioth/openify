import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { platform, arch } from 'os';

const YTDLP_VERSION = 'latest';
const BIN_DIR = path.resolve('bin');

const YTDLP_RELEASES = {
    win32: 'yt-dlp.exe',
    linux: 'yt-dlp',
    darwin: 'yt-dlp_macos'
};

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function setup() {
    console.log('🚀 Setting up Openify...');

    // 1. Ensure bin directory exists
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR);
    }

    // 2. Download yt-dlp
    const osPlatform = platform();
    const fileName = YTDLP_RELEASES[osPlatform];

    if (!fileName) {
        console.warn('⚠️  Unsupported platform for auto yt-dlp download. Please install it manually.');
    } else {
        const dest = path.join(BIN_DIR, osPlatform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
        const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${fileName}`;

        if (!fs.existsSync(dest)) {
            console.log(`📥 Downloading yt-dlp for ${osPlatform}...`);
            try {
                await downloadFile(url, dest);
                if (osPlatform !== 'win32') {
                    fs.chmodSync(dest, '755');
                }
                console.log('✅ yt-dlp downloaded successfully.');
            } catch (err) {
                console.error('❌ Failed to download yt-dlp:', err.message);
            }
        } else {
            console.log('✅ yt-dlp already exists in bin/.');
        }
    }

    // 3. Install npm dependencies
    console.log('📦 Installing dependencies...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed.');
    } catch (err) {
        console.error('❌ Failed to install dependencies.');
    }

    console.log('\n✨ Setup complete! Run "npm run dev" to start Openify.');
}

setup();
