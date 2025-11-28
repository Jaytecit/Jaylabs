// ===== DEFENDER: NEON ETERNITY — REFACTORED ENGINE =====

// --- CONFIGURATION ---
const WORLD_LEN = 6000; // Total world width
const VIEW_H = 800;     // Internal logic height
const STARS_COUNT = 200;
const GRAVITY = 0.25;
const RESPAWN_DELAY = 90; // Frames to wait before the new ship appears
const INVULN_AFTER_RESPAWN = 120;
const MAX_PLAYER_LASERS = 5;
const LASER_SPEED = 52;
const LASER_LIFE = 28;
const SHOW_SCANNER_BEAM = false;

// --- COLORS ---
const C = {
  sky: '#05060a',
  player: '#fff',
  laser: '#22f2ff',
  human: '#67ff7f',
  lander: '#22ff22',
  mutant: '#ff2bd6',
  bomber: '#4466ff',
  baiter: '#ff4d4d',
  pod: '#ffaa00',
  mine: '#ffffff',
  terrain: '#2a2e45'
};

// --- AUDIO ENGINE (Procedural) ---
// No external assets required. Generates sounds using WebAudio API.
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let bgMusicBuffer = null;
  let bgMusicSource = null;
  let bgMusicLoading = null;
  let bgMusicRequested = false;
  let bgMusicFallback = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }

  async function loadMusicBuffer() {
    if (bgMusicBuffer) return bgMusicBuffer;
    if (bgMusicLoading) return bgMusicLoading;
    bgMusicLoading = fetch('Defendorks.mp3')
      .then(res => res.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        bgMusicBuffer = decoded;
        return decoded;
      })
      .finally(() => { bgMusicLoading = null; });
    return bgMusicLoading;
  }

  async function startMusic() {
    bgMusicRequested = true;
    if (!ctx) init();
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = await loadMusicBuffer();
      if (!bgMusicRequested || bgMusicSource) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0.45;
      source.connect(gain).connect(master);
      source.start(0);
      bgMusicSource = source;
      source.onended = () => {
        if (bgMusicSource === source) bgMusicSource = null;
      };
      return;
    } catch (e) {
      // Fallback to HTMLAudio if decoding fails (rare)
      if (!bgMusicFallback) {
        bgMusicFallback = new Audio('Defendorks.mp3');
        bgMusicFallback.loop = true;
        bgMusicFallback.volume = 0.45;
      }
      if (bgMusicFallback.paused) {
        bgMusicFallback.currentTime = 0;
        bgMusicFallback.play().catch(() => {});
      }
    }
  }

  function stopMusic() {
    bgMusicRequested = false;
    if (bgMusicSource) {
      try { bgMusicSource.stop(); } catch {}
      try { bgMusicSource.disconnect(); } catch {}
      bgMusicSource = null;
    }
    if (bgMusicFallback && !bgMusicFallback.paused) bgMusicFallback.pause();
  }

  function playTone(freq, type, dur, slide = 0, vol = 1) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq + slide, ctx.currentTime + dur);
    
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol = 1) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
    
    noiseSrc.connect(gain);
    gain.connect(master);
    noiseSrc.start();
  }

  return {
    init,
    startMusic,
    stopMusic,
    shoot: () => playTone(1200, 'sawtooth', 0.15, -800, 0.5),
    explosion: () => noise(0.4, 0.8),
    jump: () => playTone(150, 'square', 0.2, 600, 0.4),
    pickup: () => { playTone(800, 'sine', 0.1, 400, 0.6); setTimeout(()=>playTone(1200, 'sine', 0.2, 0, 0.6), 100); },
    start: () => { playTone(220, 'triangle', 0.5, 0, 0.5); setTimeout(()=>playTone(440, 'triangle', 1.0, 0, 0.5), 200); },
    humanDie: () => playTone(300, 'sawtooth', 0.4, -200, 0.7),
    bomb: () => { noise(1.0, 1.0); playTone(50, 'sawtooth', 1.0, -20, 1.0); }
  };
})();

// --- INPUT SYSTEM ---
const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false, right: false },
  pad: { x: 0, y: 0, fire: false, bomb: false, connected: false, index: null }
};

