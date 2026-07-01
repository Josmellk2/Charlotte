// Import Firebase SDK from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. SOUND SYNTHESIZER (WEB AUDIO API)
// ==========================================

let audioCtx = null;
let isMusicPlaying = false;
let sequenceInterval = null;
let delayNode = null;
let masterVolume = null;
let currentChordIndex = 0;
let currentNoteIndex = 0;
let nextNoteTime = 0.0;

// Chord progression: Cmaj9 -> Am9 -> Fmaj7 -> G9 (Magical harp feel)
const chords = [
    [261.63, 329.63, 392.00, 493.88, 523.25, 493.88, 392.00, 329.63], // C4, E4, G4, B4, C5, B4, G4, E4
    [220.00, 261.63, 329.63, 392.00, 440.00, 392.00, 329.63, 261.63], // A3, C4, E4, G4, A4, G4, E4, C4
    [174.61, 220.00, 261.63, 329.63, 349.23, 329.63, 261.63, 220.00], // F3, A3, C4, E4, F4, E4, C4, A3
    [196.00, 246.94, 293.66, 349.23, 392.00, 349.23, 293.66, 246.94]  // G3, B3, D4, F4, G4, F4, D4, B3
];

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    masterVolume = audioCtx.createGain();
    masterVolume.gain.value = 0.25; // Safe comfortable level
    
    // Feedback delay line for a spacious, glowing forest chime effect
    delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.45;
    
    let feedback = audioCtx.createGain();
    feedback.gain.value = 0.35;
    
    delayNode.connect(feedback);
    feedback.connect(delayNode);
    
    masterVolume.connect(audioCtx.destination);
    delayNode.connect(masterVolume);
}

function playPluck(frequency, startTime, duration = 0.6, type = 'sine') {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.6, startTime + 0.03); // Fast attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Exp decay
    
    osc.connect(gainNode);
    gainNode.connect(masterVolume);
    gainNode.connect(delayNode);
    
    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
}

function playNote(freq, type = 'sine') {
    if (!audioCtx) initAudio();
    playPluck(freq, audioCtx.currentTime, 0.6, type);
}

function playMagicChime() {
    if (!audioCtx) initAudio();
    let now = audioCtx.currentTime;
    // Ascending arpeggio
    let notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
    notes.forEach((freq, idx) => {
        playPluck(freq, now + idx * 0.05, 0.4, 'sine');
    });
}

function playSquirrelSqueak() {
    if (!audioCtx) initAudio();
    let now = audioCtx.currentTime;
    // Squeak sound effect
    playPluck(880.00, now, 0.08, 'triangle');
    playPluck(1320.00, now + 0.06, 0.12, 'triangle');
}

function playBirdSinging() {
    if (!audioCtx) initAudio();
    let now = audioCtx.currentTime;
    // Chattering tweet-tweet
    playPluck(987.77, now, 0.06, 'sine');
    playPluck(1174.66, now + 0.08, 0.06, 'sine');
    playPluck(1567.98, now + 0.14, 0.08, 'sine');
    playPluck(1318.51, now + 0.22, 0.06, 'sine');
    playPluck(1567.98, now + 0.28, 0.12, 'sine');
}

function playHappyBirthday() {
    if (!audioCtx) initAudio();
    let now = audioCtx.currentTime;
    
    // Happy birthday melody notes in C
    const melody = [
        {f: 392.00, d: 0.25}, {f: 392.00, d: 0.25}, {f: 440.00, d: 0.5}, {f: 392.00, d: 0.5}, {f: 523.25, d: 0.5}, {f: 493.88, d: 1.0}, // G G A G C B
        {f: 392.00, d: 0.25}, {f: 392.00, d: 0.25}, {f: 440.00, d: 0.5}, {f: 392.00, d: 0.5}, {f: 587.33, d: 0.5}, {f: 523.25, d: 1.0}, // G G A G D C
        {f: 392.00, d: 0.25}, {f: 392.00, d: 0.25}, {f: 783.99, d: 0.5}, {f: 659.25, d: 0.5}, {f: 523.25, d: 0.5}, {f: 493.88, d: 0.5}, {f: 440.00, d: 1.0}, // G G G E C B A
        {f: 698.46, d: 0.25}, {f: 698.46, d: 0.25}, {f: 659.25, d: 0.5}, {f: 523.25, d: 0.5}, {f: 587.33, d: 0.5}, {f: 523.25, d: 1.2}  // F F E C D C
    ];
    
    let accumTime = 0;
    melody.forEach(note => {
        // Play with triangle for warm music box sound
        playPluck(note.f, now + accumTime, note.d * 1.6, 'triangle');
        accumTime += note.d * 0.7;
    });
}

