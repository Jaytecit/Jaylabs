const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsContainer = document.getElementById('stats');
const gameStatus = document.getElementById('game-status');
const restartBtn = document.getElementById('restartBtn');
const celebrationOverlay = document.getElementById('celebration-overlay');
const winnerNameEl = document.getElementById('winner-name');
const summaryOverlay = document.getElementById('summary-overlay');
const summaryList = document.getElementById('summary-list');
const nextMatchBtn = document.getElementById('nextMatchBtn');
const commentaryLog = document.getElementById('commentary-log');
const narratorToggleBtn = document.getElementById('narratorToggleBtn');
const voiceSelect = document.getElementById('voiceSelect');
const repeatLastBetBtn = document.getElementById('repeatLastBetBtn');
const arenaStatsContainer = document.getElementById('arena-stats');

// Tier 5: Economy, Betting & Analytics
let bank = parseInt(localStorage.getItem('ballArena_bank')) || 1000;
let userBets = []; // { ballId, type, amount, odds }
let matchData = []; // { x, y, force }
let matchRankings = []; // Track elimination order
let currentCompetitors = [];
let lastMatchBettingResult = 0;
let sessionWins = 0;
let sessionLosses = 0;
let narratorEnabled = true;
let speechQueue = []; // Manual queue to prevent stale announcements
let isSpeaking = false;

const bankDisplay = document.getElementById('bankDisplay');
const bettingOverlay = document.getElementById('bettingOverlay');
const bettingGrid = document.getElementById('bettingGrid');
const startMatchBtn = document.getElementById('startMatchBtn');
const scrapRunBtn = document.getElementById('scrapRunBtn');
const heatmapCanvas = document.getElementById('heatmapCanvas');
const hctx = heatmapCanvas.getContext('2d');
const betAmountInput = document.getElementById('betAmountInput');
const purchaseGoldenBallBtn = document.getElementById('purchaseGoldenBallBtn');
const resetDataBtn = document.getElementById('resetDataBtn');

let goldenBallPurchased = false;

const saveBank = () => {
    localStorage.setItem('ballArena_bank', bank);
    if (bankDisplay) bankDisplay.textContent = `Credits: ${bank}`;
};

// Initialize bank display on load
saveBank();

// Tricast state
let tricastSelection = []; // [name1, name2, name3]