window.addEventListener('keydown', e => Input.keys[e.code] = true);
window.addEventListener('keyup', e => Input.keys[e.code] = false);
window.addEventListener('mousedown', e => {
  AudioSys.init();
  if(e.button === 0) Input.mouse.down = true;
  if(e.button === 2) Input.mouse.right = true;
});
window.addEventListener('mouseup', e => {
  if(e.button === 0) Input.mouse.down = false;
  if(e.button === 2) Input.mouse.right = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());

// Touch bindings (thumbstick style)
const mobileInput = { active:false, x:0, y:0 };
const updateMobileVec = (dx, dy, radius) => {
  const dist = Math.min(Math.hypot(dx, dy), radius);
  const ang = Math.atan2(dy, dx);
  const nx = Math.cos(ang) * dist;
  const ny = Math.sin(ang) * dist;
  mobileInput.x = nx / radius;
  mobileInput.y = ny / radius;
};
(() => {
  const stick = document.getElementById('touchStick');
  const knob = document.getElementById('touchKnob');
  const btnFire = document.getElementById('btnFire');
  const btnBomb = document.getElementById('btnBomb');
  if (!stick || !knob) return;
  const radius = 60;
  let activeId = null;
  const setKnob = (dx, dy) => {
    const dist = Math.min(Math.hypot(dx, dy), radius);
    const ang = Math.atan2(dy, dx);
    const nx = Math.cos(ang) * dist;
    const ny = Math.sin(ang) * dist;
    knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    updateMobileVec(nx, ny, radius);
    Input.keys['ArrowLeft'] = mobileInput.x < -0.2;
    Input.keys['ArrowRight'] = mobileInput.x > 0.2;
    Input.keys['ArrowUp'] = mobileInput.y < -0.2;
    Input.keys['ArrowDown'] = mobileInput.y > 0.2;
  };
  const clearStick = () => {
    activeId = null;
    knob.style.transform = 'translate(-50%, -50%)';
    updateMobileVec(0, 0, radius);
    Input.keys['ArrowLeft']=Input.keys['ArrowRight']=Input.keys['ArrowUp']=Input.keys['ArrowDown']=false;
  };
  const onMove = (e) => {
    if (activeId === null || e.pointerId !== activeId) return;
    const rect = stick.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width/2);
    const dy = e.clientY - (rect.top + rect.height/2);
    setKnob(dx, dy);
  };
  stick.addEventListener('pointerdown', e => {
    activeId = e.pointerId;
    stick.setPointerCapture(activeId);
    AudioSys.init();
    onMove(e);
  });
  stick.addEventListener('pointermove', onMove);
  stick.addEventListener('pointerup', clearStick);
  stick.addEventListener('pointercancel', clearStick);

  const bindBtn = (btn, key) => {
    if(!btn) return;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); AudioSys.init(); Input.keys[key]=true; });
    const up = e => { e.preventDefault(); Input.keys[key]=false; };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  };
  bindBtn(btnFire, 'Space');
  bindBtn(btnBomb, 'ShiftLeft');
})();

// Gamepad bindings
const GamepadState = { deadzone: 0.18 };

window.addEventListener('gamepadconnected', (e) => {
  Input.pad.connected = true;
  Input.pad.index = e.gamepad.index;
  updateHUD();
});

window.addEventListener('gamepaddisconnected', (e) => {
  if (Input.pad.index === e.gamepad.index) {
    Input.pad.connected = false;
    Input.pad.index = null;
    Input.pad.x = Input.pad.y = 0;
    Input.pad.fire = Input.pad.bomb = false;
    updateHUD();
  }
});

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  if (Input.pad.index !== null && pads[Input.pad.index]) gp = pads[Input.pad.index];
  else gp = pads.find(p => p);
  
  if (!gp) {
    Input.pad.connected = false;
    Input.pad.index = null;
    Input.pad.x = Input.pad.y = 0;
    Input.pad.fire = Input.pad.bomb = false;
    return;
  }

  Input.pad.connected = true;
  Input.pad.index = gp.index;
  const dz = GamepadState.deadzone;
  const ax = Math.abs(gp.axes[0]) > dz ? gp.axes[0] : 0;
  const ay = Math.abs(gp.axes[1]) > dz ? gp.axes[1] : 0;
  Input.pad.x = ax;
  Input.pad.y = ay;
  Input.pad.fire = !!(gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || gp.buttons[5]?.pressed || gp.buttons[7]?.pressed);
  Input.pad.bomb = !!(gp.buttons[2]?.pressed || gp.buttons[6]?.pressed);
}

