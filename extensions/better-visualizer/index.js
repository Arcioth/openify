var api = null;
var container = null;
var miniCanvas = null;
var miniCtx = null;
var miniFrame = null;
var mainCanvas = null;
var mainCtx = null;

// Base visualizer has modes 0-3 (Bars, Wave, Circle, Particles)
// We add modes 4-8: Snow, Flame, Runner, Boulder, Bicycle
var EXTRA_MODES = ['Snow', 'Flame', 'Runner', 'Boulder', 'Bicycle'];
var ALL_MODES = ['Bars', 'Wave', 'Circle', 'Particles', 'Snow', 'Flame', 'Runner', 'Boulder', 'Bicycle'];
var ALL_ICONS = [
    'fas fa-chart-bar', 'fas fa-wave-square', 'fas fa-circle-notch', 'fas fa-sparkles',
    'fas fa-snowflake', 'fas fa-fire', 'fas fa-running', 'fas fa-mountain', 'fas fa-bicycle'
];
var mode = 0;
var isVisible = false;
var accentColor = '#1db954';

// Audio context — shared with base visualizer via the same audio element
var audioCtx = null;
var analyser = null;
var source = null;

// Animation state
var snowflakes = [];
var flames = [];
var runnerFrame = 0;
var runnerX = 0;
var boulderAngle = 0;
var boulderX = 0;
var bikeWheelAngle = 0;
var bikeX = 0;
var terrainPoints = [];
var terrainSeed = 0;

module.exports = {
    init(_api) {
        api = _api;

        api.ui.registerSidebarItem({
            id: 'better-visualizer',
            label: 'Visualizer',
            icon: 'fas fa-wave-square',
            order: 55,
            replaces: 'visualizer',
            onClick: function(el) {
                container = el;
                isVisible = true;
                buildUI();
                ensureAudio();
                startMainLoop();
            }
        });

        api.ui.registerPlayerWidget({
            id: 'bv-mini',
            render: function(el) {
                el.style.cssText = 'width:80px; height:32px; flex-shrink:0; cursor:pointer; border-radius:6px; overflow:hidden';
                el.title = 'Mini Visualizer';
                var c = document.createElement('canvas');
                c.style.cssText = 'width:100%; height:100%; display:block';
                el.appendChild(c);
                miniCanvas = c;
                miniCtx = c.getContext('2d');
                resizeMini();
                startMiniLoop();
                el.onclick = function() {
                    var btn = document.querySelector('.nav-item[data-ext="better-visualizer"]');
                    if (btn) btn.click();
                };
            }
        });

        api.events.on('playbackStateChange', onPlaybackChange);
        api.events.on('trackChange', onTrackChange);
        api.events.on('themeChange', readAccent);

        loadMode();
        readAccent();
        return module.exports;
    },

    disable: function() {
        stopMainLoop();
        stopMiniLoop();
        isVisible = false;
        container = null;
        mainCanvas = null;
        mainCtx = null;
    },

    destroy: function() {
        stopMainLoop();
        stopMiniLoop();
        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close(); } catch(e) {}
        }
        audioCtx = null;
        analyser = null;
        source = null;
        miniCanvas = null;
        miniCtx = null;
        mainCanvas = null;
        mainCtx = null;
        container = null;
        api = null;
        snowflakes = [];
        flames = [];
        terrainPoints = [];
    }
};

// --- Persist ---

async function loadMode() {
    if (!api) return;
    var stored = await api.storage.get('bvMode');
    if (typeof stored === 'number' && stored >= 0 && stored < ALL_MODES.length) {
        mode = stored;
    }
}

function saveMode() {
    if (!api) return;
    api.storage.set('bvMode', mode);
}

// --- Audio ---

function ensureAudio() {
    if (analyser) return;
    var audioEl = document.getElementById('audio');
    if (!audioEl) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!source) source = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    } catch(e) {
        console.warn('BetterViz audio setup:', e.message);
    }
}

function getFreq() {
    if (!analyser) return null;
    var d = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(d);
    return d;
}

function getTime() {
    if (!analyser) return null;
    var d = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(d);
    return d;
}

function getBands(data) {
    if (!data) return { bass: 0, mid: 0, treble: 0, avg: 0 };
    var bass = 0, mid = 0, treble = 0;
    for (var i = 0; i < 10; i++) bass += data[i];
    bass /= 2550;
    for (var i = 10; i < 40; i++) mid += data[i];
    mid /= 7650;
    for (var i = 40; i < 80; i++) treble += data[i];
    treble /= 10200;
    var avg = (bass + mid + treble) / 3;
    return { bass: bass, mid: mid, treble: treble, avg: avg };
}