function showBettingOverlay() {
    gameActive = false;
    bettingOverlay.classList.remove('fade-out');
    bettingGrid.innerHTML = '';
    userBets = [];
    tricastSelection = [];
    goldenBallPurchased = false;
    purchaseGoldenBallBtn.disabled = false;
    purchaseGoldenBallBtn.style.opacity = '1';

    // Select 5 competitors for the match
    const shuffledNames = [...ballNames].sort(() => 0.5 - Math.random());
    currentCompetitors = shuffledNames.slice(0, 5);

    // Update Repeat Last Bet Button state
    if (repeatLastBetBtn) {
        const lastBets = JSON.parse(localStorage.getItem('ballArena_lastBets') || '[]');
        if (lastBets.length > 0) {
            repeatLastBetBtn.style.display = 'block';
            repeatLastBetBtn.disabled = false;
            repeatLastBetBtn.style.opacity = '1';
        } else {
            repeatLastBetBtn.style.display = 'none';
        }
    }

    // Main betting cards
    currentCompetitors.forEach((name, i) => {
        const stats = hallOfFame[name] || { wins: 0, games: 0 };
        const wins = typeof stats === 'number' ? stats : (stats.wins || 0);
        const winOdds = (5.0 / (1 + wins * 0.2)).toFixed(1);
        const ewOdds = (winOdds / 2).toFixed(1);

        const card = document.createElement('div');
        card.className = 'bet-card';
        card.innerHTML = `
            <h3 style="margin:0">${name}</h3>
            <p style="font-size:12px; opacity:0.6">${wins} Wins</p>
            <div style="margin-top:10px; display:flex; flex-direction:column; gap:5px;">
                <button onclick="placeBet('${name}', 'win', ${winOdds}, this)" style="background:#00f2ff; color:#000; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">Win: ${winOdds}x</button>
                <button onclick="placeBet('${name}', 'eachway', ${ewOdds}, this)" style="background:#ffd700; color:#000; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">E.W: ${ewOdds}x</button>
                <button onclick="addToTricast('${name}', this)" style="background:#bc00ff; color:#fff; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">Add Tricast</button>
            </div>
        `;
        bettingGrid.appendChild(card);
    });

    // Populate Competitor Stats Table
    const statsTableBody = document.querySelector('#competitor-stats-table tbody');
    statsTableBody.innerHTML = '';
    currentCompetitors.forEach(name => {
        const stats = hallOfFame[name] || { wins: 0, games: 0, kills: 0 };
        const wins = typeof stats === 'number' ? stats : (stats.wins || 0);
        const games = stats.games || wins || 0;
        const winRate = games > 0 ? ((wins / games) * 100).toFixed(0) : 0;
        const kills = stats.kills || 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color:#fff; font-weight:bold;">${name}</td>
            <td>${wins}</td>
            <td>${games}</td>
            <td style="color:#00f2ff">${winRate}%</td>
            <td style="color:#ff3300">${kills}</td>
        `;
        statsTableBody.appendChild(row);
    });

    saveBank();
    scrapRunBtn.style.display = 'block';
}

window.addToTricast = (name, btn) => {
    if (tricastSelection.includes(name)) return;
    tricastSelection.push(name);
    if (btn) {
        btn.style.opacity = '0.5';
        btn.disabled = true;
    }
    logCommentary(`Tricast sequence part ${tricastSelection.length}: ${name}`);

    if (tricastSelection.length === 3) {
        const baseAmount = parseInt(betAmountInput.value) || 50;
        const amount = baseAmount * 2; // Tricast is double the base wager
        if (bank < amount) {
            speak("Insufficient credits for Tricast.");
            tricastSelection = [];
            // Re-enable buttons if tricast fails due to insufficient funds
            Array.from(bettingGrid.children).forEach(card => {
                Array.from(card.querySelectorAll('button')).forEach(button => {
                    if (button.textContent.includes('Add Tricast')) {
                        button.style.opacity = '1';
                        button.disabled = false;
                    }
                });
            });
            return;
        }
        bank -= amount;
        saveBank();
        userBets.push({ name: tricastSelection.join(','), type: 'tricast', amount, odds: 50 }); // Fixed 50x for tricast
        logCommentary(`Tricast locked on: ${tricastSelection.join(', ')}`);
        speak(`Tricast placed for ${amount}. High stakes!`);
    } else {
        speak(`${name} added to prediction.`);
    }
};

window.placeBet = (name, type, odds, btn) => {
    const amount = parseInt(betAmountInput.value) || 50;
    if (bank < amount) {
        speak("Insufficient credits.");
        return;
    }
    bank -= amount;
    saveBank();
    userBets.push({ name, type, amount, odds });
    playSound(600, 'sine', 0.1, 0.2);
    btn.style.background = '#333';
    btn.style.color = '#fff';
    btn.disabled = true;
    speak(`Wagered ${amount} on ${name}.`);
};

purchaseGoldenBallBtn.onclick = () => {
    const cost = 250;
    if (bank < cost) {
        speak("Insufficient credits for Golden Ball.");
        return;
    }
    if (goldenBallPurchased) {
        speak("Golden Ball already purchased.");
        return;
    }
    bank -= cost;
    saveBank();
    goldenBallPurchased = true;
    userBets.push({ name: 'GOLDEN BALL', type: 'special', amount: cost, odds: 0 });
    purchaseGoldenBallBtn.disabled = true;
    purchaseGoldenBallBtn.style.opacity = '0.5';
    speak("Golden Ball purchased! High stakes enabled.");
};

if (repeatLastBetBtn) {
    repeatLastBetBtn.onclick = () => {
        const lastBetsData = localStorage.getItem('ballArena_lastBets');
        if (!lastBetsData) return;
        const lastBets = JSON.parse(lastBetsData);
        let appliedCount = 0;
        let totalCost = 0;

        lastBets.forEach(bet => {
            // Validate if the bet is applicable
            if (bet.type === 'tricast') {
                const names = bet.name.split(',');
                if (names.every(n => currentCompetitors.includes(n))) {
                    totalCost += bet.amount;
                }
            } else if (bet.type === 'special' && bet.name === 'GOLDEN BALL') {
                if (!goldenBallPurchased) {
                    totalCost += bet.amount;
                }
            } else {
                if (currentCompetitors.includes(bet.name)) {
                    totalCost += bet.amount;
                }
            }
        });

        if (totalCost > bank) {
            speak("Insufficient credits for all previous bets.");
            return;
        }

        lastBets.forEach(bet => {
            if (bet.type === 'tricast') {
                const names = bet.name.split(',');
                if (names.every(n => currentCompetitors.includes(n))) {
                    bank -= bet.amount;
                    userBets.push(bet);
                    appliedCount++;
                }
            } else if (bet.type === 'special' && bet.name === 'GOLDEN BALL') {
                if (!goldenBallPurchased) {
                    bank -= bet.amount;
                    goldenBallPurchased = true;
                    userBets.push(bet);
                    purchaseGoldenBallBtn.disabled = true;
                    purchaseGoldenBallBtn.style.opacity = '0.5';
                    appliedCount++;
                }
            } else {
                if (currentCompetitors.includes(bet.name)) {
                    bank -= bet.amount;
                    userBets.push(bet);
                    // Find and disable the specific button in the UI
                    const cards = Array.from(bettingGrid.children);
                    const card = cards.find(c => c.querySelector('h3').textContent === bet.name);
                    if (card) {
                        const buttons = Array.from(card.querySelectorAll('button'));
                        const targetBtn = buttons.find(b => b.textContent.toLowerCase().includes(bet.type));
                        if (targetBtn) {
                            targetBtn.style.background = '#333';
                            targetBtn.style.color = '#fff';
                            targetBtn.disabled = true;
                        }
                    }
                    appliedCount++;
                }
            }
        });

        if (appliedCount > 0) {
            saveBank();
            repeatLastBetBtn.disabled = true;
            repeatLastBetBtn.style.opacity = '0.5';
            speak(`Re-placed ${appliedCount} previous wagers.`);
        } else {
            speak("No previous bets were applicable for this roster.");
        }
    };
}

startMatchBtn.onclick = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (synth) synth.resume();

    // Save current bets as "Last Bets" for the next match
    if (userBets.length > 0) {
        localStorage.setItem('ballArena_lastBets', JSON.stringify(userBets.map(b => ({
            name: b.name,
            type: b.type,
            amount: b.amount,
            odds: b.odds
        }))));
    }

    startOST();
    bettingOverlay.classList.add('fade-out');
    setTimeout(() => init(), 500);
};

// Analytics helpers
function recordCollision(x, y, force) {
    matchData.push({ x, y, force });
    if (force > 15) {
        playSound(0, 'noise', 0.15, 0.4); // Crowd gasp
    }
}

function drawHeatmap() {
    heatmapCanvas.width = width;
    heatmapCanvas.height = height;
    hctx.clearRect(0, 0, width, height);
    matchData.forEach(d => {
        const rad = Math.min(50, d.force * 2.5);
        const grad = hctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, rad);
        grad.addColorStop(0, `rgba(255, 50, 0, ${Math.min(0.4, d.force / 30)})`);
        grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        hctx.fillStyle = grad;
        hctx.beginPath();
        hctx.arc(d.x, d.y, rad, 0, Math.PI * 2);
        hctx.fill();
    });
    heatmapCanvas.style.opacity = '0.7';
}

let width, height, arenaRadius, centerX, centerY;
let baseArenaRadius;
let balls = [];
let particles = [];
let powerups = [];
let shockwaves = [];
let hazards = [];
let arenaRotation = 0;
const arenaSpeed = 0.005;
let gameTime = 0;
const gameDuration = 720000; // 12 minutes for full shrink

let slowMo = 1.0;
let cameraScale = 1.0;
let targetCameraScale = 1.0;

let stalemateTimer = 0;
let stalemateCountdown = -1;
let lastCountdownSecond = -1;

const ballNames = ["GLADIATOR", "COMET", "STORM", "NOVA", "PHANTOM", "BLAZE", "FROST", "TITAN", "VORTEX", "APOLLO"];
const factions = {
    'CYBER-CORE': { color: '#00f2ff', lore: 'Master of the grid.' },
    'VOID-WALKERS': { color: '#bc00ff', lore: 'Eaters of entropy.' },
    'SOLAR-GUARDS': { color: '#ffcc00', lore: 'Bringers of the storm.' },
    'IRON-BLOODS': { color: '#ff3300', lore: 'The old guard.' },
    'GOLDEN-LEGION': { color: '#ffd700', lore: 'The house always wins.' }
};

const synth = window.speechSynthesis;
let gameActive = true;
let selectedVoice = null;
let screenShake = 0;
let speechMemory = []; // Prevents Google Chrome garbage collection bug

// Soundscape 1.0 + Tier 2 Dynamic OST
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Dynamic OST State
let musicActive = false;
let droneOsc = null;
let droneGain = null;
let musicInterval = null;
let currentBPM = 80;

function startPulseLoop() {
    musicInterval = setInterval(() => {
        if (!gameActive) return;
        const aliveCount = balls.filter(b => b.alive).length;
        if (aliveCount === 0) return;

        const t = audioCtx.currentTime;
        const pulseGain = audioCtx.createGain();
        pulseGain.connect(audioCtx.destination);
        pulseGain.gain.setValueAtTime(0.05, t);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        const pulseOsc = audioCtx.createOscillator();
        pulseOsc.type = 'sine';
        const freq = 60 + (6 - aliveCount) * 20;
        pulseOsc.frequency.setValueAtTime(freq, t);
        pulseOsc.connect(pulseGain);
        pulseOsc.start();
        pulseOsc.stop(t + 0.1);
    }, (60 / currentBPM) * 1000);
}

function startOST() {
    if (musicActive) return;
    musicActive = true;

    // Low Drone
    droneOsc = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.setValueAtTime(40, audioCtx.currentTime);
    droneGain.gain.setValueAtTime(0.05, audioCtx.currentTime);

    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(200, audioCtx.currentTime);

    droneOsc.connect(lpFilter);
    lpFilter.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    droneOsc.start();

    startPulseLoop();
}

function updateMusic(aliveCount) {
    if (!musicActive) return;

    const intensity = (6 - aliveCount) / 5; // 0 to 1

    if (droneOsc) {
        droneOsc.frequency.setTargetAtTime(40 + intensity * 20, audioCtx.currentTime, 0.5);
    }

    const newBPM = 80 + intensity * 60;
    if (Math.abs(newBPM - currentBPM) > 5) {
        currentBPM = newBPM;
        clearInterval(musicInterval);
        startPulseLoop();
    }
}

function stopOST() {
    if (!musicActive) return;
    musicActive = false;
    clearInterval(musicInterval);
    if (droneGain) {
        droneGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
        setTimeout(() => {
            if (droneOsc) {
                try { droneOsc.stop(); } catch (e) { }
            }
        }, 1100);
    }
}

// Tier 3: Hall of Fame Persistence
let hallOfFame = JSON.parse(localStorage.getItem('ballArena_HoF')) || {};

function saveWin(name) {
    if (name === "GOLDEN-ONE") return;
    if (!hallOfFame[name]) hallOfFame[name] = { wins: 0, games: 0, kills: 0 };
    if (typeof hallOfFame[name] === 'number') {
        const wins = hallOfFame[name];
        hallOfFame[name] = { wins: wins, games: wins, kills: 0 };
    }
    hallOfFame[name].wins++;
    localStorage.setItem('ballArena_HoF', JSON.stringify(hallOfFame));
}

function recordGamePlayed(names) {
    names.forEach(name => {
        if (name === "GOLDEN-ONE") return;
        if (!hallOfFame[name]) hallOfFame[name] = { wins: 0, games: 0, kills: 0 };
        if (typeof hallOfFame[name] === 'number') {
            const wins = hallOfFame[name];
            hallOfFame[name] = { wins: wins, games: wins, kills: 0 };
        }
        hallOfFame[name].games++;
    });
    localStorage.setItem('ballArena_HoF', JSON.stringify(hallOfFame));
}

function recordKill(name) {
    if (name === "GOLDEN-ONE") return;
    if (!hallOfFame[name]) hallOfFame[name] = { wins: 0, games: 0, kills: 0 };
    if (typeof hallOfFame[name] === 'number') {
        const wins = hallOfFame[name];
        hallOfFame[name] = { wins: wins, games: wins, kills: 0 };
    }
    hallOfFame[name].kills++;
    localStorage.setItem('ballArena_HoF', JSON.stringify(hallOfFame));
}


function playSound(freq, type, duration, volume) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        const normalizedType = (type || 'sine').toString().toLowerCase().trim();

        if (normalizedType === 'noise') {
            const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            noise.connect(gain);
            noise.start();
            noise.stop(audioCtx.currentTime + duration);
        } else {
            const osc = audioCtx.createOscillator();
            const validTypes = ['sine', 'square', 'sawtooth', 'triangle'];
            // Fix case sensitivity and accidental 'noise' string being set to osc.type
            osc.type = validTypes.includes(normalizedType) ? normalizedType : 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            osc.connect(gain);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        }
    } catch (e) {
        console.warn("Audio playback failed:", e);
    }
}

function playImpact(impactForce) {
    playSound(150 + impactForce * 10, 'sine', 0.1, Math.min(0.5, impactForce / 50));
}

function playWallHit() {
    playSound(300, 'triangle', 0.05, 0.2);
}

function playPowerup() {
    playSound(880, 'sine', 0.2, 0.2);
    playSound(1100, 'sine', 0.2, 0.2);
}

function loadVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    console.log(`[Narrator Debug] Detected ${voices.length} available voices.`);

    if (voices.length === 0) return;

    // Populate dropdown if it exists
    if (voiceSelect) {
        voiceSelect.innerHTML = '';
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.name;
            voiceSelect.appendChild(option);
        });
    }

    // Default selection logic
    const savedVoiceName = localStorage.getItem('ballArena_voice');
    if (savedVoiceName) {
        selectedVoice = voices.find(v => v.name === savedVoiceName);
        if (voiceSelect) voiceSelect.value = savedVoiceName;
    }

    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.localService && v.name.includes('Microsoft') && v.lang.includes('en')) ||
            voices.find(v => v.localService && v.lang.includes('en')) ||
            voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
            voices[0];
        if (voiceSelect && selectedVoice) voiceSelect.value = selectedVoice.name;
    }

    if (selectedVoice) {
        console.log(`[Narrator Debug] Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
    }
}

if (voiceSelect) {
    voiceSelect.onchange = () => {
        const voices = synth.getVoices();
        selectedVoice = voices.find(v => v.name === voiceSelect.value);
        localStorage.setItem('ballArena_voice', selectedVoice.name);
        speak(`Voice pattern updated to ${selectedVoice.name}.`);
    };
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

function logCommentary(text) {
    if (!commentaryLog) return;
    const entry = document.createElement('div');
    entry.className = 'commentary-entry';
    entry.textContent = `> ${text}`;
    commentaryLog.insertBefore(entry, commentaryLog.firstChild);

    // Keep only last 10 entries
    while (commentaryLog.children.length > 8) {
        commentaryLog.removeChild(commentaryLog.lastChild);
    }
}

function speak(text) {
    if (!text || !synth) return;
    logCommentary(text);

    if (!narratorEnabled) {
        console.log(`[Narrator Debug] Speech suppressed: ${text}`);
        return;
    }

    // Add to our manual queue
    speechQueue.push(text);

    // Prevent the queue from getting stale: keep only the 2 most recent messages
    if (speechQueue.length > 2) {
        const dropped = speechQueue.shift();
        console.log(`[Narrator Debug] Skipping stale commentary: "${dropped}"`);
    }

    processSpeechQueue();
}

function processSpeechQueue() {
    if (isSpeaking || speechQueue.length === 0) return;

    const text = speechQueue.shift();
    isSpeaking = true;

    // Safety check for browser-side speech stall
    if (synth.paused) synth.resume();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onerror = (event) => {
        console.error(`[Narrator Error] Failed to speak: "${text}". Reason: ${event.error}`);
        isSpeaking = false;
        processSpeechQueue();
    };

    utterance.onend = () => {
        speechMemory = speechMemory.filter(u => u !== utterance);
        isSpeaking = false;
        setTimeout(processSpeechQueue, 100);
    };

    // CRITICAL: Keep a reference so it isn't garbage collected mid-speech
    speechMemory.push(utterance);

    if (!selectedVoice) loadVoices();
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
        console.log(`[Narrator Debug] Speech STARTED: "${text}"`);
    };

    console.log(`[Narrator Debug] Dispatching speech: "${text}"`);
    synth.resume();
    synth.speak(utterance);
}

// Global "Unstuck" helper: Any click on the page resumes the speech engine
window.addEventListener('mousedown', () => {
    if (synth) {
        synth.resume();
        // If it was empty but stuck, cancel/resume can kick it
        if (!synth.speaking) synth.cancel();
    }
}, { once: false });

if (narratorToggleBtn) {
    narratorToggleBtn.onclick = () => {
        narratorEnabled = !narratorEnabled;
        narratorToggleBtn.textContent = `Narrator: ${narratorEnabled ? 'ON' : 'OFF'}`;
        narratorToggleBtn.style.background = narratorEnabled ? 'var(--accent-color)' : '#555';

        const statusMsg = `Narrator ${narratorEnabled ? 'initialized and online' : 'standing down'}`;
        console.log(`[Narrator Debug] ${statusMsg}`);
        logCommentary(statusMsg);

        if (narratorEnabled) {
            // Kick the bridge with a dummy silent utterance
            const kick = new SpeechSynthesisUtterance("");
            synth.speak(kick);

            // Speak immediately to preserve "user gesture" trust
            speak("Narrator online.");

            // Follow up with detailed check
            setTimeout(() => {
                speak("Audio engine check complete.");
            }, 500);
        } else {
            synth.cancel();
        }
    };
}

// Final Phase: Arena Themes and Upgrades
const arenaThemes = {
    'NEON': {
        bg: '#050505', wall: '#00f2ff', friction: 0.995, gravity: 0,
        particles: '#00f2ff', name: 'Cyber Neon'
    },
    'DEEP_SPACE': {
        bg: '#00001a', wall: '#4444ff', friction: 0.99, gravity: 0.05,
        particles: '#ffffff', name: 'Deep Space'
    },
    'VOLCANIC': {
        bg: '#1a0500', wall: '#ff4400', friction: 0.998, gravity: 0,
        particles: '#ffaa00', name: 'Volcanic Core'
    },
    'VOID': {
        bg: '#0a000a', wall: '#bc00ff', friction: 0.98, gravity: 0,
        particles: '#bc00ff', name: 'Digital Void'
    }
};
let currentTheme = arenaThemes['NEON'];

const ballUpgrades = {
    'THORNS': { name: 'Thorns', icon: '🌵', desc: 'Reflects damage' },
    'VAMPIRISM': { name: 'Vampire', icon: '🦇', desc: 'Heals on hit' },
    'OVERCLOCK': { name: 'Overclocked', icon: '⚡', desc: 'Fast but drains' },
    'BOUNCE': { name: 'Super Bounce', icon: '🎾', desc: 'Elastic collisions' }
};

// Mini-game logic
const miniGame = document.getElementById('miniGame');
const miniCanvas = document.getElementById('miniGameCanvas');
const mctx = miniCanvas.getContext('2d');
let miniGameActive = false;
let shards = [];

class Shard {
    constructor() {
        this.x = Math.random() * miniCanvas.width;
        this.y = -50;
        this.vy = 2 + Math.random() * 5;
        this.size = 15 + Math.random() * 10;
        this.color = `hsl(${Math.random() * 360}, 100%, 70%)`;
        this.alive = true;
    }
    update() {
        this.y += this.vy;
        if (this.y > miniCanvas.height + 50) this.alive = false;
    }
    draw() {
        mctx.fillStyle = this.color;
        mctx.shadowBlur = 10;
        mctx.shadowColor = this.color;
        mctx.beginPath();
        mctx.moveTo(this.x, this.y - this.size);
        mctx.lineTo(this.x + this.size, this.y);
        mctx.lineTo(this.x, this.y + this.size);
        mctx.lineTo(this.x - this.size, this.y);
        mctx.fill();
        mctx.shadowBlur = 0;
    }
}

function startScrapRun() {
    bettingOverlay.classList.add('fade-out');
    miniGame.style.display = 'block';
    miniGameActive = true;
    shards = [];
    bank = 0;
    miniCanvas.width = window.innerWidth;
    miniCanvas.height = window.innerHeight;

    speak("Scrap run initiated. Reclaim the energy shards.");

    let startTime = Date.now();
    const miniLoop = () => {
        if (!miniGameActive) return;

        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

        if (Math.random() < 0.1) shards.push(new Shard());

        shards.forEach(s => {
            s.update();
            s.draw();
        });
        shards = shards.filter(s => s.alive);

        mctx.fillStyle = '#00f2ff';
        mctx.font = 'bold 30px Outfit';
        mctx.textAlign = 'center';
        mctx.fillText(`SCRAP RECLAIMED: ${bank}`, miniCanvas.width / 2, 50);

        const timeLeft = 20 - Math.floor((Date.now() - startTime) / 1000);
        mctx.fillText(`TIME: ${timeLeft}S`, miniCanvas.width / 2, 100);

        if (timeLeft <= 0) {
            miniGameActive = false;
            miniGame.style.display = 'none';
            saveBank();
            showBettingOverlay();
            speak(`Recovery complete. ${bank} credits returned to reserve.`);
        } else {
            requestAnimationFrame(miniLoop);
        }
    };
    miniLoop();
}

miniGame.onclick = (e) => {
    shards.forEach(s => {
        const d = Math.sqrt((s.x - e.clientX) ** 2 + (s.y - e.clientY) ** 2);
        if (d < s.size + 20 && s.alive) {
            s.alive = false;
            bank += 10;
            playSound(400 + Math.random() * 200, 'sine', 0.1, 0.1);
        }
    });
};

scrapRunBtn.onclick = startScrapRun;

class MagneticAnchor {
    constructor(angle, dist) {
        this.angle = angle;
        this.dist = dist;
        this.size = 20;
        this.pulse = 0;
        this.polarity = 1; // 1 for attraction, -1 for repulsion
        this.nextSwitch = Date.now() + 2000 + Math.random() * 8000;
    }
    update(dt) {
        if (!isFinite(dt)) return;
        this.angle += 0.005 * dt;
        const scale = (baseArenaRadius > 0) ? (arenaRadius / baseArenaRadius) : 1;
        this.x = centerX + Math.cos(this.angle) * this.dist * scale;
        this.y = centerY + Math.sin(this.angle) * this.dist * scale;
        this.pulse += 0.1 * dt;

        if (Date.now() > this.nextSwitch) {
            this.polarity *= -1;
            this.nextSwitch = Date.now() + 2000 + Math.random() * 8000;
            if (this.polarity === 1) logCommentary("Singularity attracting.");
            else logCommentary("Singularity repelling.");
        }
    }
    draw() {
        ctx.beginPath();
        const glow = 15 + Math.sin(this.pulse) * 5;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.strokeStyle = this.polarity === 1 ? '#bc00ff' : '#00ffaa';
        ctx.shadowBlur = glow;
        ctx.shadowColor = this.polarity === 1 ? '#bc00ff' : '#00ffaa';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Pull/Push closest ball
        let closest = null;
        let minDist = Infinity;
        balls.forEach(b => {
            if (!b.alive) return;
            const d = Math.sqrt((b.x - this.x) ** 2 + (b.y - this.y) ** 2);
            if (d < minDist && d < 180) {
                minDist = d;
                closest = b;
            }
        });

        if (closest) {
            const angle = Math.atan2(closest.y - this.y, closest.x - this.x);
            const force = this.polarity === 1 ? 0.5 : -0.2; // Light repulsion
            closest.vx -= Math.cos(angle) * force;
            closest.vy -= Math.sin(angle) * force;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(closest.x, closest.y);
            ctx.strokeStyle = this.polarity === 1 ? 'rgba(188, 0, 255, 0.3)' : 'rgba(0, 255, 170, 0.3)';
            ctx.stroke();
        }
    }
}

class SeekerMine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.size = 10;
        this.target = null;
        this.alive = true;
        this.life = 600; // 10 seconds
        speak("Seeker mine deployed!");
    }
    update(dt) {
        if (!isFinite(dt)) return;
        if (!this.target || !this.target.alive) {
            const alive = balls.filter(b => b.alive);
            if (alive.length > 0) this.target = alive[Math.floor(Math.random() * alive.length)];
        }

        if (this.target) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.vx += Math.cos(angle) * 0.1 * dt;
            this.vy += Math.sin(angle) * 0.1 * dt;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= dt;
        if (this.life <= 0) this.explode();
    }
    onCollide(ball) {
        this.explode();
    }
    explode() {
        if (!this.alive) return;
        this.alive = false;
        shockwaves.push(new Shockwave(this.x, this.y));
        createDust(this.x, this.y, '#ff3300');
        playSound(200, 'square', 0.5, 0.4);
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3300';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3300';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class VoidGap {
    constructor(angle, size) {
        this.angle = angle;
        this.size = size; // Arc size
        this.active = true;
    }
    update(dt) {
        this.active = (Math.sin(Date.now() / 1000) > -0.5);
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(arenaRotation + this.angle);
        ctx.beginPath();
        ctx.arc(0, 0, arenaRadius, -this.size / 2, this.size / 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.restore();

        // Collision
        balls.forEach(b => {
            if (!b.alive) return;
            const dx = b.x - centerX;
            const dy = b.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ballAngle = Math.atan2(dy, dx) - arenaRotation;
            let diff = (ballAngle - this.angle) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;

            if (dist + b.radius > arenaRadius - 5 && Math.abs(diff) < this.size / 2) {
                b.takeDamage(5); // Massive void damage
                screenShake = Math.max(screenShake, 5);
            }
        });
    }
}

class Hazard {
    constructor(angle, dist, size) {
        this.angle = angle;
        this.dist = dist;
        this.size = size;
        this.rot = 0;
    }
    update(dt) {
        if (!isFinite(dt)) return;
        this.angle += 0.01 * dt;
        this.rot += 0.1 * dt;
        const scale = (baseArenaRadius > 0) ? (arenaRadius / baseArenaRadius) : 1;
        this.x = centerX + Math.cos(this.angle) * this.dist * scale;
        this.y = centerY + Math.sin(this.angle) * this.dist * scale;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.strokeStyle = '#ff3300';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3300';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.size);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.alive = true;
        this.pulse = 0;
    }

    draw() {
        this.pulse += 0.1;
        const scale = 1 + Math.sin(this.pulse) * 0.2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);

        if (this.type === 'health') {
            ctx.fillStyle = '#00ff44';
        } else if (this.type === 'shield') {
            ctx.fillStyle = '#00f2ff';
        } else if (this.type === 'regen') {
            ctx.fillStyle = '#bc00ff';
        } else {
            ctx.fillStyle = '#ffcc00';
        }

        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px Outfit';
        const icons = { 'health': '+', 'boost': '⚡', 'shockwave': '💥', 'shield': '🛡️', 'regen': '💊' };
        ctx.fillText(icons[this.type] || '?', this.x, this.y);
    }
}

class Shockwave {
    constructor(x, y, owner = null) {
        this.x = x;
        this.y = y;
        this.owner = owner;
        this.radius = 0;
        this.maxRadius = arenaRadius;
        this.life = 1.0;
        this.strength = 15;
        playSound(60, 'square', 1.0, 0.3); // Low hum for shockwave
    }

    update() {
        this.radius += 10 * slowMo;
        this.life -= 0.02 * slowMo;

        // Push balls
        balls.forEach(ball => {
            if (!ball.alive || ball === this.owner) return;
            const dx = ball.x - this.x;
            const dy = ball.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (Math.abs(dist - this.radius) < 20) {
                const angle = Math.atan2(dy, dx);
                ball.vx += Math.cos(angle) * this.strength * this.life;
                ball.vy += Math.sin(angle) * this.strength * this.life;
                screenShake = Math.max(screenShake, 5 * this.life);
            }
        });
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 242, 255, ${this.life * 0.5})`;
        ctx.lineWidth = 5;
        ctx.stroke();
    }
}

class Ball {
    constructor(id, name, x, y, type, faction) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.alive = true;
        this.energy = 400; // 4x increase from 100
        this.maxEnergy = 400;
        this.trails = [];
        this.faction = faction;
        this.fColor = factions[faction].color;
        const hf = hallOfFame[name] || { wins: 0, games: 0, kills: 0 };
        const winsCount = typeof hf === 'number' ? hf : (hf.wins || 0);
        this.wins = winsCount;
        this.bounceCooldown = 0;
        this.shield = 0; // Shield timer
        this.regen = 0; // Regen timer

        // Final Phase Upgrades
        this.upgrades = [];
        if (this.wins > 0) {
            const types = Object.keys(ballUpgrades);
            // Give 1 upgrade for 1st win, another for 3rd, etc.
            if (this.wins >= 1) this.upgrades.push(types[0]); // THORNS
            if (this.wins >= 2) this.upgrades.push(types[1]); // VAMPIRISM
            if (this.wins >= 4) this.upgrades.push(types[2]); // OVERCLOCK
        }

        const types = {
            'AGILE': { mass: 0.7, speed: 1.3, radius: 12, color: '#00ffaa' },
            'BALANCED': { mass: 1.0, speed: 1.0, radius: 15, color: '#ffff00' },
            'HEAVY': { mass: 1.8, speed: 0.7, radius: 20, color: '#ff0055' }
        };
        const config = types[type];
        this.type = type;
        this.mass = config.mass;
        this.radius = config.radius;
        this.color = this.wins >= 3 ? '#fff' : config.color;

        let speedMult = config.speed;
        if (this.upgrades.includes('OVERCLOCK')) speedMult *= 1.5;

        this.vx = (Math.random() - 0.5) * 10 * speedMult;
        this.vy = (Math.random() - 0.5) * 10 * speedMult;

        this.energy += this.wins * 40; // Scaled bonus
        this.maxEnergy = this.energy;
        this.mass += this.wins * 0.05;

        // Match Performance tracking
        this.matchDamageDealt = 0;
        this.matchMaxKineticEnergy = 0;
    }

    update() {
        if (!this.alive) return;

        if (this.bounceCooldown > 0) this.bounceCooldown--;
        if (this.shield > 0) this.shield -= slowMo;
        if (this.regen > 0) {
            this.regen -= slowMo;
            this.energy = Math.min(this.maxEnergy, this.energy + 0.1 * slowMo);
        }

        // Overclock Drains Energy
        if (this.upgrades.includes('OVERCLOCK')) {
            this.takeDamage(0.05 * slowMo, "Overclock");
        }

        this.trails.push({ x: this.x, y: this.y, life: 1.0 });
        if (this.trails.length > 10) this.trails.shift();
        this.trails.forEach(t => t.life -= 0.1 * slowMo);

        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist + this.radius > arenaRadius) {
            const angle = Math.atan2(dy, dx);
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);

            // Fix Wall Clinging: Stronger push back and normalized placement
            this.x = centerX + normalX * (arenaRadius - this.radius - 2);
            this.y = centerY + normalY * (arenaRadius - this.radius - 2);

            // Reflect velocity with randomized bounce and repulsive outward force
            const dot = this.vx * normalX + this.vy * normalY;

            // Break the wall-hug loop if dot is small or hitting repeatedly
            if (this.bounceCooldown <= 0) {
                this.vx -= 2.0 * dot * normalX; // Over-reflect to push away
                this.vy -= 2.0 * dot * normalY;

                // Add a small random jitter to the bounce angle
                const jitter = (Math.random() - 0.5) * 0.5;
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const currentAngle = Math.atan2(this.vy, this.vx);
                this.vx = Math.cos(currentAngle + jitter) * speed;
                this.vy = Math.sin(currentAngle + jitter) * speed;

                this.bounceCooldown = 10;
            } else {
                // If in cooldown, force move away from wall
                this.vx -= 0.5 * normalX;
                this.vy -= 0.5 * normalY;
            }

            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.takeDamage(speed * 0.05 + 0.2); // Wall damage, no attacker

            playWallHit();
            screenShake = Math.max(screenShake, speed * 0.5);

            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(this.x, this.y, this.fColor));
            }

            const tangentX = -normalY;
            const tangentY = normalX;
            const spinBonus = arenaRadius * arenaSpeed;
            this.vx += tangentX * spinBonus * 0.3; // Reduced spin bonus to avoid wall-clinging entrapment
            this.vy += tangentY * spinBonus * 0.3;
        }

        hazards.forEach(h => {
            const hdx = this.x - h.x;
            const hdy = this.y - h.y;
            const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
            if (hdist < this.radius + (h.size || 15)) {
                if (h.onCollide) {
                    h.onCollide(this);
                } else if (h.size) { // Standard Blade Hazard
                    const angle = Math.atan2(hdy, hdx);
                    this.vx += Math.cos(angle) * 5;
                    this.vy += Math.sin(angle) * 5;
                    this.takeDamage(1, "Hazard"); // Scaled
                    screenShake = Math.max(screenShake, 2);
                    playWallHit();
                }
            }
        });

        powerups.forEach(pu => {
            if (!pu.alive) return;
            const pdx = pu.x - this.x;
            const pdy = pu.y - this.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist < this.radius + pu.radius) {
                pu.alive = false;
                playPowerup();
                if (pu.type === 'health') {
                    this.energy = Math.min(this.maxEnergy, this.energy + 100);
                    speak(`${this.name} restores integrity.`);
                } else if (pu.type === 'boost') {
                    const angle = Math.random() * Math.PI * 2;
                    this.vx += Math.cos(angle) * 15;
                    this.vy += Math.sin(angle) * 15;
                    speak(`${this.name} accelerating!`);
                } else if (pu.type === 'shockwave') {
                    shockwaves.push(new Shockwave(this.x, this.y, this));
                    speak(`${this.name} unleashed a shockwave!`);
                    screenShake = 15;
                } else if (pu.type === 'shield') {
                    this.shield = 300; // 5 seconds at 60fps
                    speak(`${this.name} shielded!`);
                } else if (pu.type === 'regen') {
                    this.regen = 600; // 10 seconds
                    speak(`${this.name} nanite repair.`);
                }
            }
        });

        if (!gameActive && matchRankings.length > 0) return;

        this.x += this.vx * slowMo;
        this.y += this.vy * slowMo;

        // Update Kinetic Energy tracking for MVP
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const keValue = 0.5 * this.mass * currentSpeed * currentSpeed;
        if (keValue > this.matchMaxKineticEnergy) this.matchMaxKineticEnergy = keValue;

        // MAX VELOCITY CAP
        const maxSpeed = 30;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // Theme Friction
        this.vx *= currentTheme.friction;
        this.vy *= currentTheme.friction;

        // Theme Gravity (Deep Space thick nebula)
        if (currentTheme.gravity > 0) {
            const gx = (centerX - this.x) * 0.0001 * currentTheme.gravity;
            const gy = (centerY - this.y) * 0.0001 * currentTheme.gravity;
            this.vx += gx;
            this.vy += gy;
        }
    }

    draw() {
        if (!this.alive) return;

        if (this.wins >= 3) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${(Date.now() / 10) % 360}, 100%, 70%, 0.5)`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Shield effect
        if (this.shield > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f2ff';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        this.trails.forEach(t => {
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * t.life, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = t.life * 0.3;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.radius) || this.radius <= 0) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, this.radius * 0.6)}px Outfit`;
        ctx.textAlign = 'center';

        // Final Phase: Show Upgrade Icons
        let upgradeDisplay = this.upgrades.map(u => ballUpgrades[u].icon).join('');
        ctx.fillText(upgradeDisplay + this.name, this.x, this.y - this.radius - 8);

        ctx.fillStyle = this.fColor;
        ctx.font = '8px Outfit';
        ctx.fillText(this.faction, this.x, this.y + this.radius + 12);

        if (this.wins > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText('★'.repeat(this.wins), this.x, this.y - this.radius - 20);
        }
    }

    takeDamage(amount, attacker = null) {
        if (this.shield > 0) return;
        if (attacker && typeof attacker === 'string') this.lastAttacker = attacker;
        else if (attacker instanceof Ball) this.lastAttacker = attacker.name;

        this.energy -= amount;
        if (this.energy <= 0) {
            this.energy = 0;
            this.die();
        }
    }

    die() {
        if (!this.alive) return;
        this.alive = false;

        if (this.lastAttacker && this.lastAttacker !== "Overclock" && this.lastAttacker !== "Hazard") {
            recordKill(this.lastAttacker);
            speak(`${this.name} eliminated by ${this.lastAttacker}!`);
        } else {
            speak(`${this.name} falls!`);
        }

        matchRankings.push(this.name);
        createDust(this.x, this.y, this.color);
        playSound(100, 'sawtooth', 0.3, 0.4);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.vx * slowMo;
        this.y += this.vy * slowMo;
        this.life -= this.decay * slowMo;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        ctx.globalAlpha = 1.0;
    }
}

function createDust(x, y, color) {
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    centerX = width / 2;
    centerY = height / 2;
    baseArenaRadius = Math.min(width, height) * 0.45;
    arenaRadius = baseArenaRadius;
}

function resolveBallCollisions() {
    if (!gameActive && matchRankings.length > 0) return;
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i];
            const b2 = balls[j];
            if (!b1.alive || !b2.alive) continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < b1.radius + b2.radius) {
                const angle = Math.atan2(dy, dx);
                const nx = Math.cos(angle);
                const ny = Math.sin(angle);

                const overlap = b1.radius + b2.radius - dist;
                b1.x -= nx * overlap / 2;
                b1.y -= ny * overlap / 2;
                b2.x += nx * overlap / 2;
                b2.y += ny * overlap / 2;

                const v1n = b1.vx * nx + b1.vy * ny;
                const v2n = b2.vx * nx + b2.vy * ny;

                const restitution = (b1.upgrades.includes('BOUNCE') || b2.upgrades.includes('BOUNCE')) ? 1.2 : 0.8;

                const m1 = b1.mass;
                const m2 = b2.mass;

                const newV1n = (restitution * m2 * (v2n - v1n) + m1 * v1n + m2 * v2n) / (m1 + m2);
                const newV2n = (restitution * m1 * (v1n - v2n) + m1 * v1n + m2 * v2n) / (m1 + m2);

                b1.vx += (newV1n - v1n) * nx;
                b1.vy += (newV1n - v1n) * ny;
                b2.vx += (newV2n - v2n) * nx;
                b2.vy += (newV2n - v2n) * ny;

                const impactForce = Math.abs(v1n - v2n);
                const damage = impactForce * 2;

                // Tier 5: Record for Heatmap
                recordCollision((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, impactForce);

                if (b1.upgrades.includes('THORNS')) {
                    b2.takeDamage(damage * 0.2, b1);
                    b1.matchDamageDealt += damage * 0.2;
                }
                if (b2.upgrades.includes('THORNS')) {
                    b1.takeDamage(damage * 0.2, b2);
                    b2.matchDamageDealt += damage * 0.2;
                }

                if (b1.upgrades.includes('VAMPIRISM')) b1.energy = Math.min(b1.maxEnergy, b1.energy + damage * 0.1);
                if (b2.upgrades.includes('VAMPIRISM')) b2.energy = Math.min(b2.maxEnergy, b2.energy + damage * 0.1);

                b1.takeDamage(damage / b1.mass, b2);
                b2.takeDamage(damage / b2.mass, b1);

                b1.matchDamageDealt += damage / b2.mass;
                b2.matchDamageDealt += damage / b1.mass;

                playSound(150 + impactForce * 10, 'triangle', 0.2, 0.1);
                screenShake = Math.max(screenShake, impactForce * 0.8);
            }
        }
    }
}

function init() {
    resize();
    gameActive = true;
    gameTime = 0;
    slowMo = 1.0;
    cameraScale = 1.0;
    targetCameraScale = 1.0;
    balls = [];
    particles = [];
    powerups = [];
    shockwaves = [];
    hazards = [];
    matchData = [];
    matchRankings = [];
    heatmapCanvas.style.opacity = '0';
    celebrationOverlay.classList.add('hidden');
    summaryOverlay.classList.add('hidden');

    // Pick Theme
    const themeKeys = Object.keys(arenaThemes);
    currentTheme = arenaThemes[themeKeys[Math.floor(Math.random() * themeKeys.length)]];
    document.body.style.backgroundColor = currentTheme.bg;

    // Use the competitors selected in the betting overlay
    const weightClasses = ['AGILE', 'BALANCED', 'HEAVY', 'AGILE', 'HEAVY'];
    const factionNames = Object.keys(factions);

    for (let i = 0; i < currentCompetitors.length; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.5);
        const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.5);
        const faction = factionNames[Math.floor(Math.random() * factionNames.length)];
        balls.push(new Ball(i, currentCompetitors[i], x, y, weightClasses[i % weightClasses.length], faction));
    }

    if (goldenBallPurchased) {
        const angle = Math.random() * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.5);
        const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.5);
        const goldenBall = new Ball(balls.length, "GOLDEN-ONE", x, y, 'BALANCED', 'GOLDEN-LEGION');
        goldenBall.color = '#ffd700'; // Override color
        balls.push(goldenBall);
    }

    // Tier 2: Hazards
    for (let i = 0; i < 3; i++) {
        hazards.push(new Hazard((i / 3) * Math.PI * 2, baseArenaRadius * 0.4, 30));
    }

    gameStatus.textContent = `Arena: ${currentTheme.name}`;
    restartBtn.style.display = 'none';

    recordGamePlayed(currentCompetitors);
    if (goldenBallPurchased) recordGamePlayed(["GOLDEN-ONE"]);

    if (commentaryLog) commentaryLog.innerHTML = '';
    speak(`Match in ${currentTheme.name}. Season ${Object.values(hallOfFame).reduce((a, b) => a + (b.games || 0), 0) + 1} begins.`);
}

function spawnPowerUp() {
    if (powerups.filter(p => p.alive).length >= 5) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (arenaRadius * 0.7);
    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;

    const r = Math.random();
    let type = 'health';
    if (r > 0.4) type = 'boost';
    if (r > 0.7) type = 'shockwave';
    if (r > 0.85) type = 'shield';
    if (r > 0.95) type = 'regen';

    powerups.push(new PowerUp(x, y, type));
}

function triggerStalemateDetonation() {
    speak("PURGE INITIATED.");
    const detonation = new Shockwave(centerX, centerY);
    detonation.strength = 45; // High impact
    detonation.maxRadius = arenaRadius * 1.5;
    shockwaves.push(detonation);

    screenShake = 40;
    playSound(40, 'sawtooth', 1.5, 0.6);

    // Apply massive force to objects
    balls.forEach(ball => {
        if (!ball.alive) return;
        const dx = ball.x - centerX;
        const dy = ball.y - centerY;
        const angle = Math.atan2(dy, dx);
        const force = 35;
        ball.vx += Math.cos(angle) * force;
        ball.vy += Math.sin(angle) * force;
        ball.takeDamage(20); // Penalty for stalling
    });

    // Clear seekers
    hazards.forEach(h => {
        if (h instanceof SeekerMine && h.alive) {
            h.explode();
        }
    });

    stalemateTimer = 0;
    stalemateCountdown = -1;
    lastCountdownSecond = -1;
}

function updateStats() {
    statsContainer.innerHTML = '';
    let aliveCount = 0;
    let winner = null;

    // Find Leader (Career Wins)
    let sessionLeader = null;
    let maxWins = -1;
    balls.forEach(ball => {
        const stats = hallOfFame[ball.name] || { wins: 0 };
        const winsCount = typeof stats === 'number' ? stats : (stats.wins || 0);
        if (winsCount > maxWins) {
            maxWins = winsCount;
            sessionLeader = ball.name;
        }
    });

    // Find Healthiest (Alive)
    let healthiestBall = null;
    let maxHealthRatio = -1;
    balls.forEach(ball => {
        if (ball.alive) {
            const ratio = ball.maxEnergy > 0 ? (ball.energy / ball.maxEnergy) : 0;
            if (isFinite(ratio) && ratio > maxHealthRatio) {
                maxHealthRatio = ratio;
                healthiestBall = ball.name;
            }
        }
    });

    balls.forEach(ball => {
        if (ball.alive) {
            aliveCount++;
            winner = ball;
        }

        const isLeader = ball.name === sessionLeader && maxWins > 0;
        const isHealthiest = ball.name === healthiestBall && aliveCount > 1;

        const statItem = document.createElement('div');
        statItem.className = 'ball-stat';
        if (!ball.alive) statItem.style.opacity = '0.5';

        statItem.innerHTML = `
            <div style="display: flex; flex-direction: column; flex-grow: 1;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="color: ${ball.color}; font-weight: bold;">
                        ${ball.alive ? '' : '💀 '}${ball.name}
                    </span>
                    ${isLeader ? '<span class="stat-badge leader" title="Career Leader">👑</span>' : ''}
                    ${isHealthiest ? '<span class="stat-badge healthy" title="Healthiest">🛡️</span>' : ''}
                </div>
                <small style="color: ${ball.fColor}; font-size: 10px; opacity: 0.8;">${ball.faction}</small>
            </div>
            <div style="text-align: right;">
                <div class="health-bar-bg" style="width: 80px;">
                    <div class="health-bar-fill" style="width: ${ball.maxEnergy > 0 ? (ball.energy / ball.maxEnergy * 100) : 0}%; background: ${ball.fColor}"></div>
                </div>
                <small style="font-size: 9px; opacity: 0.5;">${Math.ceil(isFinite(ball.energy) ? ball.energy : 0)} HP</small>
            </div>
        `;
        statsContainer.appendChild(statItem);
    });

    if (gameActive) {
        if (aliveCount === 1) {
            gameActive = false;
            matchRankings.push(winner.name); // Push winner to rankings
            gameStatus.textContent = `Winner: ${winner.name}!`;
            saveWin(winner.name);
            processBetResults(winner.name);
            showCelebration(winner);
            drawHeatmap();
        } else if (aliveCount === 0) {
            gameActive = false;
            gameStatus.textContent = "Everyone Perished!";
            speak("Unbelievable total destruction.");
            processBetResults(null); // Ensure bets are processed even if nobody wins
            drawHeatmap();
            setTimeout(showSummaryScreen, 2000);
        }

        if (aliveCount >= 2) {
            let maxDist = 0;
            const aliveBalls = balls.filter(b => b.alive);
            aliveBalls.forEach(b1 => {
                aliveBalls.forEach(b2 => {
                    const d = Math.sqrt((b1.x - b2.x) ** 2 + (b1.y - b2.y) ** 2);
                    if (d > maxDist) maxDist = d;
                });
            });
            targetCameraScale = Math.min(1.5, Math.max(0.8, (arenaRadius * 2) / (maxDist + 200)));
        }
    }
}

function processBetResults(winnerName) {
    let totalPayout = 0;
    const totalWager = userBets.reduce((sum, bet) => sum + bet.amount, 0);

    userBets.forEach(bet => {
        bet.payout = 0;
        if (bet.type === 'win' && bet.name === winnerName) {
            bet.payout = bet.amount * bet.odds;
        } else if (bet.type === 'eachway') {
            const top2 = matchRankings.slice(-2);
            if (top2.includes(bet.name)) {
                bet.payout = bet.amount * bet.odds;
            }
        } else if (bet.type === 'tricast') {
            const top3 = matchRankings.slice(-3).reverse();
            const prediction = bet.name.split(',');
            if (prediction[0] === top3[0] && prediction[1] === top3[1] && prediction[2] === top3[2]) {
                bet.payout = bet.amount * bet.odds;
            }
        }
        totalPayout += bet.payout;
    });

    if (goldenBallPurchased) {
        const top2 = matchRankings.slice(-2);
        if (top2.includes('GOLDEN-ONE') && totalPayout > 0) {
            speak("Golden Ball survived! Payouts multiplied by 10!");
            totalPayout *= 10;
            // Update individual payouts for display
            userBets.forEach(bet => bet.payout *= 10);
        }
    }

    lastMatchBettingResult = totalPayout - totalWager;

    if (lastMatchBettingResult > 0) {
        sessionWins += lastMatchBettingResult;
    } else if (lastMatchBettingResult < 0) {
        sessionLosses += Math.abs(lastMatchBettingResult);
    }

    if (totalPayout > 0) {
        bank += totalPayout;
        saveBank();
        speak(`Spectacular! Your prediction paid off. ${totalPayout.toFixed(0)} credits awarded.`);
    } else if (userBets.length > 0) {
        speak("Wagers lost. The arena is a cruel mistress.");
    }
    logCommentary(`MATCH P/L: ${lastMatchBettingResult.toFixed(0)} credits.`);
}

function showCelebration(winner) {
    winnerNameEl.textContent = `${winner.name} WINS!`;
    winnerNameEl.style.color = winner.color;
    celebrationOverlay.style.borderColor = winner.color;
    celebrationOverlay.style.boxShadow = `0 0 50px ${winner.color}`;
    celebrationOverlay.classList.remove('hidden');

    for (let i = 0; i < 150; i++) {
        particles.push(new Particle(centerX, centerY, winner.color));
    }

    speak(`Total domination by ${winner.name}! The ${winner.type} champion.`);
    slowMo = 1.0;

    setTimeout(showSummaryScreen, 2000);
}

let lastPowerup = 0;
let lastHazardSpawn = 0;
let lastTimestamp = 0;

function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    let dt = timestamp - lastTimestamp;
    if (!isFinite(dt)) dt = 0;
    lastTimestamp = timestamp;

    if (gameActive) {
        gameTime += dt * slowMo;
        const shrinkFactor = Math.max(0.3, 1 - (gameTime / gameDuration));
        arenaRadius = baseArenaRadius * shrinkFactor;

        // Tier 4: Escalating Hazards
        if (timestamp - lastHazardSpawn > 15000 && hazards.length < 15) {
            const r = Math.random();
            if (r > 0.8) hazards.push(new SeekerMine(centerX, centerY));
            else if (r > 0.5) hazards.push(new MagneticAnchor(Math.random() * Math.PI * 2, baseArenaRadius * 0.9));
            else if (r > 0.3) hazards.push(new VoidGap(Math.random() * Math.PI * 2, 0.4));
            else hazards.push(new Hazard(Math.random() * Math.PI * 2, baseArenaRadius * (0.3 + Math.random() * 0.4), 30));

            lastHazardSpawn = timestamp;
            speak("Arena complexity increased. New hazard detected.");
        }
    }

    const loopAliveCount = balls.filter(b => b.alive).length;
    if (loopAliveCount === 2 && gameActive) {
        const b1 = balls.filter(b => b.alive)[0];
        const b2 = balls.filter(b => b.alive)[1];
        const d = Math.sqrt((b1.x - b2.x) ** 2 + (b1.y - b2.y) ** 2);
        if (d < 100) slowMo = 0.3;
        else slowMo = 1.0;
    } else if (!gameActive) {
        slowMo = Math.min(1.0, slowMo + 0.05);
    }

    cameraScale += (targetCameraScale - cameraScale) * 0.05;

    let shakeX = (Math.random() - 0.5) * screenShake;
    let shakeY = (Math.random() - 0.5) * screenShake;
    screenShake *= 0.9;

    ctx.fillStyle = currentTheme.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw Theme Name
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = currentTheme.wall;
    ctx.font = 'bold 80px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(currentTheme.name, centerX, centerY + 30);
    ctx.restore();

    ctx.save();
    ctx.translate(centerX + shakeX, centerY + shakeY);
    ctx.scale(cameraScale, cameraScale);
    ctx.translate(-centerX, -centerY);

    if (gameActive) {
        if (timestamp - lastPowerup > 4000) {
            spawnPowerUp();
            lastPowerup = timestamp;
        }

        // Stalemate Detection
        const aliveBalls = balls.filter(b => b.alive);
        if (aliveBalls.length > 0) {
            const allStationary = aliveBalls.every(b => Math.sqrt(b.vx * b.vx + b.vy * b.vy) < 0.2);
            if (allStationary) {
                stalemateTimer += dt * slowMo;

                // Trigger countdown starting at 14 seconds
                if (stalemateTimer > 14000) {
                    const secondsLeft = Math.max(0, 3 - Math.floor((stalemateTimer - 14000) / 1000));

                    if (stalemateCountdown === -1) {
                        stalemateCountdown = 3;
                        speak("Stalemate detected. Central purge imminent.");
                    }

                    if (secondsLeft !== lastCountdownSecond) {
                        lastCountdownSecond = secondsLeft;
                        if (secondsLeft > 0) speak(secondsLeft.toString());
                        else if (secondsLeft === 0) triggerStalemateDetonation();
                    }
                }
            } else {
                // Reset if anything moves
                stalemateTimer = 0;
                stalemateCountdown = -1;
                lastCountdownSecond = -1;
            }
        }
    }

    hazards = hazards.filter(h => h.alive === undefined || h.alive);
    hazards.forEach(h => h.update(slowMo));
    hazards.forEach(h => h.draw());

    arenaRotation += (gameActive || matchRankings.length === 0) ? (arenaSpeed * slowMo) : 0;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(arenaRotation);

    const wallColor = currentTheme.wall;
    ctx.beginPath();
    ctx.arc(0, 0, arenaRadius, 0, Math.PI * 2);
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 4 + Math.sin(timestamp / 100) * 2;
    ctx.shadowBlur = 20 + screenShake;
    ctx.shadowColor = wallColor;
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const s = Math.sin(timestamp / 50 + i) * 5;
        ctx.beginPath();
        ctx.strokeStyle = wallColor;
        ctx.globalAlpha = 0.5;
        ctx.moveTo(Math.cos(angle) * (arenaRadius + 5), Math.sin(angle) * (arenaRadius + 5));
        ctx.lineTo(Math.cos(angle) * (arenaRadius - 15 - s), Math.sin(angle) * (arenaRadius - 15 - s));
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
    ctx.restore();

    shockwaves = shockwaves.filter(s => s.life > 0);
    shockwaves.forEach(s => {
        s.update();
        s.draw();
    });

    powerups = powerups.filter(p => p.alive);
    powerups.forEach(p => p.draw());

    resolveBallCollisions();

    balls.forEach(ball => {
        ball.update();
        ball.draw();
    });

    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    ctx.restore(); // Wall restore

    // Detonation Countdown Overlay
    if (stalemateCountdown >= 0) {
        const secondsLeft = Math.max(0, 3 - Math.floor((stalemateTimer - 14000) / 1000));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 120px Orbitron';
        ctx.fillStyle = secondsLeft === 0 ? '#ff0000' : '#bc00ff';
        ctx.shadowBlur = 30;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(secondsLeft > 0 ? secondsLeft : "PURGE", centerX, centerY);
        ctx.restore();
    }

    // TIER 5: Live Stats
    updateStats();
    updateArenaStats();

    const aliveCount = balls.filter(b => b.alive).length;
    if (gameActive) updateMusic(aliveCount);

    requestAnimationFrame(loop);
}


function updateArenaStats() {
    if (!arenaStatsContainer) return;

    const timeLeftMs = Math.max(0, gameDuration - gameTime);
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')} `;

    const radiusPercent = ((arenaRadius / baseArenaRadius) * 100).toFixed(1);

    arenaStatsContainer.innerHTML = `
        <div style="color: var(--accent-color); font-weight: bold; font-size: 0.8rem; margin-bottom: 8px; letter-spacing: 1px;">ARENA TELEMETRY</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="opacity: 0.7; font-size: 0.8rem;">Implosion:</span>
            <span style="color: #ff3300; font-family: monospace; font-weight: bold;">${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span style="opacity: 0.7; font-size: 0.8rem;">Radius:</span>
            <span style="color: #00f2ff; font-family: monospace; font-weight: bold;">${radiusPercent}%</span>
        </div>
        <div style="margin-top: 8px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div style="width: ${radiusPercent}%; height: 100%; background: var(--accent-color); transition: width 0.3s ease;"></div>
        </div>
    `;
}

