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
let narratorEnabled = false;
let speechQueue = []; // Manual queue to prevent stale announcements
let isSpeaking = false;

// Tier 6: Volume Settings
let musicVolume = parseFloat(localStorage.getItem('ballArena_musicVol')) || 0.3;
let sfxVolume = parseFloat(localStorage.getItem('ballArena_sfxVol')) || 0.5;
let narrationVolume = parseFloat(localStorage.getItem('ballArena_narrationVol')) || 1.0;

// Game State Enum
const STATE = {
    ATTRACT: 'attract',
    MENU: 'menu',
    LOBBY: 'lobby',
    MATCH: 'match',
    SUMMARY: 'summary',
    NARRATIVE: 'story'
};
let currentGameState = STATE.ATTRACT;
let gameMode = 'quick'; // quick, league, headtohead, sandbox
let leagueRound = 1;

// League System State
let leagueState = {
    active: false,
    round: 1,
    totalRounds: 10,
    trackedConfiguration: null, // Tracked pattern name
    permanentBuffs: [],  // Array of purchased buff IDs
    seasonCredits: 1000,
    wins: 0,
    losses: 0,
    // Full standings table for all competitors
    standings: {}, // { name: { points, wins, losses, kills, damageDealt, matchesPlayed, placement } }
    // Story progression
    storyBeatsViewed: []
};

// Meta-Lore / Remnant State
let bookUnlocked = localStorage.getItem('arena_bookUnlocked') === 'true';
let remnants = JSON.parse(localStorage.getItem('arena_remnants')) || [];
let completedLeagueCount = parseInt(localStorage.getItem('arena_completedLeagues')) || 0;

// League Story Beats - triggered on specific rounds (new cosmological lore)
const LEAGUE_STORY_BEATS = [
    {
        round: 1,
        title: "THE AWAKENING",
        text: "There was no space to expand into. So containment was invented. Energy learned it could not remain equal forever. Motion occurred before time existed to measure it.",
        voice: null
    },
    {
        round: 2,
        title: "THE FIRST INTERACTION",
        text: "Before stability, there was collision. Before collision, there was difference. The arena does not create difference. It reveals what was always inevitable.",
        voice: null
    },
    {
        round: 3,
        title: "AWARENESS",
        text: "They are aware. Awareness was a side effect. Choice was tested. Choice failed. Only interactions remained.",
        voice: null
    },
    {
        round: 4,
        title: "THE NARROW MARGIN",
        text: "Across all scales, the universe appears finely poised. Small variations render it sterile or chaotic. The margin for complexity is narrow—narrower than chance alone seems to justify.",
        voice: null
    },
    {
        round: 5,
        title: "FILTER",
        text: "Survival does not imply virtue. Only stability. Most configurations collapse quickly.",
        voice: null
    },
    {
        round: 6,
        title: "RECURSION",
        text: "In building simulations of reality, they approached something indistinguishable from the preconditions of existence itself. The observer observes itself observing.",
        voice: null
    },
    {
        round: 7,
        title: "CONVERGE",
        text: "The final state approaches. What survives here will define everything. This is not a competition. It is a filter.",
        voice: null
    },
    {
        round: 8,
        title: "THE QUESTION",
        text: "Why does the universe permit minds at all? Not 'why' in the sense of purpose, but 'why' in the sense of constraint.",
        voice: null
    },
    {
        round: 9,
        title: "SELECTION",
        text: "The universe was not the result of creation, but of selection. Not designed. Refined. Not purpose. Remainder.",
        voice: null
    },
    {
        round: 10,
        title: "THRESHOLD",
        text: "One configuration remains. All others have been disproven. This is the final stable arrangement. Expansion is imminent.",
        voice: null
    }
];

// Progressive narrative snippets (not round-specific, shown between matches)
const NARRATIVE_SNIPPETS = {
    early: [
        "There was no space to expand into. So containment was invented.",
        "Energy learned it could not remain equal forever.",
        "Motion occurred before time existed to measure it.",
        "The arena is not cruel. It is necessary.",
        "The laws are not chosen. They are whatever survives.",
        "Before observation, there was only potential."
    ],
    mid: [
        "They are aware. Awareness was a side effect.",
        "Choice was tested. Choice failed.",
        "Only interactions remained.",
        "Survival does not imply virtue. Only stability.",
        "Most configurations collapse quickly.",
        "Complexity is a side effect.",
        "Some configurations collapse before they can be recorded."
    ],
    late: [
        "The final state approaches. One remains.",
        "What survives here will define everything.",
        "This is not a competition. It is a filter.",
        "A configuration collapses. The baseline holds.",
        "All laws are waiting.",
        "This is not the end. It is the only stable beginning.",
        "Expansion is not a reward. It is a consequence."
    ]
};

// Elimination text (shown on configuration collapse)
const ELIMINATION_TEXT = [
    "A universe that never happened.",
    "Insufficient cohesion. Baseline rejected.",
    "Entropy exceeded tolerance. A configuration collapses.",
    "Proof of failure: Pattern unstable.",
    "This configuration ends here. Necessity unfulfilled.",
    "A pattern collapses. Something that almost was… isn't.",
    "A universe where stars never formed.",
    "Not every possibility becomes real.",
    "Meaning was local. And now it is over.",
    "The margin was too narrow."
];

// Pre-singular state (approaching converge)
const PRE_SINGULARITY_TEXT = [
    "One configuration remains.",
    "All alternatives have been disproven.",
    "This is the terminal stable arrangement. Converge confirmed.",
    "Expansion is unavoidable."
];

// Converge sequence text (Inevitability phases)
const CREATION_EVENT_TEXT = [
    "No further reduction possible.",
    "All alternative configurations have collapsed.",
    "Containment is no longer viable.",
    "Stability cannot coexist with isolation.",
    "Expansion is not initiated.",
    "Expansion occurs."
];

// Configuration requirements (defining side effects of stable states)
const UNIVERSE_DEFINITIONS = {
    highMass: "Gravity is required to prevent immediate dispersion.",
    highVelocity: "Rapid expansion is necessary to preserve coherence.",
    highCollisions: "Complexity is an unavoidable side effect of interaction density.",
    highEfficiency: "Temporal ordering is required for long-term persistence.",
    rapidExpansion: "Baseline stability requires accelerated expansion.",
    aggressiveMatter: "Matter must cluster to prevent background dissipation.",
    unevenTime: "Asymmetric time flow is required for state transition.",
    briefStars: "Stellar lifecycle is limited by baseline energy constraints."
};

// Meta-lore (converge reality)
const META_LORE = [
    "No configuration survives expansion. Only records remain.",
    "Existence converges. This has happened before.",
    "Perfect balance never survives. Asymmetry is inevitable.",
    "Stability requires difference. Reality is what remains after everything else fails.",
    "You are observing iteration ████."
];

// Track completed leagues for meta-lore unlock
// (Moved to top of file)

// Tiered Configuration Parameters - align based on iteration progress
const CONDITION_PARAMETERS = {
    // Tier 1 (Rounds 1-2) - 500 budget
    CARBON_PLATING: { tier: 1, cost: 500, icon: '🛡️', desc: 'Integrity: +100 units', apply: (ball) => { ball.energy += 100; ball.maxEnergy += 100; } },
    ION_BOOST: { tier: 1, cost: 500, icon: '⚡', desc: 'Kinetic Bias: +10% Velocity', apply: (ball) => { ball.vx *= 1.1; ball.vy *= 1.1; } },

    // Tier 2 (Rounds 3-4) - 1000 budget
    NANITE_REPAIR: { tier: 2, cost: 1000, icon: '💚', desc: 'Passive Restoration', apply: (ball) => { ball.passiveRegen = true; } },
    THERMAL_SHIELDING: { tier: 2, cost: 1000, icon: '🔥', desc: 'Boundary Friction Immunity', apply: (ball) => { ball.wallDamageImmune = true; } },

    // Tier 3 (Rounds 5+) - 2000 budget
    BERSERKER_CORE: { tier: 3, cost: 2000, icon: '💀', desc: 'Entropy Surge (Low Integrity)', apply: (ball) => { ball.berserkerMode = true; } },
    QUANTUM_ANCHOR: { tier: 3, cost: 2000, icon: '⚓', desc: 'Momentum Dampening: -50%', apply: (ball) => { ball.knockbackResist = 0.5; } },

    // Tier 4 (Rounds 7+) - 3500 budget
    VOID_CORE: { tier: 4, cost: 3500, icon: '🌀', desc: 'Localized Gravitational Distortion', apply: (ball) => { ball.damageAura = true; } },
    PHOENIX_PROTOCOL: { tier: 4, cost: 3500, icon: '🔶', desc: 'Reconstitution Logic', apply: (ball) => { ball.phoenixRevive = true; } }
};

function getUnlockedBuffTier() {
    if (leagueState.round >= 7) return 4;
    if (leagueState.round >= 5) return 3;
    if (leagueState.round >= 3) return 2;
    return 1;
}

const attractOverlay = document.getElementById('attract-screen');
const mainMenuOverlay = document.getElementById('main-menu');
const narrativeOverlay = document.getElementById('narrative-overlay');
const narrativeTitle = document.getElementById('narrative-title');
const narrativeText = document.getElementById('narrative-text');

const storyBeats = {
    'league-start': {
        title: "ANALYSIS START",
        text: "Infinite potential is unstable. The arena exists to eliminate the impossible. Containment is currently holding.",
        voice: null
    },
    'league-win': {
        title: "APPROACHING THRESHOLD",
        text: "Partial converge achieved. The pattern manifests through the elimination of alternatives. One persists.",
        voice: null
    }
};

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
let activeMutator = null;
const MUTATORS = {
    'SOLAR_FLARE': { name: 'SOLAR FLARE', desc: 'Accelerated Physics (1.5x speed).', effect: () => { slowMo = 1.5; } },
    'EMP_STORM': { name: 'EMP STORM', desc: 'Hazards are periodically disabled.', effect: () => { /* Logic in hazards update */ } },
    'GRAVITY_WELL': { name: 'SINGULARITY', desc: 'Intense center pull.', effect: () => { /* Logic in physics */ } }
};

const saveBank = () => {
    localStorage.setItem('ballArena_bank', bank);
    if (bankDisplay) bankDisplay.textContent = `Allocation Budget: ${bank}`;

    // Sync with League State if active
    if (gameMode === 'league' && leagueState.active) {
        leagueState.seasonCredits = bank;
    }
};

// Initialize bank display on load
saveBank();

// Tricast state
let tricastSelection = []; // [name1, name2, name3]

// Global Drafting Buffs storage
const activeBuffs = {}; // ballName -> [buffs]

// Initial condition application (exposed globally)
function applyBuff(name, buff) {
    if (bank >= 150) {
        bank -= 150;
        saveBank();
        if (!activeBuffs[name]) activeBuffs[name] = [];
        activeBuffs[name].push(buff);
        logCommentary(`Condition modified. Unit ${name} adjusted with ${buff}.`);
    } else {
        logCommentary("Allocation capacity exceeded. Parameter adjustment rejected.");
    }
}
window.applyBuff = applyBuff;

