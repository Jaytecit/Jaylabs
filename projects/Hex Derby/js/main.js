/* ===== Game Mode Management ===== */
let currentGameMode = null; // 'normal', 'tournament', 'playground'
let bettingPhaseActive = false;

// Initialize mode selection on page load
document.addEventListener('DOMContentLoaded', function() {
  setupModeSelection();
  if (typeof bindUI === 'function') bindUI();
});

function cleanupModeState() {
  // Reset all mode-specific state variables
  tournament.active = false;
  playgroundMode = false;
  bettingPhaseActive = false;
  
  // Clear any active game state
  if (gameState !== 'pre') {
    gameState = 'pre';
  }
  
  // Clear betting state
  bets = [];
  currentSelectedStake = 0;
  currentSelectedBalls = [];
  selectedBallId = null;
  selectedStake = 0;
  lockedBet = null;
  selectedBallId2 = null;
  
  // Hide betting phase overlay if it exists
  const bettingPhase = document.getElementById('bettingPhase');
  if (bettingPhase) bettingPhase.style.display = 'none';
  
  // Remove any banners
  document.querySelectorAll('.centerBanner').forEach(el => el.remove());
}

function setupModeSelection() {
  // Mode card click handlers
  document.getElementById('normalModeCard').onclick = () => selectGameMode('normal');
  document.getElementById('tournamentModeCard').onclick = () => selectGameMode('tournament');
  document.getElementById('playgroundModeCard').onclick = () => selectGameMode('playground');
}

function selectGameMode(mode) {
  currentGameMode = mode;
  playSound('buttonClick');
  
  // Hide main menu
  document.getElementById('mainMenu').style.display = 'none';
  
  // For playground mode, show game interface immediately
  // For normal and tournament modes, the betting phase will be shown first
  if (mode === 'playground') {
    document.getElementById('gameInterface').style.display = 'block';
  }
  
  // Initialize the selected mode
  switch(mode) {
    case 'normal':
      initializeNormalMode();
      break;
    case 'tournament':
      initializeTournamentMode();
      break;
    case 'playground':
      initializePlaygroundMode();
      break;
  }
}

function initializeNormalMode() {
  // Clear any existing mode state first
  cleanupModeState();
  
  tournament.active = false;
  playgroundMode = false;
  currentGameMode = 'normal';
  document.getElementById('tournamentIndicator').style.display = 'none';
  document.getElementById('playgroundIndicator').style.display = 'none';
  
  // Hide the main game interface initially - we'll show the betting phase instead
  document.getElementById('gameInterface').style.display = 'none';
  
  // Hide playground controls
  const playgroundControls = document.getElementById('playgroundControls');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  if (playgroundControls) playgroundControls.style.display = 'none';
  if (playgroundArenaControls) playgroundArenaControls.style.display = 'none';
  
  // Start fullscreen betting phase
  enterBettingPhase();
}

function initializeTournamentMode() {
  // Clear any existing mode state first
  cleanupModeState();
  
  // Set tournament mode indicators
  tournament.active = true;
  playgroundMode = false;
  currentGameMode = 'tournament';
  document.getElementById('tournamentIndicator').style.display = 'inline';
  document.getElementById('playgroundIndicator').style.display = 'none';
  
  // Hide the main game interface initially - we'll show the betting phase instead
  document.getElementById('gameInterface').style.display = 'none';
  
  // Hide playground controls completely
  const playgroundControls = document.getElementById('playgroundControls');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  if (playgroundControls) playgroundControls.style.display = 'none';
  if (playgroundArenaControls) playgroundArenaControls.style.display = 'none';
  
  // Initialize tournament and enter fullscreen betting phase
  initializeTournament();
}

function initializePlaygroundMode() {
  // Clear any existing mode state first
  cleanupModeState();
  
  tournament.active = false;
  playgroundMode = true;
  currentGameMode = 'playground';
  document.getElementById('tournamentIndicator').style.display = 'none';
  document.getElementById('playgroundIndicator').style.display = 'inline';
  
  // Show playground controls and set up the playground interface
  const playgroundControls = document.getElementById('playgroundControls');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  const bettingControls = document.getElementById('bettingControls');
  const matchControls = document.getElementById('matchControls');
  const betSlip = document.getElementById('betSlip');
  
  if (playgroundControls) playgroundControls.style.display = 'block';
  if (playgroundArenaControls) playgroundArenaControls.style.display = 'flex';
  
  // Hide betting controls and match controls
  if (bettingControls) bettingControls.style.display = 'none';
  if (matchControls) matchControls.style.display = 'none';
  if (betSlip) betSlip.style.display = 'none';
  
  // Initialize playground mode properly
  resetToPlaygroundMode();
  
  // Initialize playground controls if the function exists
  if (typeof initializePlaygroundControls === 'function') {
    initializePlaygroundControls();
  }
  
  // Set up playground button handlers
  const playgroundStartBtn = document.getElementById('playgroundStart');
  const playgroundResetBtn = document.getElementById('playgroundReset');
  
  if (playgroundStartBtn) {
    playgroundStartBtn.onclick = () => {
      playSound('buttonClick');
      startPlaygroundArena();
    };
  }
  
  if (playgroundResetBtn) {
    playgroundResetBtn.onclick = () => {
      playSound('buttonClick');
      resetPlaygroundBalls();
    };
  }
}