function showSummaryScreen() {
    try {
        celebrationOverlay.classList.add('hidden');
        summaryOverlay.classList.remove('hidden');
        summaryOverlay.classList.remove('fade-out');
        summaryList.innerHTML = '';

        const summaryBettingResult = document.getElementById('summary-betting-result');
        if (userBets.length > 0) {
            let bettingHtml = `<div style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">BET TICKETS</div>`;
            userBets.forEach(bet => {
                const profit = bet.payout - bet.amount;
                const resultColor = profit > 0 ? '#00ff44' : (profit < 0 ? '#ff3300' : '#ffffff');
                const resultText = profit >= 0 ? `+${profit.toFixed(0)}` : `${profit.toFixed(0)}`;
                const typeLabel = bet.type.toUpperCase();
                bettingHtml += `
                    <div style="font-size: 0.85rem; display: flex; justify-content: space-between; gap: 15px; margin-bottom: 4px;">
                        <span>[${typeLabel}] ${bet.name}</span>
                        <span style="color: ${resultColor}; font-family: monospace;">${resultText}</span>
                    </div>
                `;
            });

            const totalColor = lastMatchBettingResult > 0 ? '#00ff44' : (lastMatchBettingResult < 0 ? '#ff3300' : '#ffffff');
            bettingHtml += `
            < div style = "margin-top: 10px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-weight: bold;" >
                    <span>TOTAL P/L:</span>
                    <span style="color: ${totalColor};">${lastMatchBettingResult >= 0 ? '+' : ''}${lastMatchBettingResult.toFixed(0)}</span>
                </div >
            `;
            summaryBettingResult.innerHTML = bettingHtml;
        } else {
            summaryBettingResult.innerHTML = 'No bets placed for this match.';
        }

        const summarySessionResult = document.getElementById('summary-session-result');
        summarySessionResult.innerHTML = `Session P / L: <span style="color: #00ff44;">+${sessionWins.toFixed(0)}</span> / <span style="color: #ff3300;">-${sessionLosses.toFixed(0)}</span>`;


        let summaryNames = [...currentCompetitors];
        if (goldenBallPurchased) {
            summaryNames.push("GOLDEN-ONE");
        }

        const allBallStats = summaryNames.map(name => {
            const stats = hallOfFame[name] || { wins: 0, games: 0, kills: 0 };
            const winsCount = typeof stats === 'number' ? stats : (stats.wins || 0);
            return { name, wins: winsCount };
        }).sort((a, b) => b.wins - a.wins);

        const top2 = matchRankings.slice(-2);

        allBallStats.forEach(ball => {
            const item = document.createElement('div');
            item.className = 'summary-item';
            let winsText = `${ball.wins} Wins`;
            if (ball.name === "GOLDEN-ONE") {
                if (top2.includes("GOLDEN-ONE")) {
                    winsText = "<span style='color: #ffd700;'>SURVIVED</span>";
                } else {
                    winsText = "<span style='opacity: 0.5;'>ELIMINATED</span>";
                }
            }
            item.innerHTML = `
                <span class="summary-item-name">${ball.name}</span>
                <span class="summary-item-wins">${winsText}</span>
            `;
            summaryList.appendChild(item);
        });

        // TIER 5: Match MVP Stats
        const perfContainer = document.getElementById('summary-performance-container');
        perfContainer.innerHTML = '<h3 style="color: var(--accent-color); margin-bottom: 15px; text-align: center;">MATCH PERFORMANCE</h3>';

        const sortedByDamage = [...balls].sort((a, b) => b.matchDamageDealt - a.matchDamageDealt);
        const sortedByKE = [...balls].sort((a, b) => b.matchMaxKineticEnergy - a.matchMaxKineticEnergy);

        const topDamage = sortedByDamage[0];
        const topKE = sortedByKE[0];

        perfContainer.innerHTML += `
            <div class="summary-item" style="border-color: #ff3300;">
                <span class="summary-item-name" style="color: #ff3300;">Aggressor: <strong>${topDamage.name}</strong></span>
                <span class="summary-item-wins">${Math.ceil(topDamage.matchDamageDealt)} DMG</span>
            </div>
            <div class="summary-item" style="border-color: #00f2ff;">
                <span class="summary-item-name" style="color: #00f2ff;">High Impact: <strong>${topKE.name}</strong></span>
                <span class="summary-item-wins">${Math.ceil(topKE.matchMaxKineticEnergy)} KE</span>
            </div>
        `;

        stopOST();
    } catch (e) {
        console.error("Summary screen error:", e);
        // Fallback: show betting overlay so user isn't stuck
        setTimeout(showBettingOverlay, 1000);
    }
}

window.addEventListener('resize', resize);
restartBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    showBettingOverlay();
});

nextMatchBtn.addEventListener('click', () => {
    summaryOverlay.classList.add('fade-out');
    if (audioCtx.state === 'suspended') audioCtx.resume();
    setTimeout(() => {
        summaryOverlay.classList.add('hidden');
        showBettingOverlay();
    }, 500);
});

window.addEventListener('mousedown', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
});

resetDataBtn.onclick = () => {
    if (confirm("Are you sure? This will clear all Career Wins, Kills, and reset your Credits to 1000.")) {
        localStorage.removeItem('ballArena_bank');
        localStorage.removeItem('ballArena_HoF');
        bank = 1000;
        hallOfFame = {};
        saveBank();
        showBettingOverlay();
        speak("Data purged. A fresh start awaits.");
    }
};

resize();
showBettingOverlay();
requestAnimationFrame(loop);
