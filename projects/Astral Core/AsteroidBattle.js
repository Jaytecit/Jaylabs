
// --- Game Configuration: APEX LEGENDS EDITION ---
const config = {
  player: {
    size: 16,
    maxSpeed: 5,
    maxForce: 0.4,
    carrierSlowdown: 0.85,
    blinkDashForce: 30,
    dashCooldown: 100,
    dashDuration: 8,
    phaseBreachForce: 15,
    phaseBreachRadius: 70,
    phaseShiftCooldown: 150,
    phaseShiftDuration: 10,
    drag: 0.97,
    stunDuration: 120,
    arrivalRadius: 100,
    avoidanceForce: 1.5,
    avoidanceLookahead: 3,
    powerUpSearchRadius: 500,
    ultimateChargeRate: 0.5,
    ultimateTackleBonus: 25,
    rallyBoost: 1.5,
    maxEnergy: 100,
    energyRegenRate: 0.5,
    dashEnergyCost: 20,
    phaseEnergyCost: 30,
    exhaustionDuration: 120,
    lowEnergyThreshold: 35,
  },
  core: {
    size: 20,
    drag: 0.995,
    maxCharge: 240,
    explosionRadius: 120,
  },
  asteroid: {
    count: 4,
    minSize: 45,
    maxSize: 90,
    maxSpeed: 0.6,
    minSizeForBreakup: 40,
    impactForce: 1.5
  },
  mine: {
    count: 6,
    size: 12,
    vel: 0.4,
    triggerRadius: 40,
    explosionRadius: 180,
    shockwaveForce: 30,
    playerStunDuration: 200,
    asteroidDestroySize: 45,
    respawnDelay: 240
  },
  meteor: {
      interval: 800,
      count: 5,
      warningTime: 120,
      impactRadius: 60,
      stunDuration: 180,
      energyDamage: 40,
  },
  powerUp: {
    spawnInterval: 400,
    maxOnScreen: 3,
    lifespan: 500,
    duration: 240,
    overdriveSpeedBoost: 2.1,
    overdriveEnergyRegen: 0.6
  },
  tractorField: {
    duration: 240,
    radius: 220,
    pullForce: 0.9,
  },
  goalSize: 100,
  pulsar: {
    period: 380,
    duration: 100,
    maxRadius: 700,
    force: 1.0
  },
  pointsToWin: 3,
  screenShake: 0
};

// --- Global Variables & Definitions ---
let teams = [], core, pulsars = [], asteroids = [], particles = [], powerUps = [], mines = [];
let activeUltimates = [], activeMeteors = [];
let powerUpSpawnTimer = 0, score = {}, lastScorer = null, matchWinner = null;
let gameState = 'PROLOGUE';
let countdownTimer = 0, meteorShowerTimer = 0;
let countdownStarted = false;
let championship = {};
let userPlayer = null, userTeamName = null;
let resetGracePeriod = 0, forceResetApplied = false;
let starLayers = [];
let teamMomentum = {};
let hypeFlash = 0;
let keyboardHintTimer = 0;
let prologueScroll = 0;
let mineRespawnTimers = [];
let lastMusicMood = null;
let playerName = 'RUNNER';
let nameInput = null;

// Gamepad and Menu Control
let gamepadConnected = false;
let connectedGamepadIndex = -1;
let selectedMenuIndex = 0;
let lastGamepadState = {};
let inputCooldown = 0;

function sfx(type, opts = {}) {
  try {
    if (typeof playSFX === 'function') playSFX(type, opts);
  } catch (e) {
    /* ignore audio errors */
  }
}

function setMusicMoodSafe(mood) {
  try {
    if (typeof setMusicMood === 'function') setMusicMood(mood);
  } catch (e) {
    /* ignore audio errors */
  }
}


const ALL_TEAMS = [
    { name: 'Nebula Reds', color: [0, 80, 100] },
    { name: 'Cygnus Cyans', color: [180, 80, 100] },
    { name: 'Orion Greens', color: [120, 80, 100] },
    { name: 'Solar Yellows', color: [60, 90, 100] },
    { name: 'Crimson Comets', color: [350, 70, 100] },
    { name: 'Azure Asteroids', color: [210, 70, 100] },
    { name: 'Viridian Void', color: [150, 70, 100] },
    { name: 'Golden Galaxy', color: [50, 80, 100] },
    { name: 'Magenta Meteors', color: [310, 70, 100] },
    { name: 'Titanium Teal', color: [170, 60, 90] },
    { name: 'Emerald Enigma', color: [90, 70, 100] },
    { name: 'Amber Abyss', color: [35, 80, 100] }
];
const GOAL_POSITIONS = ['TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_RIGHT', 'BOTTOM_LEFT'];

const powerUpTypes = {
  JUGGERNAUT: { color: [120, 90, 100], symbol: 'JG' },
  CORRUPTION: { color: [30, 90, 100], symbol: 'CX' },
  MAGNET: { color: [270, 90, 100], symbol: 'MG' },
  OVERDRIVE: { color: [200, 90, 100], symbol: 'OD' }
};

function getInitials(name) {
    return name.split(' ').map(word => word[0]).join('');
}

function initStarfield() {
  const counts = [70, 45, 28];
  starLayers = counts.map((count, layer) => {
    const layerStars = [];
    for (let i = 0; i < count; i++) {
      layerStars.push({
        pos: createVector(random(width), random(height)),
        speed: 0.15 + layer * 0.25,
        size: random(1, 2 + layer * 0.8),
        hue: random(180, 320),
        twinkle: random(0.3, 1)
      });
    }
    return layerStars;
  });
}

function drawCosmicBackdrop() {
  if (!starLayers.length) initStarfield();
  const t = frameCount * 0.002;
  background(230, 20, 12);
  noStroke();
  for (let i = 0; i < 3; i++) {
    fill((220 + i * 25 + frameCount * 0.3) % 360, 40, 25, 18);
    ellipse(width * 0.5 + sin(t + i) * 120, height * 0.5 + cos(t * 1.2 + i) * 90, width * 1.2, height * 0.9);
  }
  starLayers.forEach((layer, idx) => {
    const drift = (idx + 1) * 0.15;
    layer.forEach(star => {
      star.pos.x = (star.pos.x + drift + width) % width;
      star.pos.y = (star.pos.y + sin(t + star.pos.x * 0.001 + idx) * 0.2 + height) % height;
      const alpha = 60 + sin(frameCount * 0.07 + star.pos.x * 0.02) * 40 * star.twinkle;
      fill(star.hue, 30 + idx * 20, 100, alpha);
      ellipse(star.pos.x, star.pos.y, star.size);
    });
  });
  fill(0, 0, 0, 25);
  rect(0, 0, width, height);
  if (hypeFlash > 0) {
    fill(50, 90, 100, hypeFlash);
    rect(0, 0, width, height);
  }
  hypeFlash *= 0.9;
}

function updateMomentum() {
  Object.keys(teamMomentum || {}).forEach(team => {
    const m = teamMomentum[team];
    if (!m) return;
    if (m.timer > 0) m.timer--;
    else if (m.level > 0) {
      m.level--;
      m.timer = 720;
    }
  });
}

function applyMomentumBoost(teamName) {
  if (!teamName) return;
  if (!teamMomentum[teamName]) teamMomentum[teamName] = { level: 0, timer: 0 };
  const m = teamMomentum[teamName];
  m.level = min(3, (m.level || 0) + 1);
  m.timer = 1200;
  hypeFlash = 70;
}

function getMomentumBoost(teamName) {
  const m = teamMomentum[teamName];
  return m ? 1 + (m.level || 0) * 0.08 : 1;
}

function syncMusicWithGameState() {
  let mood = 'menu';
  if (gameState === 'PLAYING' || gameState === 'RESETTING') mood = 'gameplay';
  if (lastMusicMood !== mood) {
    lastMusicMood = mood;
    setMusicMoodSafe(mood);
  }
}