function startSequencer() {
    if (!audioCtx) initAudio();
    isMusicPlaying = true;
    nextNoteTime = audioCtx.currentTime;
    
    function scheduler() {
        while (nextNoteTime < audioCtx.currentTime + 0.1) {
            let noteFreq = chords[currentChordIndex][currentNoteIndex];
            
            // Sub-bass root note on step 0
            if (currentNoteIndex === 0) {
                playPluck(noteFreq / 2, nextNoteTime, 1.8, 'sine');
            }
            
            // Sweet soft arpeggio notes
            playPluck(noteFreq, nextNoteTime, 0.9, 'sine');
            
            nextNoteTime += 0.38; // Tempo (plucking speed)
            currentNoteIndex++;
            if (currentNoteIndex >= 8) {
                currentNoteIndex = 0;
                currentChordIndex = (currentChordIndex + 1) % chords.length;
            }
        }
        if (isMusicPlaying) {
            sequenceInterval = setTimeout(scheduler, 25);
        }
    }
    scheduler();
}

function stopSequencer() {
    isMusicPlaying = false;
    clearTimeout(sequenceInterval);
}

// Toggle audio state
const btnToggleMusic = document.getElementById('btn-toggle-music');
const musicStatusText = btnToggleMusic.querySelector('.music-status-text');

function toggleMusic() {
    if (!audioCtx) {
        initAudio();
    }
    
    if (isMusicPlaying) {
        stopSequencer();
        btnToggleMusic.classList.remove('playing');
        musicStatusText.textContent = "Música: Apagada";
    } else {
        startSequencer();
        btnToggleMusic.classList.add('playing');
        musicStatusText.textContent = "Música: Encendida";
    }
}

btnToggleMusic.addEventListener('click', toggleMusic);

// ==========================================
// 2. PARTICLE ENGINE (SPARKLES & CONFETTI)
// ==========================================

// --- Sparkle Trail Canvas ---
const sparkleCanvas = document.getElementById('sparkle-canvas');
const sCtx = sparkleCanvas.getContext('2d');
let sparkles = [];

function resizeSparkleCanvas() {
    sparkleCanvas.width = window.innerWidth;
    sparkleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSparkleCanvas);
resizeSparkleCanvas();

class Sparkle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5 - 0.3; // Slight upward drift
        this.size = Math.random() * 6 + 3;
        this.maxLife = Math.random() * 25 + 15;
        this.life = this.maxLife;
        // Warm gold/pastel colors matching forest magic
        const hues = [45, 55, 310, 325, 275]; // gold, soft yellow, pink, hot pink, purple
        const randomHue = hues[Math.floor(Math.random() * hues.length)];
        this.color = `hsl(${randomHue}, 100%, 80%)`;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw() {
        let opacity = this.life / this.maxLife;
        sCtx.save();
        sCtx.globalAlpha = opacity;
        sCtx.translate(this.x, this.y);
        sCtx.fillStyle = this.color;
        sCtx.shadowBlur = 8;
        sCtx.shadowColor = this.color;
        
        // 4-point star path
        sCtx.beginPath();
        sCtx.moveTo(0, -this.size);
        sCtx.quadraticCurveTo(0, 0, this.size, 0);
        sCtx.quadraticCurveTo(0, 0, 0, this.size);
        sCtx.quadraticCurveTo(0, 0, -this.size, 0);
        sCtx.quadraticCurveTo(0, 0, 0, -this.size);
        sCtx.closePath();
        sCtx.fill();
        sCtx.restore();
    }
}