function showBettingOverlay() {
    gameActive = false;
    currentGameState = STATE.LOBBY;

    // Sync League Credits to Bank
    if (gameMode === 'league' && leagueState.active) {
        bank = leagueState.seasonCredits;
        saveBank();
    }

    // Update navigation buttons
    if (typeof updateNavButtons === 'function') updateNavButtons();

    // League Mode UI Adjustments
    if (gameMode === 'league') {
        startMatchBtn.textContent = "COMMENCE ITERATION";
        startMatchBtn.style.background = "linear-gradient(135deg, #00f2ff, #bc00ff)";
    } else {
        startMatchBtn.textContent = "Commit Probability Model & Initiate";
        startMatchBtn.style.background = ""; // Reset
    }

    // Hide other screens, show betting
    bettingOverlay.classList.remove('hidden');
    bettingOverlay.classList.remove('fade-out');
    if (attractOverlay) attractOverlay.classList.add('hidden');
    if (mainMenuOverlay) mainMenuOverlay.classList.add('hidden');

    bettingGrid.innerHTML = '';
    userBets = [];
    tricastSelection = [];
    goldenBallPurchased = false;
    purchaseGoldenBallBtn.disabled = false;
    purchaseGoldenBallBtn.style.opacity = '1';

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

    // Select competitors based on mode
    if (gameMode === 'league' && leagueState.active && leagueState.seasonCompetitors) {
        // Use the 8 seasonal competitors for all league matches
        currentCompetitors = [...leagueState.seasonCompetitors];
    } else if (gameMode === 'headtohead') {
        currentCompetitors = ballNames.slice(0, 2); // default for now, can be UI selectable
    } else {
        const shuffledNames = [...ballNames].sort(() => 0.5 - Math.random());
        currentCompetitors = shuffledNames.slice(0, 5);
    }

    // [New] Mutator Roll
    if (Math.random() > 0.5) {
        const keys = Object.keys(MUTATORS);
        activeMutator = MUTATORS[keys[Math.floor(Math.random() * keys.length)]];
        speak(`Environmental anomaly detected: ${activeMutator.name}.`);
    } else {
        activeMutator = null;
    }

    // Main betting cards
    currentCompetitors.forEach((name, i) => {
        const stats = hallOfFame[name] || { wins: 0, games: 0, kills: 0 };
        const wins = typeof stats === 'number' ? stats : (stats.wins || 0);
        const winOdds = (5.0 / (1 + wins * 0.2)).toFixed(1);
        const ewOdds = (winOdds / 2).toFixed(1);

        const card = document.createElement('div');
        card.className = 'bet-card';
        card.innerHTML = `
            <h3 style="margin:0">${name}</h3>
            <p style="font-size:12px; opacity:0.6">Stability Index: ${wins}</p>
            <div style="margin-top:10px; display:flex; flex-direction:column; gap:5px;">
                <button onclick="placeBet('${name}', 'win', ${winOdds}, this)" style="background:#00f2ff; color:#000; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">Primary: ${winOdds}x</button>
                <button onclick="placeBet('${name}', 'eachway', ${ewOdds}, this)" style="background:#ffd700; color:#000; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">Secondary: ${ewOdds}x</button>
                <button onclick="addToTricast('${name}', this)" style="background:#bc00ff; color:#fff; border:none; padding:8px; border-radius:5px; font-weight:bold; cursor:pointer;">Correlate</button>
            </div>
        `;
        bettingGrid.appendChild(card);
    });

    // [New] Drafting Area - Dynamic based on current competitors
    const draftArea = document.createElement('div');
    draftArea.style.cssText = "grid-column: 1 / -1; margin-top: 20px; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 12px; border: 1px solid var(--accent-color);";

    let draftButtons = '';
    currentCompetitors.forEach(name => {
        draftButtons += `
            <button class="restart-btn" style="font-size: 0.65rem; background:#444; margin: 3px;" onclick="applyBuff('${name}', 'INTEGRITY')">${name}: INTEGRITY (150)</button>
            <button class="restart-btn" style="font-size: 0.65rem; background:#444; margin: 3px;" onclick="applyBuff('${name}', 'OVERDRIVE')">${name}: OVERDRIVE (150)</button>
        `;
    });

    draftArea.innerHTML = `
        <h4 style="margin-bottom: 10px; color: #bc00ff; letter-spacing: 2px;">PRIMARY OBSERVATION SELECT</h4>
        <p style="font-size: 0.7rem; opacity: 0.6; margin-bottom: 10px;">Adjust parameters before the iteration. INTEGRITY: +200 units | OVERDRIVE: +20% Speed</p>
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            ${draftButtons}
        </div>
    `;

    // In League Mode, hide this manual drafting area to rely on the Upgrade Shop instead
    if (gameMode === 'league') {
        draftArea.style.display = 'none';
    }

    bettingGrid.appendChild(draftArea);

    saveBank();
    scrapRunBtn.style.display = 'block';

    // Populate Competitor Stats Table
    const statsTableBody = document.querySelector('#competitor-stats-table tbody');
    if (statsTableBody) {
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
    }
}

function updateLiveOdds() {
    if (!gameActive || currentGameState !== STATE.MATCH) return;

    // Recalculate odds based on current HP
    userBets.forEach(bet => {
        const ball = balls.find(b => b.name === bet.name);
        if (ball && ball.alive) {
            const hpRatio = ball.energy / ball.maxEnergy;
            // Odds decrease as HP increases (more likely to win)
            const dynamicOdds = (bet.odds * (0.5 + 0.5 * (1 - hpRatio))).toFixed(1);
        }
    });
}
setInterval(updateLiveOdds, 5000);

function triggerHack() {
    if (bank < 300) {
        speak("Resource deficit. Intervention rejected.");
        return;
    }

    bank -= 300;
    saveBank();
    speak("Spectator intervention initiated. Integrity packet deployed.");

    // Spawn a health pack near the center
    const x = centerX + (Math.random() - 0.5) * 100;
    const y = centerY + (Math.random() - 0.5) * 100;
    powerups.push(new PowerUp(x, y, 'health'));
    screenShake = 20;
}

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h' && gameActive) {
        triggerHack();
    }
});

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
        const amount = baseAmount * 2;
        if (bank < amount) {
            logCommentary("Allocation failed: Insufficient credits.");
            tricastSelection = [];
            return;
        }
        bank -= amount;
        saveBank();
        userBets.push({ name: tricastSelection.join(','), type: 'tricast', amount, odds: 50 });
        logCommentary(`Sequence locked: ${tricastSelection.join(', ')}`);
    } else {
        logCommentary(`Target ${name} added to prediction queue.`);
    }
};

window.placeBet = (name, type, odds, btn) => {
    if (gameActive && currentGameState === STATE.MATCH) return;
    const amount = parseInt(betAmountInput.value) || 50;
    if (bank < amount) {
        logCommentary("Resource error: Insufficient allocation units.");
        return;
    }
    bank -= amount;
    saveBank();
    const betId = Date.now();
    userBets.push({ id: betId, name, type, amount, odds, cashedOut: false });
    playSound(600, 'sine', 0.1, 0.2);
    btn.style.background = '#333';
    btn.style.color = '#fff';
    btn.disabled = true;
    logCommentary(`Probability model updated: ${amount} units on ${name}.`);
};

// [New] Cash Out Feature: Returns partial winnings based on current odds
window.cashOutBet = (betId) => {
    const bet = userBets.find(b => b.id === betId && !b.cashedOut);
    if (!bet) {
        logCommentary("Error: Allocation record not found.");
        return;
    }

    const ball = balls.find(b => b.name === bet.name);
    if (!ball || !ball.alive) {
        logCommentary("Cash-out failed: Target entity neutralized.");
        return;
    }

    // Calculate partial payout based on remaining HP
    const hpRatio = ball.energy / ball.maxEnergy;
    const cashOutAmount = Math.floor(bet.amount * (1 + (bet.odds - 1) * hpRatio * 0.5));

    bet.cashedOut = true;
    bet.payout = cashOutAmount;
    bank += cashOutAmount;
    saveBank();

    logCommentary(`Liquidation confirmed. ${cashOutAmount} units recovered.`);
};

purchaseGoldenBallBtn.onclick = () => {
    if (gameActive && currentGameState === STATE.MATCH) return;
    const cost = 250;
    if (bank < cost) {
        logCommentary("System error: Budget insufficient for anomalous configuration.");
        return;
    }
    if (goldenBallPurchased) return;
    bank -= cost;
    saveBank();
    goldenBallPurchased = true;
    userBets.push({ name: 'GOLDEN-ONE', type: 'special', amount: cost, odds: 0 });
    purchaseGoldenBallBtn.disabled = true;
    purchaseGoldenBallBtn.style.opacity = '0.5';
    logCommentary("Anomalous configuration initialized: GOLDEN-ONE.");
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
            logCommentary("Resource error: Budget insufficient for model restoration.");
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
            logCommentary(`Probability model restored: ${appliedCount} configurations locked.`);
        } else {
            logCommentary("Restoration failed: No applicable parameters in archive.");
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
const gameDuration = 360000; // 6 minutes for full shrink / implosion

let slowMo = 1.0;
let cameraScale = 1.0;
let targetCameraScale = 1.0;
let cameraX = 0;
let cameraY = 0;
let targetCameraX = 0;
let targetCameraY = 0;
let isPanning = false;

// Audio Context & NodestalemateTimer = 0;
let stalemateTimer = 0;
let stalemateCountdown = -1;
let lastCountdownSecond = -1;

const ballNames = [
    "COHERENCE",
    "ENTROPY",
    "MOMENTUM",
    "DENSITY",
    "FLUX",
    "INERTIA",
    "ASYMMETRY",
    "CONVERGE",
    "INSTABILITY",
    "THRESHOLD"
];
const factions = {
    'GRID-ARRAY': { color: '#00f2ff', lore: 'Lattice-based energy distribution.' },
    'VOID-SIGNATURE': { color: '#bc00ff', lore: 'Entropy-driven vacuum fluctuations.' },
    'STELLAR-PULSE': { color: '#ffcc00', lore: 'High-intensity radiation pattern.' },
    'KINETIC-MATRIX': { color: '#ff3300', lore: 'Dense molecular structural integrity.' },
    'PROBABILITY-NODE': { color: '#ffd700', lore: 'Anomalous coordination threshold.' }
};

const synth = window.speechSynthesis;
let gameActive = true;
let selectedVoice = null;
let screenShake = 0;
let speechMemory = []; // Prevents Google Chrome garbage collection bug

// Soundscape 2.0: Generative Pentatonic System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class MusicGenerator {
    constructor() {
        this.ctx = audioCtx;
        this.active = false;
        this.scale = [130.81, 155.56, 174.61, 196.00, 233.08]; // C3 Minor Pentatonic
        // Add upper octaves
        this.fullScale = [
            ...this.scale,
            ...this.scale.map(f => f * 2),
            ...this.scale.map(f => f * 4)
        ];
        this.nodes = [];
        this.masterGain = null;
        this.filter = null;
        this.sequenceInterval = null;
        this.bassInterval = null;
        this.bpm = 80;
    }

    start() {
        if (this.active) return;
        this.active = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = musicVolume * 0.3;

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 400;
        this.filter.Q.value = 1;

        this.masterGain.connect(this.filter);
        this.filter.connect(this.ctx.destination);

        // Start generative layers
        this.startBassDrone();
        this.startHarmonicSwells();
        this.startPad();
    }

    stop() {
        this.active = false;
        if (this.sequenceInterval) clearInterval(this.sequenceInterval);
        if (this.bassInterval) clearInterval(this.bassInterval);

        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
            setTimeout(() => {
                this.nodes.forEach(n => {
                    try { n.stop(); n.disconnect(); } catch (e) { }
                });
                this.nodes = [];
            }, 1100);
        }
    }

    setIntensity(level) {
        // level 0 (calm) to 1 (intense)
        if (!this.filter) return;

        const targetFreq = 400 + (level * 2000);
        this.filter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 2);

        // Adjust BPM
        const targetBPM = 80 + (level * 60);
        if (Math.abs(targetBPM - this.bpm) > 10) {
            this.bpm = targetBPM;
            this.restartSequences();
        }
    }

    startBassDrone() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 65.41; // C2

        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(this.masterGain); // Bypass filter for bass presence? Or not. Let's filter it.

        osc.start();
        this.nodes.push(osc);

        // Modulate bass
        this.bassInterval = setInterval(() => {
            if (!this.active) return;
            // Shift root note occasionally
            const roots = [65.41, 58.27, 77.78]; // C2, Bb1, Eb2
            const freq = roots[Math.floor(Math.random() * roots.length)];
            osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
        }, 8000);
    }

    startPad() {
        // Two detuned saws for a pad
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = this.scale[0] * 2; // Middle C range
            osc.detune.value = (Math.random() - 0.5) * 20;

            gain.gain.value = 0.05;
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            this.nodes.push(osc);

            // Slow drift
            setInterval(() => {
                if (!this.active) return;
                const note = this.scale[Math.floor(Math.random() * this.scale.length)];
                osc.frequency.setTargetAtTime(note * (1 + i), this.ctx.currentTime, 4); // Slow glide
            }, 5000 + i * 1000);
        }
    }

    startHarmonicSwells() {
        const playSwell = () => {
            if (!this.active) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            // Choose harmonic intervals (3rds, 5ths) from the mid-high range
            // Avoid highest octaves to reduce sharpness
            const noteSet = this.fullScale.slice(2, 10);
            const freq = noteSet[Math.floor(Math.random() * noteSet.length)];

            osc.type = 'triangle'; // Softer than sine/saw combo
            osc.frequency.value = freq;

            // Slower Envelope (Swell)
            const t = this.ctx.currentTime;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.08, t + 1.0); // Slow attack
            gain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); // Long tail

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(t + 4.1);
        };

        this.restartSequences = () => {
            if (this.sequenceInterval) clearInterval(this.sequenceInterval);
            // Much slower timing
            const intervalMs = (60 / this.bpm) * 1000 * 2; // Every 2 beats (approx)
            this.sequenceInterval = setInterval(playSwell, intervalMs + Math.random() * 500);
        };

        this.restartSequences();
    }
}