function syncNameInputVisibility() {
  if (gameState === 'PLAYER_SETUP') {
    if (!nameInput) {
      nameInput = createInput(playerName || 'Runner');
      nameInput.size(260);
      nameInput.attribute('maxlength', 18);
      nameInput.style('padding', '12px 14px');
      nameInput.style('border-radius', '10px');
      nameInput.style('border', '1px solid rgba(255,255,255,0.35)');
      nameInput.style('background', 'rgba(0,0,0,0.6)');
      nameInput.style('color', '#e8f0ff');
      nameInput.style('font-size', '18px');
      nameInput.style('text-transform', 'uppercase');
    }
    nameInput.show();
    nameInput.position(width / 2 - 130, height * 0.45 + 30);
  } else if (nameInput) {
    nameInput.hide();
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(16);
  initStarfield();
  pulsars.push(new Pulsar(width / 4, height / 2));
  pulsars.push(new Pulsar(width * 3 / 4, height / 2, config.pulsar.period / 2));
  setupGame();
}

function setupGame() {
  gameState = 'PROLOGUE';
  matchWinner = null; lastScorer = null; championship = {};
  userPlayer = null; userTeamName = null;
  gamepadConnected = false; connectedGamepadIndex = -1;
  selectedMenuIndex = 0; lastGamepadState = {};
  meteorShowerTimer = config.meteor.interval;
  teamMomentum = {};
  hypeFlash = 0;
  keyboardHintTimer = 420;
  mineRespawnTimers = [];
  lastMusicMood = null;
  prologueScroll = height + 200;
  if (nameInput) nameInput.hide();
}

function setupChampionship() {
    let shuffledTeams = shuffle(ALL_TEAMS);
    championship = {
        phase: 'GROUP',
        groups: [
            shuffledTeams.slice(0, 4), shuffledTeams.slice(4, 8), shuffledTeams.slice(8, 12)
        ],
        standings: {}, knockoutBracket: [], finalists: [], currentMatchIndex: 0
    };
    shuffledTeams.forEach(t => { championship.standings[t.name] = { points: 0, totalScore: 0, team: t }; });
    selectedMenuIndex = 0;
}

function setupNextMatch() {
    let teamsForThisMatch = [];
    if (championship.phase === 'GROUP') { teamsForThisMatch = championship.groups[championship.currentMatchIndex]; }
    else if (championship.phase === 'QUARTERFINAL') { let bracketIndex = championship.currentMatchIndex * 4; teamsForThisMatch = championship.knockoutBracket.slice(bracketIndex, bracketIndex + 4); }
    else if (championship.phase === 'FINAL') { teamsForThisMatch = championship.finalists; }
    initializeMatch(teamsForThisMatch);
    gameState = 'MATCH_INTRO';
}

function initializeMatch(matchTeams) {
    teams = []; score = {}; matchWinner = null; lastScorer = null; userPlayer = null;
    teamMomentum = {};
    keyboardHintTimer = 420;
    mineRespawnTimers = [];
    matchTeams.forEach((teamData, i) => {
        score[teamData.name] = 0;
        let newTeam = { ...teamData, players: [], goal: GOAL_POSITIONS[i] };
        for (let j = 0; j < 3; j++) { newTeam.players.push(new Player(width/2, height/2, newTeam, (j === 0) ? 'STRIKER' : 'DEFENDER')); }
        teams.push(newTeam);
        teamMomentum[newTeam.name] = { level: 0, timer: 0 };
        if (userTeamName && newTeam.name === userTeamName) { userPlayer = newTeam.players[0]; userPlayer.isUserControlled = true; }
    });
    particles = [];
    asteroids = []; for (let i = 0; i < config.asteroid.count; i++) { asteroids.push(new Asteroid(random(width * 0.2, width * 0.8), random(height * 0.2, height * 0.8), random(config.asteroid.maxSize - 15, config.asteroid.maxSize))); }
    mines = []; for (let i = 0; i < config.mine.count; i++) { mines.push(new Mine(random(width), random(height))); }
    core = new Core();
    startRoundReset();
}

function startRoundReset() {
    sfx('respawn', {vol:0.9, source:'native'});

    gameState = 'RESETTING';
    countdownTimer = 180; countdownStarted = false;
    resetGracePeriod = 390; // 6.5 seconds
    forceResetApplied = false;
    core.reset(); powerUps = []; activeUltimates = []; activeMeteors = [];
    meteorShowerTimer = config.meteor.interval;
    teams.forEach(t => t.players.forEach(p => p.resetForRound()));
}

function processMatchResults() {
    if (championship.phase === 'GROUP') {
        let rankedTeams = teams.sort((a, b) => score[b.name] - score[a.name]);
        if(rankedTeams.length > 0) championship.standings[rankedTeams[0].name].points += 3;
        if(rankedTeams.length > 1) championship.standings[rankedTeams[1].name].points += 1;
        teams.forEach(t => { championship.standings[t.name].totalScore += score[t.name]; });
        championship.currentMatchIndex++;
        if (championship.currentMatchIndex >= championship.groups.length) { calculateGroupStageAdvancement(); championship.phase = 'QUARTERFINAL'; championship.currentMatchIndex = 0; }
    } else if (championship.phase === 'QUARTERFINAL') {
        let rankedTeams = teams.sort((a, b) => score[b.name] - score[a.name]);
        if(rankedTeams.length > 0) championship.finalists.push(rankedTeams[0]);
        if(rankedTeams.length > 1) championship.finalists.push(rankedTeams[1]);
        championship.currentMatchIndex++;
        if (championship.currentMatchIndex >= 2) { championship.phase = 'FINAL'; championship.currentMatchIndex = 0; }
    } else if (championship.phase === 'FINAL') {
        championship.winner = matchWinner;
        gameState = 'CHAMPIONSHIP_OVER';
        return;
    }
    gameState = 'CHAMPIONSHIP_MENU';
}

function calculateGroupStageAdvancement() {
    let qualifiedTeams = [];
    let thirdPlaceTeams = [];
    championship.groups.forEach(group => {
        let groupStandings = group.map(t => championship.standings[t.name]).sort((a, b) => b.points - a.points || b.totalScore - a.totalScore);
        qualifiedTeams.push(groupStandings[0].team); qualifiedTeams.push(groupStandings[1].team);
        thirdPlaceTeams.push(groupStandings[2]);
    });
    thirdPlaceTeams.sort((a, b) => b.points - a.points || b.totalScore - a.totalScore);
    qualifiedTeams.push(thirdPlaceTeams[0].team); qualifiedTeams.push(thirdPlaceTeams[1].team);
    championship.knockoutBracket = shuffle(qualifiedTeams);
}

function drawPrologue() {
    textAlign(CENTER, CENTER);
    const story = [
        "Broadcast Directive 19 // Outer Ring Feed",
        "Entertainment is rationed like oxygen. The crowds demand a spectacle.",
        "Orbital citadels drain power from a relic known as the Astral Core.",
        "Condemned pilots are drafted into the Trials to keep the grids alive.",
        "Four factions drop in; only one buys clemency. The rest fuel the reactors.",
        "Tackle, steal, and score before the Core overloads in your hands.",
        "Win, and your callsign blinks on every corridor holo. Lose, and you vanish.",
        "This is the running-man era of space. Welcome to the arena."
    ];
    if (prologueScroll > height * 3 || prologueScroll <= -height * 2) prologueScroll = height + story.length * 40;
    prologueScroll -= 0.7;
    fill(0, 0, 0, 60);
    rect(0, 0, width, height);
    textSize(24);
    story.forEach((line, idx) => {
        const y = prologueScroll + idx * 42;
        if (y > -80 && y < height + 80) {
            const c = map(idx, 0, story.length, 180, 40);
            fill(c, 80, 100, 90);
            text(line, width / 2, y);
        }
    });
    fill(0, 0, 100, map(sin(frameCount * 0.05), -1, 1, 20, 80));
    textSize(18);
    text("Click or press any key to continue", width / 2, height * 0.85);
    if (prologueScroll < -story.length * 40) {
        gameState = 'PLAYER_SETUP';
    }
}

function drawPlayerSetup() {
    if (nameInput) playerName = nameInput.value();
    textAlign(CENTER, TOP);
    fill(0, 0, 100);
    textSize(44);
    text("ASTRAL CORE // TRIAL BRIEFING", width / 2, height * 0.08);
    textSize(18);
    fill(0, 0, 85);
    text("Enter your callsign and review controls before stepping into the arena.", width / 2, height * 0.16);
    textSize(16);
    fill(50, 80, 100);
    text("CALLSIGN", width / 2, height * 0.4 + 30);
    fill(0, 0, 90);
    

    const leftX = width * 0.18;
    const rightX = width * 0.58;
    const startY = height * 0.26;
    textAlign(LEFT, TOP);
    fill(180, 80, 100); textSize(20); text("CONTROLS", leftX, startY);
    textSize(16); fill(0, 0, 90);
    text("Keyboard: WASD/Arrows move | Space dash | Shift phase | E ultimate | Q tractor (with Magnet)", leftX, startY + 28, width * 0.32);
    text("Gamepad: Left stick move | (A) dash | (B) phase | (X) ultimate | (Y) tractor", leftX, startY + 64, width * 0.32);

    fill(40, 90, 100); textSize(20); text("RULES OF PLAY", rightX, startY);
    textSize(16); fill(0, 0, 90);
    text("• Carry the Core into an opponent goal. First to " + config.pointsToWin + " wins.", rightX, startY + 28, width * 0.32);
    text("• Energy drains on abilities. Recover in your goal. Exhaustion stuns you.", rightX, startY + 50, width * 0.32);
    text("• Steal only with a dash tackle. A long carry will overload and explode.", rightX, startY + 72, width * 0.32);
    text("• Hazards: mines respawn quickly, meteors stun, pulsars push, asteroids ricochet.", rightX, startY + 94, width * 0.32);

    textAlign(CENTER, CENTER);
    fill(0, 0, 100, map(sin(frameCount * 0.05), -1, 1, 40, 90));
    textSize(20);
    text("Press Enter or Click to lock your callsign and choose a team", width / 2, height * 0.82);
}

function draw() {
    if (config.screenShake > 0) { translate(random(-config.screenShake, config.screenShake), random(-config.screenShake, config.screenShake)); config.screenShake *= 0.9; }
    drawCosmicBackdrop();
    updateMomentum();
    syncMusicWithGameState();
    syncNameInputVisibility();
    if (keyboardHintTimer > 0) keyboardHintTimer--;

    handleGlobalGamepadInput();

    switch(gameState) {
        case 'PROLOGUE': drawPrologue(); break;
        case 'PLAYER_SETUP': drawPlayerSetup(); break;
        case 'TITLE': drawTitleScreen(); break;
        case 'TEAM_SELECT': drawTeamSelectScreen(); break;
        case 'CHAMPIONSHIP_MENU': drawChampionshipMenu(); break;
        case 'MATCH_INTRO': drawMatchIntro(); break;
        case 'PLAYING': case 'RESETTING': case 'MATCH_OVER':
            updateAndDrawEntities();
            if (gameState === 'PLAYING') handleGameplayLogic();
            else if (gameState === 'RESETTING') updateResetSequence();
            else if (gameState === 'MATCH_OVER') drawMatchOver();
            drawHUD();
            break;
        case 'CHAMPIONSHIP_OVER': drawChampionshipOver(); break;
    }
}

function updateAndDrawEntities() {
    drawGoals(); handleAsteroidPhysics(); handleMineAsteroidCollisions();
    let allPlayers = teams.flatMap(t => t.players);
    asteroids.forEach(a => { a.update(); a.draw(); });
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); particles[i].draw(); if (particles[i].isDead()) particles.splice(i, 1); }
    for (let i = powerUps.length - 1; i >= 0; i--) { powerUps[i].update(); powerUps[i].draw(); if (powerUps[i].isDead()) powerUps.splice(i, 1); }
    for (let i = activeUltimates.length - 1; i >= 0; i--) { activeUltimates[i].update(allPlayers, core); activeUltimates[i].draw(); if (activeUltimates[i].isDead()) activeUltimates.splice(i, 1); }
    for (let i = activeMeteors.length-1; i >= 0; i--) { activeMeteors[i].update(allPlayers); activeMeteors[i].draw(); if (activeMeteors[i].isDone) activeMeteors.splice(i, 1); }
    pulsars.forEach(p => { p.update(); p.draw(); if(gameState==='PLAYING'){ p.applyEffect(core); allPlayers.forEach(player => p.applyEffect(player));}});
    for (let i = mines.length - 1; i >= 0; i--) {
        mines[i].update(allPlayers, asteroids, core);
        mines[i].draw();
        if (mines[i].isDead) {
            mines.splice(i, 1);
            mineRespawnTimers.push(config.mine.respawnDelay);
        }
    }
    for (let i = mineRespawnTimers.length - 1; i >= 0; i--) {
        mineRespawnTimers[i]--;
        if (mineRespawnTimers[i] <= 0) {
            mineRespawnTimers.splice(i, 1);
            mines.push(new Mine(random(width), random(height)));
        }
    }
    teams.forEach(t => t.players.forEach(p => { if (gameState === 'RESETTING' && !p.isExhausted) p.returnToStart(); p.update(); p.draw(); }));
    core.update(allPlayers, asteroids); core.draw();
}

