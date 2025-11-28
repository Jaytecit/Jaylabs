// === JayLabs Edition: "Jaylabs Chrono Clash" ===
//

// --- Core Game Objects & State ---
let teams = []; let leagueTable = []; // Retained for display
let schedule = []; let currentMatchIndex = 0;
let players = []; let userControlledPlayer = null; let orb;
let particles = []; let energyConduit; let floatingTexts = []; let shockwaves = [];
let gameState = 'title';
let matchData = { team1_idx: 0, team2_idx: 0, score: { team1: 0, team2: 0 }, firstTo: 3, matchTimer: 0, penaltyWinner: null };
let penaltyData = {}; let stateTimer = 0;

let screenShake = { magnitude: 0, duration: 0 }; let effectsBuffer;
let powerUps = []; let nextPowerUpFrame = 0;
let hypeMeter = { team1: 0, team2: 0 };
let windVector; let windDrift = 0;

// Touch controls state
const mobileInput = { active: false, x: 0, y: 0, pulse: false, dash: false, ultimate: false };
const updateMobileActive = () => {
  mobileInput.active = Math.abs(mobileInput.x) > 0.02 || Math.abs(mobileInput.y) > 0.02 || mobileInput.pulse || mobileInput.dash || mobileInput.ultimate;
};
function initMobileControls() {
  const container = document.getElementById('mobileControls');
  const stick = document.getElementById('touchStick');
  const knob = document.getElementById('touchKnob');
  const btnPulse = document.getElementById('btnPulse');
  const btnDash = document.getElementById('btnDash');
  const btnUlt = document.getElementById('btnUlt');
  if (!container || !stick || !knob) return;

  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)');
  const showIfMobile = () => { if (coarse.matches) container.classList.add('show'); };
  showIfMobile();
  coarse.addEventListener('change', showIfMobile);

  const radius = 60;
  let activeId = null;
  const setVec = (dx, dy) => {
    const dist = Math.min(Math.hypot(dx, dy), radius);
    const ang = Math.atan2(dy, dx);
    const nx = Math.cos(ang) * dist;
    const ny = Math.sin(ang) * dist;
    knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    mobileInput.x = nx / radius;
    mobileInput.y = ny / radius;
    updateMobileActive();
  };
  const onMove = (e) => {
    if (activeId === null) return;
    const rect = stick.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    setVec(dx, dy);
  };
  const clearStick = () => { activeId = null; setVec(0, 0); };
  stick.addEventListener('pointerdown', (e) => {
    activeId = e.pointerId;
    stick.setPointerCapture(activeId);
    onMove(e);
    if (!audioStarted && typeof userStartAudio === 'function') { userStartAudio(); audioStarted = true; }
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === activeId) onMove(e); });
  stick.addEventListener('pointerup', clearStick);
  stick.addEventListener('pointercancel', clearStick);

  const bindBtn = (btn, key) => {
    if (!btn) return;
    const down = (e) => { e.preventDefault(); mobileInput[key] = true; updateMobileActive(); if (!audioStarted && typeof userStartAudio === 'function') { userStartAudio(); audioStarted = true; } };
    const up = (e) => { e.preventDefault(); mobileInput[key] = false; updateMobileActive(); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  };
  bindBtn(btnPulse, 'pulse');
  bindBtn(btnDash, 'dash');
  bindBtn(btnUlt, 'ultimate');
}

// --- New: Tournament State ---
let tournament = {
  stage: 'groups', // 'groups' | 'knockout' | 'final' | 'completed' | 'invitational'
  groups: { A: [], B: [] },     // team indices
  groupFixtures: { A: [], B: [] }, // arrays of [i,j] pairs (team indices) within group
  groupStandings: {}, // teamId -> {played,wins,draws,losses,goalsFor,goalsAgainst,points}
  knockout: { semifinals: [], final: [] }, // pairs of team indices
  champion: null
};

// --- ULTIMATE FEATURES (from prior build) ---
const MAX_ULTIMATE_CHARGE = 1000; const ULTIMATE_CHARGE_RATE = 10;
const CRITICAL_HIT_THRESHOLD = 5; const OVERTIME_DURATION_FRAMES = 30 * 60;
let inputManager; // Unified Input System

// --- Gameplay Constants ---
const TEAM_SIZE = 5; const PULSE_COOLDOWN_TIME = 180; const PULSE_RADIUS = 160; const PULSE_FORCE = 18;
const MATCH_DURATION_FRAMES = 90 * 60; const DASH_COOLDOWN_TIME = 180; const DASH_DURATION = 12; const DASH_SPEED_BOOST = 3.5;


// --- JayLabs AI Helpers ---
function predictPos(obj, frames){ return p5.Vector.add(obj.pos, p5.Vector.mult(obj.vel, frames)); }
function isClosestToOrb(player){
  let team = players.filter(p=>p.teamId===player.teamId);
  let meDist = player.pos.dist(orb.pos);
  for(let p of team){ if(p!==player && p.pos.dist(orb.pos) < meDist-10) return false; }
  return true;
}
function opponentsNearSegment(a, b, radius, teamId){
  let opps = players.filter(p=>p.teamId!==teamId);
  for(let o of opps){ if(distToLineSegment(o.pos, a, b) < radius) return true; }
  return false;
}
function choosePassTarget(player){
  let mates = players.filter(p=>p.teamId===player.teamId && p!==player);
  const isTeam1 = player.teamId===1;
  const goal = createVector(isTeam1?width:0, height/2);
  let best=null, bestScore=-1;
  for(let m of mates){
    let d = p5.Vector.dist(player.pos, m.pos);
    if(d < 120 || d > 420) continue;
    const toGoal = p5.Vector.sub(goal, m.pos).normalize();
    const forwardness = p5.Vector.dot(toGoal, p5.Vector.sub(m.pos, player.pos).normalize());
    if(forwardness < -0.2) continue;
    if(opponentsNearSegment(player.pos, m.pos, 40, player.teamId)) continue;
    let score = forwardness*2 + map(d,120,420,1,0,true);
    if(score>bestScore){ best={target:m, dist:d}; bestScore=score; }
  }
  return best?.target || null;
}
function shootVector(player){
  const isTeam1 = player.teamId===1;
  const goalY = constrain(orb.pos.y, height*0.3, height*0.7);
  const aim = createVector(isTeam1?width-2:2, goalY);
  let v = p5.Vector.sub(aim, orb.pos); v.setMag(32); return v;
}
function clearVector(player){
  const isTeam1 = player.teamId===1;
  let target = createVector(isTeam1?width*0.75:width*0.25, (orb.pos.y<height/2)? height*0.2 : height*0.8);
  if(energyConduit && energyConduit.state==='active' && distToLineSegment(target, energyConduit.node1, energyConduit.node2)<60){
    target.y = height - target.y;
  }
  let v = p5.Vector.sub(target, orb.pos); v.setMag(34); return v;
}
function shouldShoot(player){
  const isTeam1=player.teamId===1;
  const oppGoal = createVector(isTeam1?width:0,height/2);
  const dGoal = p5.Vector.dist(orb.pos, oppGoal);
  return dGoal < width*0.45 && abs(orb.pos.y-height/2) < height*0.25;
}
function inDangerZone(teamId){
  const ownX = teamId===1? 0 : width;
  return (abs(orb.pos.x-ownX) < width*0.25) && (abs(orb.pos.y-height/2) < height*0.35);
}
function timeToReach(player, target){
  const sp = player.maxSpeed*(matchModifiers.overclock?1.35:1);
  return p5.Vector.dist(player.pos, target)/max(0.01, sp);
}

// --- JayLabs Match Modifiers ---
let matchModifiers = {
  lowGravity: false,     // lower friction & softer bounces
  overclock: false,      // players faster
  orbMutation: false,    // orb size & bounciness vary
  shrinkingGoals: false, // goal height oscillates
  solarWind: false       // constant drift across the pitch
};
function rollModifiers() {
  // Pick 1-2 random modifiers per match, weighted for variety.
  const keys = ['lowGravity','overclock','orbMutation','shrinkingGoals','solarWind'];
  keys.forEach(k => matchModifiers[k] = false);
  let num = random() < 0.5 ? 1 : 2;
  let pool = shuffle(keys);
  for (let i=0;i<num;i++) matchModifiers[pool[i]] = true;
}

function addHype(teamId, amt){
  const key = teamId===1?'team1':'team2';
  hypeMeter[key]=constrain(hypeMeter[key]+amt,0,120);
}
function decayHype(){
  hypeMeter.team1=max(0,hypeMeter.team1-0.05);
  hypeMeter.team2=max(0,hypeMeter.team2-0.05);
}
function hypeMultiplier(teamId){
  const key = teamId===1?'team1':'team2';
  return 1 + hypeMeter[key]*0.0025;
}

function scheduleNextPowerUp(){ nextPowerUpFrame = frameCount + floor(random(480,960)); }
function spawnPowerUp(){
  const types=['boost','ultimate','magnet']; const type=random(types);
  const pos=createVector(random(width*.18,width*.82),random(height*.18,height*.82));
  powerUps.push(new PowerUp(type,pos));
}
function applyPowerUp(player, powerUp){
  addHype(player.teamId, 12);
  if(audioStarted)sounds.playPulse();
  triggerScreenShake(4,14);
  switch(powerUp.type){
    case 'boost': player.pickupBoost=360; floatingTexts.push(new FloatingText(player.pos.x,player.pos.y,"BLITZ BOOST",player.pColor,1.3)); break;
    case 'ultimate': player.chargeUltimate(400); floatingTexts.push(new FloatingText(player.pos.x,player.pos.y,"ULT +",player.pColor,1.2)); break;
    case 'magnet': player.magnetTimer=360; floatingTexts.push(new FloatingText(player.pos.x,player.pos.y,"MAGNETIC",player.pColor,1.2)); break;
  }
}
function updatePowerUps(){
  if(frameCount>nextPowerUpFrame&&powerUps.length<3){ spawnPowerUp(); scheduleNextPowerUp(); }
  for(let i=powerUps.length-1;i>=0;i--){
    const pu=powerUps[i]; pu.update();
    if(pu.lifespan<=0){ powerUps.splice(i,1); continue; }
    for(let p of players){
      if(!p.activeInPenalty)continue;
      if(p.pos.dist(pu.pos)<p.r+pu.r){
        applyPowerUp(p, pu); powerUps.splice(i,1); break;
      }
    }
  }
}
function applyMagnetPulls(){
  players.forEach(p=>{
    if(p.magnetTimer>0&&p.activeInPenalty){
      let d=p.pos.dist(orb.pos);
      if(d<260){
        let pull=p5.Vector.sub(p.pos,orb.pos); pull.setMag(map(d,0,260,1.2,0.05));
        orb.applyForce(pull);
      }
    }
  });
}
function applySolarWind(){
  if(!matchModifiers.solarWind||!windVector)return;
  windDrift+=0.01;
  let gust=windVector.copy().rotate(sin(windDrift)*0.15);
  orb.applyForce(gust.copy().mult(0.8));
  players.forEach(p=>{ if(!p.isDashing) p.applyForce(gust.copy().mult(0.18)); });
  if(frameCount%240===0){ windVector.rotate(random(-PI/6,PI/6)); }
}