// --- UTILS ---
const rnd = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// Shortest distance between a and b on a ring of size len
const distWrap = (a, b, len) => {
  let d = b - a;
  if (d > len / 2) d -= len;
  if (d < -len / 2) d += len;
  return d;
};
// Normalize x to [0, len)
const wrap = (x, len) => (x % len + len) % len;

// --- GAME STATE ---
const Game = {
  canvas: document.getElementById('c'),
  ctx: document.getElementById('c').getContext('2d', { alpha: false }),
  width: 0, height: 0,
  camX: 0,
  camY: 0, // Vertical scroll for shake effects
  speed: 1.0,
  score: 0,
  wave: 1,
  lives: 3,
  bombs: 3,
  entities: [],
  particles: [],
  stars: [],
  running: false,
  terrainY: []
};

// --- ENTITY COMPONENT SYSTEM ---
class Entity {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.w = 20; this.h = 20;
    this.type = type;
    this.dead = false;
    this.hp = 1;
    this.color = '#fff';
    this.frame = 0;
    this.dir = 1; // 1 = right, -1 = left
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, WORLD_LEN);
    this.y += this.vy * dt;
    this.frame += dt;
  }

  draw(ctx, camX) {
    // Ghost rendering for screen wrap
    // We try to draw at x. If x is near 0 or WORLD_LEN, we also draw at x +/- WORLD_LEN
    const drawAt = (offsetX) => {
      const sx = this.x + offsetX - camX + Game.width / 2;
      if (sx > -50 && sx < Game.width + 50) {
        ctx.save();
        ctx.translate(sx, this.y);
        if(this.dir === -1) ctx.scale(-1, 1);
        this.renderSelf(ctx);
        ctx.restore();
      }
    };

    // Determine offset based on camera relative position
    let relativeX = this.x - camX;
    if (relativeX < -WORLD_LEN / 2) relativeX += WORLD_LEN;
    if (relativeX > WORLD_LEN / 2) relativeX -= WORLD_LEN;

    // Standard draw position (centered on cam)
    drawAt(0); 
    
    // Edge cases handled by distWrap logic implicitly in world coords? 
    // Simpler approach:
    // Draw current wrapped x relative to cam
    // Also check wraps
    const dx = distWrap(camX, this.x, WORLD_LEN);
    const screenX = Game.width/2 + dx;
    
    if (screenX > -100 && screenX < Game.width+100) {
       ctx.save();
       ctx.translate(screenX, this.y + Game.camY);
       if (this.dir === -1) ctx.scale(-1, 1);
       this.renderSelf(ctx);
       ctx.restore();
    }
  }

  renderSelf(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
  }
  
  hit(dmg) {
    this.hp -= dmg;
    if(this.hp <= 0) {
      this.dead = true;
      spawnExplosion(this.x, this.y, this.color);
      AudioSys.explosion();
      addScore(this.scoreVal || 100);
    }
  }
}

// --- ENTITIES ---