function handleGameplayLogic() {
    if (userPlayer) { handleInGameGamepadInput(); handleInGameKeyboardInput(); }
    managePowerUps(); manageMeteorShowers();
    let allPlayers = teams.flatMap(t => t.players);
    teams.forEach(t => t.players.forEach(p => { p.runAI(allPlayers, core, powerUps, teams); p.checkCollisions(allPlayers, core, powerUps, asteroids, activeUltimates); }));
    checkScore();
}

function handleInGameGamepadInput() {
    if (!userPlayer || connectedGamepadIndex < 0) return;
    let gamepad = navigator.getGamepads()[connectedGamepadIndex];
    if (!gamepad) return;

    const deadzone = 0.15;
    let stickX = gamepad.axes[0]; let stickY = gamepad.axes[1];
    let moveForce = createVector(0, 0);
    if (abs(stickX) > deadzone || abs(stickY) > deadzone) {
        moveForce = createVector(stickX, stickY);
        let desiredVel = moveForce.copy().setMag(config.player.maxSpeed);
        let steer = p5.Vector.sub(desiredVel, userPlayer.vel);
        steer.limit(config.player.maxForce * 1.5);
        userPlayer.applyForce(steer);
    }
    if (gamepad.buttons[0].pressed) { userPlayer.userBlinkDash(moveForce); }
    if (gamepad.buttons[1].pressed) { userPlayer.userPhaseShift(); }
    if (gamepad.buttons[2].pressed) { userPlayer.useUltimate(); }
    if (gamepad.buttons[3].pressed) { userPlayer.placeTractorField(userPlayer.pos); }
}

function handleInGameKeyboardInput() {
    if (!userPlayer) return;
    const moveForce = createVector(0, 0);
    if (keyIsDown(65) || keyIsDown(37)) moveForce.x -= 1; // A / Left
    if (keyIsDown(68) || keyIsDown(39)) moveForce.x += 1; // D / Right
    if (keyIsDown(87) || keyIsDown(38)) moveForce.y -= 1; // W / Up
    if (keyIsDown(83) || keyIsDown(40)) moveForce.y += 1; // S / Down
    if (moveForce.mag() > 0) {
        moveForce.normalize();
        let desiredVel = moveForce.copy().setMag(config.player.maxSpeed);
        let steer = p5.Vector.sub(desiredVel, userPlayer.vel);
        steer.limit(config.player.maxForce * 1.3);
        userPlayer.applyForce(steer);
    }
    if (keyIsDown(32)) { userPlayer.userBlinkDash(moveForce); } // Space
    if (keyIsDown(16)) { userPlayer.userPhaseShift(); } // Shift
    if (keyIsDown(69)) { userPlayer.useUltimate(); } // E
    if (keyIsDown(81)) { userPlayer.placeTractorField(userPlayer.pos); } // Q
}

function areAllPlayersHome() { if (!teams || teams.length === 0) return false; for (const p of teams.flatMap(t => t.players)) { if (!p.isHome()) return false; } return true; }

function updateResetSequence() {
    if (resetGracePeriod > 0) {
        resetGracePeriod--;
    } else if (!forceResetApplied) {
        teams.forEach(t => t.players.forEach(p => {
            if (!p.isHome()) {
                const goalPos = getGoalPosition(p.team.goal);
                p.pos.set(goalPos.x + random(-config.goalSize * 0.4, config.goalSize * 0.4), goalPos.y + random(-config.goalSize * 0.4, config.goalSize * 0.4));
                p.vel.mult(0); p.returnTarget = null;
            }
        }));
        forceResetApplied = true;
    }
    if (!countdownStarted && areAllPlayersHome()) { countdownStarted = true; }
    if (countdownStarted) {
        countdownTimer--;
        let count = ceil(countdownTimer / 60);
        if (count > 0) { fill(0, 0, 100, 80); textSize(200); text(count, width / 2, height / 2); }
        if (countdownTimer <= 0) { gameState = 'PLAYING'; teams.forEach(t => t.players.forEach(p => { p.returnTarget = null; p.ultimateCharge = 0; })); }
    }
}

function drawTitleScreen() {
    textAlign(CENTER, CENTER); let textWidth = width * 0.28;
    fill(0, 0, 100); textSize(54); text("ASTRAL CORE", width / 2, height * 0.08);
    textSize(18); text("A 4-team, AI-driven, physics-based sports game.", width / 2, height * 0.08 + 50);
    let col1 = width * 0.18, col2 = width * 0.5, col3 = width * 0.82; let yPos = height * 0.22, yStep = 28;
    textAlign(LEFT, TOP); fill(60, 80, 100); textSize(24); text("OBJECTIVE", col1 - textWidth / 2, yPos);
    fill(0, 0, 90); textSize(16); yPos += yStep * 1.5; text("Score by carrying the CORE into an OPPONENT'S GOAL. First to " + config.pointsToWin + " points wins.", col1 - textWidth / 2, yPos, textWidth);
    yPos += yStep * 3.5; fill(200, 80, 100); textSize(24); text("PLAYER ENERGY", col1 - textWidth / 2, yPos);
    fill(0, 0, 90); textSize(16); yPos += yStep * 1.5; text("Abilities cost energy. Regenerate by returning to your goal zone. Zero energy causes temporary EXHAUSTION.", col1 - textWidth / 2, yPos, textWidth);
    yPos = height * 0.22; textAlign(LEFT, TOP); fill(120, 80, 100); textSize(24); text("GAMEPAD CONTROLS", col2 - textWidth / 2, yPos);
    yPos += yStep * 1.5; fill(0, 0, 90); textSize(16);
    text("LEFT STICK: Move Player", col2 - textWidth / 2, yPos, textWidth); yPos += yStep; text("(A) / (X): Blink Dash", col2 - textWidth / 2, yPos, textWidth); yPos += yStep; text("(B) / (O): Phase Shift (Invulnerability)", col2 - textWidth / 2, yPos, textWidth); yPos += yStep; text("(X) / (SQ): Use Ultimate Ability", col2 - textWidth / 2, yPos, textWidth); yPos += yStep; text("(Y) / (TRI): Deploy Tractor Field", col2 - textWidth / 2, yPos, textWidth); yPos += yStep*1.5; fill(0, 0, 80); textSize(14); text("NOTE: Tractor Field requires Magnet power-up. Ultimate requires full charge (yellow bar).", col2 - textWidth / 2, yPos, textWidth);
    yPos += yStep; text("Keyboard ready: WASD/Arrows to move, SPACE to dash, SHIFT to phase, E for ultimate, Q for tractor.", col2 - textWidth / 2, yPos, textWidth);
    yPos = height * 0.22; textAlign(LEFT, TOP); fill(0, 80, 100); textSize(24); text("ARENA HAZARDS", col3 - textWidth / 2, yPos);
    yPos += yStep * 1.5; fill(0, 0, 90); textSize(18); text("PULSARS", col3 - textWidth / 2, yPos);
    yPos += yStep * 0.8; textSize(16); text("Periodic energy waves push all objects outwards.", col3 - textWidth / 2, yPos, textWidth);
    yPos += yStep * 2; textSize(18); text("ASTEROIDS", col3 - textWidth / 2, yPos);
    yPos += yStep * 0.8; textSize(16); text("Drifting rocks that break apart on collision.", col3 - textWidth / 2, yPos, textWidth);
    yPos += yStep * 2; textSize(18); text("METEOR SHOWERS", col3 - textWidth / 2, yPos);
    yPos += yStep * 0.8; textSize(16); text("Targeted strikes stun players and drain energy.", col3 - textWidth / 2, yPos, textWidth);
    textAlign(CENTER, CENTER); yPos = height * 0.9;
    let pulseAlpha = map(sin(frameCount * 0.05), -1, 1, 60, 100); fill(0, 0, 100, pulseAlpha);
    textSize(28); text("Press any Gamepad Button or Click to Start", width / 2, yPos);
}

function drawTeamSelectScreen() {
    if (!championship.groups) return; // Defensive check
    textAlign(CENTER, CENTER);
    fill(0, 0, 100); textSize(48); text("CHOOSE YOUR TEAM", width / 2, 80);
    textSize(18); fill(0, 0, 85);
    let prompt = gamepadConnected ? "Use D-Pad/Stick to navigate. Press (A) to select." : "Click a team to control or spectate.";
    text(prompt, width / 2, 130);

    const teamList = championship.groups.flat();
    const boxWidth = 250, boxHeight = 60, gap = 20, perRow = 4;
    const totalWidth = (perRow * boxWidth) + ((perRow - 1) * gap);
    const startX = (width - totalWidth) / 2;
    const startY = 200;
    
    teamList.forEach((team, i) => {
        let row = floor(i / perRow); let col = i % perRow;
        let x = startX + col * (boxWidth + gap); let y = startY + row * (boxHeight + gap);
        let isSelected = (selectedMenuIndex === i);
        let isHovered = mouseX > x && mouseX < x + boxWidth && mouseY > y && mouseY < y + boxHeight;
        if(isHovered && !gamepadConnected) selectedMenuIndex = i;

        strokeWeight(isSelected ? 4 : 2);
        stroke(team.color[0], team.color[1], 100, isSelected ? 100 : 50);
        fill(team.color[0], team.color[1], 20, isSelected ? 50 : 20);
        rect(x, y, boxWidth, boxHeight, 10);
        noStroke(); fill(team.color[0], team.color[1], 100); textSize(20);
        text(team.name, x + boxWidth / 2, y + boxHeight / 2);
    });

    const spectateIndex = teamList.length;
    const btnY = startY + ceil(teamList.length / perRow) * (boxHeight + gap);
    const btnX = width/2 - 150, btnW = 300, btnH = 60;
    let isSpectateSelected = (selectedMenuIndex === spectateIndex);
    let isSpectateHovered = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
    if(isSpectateHovered && !gamepadConnected) selectedMenuIndex = spectateIndex;
    
    strokeWeight(isSpectateSelected ? 4 : 2);
    stroke(0, 0, 100, isSpectateSelected ? 100 : 50);
    fill(0, 0, 20, isSpectateSelected ? 50 : 20);
    rect(btnX, btnY, btnW, btnH, 10);
    noStroke(); fill(0, 0, 100); textSize(22);
    text("SPECTATE (AI vs AI)", width/2, btnY + btnH / 2);
}