// --- Harmonic Sound Engine (unchanged, collapsed for brevity) ---
let sounds; let audioStarted = false; class SoundEngine { constructor(){this.reverb=new p5.Reverb();this.delay=new p5.Delay();this.kickEnv=new p5.Envelope(0.01,0.8,0.2,0);this.kickOsc=new p5.Oscillator('sine');this.kickOsc.amp(this.kickEnv);this.kickOsc.start();this.reverb.process(this.kickOsc,3,2);this.goalEnv=new p5.Envelope(0.05,0.7,0.5,0.5);this.goalOsc=new p5.Oscillator('triangle');this.goalOsc.amp(this.goalEnv);this.goalOsc.start();this.delay.process(this.goalOsc,0.12,0.7,2300);this.reverb.process(this.goalOsc,6,4);this.pulseEnv=new p5.Envelope(0.02,0.5,0.5,0);this.pulseFilter=new p5.LowPass();this.pulseNoise=new p5.Noise('white');this.pulseNoise.amp(this.pulseEnv);this.pulseNoise.connect(this.pulseFilter);this.pulseNoise.start();this.reverb.process(this.pulseFilter,5,2);this.critEnv=new p5.Envelope(0.01,0.4,0.1,0);this.critOsc=new p5.Oscillator('sawtooth');this.critOsc.amp(this.critEnv);this.critOsc.start();this.dashEnv=new p5.Envelope(0.05,0.2,0.1,0);this.dashNoise=new p5.Noise('white');this.dashNoise.amp(this.dashEnv);this.dashNoise.start();this.ultimateEnv=new p5.Envelope(0.1,0.8,0.5,0);this.ultimateOsc=new p5.Oscillator('sawtooth');this.ultimateOsc.amp(this.ultimateEnv);this.ultimateOsc.start();this.reverb.process(this.ultimateOsc,5,3);this.rumbleEnv=new p5.Envelope(0.01,0.3,0.1,0);this.rumbleOsc=new p5.Oscillator('sine');this.rumbleOsc.amp(this.rumbleEnv);this.rumbleOsc.freq(40);this.rumbleOsc.start();this.tensionOsc=new p5.Oscillator('sine');this.tensionEnv=new p5.Envelope(0.01,0.4,0.5,0);this.tensionOsc.amp(this.tensionEnv);this.tensionOsc.freq(midiToFreq(48));this.tensionOsc.start();this.tensionInterval=null;}playKick(v){const note=random([60,63,65,67,70]);const freq=midiToFreq(note+12);const vol=map(v,2,25,0.4,1,true);this.kickOsc.freq(freq);this.kickEnv.setRange(vol,0);this.kickEnv.play(this.kickOsc);}playCriticalHit(){this.critOsc.freq(midiToFreq(random([60,63,65,67,70])+36));this.critEnv.play(this.critOsc);this.playRumble(0.6);}playGoal(){const notes=[0,2,4,5,7].map(i=>[60,63,65,67,70][i%5]+24);let t=0;notes.forEach((n,i)=>{setTimeout(()=>{this.goalOsc.freq(midiToFreq(n+(i*2)));this.goalEnv.play(this.goalOsc);},t);t+=80;});this.playRumble(1,.5);}playPulse(){this.pulseFilter.freq(8e3,.02);this.pulseEnv.play(this.pulseNoise);this.pulseFilter.freq(1e3,.5);}playDash(){this.dashEnv.play(this.dashNoise);}playUltimate(type){let note;switch(type){case'SINGULARITY':note=48;break;case'BARRIER':note=81;break;case'OVERCHARGE':note=83;}this.ultimateOsc.freq(midiToFreq(note));this.ultimateEnv.play(this.ultimateOsc);this.playRumble(1,.8);}playRumble(vol=.5,time=.3){this.rumbleEnv.setADSR(.01,time,.2,.1);this.rumbleEnv.setRange(vol,0);this.rumbleEnv.play(this.rumbleOsc);}startPenaltyTension(){if(this.tensionInterval)return;const play=()=>{this.tensionEnv.play(this.tensionOsc);};play();this.tensionInterval=setInterval(play,600);}stopPenaltyTension(){if(this.tensionInterval){clearInterval(this.tensionInterval);this.tensionInterval=null;}} }

class InputManager {
  constructor(){this.gamepad=null;this.controlMode='mouse';this.deadzone=0.15;this.move=createVector(0,0);this.aim=createVector(0,0);this.pulse=false;this.dash=false;this.ultimate=false;this.lastPulseState=false;this.lastDashState=false;this.lastUltimateState=false;}
  update(){
    let gps=navigator.getGamepads();this.gamepad=gps[0];
    if(this.gamepad&&this.isGamepadActive()){this.controlMode='gamepad';}
    else if(mobileInput.active){this.controlMode='touch';}
    else if(abs(mouseX-pmouseX)>1||abs(mouseY-pmouseY)>1){this.controlMode='mouse';}
    let cP=false,cD=false,cU=false;
    if(this.controlMode==='gamepad'){
      let sx=this.gamepad.axes[0];let sy=this.gamepad.axes[1];
      if(abs(sx)<this.deadzone)sx=0; if(abs(sy)<this.deadzone)sy=0;
      this.move.set(sx,sy); cP=this.gamepad.buttons[0].pressed; cD=this.gamepad.buttons[2].pressed; cU=this.gamepad.buttons[3].pressed;
    }else if(this.controlMode==='touch'){
      this.move.set(mobileInput.x,mobileInput.y);
      this.aim.set(width/2,height/2);
      cP=mobileInput.pulse; cD=mobileInput.dash; cU=mobileInput.ultimate;
    }else{
      if(document.pointerLockElement===canvas){this.move.set(movedX,movedY).mult(0.1);}else{this.aim.set(mouseX,mouseY);this.move.set(0,0);}
      cP=mouseIsPressed&&mouseButton===LEFT; cD=keyIsDown(32); cU=mouseIsPressed&&mouseButton===RIGHT;
    }
    this.pulse=cP&&!this.lastPulseState; this.dash=cD&&!this.lastDashState; this.ultimate=cU&&!this.lastUltimateState;
    this.lastPulseState=cP; this.lastDashState=cD; this.lastUltimateState=cU;
  }
  isGamepadActive(){if(!this.gamepad)return false;if(this.gamepad.buttons.some(b=>b.pressed))return true;if(this.gamepad.axes.some(a=>abs(a)>this.deadzone))return true;return false;}
}

function triggerScreenShake(magnitude,duration){screenShake.magnitude=max(screenShake.magnitude,magnitude);screenShake.duration=max(screenShake.duration,duration);}

// --- SETUP ---
function setup(){
  initMobileControls();
  createCanvas(windowWidth,windowHeight);
  effectsBuffer=createGraphics(windowWidth,windowHeight);
  effectsBuffer.colorMode(HSB,360,100,100,100);
  effectsBuffer.textFont('sans-serif'); // swap to a HUD font if available
  colorMode(HSB,360,100,100,100); textFont('sans-serif');
  windVector=createVector(0,0);
  initializeLeagueJayLabs();
  setupTournament();
  sounds=new SoundEngine(); inputManager=new InputManager();
}

function initializeLeagueJayLabs(){
  // JayLabs branding + neon
  teams=[
    {name:'Pulse Mechanics', color:color(200,90,100)},
    {name:'Neon Prophets', color:color(320,85,100)},
    {name:'Synth Strikers', color:color(280,80,100)},
    {name:'Quantum Jackals', color:color(180,85,100)},
    {name:'Grid Runners', color:color(140,90,100)},
    {name:'Axion Vipers', color:color(30,95,100)},
    {name:'Circuit Saints', color:color(50,90,100)},
    {name:'Void Tigers', color:color(0,85,100)},
    {name:'JayLabs Interns', color:color(60,10,100)},
    {name:'Martooni Mavericks', color:color(260,60,100)}
  ];
  teams.forEach(t=>{t.userTeam=false;t.selectedPlayerId=-1;});
  const userTeamIndex=floor(random(teams.length));
  teams[userTeamIndex].userTeam=true;
  teams[userTeamIndex].selectedPlayerId=floor(random(TEAM_SIZE));

  leagueTable=teams.map((team,index)=>({id:index,name:team.name,color:team.color,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0}));
  currentMatchIndex=0; gameState='title';
}

function setupTournament(){
  // 10 teams → 2 groups of 5
  let idxs = [...Array(teams.length).keys()];
  idxs = shuffle(idxs);
  tournament.groups.A = idxs.slice(0,5);
  tournament.groups.B = idxs.slice(5,10);

  // init group standings
  tournament.groupStandings = {};
  teams.forEach((t,i)=>{
    tournament.groupStandings[i] = { played:0, wins:0, draws:0, losses:0, goalsFor:0, goalsAgainst:0, points:0 };
  });

  // fixtures within groups (single round-robin in each group)
  tournament.groupFixtures.A = makeRoundRobin(tournament.groups.A);
  tournament.groupFixtures.B = makeRoundRobin(tournament.groups.B);

  // prime schedule with Group A then B alternating for variety
  schedule = interleaveFixtures(tournament.groupFixtures.A, tournament.groupFixtures.B);
  tournament.stage = 'groups';
}

function makeRoundRobin(indices){
  // all unique pairs
  let f = [];
  for(let i=0;i<indices.length;i++){
    for(let j=i+1;j<indices.length;j++){
      f.push([indices[i], indices[j]]);
    }
  }
  return shuffle(f);
}

function interleaveFixtures(a, b){
  const out=[]; let i=0, j=0;
  while(i<a.length || j<b.length){
    if(i<a.length){ out.push(a[i]); i++; }
    if(j<b.length){ out.push(b[j]); j++; }
  }
  return out;
}

// --- MAIN DRAW LOOP ---
function draw(){
  effectsBuffer.background(230,30,10);
  runStateLogic(effectsBuffer);
  clear();
  push();
  if(screenShake.duration>0){
    let shakeMagnitude=screenShake.magnitude*(screenShake.duration/30);
    translate(random(-shakeMagnitude,shakeMagnitude),random(-shakeMagnitude,shakeMagnitude));
    screenShake.duration--;
    if(shakeMagnitude>8)applyChromaticAberration(effectsBuffer);
  }
  image(effectsBuffer,0,0);
  pop();

  drawUI();
  drawScanlines(); // JayLabs retro scanlines overlay
}

function applyChromaticAberration(buffer){
  let shift=screenShake.magnitude/4; blendMode(ADD);
  tint(100,0,100,100); image(buffer,shift,0);
  tint(0,100,100,100); image(buffer,-shift,0);
  blendMode(BLEND); noTint();
}

function drawScanlines(){
  // Subtle CRT-style scanlines and corner badge
  noStroke(); fill(0,0,0,5);
  for(let y=0;y<height;y+=3){ rect(0,y,width,1); }
  // JayLabs corner bug
  textAlign(RIGHT,BOTTOM); textSize(12);
  fill(200,10,100,60); text('JayLabs • Martooni Edition', width-10, height-6);
}

function runStateLogic(buffer){
  inputManager.update();
  if(inputManager.pulse)handleGamepadAdvance();

  for(let i=shockwaves.length-1;i>=0;i--){shockwaves[i].update();if(!shockwaves[i].isAlive())shockwaves.splice(i,1);}
  for(let i=particles.length-1;i>=0;i--){particles[i].update();if(!particles[i].isAlive())particles.splice(i,1);}
  for(let i=floatingTexts.length-1;i>=0;i--){floatingTexts[i].update();if(!floatingTexts[i].isAlive())floatingTexts.splice(i,1);}

  switch(gameState){
    case 'title': drawIntroScreen(buffer); break;
    case 'preMatch': drawPreMatchScreen(buffer); if(stateTimer>0)stateTimer--; break;
    case 'play': runGameLogic(buffer); break;
    case 'overtime': runGameLogic(buffer); break;
    case 'goal': drawGoalMessage(buffer); if(stateTimer>0)stateTimer--; else checkMatchOver(); break;
    case 'penaltyShootout': runPenaltyShootoutLogic(buffer); break;
    case 'postMatch': drawPostMatchScreen(buffer); if(stateTimer>0)stateTimer--; else advanceTournamentFlow(); break;
    case 'leagueTable': drawLeagueTable(buffer); break;
    case 'endOfSeason': drawEndOfSeasonScreen(buffer); break;
  }

  if(['play','goal','overtime','penaltyShootout'].includes(gameState)){
    drawField(buffer); drawGameObjects(buffer);
  }
  floatingTexts.forEach(ft=>ft.display(buffer));
  shockwaves.forEach(s=>s.display(buffer));
}