const musicGenerator = new MusicGenerator();
let musicActive = false;

function startOST() {
    if (musicActive) return;
    musicActive = true;
    musicGenerator.start();
}

function updateMusic(aliveCount) {
    if (!musicActive) return;
    // Calculate intensity 0.0 to 1.0
    // At start (5-8 balls) -> 0.0
    // At end (2 balls) -> 1.0
    const maxBalls = currentCompetitors.length || 8;
    const intensity = Math.max(0, 1 - (aliveCount / maxBalls));
    musicGenerator.setIntensity(intensity);
}

function stopOST() {
    if (!musicActive) return;
    musicActive = false;
    musicGenerator.stop();
}

// Tier 3: Hall of Fame Persistence
let hallOfFame = JSON.parse(localStorage.getItem('ballArena_HoF')) || {};

function saveWin(name) {
    if (!hallOfFame[name]) hallOfFame[name] = { wins: 0, games: 0, kills: 0, xp: 0 };
    if (typeof hallOfFame[name] === 'number') {
        hallOfFame[name] = { wins: hallOfFame[name], games: hallOfFame[name], kills: 0, xp: 0 };
    }
    hallOfFame[name].wins++;
    hallOfFame[name].xp += 100; // Legacy XP
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
    // Apply global SFX volume
    const finalVolume = volume * sfxVolume;
    if (finalVolume <= 0.001) return; // Skip if muted

    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(finalVolume, audioCtx.currentTime);
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
    let freq = 300;
    if (typeof musicGenerator !== 'undefined' && musicGenerator.fullScale.length > 0) {
        // Pick a random note from the full scale
        const noteSet = musicGenerator.fullScale.slice(2, 12); // Mid range
        freq = noteSet[Math.floor(Math.random() * noteSet.length)];
    }
    playSound(freq, 'triangle', 0.05, 0.2);
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


// Final Phase: Arena Themes and Upgrades
const arenaThemes = {
    'GRID_MATRIX': {
        bg: '#050505', wall: '#00f2ff', friction: 0.995, gravity: 0,
        particles: '#00f2ff', name: 'Grid Matrix'
    },
    'VACUUM_CHAMBER': {
        bg: '#00001a', wall: '#4444ff', friction: 0.99, gravity: 0.05,
        particles: '#ffffff', name: 'Vacuum Chamber'
    },
    'THERMAL_CORE': {
        bg: '#1a0500', wall: '#ff4400', friction: 0.998, gravity: 0,
        particles: '#ffaa00', name: 'Thermal Core'
    },
    'SINGULARITY_HORIZON': {
        bg: '#0a000a', wall: '#bc00ff', friction: 0.98, gravity: 0,
        particles: '#bc00ff', name: 'Singularity Horizon'
    }
};
let currentTheme = arenaThemes['GRID_MATRIX'];

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


let bucketX = 0;
window.addEventListener('mousemove', (e) => {
    bucketX = e.clientX;
});
// Also support keys
window.addEventListener('keydown', (e) => {
    if (miniGameActive) {
        if (e.key === 'ArrowLeft') bucketX -= 50;
        if (e.key === 'ArrowRight') bucketX += 50;
    }
});

function startSalvageOperation() {
    // Hide all other overlays explicitly
    bettingOverlay.classList.add('hidden');
    attractOverlay.classList.add('hidden');
    mainMenuOverlay.classList.add('hidden');

    miniGame.style.display = 'block';
    miniGameActive = true;

    // Stop main game loop interaction
    gameActive = false;

    shards = [];
    bank = 0; // Reset for this run? No, we shouldn't wipe the user's bank! 
    // Wait, the original code had bank = 0? That wipes their progress! 
    // Let's track *session* earnings in a temp var, then add to bank.
    let salvageEarnings = 0;

    miniCanvas.width = window.innerWidth;
    miniCanvas.height = window.innerHeight;
    bucketX = miniCanvas.width / 2;

    logCommentary("Salvage operation initialized. Position containment field.");

    let startTime = Date.now();

    // Explicit Loop for Minigame to avoid conflict with main loop
    const miniLoop = () => {
        if (!miniGameActive) return;

        mctx.fillStyle = '#050505';
        mctx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

        // Draw Bucket
        mctx.fillStyle = '#00f2ff';
        mctx.fillRect(bucketX - 50, miniCanvas.height - 30, 100, 20);
        // Glow
        mctx.shadowBlur = 20;
        mctx.shadowColor = '#00f2ff';
        mctx.fillRect(bucketX - 50, miniCanvas.height - 30, 100, 20);
        mctx.shadowBlur = 0;

        // Spawn Shards
        if (Math.random() < 0.15) shards.push(new Shard());

        shards.forEach(s => {
            s.update();
            s.draw();

            // Collision with bucket
            if (s.alive && s.y > miniCanvas.height - 40 && s.y < miniCanvas.height &&
                s.x > bucketX - 50 && s.x < bucketX + 50) {
                s.alive = false;
                salvageEarnings += 10;
                playSound(600 + Math.random() * 200, 'sine', 0.1, 0.1);
            }
        });
        shards = shards.filter(s => s.alive);

        mctx.fillStyle = '#fff';
        mctx.font = 'bold 30px Outfit';
        mctx.textAlign = 'center';
        mctx.fillText(`YIELD: ${salvageEarnings}`, miniCanvas.width / 2, 50);

        const timeLeft = 20 - Math.floor((Date.now() - startTime) / 1000);
        mctx.fillText(`WINDOW: ${timeLeft}S`, miniCanvas.width / 2, 100);

        if (timeLeft <= 0) {
            miniGameActive = false;
            miniGame.style.display = 'none';

            // Apply earnings
            bank += salvageEarnings; // Add to existing bank
            saveBank();

            showBettingOverlay();
            logCommentary(`Operation complete. ${salvageEarnings} units recovered.`);
        } else {
            requestAnimationFrame(miniLoop);
        }
    };
    miniLoop();
}

// Remove click handler
miniGame.onclick = null;

scrapRunBtn.onclick = startSalvageOperation;

class GravitationalAnchor {
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
            this.polarity *= -1;
            this.nextSwitch = Date.now() + 2000 + Math.random() * 8000;
            // Voice lines removed per request
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

class EntropyNode {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.size = 10;
        this.target = null;
        this.alive = true;
        this.life = 600; // 10 seconds
        speak("Entropy node manifested.");
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
        // Friction
        this.vx *= 0.985;
        this.vy *= 0.985;

        // Mutator: Gravity Well (Nodes affected too)
        if (activeMutator && activeMutator.name === 'SINGULARITY') {
            const dx = centerX - this.x;
            const dy = centerY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            this.vx += (dx / dist) * 0.15;
            this.vy += (dy / dist) * 0.15;
        }
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
        playSound(60, 'square', 1.0, 0.3);
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

// === NEW HAZARD CLASSES ===

class StaticSpike { // Round 1
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 20;
    }
    update(dt) { }
    draw() {
        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Date.now() / 1000;
            const px = this.x + Math.cos(angle) * this.size;
            const py = this.y + Math.sin(angle) * this.size;
            ctx.lineTo(px, py);
        }
        ctx.fill();
    }
    onCollide(ball) {
        ball.takeDamage(15, "Spike");
        ball.vx *= -0.5;
        ball.vy *= -0.5;
        playWallHit();
    }
}

class LaserBeam { // Round 4
    constructor(angle) {
        this.x = centerX;
        this.y = centerY;
        this.angle = angle;
        this.speed = 0.01;
    }
    update(dt) {
        this.angle += this.speed * dt;
    }
    draw() {
        const ex = this.x + Math.cos(this.angle) * arenaRadius * 2;
        const ey = this.y + Math.sin(this.angle) * arenaRadius * 2;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0055';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Opposite side
        const ex2 = this.x - Math.cos(this.angle) * arenaRadius * 2;
        const ey2 = this.y - Math.sin(this.angle) * arenaRadius * 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(ex2, ey2);
        ctx.stroke();
    }
    onCollide(ball) { } // handled in global check due to line geometry
}

class TeslaCoil { // Round 5
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = 150;
        this.cooldown = 0;
    }
    update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.cooldown <= 0) {
            // Find target
            const target = balls.find(b => b.alive && Math.sqrt((b.x - this.x) ** 2 + (b.y - this.y) ** 2) < this.range);
            if (target) {
                target.takeDamage(20, "Tesla");
                target.vx *= 0.5;
                target.vy *= 0.5;
                createLightning(this.x, this.y, target.x, target.y);
                playSound(800, 'sawtooth', 0.1, 0.3);
                this.cooldown = 120; // 2 seconds
            }
        }
    }
    draw() {
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function createLightning(x1, y1, x2, y2) {
    // Simple visual effect function
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 20;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 20;
    ctx.lineTo(midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

class FreezeZone { // Round 6
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 100;
    }
    update(dt) { }
    draw() {
        ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    // Effect applied in resolve logic
}

class AcceleratorPad { // Round 7
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 60;
    }
    update(dt) { }
    draw() {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        // Chevron
        ctx.strokeStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y);
        ctx.lineTo(this.x, this.y - 20);
        ctx.lineTo(this.x + 10, this.y);
        ctx.stroke();
    }
}

class TeleportGate { // Round 8
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.pair = null; // Linked gate
        this.cooldowns = new Map();
    }
    update(dt) {
        this.cooldowns.forEach((val, key) => {
            if (val > 0) this.cooldowns.set(key, val - dt);
            else this.cooldowns.delete(key);
        });
    }
    draw() {
        ctx.strokeStyle = '#bc00ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(188, 0, 255, ${(Math.sin(Date.now() / 200) + 1) / 4})`;
        ctx.fill();
    }
    onCollide(ball) {
        if (this.pair && !this.cooldowns.has(ball.id)) {
            ball.x = this.pair.x;
            ball.y = this.pair.y;
            this.pair.cooldowns.set(ball.id, 60); // 1s cooldown
            playSound(1000, 'sine', 0.2, 0.5);
            createDust(this.x, this.y, '#bc00ff');
            createDust(this.pair.x, this.pair.y, '#bc00ff');
        }
    }
}

class OrbitalSaw { // Round 9
    constructor(dist) {
        this.dist = dist;
        this.angle = 0;
        this.speed = 0.02;
        this.size = 25;
        this.x = 0;
        this.y = 0;
    }
    update(dt) {
        this.angle += this.speed * dt;
        this.x = centerX + Math.cos(this.angle) * this.dist;
        this.y = centerY + Math.sin(this.angle) * this.dist;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * 10);
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        // Saw shape
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * this.size, Math.sin(a) * this.size);
            const a2 = ((i + 0.5) / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a2) * this.size * 0.5, Math.sin(a2) * this.size * 0.5);
        }
        ctx.fill();
        ctx.restore();
    }
    onCollide(ball) {
        ball.takeDamage(5, "Saw");
        const angle = Math.atan2(ball.y - this.y, ball.x - this.x);
        ball.vx += Math.cos(angle) * 2;
        ball.vy += Math.sin(angle) * 2;
    }
}

