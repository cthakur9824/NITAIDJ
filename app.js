// --- NITAI DJ - Web Audio API Synthesizer & Visualizer Controller ---

// State Management
const state = {
    isPlaying: false,
    activeCharacter: 'ram',
    activeTrackId: 'ram_1',
    volume: 0.7,
    tempoScale: 1.0, // 0.8x to 1.2x
    filterCutoff: 10000, // Hz
    visualizerMode: 'circle', // 'circle' or 'bars'
    
    // Audio Web API components
    audioCtx: null,
    masterGain: null,
    filterNode: null,
    analyserNode: null,
    schedulerIntervalId: null,
    
    // Sequencer Clock
    current16thStep: 0,
    nextStepTime: 0.0,
    scheduleAheadTime: 0.1, // How far ahead to schedule audio (seconds)
    lookahead: 25.0, // How frequently to call scheduler (ms)
    
    // Tracks Data
    tracks: {
        'ram_1': { title: 'Kodanda Warrior (Psytrance Mix)', bpm: 138, scale: 'D_MINOR', charName: 'Lord Ram Theme' },
        'ram_2': { title: 'Maryada Purushottam (Goa Trance Dhun)', bpm: 140, scale: 'D_MINOR', charName: 'Lord Ram Theme' },
        'laxman_1': { title: 'Lakshman Rekha Shield (Hardstyle)', bpm: 145, scale: 'E_MINOR', charName: 'Laxman Theme' },
        'laxman_2': { title: 'Saumitra Guard Rhythms', bpm: 142, scale: 'E_MINOR', charName: 'Laxman Theme' },
        'hanuman_1': { title: 'Hanuman Chalisa (Goa Psytrance Mix)', bpm: 140, scale: 'C_MINOR', charName: 'Hanuman Theme' },
        'hanuman_2': { title: 'Sanjeevani Bass Drop (Heavy Trance)', bpm: 138, scale: 'C_MINOR', charName: 'Hanuman Theme' },
        'sita_1': { title: 'Janaki Cosmic Mantra (Progressive Trance)', bpm: 132, scale: 'A_MINOR', charName: 'Mata Sita Theme' },
        'sita_2': { title: 'Swayamvar Ambient Resonance', bpm: 128, scale: 'A_MINOR', charName: 'Mata Sita Theme' }
    }
};

// Musical Scales & Frequencies (A4 = 440Hz)
const SCALES = {
    'D_MINOR': [146.83, 164.81, 174.61, 196.00, 220.00, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00], // D3 to A4
    'E_MINOR': [164.81, 185.00, 196.00, 220.00, 246.94, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88], // E3 to B4
    'C_MINOR': [130.81, 146.83, 155.56, 174.61, 196.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00], // C3 to G4
    'A_MINOR': [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33]  // A3 to E5
};

// Theme Color Mapping
const THEME_COLORS = {
    ram: { primary: '#ff9933', shadow: '0 0 25px rgba(255, 153, 51, 0.4)' },
    laxman: { primary: '#ffd700', shadow: '0 0 25px rgba(255, 215, 0, 0.4)' },
    hanuman: { primary: '#ff2a5f', shadow: '0 0 25px rgba(255, 42, 95, 0.4)' },
    sita: { primary: '#00f2fe', shadow: '0 0 25px rgba(0, 242, 254, 0.4)' }
};

// Melodic Patterns (Indexes of scale frequencies, 16 steps)
// 0 represents no note (rest)
const MELODIES = {
    'ram_1': [1, 1, 5, 1, 1, 1, 6, 5, 1, 1, 5, 1, 7, 6, 5, 4],
    'ram_2': [1, 5, 8, 5, 6, 8, 7, 5, 1, 5, 8, 5, 9, 8, 6, 5],
    'laxman_1': [1, 2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8],
    'laxman_2': [5, 5, 5, 7, 8, 8, 8, 7, 6, 6, 6, 5, 4, 3, 2, 1],
    'hanuman_1': [1, 1, 1, 5, 1, 1, 1, 6, 1, 1, 1, 5, 6, 5, 4, 3],
    'hanuman_2': [1, 3, 5, 3, 1, 3, 5, 3, 6, 5, 4, 3, 1, 1, 0, 0],
    'sita_1': [1, 0, 3, 0, 5, 0, 7, 0, 8, 0, 7, 0, 5, 0, 3, 0],
    'sita_2': [5, 0, 4, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0]
};

