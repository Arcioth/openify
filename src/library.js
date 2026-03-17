import { state } from './state.js';
import { events } from './events.js';
import { saveToDB, getFromDB } from './db.js';
import { format } from './audio.js';

export function addSongs(newSongs) {
    if (!state.playlists['All Songs']) {
        state.playlists['All Songs'] = [];
    }
    const startIdx = state.allSongs.length;
    const maxId = state.allSongs.length > 0
        ? Math.max(...state.allSongs.map(s => s.id))
        : 0;
    newSongs.forEach((song, i) => {
        const s = {
            file: null,
            folder: song.folder || 'Streaming',
            title: song.title || 'Unknown',
            filename: song.filename || `stream-${maxId + i + 1}`,
            duration: song.duration || '--:--',
            durSec: song.durSec || 0,
            artwork: song.artwork || null,
            assetUrl: song.assetUrl || null,
            id: maxId + i + 1,
        };
        state.allSongs.push(s);
        if (!state.playlists[s.folder]) state.playlists[s.folder] = [];
        state.playlists[s.folder].push(s);
        state.playlists['All Songs'].push(s);
    });
    events.emit('libraryLoaded');
    return startIdx;
}

export function updateSong(idx, updates) {
    if (idx < 0 || idx >= state.allSongs.length) return;
    const song = state.allSongs[idx];
    for (const key of ['assetUrl', 'title', 'artwork', 'duration', 'durSec']) {
        if (updates[key] !== undefined) song[key] = updates[key];
    }
}

export function loadFromPaths(audioFiles) {
    state.allSongs = [];
    state.playlists = { 'All Songs': [] };
    audioFiles.forEach((file, index) => {
        const assetUrl = window.__TAURI__.core.convertFileSrc(file.path);
        const song = {
            file: null,
            folder: file.folder,
            title: file.filename.replace(/\.[^/.]+$/, '').replace(/\[.*?\]/g, '').trim(),
            filename: file.filename,
            duration: '--:--',
            durSec: 0,
            artwork: null,
            assetUrl,
            localPath: file.path,
            id: index + 1
        };
        state.allSongs.push(song);
        if (!state.playlists[file.folder]) state.playlists[file.folder] = [];
        state.playlists[file.folder].push(song);
        state.playlists['All Songs'].push(song);
    });
    events.emit('libraryLoaded');
    scanMetadataSequentially();
}

export function loadFromFiles(files) {
    const audioFiles = Array.from(files).filter(f =>
        f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i)
    );
    state.allSongs = [];
    state.playlists = { 'All Songs': [] };
    audioFiles.forEach((file, index) => {
        const folder = file.webkitRelativePath.split('/').length > 1
            ? file.webkitRelativePath.split('/')[file.webkitRelativePath.split('/').length - 2]
            : 'Collection';
        const song = {
            file, folder,
            title: file.name.replace(/\.[^/.]+$/, '').replace(/\[.*?\]/g, '').trim(),
            filename: file.name, duration: '--:--', durSec: 0, artwork: null,
            id: index + 1
        };
        state.allSongs.push(song);
        if (!state.playlists[folder]) state.playlists[folder] = [];
        state.playlists[folder].push(song);
        state.playlists['All Songs'].push(song);
    });
    events.emit('libraryLoaded');
    scanMetadataSequentially();
}

async function scanMetadataSequentially() {
    for (let i = 0; i < state.allSongs.length; i++) {
        const s = state.allSongs[i];
        const cached = await getFromDB('meta', s.filename);
        if (cached) {
            s.duration = cached.duration;
            s.durSec = cached.durSec;
            s.artwork = cached.artwork;
            events.emit('metadataUpdate', i);
            continue;
        }
        const mediaSource = s.file || s.assetUrl;
        const audioSrc = s.file ? URL.createObjectURL(s.file) : s.assetUrl;
        await new Promise((resolve) => {
            jsmediatags.read(mediaSource, {
                onSuccess: (t) => {
                    if (t.tags.picture) {
                        let d = '';
                        for (let j = 0; j < t.tags.picture.data.length; j++) d += String.fromCharCode(t.tags.picture.data[j]);
                        s.artwork = `data:${t.tags.picture.format};base64,${window.btoa(d)}`;
                    }
                    const aud = new Audio();
                    aud.src = audioSrc;
                    aud.onloadedmetadata = () => {
                        s.durSec = aud.duration;
                        s.duration = format(aud.duration);
                        saveToDB('meta', s.filename, { duration: s.duration, durSec: s.durSec, artwork: s.artwork });
                        events.emit('metadataUpdate', i);
                        if (s.file) URL.revokeObjectURL(aud.src);
                        resolve();
                    };
                    aud.onerror = () => resolve();
                },
                onError: () => resolve()
            });
        });
    }
}