// --- Events ---

function onPlaybackChange() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function onTrackChange() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    snowflakes = [];
    flames = [];
    terrainPoints = [];
    terrainSeed = Math.random() * 1000;
    runnerX = 0;
    boulderX = 0;
    bikeX = 0;
}

function readAccent() {
    var c = getComputedStyle(document.body).getPropertyValue('--accent');
    if (c) accentColor = c.trim();
}

// --- Mini player widget ---

function resizeMini() {
    if (!miniCanvas) return;
    var r = miniCanvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    miniCanvas.width = r.width * dpr;
    miniCanvas.height = r.height * dpr;
    miniCtx.scale(dpr, dpr);
}

function startMiniLoop() {
    stopMiniLoop();
    tickMini();
}

function stopMiniLoop() {
    if (miniFrame) { cancelAnimationFrame(miniFrame); miniFrame = null; }
}

function tickMini() {
    drawMini();
    miniFrame = requestAnimationFrame(tickMini);
}

function drawMini() {
    if (!miniCtx || !miniCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = miniCanvas.width / dpr;
    var h = miniCanvas.height / dpr;

    miniCtx.clearRect(0, 0, w, h);
    miniCtx.fillStyle = 'rgba(0,0,0,0.6)';
    miniCtx.fillRect(0, 0, w, h);

    ensureAudio();
    var data = getFreq();
    if (!data) return;

    var rgb = hexToRgb(accentColor);
    var barCount = 20;
    var gap = 1;
    var barW = (w - gap * (barCount - 1)) / barCount;

    for (var i = 0; i < barCount; i++) {
        // Sample from spread across frequency data
        var idx = Math.floor(i * data.length / barCount);
        var val = data[idx] / 255;
        var barH = val * h * 0.9;
        var x = i * (barW + gap);
        var y = h - barH;

        var alpha = 0.5 + val * 0.5;
        miniCtx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
        miniCtx.fillRect(x, y, barW, barH);
    }
}

// --- Main visualizer ---

var mainFrame = null;

function startMainLoop() {
    stopMainLoop();
    if (!isVisible) return;
    readAccent();
    tickMain();
}

function stopMainLoop() {
    if (mainFrame) { cancelAnimationFrame(mainFrame); mainFrame = null; }
}

function tickMain() {
    if (!isVisible || !mainCanvas || !mainCtx) return;
    drawMain();
    mainFrame = requestAnimationFrame(tickMain);
}

function buildUI() {
    if (!container) return;
    readAccent();

    container.innerHTML =
        '<div style="display:flex; flex-direction:column; height:100%; position:relative">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; padding:0 8px; margin-bottom:12px; flex-shrink:0">' +
        '<div style="font-size:20px; font-weight:800">Visualizer</div>' +
        '<div style="display:flex; gap:4px; flex-wrap:wrap; max-width:320px; justify-content:flex-end" id="bv-mode-btns"></div>' +
        '</div>' +
        '<div style="flex:1; position:relative; min-height:0">' +
        '<canvas id="bv-canvas" style="width:100%; height:100%; display:block; border-radius:12px"></canvas>' +
        '</div>' +
        '<div style="text-align:center; margin-top:10px; flex-shrink:0">' +
        '<div id="bv-mode-label" style="font-size:11px; color:var(--text-sub); font-weight:600; text-transform:uppercase; letter-spacing:1px">' + ALL_MODES[mode] + '</div>' +
        '</div></div>';

    var btnC = container.querySelector('#bv-mode-btns');
    for (var i = 0; i < ALL_MODES.length; i++) {
        (function(idx) {
            var btn = document.createElement('button');
            btn.className = 'bv-mode-btn' + (idx === mode ? ' bv-active' : '');
            btn.innerHTML = '<i class="' + ALL_ICONS[idx] + '"></i>';
            btn.title = ALL_MODES[idx];
            btn.style.cssText = 'background:' + (idx === mode ? 'var(--accent)' : 'var(--bg-card)') +
                '; border:none; color:' + (idx === mode ? '#fff' : 'var(--text-sub)') +
                '; width:30px; height:30px; border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.2s; display:flex; align-items:center; justify-content:center';
            btn.onclick = function() {
                mode = idx;
                saveMode();
                snowflakes = [];
                flames = [];
                terrainPoints = [];
                runnerX = 0;
                boulderX = 0;
                bikeX = 0;
                updateModeButtons();
            };
            btnC.appendChild(btn);
        })(i);
    }

    mainCanvas = container.querySelector('#bv-canvas');
    mainCtx = mainCanvas.getContext('2d');
    resizeMain();

    if (window.ResizeObserver) {
        new ResizeObserver(function() { resizeMain(); }).observe(mainCanvas.parentElement);
    }

    injectStyles();
}

function resizeMain() {
    if (!mainCanvas) return;
    var r = mainCanvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    mainCanvas.width = r.width * dpr;
    mainCanvas.height = r.height * dpr;
    mainCtx.scale(dpr, dpr);
    terrainPoints = [];
}

function updateModeButtons() {
    if (!container) return;
    var btns = container.querySelectorAll('.bv-mode-btn');
    for (var i = 0; i < btns.length; i++) {
        var a = i === mode;
        btns[i].style.background = a ? 'var(--accent)' : 'var(--bg-card)';
        btns[i].style.color = a ? '#fff' : 'var(--text-sub)';
    }
    var label = container.querySelector('#bv-mode-label');
    if (label) label.textContent = ALL_MODES[mode];
}

// --- Main draw dispatcher ---

function drawMain() {
    if (!mainCtx || !mainCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = mainCanvas.width / dpr;
    var h = mainCanvas.height / dpr;

    mainCtx.clearRect(0, 0, w, h);
    mainCtx.fillStyle = '#0a0a0a';
    mainCtx.fillRect(0, 0, w, h);

    ensureAudio();

    switch (mode) {
        case 0: drawBars(mainCtx, w, h); break;
        case 1: drawWave(mainCtx, w, h); break;
        case 2: drawCircle(mainCtx, w, h); break;
        case 3: drawParticles(mainCtx, w, h); break;
        case 4: drawSnow(mainCtx, w, h); break;
        case 5: drawFlame(mainCtx, w, h); break;
        case 6: drawRunner(mainCtx, w, h); break;
        case 7: drawBoulder(mainCtx, w, h); break;
        case 8: drawBicycle(mainCtx, w, h); break;
    }
}

// =============================================
//  MODES 0-3: Inherited from base visualizer
// =============================================

function drawBars(c, w, h) {
    var data = getFreq();
    if (!data) return;
    var rgb = hexToRgb(accentColor);
    var barCount = Math.min(64, data.length);
    var gap = 3;
    var barW = (w - gap * (barCount - 1)) / barCount;

    for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var barH = val * h * 0.85;
        var x = i * (barW + gap);
        var y = h - barH;
        var grad = c.createLinearGradient(x, h, x, y);
        grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.9)');
        grad.addColorStop(0.6, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        c.fillStyle = grad;
        var rad = Math.min(barW / 2, 4);
        c.beginPath();
        c.moveTo(x, h);
        c.lineTo(x, y + rad);
        c.quadraticCurveTo(x, y, x + rad, y);
        c.lineTo(x + barW - rad, y);
        c.quadraticCurveTo(x + barW, y, x + barW, y + rad);
        c.lineTo(x + barW, h);
        c.fill();
        c.shadowColor = accentColor;
        c.shadowBlur = val * 12;
        c.fill();
        c.shadowBlur = 0;
    }
}

function drawWave(c, w, h) {
    var data = getTime();
    if (!data) return;
    var rgb = hexToRgb(accentColor);
    var mid = h / 2;
    var sw = w / data.length;

    c.beginPath();
    for (var i = 0; i < data.length; i++) {
        var v = data[i] / 128.0;
        var y = v * mid;
        var x = i * sw;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.lineTo(w, mid); c.lineTo(0, mid);
    c.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.08)';
    c.fill();

    c.beginPath();
    for (var i = 0; i < data.length; i++) {
        var v = data[i] / 128.0;
        var y = v * mid;
        var x = i * sw;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = accentColor;
    c.lineWidth = 2.5;
    c.shadowColor = accentColor;
    c.shadowBlur = 10;
    c.stroke();
    c.shadowBlur = 0;
}

function drawCircle(c, w, h) {
    var data = getFreq();
    if (!data) return;
    var cx = w / 2, cy = h / 2;
    var baseR = Math.min(w, h) * 0.2;
    var maxR = Math.min(w, h) * 0.42;
    var bars = Math.min(120, data.length);
    var rgb = hexToRgb(accentColor);

    var avg = 0;
    for (var i = 0; i < bars; i++) avg += data[i];
    avg = avg / bars / 255;

    var gg = c.createRadialGradient(cx, cy, 0, cx, cy, baseR * (1 + avg * 0.5));
    gg.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.15 + avg * 0.2) + ')');
    gg.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');
    c.fillStyle = gg;
    c.beginPath();
    c.arc(cx, cy, baseR * (1 + avg * 0.5), 0, Math.PI * 2);
    c.fill();

    c.beginPath();
    c.arc(cx, cy, baseR, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
    c.lineWidth = 1.5;
    c.stroke();

    for (var i = 0; i < bars; i++) {
        var val = data[i] / 255;
        var angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        var len = val * (maxR - baseR);
        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
        c.lineTo(cx + Math.cos(angle) * (baseR + len), cy + Math.sin(angle) * (baseR + len));
        c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.4 + val * 0.6) + ')';
        c.lineWidth = Math.max(1.5, (Math.PI * 2 * baseR) / bars * 0.6);
        c.shadowColor = accentColor;
        c.shadowBlur = val * 8;
        c.stroke();
        c.shadowBlur = 0;
    }
}