// Basslines Patterns (0 = rest, 1 = Root note octave 0, 2 = Root note octave 1, etc.)
// Psytrance usually has a "galloping" triplet bass on offbeats: Root - Bass - Bass, Root - Bass - Bass
// In a 16-step grid: [Root, Bass, Bass, 0, Root, Bass, Bass, 0...]
const BASSLINES = {
    'ram_1': [1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 1, 2, 2],
    'ram_2': [1, 2, 2, 0, 1, 2, 2, 0, 1, 2, 2, 0, 1, 2, 2, 0],
    'laxman_1': [1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2], // Constant heavy bass
    'laxman_2': [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0],
    'hanuman_1': [1, 2, 2, 0, 1, 2, 2, 0, 1, 2, 2, 0, 1, 2, 2, 2],
    'hanuman_2': [1, 2, 2, 2, 0, 2, 2, 0, 1, 2, 2, 2, 0, 2, 2, 0],
    'sita_1': [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0], // Slower progressive bass
    'sita_2': [1, 0, 1, 0, 2, 0, 2, 0, 1, 0, 1, 0, 2, 0, 2, 0]
};

// Document Elements
const DOM = {
    header: document.getElementById('header'),
    turntable: document.getElementById('main-turntable'),
    tonearm: document.getElementById('main-tonearm'),
    turntableImg: document.getElementById('turntable-img'),
    turntableArtwork: document.getElementById('turntable-artwork'),
    deckPulseRing: document.getElementById('deck-pulse-ring'),
    heroPlayBtn: document.getElementById('hero-play-btn'),
    heroMiniEq: document.getElementById('hero-mini-equalizer'),
    
    // Tabs & Cards
    tabBtns: document.querySelectorAll('.tab-btn'),
    characterCards: document.querySelectorAll('.character-card'),
    trackItems: document.querySelectorAll('.track-item'),
    
    // Mixer Controls
    playbackStatusText: document.getElementById('playback-status-text'),
    nowPlayingImg: document.getElementById('now-playing-img'),
    nowPlayingTitle: document.getElementById('now-playing-title-txt'),
    nowPlayingArtist: document.getElementById('now-playing-artist-txt'),
    bpmDisplayNum: document.getElementById('bpm-display-num'),
    
    volumeSlider: document.getElementById('volume-slider'),
    volumeVal: document.getElementById('vol-val'),
    pitchSlider: document.getElementById('pitch-slider'),
    pitchVal: document.getElementById('pitch-val'),
    filterSlider: document.getElementById('filter-slider'),
    filterVal: document.getElementById('filter-val'),
    
    deckPrevBtn: document.getElementById('deck-prev-btn'),
    deckPlayBtn: document.getElementById('deck-play-btn'),
    deckNextBtn: document.getElementById('deck-next-btn'),
    playBtnIcon: document.getElementById('play-btn-icon'),
    
    // Visualizer
    canvas: document.getElementById('canvas-visualizer'),
    vizModeCircle: document.getElementById('viz-mode-circle'),
    vizModeBars: document.getElementById('viz-mode-bars'),
    
    // Contact
    contactForm: document.getElementById('contact-form'),
    successMessage: document.getElementById('success-message')
};

// Canvas context
let canvasCtx = null;

// Initialize Elements & UI Bindings
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupEventListeners();
    updateThemeStyles();
    
    // Listen for scroll to shrink header
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            DOM.header.classList.add('scrolled');
        } else {
            DOM.header.classList.remove('scrolled');
        }
    });
});

// Canvas Setup
function initCanvas() {
    canvasCtx = DOM.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Draw initial empty visualizer state
    drawVisualizerPlaceholder();
}