function drawChampionshipMenu() { if (!championship.groups) return; textAlign(CENTER, CENTER); fill(0, 0, 100); textSize(48); text("ASTRAL CORE CHAMPIONSHIP", width/2, 60); textSize(24); fill(0,0,80); text(championship.phase + " STAGE", width/2, 110); if (championship.phase === 'GROUP') { let colWidth = width / 3; championship.groups.forEach((group, i) => { let x = (i * colWidth) + colWidth / 2; fill(0,0,100); textSize(22); text(`Group ${String.fromCharCode(65 + i)}`, x, 160); let sortedGroup = group.map(t => championship.standings[t.name]).sort((a, b) => b.points - a.points || b.totalScore - a.totalScore); sortedGroup.forEach((standing, j) => { let team = standing.team; fill(team.color[0], team.color[1], team.color[2]); textSize(18); textAlign(LEFT, TOP); text(`${j+1}. ${getInitials(team.name)}`, x - colWidth/2 + 20, 200 + j * 40); textAlign(RIGHT, TOP); textSize(16); text(`Pts: ${standing.points} (S: ${standing.totalScore})`, x + colWidth/2 - 20, 200 + j * 42); }); }); textAlign(CENTER, CENTER); fill(0,0,100, map(sin(frameCount*0.05),-1,1,60,100)); textSize(28); text("Press (A) or Click to Start Match", width/2, height - 80); } else { drawKnockoutBracket(); fill(0,0,100, map(sin(frameCount*0.05),-1,1,60,100)); textSize(28); text("Press (A) or Click to Start Match", width/2, height - 80); } }
function drawKnockoutBracket() { if (!championship.knockoutBracket) return; textAlign(CENTER,CENTER); let qfTeams = championship.knockoutBracket; let finalTeams = championship.finalists; textSize(22); fill(0,0,100); text("Quarter-Final 1", width/4, 160); text("Quarter-Final 2", width*3/4, 160); for(let i = 0; i < 8; i++) { let team = qfTeams[i]; if(!team) continue; let x = i < 4 ? width/4 : width*3/4; let y = 200 + (i % 4) * 50; fill(team.color[0], team.color[1], 100); textSize(18); text(getInitials(team.name), x, y); } textSize(22); fill(0,0,100); text("The Final", width/2, 400); for(let i = 0; i < finalTeams.length; i++) { let team = finalTeams[i]; if(!team) continue; let x = width/2; let y = 440 + i * 50; fill(team.color[0], team.color[1], 100); textSize(18); text(getInitials(team.name), x, y); } }
function drawMatchIntro() { textAlign(CENTER, CENTER); fill(0,0,100); textSize(48); text("UPCOMING MATCH", width/2, height/2 - 120); teams.forEach((t, i) => { fill(t.color[0], t.color[1], 100); textSize(28); text(t.name, width/2, height/2 - 40 + i * 50); }); fill(0,0,100, map(sin(frameCount*0.05),-1,1,60,100)); textSize(28); text("Press (A) or Click to Begin", width/2, height - 80); }
function drawMatchOver() { textAlign(CENTER, CENTER); fill(0,0,100); textSize(48); text("MATCH OVER!", width/2, height/2 - 100); textSize(32); fill(matchWinner.color[0], matchWinner.color[1], 100); text(`${matchWinner.name} wins the match!`, width/2, height/2); textSize(24); fill(0,0,100, map(sin(frameCount*0.05),-1,1,60,100)); text("Press (A) or Click to Continue", width/2, height - 80); }
function drawChampionshipOver() { textAlign(CENTER, CENTER); fill(championship.winner.color[0], championship.winner.color[1], 100); textSize(64); text("CHAMPION!", width/2, height/2 - 80); textSize(48); text(championship.winner.name, width/2, height/2); textSize(24); fill(0,0,100); text("Press (A) or Click for Main Menu", width/2, height/2 + 80); }
function applyScreenShake(amount) { config.screenShake = max(config.screenShake, amount); }
function handleAsteroidPhysics() { let nF = []; for (let i = 0; i < asteroids.length; i++) { for (let j = i + 1; j < asteroids.length; j++) { let a1 = asteroids[i], a2 = asteroids[j]; if (a1.isDead || a2.isDead) continue; let d = a1.pos.dist(a2.pos); if (d < a1.size / 2 + a2.size / 2) { let cA1 = a1.size > config.asteroid.minSizeForBreakup, cA2 = a2.size > config.asteroid.minSizeForBreakup; if (cA1 || cA2) { let cP = p5.Vector.lerp(a1.pos, a2.pos, a1.size / (a1.size + a2.size)); if (cA1) { a1.isDead = true; nF.push(...a1.breakApart(cP)); } if (cA2) { a2.isDead = true; nF.push(...a2.breakApart(cP)); } } else { let n = p5.Vector.sub(a2.pos, a1.pos).normalize(); let t = createVector(-n.y, n.x); let v1n = n.dot(a1.vel), v1t = t.dot(a1.vel), v2n = n.dot(a2.vel), v2t = t.dot(a2.vel); a1.vel = p5.Vector.add(t.copy().mult(v1t), n.copy().mult(v2n)); a2.vel = p5.Vector.add(t.copy().mult(v2t), n.copy().mult(v1n)); } } } } asteroids = asteroids.filter(a => !a.isDead); asteroids.push(...nF); }
function handleMineAsteroidCollisions() { for (let mine of mines) { for (let asteroid of asteroids) { if (asteroid.isDead) continue; let d = mine.pos.dist(asteroid.pos); if (d < mine.size / 2 + asteroid.size / 2) { let normal = p5.Vector.sub(asteroid.pos, mine.pos).normalize(); let tangent = createVector(-normal.y, normal.x); let overlap = (mine.size / 2 + asteroid.size / 2) - d; mine.pos.sub(normal.copy().mult(overlap / 2)); asteroid.pos.add(normal.copy().mult(overlap / 2)); let v1n = normal.dot(mine.vel); let v1t = tangent.dot(mine.vel); let v2n = normal.dot(asteroid.vel); let v2t = tangent.dot(asteroid.vel); let v1n_after = v2n; let v2n_after = v1n; let vec1n_after = normal.copy().mult(v1n_after); let vec1t_after = tangent.copy().mult(v1t); let vec2n_after = normal.copy().mult(v2n_after); let vec2t_after = tangent.copy().mult(v2t); mine.vel = p5.Vector.add(vec1n_after, vec1t_after); asteroid.vel = p5.Vector.add(vec2n_after, vec2t_after); } } } }
function managePowerUps() { powerUpSpawnTimer--; if (powerUpSpawnTimer <= 0 && powerUps.length < config.powerUp.maxOnScreen) { powerUpSpawnTimer = config.powerUp.spawnInterval; powerUps.push(new PowerUp(random(width), random(height), random(Object.keys(powerUpTypes)))); } }
function manageMeteorShowers() { meteorShowerTimer--; if (meteorShowerTimer <= 0) { for (let i = 0; i < config.meteor.count; i++) { activeMeteors.push(new Meteor(core.pos)); } meteorShowerTimer = config.meteor.interval; } }
function getGoalPosition(g) { const m = config.goalSize / 2; switch (g) { case 'TOP_LEFT': return createVector(m, m); case 'TOP_RIGHT': return createVector(width - m, m); case 'BOTTOM_LEFT': return createVector(m, height - m); case 'BOTTOM_RIGHT': return createVector(width - m, height - m); default: return createVector(width/2, height/2); } }
function drawGoals(){
    if(!teams || teams.length === 0) return;
    teams.forEach(t=>{
        let p=getGoalPosition(t.goal);
        const momentumLevel = teamMomentum[t.name]?.level || 0;
        const pulse = sin(frameCount * 0.05 + momentumLevel) * 6;
        const ringSize = config.goalSize * 2 + pulse + momentumLevel * 8;
        fill(t.color[0],t.color[1],t.color[2],18);
        stroke(t.color[0],t.color[1],100,60);
        strokeWeight(3);
        ellipse(p.x,p.y,ringSize);
        noStroke();
        fill(t.color[0], t.color[1], 100, 10 + momentumLevel * 5);
        ellipse(p.x, p.y, ringSize * 0.55);
        if (momentumLevel > 0) {
            stroke(t.color[0], t.color[1], 100, 50);
            strokeWeight(2);
            for (let i = 0; i < momentumLevel; i++) {
                const angle = (TWO_PI / 3) * i + frameCount * 0.01;
                const x = p.x + cos(angle) * (ringSize * 0.35);
                const y = p.y + sin(angle) * (ringSize * 0.35);
                line(p.x, p.y, x, y);
            }
            noStroke();
        }
    });
}
function drawHUD() {
    if(!teams||teams.length===0)return;
    const panelWidth = 180, panelHeight = 46, gap = 12;
    const totalWidth = teams.length * panelWidth + (teams.length - 1) * gap;
    let x = width/2 - totalWidth/2;
    const y = 14;
    teams.forEach(t=>{
        const s = score[t.name] || 0;
        const momentumLevel = teamMomentum[t.name]?.level || 0;
        const isUser = t.name === userTeamName;
        fill(0,0,0,40);
        stroke(t.color[0], t.color[1], 100, isUser ? 100 : 60);
        strokeWeight(isUser ? 3 : 1.5);
        rect(x, y, panelWidth, panelHeight, 10);
        noStroke();
        fill(t.color[0], t.color[1], 100);
        textAlign(LEFT,CENTER); textSize(16);
        text(getInitials(t.name), x + 10, y + panelHeight/2);
        for (let i = 0; i < config.pointsToWin; i++) {
            const filled = i < s;
            const pipX = x + 70 + i * 24;
            const pipSize = 12 + (filled ? momentumLevel * 2 : 0);
            fill(filled ? t.color[0] : 0, filled ? t.color[1] : 0, filled ? 100 : 70);
            ellipse(pipX, y + panelHeight/2, pipSize);
        }
        if (momentumLevel > 0) {
            fill(t.color[0], t.color[1], 100, 90);
            textAlign(LEFT, TOP); textSize(12);
            text(`HYPE x${(1 + momentumLevel * 0.08).toFixed(2)}`, x + 10, y + panelHeight + 8);
        }
        x += panelWidth + gap;
    });

    if(lastScorer&&gameState==='RESETTING'){
        textAlign(CENTER,CENTER);
        fill(0,0,100);
        textSize(20);
        text(`${lastScorer.scorer} scored on ${lastScorer.scoredOn}!`,width/2,100);
    }

    if (userPlayer) {
        const alpha = keyboardHintTimer > 0 ? map(keyboardHintTimer, 0, 420, 20, 90) : 30;
        textAlign(LEFT, BOTTOM);
        textSize(14);
        fill(0, 0, 100, alpha);
        const prefix = playerName ? (playerName.toUpperCase() + ": ") : "";
        const hint = prefix + "WASD/Arrows: Move | Space: Dash | Shift: Phase | E: Ultimate | Q: Tractor (with Magnet)";
        text(hint, 16, height - 16);
    }
}
function checkScore() {
    if (gameState !== 'PLAYING' || !core.carrier) return;
    const carrier = core.carrier;
    const carrierTeam = carrier.team;
    for (const goalTeam of teams) {
        if (goalTeam.name === carrierTeam.name) continue;
        const goalPos = getGoalPosition(goalTeam.goal);
        if (carrier.pos.dist(goalPos) < config.goalSize / 2) {
            score[carrierTeam.name]++;
            if (score[goalTeam.name] > 0) score[goalTeam.name]--;
            lastScorer = { scorer: carrierTeam.name, scoredOn: goalTeam.name };
            sfx('goal', {vol: 1});
            applyMomentumBoost(carrierTeam.name);
            Object.keys(teamMomentum).forEach(name => { if (name !== carrierTeam.name && teamMomentum[name]) teamMomentum[name].level = max(0, teamMomentum[name].level - 1); });
            applyScreenShake(20);
            for (let i = 0; i < 200; i++) particles.push(new Particle(goalPos.x, goalPos.y, carrierTeam.color, p5.Vector.random2D().mult(random(20))));
            if (score[carrierTeam.name] >= config.pointsToWin) { matchWinner = carrierTeam; gameState = 'MATCH_OVER'; }
            else { startRoundReset(); }
            return;
        }
    }
}