function drawUI(){ if(['play','goal','overtime','penaltyShootout'].includes(gameState)){ drawGameUI(); }}

// --- TOURNAMENT FLOW ---
function advanceTournamentFlow(){
  currentMatchIndex++;
  // Still in group fixtures?
  if(tournament.stage === 'groups' && currentMatchIndex < schedule.length){
    gameState='leagueTable'; return;
  }
  if(tournament.stage === 'groups' && currentMatchIndex >= schedule.length){
    // compute top 2 in each group → semifinals
    const topA = rankGroup(tournament.groups.A).slice(0,2);
    const topB = rankGroup(tournament.groups.B).slice(0,2);
    tournament.knockout.semifinals = [
      [topA[0], topB[1]],
      [topB[0], topA[1]]
    ];
    schedule = [...tournament.knockout.semifinals];
    currentMatchIndex = 0;
    tournament.stage = 'knockout';
    gameState='leagueTable';
    return;
  }
  if(tournament.stage === 'knockout' && currentMatchIndex >= schedule.length){
    // winners go to final
    const winners = lastKnockoutWinners;
    tournament.knockout.final = [[winners[0], winners[1]]];
    schedule = [...tournament.knockout.final];
    currentMatchIndex = 0;
    tournament.stage = 'final';
    gameState='leagueTable';
    return;
  }
  if(tournament.stage === 'final' && currentMatchIndex >= schedule.length){
    tournament.stage='completed';
    gameState='endOfSeason';
    return;
  }
  // Default case: continue via league table screen
  if(currentMatchIndex < schedule.length) gameState='leagueTable';
}

// Track knockout winners between semifinals and final
let lastKnockoutWinners = [];

function rankGroup(groupIdxs){
  // sort by points, GD, GF
  const arr = groupIdxs.map(id => ({ id, ...tournament.groupStandings[id] }));
  arr.sort((a,b)=>{
    if(b.points!==a.points) return b.points-a.points;
    const gdA=a.goalsFor-a.goalsAgainst, gdB=b.goalsFor-b.goalsAgainst;
    if(gdB!==gdA) return gdB-gdA;
    return b.goalsFor - a.goalsFor;
  });
  return arr.map(o=>o.id);
}

// --- GAME LOGIC & UPDATES ---
function startMatch(team1_idx,team2_idx){
  // Roll JayLabs modifiers for this match
  rollModifiers();

  matchData={team1_idx,team2_idx,score:{team1:0,team2:0},firstTo:3,matchTimer:MATCH_DURATION_FRAMES,penaltyWinner:null};
  players=[];
  const t1_info=teams[team1_idx], t2_info=teams[team2_idx];
  const t1_f=[{x:.4,y:.25},{x:.4,y:.75},{x:.25,y:.5},{x:.15,y:.3},{x:.15,y:.7}];
  const t2_f=[{x:.6,y:.25},{x:.6,y:.75},{x:.75,y:.5},{x:.85,y:.3},{x:.85,y:.7}];
  for(let i=0;i<TEAM_SIZE;i++){ players.push(new Player(width*t1_f[i].x,height*t1_f[i].y,1,t1_info,i)); players.push(new Player(width*t2_f[i].x,height*t2_f[i].y,2,t2_info,i)); }
  userControlledPlayer=null;
  let userTeamInfo=teams.find(t=>t.userTeam);
  if(userTeamInfo){
    let userTeamId=teams[matchData.team1_idx]===userTeamInfo?1:2;
    userControlledPlayer=players.find(p=>p.teamId===userTeamId&&p.playerId===userTeamInfo.selectedPlayerId);
    if(userControlledPlayer){ userControlledPlayer.isUserControlled=true; userControlledPlayer.role='USER_CONTROLLED'; }
  }
  hypeMeter={team1:0,team2:0};
  powerUps=[]; scheduleNextPowerUp();
  windDrift=0; windVector=matchModifiers.solarWind?p5.Vector.fromAngle(random(TWO_PI)).mult(random(0.05,0.12)):createVector(0,0);
  energyConduit=new EnergyConduit();
  resetRound();
}

function resetRound(){
  orb=new Orb(width/2,height/2);
  if(matchModifiers.orbMutation){
    orb.r = random(8,18);
    orb.bounceFactor = random(0.7, 0.95);
  }
  players.forEach(p=>p.resetPosition());
  energyConduit.spawn();
  gameState='play';
}

function runGameLogic(){
  if(matchData.matchTimer>0) matchData.matchTimer--;
  else{
    if(gameState==='play'){
      if(matchData.score.team1!==matchData.score.team2) endMatch();
      else startOvertime();
    } else if(gameState==='overtime'){ startPenaltyShootout(); }
    return;
  }

  assignDynamicRoles(players.filter(p=>p.teamId===1));
  assignDynamicRoles(players.filter(p=>p.teamId===2));

  decayHype();
  energyConduit.update(); energyConduit.applyEffect(orb);

  players.forEach(p=>{
    p.update();
    if(p.isUserControlled){ p.handleUserControl(inputManager); } else { updateAI(p); }
    p.checkCollisionWithOrb(orb);
  });

  updatePowerUps();
  applyMagnetPulls();
  applySolarWind();
  handlePlayerCollisions(players);
  orb.update();
}


function assignDynamicRoles(teamPlayers){
  const aiPlayers=teamPlayers.filter(p=>!p.isUserControlled);
  if(aiPlayers.length===0) return;
  aiPlayers.forEach(p=>p.role='MIDFIELD');

  aiPlayers.sort((a,b)=>a.pos.dist(orb.pos)-b.pos.dist(orb.pos));
  if(aiPlayers.length>0) aiPlayers[0].role='ATTACKER';
  if(aiPlayers.length>1) aiPlayers[1].role='SUPPORT';

  const isTeam1=teamPlayers[0].teamId===1;
  const ownGoalPos=createVector(isTeam1?0:width,height/2);

  aiPlayers.sort((a,b)=>a.pos.dist(ownGoalPos)-b.pos.dist(ownGoalPos));
  if(aiPlayers.length>0) aiPlayers[0].role='GOALIE';
  if(aiPlayers.length>1) aiPlayers[1].role='DEFENDER';

  const myScore = isTeam1? matchData.score.team1 : matchData.score.team2;
  const theirScore = isTeam1? matchData.score.team2 : matchData.score.team1;
  if(myScore < theirScore && matchData.matchTimer < 40*60){
    let extra = aiPlayers.find(p=>p.role==='MIDFIELD');
    if(extra) extra.role='ATTACKER';
  } else if(myScore>theirScore && matchData.matchTimer < 25*60){
    let support = aiPlayers.find(p=>p.role==='SUPPORT');
    if(support) support.role='DEFENDER';
  }
}

function energyConduitPathRisk(pt){
  if(!energyConduit || energyConduit.state!=='active') return Infinity;
  return distToLineSegment(pt, energyConduit.node1, energyConduit.node2);
}


function updateAI(player){
  if(frameCount - player.lastDecision > 10){ player.aiCooldown=max(0,player.aiCooldown-1); player.lastDecision=frameCount; }

  const isTeam1 = player.teamId===1;
  const oppGoal = createVector(isTeam1?width:0, height/2);
  const ownGoal = createVector(isTeam1?0:width, height/2);
  const weClosest = isClosestToOrb(player);
  const dBall = player.pos.dist(orb.pos);
  const scoreDiff = (isTeam1?matchData.score.team1:matchData.score.team2) - (isTeam1?matchData.score.team2:matchData.score.team1);
  const lateGame = matchData.matchTimer < 25*60;
  const closestPU = powerUps.length? powerUps.reduce((acc,pu)=>{ const d=p5.Vector.dist(player.pos,pu.pos); return d<acc.d?{pu,d}:acc; },{pu:null,d:9999}) : {pu:null,d:9999};

  let target;

  if(player.role==='GOALIE'){
    const danger = inDangerZone(player.teamId);
    const tMe = timeToReach(player, orb.pos);
    const nearestOpp = players.filter(p=>p.teamId!==player.teamId).reduce((a,b)=> (a==null||b.pos.dist(orb.pos)<a.pos.dist(orb.pos))?b:a, null);
    const tOpp = nearestOpp? timeToReach(nearestOpp, orb.pos) : 999;

    if(danger && tMe < tOpp*0.9){
      target = orb.pos.copy();
      if(dBall < player.r + orb.r + 20){
        player.pendingKickVec = clearVector(player);
        if(player.dashCooldown===0) player.activateDash(p5.Vector.sub(orb.pos, player.pos));
      }
    } else {
      let anticipate = p5.Vector.add(orb.pos, p5.Vector.mult(orb.vel, 12));
      if(matchModifiers.solarWind) anticipate.add(windVector.copy().mult(220));
      target = anticipate; target.x = isTeam1? 70 : width-70; target.y = constrain(target.y, height*.25, height*.75);
      if(energyConduit && energyConduit.state==='active' && distToLineSegment(target, energyConduit.node1, energyConduit.node2) < 60){
        target.y += (random()<0.5?-120:120); target.y = constrain(target.y, height*.25, height*.75);
      }
      const shotThreat = (isTeam1&&orb.vel.x<-4)||(!isTeam1&&orb.vel.x>4);
      if(shotThreat && orb.pos.dist(ownGoal)<width/3){
        if(player.ultimateCharge>=MAX_ULTIMATE_CHARGE) player.activateUltimate();
        else if(player.dashCooldown===0) player.activateDash(p5.Vector.sub(orb.pos,player.pos));
      }
    }
    player.seek(target); return;
  }

  const haveEdge = weClosest || dBall < 120;
  const press = max(0.9, 1 + (lateGame?0.08:0) + (scoreDiff<0?0.18:scoreDiff>0?-0.05:0));
  const chasePower = closestPU.pu && (!haveEdge || dBall>180) && closestPU.d<360;

  if(chasePower && player.role!=='GOALIE'){
    target = p5.Vector.lerp(closestPU.pu.pos, orb.pos, 0.08);
  }

  if(haveEdge && !target){
    if(shouldShoot(player)){
      player.pendingKickVec = shootVector(player);
      target = orb.pos.copy();
    } else {
      const mate = choosePassTarget(player);
      if(mate){
        player.pendingKickVec = p5.Vector.sub(mate.pos, orb.pos).setMag(28);
        player.pendingKickVec.add(p5.Vector.sub(mate.pos, player.pos).setMag(4));
        target = orb.pos.copy();
      } else {
        const toGoal = p5.Vector.sub(oppGoal, orb.pos).normalize();
        const behind = p5.Vector.sub(orb.pos, toGoal.copy().mult(player.r+orb.r+40));
        target = p5.Vector.lerp(behind, orb.pos.copy().add(toGoal.mult(60)), 0.3);
      }
    }
  } else if(!haveEdge){
    if(!target){
      if(player.role==='DEFENDER'){
        const mostThreat = players.filter(p=>p.teamId!==player.teamId)
          .reduce((a,b)=> (a==null || b.pos.dist(ownGoal) < a.pos.dist(ownGoal)) ? b : a, null);
        target = mostThreat ? p5.Vector.lerp(mostThreat.pos, ownGoal, 0.4) : p5.Vector.lerp(orb.pos, ownGoal, 0.6);
        if(isTeam1) target.x=min(target.x,width*0.45); else target.x=max(target.x,width*0.55);
      } else if(player.role==='SUPPORT'){
        const attacker = players.find(p=>p.teamId===player.teamId && p.role==='ATTACKER');
        const lane = attacker? p5.Vector.lerp(attacker.pos, oppGoal, 0.25) : p5.Vector.lerp(orb.pos, oppGoal, 0.2);
        const normal = createVector(0, (orb.pos.y<height/2)? -80: 80);
        target = p5.Vector.add(lane, normal);
      } else {
        const lane = p5.Vector.lerp(orb.pos, oppGoal, 0.4*press);
        target = lane;
      }
    }
    const ballHeadingHome = isTeam1?orb.vel.x<-0.8:orb.vel.x>0.8;
    if(ballHeadingHome && orb.vel.mag()>3){
      let tFrames=constrain(floor(timeToReach(player, orb.pos)*1.2),6,50);
      const intercept = predictPos(orb, tFrames);
      target = p5.Vector.lerp(target, intercept, 0.6);
    }
  }

  if(haveEdge && dBall<120 && player.dashCooldown===0) player.activateDash(p5.Vector.sub(orb.pos, player.pos));

  if(energyConduit && energyConduit.state==='active' && distToLineSegment(target, energyConduit.node1, energyConduit.node2) < 50){
    target.y += (random()<0.5?-80:80);
  }

  let angle=noise(player.wobbleOffset+frameCount*0.02)*TWO_PI*2;
  target.add(p5.Vector.fromAngle(angle).mult(12));

  player.seek(target);
}

