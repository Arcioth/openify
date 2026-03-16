var container = null;
var api = null;
var canvas = null;
var ctx = null;
var audioCtx = null;
var analyser = null;
var source = null;
var animFrame = null;
var mode = 0;
var MODES = ['Bars', 'Wave', 'Circle', 'Particles'];
var isVisible = false;
var particles = [];
var accentColor = '#1db954';

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'visualizer',
            label: 'Visualizer',
            icon: 'fas fa-wave-square',
            order: 55,
            onClick: function(el) {
                container = el;
                isVisible = true;
                buildUI();
                ensureAudioContext();
                startLoop();
            }
        });

        api.events.on('playbackStateChange', onPlaybackChange);
        api.events.on('trackChange', onTrackChange);

        loadMode();
        return module.exports;
    },

    disable: function() {
        stopLoop();
        isVisible = false;
        container = null;
        canvas = null;
        ctx = null;
    },

    destroy: function() {
        stopLoop();
        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close(); } catch(e) {}
        }
        audioCtx = null;
        analyser = null;
        source = null;
        container = null;
        canvas = null;
        ctx = null;
        api = null;
        particles = [];
    }
};

// --- Persist mode ---

async function loadMode() {
    if (!api) return;
    var stored = await api.storage.get('vizMode');
    if (typeof stored === 'number' && stored >= 0 && stored < MODES.length) {
        mode = stored;
    }
}

function saveMode() {
    if (!api) return;
    api.storage.set('vizMode', mode);
}

// --- Audio context setup ---

function ensureAudioContext() {
    if (analyser) return;

    var audioEl = document.getElementById('audio');
    if (!audioEl) return;

    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!source) {
            source = audioCtx.createMediaElementSource(audioEl);
        }
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    } catch(e) {
        // MediaElementSource may already exist from a prior enable
        // Try to reuse existing nodes
        console.warn('Visualizer audio setup:', e.message);
    }
}

// --- Animation loop ---

function startLoop() {
    stopLoop();
    if (!isVisible) return;
    readAccentColor();
    tick();
}

function stopLoop() {
    if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
    }
}

function tick() {
    if (!isVisible || !canvas || !ctx) return;
    draw();
    animFrame = requestAnimationFrame(tick);
}

function onPlaybackChange(playing) {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function onTrackChange() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    particles = [];
}

// --- UI ---