// Track mouse/touch for sparkles
let mouseActive = false;
window.addEventListener('mousemove', (e) => {
    mouseActive = true;
    // Spawn a couple particles
    for (let i = 0; i < 2; i++) {
        sparkles.push(new Sparkle(e.clientX, e.clientY));
    }
});

window.addEventListener('touchmove', (e) => {
    mouseActive = true;
    if (e.touches.length > 0) {
        for (let i = 0; i < 2; i++) {
            sparkles.push(new Sparkle(e.touches[0].clientX, e.touches[0].clientY));
        }
    }
}, { passive: true });

// --- Confetti Canvas ---
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx = confettiCanvas.getContext('2d');
let confetti = [];
let isConfettiRunning = false;

function resizeConfettiCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfettiCanvas);
resizeConfettiCanvas();

class ConfettiPiece {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 6;
        const hues = [330, 300, 270, 190, 45, 120]; // Pinks, purples, cyan, gold, green
        this.color = `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 90%, 65%)`;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = -Math.random() * 10 - 6; // Initial pop upwards
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 8;
        this.gravity = 0.2;
        this.friction = 0.98;
    }
    update() {
        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
    }
    draw() {
        cCtx.save();
        cCtx.translate(this.x, this.y);
        cCtx.rotate(this.rotation * Math.PI / 180);
        cCtx.fillStyle = this.color;
        // Sparkly shadow
        cCtx.shadowBlur = 4;
        cCtx.shadowColor = this.color;
        cCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        cCtx.restore();
    }
}

function triggerConfetti() {
    isConfettiRunning = true;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.65; // Spawn around cake area
    
    // Spawn 180 pieces of confetti
    for (let i = 0; i < 180; i++) {
        confetti.push(new ConfettiPiece(
            centerX + (Math.random() - 0.5) * 100, 
            centerY + (Math.random() - 0.5) * 50
        ));
    }
}

// --- Main Animation Loop (Sparkles & Confetti) ---
function animateParticles() {
    // 1. Render Sparkles
    sCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
    for (let i = sparkles.length - 1; i >= 0; i--) {
        sparkles[i].update();
        if (sparkles[i].life <= 0) {
            sparkles.splice(i, 1);
        } else {
            sparkles[i].draw();
        }
    }
    
    // 2. Render Confetti
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    if (isConfettiRunning) {
        for (let i = confetti.length - 1; i >= 0; i--) {
            confetti[i].update();
            // Remove offscreen particles
            if (confetti[i].y > confettiCanvas.height + 20 || confetti[i].x < -20 || confetti[i].x > confettiCanvas.width + 20) {
                confetti.splice(i, 1);
            } else {
                confetti[i].draw();
            }
        }
        if (confetti.length === 0) {
            isConfettiRunning = false;
        }
    }
    
    requestAnimationFrame(animateParticles);
}
requestAnimationFrame(animateParticles);

// ==========================================
// 3. CURTAIN & FOREST ENTRY
// ==========================================

const magicCurtain = document.getElementById('magic-curtain');
const btnEnterForest = document.getElementById('btn-enter-forest');
const mainContainer = document.getElementById('main-container');

btnEnterForest.addEventListener('click', () => {
    // Fade curtain out
    magicCurtain.classList.add('fade-out');
    // Reveal main page
    mainContainer.classList.add('visible');
    
    // Init sound systems and start arpeggios
    initAudio();
    startSequencer();
    btnToggleMusic.classList.add('playing');
    musicStatusText.textContent = "Música: Encendida";
    
    // Play splash chime sound
    playMagicChime();
    
    // Trigger visual confetti burst immediately on entry for excitement!
    setTimeout(() => {
        triggerConfetti();
    }, 800);
});

// ==========================================
// 4. ANIMAL INTERACTIONS
// ==========================================