function getGoalHeight(){
  let base = height*.4;
  if(matchModifiers.shrinkingGoals){
    // Oscillate between 60% and 100% of base
    const osc = (sin(frameCount*0.02)+1)/2; // 0..1
    return lerp(base*0.6, base, osc);
  }
  return base;
}

function checkStandardGoal(){
  let gH=getGoalHeight(), gT=height/2-gH/2, gB=height/2+gH/2;
  if(orb.pos.y>gT&&orb.pos.y<gB){
    let goalScored=false; let scoringTeam=0;
    if(orb.pos.x<1){ matchData.score.team2++; matchData.lastScorerTeamId=2; goalScored=true; scoringTeam=2; }
    else if(orb.pos.x>width-1){ matchData.score.team1++; matchData.lastScorerTeamId=1; goalScored=true; scoringTeam=1; }
    if(goalScored){
      addHype(scoringTeam, 30);
      let scorerColor=teams[scoringTeam===1?matchData.team1_idx:matchData.team2_idx].color;
      if(audioStarted)sounds.playGoal();
      triggerScreenShake(25,60);
      shockwaves.push(new Shockwave(scoringTeam===1?0:width,height/2,scorerColor,3000));
      orb.isSingularity=false;
      if(gameState==='overtime') endMatch();
      else { gameState='goal'; stateTimer=180; }
    }
  }
}

function checkMatchOver(){
  if(matchData.score.team1>=matchData.firstTo||matchData.score.team2>=matchData.firstTo) endMatch();
  else resetRound();
}

function startOvertime(){
  gameState='overtime'; matchData.matchTimer=OVERTIME_DURATION_FRAMES;
  floatingTexts.push(new FloatingText(width/2,height/2-100,"OVERTIME!",color(30,100,100),3,180));
  floatingTexts.push(new FloatingText(width/2,height/2,"NEXT GOAL WINS",color(0,0,100),2,180));
  resetRound(); gameState='overtime';
}

function endMatch(){
  if(audioStarted)sounds.stopPenaltyTension();
  const t1_idx=matchData.team1_idx,t2_idx=matchData.team2_idx;
  const s1=matchData.score.team1,s2=matchData.score.team2;

  // Update league table (visual legacy)
  leagueTable[t1_idx].played++; leagueTable[t2_idx].played++;
  leagueTable[t1_idx].goalsFor+=s1; leagueTable[t1_idx].goalsAgainst+=s2;
  leagueTable[t2_idx].goalsFor+=s2; leagueTable[t2_idx].goalsAgainst+=s1;
  let p1=0,p2=0;
  if(s1>s2){ leagueTable[t1_idx].wins++; leagueTable[t2_idx].losses++; p1=3; }
  else if(s2>s1){ leagueTable[t2_idx].wins++; leagueTable[t1_idx].losses++; p2=3; }
  else { // draw
    leagueTable[t1_idx].draws++; leagueTable[t2_idx].draws++; p1=1; p2=1;
    if(matchData.penaltyWinner===1) p1++;
    else if(matchData.penaltyWinner===2) p2++;
  }
  leagueTable[t1_idx].points+=p1; leagueTable[t2_idx].points+=p2;

  // Tournament advancement bookkeeping
  if(tournament.stage==='groups'){
    updateGroupStanding(t1_idx, s1, s2, p1);
    updateGroupStanding(t2_idx, s2, s1, p2);
  } else if (tournament.stage==='knockout'){
    // record winner for bracket progression
    const winner = (s1===s2) ? (matchData.penaltyWinner===1?t1_idx:t2_idx) : (s1>s2?t1_idx:t2_idx);
    lastKnockoutWinners.push(winner);
  } else if (tournament.stage==='final'){
    tournament.champion = (s1===s2) ? (matchData.penaltyWinner===1?t1_idx:t2_idx) : (s1>s2?t1_idx:t2_idx);
  }

  gameState='postMatch'; stateTimer=240;
}

function updateGroupStanding(teamId, gf, ga, pts){
  const s = tournament.groupStandings[teamId];
  s.played++; s.goalsFor+=gf; s.goalsAgainst+=ga;
  if(pts===3){ s.wins++; s.points+=3; }
  else if(pts===2){ s.draws++; s.points+=2; } // draw + penalty win
  else if(pts===1){ s.draws++; s.points+=1; }
  else { s.losses++; }
}

// --- Penalty Shootout System (unchanged with minor text) ---
function startPenaltyShootout(){
  gameState='penaltyShootout';
  if(audioStarted)sounds.startPenaltyTension();
  powerUps=[];
  penaltyData={score:{team1:0,team2:0},takerId:1,shotNumber:0,maxShots:3,isSuddenDeath:false,phase:'AIMING',powerMeter:0,powerMeterDir:1,aiDecisionTimer:0,isUserTurn:false,userRole:null,goalieHasDashed:false};
  players.forEach(p=>p.activeInPenalty=true);
  setupNextPenaltyShot();
}
function setupNextPenaltyShot(){
  const attackerTeamId=penaltyData.takerId; const defenderTeamId=attackerTeamId===1?2:1;
  penaltyData.attacker=players.find(p=>p.teamId===attackerTeamId&&p.playerId===0) || players.find(p=>p.teamId===attackerTeamId);
  penaltyData.defender=players.find(p=>p.teamId===defenderTeamId&&p.playerId===4) || players.find(p=>p.teamId===defenderTeamId);
  let penaltySpotX=attackerTeamId===1?width/2-100:width/2+100;
  penaltyData.attacker.pos.set(penaltySpotX,height/2);
  penaltyData.defender.pos.set(attackerTeamId===1?width-50:50,height/2);
  orb=new Orb(penaltySpotX,height/2); orb.vel.mult(0); orb.acc.mult(0);
  penaltyData.phase='AIMING'; penaltyData.powerMeter=0; penaltyData.powerMeterDir=1; penaltyData.goalieHasDashed=false;

  let userTeam=teams.find(t=>t.userTeam);
  let team1Info=teams[matchData.team1_idx]; let team2Info=teams[matchData.team2_idx];
  penaltyData.isUserTurn=false;
  if((attackerTeamId===1&&team1Info.userTeam)||(attackerTeamId===2&&team2Info.userTeam)){ penaltyData.isUserTurn=true; penaltyData.userRole='ATTACKER'; }
  else if((defenderTeamId===1&&team1Info.userTeam)||(defenderTeamId===2&&team2Info.userTeam)){ penaltyData.isUserTurn=true; penaltyData.userRole='GOALIE'; }
  if(!penaltyData.isUserTurn){ penaltyData.aiDecisionTimer=random(60,120); }
}
function runPenaltyShootoutLogic(buffer){
  let{attacker,defender}=penaltyData;
  attacker.update(); defender.update();
  if(penaltyData.phase==='AIMING'){
    penaltyData.powerMeter+=penaltyData.powerMeterDir*2.5;
    if(penaltyData.powerMeter>=100||penaltyData.powerMeter<=0) penaltyData.powerMeterDir*=-1;
    if(!penaltyData.isUserTurn&&penaltyData.userRole!=='GOALIE'){
      penaltyData.aiDecisionTimer--; if(penaltyData.aiDecisionTimer<=0){executeAIKick();}
    }
  } else if(penaltyData.phase==='KICKED'){
    orb.update();
    if(!penaltyData.goalieHasDashed){
      if(!penaltyData.isUserTurn||penaltyData.userRole==='ATTACKER'){
        setTimeout(()=>executeAIDash(),random(100,300)); penaltyData.goalieHasDashed=true;
      }
    }
    checkPenaltyOutcome();
  } else if(penaltyData.phase==='POST_SHOT'){
    stateTimer--; if(stateTimer<=0) endPenaltyShot(penaltyData.scored);
  }
}
function executeUserKick(isGamepad=false){
  if(penaltyData.phase!=='AIMING'||!penaltyData.isUserTurn) return;
  let attacker=penaltyData.attacker; let targetY=isGamepad?height/2:mouseY;
  let power=penaltyData.powerMeter/100; let maxKickForce=40; let kickForce=power*maxKickForce;
  let aimPos=createVector(attacker.teamId===1?width:0,targetY);
  let kickVel=p5.Vector.sub(aimPos,orb.pos); kickVel.setMag(kickForce);
  orb.applyForce(kickVel); if(audioStarted)sounds.playKick(kickForce);
  penaltyData.phase='KICKED';
}
function executeAIKick(){
  let targetY=random(height*.3,height*.7); let power=random(0.3,1);
  let maxKickForce=40; let kickForce=power*maxKickForce;
  let aimPos=createVector(penaltyData.attacker.teamId===1?width:0,targetY);
  let kickVel=p5.Vector.sub(aimPos,orb.pos); kickVel.setMag(kickForce);
  orb.applyForce(kickVel); if(audioStarted)sounds.playKick(kickForce);
  penaltyData.phase='KICKED';
}
function executeUserDash(){ if(penaltyData.goalieHasDashed||!penaltyData.isUserTurn||penaltyData.userRole!=='GOALIE')return; penaltyData.defender.activateDash(p5.Vector.sub(orb.pos,penaltyData.defender.pos)); penaltyData.goalieHasDashed=true; }
function executeAIDash(){ penaltyData.defender.activateDash(p5.Vector.sub(orb.pos,penaltyData.defender.pos)); }
function checkPenaltyOutcome(){
  if(penaltyData.phase!=='KICKED')return;
  const gH=getGoalHeight(), gT=height/2-gH/2, gB=height/2+gH/2; const iGY=orb.pos.y>gT&&orb.pos.y<gB;
  if(orb.pos.dist(penaltyData.defender.pos)<orb.r+penaltyData.defender.r){ orb.vel.mult(-0.5); penaltyData.phase='POST_SHOT'; penaltyData.scored=false; stateTimer=120; return; }
  if(iGY&&(orb.pos.x<1||orb.pos.x>width-1)){ penaltyData.phase='POST_SHOT'; penaltyData.scored=true; stateTimer=120; return; }
  if(orb.pos.x<0||orb.pos.x>width||orb.pos.y<0||orb.pos.y>height||orb.vel.mag()<.1){ penaltyData.phase='POST_SHOT'; penaltyData.scored=false; stateTimer=120; return; }
}
function endPenaltyShot(scored){
  if(scored){ if(penaltyData.takerId===1)penaltyData.score.team1++; else penaltyData.score.team2++; if(audioStarted)sounds.playGoal(); }
  const sT1=penaltyData.takerId===2?floor(penaltyData.shotNumber)+1:floor(penaltyData.shotNumber);
  const sT2=penaltyData.takerId===1?floor(penaltyData.shotNumber):floor(penaltyData.shotNumber)+1;
  const sL1=penaltyData.maxShots-sT1, sL2=penaltyData.maxShots-sT2;
  if(!penaltyData.isSuddenDeath){
    if(penaltyData.score.team1>penaltyData.score.team2+sL2){ matchData.penaltyWinner=1; endMatch(); return; }
    if(penaltyData.score.team2>penaltyData.score.team1+sL1){ matchData.penaltyWinner=2; endMatch(); return; }
  }
  penaltyData.takerId=(penaltyData.takerId===1)?2:1;
  if(penaltyData.takerId===1) penaltyData.shotNumber++;
  if(penaltyData.shotNumber>=penaltyData.maxShots){
    if(penaltyData.score.team1!==penaltyData.score.team2){
      matchData.penaltyWinner=penaltyData.score.team1>penaltyData.score.team2?1:2; endMatch(); return;
    } else penaltyData.isSuddenDeath=true;
  }
  setupNextPenaltyShot();
}