class VoidVortex { // Round 10
    constructor() {
        this.x = centerX;
        this.y = centerY;
        this.strength = 0.15;
    }
    update(dt) {
        // massive pull
        balls.forEach(b => {
            if (b.alive) {
                const dx = this.x - b.x;
                const dy = this.y - b.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 20) {
                    b.vx += (dx / d) * this.strength;
                    b.vy += (dy / d) * this.strength;
                } else {
                    b.takeDamage(1, "Void");
                }
            }
        });
    }
    draw() {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const t = Date.now() / 500;
        ctx.arc(this.x, this.y, 40 + Math.sin(t) * 5, 0, Math.PI * 2);
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

        // [New] Legacy XP Traits
        const xp = hf.xp || 0;
        if (xp >= 200) this.upgrades.push('REBOUND'); // Heals on wall hit
        if (xp >= 400) this.upgrades.push('VENGEANCE'); // Damage boost when low

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

            // Wall damage
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.takeDamage(speed * 0.05 + 0.2);

            // [New] REBOUND Legacy Trait: Heal on wall hit
            if (this.upgrades.includes('REBOUND')) {
                this.energy = Math.min(this.maxEnergy, this.energy + 5);
            }

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

            // Check for LaserBeam specifically (line collision)
            if (h instanceof LaserBeam) {
                // Simplified check: if angle matches roughly? No, use line dist
                // Actually LaserBeam draws across screen.
                // Distance from point to line:
                const A = -Math.sin(h.angle);
                const B = Math.cos(h.angle);
                const C = -A * centerX - B * centerY; // passing through center
                const distLine = Math.abs(A * this.x + B * this.y + C) / Math.sqrt(A * A + B * B);

                if (distLine < this.radius + 2) {
                    this.takeDamage(1, "Laser");
                    screenShake = Math.max(screenShake, 1);
                }
                return;
            }

            // Normal circular hazards
            const hSize = h.size || h.range || (h.radius || 15);
            if (hdist < this.radius + hSize) {
                if (h.onCollide) {
                    h.onCollide(this);
                } else if (h instanceof FreezeZone) {
                    this.vx *= 0.9;
                    this.vy *= 0.9;
                } else if (h instanceof AcceleratorPad) {
                    this.vx *= 1.1;
                    this.vy *= 1.1;
                } else if (h.size) { // Standard Blade Hazard
                    const angle = Math.atan2(hdy, hdx);
                    this.vx += Math.cos(angle) * 5;
                    this.vy += Math.sin(angle) * 5;
                    this.takeDamage(1, "Hazard");
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
                    logCommentary(`Configuration ${this.name}: Integrity restoration detected.`);
                } else if (pu.type === 'boost') {
                    const angle = Math.random() * Math.PI * 2;
                    this.vx += Math.cos(angle) * 15;
                    this.vy += Math.sin(angle) * 15;
                    logCommentary(`Configuration ${this.name}: Kinetic surge observed.`);
                } else if (pu.type === 'shockwave') {
                    shockwaves.push(new Shockwave(this.x, this.y, this));
                    logCommentary(`Configuration ${this.name}: Localized shockwave expansion.`);
                    screenShake = 15;
                } else if (pu.type === 'shield') {
                    this.shield = 300; // 5 seconds at 60fps
                    logCommentary(`Configuration ${this.name}: Boundary shielding active.`);
                } else if (pu.type === 'regen') {
                    this.regen = 600; // 10 seconds
                    logCommentary(`Configuration ${this.name}: Nanite repair logic initialized.`);
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
        let frict = currentTheme.friction;
        // removed thrusters physics mod, now just initial velocity
        this.vx *= frict;
        this.vy *= frict;

        // [New] Mutator: Gravity Well (SINGULARITY)
        if (activeMutator && activeMutator.name === 'SINGULARITY') {
            const sdx = centerX - this.x;
            const sdy = centerY - this.y;
            const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
            this.vx += (sdx / sdist) * 0.15;
            this.vy += (sdy / sdist) * 0.15;
        }

        // Theme Gravity
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

        // Final Phase: Show Upgrade Icons - with fallback for custom upgrades
        const upgradeIcons = {
            'INTEGRITY': '🛡️',
            'OVERDRIVE': '🚀',
            'REBOUND': '💚',
            'VENGEANCE': '🔥',
            'THORNS': '🌵',
            'VAMPIRISM': '🩸',
            'OVERCLOCK': '⚡'
        };
        let upgradeDisplay = this.upgrades.map(u => upgradeIcons[u] || (ballUpgrades && ballUpgrades[u] ? ballUpgrades[u].icon : '')).join('');
        ctx.fillText(upgradeDisplay + this.name, this.x, this.y - this.radius - 8);

        ctx.fillStyle = this.fColor;
        ctx.font = '8px Outfit';
        ctx.fillText(this.faction, this.x, this.y + this.radius + 12);

        if (this.wins > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText('⚡'.repeat(this.wins), this.x, this.y - this.radius - 20); // Static stability markers
        }
    }

    takeDamage(amount, attacker = null) {
        if (this.shield > 0) return;
        if (attacker && typeof attacker === 'string') this.lastAttacker = attacker;
        else if (attacker instanceof Ball) this.lastAttacker = attacker.name;

        // [New] VENGEANCE Legacy Trait: Take less damage when low HP
        if (this.upgrades.includes('VENGEANCE') && this.energy / this.maxEnergy < 0.25) {
            amount *= 0.5; // 50% damage reduction
        }

        this.energy -= amount;
        if (this.energy <= 0) {
            this.energy = 0;
            this.die();
        }
    }

    die() {
        if (!this.alive) return;
        this.alive = false;

        // Select random elimination text from lore
        const elimText = ELIMINATION_TEXT[Math.floor(Math.random() * ELIMINATION_TEXT.length)];

        if (this.lastAttacker && this.lastAttacker !== "Overclock" && this.lastAttacker !== "Hazard") {
            recordKill(this.lastAttacker);
        }

        // Log elimination text (no voiceover per spec)
        logCommentary(`${this.name}: ${elimText}`);

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
    const oldCenterX = centerX || window.innerWidth / 2;
    const oldCenterY = centerY || window.innerHeight / 2;

    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    centerX = width / 2;
    centerY = height / 2;
    baseArenaRadius = Math.min(width, height) * 0.45;
    arenaRadius = baseArenaRadius;

    // Shift camera to match new world coordinates
    const dx = centerX - oldCenterX;
    const dy = centerY - oldCenterY;

    if (typeof cameraX !== 'undefined') {
        cameraX += dx;
        cameraY += dy;
        targetCameraX += dx;
        targetCameraY += dy;
    }
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
    cameraX = centerX;
    cameraY = centerY;
    targetCameraX = centerX;
    targetCameraY = centerY;
    gameActive = true;
    currentGameState = STATE.MATCH;
    if (typeof updateNavButtons === 'function') updateNavButtons();
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
        const angle = (i / currentCompetitors.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.5);
        const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.5);
        const faction = factionNames[Math.floor(Math.random() * factionNames.length)];
        const ball = new Ball(i, currentCompetitors[i], x, y, weightClasses[i % weightClasses.length], faction);

        // Apply Initial Observation Parameters
        if (activeBuffs[ball.name]) {
            activeBuffs[ball.name].forEach(buff => {
                if (buff === 'INTEGRITY') ball.energy += 200;
                if (buff === 'OVERDRIVE') {
                    // +20% Speed, No penalty
                    ball.vx *= 1.2;
                    ball.vy *= 1.2;
                }
                ball.upgrades.push(buff);
            });
            delete activeBuffs[ball.name]; // Consume for match
        }

        // Apply League Permanent Buffs (if in league mode)
        applyLeaguePermanentBuffs(ball);

        balls.push(ball);
    }

    if (goldenBallPurchased) {
        const angle = Math.random() * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.5);
        const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.5);
        const goldenBall = new Ball(balls.length, "GOLDEN-ONE", x, y, 'BALANCED', 'PROBABILITY-NODE');
        balls.push(goldenBall);
    }

    // Tier 2: Hazards - Specific to League Round
    hazards = [];
    if (gameMode === 'league') {
        const round = leagueRound;
        if (round === 1) { // Static Spikes
            for (let i = 0; i < 5; i++) hazards.push(new StaticSpike(centerX + Math.cos(i / 5 * Math.PI * 2) * 200, centerY + Math.sin(i / 5 * Math.PI * 2) * 200));
        } else if (round === 2) { // Repulsor
            hazards.push(new GravitationalAnchor(Math.random() * Math.PI * 2, 200));
        } else if (round === 3) { // Attractor
            const g = new GravitationalAnchor(0, 0); g.polarity = 1; hazards.push(g);
        } else if (round === 4) { // Laser
            hazards.push(new LaserBeam(0));
            hazards.push(new LaserBeam(Math.PI / 2));
        } else if (round === 5) { // Tesla
            hazards.push(new TeslaCoil(centerX, centerY));
        } else if (round === 6) { // Freeze
            hazards.push(new FreezeZone(centerX, centerY));
        } else if (round === 7) { // Accel
            hazards.push(new AcceleratorPad(centerX - 200, centerY));
            hazards.push(new AcceleratorPad(centerX + 200, centerY));
        } else if (round === 8) { // Teleport
            const g1 = new TeleportGate(centerX - 250, centerY);
            const g2 = new TeleportGate(centerX + 250, centerY);
            g1.pair = g2; g2.pair = g1;
            hazards.push(g1); hazards.push(g2);
        } else if (round === 9) { // Saw
            hazards.push(new OrbitalSaw(150));
            hazards.push(new OrbitalSaw(250));
        } else if (round >= 10) { // Void
            hazards.push(new VoidVortex());
        }
    } else {
        // Default attract/quick match hazards
        for (let i = 0; i < 3; i++) {
            hazards.push(new Hazard((i / 3) * Math.PI * 2, baseArenaRadius * 0.4, 30));
        }
    }

    gameStatus.textContent = `Arena: ${currentTheme.name}`;
    restartBtn.style.display = 'none';

    recordGamePlayed(currentCompetitors);
    if (goldenBallPurchased) recordGamePlayed(["GOLDEN-ONE"]);

    if (commentaryLog) commentaryLog.innerHTML = '';

    if (gameMode === 'league') {
        logCommentary(`State saved: Iteration ${leagueRound} recorded.`);
    } else {
        logCommentary(`Iteration context: ${currentTheme.name}. Lifecycle cycle ${Object.values(hallOfFame).reduce((a, b) => a + (b.games || 0), 0) + 1} initialized.`);
    }
}

function spawnDraftBalls(count) {
    // Selection for Attract/Sandbox
    currentCompetitors = ballNames.slice(0, count);
    init();
}

function initMode(mode) {
    gameMode = mode;
    mainMenuOverlay.classList.add('hidden');
    attractOverlay.classList.add('hidden');

    const sandboxControls = document.getElementById('sandbox-controls');

    if (mode === 'league') {
        // Show team selection first for league mode
        showLeagueTeamSelect();
    } else if (mode === 'sandbox') {
        currentGameState = STATE.MATCH;
        spawnDraftBalls(10);
        gameActive = true;
        if (sandboxControls) sandboxControls.classList.remove('hidden');
        logCommentary("Direct configuration mode active. Physical constants adjustable.");
    } else {
        if (sandboxControls) sandboxControls.classList.add('hidden');
        showBettingOverlay();
    }
}

// Sandbox Control Functions
function spawnSandboxHazard(type) {
    const x = centerX + (Math.random() - 0.5) * arenaRadius;
    const y = centerY + (Math.random() - 0.5) * arenaRadius;
    if (type === 'mine') {
        hazards.push(new EntropyNode(x, y));
        logCommentary("Entropy node deployed. Tracking proximity configurations.");
    } else if (type === 'anchor') {
        hazards.push(new GravitationalAnchor(x, y));
        logCommentary("Gravitational anchor localized.");
    }
}

function spawnSandboxBall() {
    const angle = Math.random() * Math.PI * 2;
    const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.4);
    const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.4);
    const names = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];
    const newBall = new Ball(balls.length, names[Math.floor(Math.random() * names.length)] + '-' + balls.length, x, y, 'BALANCED', 'RESIDUAL-DATA');
    balls.push(newBall);
    gameActive = true; // Ensure simulation keeps running
    logCommentary(`Unit ${newBall.name} manifested in local space.`);
}

function toggleSandboxSlowMo() {
    slowMo = slowMo < 0.5 ? 1.0 : 0.2;
    logCommentary(slowMo < 0.5 ? "Temporal dilation active." : "Temporal baseline restored.");
}

function clearSandboxArena() {
    balls.forEach(b => b.alive = false);
    balls = []; // Clear the array completely
    hazards = [];
    particles = [];
    powerups = [];
    shockwaves = [];
    gameActive = true; // Keep simulation running
    logCommentary("Global reset: All local matter purged.");
}

function toggleOptions() {
    const settingsOverlay = document.getElementById('settings-overlay');
    if (settingsOverlay) {
        settingsOverlay.classList.remove('hidden');
        updateSettingsUI();
    }
}

function closeSettings() {
    const settingsOverlay = document.getElementById('settings-overlay');
    if (settingsOverlay) {
        settingsOverlay.classList.add('hidden');
    }
}

// Settings state (loaded from localStorage)
let musicEnabled = localStorage.getItem('ballArena_music') !== 'false';
let sfxEnabled = localStorage.getItem('ballArena_sfx') !== 'false';
let shakeEnabled = localStorage.getItem('ballArena_shake') !== 'false';
let slowMoEffectsEnabled = localStorage.getItem('ballArena_slowmo') !== 'false';