const cardUnicorn = document.getElementById('card-unicorn');
const cardSquirrel = document.getElementById('card-squirrel');
const cardBird = document.getElementById('card-bird');

function triggerCardAnimation(card, soundCallback) {
    // Prevent double triggers
    card.classList.remove('glow-pulse');
    void card.offsetWidth; // Trigger reflow to restart animation
    card.classList.add('glow-pulse');
    
    // Play specific animal sound
    soundCallback();
    
    // Spawn extra sparkles over the card coordinates
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + window.scrollX;
    const centerY = rect.top + rect.height / 2 + window.scrollY;
    
    for (let i = 0; i < 15; i++) {
        const offset = 40;
        const sx = centerX + (Math.random() - 0.5) * offset;
        const sy = centerY + (Math.random() - 0.5) * offset;
        sparkles.push(new Sparkle(sx, sy));
    }
}

cardUnicorn.addEventListener('click', () => {
    triggerCardAnimation(cardUnicorn, playMagicChime);
});

cardSquirrel.addEventListener('click', () => {
    triggerCardAnimation(cardSquirrel, playSquirrelSqueak);
});

cardBird.addEventListener('click', () => {
    triggerCardAnimation(cardBird, playBirdSinging);
});

// ==========================================
// 5. CAKE VELAS INTERACTIVE SYSTEM
// ==========================================

const flameButtons = document.querySelectorAll('.candle-flame-btn');
const candlesCounter = document.getElementById('candles-counter');
const celebrationModal = document.getElementById('celebration-modal');
const btnCloseCelebration = document.getElementById('btn-close-celebration');
const btnRelight = document.getElementById('btn-relight');

let blownCandlesCount = 0;
const totalCandles = flameButtons.length;

flameButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        if (!btn.classList.contains('blown')) {
            btn.classList.add('blown');
            blownCandlesCount++;
            
            // Update counter
            candlesCounter.textContent = totalCandles - blownCandlesCount;
            
            // Play sound effect
            playPluck(523.25 + (blownCandlesCount * 80), audioCtx.currentTime, 0.4, 'triangle'); // ascending notes
            
            // Sparkles burst at candle flame point
            const rect = btn.getBoundingClientRect();
            const fx = rect.left + rect.width / 2;
            const fy = rect.top + rect.height / 2;
            
            // Spawn 10 smoke-colored & gold sparkles
            for (let i = 0; i < 12; i++) {
                const sp = new Sparkle(fx, fy);
                sp.color = Math.random() > 0.4 ? 'rgba(255, 235, 150, 0.9)' : 'rgba(220, 220, 220, 0.7)';
                sparkles.push(sp);
            }
            
            // If all 7 are blown out
            if (blownCandlesCount === totalCandles) {
                triggerCelebration();
            }
        }
    });
});

function triggerCelebration() {
    // Play happy birthday melody
    setTimeout(() => {
        playHappyBirthday();
    }, 500);
    
    // Trigger massive confetti explosion
    triggerConfetti();
    // Burst again after 1.5 seconds for extra premium feel
    setTimeout(triggerConfetti, 1200);
    setTimeout(triggerConfetti, 2500);
    
    // Show Modal celebration
    setTimeout(() => {
        celebrationModal.classList.remove('hide');
    }, 1000);
    
    // Show reset button
    btnRelight.classList.remove('hide');
}

btnCloseCelebration.addEventListener('click', () => {
    celebrationModal.classList.add('hide');
});

// Relight the candles
btnRelight.addEventListener('click', () => {
    blownCandlesCount = 0;
    candlesCounter.textContent = totalCandles;
    flameButtons.forEach(btn => btn.classList.remove('blown'));
    btnRelight.classList.add('hide');
    playMagicChime();
});

// ==========================================
// 6. GUESTBOOK PARCHMENT WISHEBOARD
// ==========================================

const formWish = document.getElementById('form-wish');
const inputAuthor = document.getElementById('input-author');
const inputMessage = document.getElementById('input-message');
const wishesList = document.getElementById('wishes-list');