// Particles state from base
var particles = [];

function drawParticles(c, w, h) {
    var data = getFreq();
    if (!data) return;
    var rgb = hexToRgb(accentColor);
    var bands = getBands(data);

    var spawn = Math.floor(bands.bass * 6) + Math.floor(bands.mid * 3);
    for (var s = 0; s < spawn; s++) {
        particles.push({
            x: w / 2 + (Math.random() - 0.5) * w * 0.3,
            y: h / 2 + (Math.random() - 0.5) * h * 0.3,
            vx: (Math.random() - 0.5) * (2 + bands.bass * 6),
            vy: (Math.random() - 0.5) * (2 + bands.bass * 6),
            life: 1, decay: 0.008 + Math.random() * 0.015,
            size: 1.5 + Math.random() * 3 + bands.bass * 3,
            hs: Math.random() * 40 - 20
        });
    }
    if (particles.length > 500) particles = particles.slice(-500);

    var alive = [];
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life -= p.decay;
        if (p.life <= 0) continue;
        alive.push(p);
        c.beginPath();
        c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        c.fillStyle = 'rgba(' + clamp(rgb.r + p.hs) + ',' + clamp(rgb.g + p.hs) + ',' + clamp(rgb.b + p.hs) + ',' + (p.life * 0.8) + ')';
        c.shadowColor = accentColor;
        c.shadowBlur = p.size * 2;
        c.fill();
        c.shadowBlur = 0;
    }
    particles = alive;

    c.beginPath();
    c.arc(w / 2, h / 2, 30 + bands.bass * 60, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (bands.bass * 0.5) + ')';
    c.lineWidth = 2 + bands.mid * 4;
    c.shadowColor = accentColor;
    c.shadowBlur = 20 + bands.bass * 30;
    c.stroke();
    c.shadowBlur = 0;
}