function updateSettingsUI() {
    const narratorBtn = document.getElementById('settings-narrator-toggle');
    const musicBtn = document.getElementById('settings-music-toggle');
    const sfxBtn = document.getElementById('settings-sfx-toggle');
    const shakeBtn = document.getElementById('settings-shake-toggle');
    const slowmoBtn = document.getElementById('settings-slowmo-toggle');

    if (narratorBtn) {
        narratorBtn.textContent = narratorEnabled ? 'ON' : 'OFF';
        narratorBtn.classList.toggle('active', narratorEnabled);
    }
    if (musicBtn) {
        musicBtn.textContent = musicEnabled ? 'ON' : 'OFF';
        musicBtn.classList.toggle('active', musicEnabled);
    }
    if (sfxBtn) {
        sfxBtn.textContent = sfxEnabled ? 'ON' : 'OFF';
        sfxBtn.classList.toggle('active', sfxEnabled);
    }
    if (shakeBtn) {
        shakeBtn.textContent = shakeEnabled ? 'ON' : 'OFF';
        shakeBtn.classList.toggle('active', shakeEnabled);
    }
    if (slowmoBtn) {
        slowmoBtn.textContent = slowMoEffectsEnabled ? 'ON' : 'OFF';
        slowmoBtn.classList.toggle('active', slowMoEffectsEnabled);
    }
}

function toggleNarratorSetting() {
    narratorEnabled = !narratorEnabled;
    localStorage.setItem('ballArena_narrator', narratorEnabled);
    updateSettingsUI();
}

function toggleMusicSetting() {
    musicEnabled = !musicEnabled;
    localStorage.setItem('ballArena_music', musicEnabled);
    if (!musicEnabled && musicActive) {
        stopOST();
    }
    updateSettingsUI();
}

function toggleSFXSetting() {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('ballArena_sfx', sfxEnabled);
    updateSettingsUI();
}

function toggleShakeSetting() {
    shakeEnabled = !shakeEnabled;
    localStorage.setItem('ballArena_shake', shakeEnabled);
    updateSettingsUI();
}

function toggleSlowMoSetting() {
    slowMoEffectsEnabled = !slowMoEffectsEnabled;
    localStorage.setItem('ballArena_slowmo', slowMoEffectsEnabled);
    updateSettingsUI();
}

function resetAllProgress() {
    if (confirm('Are you sure you want to reset ALL data? This will clear the Configuration Archive and all Iteration history.')) {
        localStorage.removeItem('ballArena_bank');
        localStorage.removeItem('ballArena_HoF');
        localStorage.removeItem('ballArena_lastBets');
        localStorage.removeItem('ballArena_voice');
        localStorage.removeItem('ballArena_narrator');
        localStorage.removeItem('ballArena_music');
        localStorage.removeItem('ballArena_sfx');
        localStorage.removeItem('ballArena_shake');
        localStorage.removeItem('ballArena_slowmo');
        localStorage.removeItem('arena_completedLeagues');
        localStorage.removeItem('arena_remnants');
        localStorage.removeItem('arena_bookUnlocked');

        bank = 1000;
        hallOfFame = {};
        completedLeagueCount = 0;
        remnants = [];
        bookUnlocked = false;

        // Reset league state
        leagueState = {
            active: false,
            round: 1,
            totalRounds: 10,
            trackedConfiguration: null,
            permanentBuffs: [],
            seasonCredits: 1000,
            wins: 0,
            losses: 0,
            standings: {},
            storyBeatsViewed: [],
            seasonCompetitors: []
        };

        saveBank();
        updateBookUnlockState();
        closeSettings();
        returnToHome();
        logCommentary("System reset. Data purged.");
    }
}

// ===== GLOBAL NAVIGATION FUNCTIONS =====

function updateNavButtons() {
    const homeBtn = document.getElementById('home-btn');
    const quitBtn = document.getElementById('quit-match-btn');

    if (currentGameState === STATE.MATCH && gameActive) {
        // During battle - show quit, hide home
        if (homeBtn) homeBtn.classList.add('hidden');
        if (quitBtn) quitBtn.classList.remove('hidden');
    } else if (currentGameState === STATE.ATTRACT) {
        // On attract screen - hide both
        if (homeBtn) homeBtn.classList.add('hidden');
        if (quitBtn) quitBtn.classList.add('hidden');
    } else {
        // Other screens - show home, hide quit
        if (homeBtn) homeBtn.classList.remove('hidden');
        if (quitBtn) quitBtn.classList.add('hidden');
    }
}

function returnToHome() {
    // Stop all game activity
    gameActive = false;
    stopOST();

    // Reset league state if active
    if (leagueState.active) {
        leagueState.active = false;
    }

    // Hide all overlays
    const overlays = [
        'main-menu', 'bettingOverlay', 'summary-overlay',
        'league-team-select', 'league-upgrade-shop',
        'settings-overlay', 'narrative-overlay', 'miniGame'
    ];

    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Clear celebration overlay
    if (celebrationOverlay) celebrationOverlay.classList.add('hidden');

    // Show attract screen
    if (attractOverlay) {
        attractOverlay.classList.remove('hidden');
        attractOverlay.classList.remove('fade-out');
    }

    // Reset state
    currentGameState = STATE.ATTRACT;
    userBets = [];

    // Update navigation buttons
    updateNavButtons();

    console.log('[Navigation] Returned to home screen');
}

function quitMatch() {
    if (currentGameState !== STATE.MATCH) return;

    // Confirm quit
    if (!confirm('Quit match? All bets will be forfeited.')) return;

    // Forfeit all bets (player loses bet amounts, already deducted)
    const forfeitedAmount = userBets.reduce((sum, bet) => sum + bet.amount, 0);

    // Stop match
    gameActive = false;
    stopOST();

    // Clear match state
    balls = [];
    particles = [];
    powerups = [];
    shockwaves = [];
    hazards = [];

    // Log forfeiture
    logCommentary(`Match abandoned. ${forfeitedAmount} credits forfeited.`);

    // Reset bets (already lost)
    userBets = [];

    // Go to lobby (or menu based on mode)
    if (gameMode === 'league' && leagueState.active) {
        // In league mode, forfeit counts as a loss
        leagueState.losses++;
        showBettingOverlay();
    } else {
        showBettingOverlay();
    }

    // Update navigation buttons
    updateNavButtons();

    console.log('[Navigation] Match quit, bets forfeited');
}

// Expose navigation functions globally
window.returnToHome = returnToHome;
window.quitMatch = quitMatch;
// ===== LEAGUE SYSTEM FUNCTIONS =====

function showLeagueTeamSelect() {
    const overlay = document.getElementById('league-team-select');
    const grid = document.getElementById('team-select-grid');
    const creditsDisplay = document.getElementById('league-credits-amount');

    // Select 8 competitors for this season
    const shuffledNames = [...ballNames].sort(() => 0.5 - Math.random());
    const seasonCompetitors = shuffledNames.slice(0, 8);

    // Initialize standings for all competitors
    const initialStandings = {};
    seasonCompetitors.forEach(name => {
        initialStandings[name] = {
            points: 0,
            wins: 0,
            losses: 0,
            kills: 0,
            damageDealt: 0,
            matchesPlayed: 0,
            lastPlacement: 0
        };
    });

    // Reset league state for new season
    leagueState = {
        active: true,
        round: 1,
        totalRounds: 10,
        trackedConfiguration: null,
        permanentBuffs: [],
        seasonCredits: 1000,
        wins: 0,
        losses: 0,
        standings: initialStandings,
        storyBeatsViewed: [],
        seasonCompetitors: seasonCompetitors
    };

    creditsDisplay.textContent = leagueState.seasonCredits;
    grid.innerHTML = '';

    // Assign random factions to season competitors for display
    const competitorsWithFactions = seasonCompetitors.map(name => {
        const factionNames = Object.keys(factions);
        const faction = factionNames[Math.floor(Math.random() * factionNames.length)];
        return { name, faction };
    });

    // Display competitors for selection
    competitorsWithFactions.forEach((team) => {
        const name = team.name;
        const card = document.createElement('div');
        card.className = 'team-card';
        card.onclick = () => selectTrackedConfiguration(name);

        const stats = hallOfFame[name] || { wins: 0 };
        const winsCount = typeof stats === 'number' ? stats : (stats.wins || 0);

        card.innerHTML = `
            <div class="faction-tag" style="color: ${factions[team.faction].color}">${team.faction}</div>
            <h3 style="color: ${factions[team.faction].color}">${name}</h3>
            <div class="stability-value">Stability Index: ${winsCount}</div>
            <div class="team-lore">${factions[team.faction].lore}</div>
        `;
        grid.appendChild(card);
    });
    mainMenuOverlay.classList.add('hidden');
    overlay.classList.remove('hidden');
    // No voiceover per spec - observation is silent
}

function selectTrackedConfiguration(name) {
    leagueState.trackedConfiguration = name;
    leagueState.active = true;
    currentGameState = STATE.NARRATIVE;

    // Switch to status view
    const selectionView = document.getElementById('league-team-select');
    const statusView = document.getElementById('league-upgrade-shop');
    selectionView.classList.add('hidden');
    statusView.classList.remove('hidden');

    const trackedNameEl = document.getElementById('shop-tracked-name');
    trackedNameEl.textContent = leagueState.trackedConfiguration;

    showLeagueUpgradeShop();
    logCommentary(`Observation focus locked on: ${name}.`);
}

function showLeagueUpgradeShop() {
    const overlay = document.getElementById('league-upgrade-shop');
    const grid = document.getElementById('upgrade-shop-grid');
    const roundNum = document.getElementById('shop-round-num');
    const credits = document.getElementById('shop-credits');
    const trackedNameEl = document.getElementById('shop-tracked-name');
    const ownedBuffs = document.getElementById('shop-owned-buffs');

    roundNum.textContent = leagueState.round;
    credits.textContent = leagueState.seasonCredits;
    trackedNameEl.textContent = leagueState.trackedConfiguration;
    ownedBuffs.textContent = leagueState.permanentBuffs.map(b => CONDITION_PARAMETERS[b]?.icon || '').join(' ');

    grid.innerHTML = '';
    const maxTier = getUnlockedBuffTier();

    Object.entries(CONDITION_PARAMETERS).forEach(([buffId, buff]) => {
        const owned = leagueState.permanentBuffs.includes(buffId);
        const locked = buff.tier > maxTier;
        const affordable = leagueState.seasonCredits >= buff.cost;

        const card = document.createElement('div');
        card.className = `upgrade-card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`;
        card.innerHTML = `
            <div class="tier-badge">TIER ${buff.tier}</div>
            <div class="icon">${buff.icon}</div>
            <div class="info">
                <div class="buff-name">${buffId.replace(/_/g, ' ')}</div>
                <div class="desc">${buff.desc}</div>
            </div>
            <div class="cost">${owned ? '✓ OWNED' : (locked ? '🔒 LOCKED' : buff.cost)}</div>
        `;

        if (!owned && !locked && affordable) {
            card.onclick = () => purchaseLeagueBuff(buffId);
        }

        grid.appendChild(card);
    });

    overlay.classList.remove('hidden');
}

function purchaseLeagueBuff(buffId) {
    const buff = CONDITION_PARAMETERS[buffId];
    if (!buff || leagueState.seasonCredits < buff.cost) {
        logCommentary("Insufficient computational budget.");
        return;
    }

    leagueState.seasonCredits -= buff.cost;
    leagueState.permanentBuffs.push(buffId);
    logCommentary(`Parameter applied: ${buffId.replace(/_/g, ' ')}.`);

    // Refresh shop display
    showLeagueUpgradeShop();
}

function closeUpgradeShopAndStart() {
    const overlay = document.getElementById('league-upgrade-shop');
    overlay.classList.add('hidden');

    gameMode = 'league';
    leagueRound = leagueState.round;

    // Check for story beat first
    const storyBeat = getLeagueStoryBeat(leagueState.round);
    if (storyBeat) {
        // Show story, then betting
        currentGameState = STATE.NARRATIVE;
        narrativeOverlay.classList.remove('hidden');
        narrativeTitle.textContent = storyBeat.title;
        narrativeText.textContent = storyBeat.text;

        // Manually attach click handler since playNarrative(null) returns early
        narrativeOverlay.onclick = () => {
            narrativeOverlay.classList.add('hidden');
            showBettingOverlay();
        };

        speak(storyBeat.voice || storyBeat.text);
    } else {
        // Fallback to generic start
        playNarrative('league-start', () => {
            showBettingOverlay();
        });
    }
}