/* ===== Setup ===== */
// Pulse beat state: angle-locked beat synced to rotation (initialized early)
var pulse = {
  enabled: true,
  beatsPerRotation: 6,
  phase: 0,
  anglePerBeat: Math.PI * 2 / 6,
  lastRot: null
};
function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(1);
  arena.center.x = width / 2;
  arena.center.y = height / 2;

  // Respect motion reduction setting
  const starCount = (typeof window.motionReduced !== 'undefined' && window.motionReduced) ? 200 : 600;
  starfield = makeStars(starCount);

  engine = Engine.create({ gravity: { x: 0, y: P.gravityY } });
  world = engine.world;
  engine.positionIterations = 12;
  engine.velocityIterations = 12;

  // Improved collision handling: burst damage on start, throttled scrape damage on sustain
  const pairKey = (a, b) => (a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`);

  // Burst damage when collisions start
  Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    const now = millis();

    pairs.forEach(function(pair) {
      const A = pair.bodyA;
      const B = pair.bodyB;

      const labelA = A.label;
      const labelB = B.label;

      // Compute normal from A to B
      const n = Matter.Vector.normalise(Matter.Vector.sub(B.position, A.position));

      const applyDamage = (ball, amount) => {
        if (!ball || ball.label !== 'ball') return;
        ball.health = Math.max(0, ball.health - amount);
      };

      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

      // Helper to compute base damage from relative normal speed and spin
      const computeDamageBallBall = (a, b) => {
        const vRel = Matter.Vector.sub(b.velocity, a.velocity);
        const vn = Math.abs(Matter.Vector.dot(vRel, n));
        // Use each ball's damageMod for fairness
        const baseA = P.damageScale * Math.pow(Math.max(0, vn - P.damageThreshold), P.damageExponent) * (a.damageMod || 1);
        const baseB = P.damageScale * Math.pow(Math.max(0, vn - P.damageThreshold), P.damageExponent) * (b.damageMod || 1);
        const spinA = Math.abs(a.angularVelocity || 0) * (a.circleRadius || 0);
        const spinB = Math.abs(b.angularVelocity || 0) * (b.circleRadius || 0);
        const spinBonus = P.spinDamageMultiplier * (spinA + spinB);
        let dmg = (baseA + baseB)/2 + spinBonus;
        dmg = clamp(dmg, P.minDamagePerHit, P.maxDamagePerHit);
        return dmg;
      };

      const computeDamageBallWall = (ball, wall) => {
        // Use ball velocity along normal only
        const vn = Math.abs(Matter.Vector.dot(ball.velocity, n));
        let dmg = P.damageScale * Math.pow(Math.max(0, vn - P.damageThreshold), P.damageExponent) * (ball.damageMod || 1);
        const spin = Math.abs(ball.angularVelocity || 0) * (ball.circleRadius || 0);
        dmg += P.spinDamageMultiplier * spin;
        dmg *= P.wallDamageMultiplier;
        dmg = clamp(dmg, P.minDamagePerHit, P.maxDamagePerHit);
        return dmg;
      };

      // Separation kick based on impact normal speed (affects only balls)
      const doRepulsion = (a, b) => {
        const vRel = Matter.Vector.sub(b.velocity, a.velocity);
        const vn = Math.max(0, Matter.Vector.dot(vRel, n));
        // Scale kick by vn and clamp
        // Clamp kick to prevent excessive velocity
        const kick = clamp(vn * P.ballRepulsionForce * P.ballRepulsionMultiplier, 0, P.ballRepulsionMultiplier * 0.7);
        // After repulsion, clamp ball velocities to max
        const maxVel = 12; // Maximum allowed velocity
        function clampVelocity(body) {
          const v = body.velocity;
          const mag = Math.sqrt(v.x * v.x + v.y * v.y);
          if (mag > maxVel) {
            const scale = maxVel / mag;
            Matter.Body.setVelocity(body, { x: v.x * scale, y: v.y * scale });
          }
        }
        Matter.Body.setVelocity(a, { x: a.velocity.x - n.x * kick, y: a.velocity.y - n.y * kick });
        Matter.Body.setVelocity(b, { x: b.velocity.x + n.x * kick, y: b.velocity.y + n.y * kick });
        clampVelocity(a);
        clampVelocity(b);
      };

      if (labelA === 'ball' && labelB === 'ball') {
        // Apply burst damage split between both balls
        const totalDmg = computeDamageBallBall(A, B);
        const perBall = totalDmg * 0.5;
        applyDamage(A, perBall);
        applyDamage(B, perBall);

        // Repulsion to avoid sticking
        doRepulsion(A, B);

        // Sparks at the collision point
        if (pair.collision && pair.collision.supports && pair.collision.supports[0]) {
          addBallCollisionSparks(pair.collision.supports[0].x, pair.collision.supports[0].y, P.ballCollisionSparkCount);
        }
        // Dynamic collision sound for ball-ball
        {
          const vRel = Matter.Vector.sub(B.velocity, A.velocity);
          const tVec = { x: -n.y, y: n.x };
          const vnSound = Math.abs(Matter.Vector.dot(vRel, n));
          const vtSound = Math.abs(Matter.Vector.dot(vRel, tVec));
          const spinA = Math.abs(A.angularVelocity || 0) * (A.circleRadius || 0);
          const spinB = Math.abs(B.angularVelocity || 0) * (B.circleRadius || 0);
          playCollisionSFX({ kind: 'ball-ball', vn: vnSound, vt: vtSound, spinA, spinB, rA: A.circleRadius || 0, rB: B.circleRadius || 0 });
        }

        // Reset sustained cooldown right away so scrape can occur later
        sustainedDamageMap.set(pairKey(A, B), now);
      } else if (labelA === 'ball' && labelB === 'wall') {
        const dmg = computeDamageBallWall(A, B);
        applyDamage(A, dmg);
        // Dynamic collision sound for ball-wall (A is ball)
        {
          const tVec = { x: -n.y, y: n.x };
          const vnSound = Math.abs(Matter.Vector.dot(A.velocity, n));
          const vtSound = Math.abs(Matter.Vector.dot(A.velocity, tVec));
          const spinA = Math.abs(A.angularVelocity || 0) * (A.circleRadius || 0);
          playCollisionSFX({ kind: 'ball-wall', vn: vnSound, vt: vtSound, spinA, rA: A.circleRadius || 0 });
        }
      } else if (labelA === 'wall' && labelB === 'ball') {
        const dmg = computeDamageBallWall(B, A);
        applyDamage(B, dmg);
        // Dynamic collision sound for ball-wall (B is ball)
        {
          const tVec = { x: -n.y, y: n.x };
          const vnSound = Math.abs(Matter.Vector.dot(B.velocity, n));
          const vtSound = Math.abs(Matter.Vector.dot(B.velocity, tVec));
          const spinB = Math.abs(B.angularVelocity || 0) * (B.circleRadius || 0);
          playCollisionSFX({ kind: 'ball-wall', vn: vnSound, vt: vtSound, spinB, rB: B.circleRadius || 0 });
        }
      }
    });
  });

  // Throttled scrape damage while contact persists
  Events.on(engine, 'collisionActive', function(event) {
    const pairs = event.pairs;
    const now = millis();

    pairs.forEach(function(pair) {
      const A = pair.bodyA;
      const B = pair.bodyB;
      const labelA = A.label;
      const labelB = B.label;

      // Only scrape for ball-ball contacts
      if (!(labelA === 'ball' && labelB === 'ball')) return;

      const key = pairKey(A, B);
      const last = sustainedDamageMap.get(key) || 0;
      if (now - last < P.sustainedContactIntervalMs) return;

      // Compute normal from A to B
      const n = Matter.Vector.normalise(Matter.Vector.sub(B.position, A.position));

      // Relative normal speed based damage, scaled down for sustained contact
      const vRel = Matter.Vector.sub(B.velocity, A.velocity);
      const vn = Math.abs(Matter.Vector.dot(vRel, n));
      let totalDmg = P.damageScale * Math.pow(Math.max(0, vn - P.damageThreshold), P.damageExponent);
      const spinA = Math.abs(A.angularVelocity || 0) * (A.circleRadius || 0);
      const spinB = Math.abs(B.angularVelocity || 0) * (B.circleRadius || 0);
      totalDmg += P.spinDamageMultiplier * (spinA + spinB);
      totalDmg = Math.min(P.maxDamagePerHit, Math.max(P.minDamagePerHit, totalDmg));
      totalDmg *= P.sustainedDamageScale;

      const perBall = totalDmg * 0.5;
      A.health = Math.max(0, A.health - perBall);
      B.health = Math.max(0, B.health - perBall);

      sustainedDamageMap.set(key, now);
    });
  });

  bindUI();
  resetMatch();
}

let healthUpdateInterval;
// Map for throttling sustained contact damage
const sustainedDamageMap = new Map();

// Staging animation state
let staging = { active:false, closing:false, side:0, targetGap:0 };


function computeSideGeometry(side){
  const R=arena.radius;
  // Calculate hexagon vertices
  const vertices = [];
  for (let i = 0; i < arena.sides; i++) {
    const vertexAngle = arena.rotation + i * (TWO_PI / arena.sides);
    vertices.push({ x: arena.center.x + Math.cos(vertexAngle) * R, y: arena.center.y + Math.sin(vertexAngle) * R });
  }
  const p1 = vertices[side];
  const p2 = vertices[(side + 1) % arena.sides];
  const sideMid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
  const sideAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  // inward normal points toward center
  const vIn = Matter.Vector.normalise(Matter.Vector.sub(arena.center, sideMid));
  const vOut = { x:-vIn.x, y:-vIn.y };
  return { sideMid, sideAngle, vIn, vOut };
}

function updatePulse() {
  if (!pulse.enabled) return;
  if (pulse.anglePerBeat !== Math.PI*2 / pulse.beatsPerRotation) {
    pulse.anglePerBeat = Math.PI*2 / Math.max(1, pulse.beatsPerRotation);
  }
  if (pulse.lastRot == null) {
    pulse.lastRot = arena.rotation;
    return;
  }
  const delta = Math.abs(arena.rotation - pulse.lastRot);
  pulse.lastRot = arena.rotation;
  pulse.phase += delta;
  const step = pulse.anglePerBeat;
  while (pulse.phase >= step) {
    pulse.phase -= step;
    playSound('pulse');
  }
}

function beginStagingAnimation(){
  // Choose the topmost side (smallest midpoint Y) and compute target gap width
  const R=arena.radius; const vertices=[];
  for (let i=0;i<arena.sides;i++){ const ang=arena.rotation + i*(TWO_PI/arena.sides); vertices.push({x:arena.center.x+Math.cos(ang)*R,y:arena.center.y+Math.sin(ang)*R}); }
  let topSide = 0; let bestY = Infinity;
  for (let i=0;i<arena.sides;i++){
    const p1=vertices[i], p2=vertices[(i+1)%arena.sides];
    const midY = (p1.y + p2.y)/2;
    if (midY < bestY){ bestY = midY; topSide = i; }
  }
  const side = topSide;
  staging.side = side; staging.active = true; staging.closing = false;

  // Compute this side's length and set target gap to effectively remove wall
  const p1=vertices[side], p2=vertices[(side+1)%arena.sides];
  const sideLength = Math.hypot(p2.x-p1.x, p2.y-p1.y);
  staging.targetGap = sideLength; // fully open (remove wall)

  arena.gapWidths[side] = 0; // start closed
  buildWalls(false);

  // Compute start positions around a ring
  const n = balls.length;
  const Rring = arena.radius * 0.65;
  const { sideMid, vIn, vOut } = computeSideGeometry(side);

  const newBodies = [];
  for (let i=0;i<n;i++){
    const rb = balls[i];
    const a = -PI/2 + i*(TWO_PI/n);
    const target = { x: arena.center.x + Math.cos(a)*Rring, y: arena.center.y + Math.sin(a)*Rring };

    // Spawn offscreen outward along gap normal
    const spawn = { x: sideMid.x + vOut.x*(arena.radius + 300 + i*6), y: sideMid.y + vOut.y*(arena.radius + 300 + i*6) };
    const body = Bodies.circle(spawn.x, spawn.y, rb.circleRadius, { restitution:P.restitution * rb.restitutionMod, friction:P.ballFriction, frictionAir:P.air, label:'ball' });
    body.speedMod = rb.speedMod;
    body.agilityMod = rb.agilityMod;
    body.healthMod = rb.healthMod;
    body.damageMod = rb.damageMod;
    body.renderColor = rb.renderColor; body.id = rb.id; body.health = rb.health; body.ballName = rb.ballName; body.targetPos = target; body.isStaged=false;
    body.person = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      angle: 0,
      previousVelocity: { x: 0, y: 0 }
    };

    // Temporarily disable collisions and bounce during staging
    body._orig = { mask: body.collisionFilter.mask, isSensor: body.isSensor||false, restitution: body.restitution, air: body.frictionAir };
    body.collisionFilter.mask = 0; // collide with nothing
    body.isSensor = true;
    body.restitution = 0.0;
    body.frictionAir = 0.2;

    // Slight inward nudge
    const speed = 2;
    Body.setVelocity(body, { x: vIn.x * speed, y: vIn.y * speed });
    Body.setAngularVelocity(body, (Math.random() * 2 - 1) * P.ballInitialAngularVelocityMax);

    newBodies.push(body);
  }
  balls = newBodies; if (balls.length) World.add(world, balls);
  // Play ball entering sound as they start entering the arena
  primeSFX(['ballDrop']);
  playSound('ballDrop');
}

function updateStagingAnimation(){
  if (!staging.active) return;
  const side = staging.side;
  // Animate gap opening until fully open
  const gw = arena.gapWidths[side]||0;
  if (!staging.closing && gw < staging.targetGap){ arena.gapWidths[side] = Math.min(staging.targetGap, gw + 10); buildWalls(false); }

  // Guide balls to their target positions and lock them in place
  let allArrived = true;
  for (const b of balls){
    if (b.isStaged) continue;
    const dx = b.targetPos.x - b.position.x, dy = b.targetPos.y - b.position.y;
    const dist = Math.hypot(dx,dy);
    if (dist < 5){
      Body.setPosition(b, b.targetPos);
      Body.setVelocity(b, {x:0,y:0});
      Body.setAngularVelocity(b, 0);
      Body.setStatic(b, true);
      b.isStaged = true;
    } else {
      allArrived = false;
      const dir = (dist>0) ? {x:dx/dist, y:dy/dist} : {x:0,y:0};
      const speed = Math.max(2, Math.min(12, dist * 0.08));
      Body.setVelocity(b, { x: dir.x * speed, y: dir.y * speed });
      Body.setAngularVelocity(b, (b.angularVelocity||0) * 0.95);
    }
  }

  // When all arrived, close the gap fully, then start countdown
  if (allArrived){
    staging.closing = true;
    if (arena.gapWidths[side] > 0){
      arena.gapWidths[side] = Math.max(0, arena.gapWidths[side] - 12);
      buildWalls(false);
    } else {
      // Closed: end staging and begin countdown
      staging.active = false; staging.closing = false;
      gameState='countdown';
      countdownEndAt = millis() + 3000;
      document.getElementById('countdown').style.display='block';
      // Play countdown sequence once at start (the file includes multiple beeps)
      primeSFX(['countdownBeep']);
      playSound('countdownBeep');
    }
  }
}

function updatePeople() {
  for (const b of balls) {
    if (!b.person) continue;

    const person = b.person;
    const r = b.circleRadius;

    // 1. Calculate ball's acceleration (change in velocity)
    const acceleration = {
      x: b.velocity.x - person.previousVelocity.x,
      y: b.velocity.y - person.previousVelocity.y
    };

    // 2. Inertial force (opposite of ball's acceleration)
    const inertial = {
      x: -acceleration.x * 0.5,
      y: -acceleration.y * 0.5
    };

    // 3. Force towards center (like gravity)
    const gravity = {
      x: -person.position.x * 0.01,
      y: -person.position.y * 0.01
    };

    // 4. Update velocity
    person.velocity.x += inertial.x + gravity.x;
    person.velocity.y += inertial.y + gravity.y;

    // 5. Apply damping
    person.velocity.x *= 0.95;
    person.velocity.y *= 0.95;

    // 6. Update position
    person.position.x += person.velocity.x;
    person.position.y += person.velocity.y;

    // 7. Constrain to ball's radius
    const distFromCenter = Math.hypot(person.position.x, person.position.y);
    const maxDist = r * 0.5;
    if (distFromCenter > maxDist) {
      const angle = Math.atan2(person.position.y, person.position.x);
      person.position.x = Math.cos(angle) * maxDist;
      person.position.y = Math.sin(angle) * maxDist;
      person.velocity.x *= -0.5; // Bounce
      person.velocity.y *= -0.5;
    }

    // 8. Update previous velocity for next frame
    person.previousVelocity.x = b.velocity.x;
    person.previousVelocity.y = b.velocity.y;
  }
}

function updateFreePeople() {
  for (let i = freePeople.length - 1; i >= 0; i--) {
    const p = freePeople[i];
    p.position.x += p.velocity.x;
    p.position.y += p.velocity.y;
    p.velocity.y += P.gravityY * 0.5; // a bit of gravity
    p.life -= 0.01;
    if (p.life <= 0) {
      freePeople.splice(i, 1);
    }
  }
}

function preventBallSticking() {
  // Detect balls that are moving very slowly near gap edges and give them a gentle push
  for (const ball of balls) {
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
    
    // Only check balls moving very slowly (potentially stuck)
    if (speed > 0.5) continue;
    
    // Check if ball is near any gap edge
    const ballToCenter = Matter.Vector.sub(ball.position, arena.center);
    const distFromCenter = Matter.Vector.magnitude(ballToCenter);
    
    // Only check balls near the arena edge where gaps exist
    if (distFromCenter < arena.radius * 0.8) continue;
    
    // Check if there's an open gap nearby
    let nearGap = false;
    for (let i = 0; i < arena.sides; i++) {
      if (arena.gapWidths[i] > 0) {
        const sideAngle = arena.rotation + i * (TWO_PI / arena.sides);
        const sideNormal = { x: Math.cos(sideAngle), y: Math.sin(sideAngle) };
        const angleToSide = Math.abs(Math.atan2(ballToCenter.y, ballToCenter.x) - sideAngle);
        
        // If ball is roughly aligned with a gap side (within 30 degrees)
        if (Math.min(angleToSide, TWO_PI - angleToSide) < Math.PI / 6) {
          nearGap = true;
          break;
        }
      }
    }
    
    if (nearGap) {
      // Apply a small outward push to unstick the ball
      const pushDirection = Matter.Vector.normalise(ballToCenter);
      const pushForce = 0.002; // Very gentle push
      Matter.Body.applyForce(ball, ball.position, {
        x: pushDirection.x * pushForce,
        y: pushDirection.y * pushForce
      });
      
      // Add a tiny random velocity to break any perfect equilibrium
      Matter.Body.setVelocity(ball, {
        x: ball.velocity.x + (Math.random() - 0.5) * 0.1,
        y: ball.velocity.y + (Math.random() - 0.5) * 0.1
      });
    }
  }
}

/* ===== Draw loop (manual Engine.update) ===== */
function draw(){
  // Don't draw anything during the betting phase
  if (bettingPhaseActive) {
    // Clear the canvas to black during betting
    background(0);
    return;
  }
  
  // Sub-stepped physics update for better high-speed collision detection
  const dtMs = Math.min(1000/60, deltaTime);
  let maxSpeed = 0;
  for (let i = 0; i < balls.length; i++) {
    const v = balls[i] && balls[i].velocity;
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number') continue;
    const sp = Math.sqrt(v.x*v.x + v.y*v.y);
    if (sp > maxSpeed) maxSpeed = sp;
  }
  const thickness = Math.max(1, arena.wallThickness || 1);
  let minRadius = Infinity;
  for (let i = 0; i < balls.length; i++) {
    const r = balls[i] && balls[i].circleRadius;
    if (typeof r === 'number' && r > 0) minRadius = Math.min(minRadius, r);
  }
  if (!isFinite(minRadius)) minRadius = thickness;
  const travel = maxSpeed * (dtMs / 1000); // pixels traveled during dt
  const maxTravelPerStep = Math.max(1, Math.min(thickness * 0.5, minRadius * 0.45));
  const substeps = Math.max(1, Math.min(10, Math.ceil(travel / maxTravelPerStep)));
  const step = dtMs / substeps;
  for (let s = 0; s < substeps; s++) {
    Engine.update(engine, step);
  }
  updateFreePeople();

  drawSpace();

  if (gameState==='pre'){
    // Keep arena stationary while betting
    updateWallsPose();
    drawArena();
    // In playground mode, show balls even in 'pre' state
    if (playgroundMode && balls.length > 0) {
      drawBalls(true);
    }
  } else if (gameState==='staging'){
    updateWallsPose();
    drawArena(); drawBalls(true);
    updateStagingAnimation();
  } else if (gameState==='countdown'){
    updateWallsPose();
    drawArena(); drawBalls(true);
    const left = Math.max(0, countdownEndAt - millis());
    const n = Math.ceil(left/1000);
    const countdownElement = document.getElementById('countdown');
    const label = (n>0? n : 'DROP').toString();
    // Do not trigger countdown sound on each tick; the audio file contains the sequence
    countdownElement.textContent = label;
    if (left<=0){
      countdownElement.style.display='none';
      dropBalls();
      gameState='playing';
      pulse.lastRot = arena.rotation;
      scheduleGapEvents();
      // Start match timer when arena rotation begins
      if (typeof startMatchTimer === 'function') startMatchTimer();
    }
  } else if (gameState==='playing'){
    const prevRot = arena.rotSpeed;
    arena.rotSpeed = Math.min(arena.rotSpeed + arena.rotAccel, arena.spinMax);
    // Notify when reaching max rotation speed once per match
    if (!window._spinMaxAnnounced && arena.rotSpeed >= arena.spinMax && prevRot < arena.spinMax) {
      window._spinMaxAnnounced = true;
      if (typeof addMatchStatusUpdate === 'function') {
        addMatchStatusUpdate(`Arena reached max spin (${arena.spinMax.toFixed(3)})`, 'spin');
      }
    }
    arena.rotation += arena.rotSpeed;
    updatePulse();
    updateWallsPose();
    updatePeople();
    
    // Anti-sticking mechanism: detect slow balls near gaps and give them a gentle push
    preventBallSticking();

    if (arena.widening){
      let any=false; const targetLen=Math.cos(PI/6)*2*arena.radius;
      for (let i=0;i<arena.sides;i++){
        if (arena.gapWidths[i] > 0 && arena.gapWidths[i] < targetLen){ arena.gapWidths[i] = Math.min(targetLen, arena.gapWidths[i] + P.widenRate); any=true; }
      }
      if (any) buildWalls(false);
    }

    drawArena(); drawBalls(false); drawFreePeople();
    cullExplodeAndWin();
  } else if (gameState==='slowing') {
    // Smoothly slow down arena rotation and close gaps
    if (!window._arenaSlowdown) window._arenaSlowdown = { active:true, t:0 };
    const slowdown = window._arenaSlowdown;
    slowdown.t += 1;
    // Slow rotSpeed
    arena.rotSpeed *= 0.96;
    if (arena.rotSpeed < 0.01) arena.rotSpeed = 0;
    arena.rotation += arena.rotSpeed;
    updatePulse();
    // Close all gaps
    let allClosed = true;
    for (let i=0;i<arena.sides;i++) {
      if (arena.gapWidths[i] > 0) {
        arena.gapWidths[i] = Math.max(0, arena.gapWidths[i] - 10);
        allClosed = false;
      }
    }
    buildWalls(false);
    updateWallsPose();
    updatePeople();
    drawArena(); drawBalls(false); drawFreePeople();
    if (arena.rotSpeed === 0 && allClosed) {
      gameState = 'gameover';
    }
  } else { // gameover
    drawArena();
    drawBalls(false);
    drawFreePeople();
  }

  const open = arena.gapsOpened;
  const cd = (arena.gapsOpened<arena.sides && gameState==='playing') ? Math.max(0, Math.ceil((arena.nextGapAt - millis())/1000)) : 0;
  document.getElementById('hud').textContent =
    `Competitors: ${balls.length} • Gaps: ${open}/6` +
    (gameState==='playing' && cd > 0 ? ` • Next gap: ${cd}s` : '') +
    ` • Spin: ${arena.rotSpeed.toFixed(3)} • gY: ${engine.gravity.y.toFixed(2)}`;

  drawFX();
}




/* ===== Reset / Spawn ===== */
function resetMatch(){
  // Reset match timer
  if (typeof resetMatchTimer === 'function') resetMatchTimer();
  
  // Reset UI to pre-match state
  if (typeof setMatchPhaseUI === 'function') {
    setMatchPhaseUI(false);
  }
  
  document.querySelectorAll('.centerBanner').forEach(el => el.remove());
  World.clear(world,false);
  Engine.clear(engine);
  playSound('gameStart');

  balls=[];
  freePeople=[];
  walls=new Array(arena.sides).fill(null).map(()=>[null,null]);
  gameState='pre';
  camera={zoom:1,targetZoom:1,slowmo:1,targetSlowmo:1};

  arena.rotation=0; arena.rotSpeed=P.spinStart;
  arena.gapOrder = shuffleArray([...Array(arena.sides).keys()]);
  arena.gapsOpened=0; arena.gapWidths=new Array(arena.sides).fill(0);
  arena.widening=false;

  spawnBallsStaged(P.ballCount);
  const maxR = Math.max(...balls.map(b=>b.circleRadius));
  arena.baseGapWidth = Math.ceil(maxR*2 + P.gapMargin);

  buildWalls(false);

  // Reset pulse beat state
  pulse.phase = 0;
  pulse.lastRot = null;
  pulse.anglePerBeat = Math.PI*2 / Math.max(1, pulse.beatsPerRotation);

  impacts=[]; sparks=[];
  selectedBallId=null; selectedStake=0; lockedBet=null; selectedBallId2=null; staging.active=false;
  // Also reset new stake/bet-selection globals used by UI
  if (typeof currentSelectedStake !== 'undefined') currentSelectedStake = 0;
  if (typeof currentSelectedBalls !== 'undefined') currentSelectedBalls = [];
  // Clear stake button highlight
  document.querySelectorAll('#bettingControls .stake-buttons .btn').forEach(b => b.classList.remove('selected-stake'));
  // Reset betting round state
  bets = []; finishingOrder = [];
  updateBetUI();
  if (typeof updateBetSlip==='function') updateBetSlip();
  if (typeof recomputeBallStakeTotals==='function') recomputeBallStakeTotals();

  document.getElementById('preMsg').style.display = 'block';
  document.getElementById('countdown').style.display='none';

  // Clear existing interval if any
  if (healthUpdateInterval) {
    clearInterval(healthUpdateInterval);
  }
  // Start timed health display update
  healthUpdateInterval = setInterval(updateBallHealthDisplay, 3000); // Update every 3 seconds
}

/* ===== Tournament Management ===== */
// Tournament code moved to tournament.js for better organization

/* ===== Balls: staged ring → drop ===== */
function generateBallRoster(n = P.ballCount) {
  // Generate ball roster data only (no UI or physics bodies)
  const shuffledNames = shuffleArray([...BALL_NAMES]);
  balls = [];

  for (let i = 0; i < n; i++) {
    const size = P.ballMin + Math.random() * (P.ballMax - P.ballMin);
    const radius = Math.max(10, Math.min(size/2, 22)); // clamp radius to avoid oversized balls

    // Dynamic modifiers based on size
    const sizeNorm = (radius - P.ballMin/2) / ((P.ballMax/2) - (P.ballMin/2)); // 0=small, 1=large
    const speedMod = 1.2 - 0.4 * sizeNorm; // 1.2 for smallest, 0.8 for largest
    const agilityMod = 1.2 - 0.4 * sizeNorm;
    const healthMod = 0.7 + 0.6 * sizeNorm; // 0.7 for smallest, 1.3 for largest
    const damageMod = 0.7 + 0.6 * sizeNorm;
    const restitutionMod = 1.1 - 0.2 * sizeNorm; // bouncier for small
    
    const rosterBall = {
      id: i,
      circleRadius: radius,
      renderColor: COLORS[i % COLORS.length],
      health: Math.round(P.ballMaxHealth * healthMod),
      ballName: shuffledNames[i % shuffledNames.length],
      speedMod,
      agilityMod,
      healthMod,
      damageMod,
      restitutionMod
    };
    balls.push(rosterBall);
  }
}

function spawnBallsStaged(n){
  // Build roster only (no physics bodies in the arena during betting)
  const ballHealthDisplay = document.getElementById('ballHealthDisplay');
  // Preserve betting controls; remove previous health entries only
  const oldEntries = ballHealthDisplay.querySelectorAll('.ball-health-entry');
  oldEntries.forEach(el => el.remove());

  balls = [];

  if (tournament.active && tournament.currentMatch > 0) {
    // Tournament mode: use specific participants for this match
    const participantIds = tournament.participantHistory[tournament.currentMatch - 1] || [];
    const shuffledNames = shuffleArray([...BALL_NAMES]);
    
    for (let i = 0; i < participantIds.length; i++) {
      const ballId = participantIds[i];
      const ballStats = tournament.ballStats[ballId] || {};
      
      // Use consistent ball properties based on ID
      const size = P.ballMin + (ballId / 12) * (P.ballMax - P.ballMin); // Deterministic size based on ID
      const radius = Math.max(10, Math.min(size/2, 22));

      // Dynamic modifiers based on size
      const sizeNorm = (radius - P.ballMin/2) / ((P.ballMax/2) - (P.ballMin/2));
      const speedMod = 1.2 - 0.4 * sizeNorm;
      const agilityMod = 1.2 - 0.4 * sizeNorm;
      const healthMod = 0.7 + 0.6 * sizeNorm;
      const damageMod = 0.7 + 0.6 * sizeNorm;
      const restitutionMod = 1.1 - 0.2 * sizeNorm;
      
      const rosterBall = {
        id: ballId,
        circleRadius: radius,
        renderColor: COLORS[ballId % COLORS.length],
        health: ballStats.health || Math.round(P.ballMaxHealth * healthMod),
        ballName: shuffledNames[ballId % shuffledNames.length],
        speedMod,
        agilityMod,
        healthMod,
        damageMod,
        restitutionMod,
        seeding: ballStats.seeding || ballId + 1
      };
      balls.push(rosterBall);
    }
  } else {
    // Normal mode: generate random balls
    const shuffledNames = shuffleArray([...BALL_NAMES]);
    
    for (let i=0;i<n;i++){
      const size = P.ballMin + Math.random() * (P.ballMax - P.ballMin);
      const radius = Math.max(10, Math.min(size/2, 22)); // clamp radius to avoid oversized balls

      // Dynamic modifiers based on size
      const sizeNorm = (radius - P.ballMin/2) / ((P.ballMax/2) - (P.ballMin/2)); // 0=small, 1=large
      // Small balls: fast, agile, low health/damage; Large balls: slow, strong, high health/damage
      const speedMod = 1.2 - 0.4 * sizeNorm; // 1.2 for smallest, 0.8 for largest
      const agilityMod = 1.2 - 0.4 * sizeNorm;
      const healthMod = 0.7 + 0.6 * sizeNorm; // 0.7 for smallest, 1.3 for largest
      const damageMod = 0.7 + 0.6 * sizeNorm;
      const restitutionMod = 1.1 - 0.2 * sizeNorm; // bouncier for small
      const rosterBall = {
        id: i,
        circleRadius: radius,
        renderColor: COLORS[i%COLORS.length],
        health: Math.round(P.ballMaxHealth * healthMod),
        ballName: shuffledNames[i % shuffledNames.length],
        speedMod,
        agilityMod,
        healthMod,
        damageMod,
        restitutionMod
      };
      balls.push(rosterBall);
    }
  }

  // Create UI elements for all balls
  balls.forEach(rosterBall => {
    const ballEntry = document.createElement('div');
    ballEntry.id = `ball-health-${rosterBall.id}`;
    ballEntry.className = 'ball-health-entry';
    ballEntry.dataset.id = String(rosterBall.id);
    
    // Add seeding indicator for tournament mode
    const seedingText = tournament.active && rosterBall.seeding ? ` (#${rosterBall.seeding})` : '';
    
    ballEntry.innerHTML = `
      <canvas class="ball-canvas" width="28" height="28" style="border-radius:50%; background:transparent;"></canvas>
      <span class="ball-name">${rosterBall.ballName}${seedingText}</span>
      <span class="ball-odds">—</span>
      <div class="health-bar-container">
        <div class="health-bar"></div>
      </div>
      <span class="ball-stake-column"></span>
    `;
    ballHealthDisplay.appendChild(ballEntry);

    // Draw the mini ball on its canvas
    const cvs = ballEntry.querySelector('canvas');
    if (cvs){
      const ctx = cvs.getContext('2d');
      const r = 12; // visual radius for UI icon
      ctx.clearRect(0,0,28,28);
      ctx.save();
      ctx.translate(14,14);
      ctx.fillStyle = rosterBall.renderColor;
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0,0,r*1.3,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  });

  // Click selection on entries for betting
  ballHealthDisplay.onclick = (e)=>{
    // Skip betting functionality in playground mode
    if (playgroundMode) return;
    
    const entry = e.target.closest('.ball-health-entry');
    if (!entry) return;
    const id = parseInt(entry.dataset.id,10);
    const betType = (document.getElementById('betType')||{}).value || BET_TYPES.WIN;

    // If a stake is selected, handle ball selection for betting
    if (currentSelectedStake > 0) {
      playSound('buttonClick'); // Play sound on ball selection

      if (betType === BET_TYPES.WIN || betType === BET_TYPES.TOP3) {
        // For WIN/TOP3, immediately place a bet on the clicked ball
        currentSelectedBalls = [id];
        updateBetUI();
        addBetFromSelection({ keepStake: true });
        return;
      } else if (betType === BET_TYPES.EXACTA || betType === BET_TYPES.QUINELLA) {
        // For EXACTA/QUINELLA, build a pair then place bet automatically when two are selected
        if (currentSelectedBalls.includes(id)) {
          // Deselect if already selected
          currentSelectedBalls = currentSelectedBalls.filter(ballId => ballId !== id);
        } else if (currentSelectedBalls.length < 2) {
          // Select if less than two are selected
          currentSelectedBalls.push(id);
        } else {
          // If two are already selected, replace the first one
          currentSelectedBalls = [currentSelectedBalls[1], id];
        }
        updateBetUI();
        if (currentSelectedBalls.length === 2 && currentSelectedBalls[0] !== currentSelectedBalls[1]) {
          addBetFromSelection({ keepStake: true });
        }
        return;
      }
    } else {
      // If no stake is selected, just update the UI for visual selection without placing a bet
      if (betType === BET_TYPES.WIN || betType === BET_TYPES.TOP3) {
        currentSelectedBalls = [id];
      } else if (betType === BET_TYPES.EXACTA || betType === BET_TYPES.QUINELLA) {
        if (currentSelectedBalls.includes(id)) {
          currentSelectedBalls = currentSelectedBalls.filter(ballId => ballId !== id);
        } else if (currentSelectedBalls.length < 2) {
          currentSelectedBalls.push(id);
        } else {
          currentSelectedBalls = [currentSelectedBalls[1], id];
        }
      }
    }
    updateBetUI(); // Update UI to reflect selected balls and odds
  };
}
function dropBalls(){
  // Release staged balls from their positions and restore physics
  for (const b of balls){
    Body.setStatic(b, false);
    if (b.targetPos) Body.setPosition(b, b.targetPos);

    // Restore collision and physics params
    if (b._orig){
      b.collisionFilter.mask = b._orig.mask;
      b.isSensor = b._orig.isSensor;
      b.restitution = b._orig.restitution;
      b.frictionAir = b._orig.air;
      b._orig = null;
    } else {
      b.collisionFilter.mask = 0xFFFFFFFF;
      b.isSensor = false;
      b.restitution = P.restitution;
      b.frictionAir = P.air;
    }

    const sp = P.dropKick;
    Body.setVelocity(b, { 
      x: (Math.random() * 2 - 1) * sp * (b.speedMod || 1), 
      y: (Math.random() - 0.5) * sp * (b.speedMod || 1) 
    });

    if (P.tanPush !== 0) {
      const vecToBall = Matter.Vector.sub(b.position, arena.center);
      const tangentialVec = Matter.Vector.normalise({ x: -vecToBall.y, y: vecToBall.x });
      Matter.Body.applyForce(b, b.position, {
        x: tangentialVec.x * P.tanPush * (b.agilityMod || 1),
        y: tangentialVec.y * P.tanPush * (b.agilityMod || 1)
      });
    }

    Body.setAngularVelocity(b, (Math.random() * 2 - 1) * P.ballInitialAngularVelocityMax * (b.agilityMod || 1));
    b.isStaged=false;
  }
}