class Player extends Entity {
  constructor() {
    super(WORLD_LEN/2, VIEW_H/2, 'player');
    this.w = 40; this.h = 16;
    this.drag = 0.96;
    this.accel = 1.2;
    this.maxSpeed = 18;
    this.cool = 0;
    this.invuln = 0;
    this.respawnTimer = 0;
    this.hidden = false;
    this.fireDelay = 4;
    this.color = C.player;
    this.holding = null; // Holding a human
  }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.invuln > 0) this.invuln -= dt;

    // Wait out respawn delay while invisible
    if (this.hidden) {
      this.vx = 0; this.vy = 0;
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0 && Game.lives >= 0) {
          this.hidden = false;
          this.invuln = Math.max(this.invuln, INVULN_AFTER_RESPAWN);
          this.x = wrap(this.x, WORLD_LEN);
          this.y = VIEW_H / 2;
        }
      }
      return;
    }

    if (Input.keys['ArrowLeft'] || Input.keys['KeyA']) { this.vx -= this.accel * dt; this.dir = -1; }
    if (Input.keys['ArrowRight'] || Input.keys['KeyD']) { this.vx += this.accel * dt; this.dir = 1; }
    if (Input.keys['ArrowUp'] || Input.keys['KeyW']) { this.vy -= this.accel * dt; }
    if (Input.keys['ArrowDown'] || Input.keys['KeyS']) { this.vy += this.accel * dt; }

    // Gamepad flight
    if (Input.pad.connected) {
      if (Math.abs(Input.pad.x) > 0.1) {
        this.vx += Input.pad.x * this.accel * 1.3 * dt;
        this.dir = Input.pad.x >= 0 ? 1 : -1;
      }
      if (Math.abs(Input.pad.y) > 0.1) {
        this.vy += Input.pad.y * this.accel * 1.1 * dt;
      }
    }

    // Friction
    this.vx *= Math.pow(this.drag, dt);
    this.vy *= Math.pow(this.drag, dt);

    // Limits
    this.vx = clamp(this.vx, -this.maxSpeed, this.maxSpeed);
    this.y = clamp(this.y + this.vy * dt, 40, VIEW_H - 40);
    this.x = wrap(this.x + this.vx * dt, WORLD_LEN);

    // Fire
    const firing = (Input.keys['Space'] || Input.mouse.down || Input.pad.fire);
    if (firing && this.cool <= 0) {
      this.fire();
      this.cool = this.fireDelay;
    }

    // Bomb
    const bombing = (Input.keys['ShiftLeft'] || Input.mouse.right || Input.pad.bomb);
    if (bombing && Game.bombs > 0 && this.cool <= 0) {
      triggerBomb();
      Game.bombs--;
      this.cool = this.fireDelay * 6;
      updateHUD();
    }

    // Collision with enemies
    if (this.invuln <= 0) {
      for (let e of Game.entities) {
        if (e.type === 'enemy' || e.type === 'bullet_e') {
          if (checkCollide(this, e)) {
            this.die();
            break;
          }
        }
      }
    }

    // Pick up / Drop human
    // We check collisions with humans who are not held
    if (!this.holding) {
      const human = Game.entities.find(e => e.type === 'human' && !e.heldBy && checkCollide(this, e, 30));
      if (human) {
        human.heldBy = this;
        this.holding = human;
        AudioSys.pickup();
        // If catching a falling human, bonus!
        if (human.state === 'falling') addScore(500); 
      }
    } else if (Game.terrainY[Math.floor(this.x/20)] - this.y < 60 && Math.abs(this.vy) < 2) {
      // Drop logic: near ground and slow
      this.holding.heldBy = null;
      this.holding.y = Game.terrainY[Math.floor(this.x/20)] - 10;
      this.holding.state = 'ground';
      this.holding = null;
      addScore(500);
      AudioSys.pickup();
    }
  }

  fire() {
    const activeLasers = Game.entities.filter(e => e.type === 'bullet');
    if (activeLasers.length >= MAX_PLAYER_LASERS) return;
    const muzzleX = this.x + this.dir * 24;
    const b = new Laser(muzzleX, this.y, this.dir, this.vx);
    Game.entities.push(b);
    spawnMuzzle(muzzleX, this.y, this.dir);
    AudioSys.shoot();
  }

  die() {
    if (this.hidden || Game.lives < 0) return;
    const deathX = this.x;
    const deathY = this.y;
    spawnExplosion(deathX, deathY, '#fff', 50);
    AudioSys.explosion();
    Game.lives--;
    this.holding = null; // Drop human
    this.vx = 0; this.vy = 0;
    this.hidden = true;
    this.respawnTimer = RESPAWN_DELAY;
    this.invuln = RESPAWN_DELAY + INVULN_AFTER_RESPAWN;
    this.x = wrap(deathX + (Math.random() > 0.5 ? 260 : -260), WORLD_LEN);
    this.y = VIEW_H / 2;
    
    // Clear nearby enemies to prevent spawn kill
    Game.entities = Game.entities.filter(e => e === this || distWrap(this.x, e.x, WORLD_LEN) > 600 || e.type === 'human');
    
    if (Game.lives < 0) {
      gameOver();
      return;
    }
    updateHUD();
  }

  renderSelf(ctx) {
    if (this.hidden) return;
    if (this.invuln > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;
    
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();

    // Exhaust
    if (Math.random() > 0.5) {
      ctx.fillStyle = C.laser;
      ctx.fillRect(-15 - Math.random()*10, -2, 10, 4);
    }
    
    // Scanner beam visual (optional)
    if (SHOW_SCANNER_BEAM) {
      ctx.fillStyle = 'rgba(34, 242, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(300, -150);
      ctx.lineTo(300, 150);
      ctx.fill();
    }
  }
}