// --- INPUT / EVENTS ---
function handleGamepadAdvance() {
  switch (gameState) {
    case 'title': case 'endOfSeason': case 'leagueTable': case 'preMatch': case 'postMatch':
      if (gameState === 'penaltyShootout') {
        if(penaltyData.isUserTurn) {
          if (penaltyData.userRole === 'ATTACKER') executeUserKick(true);
          if (penaltyData.userRole === 'GOALIE' && penaltyData.phase === 'KICKED') executeUserDash();
        }
      } else {
        handleScreenAdvance();
      }
      break;
  }
}
function handleScreenAdvance() {
  // If HTML start overlay is still visible (e.g., gamepad start), hide it so the canvas is viewable.
  if (typeof document !== 'undefined') {
    const gate = document.getElementById('startOverlay');
    if (gate && gate.style.display !== 'none') gate.style.display = 'none';
  }
  switch (gameState) {
    case 'title': case 'endOfSeason': case 'leagueTable': {
      if (gameState === 'endOfSeason') { initializeLeagueJayLabs(); setupTournament(); }
      // Prepare next match
      const pair = schedule[currentMatchIndex];
      if(!pair){ gameState='endOfSeason'; return; }
      const [n_t1_idx, n_t2_idx] = pair;
      matchData.team1_idx = n_t1_idx; matchData.team2_idx = n_t2_idx;
      gameState = 'preMatch'; stateTimer = 180;
      break;
    }
    case 'preMatch':
      startMatch(matchData.team1_idx, matchData.team2_idx);
      if (inputManager.controlMode === 'mouse') requestPointerLock();
      break;
  }
}
function mousePressed() {
  if (!audioStarted) { userStartAudio(); audioStarted = true; }
  if (gameState === 'penaltyShootout') {
    if (penaltyData.isUserTurn) {
      if (penaltyData.userRole === 'ATTACKER') { executeUserKick(false); } 
      else if (penaltyData.userRole === 'GOALIE' && penaltyData.phase === 'KICKED') { executeUserDash(); }
    }
    return;
  }
  if (['title', 'preMatch', 'leagueTable', 'endOfSeason'].includes(gameState)) {
    handleScreenAdvance(); return;
  }
  if (!document.pointerLockElement && inputManager.controlMode === 'mouse') { requestPointerLock(); }
  let isUM = !teams[matchData.team1_idx].userTeam && !teams[matchData.team2_idx].userTeam;
  if (isUM && ['play', 'overtime'].includes(gameState)) {
    if (mouseX > width - 130 && mouseX < width - 10 && mouseY > 50 && mouseY < 80) { endMatch(); }
    if (mouseX > width - 130 && mouseX < width - 10 && mouseY > 90 && mouseY < 120) {
      if (userControlledPlayer) { userControlledPlayer.isUserControlled = false; userControlledPlayer = null;
      } else { let p = random(players.filter(p => !p.isUserControlled)); if (p) { userControlledPlayer = p; userControlledPlayer.isUserControlled = true; }}
    }
  }
}
function keyPressed(){ if(keyCode===27&&document.pointerLockElement)exitPointerLock(); if(inputManager.controlMode==='mouse'&&keyCode===32&&userControlledPlayer&&userControlledPlayer.dashCooldown===0){ let dashDir=p5.Vector.sub(createVector(mouseX,mouseY),userControlledPlayer.pos); userControlledPlayer.activateDash(dashDir);} }
function windowResized(){ resizeCanvas(windowWidth,windowHeight); effectsBuffer=createGraphics(windowWidth,windowHeight); effectsBuffer.colorMode(HSB,360,100,100,100); effectsBuffer.textFont('sans-serif'); }

// --- DRAWING FUNCTIONS AND CLASSES ---
function drawField(buffer){
  buffer.noStroke();
  for(let i=0;i<height;i+=60){
    let alpha=map(i,0,height,6,2);
    buffer.fill(200,20,20,alpha); buffer.rect(0,i,width,30);
  }
  buffer.stroke(0,0,100,10); buffer.strokeWeight(1);
  for(let x=width*0.15;x<width*0.85;x+=90){ buffer.line(x,20,x,height-20); }
  for(let y=height*0.2;y<height*0.8;y+=70){ buffer.line(20,y,width-20,y); }
  buffer.stroke(0,0,100,10); buffer.strokeWeight(4); buffer.line(width/2,0,width/2,height); buffer.noFill(); buffer.circle(width/2,height/2,180);
  let gW=10, gH=getGoalHeight(), t1C=teams[matchData.team1_idx].color, t2C=teams[matchData.team2_idx].color;
  buffer.noStroke(); buffer.fill(hue(t1C),saturation(t1C),brightness(t1C),50); buffer.rect(0,height/2-gH/2,gW,gH);
  buffer.fill(hue(t2C),saturation(t2C),brightness(t2C),50); buffer.rect(width-gW,height/2-gH/2,gW,gH);
  const matchPoint1=matchData.score.team1>=matchData.firstTo-1, matchPoint2=matchData.score.team2>=matchData.firstTo-1;
  if(matchPoint1){ buffer.fill(hue(t1C),saturation(t1C),brightness(t1C),18); buffer.rect(0,height/2-gH/2-30,40,gH+60); }
  if(matchPoint2){ buffer.fill(hue(t2C),saturation(t2C),brightness(t2C),18); buffer.rect(width-40,height/2-gH/2-30,40,gH+60); }
  if(matchModifiers.solarWind){
    buffer.stroke(200,40,100,25); buffer.strokeWeight(3);
    for(let i=0;i<4;i++){
      let offset=i*80+ (frameCount%120);
      buffer.line(0+offset%width,20,width+offset%width,height-20);
    }
  }
}
function drawGameObjects(buffer){
  if(energyConduit&&gameState!=='penaltyShootout') energyConduit.display(buffer);
  powerUps.forEach(pu=>pu.display(buffer));
  if(gameState==='penaltyShootout'){ if(penaltyData.attacker)penaltyData.attacker.display(buffer); if(penaltyData.defender)penaltyData.defender.display(buffer); }
  else players.forEach(p=>p.display(buffer));
  orb.display(buffer); particles.forEach(p=>p.display(buffer));
}

function drawGameUI(){
  const t1=teams[matchData.team1_idx], t2=teams[matchData.team2_idx];
  const s1=matchData.score.team1, s2=matchData.score.team2; const tBH=40;
  noStroke(); fill(0,0,0,40); rect(0,0,width,tBH);
  textSize(18); textAlign(LEFT,CENTER); fill(t1.color); text(t1.name.toUpperCase(),20,tBH/2);
  textAlign(RIGHT,CENTER); fill(t2.color); text(t2.name.toUpperCase(),width-20,tBH/2);
  textAlign(CENTER,CENTER);
  if(gameState==='play'||gameState==='overtime'){
    let m=floor(matchData.matchTimer/3600), s=floor((matchData.matchTimer%3600)/60);
    textSize(22); fill(0,0,100,gameState==='overtime'?100:70); stroke(gameState==='overtime'?color(30,100,100):0);
    text(nf(m,1)+":"+nf(s,2,0),width/2,tBH/2); noStroke();
  } else if(gameState==='penaltyShootout'){
    textSize(20); fill(0,0,100); text(penaltyData.isSuddenDeath?"SUDDEN DEATH":"PENALTY SHOOTOUT",width/2,tBH/2);
    textSize(32); fill(t1.color); text(penaltyData.score.team1,width/2-150,tBH/2); fill(t2.color); text(penaltyData.score.team2,width/2+150,tBH/2);
  }
  textSize(32); fill(t1.color); text(s1,width/2-80,tBH/2); fill(t2.color); text(s2,width/2+80,tBH/2);

  // Momentum / Hype meters
  const hypeY=tBH+14, hypeW=170, hypeH=10;
  noStroke(); fill(0,0,0,25); rect(width*0.25-hypeW/2,hypeY,hypeW,hypeH,6); rect(width*0.75-hypeW/2,hypeY,hypeW,hypeH,6);
  fill(t1.color); rect(width*0.25-hypeW/2,hypeY,map(hypeMeter.team1,0,120,0,hypeW,true),hypeH,6);
  fill(t2.color); rect(width*0.75-hypeW/2,hypeY,map(hypeMeter.team2,0,120,0,hypeW,true),hypeH,6);
  textAlign(CENTER,CENTER); textSize(11); fill(0,0,100,70); text("HYPE",width*0.25,hypeY+hypeH+8); text("HYPE",width*0.75,hypeY+hypeH+8);

  // Modifiers + wind badge
  const activeMods=Object.keys(matchModifiers).filter(k=>matchModifiers[k]);
  if(activeMods.length){
    let modsTxt=activeMods.map(m=>m.replace(/([A-Z])/g,' $1').toUpperCase()).join(' �?� ');
    textSize(12);
    let boxW=textWidth(modsTxt)+40, boxH=22, boxX=width/2-boxW/2, boxY=tBH+32;
    fill(0,0,0,35); rect(boxX,boxY,boxW,boxH,10);
    fill(0,0,100); text(modsTxt,width/2,boxY+boxH/2);
  }
  if(matchModifiers.solarWind&&windVector){
    push(); translate(width/2,tBH+64); rotate(windVector.heading());
    stroke(200,40,100,70); strokeWeight(3); line(-20,0,20,0); line(14,-6,20,0); line(14,6,20,0);
    noStroke(); fill(200,40,100,40); circle(0,0,14); pop();
    textSize(11); textAlign(CENTER,TOP); fill(0,0,100,70); text("SOLAR WIND",width/2,tBH+68);
  }

  if(userControlledPlayer&&gameState!=='penaltyShootout'){
    let barY=height-40; let pulseW=200,dashW=100,ultW=300;
    let cPulseW=map(userControlledPlayer.pulseCooldown,PULSE_COOLDOWN_TIME,0,0,pulseW,true);
    fill(0,0,100,20); rect(20,barY,pulseW,20,5); fill(userControlledPlayer.pColor); rect(20,barY,cPulseW,20,5);
    textAlign(LEFT,CENTER); textSize(12); fill(0,0,100); text("PULSE",30,barY+10);

    let cDashW=map(userControlledPlayer.dashCooldown,DASH_COOLDOWN_TIME,0,0,dashW,true);
    fill(0,0,100,20); rect(20+pulseW+10,barY,dashW,20,5); fill(180,80,100); rect(20+pulseW+10,barY,cDashW,20,5); text("DASH",20+pulseW+20,barY+10);

    let cUltW=map(userControlledPlayer.ultimateCharge,0,MAX_ULTIMATE_CHARGE,0,ultW,true);
    let ultColor=userControlledPlayer.ultimateCharge>=MAX_ULTIMATE_CHARGE?color(60,100,100):color(300,80,100);
    fill(0,0,100,20); rect(width/2-ultW/2,barY,ultW,20,5); noStroke(); fill(ultColor); rect(width/2-ultW/2,barY,cUltW,20,5);
    if(userControlledPlayer.ultimateCharge>=MAX_ULTIMATE_CHARGE&&frameCount%20<10){ stroke(0,0,100); strokeWeight(3); noFill(); rect(width/2-ultW/2,barY,ultW,20,5);}
    textAlign(CENTER,CENTER); textSize(14); fill(0,0,100); text("ULTIMATE",width/2,barY+10);

    let badgeX=20, badgeY=barY-26;
    const badges=[];
    if(userControlledPlayer.pickupBoost>0) badges.push({label:'BLITZ', col:color(330,80,100), pct:userControlledPlayer.pickupBoost/360});
    if(userControlledPlayer.magnetTimer>0) badges.push({label:'MAG', col:color(200,80,100), pct:userControlledPlayer.magnetTimer/360});
    badges.forEach(b=>{
      let w=80;
      fill(0,0,100,18); rect(badgeX,badgeY,w,16,6);
      fill(b.col); rect(badgeX,badgeY,map(b.pct,0,1,0,w,true),16,6);
      fill(0,0,100); textSize(11); textAlign(LEFT,CENTER); text(b.label,badgeX+6,badgeY+8);
      badgeX+=w+8;
    });
  }

  let isUM=!teams[matchData.team1_idx].userTeam&&!teams[matchData.team2_idx].userTeam;
  if((gameState==='play'||gameState==='overtime')&&isUM){
    textAlign(CENTER,CENTER); textSize(14); fill(0,0,100,50);
    rect(width-130,50,120,30,5); fill(0,0,100); text("Skip to Result",width-70,65);
    fill(0,0,100,50); rect(width-130,90,120,30,5); fill(0,0,100); text(userControlledPlayer?"Release Control":"Take Control",width-70,105);
  }

  if(gameState==='penaltyShootout'&&penaltyData.phase==='AIMING'&&penaltyData.isUserTurn&&penaltyData.userRole==='ATTACKER'){
    let meterWidth=400; let meterHeight=20; let meterX=width/2-meterWidth/2; let meterY=height-60;
    fill(0,0,0,50); rect(meterX,meterY,meterWidth,meterHeight);
    let powerW=map(penaltyData.powerMeter,0,100,0,meterWidth);
    let powerColor=color(map(penaltyData.powerMeter,0,100,60,0),100,100);
    fill(powerColor); rect(meterX,meterY,powerW,meterHeight);
    stroke(0,0,100); strokeWeight(2); noFill(); rect(meterX,meterY,meterWidth,meterHeight);
    let gH=getGoalHeight(),gT=height/2-gH/2; let aimX=penaltyData.attacker.teamId===1?width-10:10; let aimY=constrain(mouseY,gT,gT+gH);
    noFill(); stroke(0,0,100,80); line(aimX-10,aimY,aimX+10,aimY); line(aimX,aimY-10,aimX,aimY+10);
  }
}