/* ===== Gaps ===== */
function scheduleGapEvents(){
  let t = arena.firstGapDelay;
  arena.nextGapAt = millis() + t;
  for (let k=0;k<arena.sides;k++){
    setTimeout(()=>{
      if (gameState!=='playing') return;
      arena.gapsOpened = Math.min(arena.gapsOpened+1, arena.sides);
      const side = arena.gapOrder[arena.gapsOpened-1];
      const sideLen = Math.cos(PI/6)*2*arena.radius;
      arena.gapWidths[side] = Math.min(sideLen, Math.ceil(arena.baseGapWidth));
      buildWalls(false);
      playSound('gapOpen'); // Play sound when a gap opens
      if (typeof addMatchStatusUpdate === 'function') {
        addMatchStatusUpdate(`Gap opened on side ${side+1}`, 'gap');
      }
      if (arena.gapsOpened===arena.sides){
        arena.widening = true;
        if (typeof addMatchStatusUpdate === 'function') {
          addMatchStatusUpdate('All gaps opened — widening', 'gap');
        }
      }
      else { arena.nextGapAt = millis() + arena.gapInterval; }
    }, t);
    t += arena.gapInterval;
  }
}

/* ===== Walls (two segments per side; we move/rotate them every frame) ===== */
function buildWalls(repositionOnly=false){
  if (!repositionOnly){
    for (const pair of walls){
      if (!pair) continue;
      for (const seg of pair){ if (seg) World.remove(world, seg); }
    }
    walls = new Array(arena.sides).fill(null).map(()=>[null,null,null,null]);
  }
  const R=arena.radius, t=arena.wallThickness;
  const MIN_LEN = 10;

  // Calculate hexagon vertices
  const vertices = [];
  for (let i = 0; i < arena.sides; i++) {
    const vertexAngle = arena.rotation + i * (TWO_PI / arena.sides);
    vertices.push({
      x: arena.center.x + Math.cos(vertexAngle) * R,
      y: arena.center.y + Math.sin(vertexAngle) * R
    });
  }

  for (let i=0;i<arena.sides;i++){
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % arena.sides];

    const sideMidX = (p1.x + p2.x) / 2;
    const sideMidY = (p1.y + p2.y) / 2;
    const sideLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sideAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const gap = Math.min(arena.gapWidths[i]||0, sideLength);
    const keep = Math.max(0, sideLength - gap);
    let leftLen = keep / 2, rightLen = keep / 2;

    if (leftLen < MIN_LEN) leftLen = 0;
    if (rightLen < MIN_LEN) rightLen = 0;

    // inward normal from side midpoint to center (unit)
    const toCx = arena.center.x - sideMidX;
    const toCy = arena.center.y - sideMidY;
    const invMag = 1 / Math.max(1e-6, Math.hypot(toCx, toCy));
    const vInX = toCx * invMag;
    const vInY = toCy * invMag;

    const innerOff = t + 8; // Increased inner offset to reduce sticking

    const mk=(len, sg, segIdx, off=0)=>{
      if(len<MIN_LEN) return null;
      // Calculate position of segment relative to side midpoint, then offset inward
      const baseX = sideMidX + Math.cos(sideAngle) * (gap/2 + len/2) * sg;
      const baseY = sideMidY + Math.sin(sideAngle) * (gap/2 + len/2) * sg;
      const segX = baseX + vInX * off;
      const segY = baseY + vInY * off;
      
      // Reduce friction for inner wall segments to prevent sticking at gap edges
      const friction = off > 0 ? P.wallFriction * 0.3 : P.wallFriction;
      const wall = Bodies.rectangle(segX, segY, len, t, {
        isStatic: true,
        angle: sideAngle,
        label: 'wall',
        isPanelSeg: true, 
        friction: friction,
        frictionStatic: friction, 
        restitution: P.wallRestitution
      });
      wall.wallSide = i; wall.wallSeg = segIdx;
      wall._len = len; wall._innerOffset = off;
      return wall;
    };
    
    if (repositionOnly) {
        // This path is not currently used by logic, but for safety:
        // if (walls[i][0]) Body.setVertices(walls[i][0], ...);
        // if (walls[i][1]) Body.setVertices(walls[i][1], ...);
    } else {
        const L = mk(leftLen, -1, 0, 0);
        const Rr = mk(rightLen, +1, 1, 0);
        const L2 = mk(leftLen, -1, 2, innerOff);
        const R2 = mk(rightLen, +1, 3, innerOff);
        walls[i] = [L||null, Rr||null, L2||null, R2||null];
        const add = walls[i].filter(Boolean); if(add.length) World.add(world, add);
    }
  }
}