// Firebase Configuration: The user can replace this placeholder config with their real Firebase Config!
// If left as is, the page automatically falls back to using LocalStorage gracefully.
const firebaseConfig = {
  apiKey: "AIzaSyAOYHNG7ej5Qec-q8wN8rRImc1ryQbGS34",
  authDomain: "charlotte-7-cumple.firebaseapp.com",
  databaseURL: "https://charlotte-7-cumple-default-rtdb.firebaseio.com",
  projectId: "charlotte-7-cumple",
  storageBucket: "charlotte-7-cumple.firebasestorage.app",
  messagingSenderId: "1004051238669",
  appId: "1:1004051238669:web:6d059ca9fc259dab4c6a44",
  measurementId: "G-9FMRD2KEBX"
};

let db = null;
let isFirebaseEnabled = false;

// Check if configuration has been filled out
if (firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        isFirebaseEnabled = true;
        console.log("Firebase Firestore initialized successfully! Listening for real-time wishes.");
    } catch (e) {
        console.warn("Failed to initialize Firebase, falling back to LocalStorage:", e);
    }
}

// Default initial wishes representing animals and fantasy characters
const defaultWishes = [
    {
        author: "El Hada del Bosque",
        message: "¡Mis mejores polvos de estrellas para ti hoy! Deseo que siempre sonrías y que nunca dejes de soñar. ✨🦋",
        date: Date.now() - 1000 * 60 * 60 * 5 // 5 hours ago
    },
    {
        author: "Tus amigos Unicornios",
        message: "¡Que este año esté lleno de galopes divertidos sobre arcoíris y juegos mágicos! ¡Feliz cumpleaños Charlotte! 🦄🌈",
        date: Date.now() - 1000 * 60 * 60 * 12 // 12 hours ago
    }
];

// Helper to render wishes on the paper scroll
function renderWishesList(wishes) {
    // Clear container
    wishesList.innerHTML = '';
    
    // Sort by date descending
    wishes.sort((a, b) => b.date - a.date);
    
    // Populate
    wishes.forEach(wish => {
        const card = document.createElement('div');
        card.className = 'wish-card';
        
        const text = document.createElement('p');
        text.className = 'wish-text';
        text.textContent = `“${wish.message}”`;
        
        const author = document.createElement('span');
        author.className = 'wish-author-info';
        author.textContent = `- ${wish.author}`;
        
        card.appendChild(text);
        card.appendChild(author);
        wishesList.appendChild(card);
    });
}

// Load and sync wishes
function loadWishes() {
    if (isFirebaseEnabled && db) {
        // Query Firestore collection 'wishes' ordered by date desc, limit to 50
        const wishesRef = collection(db, "wishes");
        const q = query(wishesRef, orderBy("date", "desc"), limit(50));
        
        // Listen in real-time
        onSnapshot(q, (snapshot) => {
            let wishes = [];
            snapshot.forEach((doc) => {
                wishes.push(doc.data());
            });
            
            // If empty, show default animal wishes
            if (wishes.length === 0) {
                wishes = [...defaultWishes];
            }
            renderWishesList(wishes);
        }, (error) => {
            console.error("Firestore onSnapshot error, falling back to LocalStorage:", error);
            loadLocalStorageWishes();
        });
    } else {
        loadLocalStorageWishes();
    }
}

function loadLocalStorageWishes() {
    let savedWishes = localStorage.getItem('charlotte_birthday_wishes');
    let wishes = savedWishes ? JSON.parse(savedWishes) : defaultWishes;
    renderWishesList(wishes);
}