// =============================================
//  MODE 4: Snow
// =============================================

function drawSnow(c, w, h) {
    var data = getFreq();
    var bands = data ? getBands(data) : { bass: 0, mid: 0, treble: 0, avg: 0 };
    var rgb = hexToRgb(accentColor);

    // Sky gradient
    var sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0a1a');
    sky.addColorStop(1, '#151530');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Ground
    c.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.06)';
    c.fillRect(0, h * 0.85, w, h * 0.15);

    // Spawn snowflakes
    var spawn = Math.floor(1 + bands.avg * 8);
    for (var s = 0; s < spawn; s++) {
        snowflakes.push({
            x: Math.random() * w,
            y: -5,
            size: 1.5 + Math.random() * 3 + bands.bass * 2,
            speed: 0.5 + Math.random() * 1.5 + bands.mid * 2,
            drift: (Math.random() - 0.5) * 0.8,
            opacity: 0.4 + Math.random() * 0.6,
            wobble: Math.random() * Math.PI * 2
        });
    }
    if (snowflakes.length > 400) snowflakes = snowflakes.slice(-400);

    // Update and draw snowflakes
    var alive = [];
    for (var i = 0; i < snowflakes.length; i++) {
        var f = snowflakes[i];
        f.y += f.speed;
        f.wobble += 0.03;
        f.x += f.drift + Math.sin(f.wobble) * 0.5 + bands.treble * (Math.random() - 0.5) * 2;

        if (f.y > h + 5) continue;
        alive.push(f);

        c.beginPath();
        c.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        c.fillStyle = 'rgba(220, 230, 255, ' + f.opacity + ')';
        c.shadowColor = 'rgba(200, 220, 255, 0.5)';
        c.shadowBlur = f.size * 2;
        c.fill();
        c.shadowBlur = 0;
    }
    snowflakes = alive;

    // Bass pulse glow at bottom
    if (bands.bass > 0.1) {
        var glow = c.createRadialGradient(w / 2, h, 0, w / 2, h, w * 0.4 * bands.bass);
        glow.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (bands.bass * 0.15) + ')');
        glow.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');
        c.fillStyle = glow;
        c.fillRect(0, 0, w, h);
    }
}