function updateWallsPose(){
  const R=arena.radius, t=arena.wallThickness;

  // Calculate hexagon vertices
  const vertices = [];
  for (let i = 0; i < arena.sides; i++) {
    const vertexAngle = arena.rotation + i * (TWO_PI / arena.sides);
    vertices.push({
      x: arena.center.x + Math.cos(vertexAngle) * R,
      y: arena.center.y + Math.sin(vertexAngle) * R
    });
  }

  for (let i=0;i<arena.sides;i++){
    const pair=walls[i]; if(!pair) continue;

    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % arena.sides];

    const sideMidX = (p1.x + p2.x) / 2;
    const sideMidY = (p1.y + p2.y) / 2;
    const sideLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sideAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const gap=Math.min(arena.gapWidths[i]||0, sideLength), keep=Math.max(0, sideLength-gap);
    let leftLen=keep/2, rightLen=keep/2;

    // inward normal from side midpoint to center (unit)
    const toCx = arena.center.x - sideMidX;
    const toCy = arena.center.y - sideMidY;
    const invMag = 1 / Math.max(1e-6, Math.hypot(toCx, toCy));
    const vInX = toCx * invMag;
    const vInY = toCy * invMag;

    const innerOff = arena.wallThickness + 4;
    
    const place=(seg,len,sg)=>{
      if(!seg || len<=1) return;
      const baseX = sideMidX + Math.cos(sideAngle) * (gap/2 + len/2) * sg;
      const baseY = sideMidY + Math.sin(sideAngle) * (gap/2 + len/2) * sg;
      Body.setPosition(seg,{x:baseX,y:baseY}); Body.setAngle(seg,sideAngle);
    };
    const placeInner=(seg,len,sg)=>{
      if(!seg || len<=1) return;
      const baseX = sideMidX + Math.cos(sideAngle) * (gap/2 + len/2) * sg;
      const baseY = sideMidY + Math.sin(sideAngle) * (gap/2 + len/2) * sg;
      const segX = baseX + vInX * innerOff;
      const segY = baseY + vInY * innerOff;
      Body.setPosition(seg,{x:segX,y:segY}); Body.setAngle(seg,sideAngle);
    };

    place(pair[0], leftLen, -1); place(pair[1], rightLen, +1);
    placeInner(pair[2], leftLen, -1); placeInner(pair[3], rightLen, +1);
  }
}