function buildUI() {
    if (!container) return;

    readAccentColor();

    container.innerHTML =
        '<div style="display:flex; flex-direction:column; height:100%; position:relative">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; padding:0 8px; margin-bottom:12px; flex-shrink:0">' +
        '<div style="font-size:20px; font-weight:800">Visualizer</div>' +
        '<div style="display:flex; gap:6px" id="viz-mode-btns"></div>' +
        '</div>' +
        '<div style="flex:1; position:relative; min-height:0">' +
        '<canvas id="viz-canvas" style="width:100%; height:100%; display:block; border-radius:12px"></canvas>' +
        '</div>' +
        '<div style="text-align:center; margin-top:10px; flex-shrink:0">' +
        '<div id="viz-mode-label" style="font-size:11px; color:var(--text-sub); font-weight:600; text-transform:uppercase; letter-spacing:1px">' + MODES[mode] + '</div>' +
        '</div></div>';

    // Mode buttons
    var btnContainer = container.querySelector('#viz-mode-btns');
    var icons = ['fas fa-chart-bar', 'fas fa-wave-square', 'fas fa-circle-notch', 'fas fa-sparkles'];
    for (var i = 0; i < MODES.length; i++) {
        (function(idx) {
            var btn = document.createElement('button');
            btn.className = 'viz-mode-btn' + (idx === mode ? ' viz-active' : '');
            btn.innerHTML = '<i class="' + icons[idx] + '"></i>';
            btn.title = MODES[idx];
            btn.style.cssText = 'background:' + (idx === mode ? 'var(--accent)' : 'var(--bg-card)') +
                '; border:none; color:' + (idx === mode ? '#fff' : 'var(--text-sub)') +
                '; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:13px; transition:all 0.2s; display:flex; align-items:center; justify-content:center';
            btn.onclick = function() {
                mode = idx;
                saveMode();
                particles = [];
                updateModeButtons();
            };
            btnContainer.appendChild(btn);
        })(i);
    }

    // Setup canvas
    canvas = container.querySelector('#viz-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Observe resize
    if (window.ResizeObserver) {
        var ro = new ResizeObserver(function() { resizeCanvas(); });
        ro.observe(canvas.parentElement);
    }

    injectStyles();
}

function updateModeButtons() {
    if (!container) return;
    var btns = container.querySelectorAll('.viz-mode-btn');
    for (var i = 0; i < btns.length; i++) {
        var active = i === mode;
        btns[i].style.background = active ? 'var(--accent)' : 'var(--bg-card)';
        btns[i].style.color = active ? '#fff' : 'var(--text-sub)';
        btns[i].className = 'viz-mode-btn' + (active ? ' viz-active' : '');
    }
    var label = container.querySelector('#viz-mode-label');
    if (label) label.textContent = MODES[mode];
}

function resizeCanvas() {
    if (!canvas) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
}

function readAccentColor() {
    var computed = getComputedStyle(document.body).getPropertyValue('--accent');
    if (computed) accentColor = computed.trim();
}

// --- Drawing ---

function getFrequencyData() {
    if (!analyser) return null;
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data;
}

function getTimeDomainData() {
    if (!analyser) return null;
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    return data;
}

function draw() {
    if (!ctx || !canvas) return;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    switch (mode) {
        case 0: drawBars(w, h); break;
        case 1: drawWave(w, h); break;
        case 2: drawCircle(w, h); break;
        case 3: drawParticles(w, h); break;
    }
}

// --- Mode 0: Bars ---

function drawBars(w, h) {
    var data = getFrequencyData();
    if (!data) return;

    var barCount = Math.min(64, data.length);
    var gap = 3;
    var barWidth = (w - gap * (barCount - 1)) / barCount;
    var rgb = hexToRgb(accentColor);

    for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var barH = val * h * 0.85;
        var x = i * (barWidth + gap);
        var y = h - barH;

        // Gradient per bar
        var grad = ctx.createLinearGradient(x, h, x, y);
        grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.9)');
        grad.addColorStop(0.6, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        ctx.fillStyle = grad;

        // Rounded top
        var radius = Math.min(barWidth / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, h);
        ctx.fill();

        // Glow
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = val * 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Mirror reflection
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.scale(1, -1);
    ctx.translate(0, -2 * h);
    for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var barH = val * h * 0.85;
        var x = i * (barWidth + gap);
        ctx.fillStyle = accentColor;
        ctx.fillRect(x, h - barH, barWidth, barH);
    }
    ctx.restore();
}

// --- Mode 1: Waveform ---