function resizeCanvas() {
    const rect = DOM.canvas.parentElement.getBoundingClientRect();
    DOM.canvas.width = rect.width * window.devicePixelRatio;
    DOM.canvas.height = rect.height * window.devicePixelRatio;
    DOM.canvas.style.width = '100%';
    DOM.canvas.style.height = '100%';
    if (canvasCtx) {
        canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
}

// Draw static wave placeholder when not playing
function drawVisualizerPlaceholder() {
    if (!canvasCtx || state.isPlaying) return;
    
    const width = DOM.canvas.width / window.devicePixelRatio;
    const height = DOM.canvas.height / window.devicePixelRatio;
    
    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    canvasCtx.lineWidth = 2;
    
    if (state.visualizerMode === 'circle') {
        canvasCtx.beginPath();
        canvasCtx.arc(width / 2, height / 2, 70, 0, Math.PI * 2);
        canvasCtx.stroke();
        
        canvasCtx.beginPath();
        canvasCtx.arc(width / 2, height / 2, 75, 0, Math.PI * 2);
        canvasCtx.stroke();
    } else {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
    }
    
    if (!state.isPlaying) {
        requestAnimationFrame(drawVisualizerPlaceholder);
    }
}

// Web Audio API Initializer
function initAudio() {
    if (state.audioCtx) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();
    
    // Master Gain
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.value = state.volume;
    
    // Lowpass Filter
    state.filterNode = state.audioCtx.createBiquadFilter();
    state.filterNode.type = 'lowpass';
    state.filterNode.frequency.value = state.filterCutoff;
    state.filterNode.Q.value = 1.0;
    
    // Analyser Node
    state.analyserNode = state.audioCtx.createAnalyser();
    state.analyserNode.fftSize = 256;
    
    // Connect nodes
    state.filterNode.connect(state.analyserNode);
    state.analyserNode.connect(state.masterGain);
    state.masterGain.connect(state.audioCtx.destination);
}

// Change Theme CSS Variables dynamically based on active character
function updateThemeStyles() {
    const char = state.activeCharacter;
    const color = THEME_COLORS[char].primary;
    const shadow = THEME_COLORS[char].shadow;
    
    document.documentElement.style.setProperty('--active-theme-color', color);
    document.documentElement.style.setProperty('--active-neon-shadow', shadow);
    
    // Apply visual effects
    DOM.turntableImg.src = `assets/${char}.png`;
    DOM.nowPlayingImg.src = `assets/${char}.png`;
}

// Setup DOM Event Listeners
function setupEventListeners() {
    
    // Navigation Links Scrolling
    document.querySelectorAll('.nav-links a, .footer-links a, .hero-buttons a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 70,
                        behavior: 'smooth'
                    });
                    
                    // Update active nav link
                    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
                    const correspondingNav = document.querySelector(`.nav-links a[href="#${targetId}"]`);
                    if (correspondingNav) correspondingNav.classList.add('active');
                }
            }
        });
    });
    
    // Mobile Menu Button click
    DOM.header.querySelector('.mobile-menu-btn').addEventListener('click', () => {
        const nav = DOM.header.querySelector('.nav-links');
        if (nav.style.display === 'flex') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
            nav.style.flexDirection = 'column';
            nav.style.position = 'absolute';
            nav.style.top = '70px';
            nav.style.left = '0';
            nav.style.width = '100%';
            nav.style.background = 'rgba(6, 5, 11, 0.95)';
            nav.style.padding = '20px';
            nav.style.gap = '15px';
            nav.style.borderBottom = '1px solid var(--border-color)';
        }
    });

    // Character Selector Tabs
    DOM.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const character = btn.getAttribute('data-character');
            
            // Toggle active tabs
            DOM.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle character cards
            DOM.characterCards.forEach(card => {
                card.classList.remove('active');
                if (card.getAttribute('data-character') === character) {
                    card.classList.add('active');
                }
            });
            
            // Update local state and themes
            state.activeCharacter = character;
            updateThemeStyles();
            
            // Auto load first track of this character into mixer (if not playing)
            if (!state.isPlaying) {
                const firstTrack = character + '_1';
                selectTrack(firstTrack);
            }
        });
    });

    // Playlist Tracks Click
    DOM.trackItems.forEach(item => {
        item.addEventListener('click', () => {
            const trackId = item.getAttribute('data-track-id');
            selectTrack(trackId);
            startPlayback();
        });
    });

    // Playback Main DJ controls
    DOM.deckPlayBtn.addEventListener('click', togglePlayback);
    DOM.heroPlayBtn.addEventListener('click', () => {
        // Trigger play in the mixer deck
        if (!state.isPlaying) {
            togglePlayback();
        }
        window.scrollTo({
            top: DOM.canvas.closest('section').offsetTop - 70,
            behavior: 'smooth'
        });
    });
    
    DOM.deckPrevBtn.addEventListener('click', playPrevTrack);
    DOM.deckNextBtn.addEventListener('click', playNextTrack);

    // Audio Mixer Sliders
    DOM.volumeSlider.addEventListener('input', (e) => {
        state.volume = parseFloat(e.target.value) / 100;
        DOM.volumeVal.textContent = `${e.target.value}%`;
        if (state.masterGain) {
            state.masterGain.gain.value = state.volume;
        }
    });

    DOM.pitchSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.tempoScale = val / 100;
        DOM.pitchVal.textContent = `${state.tempoScale.toFixed(2)}x`;
        
        // Update BPM display counter
        const baseBpm = state.tracks[state.activeTrackId].bpm;
        const liveBpm = Math.round(baseBpm * state.tempoScale);
        DOM.bpmDisplayNum.textContent = liveBpm;
    });

    DOM.filterSlider.addEventListener('input', (e) => {
        state.filterCutoff = parseInt(e.target.value);
        DOM.filterVal.textContent = `${state.filterCutoff} Hz`;
        if (state.filterNode) {
            // Smooth frequency transition
            state.filterNode.frequency.setValueAtTime(state.filterCutoff, state.audioCtx.currentTime);
        }
    });

    // Visualizer Modes
    DOM.vizModeCircle.addEventListener('click', () => {
        state.visualizerMode = 'circle';
        DOM.vizModeCircle.classList.add('active');
        DOM.vizModeBars.classList.remove('active');
    });

    DOM.vizModeBars.addEventListener('click', () => {
        state.visualizerMode = 'bars';
        DOM.vizModeBars.classList.add('active');
        DOM.vizModeCircle.classList.remove('active');
    });

    // Contact Form Submission
    DOM.contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Custom animation
        DOM.contactForm.style.opacity = '0';
        setTimeout(() => {
            DOM.contactForm.style.display = 'none';
            DOM.successMessage.style.display = 'block';
            DOM.successMessage.style.opacity = '0';
            setTimeout(() => {
                DOM.successMessage.style.opacity = '1';
                DOM.successMessage.style.transform = 'scale(1)';
            }, 50);
        }, 300);
    });
}

