import { state } from './state.js';
import { events } from './events.js';
import { saveConfig } from './config.js';

let audio;

export function initAudio() {
    audio = document.getElementById('audio');

    audio.onloadedmetadata = () => {
        events.emit('durationChange', audio.duration);
    };

    audio.ontimeupdate = () => {
        if (!audio.duration || document.body.classList.contains('dragging')) return;
        const p = (audio.currentTime / audio.duration) * 100;
        events.emit('timeUpdate', p, audio.currentTime);
    };

    audio.onended = () => next();

    return audio;
}

export function getAudio() { return audio; }

export function play(idx) {
    if (idx < 0 || idx >= state.allSongs.length) return;
    state.currIdx = idx;
    const s = state.allSongs[idx];
    audio.src = s.assetUrl || URL.createObjectURL(s.file);
    audio.play();
    addToRecent(s);
    events.emit('trackChange', idx, s);
}

export function togglePlayPause() {
    if (audio.paused) {
        audio.play();
        events.emit('playbackStateChange', true);
    } else {
        audio.pause();
        events.emit('playbackStateChange', false);
    }
}

export function next() {
    if (state.config.loopMode === 2) {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    if (state.manualQueue.length) {
        const nextFname = state.manualQueue.shift();
        saveConfig();
        const idx = state.allSongs.findIndex(s => s.filename === nextFname);
        if (idx !== -1) play(idx); else next();
    } else if (state.config.shuffleMode > 0) {
        const pool = (state.config.shuffleMode === 2) ? state.allSongs : state.playlists[state.activePl];
        play(state.allSongs.indexOf(pool[Math.floor(Math.random() * pool.length)]));
    } else {
        const cPl = state.playlists[state.activePl];
        const lIdx = cPl.findIndex(s => state.allSongs.indexOf(s) === state.currIdx);
        if (lIdx !== -1 && lIdx < cPl.length - 1) play(state.allSongs.indexOf(cPl[lIdx + 1]));
        else if (state.config.loopMode === 1) play(state.allSongs.indexOf(cPl[0]));
    }
    events.emit('queueChange');
}

export function prev() {
    if (state.currIdx > 0) play(state.currIdx - 1);
}

export function seek(fraction) {
    if (audio.duration) audio.currentTime = fraction * audio.duration;
}

export function setVolume(v) {
    audio.volume = v;
    if (v > 0) audio.muted = false;
    events.emit('volumeChange', v, audio.muted);
}

export function toggleMute() {
    audio.muted = !audio.muted;
    events.emit('volumeChange', audio.volume, audio.muted);
}

export function format(s) {
    if (isNaN(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function addToRecent(song) {
    state.recentlyPlayed = state.recentlyPlayed.filter(s => s.title !== song.title);
    state.recentlyPlayed.unshift({ title: song.title, folder: song.folder, artwork: song.artwork });
    if (state.recentlyPlayed.length > 20) state.recentlyPlayed.pop();
    saveConfig();
    events.emit('recentChange');
}