function drawIntroScreen(buffer){
  buffer.textAlign(CENTER,TOP); buffer.fill(0,0,100);
  let y=height*.1; buffer.textSize(60);
  buffer.text("JAY MARTOONI'S CHRONO CLASH",width/2,y); y+=100;
  buffer.textAlign(LEFT,TOP); let x=width*.15; let w=width*.7;
  buffer.textSize(24); buffer.text("CONTROLS:",x,y); y+=40; buffer.textSize(16);
  buffer.text("- GAMEPAD (Recommended): Left Stick move. (A/X) Pulse/Advance, (X/Square) Dash, (Y/Triangle) Ultimate.",x,y,w);
  y+=40; buffer.text("- MOUSE + KB: Click to lock mouse. Move mouse to steer. (Left-Click) Pulse/Advance, (Right-Click) Ult, SPACE Dash, ESC unlock.",x,y,w);
  y+=60; buffer.text("MATCH MODIFIERS: Each game may enable Low Gravity, Overclock, Orb Mutation, Shrinking Goals, or Solar Wind drift.",x,y,w);
  y+=40; buffer.text("POWER CORES: Neon cubes drop mid-match for Blitz speed, Ult charge, or Orb magnets.",x,y,w);
  y+=40; buffer.text("TOURNAMENT: Groups -> Knockouts -> Final. Draws go to penalties with bonus point.",x,y,w);
  y+=40;
  const userTeam=teams.find(t=>t.userTeam);
  if(userTeam){ buffer.textSize(20); buffer.textAlign(CENTER,TOP); buffer.fill(userTeam.color); buffer.text(`YOUR TEAM: ${userTeam.name.toUpperCase()}`,width/2,y); y+=30; buffer.fill(0,0,100); buffer.text(`You control Player #${userTeam.selectedPlayerId+1}`,width/2,y); }
  buffer.textAlign(CENTER,CENTER); buffer.textSize(24); buffer.text("Click or Press (A) to Enter the JayLabs Arena.",width/2,height-100);
}

function drawGoalMessage(buffer){
  let sTId=matchData.lastScorerTeamId, sTC=sTId===1?teams[matchData.team1_idx].color:teams[matchData.team2_idx].color;
  buffer.push(); buffer.textAlign(CENTER,CENTER); buffer.textSize(200);
  buffer.fill(0,0,0,50); buffer.text('JAYBLAST!',width/2+10,height/2+10);
  buffer.fill(sTC); buffer.text('JAYBLAST!',width/2,height/2); buffer.pop();
}

function drawPostMatchScreen(buffer){
  buffer.textAlign(CENTER,CENTER);
  const t1=teams[matchData.team1_idx],t2=teams[matchData.team2_idx];
  const s1=matchData.score.team1,s2=matchData.score.team2;
  buffer.textSize(36); buffer.fill(0,0,100); buffer.text("Match Result",width/2,height/2-150);
  buffer.textSize(48); buffer.fill(t1.color); buffer.text(t1.name,width/2,height/2-80); buffer.fill(t2.color); buffer.text(t2.name,width/2,height/2+80);
  buffer.textSize(96); buffer.fill(t1.color); buffer.text(s1,width/2-100,height/2); buffer.fill(t2.color); buffer.text(s2,width/2+100,height/2);
  if(matchData.penaltyWinner!==null){ buffer.textSize(24); let w=matchData.penaltyWinner===1?t1:t2; buffer.fill(w.color); buffer.text(`(${w.name} wins on penalties)`,width/2,height/2+150); }
  // Modifiers recap
  buffer.textSize(18); buffer.fill(0,0,100); let mods = Object.keys(matchModifiers).filter(k=>matchModifiers[k]).map(k=>k.replace(/([A-Z])/g,' $1').toUpperCase()).join(' • ');
  if(mods.length){ buffer.text(`MODIFIERS: ${mods}`, width/2, height-90); }
}

function drawLeagueTable(buffer){
  buffer.textAlign(LEFT,CENTER); buffer.fill(0,0,100); buffer.textSize(48);
  let title = (tournament.stage==='groups') ? "JayLabs Group Standings" :
              (tournament.stage==='knockout') ? "JayLabs Knockout Bracket" :
              (tournament.stage==='final') ? "JayLabs Grand Final" : "League Standings";
  buffer.text(title,50,50);

  if(tournament.stage==='groups'){
    const renderGroup = (label, list, startY)=>{
      buffer.textSize(22); buffer.fill(0,0,100); buffer.text(`Group ${label}`,50,startY);
      let h=['Team','P','W','D','L','GF','GA','Pts'], cW=[280,50,50,50,50,50,50,70], sX=50, y=startY+30;
      buffer.textSize(16); let cX=sX; h.forEach((hh,i)=>{buffer.text(hh,cX,y); cX+=cW[i];}); y+=28;
      let ranked = rankGroup(list);
      ranked.forEach(tid=>{
        const s = tournament.groupStandings[tid];
        let d=[teams[tid].name,s.played,s.wins,s.draws,s.losses,s.goalsFor,s.goalsAgainst,s.points];
        cX=sX; buffer.fill(teams[tid].color); buffer.rect(cX-10,y-10,5,20);
        d.forEach((val,i)=>{ buffer.fill(i==0?teams[tid].color:color(0,0,100)); buffer.text(val,cX,y); cX+=cW[i]; });
        y+=26;
      });
    };
    renderGroup('A', tournament.groups.A, 100);
    renderGroup('B', tournament.groups.B, 100+ (tournament.groups.A.length+2)*26 + 40);
  } else if(tournament.stage==='knockout'){
    buffer.textSize(20);
    const [s1, s2] = tournament.knockout.semifinals;
    let y=120;
    buffer.fill(0,0,100); buffer.text("Semifinals:",50,y); y+=30;
    if(s1){ buffer.fill(teams[s1[0]].color); buffer.text(teams[s1[0]].name,60,y); buffer.fill(0,0,100); buffer.text("vs",320,y); buffer.fill(teams[s1[1]].color); buffer.text(teams[s1[1]].name,360,y); y+=24;}
    if(s2){ buffer.fill(teams[s2[0]].color); buffer.text(teams[s2[0]].name,60,y); buffer.fill(0,0,100); buffer.text("vs",320,y); buffer.fill(teams[s2[1]].color); buffer.text(teams[s2[1]].name,360,y); y+=24;}
  } else if(tournament.stage==='final'){
    buffer.textSize(20); buffer.fill(0,0,100); buffer.text("Grand Final:",50,120);
    const f = tournament.knockout.final[0]; if(f){
      buffer.fill(teams[f[0]].color); buffer.text(teams[f[0]].name,60,150);
      buffer.fill(0,0,100); buffer.text("vs",320,150);
      buffer.fill(teams[f[1]].color); buffer.text(teams[f[1]].name,360,150);
    }
  }

  buffer.textAlign(CENTER,CENTER); buffer.fill(0,0,100); buffer.textSize(24);
  buffer.text("Click or Press (A) for Next Match",width/2,height-60);
}

function drawPreMatchScreen(buffer){
  buffer.textAlign(CENTER,CENTER);
  const t1=teams[matchData.team1_idx],t2=teams[matchData.team2_idx],isUM=t1.userTeam||t2.userTeam;
  buffer.textSize(48); buffer.fill(t1.color); buffer.text(t1.name,width/2,height/2-80);
  buffer.fill(0,0,100); buffer.text('vs',width/2,height/2);
  buffer.fill(t2.color); buffer.text(t2.name,width/2,height/2+80);
  // Show modifiers for this match
  buffer.textSize(16); buffer.fill(0,0,100);
  let mods = Object.keys(matchModifiers).filter(k=>matchModifiers[k]).map(k=>k.replace(/([A-Z])/g,' $1').toUpperCase()).join(' • ');
  if(mods.length){ buffer.text(`Modifiers: ${mods}`,width/2,height/2+130); }
  buffer.textSize(24); buffer.fill(0,0,100); buffer.text(isUM?"Click or Press (A) to Start":"Click or Press (A) to Spectate",width/2,height-100);
}