// =============================================
//  MODE 5: Flame
// =============================================

function drawFlame(c, w, h) {
    var data = getFreq();
    var bands = data ? getBands(data) : { bass: 0, mid: 0, treble: 0, avg: 0 };

    // Dark bg
    c.fillStyle = '#0a0500';
    c.fillRect(0, 0, w, h);

    // Spawn flame particles from bottom
    var spawn = Math.floor(3 + bands.bass * 15 + bands.mid * 8);
    for (var s = 0; s < spawn; s++) {
        var spread = w * 0.3 + bands.bass * w * 0.2;
        flames.push({
            x: w / 2 + (Math.random() - 0.5) * spread,
            y: h,
            vx: (Math.random() - 0.5) * (1 + bands.treble * 3),
            vy: -(2 + Math.random() * 3 + bands.bass * 5),
            life: 1,
            decay: 0.01 + Math.random() * 0.02,
            size: 3 + Math.random() * 5 + bands.bass * 4,
            hue: Math.random()  // 0=red, 0.5=yellow, 1=white
        });
    }
    if (flames.length > 600) flames = flames.slice(-600);

    var alive = [];
    for (var i = 0; i < flames.length; i++) {
        var f = flames[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy *= 0.98;
        f.vx += (Math.random() - 0.5) * 0.3;
        f.life -= f.decay;

        if (f.life <= 0) continue;
        alive.push(f);

        // Color transitions: red → orange → yellow → white as life decreases
        var r, g, b;
        if (f.life > 0.7) {
            r = 255; g = Math.floor(80 + f.hue * 40); b = 0;
        } else if (f.life > 0.4) {
            r = 255; g = Math.floor(150 + f.hue * 60); b = Math.floor(20 + f.hue * 30);
        } else {
            r = 255; g = Math.floor(200 + f.hue * 55); b = Math.floor(80 + f.life * 100);
        }

        c.beginPath();
        c.arc(f.x, f.y, f.size * f.life, 0, Math.PI * 2);
        c.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (f.life * 0.7) + ')';
        c.shadowColor = 'rgba(255, 100, 0, 0.5)';
        c.shadowBlur = f.size * 3 * f.life;
        c.fill();
        c.shadowBlur = 0;
    }
    flames = alive;

    // Core glow
    var coreSize = 60 + bands.bass * 100;
    var cg = c.createRadialGradient(w / 2, h, 0, w / 2, h, coreSize);
    cg.addColorStop(0, 'rgba(255, 200, 50, ' + (0.2 + bands.bass * 0.3) + ')');
    cg.addColorStop(0.5, 'rgba(255, 80, 0, ' + (0.1 + bands.mid * 0.15) + ')');
    cg.addColorStop(1, 'rgba(255, 0, 0, 0)');
    c.fillStyle = cg;
    c.fillRect(0, 0, w, h);
}

// =============================================
//  MODE 6: Runner (stick figure running)
// =============================================

function drawRunner(c, w, h) {
    var data = getFreq();
    var bands = data ? getBands(data) : { bass: 0, mid: 0, treble: 0, avg: 0 };
    var rgb = hexToRgb(accentColor);

    // Ground line
    var groundY = h * 0.75;
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, groundY);
    c.lineTo(w, groundY);
    c.stroke();

    // Speed based on music energy
    var speed = 1 + bands.avg * 8;
    runnerFrame += speed * 0.15;
    runnerX += speed;
    if (runnerX > w + 50) runnerX = -50;

    // Draw background energy bars (subtle)
    if (data) {
        c.globalAlpha = 0.08;
        var barCount = 32;
        for (var i = 0; i < barCount; i++) {
            var idx = Math.floor(i * data.length / barCount);
            var val = data[idx] / 255;
            var bw = w / barCount;
            c.fillStyle = accentColor;
            c.fillRect(i * bw, groundY - val * groundY * 0.8, bw - 1, val * groundY * 0.8);
        }
        c.globalAlpha = 1;
    }

    // Draw stick figure
    var cx = runnerX;
    var cy = groundY;
    var scale = 1 + bands.bass * 0.3;
    var bounce = Math.abs(Math.sin(runnerFrame)) * 10 * scale;
    cy -= bounce;

    // Running animation using sin
    var legAngle = Math.sin(runnerFrame) * 0.6;
    var armAngle = -legAngle;

    c.strokeStyle = accentColor;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.shadowColor = accentColor;
    c.shadowBlur = 5 + bands.bass * 15;

    // Head
    c.beginPath();
    c.arc(cx, cy - 45 * scale, 8 * scale, 0, Math.PI * 2);
    c.stroke();

    // Body
    c.beginPath();
    c.moveTo(cx, cy - 37 * scale);
    c.lineTo(cx, cy - 10 * scale);
    c.stroke();

    // Arms
    var armLen = 18 * scale;
    c.beginPath();
    c.moveTo(cx, cy - 30 * scale);
    c.lineTo(cx + Math.sin(armAngle) * armLen, cy - 30 * scale + Math.cos(armAngle) * armLen);
    c.stroke();
    c.beginPath();
    c.moveTo(cx, cy - 30 * scale);
    c.lineTo(cx - Math.sin(armAngle) * armLen, cy - 30 * scale + Math.cos(armAngle) * armLen);
    c.stroke();

    // Legs
    var legLen = 22 * scale;
    c.beginPath();
    c.moveTo(cx, cy - 10 * scale);
    c.lineTo(cx + Math.sin(legAngle) * legLen, cy - 10 * scale + Math.cos(legAngle) * legLen);
    c.stroke();
    c.beginPath();
    c.moveTo(cx, cy - 10 * scale);
    c.lineTo(cx - Math.sin(legAngle) * legLen, cy - 10 * scale + Math.cos(legAngle) * legLen);
    c.stroke();

    c.shadowBlur = 0;
    c.lineCap = 'butt';

    // Trail particles
    if (bands.avg > 0.05) {
        for (var t = 0; t < 3; t++) {
            var tx = cx - 10 - Math.random() * 20;
            var ty = groundY - Math.random() * 5;
            c.beginPath();
            c.arc(tx, ty, 1 + Math.random() * 2, 0, Math.PI * 2);
            c.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.2 + bands.avg * 0.3) + ')';
            c.fill();
        }
    }
}