class Laser extends Entity {
  constructor(x, y, dir, shipVx) {
    super(x, y, 'bullet');
    this.dir = dir;
    this.speed = LASER_SPEED + shipVx * 0.35;
    this.life = LASER_LIFE; // Frames
    this.w = 80; this.h = 3;
  }
  update(dt) {
    this.x = wrap(this.x + this.dir * this.speed * dt, WORLD_LEN);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;

    // Collision
    for (let e of Game.entities) {
      if (e.type === 'enemy' && !e.dead) {
        const dx = distWrap(this.x, e.x, WORLD_LEN);
        if (Math.abs(dx) < (this.w + e.w)/2 && Math.abs(this.y - e.y) < (this.h + e.h)/2) {
          e.hit(1);
          this.dead = true;
          break;
        }
      }
    }
  }
  renderSelf(ctx) {
    const len = this.w;
    const grad = ctx.createLinearGradient(-len/2, 0, len/2, 0);
    grad.addColorStop(0, 'rgba(34, 242, 255, 0)');
    grad.addColorStop(0.35, 'rgba(34, 242, 255, 0.6)');
    grad.addColorStop(0.7, '#22f2ff');
    grad.addColorStop(1, '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(-len/2, -1.5, len, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(len/2 - 6, -2, 6, 4);
  }
}

class Lander extends Entity {
  constructor(x, y) {
    super(x, y, 'enemy');
    this.scoreVal = 150;
    this.color = C.lander;
    this.state = 'seek'; // seek, descend, grab, ascend
    this.target = null;
    this.w = 24; this.h = 24;
    this.carrying = null;
  }

  update(dt) {
    super.update(dt);
    
    // State Machine
    if (this.state === 'seek') {
      // Look for humans not held
      if (!this.target || this.target.heldBy || this.target.dead) {
        this.target = Game.entities.find(e => e.type === 'human' && !e.heldBy && !e.dead);
      }
      
      if (this.target) {
        const dx = distWrap(this.x, this.target.x, WORLD_LEN);
        if (Math.abs(dx) < 20) {
          this.state = 'descend';
          this.vx = 0;
        } else {
          this.vx = Math.sign(dx) * 4;
        }
      } else {
        this.vx = Math.sin(this.frame * 0.05) * 4; // Patrol
      }
      
    } else if (this.state === 'descend') {
      this.vy = 2;
      if (this.target && !this.target.heldBy) {
        if (Math.abs(this.y - this.target.y) < 10) {
          this.state = 'grab';
          this.target.heldBy = this;
          this.carrying = this.target;
        }
      } else {
        this.state = 'seek'; // Target lost
        this.vy = 0;
      }
      
    } else if (this.state === 'grab') {
      this.state = 'ascend';
      
    } else if (this.state === 'ascend') {
      this.vy = -1.5;
      this.vx = 0;
      if (this.y < 20) {
        // Reached space -> Mutate
        this.dead = true;
        if (this.carrying) {
          this.carrying.dead = true; // Consumed
          AudioSys.humanDie();
        }
        spawnMutant(this.x, this.y);
      }
    }

    // Random Fire
    if (Math.random() < 0.005) fireEnemyBullet(this);
  }

  renderSelf(ctx) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.beginPath();
    ctx.moveTo(-5, 10); ctx.lineTo(-8, 16);
    ctx.moveTo(5, 10); ctx.lineTo(8, 16);
    ctx.stroke();
  }
  
  hit(d) {
    super.hit(d);
    if (this.dead && this.carrying) {
      this.carrying.heldBy = null;
      this.carrying.state = 'falling';
      this.carrying = null;
    }
  }
}