/* ===== Betting / Start ===== */
function onStartMatch(){
  playSound('buttonClick'); // Play sound on start match button click
  
  // Handle different modes appropriately
  if (playgroundMode) {
    // In playground mode, start the arena directly
    startPlaygroundArena();
    return;
  }
  
  // Exit betting phase if active
  if (bettingPhaseActive && typeof exitBettingPhase === 'function') {
    exitBettingPhase();
  }
  
  // Switch to match phase UI
  if (typeof setMatchPhaseUI === 'function') {
    setMatchPhaseUI(true);
  }
  
  // New start flow: staging phase before countdown
  if (typeof Telemetry !== 'undefined' && Telemetry.startMatch) {
    Telemetry.startMatch((Array.isArray(balls)?balls.length:0)||P.ballCount||12, (window.Settings?.load?.()?.difficulty)||'Balanced');
  }
  beginStagingAnimation();
  gameState='staging';
  document.getElementById('preMsg').style.display='none';
  document.getElementById('countdown').style.display='none';
  updateBetUI();
}

function mousePressed(){
  // Selection is handled via the health panel during betting
  return;
}

function setStake(v){ const val = Math.min(Math.max(0, Math.floor(v)), bankroll); selectedStake = val; if (typeof currentSelectedStake !== 'undefined') currentSelectedStake = val; updateBetUI(); }
function calcOdds(){ const n=Math.max(2,P.ballCount); return Math.max(1.5, +(n*0.9).toFixed(2)); }