function mousePressed() {
    if (gameState === 'PLAYER_SETUP' && nameInput) {
        const nx = width / 2 - 130;
        const ny = height * 0.45;
        if (mouseX > nx && mouseX < nx + 260 && mouseY > ny - 10 && mouseY < ny + 50) {
            return;
        }
    }
    handleMenuConfirm();
}
function keyPressed() {
    if (gameState === 'PROLOGUE') {
        gameState = 'PLAYER_SETUP';
        return;
    }
    if (gameState === 'PLAYER_SETUP' && (keyCode === ENTER || key === ' ')) {
        handleMenuConfirm();
        return;
    }
    if (gameState === 'TITLE') {
        setupChampionship();
        gameState = 'TEAM_SELECT';
        return;
    }
    if (['TEAM_SELECT','CHAMPIONSHIP_MENU','MATCH_INTRO','MATCH_OVER','CHAMPIONSHIP_OVER'].includes(gameState) && (keyCode === ENTER || key === ' ')) {
        handleMenuConfirm();
    }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); initStarfield(); setupGame(); }

function handleMenuConfirm() {
    switch(gameState) {
        case 'PROLOGUE':
            gameState = 'PLAYER_SETUP';
            break;
        case 'PLAYER_SETUP':
            if (nameInput) {
                const entered = nameInput.value().trim();
                playerName = entered ? entered.toUpperCase() : playerName;
                nameInput.hide();
            }
            setupChampionship();
            gameState = 'TEAM_SELECT';
            break;
        case 'TITLE':
            if (!gamepadConnected) { 
                setupChampionship();
                gameState = 'TEAM_SELECT';
            }
            break;
        case 'TEAM_SELECT':
            if (!championship.groups) return; 
            const teamList = championship.groups.flat();
            userTeamName = (selectedMenuIndex < teamList.length) ? teamList[selectedMenuIndex].name : null;
            gameState = 'CHAMPIONSHIP_MENU';
            break;
        case 'CHAMPIONSHIP_MENU': setupNextMatch(); break;
        case 'MATCH_INTRO': gameState = 'RESETTING'; break;
        case 'MATCH_OVER': processMatchResults(); break;
        case 'CHAMPIONSHIP_OVER': setupGame(); break;
    }
}

function handleGlobalGamepadInput() {
    const gamepads = navigator.getGamepads();
    let gp = null;
    if (connectedGamepadIndex >= 0 && gamepads[connectedGamepadIndex]) {
        gp = gamepads[connectedGamepadIndex];
    } else { // Auto-detect first active gamepad
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].buttons.some(b => b.pressed)) {
                connectedGamepadIndex = i;
                gamepadConnected = true;
                gp = gamepads[i];
                break;
            }
        }
    }
    if (!gp) { gamepadConnected = false; return; }

    if (inputCooldown > 0) { inputCooldown--; }
    
    let currentState = {
        a: gp.buttons[0].pressed,
        up: gp.buttons[12].pressed || gp.axes[1] < -0.7,
        down: gp.buttons[13].pressed || gp.axes[1] > 0.7,
        left: gp.buttons[14].pressed || gp.axes[0] < -0.7,
        right: gp.buttons[15].pressed || gp.axes[0] > 0.7,
    };
    
    if (gameState === 'TITLE' && currentState.a && !lastGamepadState.a) {
        setupChampionship();
        gameState = 'TEAM_SELECT';
    } else if (currentState.a && !lastGamepadState.a) { 
        handleMenuConfirm(); 
    }
    
    if (gameState === 'TEAM_SELECT' && inputCooldown === 0) {
        if (!championship.groups) return; // Safety check
        const teamCount = championship.groups.flat().length;
        const totalItems = teamCount + 1;
        const perRow = 4;
        
        let moved = false;
        if (currentState.right && !lastGamepadState.right) { selectedMenuIndex = (selectedMenuIndex + 1); if(selectedMenuIndex >= totalItems) selectedMenuIndex = 0; moved = true; }
        if (currentState.left && !lastGamepadState.left) { selectedMenuIndex = (selectedMenuIndex - 1); if(selectedMenuIndex < 0) selectedMenuIndex = totalItems - 1; moved = true; }
        if (currentState.down && !lastGamepadState.down) {
            if (selectedMenuIndex < teamCount) {
                selectedMenuIndex = min(selectedMenuIndex + perRow, teamCount);
            } else { selectedMenuIndex = 0; }
            moved = true;
        }
        if (currentState.up && !lastGamepadState.up) {
            if (selectedMenuIndex === teamCount) {
                selectedMenuIndex = teamCount - (teamCount % perRow || perRow);
            } else if (selectedMenuIndex < perRow) {
                selectedMenuIndex = teamCount;
            } else {
                selectedMenuIndex -= perRow;
            }
             moved = true;
        }
        if(moved) inputCooldown = 15;
    }

    lastGamepadState = currentState;
}