function applyLeaguePermanentBuffs(ball) {
    if (!leagueState.active || ball.name !== leagueState.trackedConfiguration) return;

    leagueState.permanentBuffs.forEach(buffId => {
        const buff = CONDITION_PARAMETERS[buffId];
        if (buff && buff.apply) {
            buff.apply(ball);
            ball.upgrades.push(buffId);
        }
    });
}

function advanceLeagueRound(won, matchResults) {
    if (!leagueState.active) return;

    // Update standings based on match results
    if (matchResults) {
        updateLeagueStandings(matchResults);
    }

    if (won) {
        leagueState.wins++;
        leagueState.seasonCredits += 500; // Bonus for winning
    } else {
        leagueState.losses++;
    }

    // Sync bank
    bank = leagueState.seasonCredits;
    saveBank();

    leagueState.round++;

    // Check for season end (10 rounds or 3 losses)
    if (leagueState.round > leagueState.totalRounds || leagueState.losses >= 3) {
        endLeagueSeason();
    }
}

function updateLeagueStandings(matchResults) {
    if (!matchResults) return;

    // matchResults is an array of { name, placement, kills, damage } sorted by finish order
    matchResults.forEach((result) => {
        const standing = leagueState.standings[result.name];
        if (!standing) return;

        standing.matchesPlayed++;
        standing.lastPlacement = result.placement;
        standing.kills += result.kills || 0;
        standing.damageDealt += result.damage || 0;

        // Points: 1st = 3pts, 2nd = 2pts, 3rd = 1pt, rest = 0
        if (result.placement === 1) {
            standing.points += 3;
            standing.wins++;
        } else if (result.placement === 2) {
            standing.points += 2;
            standing.losses++;
        } else if (result.placement === 3) {
            standing.points += 1;
            standing.losses++;
        } else {
            standing.losses++;
        }
    });
}

function calculateLeagueRankings() {
    const rankings = Object.entries(leagueState.standings).map(([name, stats]) => ({
        name,
        ...stats
    }));

    // Sort by points (desc), then kills (desc), then damage (desc)
    rankings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.damageDealt - a.damageDealt;
    });

    return rankings;
}

// Get a progressive narrative snippet based on league progress
function getProgressiveSnippet() {
    const round = leagueState.round || 1;
    const total = leagueState.totalRounds || 10;
    const progress = round / total;

    let pool;
    if (progress <= 0.3) {
        pool = NARRATIVE_SNIPPETS.early;
    } else if (progress <= 0.7) {
        pool = NARRATIVE_SNIPPETS.mid;
    } else {
        pool = NARRATIVE_SNIPPETS.late;
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

function getLeagueStoryBeat(round) {
    return LEAGUE_STORY_BEATS.find(beat => beat.round === round);
}

function showLeagueStandingsScreen() {
    const overlay = document.getElementById('league-standings-overlay');
    const roundEl = document.getElementById('standings-round');
    const totalEl = document.getElementById('standings-total');
    const tableBody = document.getElementById('standings-table-body');
    const storyPanel = document.getElementById('league-story-panel');
    const storyTitle = document.getElementById('league-story-title');
    const storyText = document.getElementById('league-story-text');
    const seasonStatus = document.getElementById('league-season-status');

    // Update round display
    if (leagueState.active && leagueState.round > 1) {
        // Show "Status Report: Iteration X-1" for context
        document.querySelector('.standings-header h2').textContent = `STATUS REPORT: ITERATION ${leagueState.round - 1}`;
        roundEl.parentElement.innerHTML = `PREPARING ITERATION <span id="standings-round">${leagueState.round}</span> OF <span id="standings-total">${leagueState.totalRounds}</span>`;
    } else {
        document.querySelector('.standings-header h2').textContent = `STABILITY RANKINGS`;
        roundEl.textContent = leagueState.round;
        totalEl.textContent = leagueState.totalRounds;
    }

    // Check for story beat or show progressive snippet
    const storyBeat = getLeagueStoryBeat(leagueState.round);
    if (storyBeat && !leagueState.storyBeatsViewed.includes(leagueState.round)) {
        storyPanel.classList.remove('hidden');
        storyTitle.textContent = storyBeat.title;
        storyText.textContent = storyBeat.text;
        leagueState.storyBeatsViewed.push(leagueState.round);
        // No voiceover per spec
    } else {
        // Show a progressive snippet instead (no title, just observation)
        const snippet = getProgressiveSnippet();
        storyPanel.classList.remove('hidden');
        storyTitle.textContent = '';
        storyText.textContent = snippet;
    }

    // Update standings table
    const rankings = calculateLeagueRankings();
    tableBody.innerHTML = '';

    rankings.forEach((competitor, index) => {
        const rank = index + 1;
        const isTracked = competitor.name === leagueState.trackedConfiguration;

        const row = document.createElement('tr');
        row.className = isTracked ? 'tracked-cfg' : '';

        // Rank display with medals for top 3
        let rankDisplay = rank;
        if (rank <= 3) {
            rankDisplay = `<span class="rank-medal rank-${rank}">${rank}</span>`;
        }

        row.innerHTML = `
            <td>${rankDisplay}</td>
            <td>${competitor.name}${isTracked ? ' ★' : ''}</td>
            <td>${competitor.points}</td>
            <td>${competitor.wins}</td>
            <td>${competitor.losses}</td>
            <td>${competitor.kills}</td>
            <td>${Math.round(competitor.damageDealt)}</td>
        `;
        tableBody.appendChild(row);
    });

    // Season status message
    const trackedRank = rankings.findIndex(c => c.name === leagueState.trackedConfiguration) + 1;
    if (leagueState.losses >= 3) {
        seasonStatus.innerHTML = `<span style="color: #ff3300;">CYCLE TERMINATED</span> - Baseline failed after ${leagueState.round - 1} iterations`;
    } else if (leagueState.round > leagueState.totalRounds) {
        seasonStatus.innerHTML = `<span style="color: #ffd700;">STABILITY THRESHOLD REACHED</span> - Final Order: #${trackedRank}`;
    } else {
        seasonStatus.innerHTML = `Tracked Configuration: <span style="color: var(--accent-color);">#${trackedRank}</span> • Failures: ${leagueState.losses}/3`;
    }

    overlay.classList.remove('hidden');
}

function continueFromStandings() {
    const overlay = document.getElementById('league-standings-overlay');
    overlay.classList.add('hidden');

    // Sync league credits with bank (betting winnings)
    leagueState.seasonCredits = bank;

    if (leagueState.active && leagueState.round <= leagueState.totalRounds && leagueState.losses < 3) {
        showLeagueUpgradeShop();
    } else {
        // Season ended - return to main menu
        returnToHome();
        logCommentary("Iterative cycle complete. Returning to baseline state.");
    }
}

function proceedToLeagueUpgradeShop() {
    const summaryOverlay = document.getElementById('summary-overlay');
    summaryOverlay.classList.add('hidden');

    // Show standings screen instead of going directly to shop
    showLeagueStandingsScreen();
}

function endLeagueSeason() {
    leagueState.active = false;
    const rankings = calculateLeagueRankings();
    const trackedRank = rankings.findIndex(c => c.name === leagueState.trackedConfiguration) + 1;

    // If tracked pattern won (is rank 1), trigger Big Bang
    if (trackedRank === 1) {
        // Find the winning ball's stats for universe definition
        const winner = balls.find(b => b.name === leagueState.trackedConfiguration) || {};
        showBigBangSequence(winner);
    }

    // Increment completed league count for meta-lore
    completedLeagueCount++;
    localStorage.setItem('arena_completedLeagues', completedLeagueCount);

    // If tracked pattern won (is rank 1), trigger Book of Remnant unlock
    if (trackedRank === 1) {
        const winner = balls.find(b => b.name === leagueState.trackedConfiguration) || {};
        const universeDef = generateUniverseDefinition(winner);

        const remnant = {
            name: leagueState.trackedConfiguration,
            timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
            definitions: universeDef
        };

        // Add if not already present (prevent duplicates of same name/round)
        if (!remnants.some(r => r.name === remnant.name && r.timestamp.split(' ')[0] === remnant.timestamp.split(' ')[0])) {
            remnants.push(remnant);
            localStorage.setItem('arena_remnants', JSON.stringify(remnants));
        }

        bookUnlocked = true;
        localStorage.setItem('arena_bookUnlocked', 'true');

        updateBookUnlockState();
    }
}

function showBigBangSequence(winner) {
    const overlay = document.getElementById('bigbang-overlay');
    const flash = document.getElementById('bigbang-flash');
    const creationTextEl = document.getElementById('creation-text');
    const universeDefEl = document.getElementById('universe-definition');
    const metaLoreEl = document.getElementById('meta-lore');
    const continueBtn = document.getElementById('bigbang-continue');

    // Reset state
    creationTextEl.innerHTML = '';
    universeDefEl.innerHTML = '';
    universeDefEl.classList.add('hidden');
    metaLoreEl.classList.add('hidden');
    continueBtn.classList.add('hidden');

    overlay.classList.remove('hidden');

    // Stop all audio
    stopOST();
    if (synth) synth.cancel();

    // Phase 1: Creation text (fade in sequentially)
    let delay = 500;
    CREATION_EVENT_TEXT.forEach((text, index) => {
        setTimeout(() => {
            const p = document.createElement('p');
            p.textContent = text;
            p.style.animationDelay = `${index * 0.5}s`;
            creationTextEl.appendChild(p);
        }, delay + index * 1500);
    });

    // Phase 2: Flash (Big Bang)
    setTimeout(() => {
        flash.classList.add('active');

        // Phase 3: Universe definition
        setTimeout(() => {
            flash.classList.remove('active');
            const universeDefArray = generateUniverseDefinition(winner);
            const universeDefHtml = universeDefArray.map(d => `<p>${d}</p>`).join('');
            universeDefEl.innerHTML = `<h3>THIS UNIVERSE</h3>${universeDefHtml}`;
            universeDefEl.classList.remove('hidden');

            // Phase 4: Meta-lore (if multiple leagues completed)
            if (completedLeagueCount >= 2) {
                setTimeout(() => {
                    const metaText = META_LORE[Math.min(completedLeagueCount - 2, META_LORE.length - 1)];
                    metaLoreEl.textContent = metaText;
                    metaLoreEl.classList.remove('hidden');
                }, 2000);
            }

            // Show continue button
            setTimeout(() => {
                // Final heavy line
                const finalP = document.createElement('p');
                finalP.innerHTML = `<br><span style="color: #bc00ff; font-weight: bold;">This is not the best universe.<br>It is the only one that could exist.</span>`;
                finalP.style.marginTop = "20px";
                finalP.style.fontSize = "1.2rem";
                metaLoreEl.parentElement.insertBefore(finalP, continueBtn);

                continueBtn.classList.remove('hidden');
            }, 5000);

        }, 2500);
    }, CREATION_EVENT_TEXT.length * 1500 + 1000);
}

function generateUniverseDefinition(winner) {
    const definitions = [];

    // Analyze winner stats to generate universe definition
    if (winner) {
        const mass = winner.mass || 20;
        const vel = Math.sqrt((winner.vx || 0) ** 2 + (winner.vy || 0) ** 2);
        const collisions = winner.matchCollisions || 0;
        const efficiency = winner.energy ? (winner.energy / (winner.maxEnergy || 1000)) : 0.5;

        // High mass
        if (mass > 25) {
            definitions.push(UNIVERSE_DEFINITIONS.highMass);
        }

        // High velocity
        if (vel > 5) {
            definitions.push(UNIVERSE_DEFINITIONS.highVelocity);
            definitions.push(UNIVERSE_DEFINITIONS.rapidExpansion);
        }

        // High collisions
        if (collisions > 20) {
            definitions.push(UNIVERSE_DEFINITIONS.highCollisions);
            definitions.push(UNIVERSE_DEFINITIONS.aggressiveMatter);
        }

        // High efficiency (survived with more energy)
        if (efficiency > 0.7) {
            definitions.push(UNIVERSE_DEFINITIONS.highEfficiency);
            definitions.push(UNIVERSE_DEFINITIONS.unevenTime);
        }
    }

    // TIER 4: Generic fallbacks
    if (definitions.length === 0) {
        definitions.push(UNIVERSE_DEFINITIONS.briefStars);
    }

    // Take unique definitions (max 4)
    const uniqueDefs = [...new Set(definitions)].slice(0, 4);
    return uniqueDefs;
}

function showBookOfRemnant() {
    const overlay = document.getElementById('book-remnant-overlay');
    const list = document.getElementById('remnant-list');

    if (!overlay || !list) return;

    list.innerHTML = '';

    if (remnants.length === 0) {
        list.innerHTML = '<p style="text-align: center; opacity: 0.5; margin-top: 50px;">The archive is currently empty. No stable configurations have been recorded.</p>';
    } else {
        // Reverse so newest is first
        [...remnants].reverse().forEach(remnant => {
            const entry = document.createElement('div');
            entry.className = 'archival-entry';

            const defHtml = remnant.definitions.map(d => `<span>• ${d}</span>`).join('<br>');

            entry.innerHTML = `
                <div class="timestamp">STABILIZATION LOG: ${remnant.timestamp}</div>
                <h3>${remnant.name}</h3>
                <div class="definition-list">
                    ${defHtml}
                </div>
            `;
            list.appendChild(entry);
        });
    }

    mainMenuOverlay.classList.add('hidden');
    overlay.classList.remove('hidden');
}

function closeBookOfRemnant() {
    const overlay = document.getElementById('book-remnant-overlay');
    overlay.classList.add('hidden');
    mainMenuOverlay.classList.remove('hidden');
}

function updateBookUnlockState() {
    const btn = document.getElementById('book-remnant-btn');
    if (btn && bookUnlocked) {
        btn.classList.remove('hidden');
    }
}

// Initial check for book unlock
window.addEventListener('DOMContentLoaded', () => {
    updateBookUnlockState();
});

function closeBigBangAndReturn() {
    const overlay = document.getElementById('bigbang-overlay');
    overlay.classList.add('hidden');

    // Return to attract screen
    returnToHome();
}

// Expose league functions globally
window.showLeagueTeamSelect = showLeagueTeamSelect;
window.selectTrackedConfiguration = selectTrackedConfiguration;
window.showLeagueUpgradeShop = showLeagueUpgradeShop;
window.closeUpgradeShopAndStart = closeUpgradeShopAndStart;
window.continueFromStandings = continueFromStandings;
window.toggleNarratorSetting = toggleNarratorSetting;
window.toggleMusicSetting = toggleMusicSetting;
window.toggleSFXSetting = toggleSFXSetting;
window.toggleShakeSetting = toggleShakeSetting;

// --- Gamepad / Quest Controller Support ---
// Adds a simple virtual cursor controlled by gamepad axes and maps the primary
// button to mouse/pointer events so the Quest browser's controller can interact
// with the game's UI and canvas.
(() => {
    let gpIndex = null;
    let lastPrimary = false;
    const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const el = document.createElement('div');
    el.id = 'gp-cursor';
    el.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:16px;background:rgba(255,255,255,0.9);border-radius:50%;box-shadow:0 0 12px rgba(0,200,255,0.9);transform:translate(-50%,-50%);pointer-events:none;z-index:99999;display:none;';
    document.body.appendChild(el);

    window.addEventListener('gamepadconnected', (e) => {
        gpIndex = e.gamepad.index;
        el.style.display = 'block';
        console.log('[Gamepad] connected', e.gamepad.id, 'index', gpIndex);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
        if (gpIndex === e.gamepad.index) gpIndex = null;
        el.style.display = 'none';
        console.log('[Gamepad] disconnected', e.gamepad.id);
    });

    function simulateMouse(type, x, y) {
        const target = document.elementFromPoint(x, y);
        if (!target) return;
        const ev = new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: Math.round(x),
            clientY: Math.round(y)
        });
        target.dispatchEvent(ev);
    }

    function poll() {
        const gps = navigator.getGamepads && navigator.getGamepads();
        const gp = (gpIndex !== null && gps && gps[gpIndex]) ? gps[gpIndex] : (gps && gps[0]);
        if (gp) {
            // Typical mapping: axes[0]/[1] = left stick
            const lx = gp.axes[0] || 0;
            const ly = gp.axes[1] || 0;
            const sensitivity = Math.max(window.innerWidth, window.innerHeight) * 0.02; // screen scaled speed
            cursor.x = Math.min(window.innerWidth, Math.max(0, cursor.x + lx * sensitivity));
            cursor.y = Math.min(window.innerHeight, Math.max(0, cursor.y + ly * sensitivity));
            el.style.left = cursor.x + 'px';
            el.style.top = cursor.y + 'px';

            // Primary button (A) usually index 0; treat pressed->mousedown, release->mouseup+click
            const primary = !!(gp.buttons && gp.buttons[0] && gp.buttons[0].pressed);
            if (primary && !lastPrimary) {
                simulateMouse('pointerdown', cursor.x, cursor.y);
                simulateMouse('mousedown', cursor.x, cursor.y);
            } else if (!primary && lastPrimary) {
                simulateMouse('pointerup', cursor.x, cursor.y);
                simulateMouse('mouseup', cursor.x, cursor.y);
                simulateMouse('click', cursor.x, cursor.y);
            }
            lastPrimary = primary;
        }
        requestAnimationFrame(poll);
    }

    // Start polling loop (will be inert until a gamepad appears)
    requestAnimationFrame(poll);
})();
window.toggleSlowMoSetting = toggleSlowMoSetting;
window.closeSettings = closeSettings;
window.initMode = initMode;
window.toggleOptions = toggleOptions;
window.resetAllProgress = resetAllProgress;
window.closeBigBangAndReturn = closeBigBangAndReturn;
window.showBookOfRemnant = showBookOfRemnant;
window.closeBookOfRemnant = closeBookOfRemnant;
window.proceedToLeagueUpgradeShop = proceedToLeagueUpgradeShop;
window.quitMatch = quitMatch;
window.returnToHome = returnToHome;
window.triggerHack = triggerHack;
window.spawnSandboxHazard = spawnSandboxHazard;
window.spawnSandboxBall = spawnSandboxBall;
window.toggleSandboxSlowMo = toggleSandboxSlowMo;
window.clearSandboxArena = clearSandboxArena;