function drawEndOfSeasonScreen(buffer){
  buffer.textAlign(CENTER,CENTER); buffer.textSize(48); buffer.fill(0,0,100);
  if(tournament.champion!=null){
    buffer.text("Season Over!",width/2,height/2-120); buffer.textSize(32); buffer.text("Champion:",width/2,height/2-50);
    buffer.textSize(72); buffer.fill(teams[tournament.champion].color); buffer.text(teams[tournament.champion].name,width/2,height/2+20);
  }else{
    const sT=[...leagueTable].sort((a,b)=>b.points-a.points); const c=sT[0];
    buffer.text("Season Over!",width/2,height/2-120); buffer.textSize(32); buffer.text("Champion:",width/2,height/2-50);
    buffer.textSize(72); buffer.fill(c.color); buffer.text(c.name,width/2,height/2+20);
  }
  buffer.textSize(24); buffer.fill(0,0,100); buffer.text("Click or Press (A) to Play Again",width/2,height/2+150);
}

// --- ENTITIES ---
class Player {
  constructor(x,y,teamId,teamInfo,playerId){
    this.initialPos=createVector(x,y); this.pos=createVector(x,y);
    this.vel=createVector(0,0); this.acc=createVector(0,0);
    this.r=15; this.maxSpeed=4.2; this.maxForce=0.3;
    this.teamId=teamId; this.pColor=teamInfo.color; this.playerId=playerId;
    this.role='MIDFIELD'; this.isUserControlled=false;
    this.pulseCooldown=0; this.dashCooldown=0; this.isDashing=false; this.dashDuration=0;
    this.pulseEffectTimer=0; this.wobbleOffset=random(1000); this.trail=[];
    this.ultimateCharge=0; this.ultimateActive=false; this.ultimateTimer=0; this.isOvercharged=false;
    this.pickupBoost=0; this.magnetTimer=0;
    this.activeInPenalty=true; this.pendingKickVec=null; this.aiState='IDLE'; this.aiCooldown=0; this.lastDecision=0;
  }
  resetPosition(){ this.pos.set(this.initialPos); this.vel.mult(0); this.acc.mult(0); this.isDashing=false; this.isOvercharged=false; this.pickupBoost=0; this.magnetTimer=0; }
  applyForce(force){ this.acc.add(force); }
  seek(target){
    let speedBase=this.maxSpeed*(matchModifiers.overclock?1.35:1)*hypeMultiplier(this.teamId)*(this.pickupBoost>0?1.25:1);
    let moveSpd=this.isDashing?speedBase*DASH_SPEED_BOOST:(this.isOvercharged?speedBase*1.5:speedBase);
    let d=p5.Vector.sub(target,this.pos); d.setMag(moveSpd); let s=p5.Vector.sub(d,this.vel); s.limit(this.maxForce); this.applyForce(s);
  }
  chargeUltimate(amount){ this.ultimateCharge=min(this.ultimateCharge+amount,MAX_ULTIMATE_CHARGE); }
  handleUserControl(input){
    if(input.controlMode==='mouse'&&!document.pointerLockElement){ this.seek(input.aim); }
    else{ this.vel.add(input.move.mult(this.maxSpeed*0.3*(matchModifiers.overclock?1.35:1))); }
    if(input.pulse&&this.pulseCooldown===0)this.activatePulse();
    if(input.dash&&this.dashCooldown===0){
      let dashDir=input.move.mag()>0.1?input.move.copy():p5.Vector.sub(input.aim,this.pos);
      if(dashDir.mag()===0)dashDir=createVector(1,0); this.activateDash(dashDir);
    }
    if(input.ultimate&&this.ultimateCharge>=MAX_ULTIMATE_CHARGE)this.activateUltimate();
  }
  activatePulse(){
    if(this.pulseCooldown>0)return;
    addHype(this.teamId,6);
    if(audioStarted)sounds.playPulse(); this.pulseEffectTimer=20;
    for(let i=0;i<80;i++)particles.push(new Particle(this.pos.x,this.pos.y,this.pColor,true,null,1.5));
    shockwaves.push(new Shockwave(this.pos.x,this.pos.y,this.pColor,PULSE_RADIUS*2));
    triggerScreenShake(3,10);
    if(this.pos.dist(orb.pos)<PULSE_RADIUS){ let f=p5.Vector.sub(orb.pos,this.pos); f.setMag(PULSE_FORCE); orb.applyForce(f); this.chargeUltimate(50); }
    players.forEach(p=>{ if(p!==this&&p.teamId!==this.teamId&&this.pos.dist(p.pos)<PULSE_RADIUS){ let f=p5.Vector.sub(p.pos,this.pos); f.setMag(PULSE_FORCE*.7); p.applyForce(f);} });
    this.pulseCooldown=PULSE_COOLDOWN_TIME;
  }
  activateDash(direction){
    if(this.dashCooldown>0)return;
    addHype(this.teamId,4);
    if(audioStarted)sounds.playDash(); this.isDashing=true; this.dashDuration=DASH_DURATION; this.dashCooldown=DASH_COOLDOWN_TIME;
    this.vel.add(direction.normalize().mult(10));
    for(let i=0;i<20;i++){ let offset=p5.Vector.random2D().mult(random(this.r)); let pVel=this.vel.copy().mult(-.5).normalize().mult(random(2,5)); particles.push(new Particle(this.pos.x+offset.x,this.pos.y+offset.y,this.pColor,false,pVel)); }
  }
  activateUltimate(){
    if(this.ultimateCharge<MAX_ULTIMATE_CHARGE)return; this.ultimateCharge=0; this.ultimateActive=true;
    addHype(this.teamId,12);
    let ultRole=this.role; if(this.isUserControlled)ultRole=this.playerId<2?'ATTACKER':'GOALIE';
    if(ultRole==='ATTACKER'){
      if(this.pos.dist(orb.pos)<this.r+orb.r+20){ orb.isSingularity=true; orb.singularityPlayer=this; orb.singularityTimer=180;
        if(audioStarted)sounds.playUltimate('SINGULARITY'); triggerScreenShake(15,60);
      }
    } else if(ultRole==='GOALIE'){
      this.ultimateTimer=300; if(audioStarted)sounds.playUltimate('BARRIER'); triggerScreenShake(10,30);
    } else {
      players.forEach(p=>{ if(p.teamId===this.teamId){ p.isOvercharged=true; p.ultimateTimer=300; }});
      if(audioStarted)sounds.playUltimate('OVERCHARGE'); triggerScreenShake(8,20);
    }
  }
  checkCollisionWithOrb(o){
    if(gameState==='penaltyShootout'||this.pos.dist(o.pos)<this.r+o.r&&!o.isSingularity){
      addHype(this.teamId,this.isDashing?3:1.5);
      let kS=this.vel.mag()*1.8+3; if(this.isDashing)kS*=2;
      if(this.vel.mag()>CRITICAL_HIT_THRESHOLD){ o.hotStreak++; kS*=1.5; if(audioStarted)sounds.playCriticalHit();
        floatingTexts.push(new FloatingText(this.pos.x,this.pos.y,"CRITICAL!",color(0,100,100))); shockwaves.push(new Shockwave(o.pos.x,o.pos.y,color(0,100,100),100)); this.chargeUltimate(100);
      } else { o.hotStreak=0; if(audioStarted&&gameState!=='penaltyShootout')sounds.playKick(kS); }
      this.chargeUltimate(ULTIMATE_CHARGE_RATE);
      let kV=p5.Vector.sub(o.pos,this.pos); kV.setMag(kS); o.applyForce(kV);
      if(this.pendingKickVec){
        o.applyForce(this.pendingKickVec.copy());
        this.pendingKickVec=null;
      }
      for(let i=0;i<kS/2;i++)particles.push(new Particle(o.pos.x,o.pos.y,this.pColor));
    }
  }
  update(){
    if(!this.activeInPenalty)return;
    if(gameState!=='penaltyShootout'){
      this.chargeUltimate(.2);
      if(this.pulseCooldown>0)this.pulseCooldown--;
      if(this.dashCooldown>0)this.dashCooldown--;
      if(this.isDashing){ this.dashDuration--; if(this.dashDuration<=0)this.isDashing=false; }
      if(this.pulseEffectTimer>0)this.pulseEffectTimer--;
      if(this.ultimateActive||this.isOvercharged){ this.ultimateTimer--; if(this.ultimateTimer<=0){ this.ultimateActive=false; this.isOvercharged=false; } }
      if(this.pickupBoost>0)this.pickupBoost--;
      if(this.magnetTimer>0)this.magnetTimer--;
    }
    this.vel.add(this.acc);
    let speedBase=this.maxSpeed*(matchModifiers.overclock?1.35:1)*hypeMultiplier(this.teamId)*(this.pickupBoost>0?1.25:1);
    let moveSpd=this.isDashing?speedBase*DASH_SPEED_BOOST:(this.isOvercharged?speedBase*1.5:speedBase);
    this.vel.limit(moveSpd); this.pos.add(this.vel); this.acc.mult(0);
    this.vel.mult(matchModifiers.lowGravity?.992:.97);
    this.pos.x=constrain(this.pos.x,this.r,width-this.r); this.pos.y=constrain(this.pos.y,this.r,height-this.r);
    this.trail.push(this.pos.copy()); if(this.trail.length>20)this.trail.splice(0,1);
  }
  display(buffer){
    if(!this.activeInPenalty)return;
    buffer.noStroke();
    for(let i=0;i<this.trail.length;i++){
      let t_pos=this.trail[i]; let alpha=map(i,0,this.trail.length,0,50); let r_mult=map(i,0,this.trail.length,.2,1);
      if(this.isDashing||this.isOvercharged)alpha*=2; buffer.fill(hue(this.pColor),saturation(this.pColor),brightness(this.pColor),alpha);
      buffer.circle(t_pos.x,t_pos.y,this.r*2*r_mult);
    }
    if(this.pulseEffectTimer>0){
      buffer.noFill(); buffer.stroke(this.pColor); let ratio=(20-this.pulseEffectTimer)/20; buffer.strokeWeight(5*(1-ratio)); buffer.circle(this.pos.x,this.pos.y,PULSE_RADIUS*2*ratio);
    }
    buffer.noStroke(); let glowAlpha=this.isDashing?100:50; if(this.isOvercharged)glowAlpha=100;
    let gC=color(hue(this.pColor),saturation(this.pColor),brightness(this.pColor),glowAlpha);
    buffer.fill(gC); buffer.circle(this.pos.x,this.pos.y,this.r*3);
    buffer.fill(this.pColor); buffer.circle(this.pos.x,this.pos.y,this.r*2);
    if(this.magnetTimer>0){
      buffer.noFill(); buffer.stroke(200,80,100,map(this.magnetTimer,360,0,60,10)); buffer.strokeWeight(2);
      buffer.circle(this.pos.x,this.pos.y,this.r*4.5+sin(frameCount*0.2)*4);
    }
    if(this.isOvercharged&&frameCount%10<5){ buffer.noFill(); buffer.stroke(0,0,100,80); buffer.strokeWeight(3); buffer.circle(this.pos.x,this.pos.y,this.r*3); }
    if(this.ultimateActive&&(this.role==='GOALIE'||(this.isUserControlled&&this.playerId>=3))){
      let goalY=height/2; let goalH=getGoalHeight();
      let barrierX=this.teamId===1?this.pos.x+20:this.pos.x-20; let barrierW=20; let barrierH=goalH; let barrierAlpha=map(this.ultimateTimer,300,0,80,20);
      buffer.fill(hue(this.pColor),80,100,barrierAlpha); buffer.stroke(hue(this.pColor),50,100,100); buffer.strokeWeight(4);
      buffer.rectMode(CENTER); buffer.rect(barrierX,goalY,barrierW,barrierH); buffer.rectMode(CORNER);
      if(orb.pos.x>barrierX-barrierW/2&&orb.pos.x<barrierX+barrierW/2){ orb.vel.x*=-1.5; orb.hotStreak=0; }
    }
    if(this.isUserControlled){ buffer.noFill(); buffer.stroke(0,0,100,80); buffer.strokeWeight(2); buffer.circle(this.pos.x,this.pos.y,this.r*3.5); }
  }
}