// =============================================
//  MODE 7: Boulder (rolling boulder on terrain)
// =============================================

function drawBoulder(c, w, h) {
    var data = getFreq();
    var bands = data ? getBands(data) : { bass: 0, mid: 0, treble: 0, avg: 0 };
    var rgb = hexToRgb(accentColor);

    // Generate terrain if needed
    if (terrainPoints.length === 0) {
        terrainPoints = [];
        var segments = Math.ceil(w / 20) + 5;
        for (var i = 0; i < segments; i++) {
            var tx = i * 20;
            var ty = h * 0.65 + Math.sin(terrainSeed + i * 0.3) * 30 + Math.sin(terrainSeed + i * 0.1) * 50;
            terrainPoints.push({ x: tx, y: ty });
        }
    }

    // Draw sky
    var sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0a0a');
    sky.addColorStop(1, '#151510');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Draw terrain
    c.beginPath();
    c.moveTo(0, h);
    for (var i = 0; i < terrainPoints.length; i++) {
        var scrollX = terrainPoints[i].x - boulderX * 0.3;
        // Wrap terrain
        var wrappedX = ((scrollX % (terrainPoints.length * 20)) + terrainPoints.length * 20) % (terrainPoints.length * 20);
        // Audio-reactive terrain deformation
        var audioY = terrainPoints[i].y;
        if (data) {
            var idx = Math.floor((i / terrainPoints.length) * data.length);
            audioY -= (data[idx] / 255) * 20;
        }
        c.lineTo(wrappedX, audioY);
    }
    c.lineTo(w, h);
    c.closePath();
    c.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.15)';
    c.fill();
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.4)';
    c.lineWidth = 2;
    c.stroke();

    // Boulder
    var speed = 1 + bands.avg * 6;
    boulderX += speed;
    boulderAngle += speed * 0.05;

    var boulderCX = w * 0.35;
    var boulderR = 20 + bands.bass * 15;
    // Find ground Y at boulder position
    var boulderGround = h * 0.65;
    var boulderCY = boulderGround - boulderR - 5 - bands.bass * 10;

    // Glow
    c.shadowColor = accentColor;
    c.shadowBlur = 10 + bands.bass * 20;

    // Boulder body
    c.beginPath();
    c.arc(boulderCX, boulderCY, boulderR, 0, Math.PI * 2);
    c.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.6)';
    c.fill();
    c.strokeStyle = accentColor;
    c.lineWidth = 2;
    c.stroke();

    // Rotation lines inside boulder
    for (var l = 0; l < 4; l++) {
        var a = boulderAngle + (l * Math.PI / 2);
        c.beginPath();
        c.moveTo(boulderCX, boulderCY);
        c.lineTo(boulderCX + Math.cos(a) * boulderR * 0.7, boulderCY + Math.sin(a) * boulderR * 0.7);
        c.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        c.lineWidth = 1.5;
        c.stroke();
    }

    c.shadowBlur = 0;

    // Dust trail
    for (var d = 0; d < Math.floor(2 + bands.avg * 5); d++) {
        var dx = boulderCX - boulderR - Math.random() * 30;
        var dy = boulderCY + boulderR + Math.random() * 5 - 3;
        c.beginPath();
        c.arc(dx, dy, 1 + Math.random() * 3, 0, Math.PI * 2);
        c.fillStyle = 'rgba(150, 130, 100, ' + (0.1 + Math.random() * 0.2) + ')';
        c.fill();
    }
}