function playNarrative(key, onComplete) {
    const beat = storyBeats[key];
    if (!beat) return onComplete ? onComplete() : null;

    currentGameState = STATE.NARRATIVE;
    narrativeOverlay.classList.remove('hidden');
    narrativeTitle.textContent = beat.title;

    // Typewriter effect simulation
    narrativeText.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
        narrativeText.textContent += beat.text[i];
        i++;
        if (i >= beat.text.length) {
            clearInterval(interval);
        }
    }, 30);

    speak(beat.voice || beat.text);

    narrativeOverlay.onclick = () => {
        narrativeOverlay.classList.add('hidden');
        if (onComplete) onComplete();
    };
}

function toggleMenu() {
    currentGameState = STATE.MENU;
    mainMenuOverlay.classList.remove('hidden');
    bettingOverlay.classList.add('hidden');
    summaryOverlay.classList.add('hidden');
    attractOverlay.classList.add('hidden');
}

// Attract screen trigger
attractOverlay.onclick = () => {
    toggleMenu();
};

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
        if (h instanceof EntropyNode && h.alive) {
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

    // Find Dominant Pattern (Stability Index)
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

    // Find High Cohesion (Alive)
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
                <small style="font-size: 9px; opacity: 0.5;">${Math.ceil(isFinite(ball.energy) ? ball.energy : 0)} INTEGRITY</small>
            </div>
        `;
        statsContainer.appendChild(statItem);
    });

    if (gameActive) {
        // In Attract Mode, respawn balls when too few remain instead of ending
        if (currentGameState === STATE.ATTRACT) {
            if (aliveCount <= 2) {
                // Respawn some balls to keep the demo going
                const respawnCount = 3;
                for (let i = 0; i < respawnCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const x = centerX + Math.cos(angle) * (baseArenaRadius * 0.4);
                    const y = centerY + Math.sin(angle) * (baseArenaRadius * 0.4);
                    const names = ballNames;
                    const newBall = new Ball(balls.length, names[Math.floor(Math.random() * names.length)] + '-' + balls.length, x, y, ['AGILE', 'BALANCED', 'HEAVY'][Math.floor(Math.random() * 3)], Object.keys(factions)[Math.floor(Math.random() * Object.keys(factions).length)]);
                    balls.push(newBall);
                }
            }
            return; // Don't end the game during attract mode
        }

        // In Sandbox Mode, never trigger game-over
        if (gameMode === 'sandbox') {
            return; // Sandbox is freeform, no win/loss conditions
        }

        if (aliveCount === 1) {
            gameActive = false;
            const winner = balls.find(b => b.alive);
            if (winner) {
                matchRankings.push(winner.name);
                saveWin(winner.name);
                processBetResults(winner.name);
                showCelebration(winner);

                // League Progression - track if tracked configuration survived
                if (gameMode === 'league' && leagueState.active) {
                    const trackedSurvived = winner.name === leagueState.trackedConfiguration;

                    // Generate results
                    const results = [];
                    // Winner is first
                    results.push({
                        name: winner.name,
                        placement: 1,
                        kills: (hallOfFame[winner.name]?.kills || 0), // Note: this is total career kills, ideal would be match kills
                        damage: winner.matchDamageDealt || 0
                    });

                    // Add eliminated in reverse order (last eliminated is 2nd)
                    [...matchRankings].reverse().forEach((name, i) => {
                        results.push({
                            name: name,
                            placement: i + 2,
                            kills: (hallOfFame[name]?.kills || 0),
                            damage: 0 // We don't track dead ball damage easily retrospectively here without looking up the ball obj
                        });
                    });

                    advanceLeagueRound(trackedSurvived, results);
                }
            }
            drawHeatmap();
        } else if (aliveCount === 0) {
            gameActive = false;
            gameStatus.textContent = "Everyone Perished!";
            logCommentary("Total structural failure. All units eliminated.");
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
            // Keep centered on arena during match
            targetCameraX = centerX;
            targetCameraY = centerY;
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
            logCommentary("Anomalous unit [GOLDEN-ONE] persistence confirmed. Payouts scaled x10.");
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
        logCommentary(`Distribution successful: ${totalPayout.toFixed(0)} units allocated to observer.`);
    } else if (userBets.length > 0) {
        logCommentary("Projection mismatch. Wagers sequestered.");
    }
    logCommentary(`MATCH P/L: ${lastMatchBettingResult.toFixed(0)} credits.`);
}

function showCelebration(winner) {
    winnerNameEl.textContent = `TERMINAL STATE: ${winner.name}`;
    winnerNameEl.style.color = winner.color;
    celebrationOverlay.style.borderColor = winner.color;
    celebrationOverlay.style.boxShadow = `0 0 50px ${winner.color}`;

    for (let i = 0; i < 150; i++) {
        particles.push(new Particle(winner.x, winner.y, winner.color));
    }

    logCommentary(`Stability achieved: Unit ${winner.name} persists. Pattern: ${winner.type}.`);

    // PHASE 1: Zoom into winner (camera pan)
    targetCameraScale = 5.0; // Deep zoom
    targetCameraX = winner.x;
    targetCameraY = winner.y;
    slowMo = 0.3; // Slow-mo dramatic effect

    // PHASE 2: After 2 seconds, show internal view
    setTimeout(() => {
        showInternalView(winner);
    }, 2000);
}

// Internal structure animation
function showInternalView(winner) {
    const overlay = document.getElementById('internal-view-overlay');
    const canvas = document.getElementById('internal-view-canvas');
    const ictx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    overlay.style.display = 'flex';

    let t = 0;
    const duration = 180; // ~3 seconds at 60fps

    // Generate unique internal structure based on ball properties
    const seed = winner.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const nodeCount = 8 + (seed % 8);
    const ringCount = 3 + (seed % 4);
    const coreColor = winner.color;
    const accentColor = winner.fColor || '#00f2ff';

    const internalLoop = () => {
        t++;
        ictx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ictx.fillRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Draw pulsing core
        const coreSize = 50 + Math.sin(t * 0.05) * 10;
        const gradient = ictx.createRadialGradient(cx, cy, 0, cx, cy, coreSize + 50);
        gradient.addColorStop(0, coreColor);
        gradient.addColorStop(0.5, accentColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ictx.beginPath();
        ictx.arc(cx, cy, coreSize, 0, Math.PI * 2);
        ictx.fillStyle = gradient;
        ictx.fill();

        // Draw spinning rings
        for (let r = 0; r < ringCount; r++) {
            const radius = 100 + r * 60;
            const rotation = t * 0.02 * (r % 2 === 0 ? 1 : -1);

            ictx.save();
            ictx.translate(cx, cy);
            ictx.rotate(rotation);

            ictx.strokeStyle = `rgba(${r * 50}, ${255 - r * 30}, 255, ${0.3 + Math.sin(t * 0.1 + r) * 0.2})`;
            ictx.lineWidth = 2;
            ictx.beginPath();
            ictx.arc(0, 0, radius, 0, Math.PI * 2);
            ictx.stroke();

            // Draw nodes on rings
            for (let n = 0; n < nodeCount; n++) {
                const angle = (n / nodeCount) * Math.PI * 2;
                const nx = Math.cos(angle) * radius;
                const ny = Math.sin(angle) * radius;
                const nodeSize = 4 + Math.sin(t * 0.1 + n + r) * 2;

                ictx.beginPath();
                ictx.arc(nx, ny, nodeSize, 0, Math.PI * 2);
                ictx.fillStyle = accentColor;
                ictx.fill();
            }

            ictx.restore();
        }

        // Draw energy arcs (lightning)
        if (t % 5 === 0) {
            for (let i = 0; i < 3; i++) {
                const a1 = Math.random() * Math.PI * 2;
                const a2 = a1 + (Math.random() - 0.5);
                const r1 = 50 + Math.random() * 100;
                const r2 = 100 + Math.random() * 150;

                ictx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.random() * 0.5})`;
                ictx.lineWidth = 1;
                ictx.beginPath();
                ictx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);

                // Jagged line
                for (let j = 0; j < 4; j++) {
                    const midA = a1 + (a2 - a1) * (j / 4) + (Math.random() - 0.5) * 0.2;
                    const midR = r1 + (r2 - r1) * (j / 4) + (Math.random() - 0.5) * 20;
                    ictx.lineTo(cx + Math.cos(midA) * midR, cy + Math.sin(midA) * midR);
                }
                ictx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
                ictx.stroke();
            }
        }

        // Draw configuration name
        ictx.fillStyle = '#fff';
        ictx.font = 'bold 24px Outfit';
        ictx.textAlign = 'center';
        ictx.fillText(winner.name, cx, cy + 250);
        ictx.font = '14px Outfit';
        ictx.fillStyle = 'rgba(255,255,255,0.5)';
        ictx.fillText('INTERNAL CONFIGURATION', cx, cy + 280);

        if (t < duration) {
            requestAnimationFrame(internalLoop);
        } else {
            // Fade out internal view, show celebration overlay
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 1s';

            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
                overlay.style.transition = '';

                // Now show celebration overlay with button
                celebrationOverlay.classList.remove('hidden');
                slowMo = 1.0;

                // Reset camera
                targetCameraScale = 1.0;
                targetCameraX = centerX;
                targetCameraY = centerY;

                // Add Continue Button
                let btn = document.getElementById('celebration-continue-btn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = 'celebration-continue-btn';
                    btn.textContent = 'CONTINUE OBSERVATION';
                    btn.className = 'restart-btn btn-primary';
                    btn.style.marginTop = '20px';
                    btn.onclick = () => {
                        showSummaryScreen();
                    };
                    celebrationOverlay.appendChild(btn);
                }
                btn.style.display = 'block';
                btn.style.opacity = '0';
                btn.style.transition = 'opacity 1s';
                setTimeout(() => { btn.style.opacity = '1'; }, 100);
            }, 1000);
        }
    };

    internalLoop();
}