class Orb {
  constructor(x,y){
    this.pos=createVector(x,y); this.vel=createVector(0,0); this.acc=createVector(0,0);
    this.r=12; this.maxSpeed=25; this.pColor=color(50,80,100);
    this.isSingularity=false; this.singularityTimer=0; this.singularityPlayer=null; this.hotStreak=0;
    this.bounceFactor = 0.85;
  }
  applyForce(force){ this.acc.add(force); }
  update(){
    if(this.isSingularity){
      this.singularityTimer--; this.vel.mult(.9);
      players.forEach(p=>{ if(p!==this.singularityPlayer){ let d=this.pos.dist(p.pos); if(d<250){ let pull=p5.Vector.sub(this.pos,p.pos); pull.setMag(map(d,0,250,20,0)); p.applyForce(pull);} } });
      if(this.singularityTimer<=0){
        this.isSingularity=false; let explosionForce=40;
        this.vel.set(random(-explosionForce,explosionForce),random(-explosionForce,explosionForce));
        triggerScreenShake(10,20); shockwaves.push(new Shockwave(this.pos.x,this.pos.y,this.pColor,500));
        for(let i=0;i<100;i++)particles.push(new Particle(this.pos.x,this.pos.y,this.pColor,true,null,2));
      }
    }
    this.vel.add(this.acc);
    this.vel.limit(this.hotStreak>2?this.maxSpeed*1.5:this.maxSpeed);
    this.pos.add(this.vel); this.acc.mult(0);
    this.vel.mult(matchModifiers.lowGravity?.993:.985);

    if(this.vel.mag()>1)particles.push(new Particle(this.pos.x,this.pos.y,this.pColor,false,this.vel.copy().mult(-.1)));
    if(this.pos.y>height-this.r||this.pos.y<this.r){
      this.vel.y*=-this.bounce(); this.pos.y=constrain(this.pos.y,this.r,height-this.r); this.hotStreak=0;
    }
    if(gameState==='play'||gameState==='overtime')checkStandardGoal();
    const gH=getGoalHeight(), gT=height/2-gH/2, gB=height/2+gH/2;
    if((this.pos.x>width-this.r||this.pos.x<this.r)&&(this.pos.y<gT||this.pos.y>gB)){
      this.vel.x*=-this.bounce(); this.pos.x=constrain(this.pos.x,this.r,width-this.r); this.hotStreak=0;
    }
  }
  bounce(){
    let b = this.bounceFactor;
    if(matchModifiers.lowGravity) b = min(0.95, b+0.07);
    return b;
  }
  display(buffer){
    if(this.isSingularity){
      let r=this.r*map(this.singularityTimer,180,0,1,4); let suckR=map(this.singularityTimer,180,0,10,250);
      buffer.noStroke(); buffer.fill(0,0,0,80); buffer.circle(this.pos.x,this.pos.y,suckR);
      buffer.fill(270,100,50); buffer.circle(this.pos.x,this.pos.y,r*2);
      if(random()<.5)particles.push(new Particle(this.pos.x+random(-suckR/2,suckR/2),this.pos.y+random(-suckR/2,suckR/2),color(270,100,100),false,p5.Vector.sub(this.pos,createVector(this.pos.x,this.pos.y)).mult(.1),.5));
    } else {
      buffer.noStroke();
      let isHot=this.hotStreak>2; let currentHue=isHot?0:hue(this.pColor); let currentSat=isHot?100:saturation(this.pColor);
      buffer.fill(currentHue,currentSat,brightness(this.pColor),60); buffer.circle(this.pos.x,this.pos.y,this.r*3+this.vel.mag()+(isHot?20:0));
      buffer.fill(currentHue,currentSat,brightness(this.pColor)); buffer.circle(this.pos.x,this.pos.y,this.r*2);
      if(isHot){ for(let i=0;i<3;i++)particles.push(new Particle(this.pos.x,this.pos.y,color(0,100,100),true,null,.5)); }
    }
  }
}

class Particle {
  constructor(x,y,pColor,isPulse=false,vel=null,size=1){
    this.pos=createVector(x,y); this.pColor=pColor; this.isPulse=isPulse; this.lifespan=255;
    this.size=(isPulse?10:6)*size;
    if(vel){ this.vel=vel; this.lifespan=120; }
    else if(isPulse){ this.vel=p5.Vector.random2D().mult(random(3,7)); this.lifespan=80; }
    else{ this.vel=p5.Vector.random2D().mult(random(.5,2)); }
  }
  isAlive(){ return this.lifespan>0; }
  update(){ this.pos.add(this.vel); this.lifespan-=(this.isPulse?5:4); this.vel.mult(.98); }
  display(buffer){ buffer.noStroke(); buffer.fill(hue(this.pColor),saturation(this.pColor),brightness(this.pColor),this.lifespan/255*100); buffer.circle(this.pos.x,this.pos.y,this.size*(this.lifespan/255)); }
}

class FloatingText {
  constructor(x,y,txt,pColor,size=1,life=120){ this.pos=createVector(x,y); this.txt=txt; this.pColor=pColor; this.lifespan=life; this.vel=createVector(0,-1); this.size=size; }
  isAlive(){ return this.lifespan>0; }
  update(){ this.pos.add(this.vel); this.lifespan-=2; }
  display(buffer){ buffer.textAlign(CENTER,CENTER); buffer.textSize(12*this.size); let alpha=map(this.lifespan,120,0,100,0); buffer.fill(hue(this.pColor),saturation(this.pColor),brightness(this.pColor),alpha); buffer.text(this.txt,this.pos.x,this.pos.y); }
}

class Shockwave {
  constructor(x,y,pColor,maxR=200){ this.pos=createVector(x,y); this.pColor=pColor; this.maxR=maxR; this.r=0; this.lifespan=60; }
  isAlive(){ return this.lifespan>0; }
  update(){ this.lifespan--; this.r=map(this.lifespan,60,0,0,this.maxR); }
  display(buffer){ let alpha=map(this.lifespan,60,0,80,0); let sw=map(this.lifespan,60,0,1,10);
    buffer.noFill(); buffer.strokeWeight(sw); buffer.stroke(hue(this.pColor),saturation(this.pColor),brightness(this.pColor),alpha); buffer.circle(this.pos.x,this.pos.y,this.r);
  }
}

class PowerUp{
  constructor(type,pos){ this.type=type; this.pos=pos.copy(); this.r=14; this.lifespan=900; this.phase=random(TWO_PI); }
  update(){ this.lifespan--; this.phase+=0.05; }
  display(buffer){
    if(this.lifespan<=0)return;
    const alpha=map(this.lifespan,900,0,80,0);
    let c=this.type==='boost'?color(330,80,100):this.type==='ultimate'?color(60,100,100):color(200,80,100);
    buffer.push(); buffer.translate(this.pos.x,this.pos.y); buffer.rotate(this.phase*0.5);
    buffer.noFill(); buffer.stroke(hue(c),saturation(c),brightness(c),alpha); buffer.strokeWeight(3);
    buffer.rectMode(CENTER); buffer.rect(0,0,this.r*2.4,this.r*2.4,6); buffer.rectMode(CORNER);
    buffer.strokeWeight(1.5); buffer.circle(0,0,this.r*2+sin(this.phase)*6);
    buffer.fill(hue(c),saturation(c),brightness(c),alpha); buffer.textAlign(CENTER,CENTER); buffer.textSize(10);
    buffer.text(this.type==='boost'?'BLZ':this.type==='ultimate'?'ULT':'MAG',0,1);
    buffer.pop();
  }
}

function handlePlayerCollisions(allPlayers){
  for(let i=0;i<allPlayers.length;i++){
    for(let j=i+1;j<allPlayers.length;j++){
      let p1=allPlayers[i],p2=allPlayers[j];
      if(p1.pos.dist(p2.pos)<p1.r+p2.r){
        let d=p1.pos.dist(p2.pos),mD=p1.r+p2.r; let o=mD-d; let pV=p5.Vector.sub(p1.pos,p2.pos); pV.setMag(o*.5);
        p1.pos.add(pV); p2.pos.sub(pV);
      }
    }
  }
}

class EnergyConduit{
  constructor(){ this.node1=createVector(); this.node2=createVector(); this.spawn(); }
  spawn(){ this.node1.set(random(width*.1,width*.4),random(height*.1,height*.9)); this.node2.set(random(width*.6,width*.9),random(height*.1,height*.9)); this.state='charging'; this.timer=180; }
  update(){ if(this.timer>0){ this.timer--; } else { if(this.state==='charging'){ this.state='active'; this.timer=300; } else { this.spawn(); } } }
  applyEffect(orb){
    if(this.state!=='active')return;
    let d=distToLineSegment(orb.pos,this.node1,this.node2);
    if(d<orb.r){
      let beamVec=p5.Vector.sub(this.node2,this.node1); let normal=createVector(-beamVec.y,beamVec.x).normalize();
      if(p5.Vector.dot(orb.vel,normal)<0)normal.mult(-1);
      orb.vel.reflect(normal); orb.vel.mult(1.8); orb.vel.add(normal.mult(8));
      this.spawn();
      for(let i=0;i<50;i++)particles.push(new Particle(orb.pos.x,orb.pos.y,color(60,100,100),true,null,1.2));
      triggerScreenShake(5,15); orb.hotStreak=0;
    }
  }
  display(buffer){
    if(this.state==='inactive')return;
    buffer.noFill();
    if(this.state==='charging'){
      let ratio=(180-this.timer)/180; buffer.stroke(60,100,100,ratio*50); buffer.strokeWeight(2);
      buffer.circle(this.node1.x,this.node1.y,20*ratio); buffer.circle(this.node2.x,this.node2.y,20*ratio);
      if(frameCount%10<5){ buffer.strokeWeight(1); buffer.line(this.node1.x,this.node1.y,this.node2.x,this.node2.y); }
    }else if(this.state==='active'){
      buffer.stroke(60,100,100); buffer.strokeWeight(4); buffer.line(this.node1.x,this.node1.y,this.node2.x,this.node2.y);
      buffer.strokeWeight(8); buffer.stroke(60,100,100,40); buffer.line(this.node1.x,this.node1.y,this.node2.x,this.node2.y);
    }
  }
}

function distToLineSegment(p,v,w){
  let l2=p5.Vector.dist(v,w); l2*=l2; if(l2==0)return p5.Vector.dist(p,v);
  let t=max(0,min(1,p5.Vector.dot(p5.Vector.sub(p,v),p5.Vector.sub(w,v))/l2));
  let proj=p5.Vector.add(v,p5.Vector.mult(p5.Vector.sub(w,v),t));
  return p5.Vector.dist(p,proj);
}

// === Pointer Lock helpers ===
function requestPointerLock(){ if(canvas && canvas.requestPointerLock) canvas.requestPointerLock(); }
function exitPointerLock(){ if(document.exitPointerLock) document.exitPointerLock(); }