// --- All classes are here ---
class Particle { constructor(x, y, c, v) { this.pos = createVector(x, y); this.vel = v; this.lifespan = 100; this.color = c; this.size = random(2, 6); this.drag = 0.96; } update() { this.lifespan -= 2; this.vel.mult(this.drag); this.pos.add(this.vel); } draw() { noStroke(); fill(this.color[0], this.color[1], this.color[2], this.lifespan); ellipse(this.pos.x, this.pos.y, this.size); } isDead() { return this.lifespan < 0; } }
class ShockwaveParticle extends Particle { constructor(x, y, maxRadius) { super(x, y, [0, 0, 100], createVector(0, 0)); this.maxRadius = maxRadius; this.lifespan = 50; this.maxLifespan = 50; } update() { this.lifespan--; } draw() { let p = 1 - (this.lifespan / this.maxLifespan); let cR = p * this.maxRadius; let a = this.lifespan / this.maxLifespan * 100; noFill(); stroke(30, 100, 100, a); strokeWeight(map(p, 0, 1, 8, 0)); ellipse(this.pos.x, this.pos.y, cR * 2); noStroke(); } isDead() { return super.isDead(); } }
class Meteor { constructor(corePos) { this.warningTime = config.meteor.warningTime; this.targetPos = p5.Vector.add(corePos, p5.Vector.random2D().mult(random(250))); this.targetPos.limitToCanvas(); this.timer = this.warningTime; this.state = 'WARNING'; this.isDone = false; } update(players) { this.timer--; if (this.state === 'WARNING' && this.timer <= 0) { this.state = 'IMPACTING'; this.impact(players); this.isDone = true; } } impact(players) { sfx('hazard', {vol: 0.8}); applyScreenShake(20); for (let i = 0; i < 100; i++) { particles.push(new Particle(this.targetPos.x, this.targetPos.y, [15, 100, 100], p5.Vector.random2D().mult(random(1, 12)))); } players.forEach(p => { if (p.pos.dist(this.targetPos) < config.meteor.impactRadius) { p.stunTimer = config.meteor.stunDuration; p.energy -= config.meteor.energyDamage; } }); } draw() { if (this.state === 'WARNING') { let progress = 1 - (this.timer / this.warningTime); let alpha = sin(progress * PI) * 100; let size = lerp(0, config.meteor.impactRadius * 2, progress); noFill(); stroke(0, 100, 100, alpha); strokeWeight(map(progress, 0, 1, 1, 4)); ellipse(this.targetPos.x, this.targetPos.y, size); line(this.targetPos.x - size / 2, this.targetPos.y, this.targetPos.x + size / 2, this.targetPos.y); line(this.targetPos.x, this.targetPos.y - size / 2, this.targetPos.x, this.targetPos.y + size / 2); } } }
class Mine { constructor(x, y) { this.pos = createVector(x, y); this.size = config.mine.size; this.isDead = false; this.isArmed = false; this.armTimer = 90; this.pulse = 0; this.vel = p5.Vector.random2D().mult(config.mine.vel); } update(players, asteroids, core) { this.pos.add(this.vel); if (this.pos.x < this.size / 2 || this.pos.x > width - this.size / 2) { this.pos.x = constrain(this.pos.x, this.size / 2, width - this.size / 2); this.vel.x *= -1; } if (this.pos.y < this.size / 2 || this.pos.y > height - this.size / 2) { this.pos.y = constrain(this.pos.y, this.size / 2, height - this.size / 2); this.vel.y *= -1; } if (this.armTimer > 0) { this.armTimer--; if (this.armTimer <= 0) this.isArmed = true; } if (this.isArmed && gameState === 'PLAYING') { this.pulse = sin(frameCount * 0.1) * 3; for (const p of players) { if (p.phaseShiftTimer <= 0 && this.pos.dist(p.pos) < config.mine.triggerRadius) { this.detonate(players, asteroids, core); return; } } } } detonate(players, asteroids, core) { this.isDead = true; sfx('hazard', {vol: 1}); sfx('explosion', {vol: 0.9}); applyScreenShake(25); for (let i = 0; i < 80; i++) { particles.push(new Particle(this.pos.x, this.pos.y, [30, 100, 100], p5.Vector.random2D().mult(random(1, 15)))); } particles.push(new ShockwaveParticle(this.pos.x, this.pos.y, config.mine.explosionRadius)); for (const p of players) { const d = this.pos.dist(p.pos); if (d < config.mine.explosionRadius) { p.stunTimer = config.mine.playerStunDuration; const force = p5.Vector.sub(p.pos, this.pos).setMag(config.mine.shockwaveForce * (1 - d / config.mine.explosionRadius)); p.applyForce(force); } } for (const a of asteroids) { const d = this.pos.dist(a.pos); if (d < config.mine.explosionRadius) { if (a.size < config.mine.asteroidDestroySize) { a.isDead = true; for (let i = 0; i < a.size; i++) { particles.push(new Particle(a.pos.x, a.pos.y, [230, 10, 40], p5.Vector.random2D().mult(random(3)))); } } else { const force = p5.Vector.sub(a.pos, this.pos).setMag(config.mine.shockwaveForce * 0.5 * (1 - d / config.mine.explosionRadius)); a.vel.add(force); } } } const d = this.pos.dist(core.pos); if (d < config.mine.explosionRadius && !core.carrier) { const force = p5.Vector.sub(core.pos, this.pos).setMag(config.mine.shockwaveForce * (1 - d / config.mine.explosionRadius)); core.applyForce(force); } } draw() { if (this.isDead) return; let mainColor = this.isArmed ? color(0, 100, 100) : lerpColor(color(0, 0, 50), color(0, 100, 100), 1 - (this.armTimer / 90)); noStroke(); fill(mainColor); ellipse(this.pos.x, this.pos.y, this.size + this.pulse); if (this.isArmed) { fill(0, 100, 100, 20); ellipse(this.pos.x, this.pos.y, config.mine.triggerRadius * 2); } } }
class PowerUp { constructor(x, y, t) { this.pos = createVector(x, y); this.vel = p5.Vector.random2D().mult(0.5); this.type = t; this.lifespan = config.powerUp.lifespan; this.size = 25; this.definition = powerUpTypes[t]; } update() { this.lifespan--; this.pos.add(this.vel); if (this.pos.x < 0 || this.pos.x > width) this.vel.x *= -1; if (this.pos.y < 0 || this.pos.y > height) this.vel.y *= -1; } draw() { let a = this.lifespan < 100 ? map(this.lifespan, 0, 100, 0, 100) : 100; let p = sin(frameCount * 0.1) * 5; fill(this.definition.color[0], this.definition.color[1], 80, 20 * (a / 100)); ellipse(this.pos.x, this.pos.y, this.size + p); fill(this.definition.color[0], this.definition.color[1], 100, a); stroke(0, 0, 100, a); strokeWeight(2); ellipse(this.pos.x, this.pos.y, this.size); noStroke(); fill(0, 0, 0, a); textSize(this.size * 0.7); text(this.definition.symbol, this.pos.x, this.pos.y); } isDead() { return this.lifespan <= 0; } }
class TractorField { constructor(x, y, ownerTeam) { this.pos = createVector(x, y); this.ownerTeam = ownerTeam; this.lifespan = config.tractorField.duration; this.radius = 1; this.maxRadius = config.tractorField.radius; this.pullForce = config.tractorField.pullForce; } update(players, core) { this.lifespan--; if (this.radius < this.maxRadius) this.radius = lerp(this.radius, this.maxRadius, 0.1); players.forEach(p => { if (p.team.name !== this.ownerTeam.name) { let d = this.pos.dist(p.pos); if (d < this.radius) { let force = p5.Vector.sub(this.pos, p.pos).setMag(this.pullForce * (1 - d / this.radius)); p.applyForce(force); } } }); } draw() { let alpha = this.lifespan < 60 ? map(this.lifespan, 0, 60, 0, 100) : 100; for (let i = 0; i < 2; i++) { let angle = random(TWO_PI); let r = random(this.radius * 0.2, this.radius); let startPos = p5.Vector.fromAngle(angle, r).add(this.pos); let vel = p5.Vector.sub(this.pos, startPos).mult(0.05).rotate(HALF_PI); particles.push(new Particle(startPos.x, startPos.y, [this.ownerTeam.color[0], 80, 100], vel)); } fill(this.ownerTeam.color[0], 90, 20, alpha * 0.4); stroke(this.ownerTeam.color[0], 90, 80, alpha * 0.8); strokeWeight(3); ellipse(this.pos.x, this.pos.y, this.radius * 2); } isDead() { return this.lifespan <= 0; } }
class BastionField { constructor(x, y) { this.pos = createVector(x, y); this.lifespan = 300; this.radius = 80; } update(players, core) { this.lifespan--; } draw() { let alpha = this.lifespan < 60 ? map(this.lifespan, 0, 60, 0, 80) : 80; let currentRadius = sin((1 - this.lifespan / 300) * HALF_PI) * this.radius; fill(180, 50, 100, alpha * 0.2); stroke(180, 80, 100, alpha); strokeWeight(4); ellipse(this.pos.x, this.pos.y, currentRadius * 2); } isDead() { return this.lifespan <= 0; } }
class RallyField { constructor(x, y, team) { this.pos = createVector(x, y); this.team = team; this.lifespan = 240; this.radius = 200; } update(players, core) { this.lifespan--; } draw() { let alpha = this.lifespan < 60 ? map(this.lifespan, 0, 60, 0, 70) : 70; let currentRadius = this.radius * (1 - (this.lifespan / 240)); stroke(this.team.color[0], 80, 100, alpha); strokeWeight(6); noFill(); ellipse(this.pos.x, this.pos.y, currentRadius * 2); } isDead() { return this.lifespan <= 0; } }
class Player {
  constructor(x, y, team, role) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.team = team;
    this.color = team.color;
    this.role = role;
    this.stunTimer = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.phaseShiftCooldown = 0;
    this.phaseShiftTimer = 0;
    this.activePowerUp = null;
    this.powerUpTimer = 0;
    this.ultimateCharge = 0;
    this.isCorrupted = false;
    this.hasTractorFieldCharge = false;
    this.returnTarget = null;
    this.maxEnergy = config.player.maxEnergy;
    this.energy = this.maxEnergy;
    this.isExhausted = false;
    this.isUserControlled = false;
    this.overdriveTimer = 0;
    this.bumpCooldown = 0;
  }

  runAI(allPlayers, core, powerUps, allTeams) {
    if (this.isUserControlled || this.stunTimer > 0 || this.isExhausted) return;
    if (this.energy < config.player.lowEnergyThreshold && core.carrier !== this && !this.isHome()) {
      this.applyForce(this.arrive(getGoalPosition(this.team.goal)));
      return;
    }
    if (this.hasTractorFieldCharge) {
      if (core.carrier && core.carrier.team.name === this.team.name) {
        const op = allPlayers.filter(p => p.team.name !== this.team.name);
        let t = null, bD = 300;
        for (const o of op) {
          let tO = p5.Vector.sub(o.pos, core.carrier.pos);
          if (tO.mag() < bD) { t = o; bD = tO.mag(); }
        }
        if (t) this.placeTractorField(t.pos);
      } else if (!core.carrier || core.carrier.team.name !== this.team.name) {
        const eNG = allPlayers.filter(p => p.team.name !== this.team.name && p.pos.dist(getGoalPosition(this.team.goal)) < 350);
        if (eNG.length >= 1) {
          let c = createVector(0, 0);
          eNG.forEach(p => c.add(p.pos));
          c.div(eNG.length);
          this.placeTractorField(c);
        }
      }
    }
    if (this.ultimateCharge >= 100 && this.role === 'STRIKER' && core.carrier) { this.useUltimate(); }
    if (this.ultimateCharge >= 100 && this.role === 'DEFENDER' && core.carrier && core.carrier.team.name !== this.team.name) {
      let g = getGoalPosition(this.team.goal);
      if (core.carrier.pos.dist(g) < 200) { this.useUltimate(); }
    }
    let targetVector;
    if (core.carrier === this) {
      targetVector = this.findBestGoalToAttack(allTeams);
    } else if (core.carrier === null) {
      if (this.role === 'STRIKER') {
        let bP = this.findBestPowerUp(powerUps);
        targetVector = bP ? bP.pos : core.pos;
      } else {
        targetVector = p5.Vector.lerp(getGoalPosition(this.team.goal), core.pos, 0.25);
      }
    } else if (core.carrier.team.name === this.team.name) {
      let carrierTarget = core.carrier.findBestGoalToAttack(allTeams);
      targetVector = p5.Vector.lerp(core.carrier.pos, carrierTarget, 0.5);
    } else {
      const c = core.carrier;
      const def = allPlayers.filter(p => p.team.name === this.team.name).sort((a, b) => a.pos.dist(c.pos) - b.pos.dist(c.pos));
      if (this === def[0]) {
        targetVector = p5.Vector.add(c.pos, p5.Vector.mult(c.vel, 15));
        if (this.dashCooldown <= 0 && this.pos.dist(c.pos) < 200) this.blinkDash(c.pos);
      } else if (this === def[1]) {
        targetVector = p5.Vector.lerp(c.pos, getGoalPosition(c.team.goal), 0.6);
      } else {
        let bP = this.findBestPowerUp(powerUps);
        targetVector = bP ? bP.pos : getGoalPosition(this.team.goal);
      }
      if (this.dashCooldown <= 0 && this.pos.dist(c.pos) < 180) this.blinkDash(c.pos);
    }
    const chasingCore = !core.carrier || core.carrier.team.name !== this.team.name;
    if (targetVector) this.applyForce(this.arrive(targetVector, !chasingCore));
    this.applyForce(this.avoid(asteroids).mult(config.player.avoidanceForce));
  }

  update() {
    if (this.powerUpTimer > 0) this.powerUpTimer--;
    const momentumBoost = getMomentumBoost(this.team.name);
    const overdriveActive = this.overdriveTimer > 0;
    if (overdriveActive) this.overdriveTimer--;
    if (this.powerUpTimer <= 0 && this.overdriveTimer <= 0 && this.activePowerUp) this.clearPowerUp();
    if (this.isHome()) {
      this.energy = min(this.maxEnergy, this.energy + config.player.energyRegenRate * momentumBoost);
      if (this.isExhausted && this.energy >= this.maxEnergy) { this.isExhausted = false; this.stunTimer = 0; }
    }
    if (overdriveActive) this.energy = min(this.maxEnergy, this.energy + config.powerUp.overdriveEnergyRegen);
    if (this.isExhausted) this.stunTimer = 10;
    if (this.stunTimer > 0) this.stunTimer--;
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.dashTimer > 0) this.dashTimer--;
    if (this.phaseShiftCooldown > 0) this.phaseShiftCooldown--;
    if (this.phaseShiftTimer > 0) this.phaseShiftTimer--;
    if (this.bumpCooldown > 0) this.bumpCooldown--;
    if (this.energy <= 0 && !this.isExhausted) this.exhaust();
    if (this.ultimateCharge < 100 && gameState === 'PLAYING') {
      const ultGain = config.player.ultimateChargeRate * (core.carrier === this ? 1.5 : 0.5) * momentumBoost;
      this.ultimateCharge = min(100, this.ultimateCharge + ultGain);
    }
    if (this.stunTimer <= 0) {
      this.vel.add(this.acc);
      let drag = config.player.drag + (overdriveActive ? 0.02 : 0);
      this.vel.mult(drag);
      let s = config.player.maxSpeed * momentumBoost;
      if (gameState === 'RESETTING') s *= 2.5;
      if (this.activePowerUp === 'JUGGERNAUT') s *= 1.8;
      if (this.activePowerUp === 'CORRUPTION') s *= 0.4;
      if (overdriveActive) s *= config.powerUp.overdriveSpeedBoost;
      if (this.dashTimer > 0) s *= 3;
      if (this.phaseShiftTimer > 0) s *= 3.5;
      let rB = 1;
      for (let ult of activeUltimates) {
        if (ult instanceof RallyField && ult.team.name === this.team.name && this.pos.dist(ult.pos) < ult.radius) { rB = config.player.rallyBoost; }
      }
      s *= rB;
      if (core.carrier === this) s *= config.player.carrierSlowdown;
      this.vel.limit(s);
      if (this.isCorrupted) this.pos.sub(this.vel); else this.pos.add(this.vel);
    }
    this.acc.mult(0);
    this.pos.limitToCanvas();
    if (this.vel.mag() > 1 && frameCount % 2 === 0 && this.stunTimer <= 0) {
      let pC = this.color.slice();
      if (this.phaseShiftTimer > 0) pC = [0, 0, 100];
      if (this.activePowerUp) pC = powerUpTypes[this.activePowerUp].color;
      if (this.overdriveTimer > 0) pC = [200, 90, 100];
      particles.push(new Particle(this.pos.x, this.pos.y, pC, this.vel.copy().mult(-0.5)));
    }
  }

  checkCollisions(allPlayers, core, powerUps, asteroids, ultimates) {
    if (this.stunTimer > 0 || this.phaseShiftTimer > 0) return;
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const p = powerUps[i];
      if (this.pos.dist(p.pos) < config.player.size / 2 + p.size / 2) { this.applyPowerUp(p.type); powerUps.splice(i, 1); break; }
    }
    if (core.carrier === null) {
      if (this.pos.dist(core.pos) < config.player.size / 2 + config.core.size / 2) core.setCarrier(this);
    } else if (core.carrier !== this && core.carrier.team.name !== this.team.name) {
      if (this.pos.dist(core.carrier.pos) < config.player.size && this.dashTimer > 0) {
        core.drop(this.vel.copy());
        this.ultimateCharge = min(100, this.ultimateCharge + config.player.ultimateTackleBonus);
      }
    }
    for (let a of asteroids) {
      if (this.pos.dist(a.pos) < config.player.size / 2 + a.size / 2) {
        let r = p5.Vector.sub(this.pos, a.pos);
        r.setMag(this.vel.mag() > 0.5 ? 1.5 : this.vel.mag());
        this.vel.add(r).limit(config.player.maxSpeed);
        this.pos.add(this.vel.copy().setMag(config.player.size / 2 + a.size / 2 - this.pos.dist(a.pos)));
        if (this.bumpCooldown <= 0) { sfx('bump', {vol: 0.6}); this.bumpCooldown = 12; }
      }
    }
    for (let u of ultimates) {
      if (u instanceof BastionField) {
        let d = this.pos.dist(u.pos);
        if (d < u.radius + config.player.size / 2) {
          let n = p5.Vector.sub(this.pos, u.pos).normalize();
          this.vel.reflect(n);
          this.vel.add(n.mult(1.5));
          this.pos.add(n.mult(u.radius + config.player.size / 2 - d));
        }
      }
    }
  }

  applyPowerUp(t) {
    this.clearPowerUp();
    this.activePowerUp = t;
    this.powerUpTimer = config.powerUp.duration;
    sfx('pickup', {vol: 0.85});
    if (t === 'CORRUPTION') { this.isCorrupted = true; this.ultimateCharge *= 0.5; }
    if (t === 'MAGNET') this.hasTractorFieldCharge = true;
    if (t === 'OVERDRIVE') this.overdriveTimer = config.powerUp.duration + 60;
  }

  clearPowerUp() {
    if (this.isCorrupted) this.isCorrupted = false;
    this.activePowerUp = null;
    this.powerUpTimer = 0;
    this.hasTractorFieldCharge = false;
    this.overdriveTimer = 0;
  }

  useUltimate() {
    if (this.ultimateCharge < 100) return;
    this.ultimateCharge = 0;
    applyScreenShake(10);
    if (this.role === 'STRIKER') { activeUltimates.push(new RallyField(this.pos.x, this.pos.y, this.team)); }
    else { activeUltimates.push(new BastionField(this.pos.x, this.pos.y)); }
  }

  placeTractorField(pos) {
    if (!this.hasTractorFieldCharge) return;
    activeUltimates.push(new TractorField(pos.x, pos.y, this.team));
    this.hasTractorFieldCharge = false;
    this.activePowerUp = null;
    this.powerUpTimer = 0;
  }

  returnToStart() {
    if (this.returnTarget) {
      if (this.pos.dist(this.returnTarget) > 10) { this.applyForce(this.arrive(this.returnTarget)); }
      else { this.pos.set(this.returnTarget); this.vel.mult(0); }
    }
  }

  exhaust() {
    this.isExhausted = true;
    this.energy = 0;
    this.stunTimer = config.player.exhaustionDuration;
    const goalPos = getGoalPosition(this.team.goal);
    this.pos.set(goalPos.x + random(-config.goalSize / 2, config.goalSize / 2), goalPos.y + random(-config.goalSize / 2, config.goalSize / 2));
    this.vel.mult(0);
    this.acc.mult(0);
    if (core.carrier === this) core.drop(p5.Vector.random2D());
    for (let i = 0; i < 30; i++) { particles.push(new Particle(this.pos.x, this.pos.y, [0, 0, 50], p5.Vector.random2D().mult(random(4)))); }
  }

  resetForRound() {
    this.returnTarget = createVector(getGoalPosition(this.team.goal).x + random(-config.goalSize * 0.8, config.goalSize * 0.8), getGoalPosition(this.team.goal).y + random(-config.goalSize * 0.8, config.goalSize * 0.8)).limitToCanvas();
    this.stunTimer = 0;
    this.clearPowerUp();
    this.vel.mult(0);
    this.acc.mult(0);
    this.isExhausted = false;
    this.energy = this.maxEnergy;
  }

  isHome() { return this.pos.dist(getGoalPosition(this.team.goal)) < config.goalSize; }

  findBestGoalToAttack(allTeams) {
    let bestGoal = null;
    let maxScore = -Infinity;
    for (const team of allTeams) {
      if (team.name === this.team.name) continue;
      const goalPos = getGoalPosition(team.goal);
      const dist = this.pos.dist(goalPos);
      let defendersNearGoal = 0;
      for (const p of team.players) { if (p.pos.dist(goalPos) < 250) defendersNearGoal++; }
      let currentScore = (1000 / dist) - (defendersNearGoal * 200) + (score[team.name] * 150);
      if (currentScore > maxScore) { maxScore = currentScore; bestGoal = goalPos; }
    }
    return bestGoal || createVector(width / 2, height / 2);
  }

  draw() {
    if (this.phaseShiftTimer > 0 && frameCount % 4 < 2) fill(0, 0, 100); else fill(this.color[0], this.color[1], this.color[2]);
    ellipse(this.pos.x, this.pos.y, config.player.size);
    let barY = this.pos.y + config.player.size;
    noStroke();
    fill(0, 0, 0, 50);
    rect(this.pos.x - config.player.size, barY, config.player.size * 2, 4);
    fill(35, 80, 100);
    rect(this.pos.x - config.player.size, barY, config.player.size * 2 * (this.ultimateCharge / 100), 4);
    let eBarY = barY + 5;
    fill(0, 0, 0, 50);
    rect(this.pos.x - config.player.size, eBarY, config.player.size * 2, 4);
    fill(200, 80, 100);
    rect(this.pos.x - config.player.size, eBarY, config.player.size * 2 * (this.energy / this.maxEnergy), 4);
    if (this.activePowerUp) {
      let d = powerUpTypes[this.activePowerUp];
      stroke(d.color[0], d.color[1], 100);
      strokeWeight(2);
      noFill();
      ellipse(this.pos.x, this.pos.y, config.player.size + 8);
      noStroke();
    }
    if (this.overdriveTimer > 0) {
      stroke(200, 90, 100, 70);
      strokeWeight(3);
      noFill();
      ellipse(this.pos.x, this.pos.y, config.player.size + 14 + sin(frameCount * 0.2) * 2);
      noStroke();
    }
    if (core.carrier === this) {
      stroke(0, 0, 100, 80);
      strokeWeight(3);
      noFill();
      ellipse(this.pos.x, this.pos.y, config.player.size + 10);
      noStroke();
    }
    if (this.stunTimer > 0) {
      let txt = this.isExhausted ? 'NRG!' : 'Zzz';
      fill(255, 50, 100, 80);
      textSize(12);
      text(txt, this.pos.x, this.pos.y - config.player.size);
    }
    if (this.isUserControlled) {
      fill(0, 0, 100);
      noStroke();
      triangle(this.pos.x, this.pos.y - config.player.size - 5, this.pos.x - 5, this.pos.y - config.player.size - 12, this.pos.x + 5, this.pos.y - config.player.size - 12);
    }
  }

  userBlinkDash(direction) {
    if (this.energy < config.player.dashEnergyCost || this.dashCooldown > 0) return;
    this.energy -= config.player.dashEnergyCost;
    this.dashTimer = config.player.dashDuration;
    this.dashCooldown = config.player.dashCooldown;
    let dashDir = direction.copy();
    if (dashDir.mag() < 0.1) { dashDir = this.vel.mag() > 0.1 ? this.vel.copy().normalize() : p5.Vector.random2D(); }
    this.applyForce(dashDir.normalize().setMag(config.player.blinkDashForce));
  }

  userPhaseShift() {
    if (this.energy < config.player.phaseEnergyCost || this.phaseShiftCooldown > 0) return;
    this.energy -= config.player.phaseEnergyCost;
    this.phaseShiftTimer = config.player.phaseShiftDuration;
    this.phaseShiftCooldown = config.player.phaseShiftCooldown;
  }

  getClosestEnemy(allPlayers) {
    let c = null, m = Infinity;
    for (const p of allPlayers) {
      if (p.team.name !== this.team.name && p.phaseShiftTimer <= 0) {
        const d = this.pos.dist(p.pos);
        if (d < m) { m = d; c = p; }
      }
    }
    return c;
  }

  findBestPowerUp(powerUps) {
    let b = null, m = config.player.powerUpSearchRadius;
    for (const p of powerUps) {
      if (p.type !== 'CORRUPTION') {
        let d = this.pos.dist(p.pos);
        if (d < m) { m = d; b = p; }
      }
    }
    return b;
  }

  arrive(t, brake = true) {
    let d = p5.Vector.sub(t, this.pos);
    let m = d.mag();
    let s = config.player.maxSpeed;
    if (brake && m < config.player.arrivalRadius) s = map(m, 0, config.player.arrivalRadius, 0, s);
    d.setMag(s);
    let steer = p5.Vector.sub(d, this.vel);
    steer.limit(config.player.maxForce);
    return steer;
  }

  avoid(obs) {
    let s = createVector(0, 0);
    for (let o of obs) {
      let d = this.pos.dist(o.pos);
      if (d < config.player.size / 2 + o.size / 2 + config.player.avoidanceLookahead * config.player.size) {
        let diff = p5.Vector.sub(this.pos, o.pos);
        diff.div(d * d);
        s.add(diff);
      }
    }
    if (s.mag() > 0) { s.setMag(config.player.maxSpeed); s.sub(this.vel); s.limit(config.player.maxForce); }
    return s;
  }

  blinkDash(t) {
    if (this.energy < config.player.dashEnergyCost) return;
    this.energy -= config.player.dashEnergyCost;
    this.dashTimer = config.player.dashDuration;
    this.dashCooldown = config.player.dashCooldown;
    this.applyForce(p5.Vector.sub(t, this.pos).setMag(config.player.blinkDashForce));
  }

  applyForce(f) { this.acc.add(f); }
}
class Core { constructor() { this.pos = createVector(width / 2, height / 2); this.vel = createVector(0, 0); this.size = config.core.size; this.carrier = null; this.charge = 0; } setCarrier(p) { this.carrier = p; this.vel.mult(0); this.charge = 0; } drop(v) { if (this.carrier) { this.vel = v.mult(0.5); this.carrier = null; this.charge = 0; } } reset() { this.pos = createVector(width / 2, height / 2); this.vel.mult(0); this.carrier = null; this.charge = 0; } explode(allPlayers) { for (let i = 0; i < 50; i++) particles.push(new Particle(this.pos.x, this.pos.y, [0, 100, 100], p5.Vector.random2D().mult(random(5)))); allPlayers.forEach(p => { if (this.pos.dist(p.pos) < config.core.explosionRadius) { p.stunTimer = config.player.stunDuration; p.ultimateCharge *= 0.75; } }); this.reset(); } applyForce(f) { if (!this.carrier) this.vel.add(f); } update(allPlayers, asteroids) { if (this.carrier) { this.pos.set(this.carrier.pos); if (this.charge > config.core.maxCharge) this.explode(allPlayers); else if (gameState === 'PLAYING') this.charge++; } else { this.vel.mult(config.core.drag); this.pos.add(this.vel); for (let a of asteroids) { if (this.pos.dist(a.pos) < a.size / 2 + this.size / 2) { let n = p5.Vector.sub(this.pos, a.pos).normalize(); this.vel.reflect(n); this.pos.add(this.vel); } } for (let u of activeUltimates) { if (u instanceof BastionField) { let d = this.pos.dist(u.pos); if (d < u.radius + this.size / 2) { let n = p5.Vector.sub(this.pos, u.pos).normalize(); this.vel.reflect(n); this.pos.add(n.mult(u.radius + this.size / 2 - d)); } } } } if (this.pos.x <= 0 || this.pos.x >= width) this.vel.x *= -1; if (this.pos.y <= 0 || this.pos.y >= height) this.vel.y *= -1; this.pos.limitToCanvas(); } draw() { let p = sin(frameCount * 0.1) * 5; if (this.carrier) { let cC = this.carrier.team.color; fill(cC[0], cC[1], cC[2], 50); noStroke(); ellipse(this.pos.x, this.pos.y, config.core.size + p + 4); fill(cC[0], cC[1], cC[2]); stroke(0, 0, 100, 70); strokeWeight(2); ellipse(this.pos.x, this.pos.y, config.core.size); noStroke(); let r = this.charge / config.core.maxCharge; let c = lerpColor(color(120, 100, 100), color(0, 100, 100), r); noFill(); strokeWeight(4); stroke(c); arc(this.pos.x, this.pos.y, config.core.size + 20, config.core.size + 20, -HALF_PI, -HALF_PI + TWO_PI * r); noStroke(); } else { let glowSize = config.core.size + 15 + p; let glowAlpha = map(sin(frameCount * 0.05), -1, 1, 30, 70); fill(60, 80, 100, glowAlpha); noStroke(); ellipse(this.pos.x, this.pos.y, glowSize * 1.5); let starPoints = 8; let angle = frameCount * 0.02; stroke(0, 0, 100, 80); strokeWeight(1.5); for (let i = 0; i < starPoints; i++) { let rotation = (TWO_PI / starPoints) * i + angle; let x1 = this.pos.x + cos(rotation) * (config.core.size * 0.6); let y1 = this.pos.y + sin(rotation) * (config.core.size * 0.6); let x2 = this.pos.x + cos(rotation) * (config.core.size * 1.1 + p); let y2 = this.pos.y + sin(rotation) * (config.core.size * 1.1 + p); line(x1, y1, x2, y2); } fill(0, 0, 100); stroke(0, 0, 0, 40); strokeWeight(4); ellipse(this.pos.x, this.pos.y, config.core.size); noStroke(); } } }
class Asteroid { constructor(x, y, s = null, v = null) { this.pos = createVector(x, y); this.size = s || random(config.asteroid.minSize, config.asteroid.maxSize); this.vel = v || p5.Vector.random2D().mult(random(0.1, config.asteroid.maxSpeed)); this.shapeDetail = []; this.isDead = false; let r = this.size / 2; for (let a = 0; a < TWO_PI; a += 0.5) { this.shapeDetail.push(createVector(cos(a) * (r + random(-r * 0.2, r * 0.2)), sin(a) * (r + random(-r * 0.2, r * 0.2)))); } } update() { this.pos.add(this.vel); if (this.pos.x < this.size / 2 || this.pos.x > width - this.size / 2) this.vel.x *= -1; if (this.pos.y < this.size / 2 || this.pos.y > height - this.size / 2) this.vel.y *= -1; } draw() { fill(230, 10, 25); stroke(230, 10, 40); strokeWeight(3); push(); translate(this.pos.x, this.pos.y); beginShape(); for (let v of this.shapeDetail) { vertex(v.x, v.y); } endShape(CLOSE); pop(); noStroke(); } breakApart(cP) { let frags = []; let num = random([2, 3, 4]); for (let i = 0; i < num; i++) { let o = p5.Vector.random2D().mult(this.size / 4); let nP = p5.Vector.add(cP, o); let nV = p5.Vector.add(this.vel, o.normalize().mult(config.asteroid.impactForce)); let nS = this.size / sqrt(num); if (nS > config.asteroid.minSizeForBreakup / 1.5) frags.push(new Asteroid(nP.x, nP.y, nS, nV)); } return frags; } }
class Pulsar { constructor(x, y, offset = 0) { this.pos = createVector(x, y); this.timer = offset; } update() { this.timer = (this.timer + 1) % config.pulsar.period; } applyEffect(e) { if (this.timer < config.pulsar.duration) { let d = this.pos.dist(e.pos); let r = (this.timer / config.pulsar.duration) * config.pulsar.maxRadius; if (d < r && d > r - 30) { e.applyForce(p5.Vector.sub(e.pos, this.pos).setMag(config.pulsar.force)); } } } draw() { if (this.timer < config.pulsar.duration) { let r = (this.timer / config.pulsar.duration) * config.pulsar.maxRadius; let a = map(this.timer, 0, config.pulsar.duration, 80, 0); strokeWeight(30); stroke(0, 0, 100, a); noFill(); ellipse(this.pos.x, this.pos.y, r * 2); noStroke(); } else { let a = (this.timer - config.pulsar.duration) / (config.pulsar.period - config.pulsar.duration); fill(0, 0, 100, a * 20 + 10); ellipse(this.pos.x, this.pos.y, a * 50); } } }
p5.Vector.prototype.limitToCanvas = function() { this.x = constrain(this.x, 0, width); this.y = constrain(this.y, 0, height); return this; };