function drawWave(w, h) {
    var data = getTimeDomainData();
    if (!data) return;

    var rgb = hexToRgb(accentColor);
    var mid = h / 2;
    var sliceWidth = w / data.length;

    // Fill under wave
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (var i = 0; i < data.length; i++) {
        var v = data[i] / 128.0;
        var y = v * mid;
        var x = i * sliceWidth;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, mid);
    ctx.lineTo(0, mid);
    ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.08)';
    ctx.fill();

    // Main wave line
    ctx.beginPath();
    for (var i = 0; i < data.length; i++) {
        var v = data[i] / 128.0;
        var y = v * mid;
        var x = i * sliceWidth;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Second thinner wave (slightly offset)
    ctx.beginPath();
    for (var i = 0; i < data.length; i++) {
        var v = data[i] / 128.0;
        var y = v * mid + 4;
        var x = i * sliceWidth;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// --- Mode 2: Circle ---

function drawCircle(w, h) {
    var data = getFrequencyData();
    if (!data) return;

    var cx = w / 2;
    var cy = h / 2;
    var baseRadius = Math.min(w, h) * 0.2;
    var maxRadius = Math.min(w, h) * 0.42;
    var barCount = Math.min(120, data.length);
    var rgb = hexToRgb(accentColor);

    // Inner glow circle
    var avg = 0;
    for (var i = 0; i < barCount; i++) avg += data[i];
    avg = avg / barCount / 255;

    var glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * (1 + avg * 0.5));
    glowGrad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', ' + (0.15 + avg * 0.2) + ')');
    glowGrad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * (1 + avg * 0.5), 0, Math.PI * 2);
    ctx.fill();

    // Inner circle outline
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bars radiating outward
    for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        var barLen = val * (maxRadius - baseRadius);
        var x1 = cx + Math.cos(angle) * baseRadius;
        var y1 = cy + Math.sin(angle) * baseRadius;
        var x2 = cx + Math.cos(angle) * (baseRadius + barLen);
        var y2 = cy + Math.sin(angle) * (baseRadius + barLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', ' + (0.4 + val * 0.6) + ')';
        ctx.lineWidth = Math.max(1.5, (Math.PI * 2 * baseRadius) / barCount * 0.6);
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = val * 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Inner mirror (shorter bars going inward)
    for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        var barLen = val * baseRadius * 0.4;
        var x1 = cx + Math.cos(angle) * baseRadius;
        var y1 = cy + Math.sin(angle) * baseRadius;
        var x2 = cx + Math.cos(angle) * (baseRadius - barLen);
        var y2 = cy + Math.sin(angle) * (baseRadius - barLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', ' + (val * 0.3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// --- Mode 3: Particles ---

function drawParticles(w, h) {
    var data = getFrequencyData();
    if (!data) return;

    var rgb = hexToRgb(accentColor);

    // Calculate energy from bass frequencies
    var bass = 0;
    for (var i = 0; i < 10; i++) bass += data[i];
    bass = bass / (10 * 255);

    var mid = 0;
    for (var i = 10; i < 40; i++) mid += data[i];
    mid = mid / (30 * 255);

    var treble = 0;
    for (var i = 40; i < 80; i++) treble += data[i];
    treble = treble / (40 * 255);

    // Spawn particles based on energy
    var spawnCount = Math.floor(bass * 6) + Math.floor(mid * 3);
    for (var s = 0; s < spawnCount; s++) {
        particles.push({
            x: w / 2 + (Math.random() - 0.5) * w * 0.3,
            y: h / 2 + (Math.random() - 0.5) * h * 0.3,
            vx: (Math.random() - 0.5) * (2 + bass * 6),
            vy: (Math.random() - 0.5) * (2 + bass * 6),
            life: 1,
            decay: 0.008 + Math.random() * 0.015,
            size: 1.5 + Math.random() * 3 + bass * 3,
            hueShift: Math.random() * 40 - 20
        });
    }

    // Limit particles
    if (particles.length > 500) {
        particles = particles.slice(particles.length - 500);
    }

    // Update and draw
    var alive = [];
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // slight gravity
        p.life -= p.decay;

        if (p.life <= 0) continue;
        alive.push(p);

        var alpha = p.life * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + clamp(rgb.r + p.hueShift, 0, 255) + ',' +
            clamp(rgb.g + p.hueShift, 0, 255) + ',' +
            clamp(rgb.b + p.hueShift, 0, 255) + ',' + alpha + ')';
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = p.size * 2;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    particles = alive;

    // Central energy ring
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 30 + bass * 60, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', ' + (bass * 0.5) + ')';
    ctx.lineWidth = 2 + mid * 4;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 20 + bass * 30;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Treble ring
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 60 + treble * 40, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (treble * 0.2) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// --- Helpers ---

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 29, g: 185, b: 84 }; // fallback green
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
        '.viz-mode-btn:hover { opacity: 0.85; transform: scale(1.08); }' +
        '.viz-mode-btn { transition: all 0.15s; }';
    document.head.appendChild(style);
}