class Mutant extends Entity {
  constructor(x, y) {
    super(x, y, 'enemy');
    this.color = C.mutant;
    this.scoreVal = 300;
    this.w = 20; this.h = 20;
  }
  update(dt) {
    super.update(dt);
    // Aggressive swarm
    const p = Game.player;
    const dx = distWrap(this.x, p.x, WORLD_LEN);
    const dy = p.y - this.y;
    
    this.vx += Math.sign(dx) * 0.2 * dt;
    this.vy += Math.sign(dy) * 0.2 * dt;
    
    // Cap speed
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 8) {
      this.vx *= 0.95;
      this.vy *= 0.95;
    }

    if (Math.random() < 0.02) fireEnemyBullet(this, true);
  }
  renderSelf(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(8, 5); ctx.lineTo(0, 10); ctx.lineTo(-8, 5);
    ctx.fill();
    // Pulse
    if (Math.floor(this.frame) % 10 < 5) {
      ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }
}

class Human extends Entity {
  constructor(x) {
    super(x, 0, 'human');
    this.groundY = Game.terrainY[Math.floor(x/20)];
    this.y = this.groundY - 10;
    this.color = C.human;
    this.heldBy = null; // Entity holding this human
    this.state = 'ground'; // ground, falling
    this.w = 8; this.h = 16;
  }
  update(dt) {
    if (this.heldBy) {
      this.x = this.heldBy.x;
      this.y = this.heldBy.y + 18;
      this.vx = 0; this.vy = 0;
    } else if (this.state === 'falling') {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      // Ground check
      const gy = Game.terrainY[Math.floor(this.x/20)] || VIEW_H;
      if (this.y >= gy - 10) {
        if (this.vy > 8) { // Splat
          this.dead = true;
          spawnExplosion(this.x, this.y, C.human);
          AudioSys.humanDie();
        } else {
          this.y = gy - 10;
          this.vy = 0;
          this.state = 'ground';
        }
      }
    }
  }
  renderSelf(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(-3, -8, 6, 16);
    ctx.fillRect(-4, -8, 8, 4); // Head
    // Legs
    if (this.state === 'falling' || this.heldBy) {
       ctx.fillRect(-4, 8, 2, 4); ctx.fillRect(2, 8, 2, 4);
    }
  }
}