// =============================================
//  MODE 8: Bicycle
// =============================================

function drawBicycle(c, w, h) {
    var data = getFreq();
    var bands = data ? getBands(data) : { bass: 0, mid: 0, treble: 0, avg: 0 };
    var rgb = hexToRgb(accentColor);

    var groundY = h * 0.75;
    var speed = 1 + bands.avg * 8;
    bikeX += speed;
    bikeWheelAngle += speed * 0.08;

    // Draw subtle background frequency bars
    if (data) {
        c.globalAlpha = 0.06;
        for (var i = 0; i < 48; i++) {
            var idx = Math.floor(i * data.length / 48);
            var val = data[idx] / 255;
            var bw = w / 48;
            c.fillStyle = accentColor;
            c.fillRect(i * bw, groundY - val * groundY * 0.6, bw - 1, val * groundY * 0.6);
        }
        c.globalAlpha = 1;
    }

    // Ground
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, groundY);
    c.lineTo(w, groundY);
    c.stroke();

    // Road dashes (scrolling)
    c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.15)';
    c.lineWidth = 2;
    c.setLineDash([15, 20]);
    c.beginPath();
    var dashOffset = -(bikeX * 3) % 35;
    c.lineDashOffset = dashOffset;
    c.moveTo(0, groundY + 15);
    c.lineTo(w, groundY + 15);
    c.stroke();
    c.setLineDash([]);

    // Bike position
    var bikeCX = w * 0.4;
    var bounce = Math.abs(Math.sin(bikeWheelAngle * 2)) * 3 * bands.bass;
    var bikeY = groundY - bounce;
    var wheelR = 18 + bands.bass * 5;

    c.strokeStyle = accentColor;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.shadowColor = accentColor;
    c.shadowBlur = 5 + bands.bass * 10;

    // Rear wheel
    var rearX = bikeCX - 22;
    var rearY = bikeY - wheelR;
    c.beginPath();
    c.arc(rearX, rearY, wheelR, 0, Math.PI * 2);
    c.stroke();
    // Spokes
    for (var sp = 0; sp < 6; sp++) {
        var sa = bikeWheelAngle + sp * Math.PI / 3;
        c.beginPath();
        c.moveTo(rearX, rearY);
        c.lineTo(rearX + Math.cos(sa) * wheelR * 0.85, rearY + Math.sin(sa) * wheelR * 0.85);
        c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
        c.lineWidth = 1;
        c.stroke();
    }

    // Front wheel
    c.strokeStyle = accentColor;
    c.lineWidth = 2.5;
    var frontX = bikeCX + 22;
    var frontY = bikeY - wheelR;
    c.beginPath();
    c.arc(frontX, frontY, wheelR, 0, Math.PI * 2);
    c.stroke();
    // Spokes
    for (var sp = 0; sp < 6; sp++) {
        var sa = bikeWheelAngle + sp * Math.PI / 3;
        c.beginPath();
        c.moveTo(frontX, frontY);
        c.lineTo(frontX + Math.cos(sa) * wheelR * 0.85, frontY + Math.sin(sa) * wheelR * 0.85);
        c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.3)';
        c.lineWidth = 1;
        c.stroke();
    }

    c.strokeStyle = accentColor;
    c.lineWidth = 2.5;

    // Frame
    var seatX = rearX + 5;
    var seatY = rearY - 22;
    var handleX = frontX - 2;
    var handleY = frontY - 20;

    // Seat tube
    c.beginPath();
    c.moveTo(rearX, rearY);
    c.lineTo(seatX, seatY);
    c.stroke();
    // Top tube
    c.beginPath();
    c.moveTo(seatX, seatY);
    c.lineTo(handleX, handleY);
    c.stroke();
    // Down tube
    c.beginPath();
    c.moveTo(handleX, handleY);
    c.lineTo(frontX, frontY);
    c.stroke();
    // Chain stay
    c.beginPath();
    c.moveTo(rearX, rearY);
    c.lineTo(frontX, frontY);
    c.stroke();

    // Handlebars
    c.beginPath();
    c.moveTo(handleX - 5, handleY - 5);
    c.lineTo(handleX + 5, handleY + 3);
    c.stroke();

    // Seat
    c.beginPath();
    c.moveTo(seatX - 6, seatY - 2);
    c.lineTo(seatX + 6, seatY - 2);
    c.lineWidth = 3;
    c.stroke();

    // Rider (stick figure)
    c.lineWidth = 2.5;
    var riderScale = 1 + bands.bass * 0.15;
    // Body
    c.beginPath();
    c.moveTo(seatX, seatY - 4);
    c.lineTo(seatX - 2, seatY - 28 * riderScale);
    c.stroke();
    // Head
    c.beginPath();
    c.arc(seatX - 3, seatY - 32 * riderScale, 6, 0, Math.PI * 2);
    c.stroke();
    // Arms to handlebar
    c.beginPath();
    c.moveTo(seatX - 2, seatY - 20 * riderScale);
    c.lineTo(handleX, handleY - 2);
    c.stroke();
    // Legs (pedaling)
    var pedalAngle = bikeWheelAngle * 2;
    var pedalR = 8;
    var pedalCX = (rearX + frontX) / 2;
    var pedalCY = rearY + 3;
    c.beginPath();
    c.moveTo(seatX, seatY - 4);
    c.lineTo(pedalCX + Math.cos(pedalAngle) * pedalR, pedalCY + Math.sin(pedalAngle) * pedalR);
    c.stroke();
    c.beginPath();
    c.moveTo(seatX, seatY - 4);
    c.lineTo(pedalCX + Math.cos(pedalAngle + Math.PI) * pedalR, pedalCY + Math.sin(pedalAngle + Math.PI) * pedalR);
    c.stroke();

    c.shadowBlur = 0;
    c.lineCap = 'butt';

    // Speed trail
    if (bands.avg > 0.05) {
        for (var t = 0; t < Math.floor(2 + bands.avg * 4); t++) {
            var ty = bikeY - wheelR + Math.random() * wheelR * 2;
            var tx = bikeCX - 40 - Math.random() * 30;
            var tl = 5 + Math.random() * 15 + bands.avg * 20;
            c.beginPath();
            c.moveTo(tx, ty);
            c.lineTo(tx - tl, ty);
            c.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.1 + bands.avg * 0.2) + ')';
            c.lineWidth = 1;
            c.stroke();
        }
    }
}

// =============================================
//  Helpers
// =============================================

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 29, g: 185, b: 84 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function clamp(val) {
    return Math.max(0, Math.min(255, Math.round(val)));
}

var stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
        '.bv-mode-btn { transition: all 0.15s; }' +
        '.bv-mode-btn:hover { opacity:0.85; transform:scale(1.08); }';
    document.head.appendChild(style);
}