/* ===== Culling + Explosions + Win ===== */
function cullExplodeAndWin(){
  const survivors=[]; const toExplode=[];
  const cullRadius = arena.radius + arena.wallThickness / 2;
  for (const b of balls){
    const distFromCenter = Math.hypot(b.position.x - arena.center.x, b.position.y - arena.center.y);

    // Check for culling (leaving arena) OR health <= 0
    if (distFromCenter > cullRadius || b.position.y > height + 120 || b.health <= 0) {
      toExplode.push(b);
      // Remove UI element when ball is marked for explosion/culling
      const ballEntry = document.getElementById(`ball-health-${b.id}`);
      if (ballEntry) { ballEntry.remove(); }
    } else { survivors.push(b); }
  }
  if (toExplode.length){
    for (const b of toExplode){
      if (b.person) {
        const freePerson = {
          position: {
            x: b.position.x + b.person.position.x,
            y: b.position.y + b.person.position.y
          },
          velocity: {
            x: b.velocity.x + b.person.velocity.x,
            y: b.velocity.y + b.person.velocity.y
          },
          id: b.id,
          circleRadius: b.circleRadius, // for size reference
          life: 1.0 // for fade out
        };
        freePeople.push(freePerson);
      }
      addExplosion(b.position.x, b.position.y);
      playSound('explosion'); // Play sound on ball explosion
      World.remove(world,b);
      // Track elimination order for settlement (id order)
      if (!finishingOrder.includes(b.id)) finishingOrder.push(b.id);
      // Log elimination to status panel
      if (typeof addMatchStatusUpdate === 'function') {
        const name = b.ballName ? b.ballName : `#${b.id+1}`;
        addMatchStatusUpdate(`Eliminated: ${name}`, 'elim');
        // Per-bet status updates
        if (Array.isArray(bets)) {
          for (const bet of bets) {
            if (!bet || !bet.type || !Array.isArray(bet.ids)) continue;
            const id0 = bet.ids[0];
            if ((bet.type === 'WIN' || bet.type === 'TOP3' || bet.type === 'MATCH_WIN') && id0 === b.id) {
              addMatchStatusUpdate(`Bet lost: ${bet.type} on ${name}`, 'elim');
            } else if ((bet.type === 'EXACTA' || bet.type === 'QUINELLA') && bet.ids.includes(b.id)) {
              const otherId = bet.ids.find(x=>x!==b.id);
              const otherBall = balls.find(x=>x.id===otherId);
              const otherName = otherBall ? (otherBall.ballName||`#${otherBall.id+1}`) : `#${(otherId??0)+1}`;
              addMatchStatusUpdate(`Bet lost: ${bet.type} on ${name} & ${otherName}`, 'elim');
            } else if (bet.type === 'MATCH_ELIMINATION' && id0 === b.id) {
              addMatchStatusUpdate(`ELIM bet hit on ${name}`, 'payout');
            }
          }
        }
      }
    }
    balls = survivors;
    // Update header counts after eliminations
    if (typeof updateMatchStatusHeaderEnhanced === 'function') updateMatchStatusHeaderEnhanced();
  }

  if (gameState==='playing'){
    if (balls.length<=1){
      gameState='slowing'; // Enter slowdown animation
      // Stop match timer when winner is declared
      if (typeof stopMatchTimer === 'function') stopMatchTimer();
      // Play game over headline sound, then schedule win/lose after brief delay to ensure it is heard
      playSound('gameOver');
      const winner = balls[0]||null;
      let msg='';
      if (winner){
      if (!finishingOrder.includes(winner.id)) finishingOrder.push(winner.id);

      // Process tournament if active
        if (tournament.active) {
          processTournamentMatchEnd();
          // Settle match-level bets even in tournament mode
          const summary = settleBetsAndPayout();
          // Different message for tournament mode
          if (tournament.currentMatch > tournament.totalMatches) {
            // Tournament just completed
            msg = `🏆 TOURNAMENT CHAMPION: <span style=\"color:${winner.renderColor}\">${winner.ballName}</span>`;
          } else {
            // Regular tournament match
            msg = `🏆 Match ${tournament.currentMatch - 1} Winner: <span style=\"color:${winner.renderColor}\">${winner.ballName}</span>`;
          }
          if (summary && summary !== 'Spectator round — no bet placed') {
            msg += `<div class=\"sub\">${summary}</div>`;
          }
        } else {
          // Normal mode
          const summary = settleBetsAndPayout();
          msg = `🏆 Winner: <span style=\"color:${winner.renderColor}\">#${winner.id+1}</span>` +
                (summary ? `<div class=\"sub\">${summary}</div>` : '');
        }
        setTimeout(()=>playSound('win'), 200);
      } else {
        if (tournament.active) {
          msg=`Match ${tournament.currentMatch} - No survivors<div class=\"sub\">Match void</div>`;
        } else {
          msg=`No survivors<div class=\"sub\">House keeps all bets</div>`;
        }
        setTimeout(()=>playSound('lose'), 200);
      }
      // Log winner to status panel
      if (typeof addMatchStatusUpdate === 'function') {
        if (winner) {
          const wname = winner.ballName ? winner.ballName : `#${winner.id+1}`;
          addMatchStatusUpdate(`Winner: ${wname}`, 'winner');
        } else {
          addMatchStatusUpdate('Match ended with no survivors', 'winner');
        }
      }
      // Telemetry end and potential auto-tune
      if (typeof Telemetry !== 'undefined' && Telemetry.endMatch) {
        const entry = Telemetry.endMatch(winner?.id);
        if (entry && typeof addMatchStatusUpdate === 'function') {
          const { avg, count } = Telemetry.statsLastN(10);
          addMatchStatusUpdate(`Telemetry: duration ${entry.duration}s (avg ${avg?avg.toFixed(1):'?'}s over ${count})`, 'payout');
        }
        if (Telemetry.maybeAutoTune) Telemetry.maybeAutoTune();
      }
      showBanner(msg);
      // Mark slowdown start
      window._arenaSlowdown = { active:true, t:0 };
    }
  }
}

