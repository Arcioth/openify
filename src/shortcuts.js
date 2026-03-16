import { togglePlayPause, next, prev } from './audio.js';

export function initShortcuts() {
    window.onkeydown = (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
        if (e.code === 'ArrowRight') next();
        if (e.code === 'ArrowLeft') prev();
    };
}
