import { state } from '../state.js';
import { events } from '../events.js';
import { format, togglePlayPause, next, prev, seek, setVolume, toggleMute, getAudio } from '../audio.js';
import { saveConfig } from '../config.js';

export function initPlayer() {
    const bPlay = document.getElementById('b-play');

    bPlay.onclick = togglePlayPause;
    document.getElementById('b-next').onclick = next;
    document.getElementById('b-prev').onclick = prev;
    document.getElementById('btn-mute').onclick = toggleMute;

    // Progress slider
    setupSlider(
        document.getElementById('p-slider'),
        document.getElementById('p-fill'),
        document.getElementById('p-thumb'),
        (p) => { document.getElementById('t-curr').textContent = format(p * (getAudio().duration || 0)); },
        (p) => seek(p)
    );

    // Volume slider
    const vSlider = document.getElementById('v-slider');
    setupSlider(
        vSlider,
        document.getElementById('v-fill'),
        document.getElementById('v-thumb'),
        (p) => { setVolume(p); },
        (p) => { state.config.volume = p; saveConfig(); }
    );

    // Volume scroll
    vSlider.addEventListener('wheel', (e) => {
        e.preventDefault();
        const audio = getAudio();
        const step = 0.05;
        let newVol = Math.max(0, Math.min(1, audio.volume + (e.deltaY < 0 ? step : -step)));
        setVolume(newVol);
        document.getElementById('v-fill').style.width = (newVol * 100) + '%';
        document.getElementById('v-thumb').style.left = (newVol * 100) + '%';
        state.config.volume = newVol;
        saveConfig();
    }, { passive: false });

    // Loop & shuffle
    document.getElementById('btn-loop').onclick = () => {
        state.config.loopMode = (state.config.loopMode + 1) % 3;
        updateLoopUI();
        saveConfig();
    };
    document.getElementById('btn-shuffle').onclick = () => {
        state.config.shuffleMode = (state.config.shuffleMode + 1) % 3;
        updateShuffleUI();
        saveConfig();
    };

    // Event listeners
    events.on('trackChange', (idx, song) => {
        document.getElementById('p-title').textContent = song.title;
        document.getElementById('p-meta').textContent = song.folder;
        bPlay.innerHTML = '<i class="fas fa-pause"></i>';
        if (song.artwork) {
            document.getElementById('p-art').innerHTML = `<img src="${song.artwork}">`;
        } else {
            document.getElementById('p-art').innerHTML = '<i class="fas fa-compact-disc fa-spin" style="margin: 16px; color: #444; font-size: 24px;"></i>';
        }
    });

    events.on('playbackStateChange', (playing) => {
        bPlay.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    });

    events.on('timeUpdate', (percent, currentTime) => {
        document.getElementById('p-fill').style.width = percent + '%';
        document.getElementById('p-thumb').style.left = percent + '%';
        document.getElementById('t-curr').textContent = format(currentTime);
    });

    events.on('durationChange', (duration) => {
        document.getElementById('t-total').textContent = format(duration);
    });

    events.on('volumeChange', (volume, muted) => {
        const icon = document.getElementById('btn-mute');
        icon.className = (muted || volume === 0)
            ? 'fas fa-volume-mute vol-icon'
            : (volume < 0.5 ? 'fas fa-volume-down vol-icon' : 'fas fa-volume-up vol-icon');
        document.getElementById('v-slider').classList.toggle('muted-bar', muted);
    });
}

export function updateLoopUI() {
    const btn = document.getElementById('btn-loop');
    const badge = document.getElementById('loop-badge');
    btn.classList.toggle('active', state.config.loopMode > 0);
    badge.style.display = (state.config.loopMode === 2) ? 'block' : 'none';
}

export function updateShuffleUI() {
    const btn = document.getElementById('btn-shuffle');
    const badge = document.getElementById('shuffle-badge');
    btn.classList.toggle('active', state.config.shuffleMode > 0);
    badge.style.display = (state.config.shuffleMode === 2) ? 'block' : 'none';
}

function setupSlider(slider, fill, thumb, onDrag, onRelease) {
    let isDragging = false;
    const update = (e) => {
        const rect = slider.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        fill.style.width = (p * 100) + '%';
        thumb.style.left = (p * 100) + '%';
        if (onDrag) onDrag(p);
        return p;
    };
    slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.classList.add('dragging');
        update(e);
    });
    window.addEventListener('mousemove', (e) => { if (isDragging) update(e); });
    window.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('dragging');
            const p = update(e);
            if (onRelease) onRelease(p);
        }
    });
}