function settleBetsAndPayout(){
  if (!Array.isArray(bets) || bets.length===0) { lastBets = []; return 'Spectator round — no bet placed'; }
  // First (winner) is last element; second is second last.
  const n = finishingOrder.length;
  const first = finishingOrder[n-1];
  const second = finishingOrder[n-2];
  const top3 = finishingOrder.slice(Math.max(0, n-3));
  let payout = 0; let winners = 0; let losers = 0;
  let winningBets = []; let losingBets = [];
  
  for (const b of bets){
    let won=false;
    if (tournament.active && b.type === 'MATCH_WIN'){
      won = (b.ids[0]===first);
    } else if (tournament.active && b.type === 'MATCH_ELIMINATION'){
      const eliminated = finishingOrder.length > 0 ? finishingOrder.slice(0, -1) : finishingOrder;
      won = eliminated.includes(b.ids[0]);
    } else if (b.type==='WIN'){
      won = (b.ids[0]===first);
    } else if (b.type==='TOP3'){
      won = top3.includes(b.ids[0]);
    } else if (b.type==='EXACTA'){
      won = (b.ids[0]===first && b.ids[1]===second);
    } else if (b.type==='QUINELLA'){
      won = (b.ids.includes(first) && b.ids.includes(second));
    }
    
    if (won){
      const w = Math.floor(b.stake * b.odds);
      payout += w; winners++;
      winningBets.push({
        type: b.type,
        stake: b.stake,
        winnings: w,
        ballIds: b.ids,
        odds: b.odds
      });
    } else {
      losers++;
      losingBets.push({
        type: b.type,
        stake: b.stake,
        ballIds: b.ids,
        odds: b.odds
      });
    }
  }
  
  if (payout>0){ bankroll += payout; persistBankroll(); }
  lastBets = bets.map(x=>({...x}));
  bets = []; // clear current round bets
  if (typeof updateBetSlip==='function') updateBetSlip();
  if (typeof recomputeBallStakeTotals==='function') recomputeBallStakeTotals();
  updateBankrollUI();
  if (typeof updateMatchStatusHeaderEnhanced === 'function') updateMatchStatusHeaderEnhanced();
  
  // Create detailed results summary
  let summary = '';
  if (winners > 0) {
    summary = `Payout £${numberWithCommas(payout)} across ${winners} winning bet(s)`;
    if (losers > 0) {
      summary += ` • ${losers} bet(s) lost`;
    }
  } else {
    summary = 'All bets lost';
  }
  
  // Store detailed results for display
  window.lastMatchResults = {
    winningBets,
    losingBets,
    totalPayout: payout,
    totalWinners: winners,
    totalLosers: losers
  };
  // Log payout summary to status panel
  if (typeof addMatchStatusUpdate === 'function') {
    addMatchStatusUpdate(summary);
  }
  
  // Log payout summary to status panel
  if (typeof addMatchStatusUpdate === 'function') {
    addMatchStatusUpdate(summary, 'payout');
  }
  return summary;
}