// Track Selection
function selectTrack(trackId) {
    state.activeTrackId = trackId;
    
    // Find character name based on track key
    const character = trackId.split('_')[0];
    state.activeCharacter = character;
    updateThemeStyles();
    
    // Update Track UI classes
    DOM.trackItems.forEach(item => {
        item.classList.remove('playing');
        if (item.getAttribute('data-track-id') === trackId) {
            item.classList.add('playing');
        }
    });
    
    // Update Mixer displays
    const track = state.tracks[trackId];
    DOM.nowPlayingTitle.textContent = track.title;
    DOM.nowPlayingArtist.textContent = track.charName;
    
    const liveBpm = Math.round(track.bpm * state.tempoScale);
    DOM.bpmDisplayNum.textContent = liveBpm;
}

// Toggle Playback
function togglePlayback() {
    initAudio();
    
    if (state.isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    initAudio();
    if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
    }
    
    if (state.isPlaying) return;
    
    state.isPlaying = true;
    
    // UI states
    DOM.playBtnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    DOM.turntable.classList.add('playing');
    DOM.tonearm.classList.add('playing');
    DOM.deckPulseRing.classList.add('active');
    DOM.playbackStatusText.innerHTML = `PLAYING SYNTH LIVE`;
    DOM.playbackStatusText.classList.add('live');
    DOM.heroPlayBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        Pause Live Set
    `;
    
    // Activate mini visualizer bars animation in hero
    DOM.heroMiniEq.querySelectorAll('span').forEach((el, index) => {
        el.style.animation = `equalizer-bar ${0.3 + (index * 0.08)}s ease-in-out infinite alternate`;
    });
    
    // Inject animation keyframes for mini EQ if not exists
    if (!document.getElementById('mini-eq-animation')) {
        const style = document.createElement('style');
        style.id = 'mini-eq-animation';
        style.textContent = `
            @keyframes equalizer-bar {
                0% { height: 5px; }
                100% { height: 28px; background-color: var(--active-theme-color); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Start Audio Sequencer Clock
    state.current16thStep = 0;
    state.nextStepTime = state.audioCtx.currentTime;
    scheduler();
    
    // Start Canvas render loop
    renderVisualizer();
}

function stopPlayback() {
    state.isPlaying = false;
    
    // UI states
    DOM.playBtnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    DOM.turntable.classList.remove('playing');
    DOM.tonearm.classList.remove('playing');
    DOM.deckPulseRing.classList.remove('active');
    DOM.playbackStatusText.innerHTML = `DECK DISENGAGED`;
    DOM.playbackStatusText.classList.remove('live');
    DOM.heroPlayBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Play Live Set
    `;
    
    // Disable mini visualizer bars animation
    DOM.heroMiniEq.querySelectorAll('span').forEach(el => {
        el.style.animation = 'none';
        el.style.height = '5px';
    });
    
    // Stop Scheduler
    clearTimeout(state.schedulerIntervalId);
    
    // Reset visualizer to placeholder
    drawVisualizerPlaceholder();
}

function playPrevTrack() {
    const keys = Object.keys(state.tracks);
    let index = keys.indexOf(state.activeTrackId);
    index = (index - 1 + keys.length) % keys.length;
    selectTrack(keys[index]);
    if (state.isPlaying) {
        // Reset timing
        state.nextStepTime = state.audioCtx.currentTime;
    }
}

function playNextTrack() {
    const keys = Object.keys(state.tracks);
    let index = keys.indexOf(state.activeTrackId);
    index = (index + 1) % keys.length;
    selectTrack(keys[index]);
    if (state.isPlaying) {
        // Reset timing
        state.nextStepTime = state.audioCtx.currentTime;
    }
}

// --- Scheduler Clock and Audio Synthesizers ---

function scheduler() {
    if (!state.isPlaying) return;
    
    // While there are notes to play before the next interval, schedule them
    while (state.nextStepTime < state.audioCtx.currentTime + state.scheduleAheadTime) {
        scheduleNextStep(state.current16thStep, state.nextStepTime);
        advanceStep();
    }
    
    // Run loop
    state.schedulerIntervalId = setTimeout(scheduler, state.lookahead);
}

function advanceStep() {
    const track = state.tracks[state.activeTrackId];
    const liveBpm = track.bpm * state.tempoScale;
    
    // Seconds per 16th note = seconds in minute / BPM / 4
    const secondsPerBeat = 60.0 / liveBpm;
    const secondsPer16thStep = 0.25 * secondsPerBeat;
    
    state.nextStepTime += secondsPer16thStep;
    
    // Increment step (looping every 16 steps)
    state.current16thStep = (state.current16thStep + 1) % 16;
}

// Main Synthesizer Dispatcher
function scheduleNextStep(step, time) {
    const trackId = state.activeTrackId;
    const track = state.tracks[trackId];
    const scale = SCALES[track.scale];
    
    // 1. Kick Drum Sequencer (Every beat: steps 0, 4, 8, 12)
    if (step % 4 === 0) {
        synthesizeKick(time);
    }
    
    // For fast-paced tracks (Hanuman Goa, Laxman Rekha, Ram Psy), we add offbeat hats
    // 2. Offbeat Hi-Hat (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
        synthesizeHat(time);
    }
    
    // 3. Synthesize Bassline
    const bassPattern = BASSLINES[trackId];
    const bassStep = bassPattern[step];
    if (bassStep > 0) {
        // Play root note in low octave
        const rootFreq = scale[0];
        // If step is 2, play octave higher
        const multiplier = (bassStep === 2) ? 2.0 : 1.0;
        synthesizeBass(rootFreq * multiplier, time);
    }
    
    // 4. Synthesize Lead Melody
    const melodyPattern = MELODIES[trackId];
    const melodyStep = melodyPattern[step];
    if (melodyStep > 0) {
        // Play corresponding note from the scale
        const noteFreq = scale[melodyStep % scale.length];
        synthesizeLead(noteFreq, time);
    }
}

// Sound Synthesizers using Web Audio Oscillators

// Synthesize a hard-hitting 909-like Kick Drum
function synthesizeKick(time) {
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(state.filterNode);
    
    osc.type = 'sine';
    
    // Exponential frequency drop (pitch sweep) from 180Hz down to 45Hz
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    
    // Volume envelope: rapid attack, fast decay
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(1.0, time + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    
    osc.start(time);
    osc.stop(time + 0.2);
}

// Synthesize an offbeat synthesized Hi-Hat using white noise
function synthesizeHat(time) {
    // Generate static white noise buffer if needed, or simply synthesise short high pitch sine/square
    // Let's use high pass filtered noise or a high frequency sine wave for simplicity and compatibility
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    const filter = state.audioCtx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(state.filterNode);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(10000, time); // High pitch
    
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);
    
    // Short decay envelope
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.15, time + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    
    osc.start(time);
    osc.stop(time + 0.08);
}

// Synthesize a fat, warm analogue-sounding rolling bassline
function synthesizeBass(freq, time) {
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    const filter = state.audioCtx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(state.filterNode);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    
    // Sub-bass filter: lowpass filter to remove buzzing highs
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, time);
    
    // Bass decay envelope
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.7, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    
    osc.start(time);
    osc.stop(time + 0.14);
}

// Synthesize energetic Vedic Lead Synth Melodies
function synthesizeLead(freq, time) {
    const osc1 = state.audioCtx.createOscillator();
    const osc2 = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    
    // Slightly detune oscillators for a rich, wide EDM super-saw sound
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(state.filterNode);
    
    // Determine synth lead type based on character
    if (state.activeCharacter === 'sita') {
        // Mata Sita: soft, flute-like sine/triangle leads
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc2.detune.setValueAtTime(7, time); // Subtle pitch spread
        
        // Ethereal slow volume envelope
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.2, time + 0.06);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    } else if (state.activeCharacter === 'laxman') {
        // Laxman: aggressive, sharp sawtooth/square shield leads
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc2.detune.setValueAtTime(-15, time);
        
        // Plucky, immediate decay envelope
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.25, time + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    } else if (state.activeCharacter === 'hanuman') {
        // Hanuman: massive, full-on psytrance leads
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.detune.setValueAtTime(-10, time);
        osc2.detune.setValueAtTime(10, time);
        
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.3, time + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    } else {
        // Lord Ram: heroic, anthemic brassy saws
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc2.detune.setValueAtTime(12, time);
        
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.28, time + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    }
    
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);
    
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.35);
    osc2.stop(time + 0.35);
}

// --- HTML5 Canvas Render Loop ---

function renderVisualizer() {
    if (!state.isPlaying || !canvasCtx || !state.analyserNode) return;
    
    const width = DOM.canvas.width / window.devicePixelRatio;
    const height = DOM.canvas.height / window.devicePixelRatio;
    
    const bufferLength = state.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    state.analyserNode.getByteFrequencyData(dataArray);
    
    // Clear canvas
    canvasCtx.clearRect(0, 0, width, height);
    
    // Get Theme Color
    const themeColor = THEME_COLORS[state.activeCharacter].primary;
    
    if (state.visualizerMode === 'circle') {
        // --- DRAW VEDIC SPHERE ---
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Calculate bass volume to pulse the core radius
        let bassSum = 0;
        for (let i = 0; i < 8; i++) {
            bassSum += dataArray[i];
        }
        const bassVal = bassSum / 8;
        const pulseRadius = 60 + (bassVal / 255) * 35;
        
        // Glow effect
        canvasCtx.shadowBlur = 20;
        canvasCtx.shadowColor = themeColor;
        
        // 1. Draw glowing inner solid core
        const coreGradient = canvasCtx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulseRadius);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        coreGradient.addColorStop(0.5, `${themeColor}20`);
        coreGradient.addColorStop(1, 'transparent');
        canvasCtx.fillStyle = coreGradient;
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        canvasCtx.fill();
        
        // 2. Draw circular frequency spikes
        canvasCtx.lineWidth = 2.5;
        canvasCtx.strokeStyle = themeColor;
        canvasCtx.beginPath();
        
        const numPoints = 80;
        for (let i = 0; i < numPoints; i++) {
            // Map data index
            const dataIdx = Math.floor((i / numPoints) * (bufferLength * 0.7));
            const rawVal = dataArray[dataIdx];
            const spikeHeight = (rawVal / 255) * 80;
            
            const angle = (i / numPoints) * Math.PI * 2;
            const r = pulseRadius + spikeHeight;
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
        }
        canvasCtx.closePath();
        canvasCtx.stroke();
        
        // 3. Draw outer orbital rings
        canvasCtx.shadowBlur = 8;
        canvasCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, pulseRadius + 90, 0, Math.PI * 2);
        canvasCtx.stroke();
        
        // Reset shadows
        canvasCtx.shadowBlur = 0;
        
    } else {
        // --- DRAW FREQUENCY WAVES (BARS) ---
        const barWidth = (width / bufferLength) * 1.6;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * (height * 0.7);
            
            // Generate glowing gradient for each bar
            const grad = canvasCtx.createLinearGradient(x, height, x, height - barHeight);
            grad.addColorStop(0, '#06050b');
            grad.addColorStop(0.5, themeColor);
            grad.addColorStop(1, '#ffffff');
            
            canvasCtx.fillStyle = grad;
            
            // Draw bar with slight top rounding
            canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
            
            x += barWidth;
        }
    }
    
    // Next frame
    requestAnimationFrame(renderVisualizer);
}