formWish.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const author = inputAuthor.value.trim();
    const message = inputMessage.value.trim();
    
    if (author && message) {
        const newWish = {
            author: author,
            message: message,
            date: Date.now()
        };
        
        // Audio and visual chime feedback
        playMagicChime();
        
        // Spawn sparkles at scroll guestbook location
        const scrollRect = wishesList.getBoundingClientRect();
        for (let i = 0; i < 20; i++) {
            sparkles.push(new Sparkle(
                scrollRect.left + scrollRect.width/2 + (Math.random() - 0.5)*150,
                scrollRect.top + (Math.random() - 0.5)*50 + window.scrollY
            ));
        }

        try {
            if (isFirebaseEnabled && db) {
                // Save to Firebase Firestore collection 'wishes'
                await addDoc(collection(db, "wishes"), newWish);
            } else {
                // Fallback to LocalStorage
                let savedWishes = localStorage.getItem('charlotte_birthday_wishes');
                let wishes = savedWishes ? JSON.parse(savedWishes) : [...defaultWishes];
                wishes.push(newWish);
                localStorage.setItem('charlotte_birthday_wishes', JSON.stringify(wishes));
                loadLocalStorageWishes();
            }
        } catch (err) {
            console.error("Error saving wish:", err);
        }
        
        // Clear input fields
        inputAuthor.value = '';
        inputMessage.value = '';
    }
});

// Load wishes on start
loadWishes();

// ==========================================
// 7. SCROLL-DRIVEN ANIMATIONS FALLBACK
// ==========================================

// If browser does not support CSS scroll-driven animations native features:
if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
    
    // Apply scroll listener fallbacks for the parallax cards and animal entries
    const observerOptions = {
        root: null,
        threshold: Array.from({ length: 101 }, (_, i) => i / 100) // 100 thresholds for smooth ratios
    };
    
    // 1. Fallback for Princess portrait and card
    const princessSection = document.getElementById('princess-section');
    const princessPortrait = princessSection.querySelector('.princess-portrait-frame');
    const princessStory = princessSection.querySelector('.princess-story-card');
    
    const princessObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const ratio = entry.intersectionRatio;
            // Map ratio to opacity and transform
            princessPortrait.style.opacity = ratio * 1.2;
            princessPortrait.style.transform = `translateX(${-100 + (ratio * 100)}px) rotate(${-15 + (ratio * 13)}deg) scale(${0.85 + (ratio * 0.15)})`;
            
            princessStory.style.opacity = ratio * 1.2;
            princessStory.style.transform = `translateX(${100 - (ratio * 100)}px) scale(${0.9 + (ratio * 0.1)})`;
        });
    }, observerOptions);
    
    princessObserver.observe(princessSection);
    
    // 2. Fallback for Animals cards
    const animalsSection = document.getElementById('animals-section');
    const animalCards = animalsSection.querySelectorAll('.animal-card');
    
    const animalsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const ratio = entry.intersectionRatio;
            animalCards.forEach((card, index) => {
                const staggerRatio = Math.min(1, ratio * (1 + index * 0.15));
                card.style.opacity = staggerRatio;
                card.style.transform = `translateY(${80 - (staggerRatio * 80)}px) scale(${0.9 + (staggerRatio * 0.1)})`;
            });
        });
    }, { root: null, threshold: Array.from({ length: 51 }, (_, i) => i / 50) });
    
    animalsObserver.observe(animalsSection);

    // 3. Fallback for Birthday cake zoom
    const cakeSection = document.getElementById('cake-section');
    const cakeContainer = cakeSection.querySelector('.cake-image-container');
    
    const cakeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const ratio = entry.intersectionRatio;
            cakeContainer.style.opacity = 0.6 + (ratio * 0.4);
            cakeContainer.style.transform = `scale(${0.85 + (ratio * 0.15)})`;
        });
    }, observerOptions);
    
    cakeObserver.observe(cakeSection);

    // 4. Fallback for wishes scroll
    const wishesSection = document.getElementById('wishes-section');
    const scrollContainer = wishesSection.querySelector('.scroll-container');
    
    const wishesObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const ratio = entry.intersectionRatio;
            scrollContainer.style.opacity = ratio;
            scrollContainer.style.transform = `translateY(${120 - (ratio * 120)}px) scale(${0.9 + (ratio * 0.1)})`;
        });
    }, observerOptions);
    
    wishesObserver.observe(wishesSection);
}