class BulletE extends Entity {
  constructor(x, y, vx, vy) {
    super(x, y, 'bullet_e');
    this.vx = vx; this.vy = vy;
    this.life = 120;
    this.w = 6; this.h = 6;
  }
  update(dt) {
    this.x = wrap(this.x + this.vx * dt, WORLD_LEN);
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  renderSelf(ctx) {
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath(); ctx.arc(0,0,3,0,6.28); ctx.fill();
  }
}

// --- SYSTEMS ---

function fireEnemyBullet(e, aim = false) {
  let vx = (Math.random() - 0.5) * 6;
  let vy = (Math.random() - 0.5) * 6;
  if (aim && Game.player) {
    const dx = distWrap(e.x, Game.player.x, WORLD_LEN);
    const dy = Game.player.y - e.y;
    const dist = Math.hypot(dx, dy);
    vx = (dx/dist) * 5;
    vy = (dy/dist) * 5;
  }
  Game.entities.push(new BulletE(e.x, e.y, vx, vy));
}

function spawnExplosion(x, y, color, count=15) {
  for(let i=0; i<count; i++) {
    Game.particles.push({
      x, y, 
      vx: (Math.random() - 0.5) * 10, 
      vy: (Math.random() - 0.5) * 10,
      life: rnd(20, 50),
      color
    });
  }
}

function spawnMuzzle(x, y, dir) {
  for(let i=0; i<4; i++) {
    Game.particles.push({
      x, y,
      vx: dir * rnd(6, 12) + rnd(-1, 1),
      vy: rnd(-2, 2),
      life: rnd(8, 16),
      color: C.laser
    });
  }
}

function spawnMutant(x, y) {
  Game.entities.push(new Mutant(x, y));
}

function triggerBomb() {
  // Kill all visible enemies
  AudioSys.bomb();
  Game.ctx.fillStyle = 'white';
  Game.ctx.fillRect(0,0,Game.width, Game.height); // Flash
  
  for (let e of Game.entities) {
    if (e.type === 'enemy') {
      const dx = Math.abs(distWrap(Game.player.x, e.x, WORLD_LEN));
      if (dx < Game.width) { // Only kill visible
        e.hit(100);
      }
    }
  }
}

// --- TERRAIN GENERATION ---
function genTerrain() {
  Game.terrainY = new Array(Math.ceil(WORLD_LEN/20)).fill(0);
  let y = VIEW_H - 100;
  for (let i = 0; i < Game.terrainY.length; i++) {
    y += (Math.random() - 0.5) * 15;
    y = clamp(y, VIEW_H - 200, VIEW_H - 50);
    Game.terrainY[i] = y;
  }
  // Smoothing
  for (let k=0; k<2; k++) {
    for (let i=1; i<Game.terrainY.length-1; i++) {
      Game.terrainY[i] = (Game.terrainY[i-1] + Game.terrainY[i] + Game.terrainY[i+1])/3;
    }
  }
}

// --- GAME LOOP ---

function initGame() {
  Game.player = new Player();
  Game.entities = [Game.player];
  Game.particles = [];
  Game.score = 0;
  Game.wave = 1;
  Game.lives = 3;
  Game.bombs = 3;
  
  genTerrain();
  
  // Generate Stars
  Game.stars = [];
  for(let i=0; i<STARS_COUNT; i++) {
    Game.stars.push({
      x: rnd(0, WORLD_LEN),
      y: rnd(0, VIEW_H),
      z: rnd(0.2, 1) // Parallax factor
    });
  }
  
  startWave();
  updateHUD();
  Game.running = true;
  requestAnimationFrame(loop);
}

function startWave() {
  // Spawn Humans
  const humansNeeded = 10 - Game.entities.filter(e=>e.type==='human').length;
  for(let i=0; i<humansNeeded; i++) {
    Game.entities.push(new Human(rnd(100, WORLD_LEN-100)));
  }
  
  // Spawn Enemies
  const count = 5 + Game.wave * 2;
  for(let i=0; i<count; i++) {
    Game.entities.push(new Lander(rnd(0, WORLD_LEN), rnd(50, 300)));
  }
  
  AudioSys.start();
}

function checkCollide(a, b, tolerance = 0) {
  const dx = distWrap(a.x, b.x, WORLD_LEN);
  const dy = a.y - b.y;
  const r = (a.w + b.w)/2 - tolerance;
  return (Math.abs(dx) < r && Math.abs(dy) < (a.h + b.h)/2);
}

function addScore(n) {
  Game.score += n;
  document.getElementById('hudScore').innerText = `SCORE ${Game.score}`;
}

function updateHUD() {
  const padLabel = Input.pad.connected ? 'PAD' : 'KB';
  document.getElementById('hudStats').innerText = `LIVES ${Math.max(0, Game.lives)} | BOMBS ${Game.bombs} | WAVE ${Game.wave} | ${padLabel}`;
}

function gameOver() {
  Game.running = false;
  AudioSys.stopMusic();
  document.getElementById('overlay').style.display = 'grid';
  document.querySelector('.title').innerText = "GAME OVER";
}

function loop() {
  if (!Game.running) return;
  
  pollGamepad();
  
  // Time step
  const speedSlider = document.getElementById('speedSlider');
  if(speedSlider) {
      Game.speed = parseFloat(speedSlider.value);
      document.getElementById('speedValue').innerText = Game.speed.toFixed(1) + 'x';
  }
  const dt = 1.0 * Game.speed; // Fixed step logic simplified for browser smoothness

  // Logic
  Game.entities.forEach(e => e.update(dt));
  
  // Particles
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    let p = Game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) Game.particles.splice(i, 1);
  }
  
  // Cleanup Dead
  Game.entities = Game.entities.filter(e => !e.dead);

  // Wave Clear
  if (!Game.entities.some(e => e.type === 'enemy')) {
    Game.wave++;
    startWave();
    updateHUD();
  }

  // Camera Logic
  const targetCamX = Game.player.x;
  // Smooth wrap interpolation for camera
  let dx = distWrap(Game.camX, targetCamX, WORLD_LEN);
  Game.camX = wrap(Game.camX + dx * 0.1, WORLD_LEN);
  
  // Shake
  Game.camY = Game.camY * 0.9;
  if(Game.player.invuln > 0) Game.camY = (Math.random()-0.5)*4;

  // Draw
  render();
  
  // Radar
  drawRadar();

  requestAnimationFrame(loop);
}