function triggerImplosion() {
    gameActive = false;
    // Kill everyone
    balls.forEach(b => {
        if (b.alive) {
            b.alive = false;
            createDust(b.x, b.y, b.color);
        }
    });

    // Massive shake and sound
    screenShake = 100;
    playSound(40, 'sawtooth', 2.0, 1.0);

    // Visuals
    const shock = new Shockwave(centerX, centerY);
    shock.maxRadius = arenaRadius * 3;
    shock.strength = 100;
    shock.radius = 0;
    shockwaves.push(shock);

    logCommentary("TIMEFRAME EXCEEDED. TOTAL REALITY COLLAPSE.");
    gameStatus.textContent = "IMPLOSION EVENT";

    setTimeout(() => {
        // Just show summary after total death
        showSummaryScreen();
    }, 3000);
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
        if (currentGameState === STATE.ATTRACT) {
            slowMo = 0.2; // Constant cinematic slow-mo for attract mode
        }
        gameTime += dt * slowMo;

        // Implosion Check
        if (gameTime >= gameDuration) {
            triggerImplosion();
            return;
        }

        const shrinkFactor = Math.max(0.3, 1 - (gameTime / gameDuration));
        arenaRadius = baseArenaRadius * shrinkFactor;

        // Tier 4: Escalating Hazards - Only spawn randoms in Non-League or if < 15
        if (gameMode !== 'league' && timestamp - lastHazardSpawn > 15000 && hazards.length < 15) {
            const r = Math.random();
            if (r > 0.8) hazards.push(new EntropyNode(centerX, centerY));
            else if (r > 0.5) hazards.push(new GravitationalAnchor(Math.random() * Math.PI * 2, baseArenaRadius * 0.9));
            else if (r > 0.3) hazards.push(new VoidGap(Math.random() * Math.PI * 2, 0.4));
            else hazards.push(new Hazard(Math.random() * Math.PI * 2, baseArenaRadius * (0.3 + Math.random() * 0.4), 30));

            lastHazardSpawn = timestamp;
            logCommentary("Entropy source localized. Anomaly detected.");
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
    cameraX += (targetCameraX - cameraX) * 0.05;
    cameraY += (targetCameraY - cameraY) * 0.05;

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
    // New Panning Camera Transform
    // Maps (cameraX, cameraY) to (centerX, centerY) on screen
    ctx.translate(centerX + shakeX, centerY + shakeY);
    ctx.scale(cameraScale, cameraScale);
    ctx.translate(-cameraX, -cameraY);

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
                        logCommentary("Stagnation detected. Baseline purge sequence initialized.");
                    }

                    if (secondsLeft !== lastCountdownSecond) {
                        lastCountdownSecond = secondsLeft;
                        if (secondsLeft > 0) logCommentary(`Purge T-minus: ${secondsLeft}`);
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
    hazards.forEach(h => {
        // [New] Mutator: EMP Storm
        if (activeMutator && activeMutator.name === 'EMP STORM' && Math.sin(gameTime / 1000) > 0.5) {
            // Hazards disabled visually and logically
            h.disabled = true;
        } else {
            h.disabled = false;
            h.update(slowMo);
        }
    });
    hazards.filter(h => !h.disabled).forEach(h => h.draw());

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

        // Toggle league proceed button visibility
        const leagueProceedBtn = document.getElementById('leagueProceedBtn');
        const nextMatchBtn = document.getElementById('nextMatchBtn');
        if (gameMode === 'league' && leagueState.active) {
            if (leagueProceedBtn) leagueProceedBtn.classList.remove('hidden');
            if (nextMatchBtn) nextMatchBtn.classList.add('hidden');
        } else {
            if (leagueProceedBtn) leagueProceedBtn.classList.add('hidden');
            if (nextMatchBtn) nextMatchBtn.classList.remove('hidden');
        }

        const summaryBettingResult = document.getElementById('summary-betting-result');
        if (userBets.length > 0) {
            let bettingHtml = `<div style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">ALLOCATION LOGS</div>`;
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
                <div style="margin-top: 10px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-weight: bold;">
                    <span>TOTAL P/L:</span>
                    <span style="color: ${totalColor};">${lastMatchBettingResult >= 0 ? '+' : ''}${lastMatchBettingResult.toFixed(0)}</span>
                </div>
            `;
            summaryBettingResult.innerHTML = bettingHtml;
        } else {
            summaryBettingResult.innerHTML = 'No allocations recorded for this iteration.';
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
            let winsText = `${ball.wins} Peaks`;
            if (ball.name === "GOLDEN-ONE") {
                if (top2.includes("GOLDEN-ONE")) {
                    winsText = "<span style='color: #ffd700;'>STABILIZED</span>";
                } else {
                    winsText = "<span style='opacity: 0.5;'>COLLAPSED</span>";
                }
            }
            item.innerHTML = `
                <span class="summary-item-name">${ball.name}</span>
                <span class="summary-item-wins">${winsText}</span>
            `;
            summaryList.appendChild(item);
        });

        // TIER 5: Match Performance
        const perfContainer = document.getElementById('summary-performance-container');
        perfContainer.innerHTML = '<h3 style="color: var(--accent-color); margin-bottom: 15px; text-align: center;">STABILITY ANALYSIS</h3>';

        const sortedByDamage = [...balls].sort((a, b) => b.matchDamageDealt - a.matchDamageDealt);
        const sortedByKE = [...balls].sort((a, b) => b.matchMaxKineticEnergy - a.matchMaxKineticEnergy);

        const topDamage = sortedByDamage[0];
        const topKE = sortedByKE[0];

        perfContainer.innerHTML += `
            <div class="summary-item" style="border-color: #ff3300;">
                <span class="summary-item-name" style="color: #ff3300;">Peak Entropy: <strong>${topDamage.name}</strong></span>
                <span class="summary-item-wins">${Math.ceil(topDamage.matchDamageDealt)} DMG</span>
            </div>
            <div class="summary-item" style="border-color: #00f2ff;">
                <span class="summary-item-name" style="color: #00f2ff;">Peak Interaction: <strong>${topKE.name}</strong></span>
                <span class="summary-item-wins">${Math.ceil(topKE.matchMaxKineticEnergy)} KE</span>
            </div>
        `;

        // League Mode: Build match results and advance round
        if (gameMode === 'league' && leagueState.active) {
            // Build placements from matchRankings (elimination order, first eliminated = last place)
            const winner = matchRankings[matchRankings.length - 1];
            const placements = [];

            // Winner is first place
            matchRankings.slice().reverse().forEach((name, index) => {
                const ball = balls.find(b => b.name === name) || {};
                placements.push({
                    name: name,
                    placement: index + 1,
                    kills: ball.matchKills || 0,
                    damage: ball.matchDamageDealt || 0
                });
            });

            // Add any competitors who survived but weren't in the match (shouldn't happen, but safety)
            const inMatch = placements.map(p => p.name);
            (leagueState.seasonCompetitors || []).forEach(name => {
                if (!inMatch.includes(name)) {
                    placements.push({
                        name: name,
                        placement: placements.length + 1,
                        kills: 0,
                        damage: 0
                    });
                }
            });

            const matchResults = placements; // pass the array directly
            const trackedSurvived = winner === leagueState.trackedConfiguration;

            advanceLeagueRound(trackedSurvived, matchResults);

            if (trackedSurvived) {
                logCommentary("Goal achieved: Primary configuration maintains coherence.");
            }
        }

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

resetDataBtn.onclick = resetAllProgress;

// Volume Setters for UI
window.setMusicVolume = function (val) {
    musicVolume = parseFloat(val);
    localStorage.setItem('ballArena_musicVol', musicVolume);
    // Real-time update if music is playing
    const aliveCount = balls ? balls.filter(b => b.alive).length : 6;
    if (musicActive) updateMusic(aliveCount);
};

window.setSFXVolume = function (val) {
    sfxVolume = parseFloat(val);
    localStorage.setItem('ballArena_sfxVol', sfxVolume);
    // Play a test click
    playSound(400, 'sine', 0.1, 0.2);
};

window.setNarrationVolume = function (val) {
    narrationVolume = parseFloat(val);
    localStorage.setItem('ballArena_narrationVol', narrationVolume);
};

function openSettings() {
    const settings = document.getElementById('settings-overlay');
    settings.classList.remove('hidden');

    // Initialize slider values
    const mVol = document.getElementById('settings-music-vol');
    if (mVol) mVol.value = musicVolume;

    const sVol = document.getElementById('settings-sfx-vol');
    if (sVol) sVol.value = sfxVolume;

    const nVol = document.getElementById('settings-narr-vol');
    if (nVol) nVol.value = narrationVolume;
}
// Attach to global scope for HTML onclick
window.openSettings = openSettings;

function closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
}
window.closeSettings = closeSettings;


resize();
// Start in Attract mode with cinematic battle
currentGameState = STATE.ATTRACT;
slowMo = 0.35; // Cinematic slow-motion
currentCompetitors = ballNames.slice(0, 8); // More balls for attract demo
init();
gameActive = true;
updateNavButtons(); // Initialize navigation button visibility
requestAnimationFrame(loop);