function render() {
  const { ctx, width, height, camX } = Game;
  
  // Clear
  ctx.fillStyle = C.sky;
  ctx.fillRect(0, 0, width, height);
  
  // Stars (Parallax)
  ctx.fillStyle = '#fff';
  Game.stars.forEach(s => {
    // Apply parallax: moves slower if z is lower
    let sx = s.x - camX * s.z; 
    // Manual wrap for stars
    sx = ((sx % WORLD_LEN) + WORLD_LEN) % WORLD_LEN; 
    // Map to screen
    if (sx > WORLD_LEN - width) sx -= WORLD_LEN; // Shift for wrap-around visuals
    
    // Actually, simpler to just project relative to cam
    let relX = distWrap(camX * s.z, s.x, WORLD_LEN);
    let screenX = width/2 + relX;
    
    // Only draw if on screen
    if(screenX >= 0 && screenX <= width) {
       ctx.globalAlpha = s.z;
       ctx.fillRect(screenX, s.y, s.z*2, s.z*2);
    }
  });
  ctx.globalAlpha = 1;

  // Terrain
  ctx.beginPath();
  ctx.strokeStyle = C.terrain;
  ctx.lineWidth = 2;
  // We only draw visible segments
  const startI = Math.floor(wrap(camX - width/2 - 100, WORLD_LEN) / 20);
  const count = Math.ceil((width + 200) / 20);
  
  for(let i=0; i<count; i++) {
    let idx = (startI + i) % Game.terrainY.length;
    let wx = idx * 20;
    // Project
    let dx = distWrap(camX, wx, WORLD_LEN);
    let sx = width/2 + dx;
    let sy = Game.terrainY[idx];
    if (i===0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  // Fill bottom
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fillStyle = '#080a14';
  ctx.fill();
  ctx.stroke();

  // Entities
  Game.entities.forEach(e => e.draw(ctx, camX));
  
  // Particles
  Game.particles.forEach(p => {
    let dx = distWrap(camX, p.x, WORLD_LEN);
    let sx = width/2 + dx;
    if(sx > 0 && sx < width) {
      ctx.fillStyle = p.color;
      ctx.fillRect(sx, p.y, 2, 2);
    }
  });
}

function drawRadar() {
  const blips = document.getElementById('blips');
  let html = '';
  const radarEl = document.getElementById('radar');
  const w = radarEl.clientWidth;
  const h = radarEl.clientHeight;
  
  // Map helpers
  const mapX = (x) => (x / WORLD_LEN) * 100;
  const groundAt = (x) => Game.terrainY[Math.floor(x/20)] || VIEW_H;
  const altHeight = (x, y) => {
    const alt = Math.max(0, groundAt(x) - y);
    return clamp((alt / VIEW_H) * h, 4, h - 4);
  };
  
  // Player blip with altitude
  const pHeight = altHeight(Game.player.x, Game.player.y);
  html += `<div class="blip" style="left:${mapX(Game.player.x)}%; height:${pHeight}px; background:#fff; z-index:2"></div>`;
  
  // Viewport box across full radar height
  let camP = mapX(Game.camX);
  let viewW = (Game.width / WORLD_LEN) * 100;
  html += `<div class="blip" style="left:${camP - viewW/2}%; width:${viewW}%; height:${h-4}px; border:1px solid #444; background:transparent; z-index:1"></div>`;
  
  Game.entities.forEach(e => {
    if(e.type === 'player') return;
    let c = e.type === 'human' ? C.human : C.lander;
    if(e.type === 'enemy') c = C.lander;
    if(e.type === 'mutant') c = C.mutant;
    
    const altH = altHeight(e.x, e.y);
    html += `<div class="blip" style="left:${mapX(e.x)}%; height:${altH}px; background:${c}"></div>`;
  });
  
  blips.innerHTML = html;
}

// --- INIT ---
function resize() {
  const c = document.getElementById('c');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  Game.width = c.width;
  Game.height = c.height;
}
window.addEventListener('resize', resize);
resize();

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  AudioSys.init();
  AudioSys.startMusic();
  initGame();
});

// Initial call to set render size
resize();
