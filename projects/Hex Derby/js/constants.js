// Default game parameters
const DEFAULTS = {
  arenaRadius: 450,
  wallThickness: 6,
  spinStart: 0.00,
  spinAccel: 0.000005,
  spinMax: 0.1,
  gravityY: 0.45,
  tanPush: 0.01,
  dropKick: 3,
  firstGap: 30,
  gapInterval: 30,
  widenRate: 0.15,
  gapMargin: 20,
  ballCount: 12,
  ballMin: 20,
  ballMax: 40,
  restitution: 1.5,// Ball bounciness (slightly below elastic)
  air: 0.01,
  wallFriction: 0.05, // Reduced from 0.1 to prevent sticking at gap edges
  wallRestitution: 1.5, // Match ball for consistent rebounds
  ballFriction: 0.1,
  ballRepulsionForce: 0.2, // Lower repulsion force
  ballRepulsionMultiplier: 8, // Lower repulsion multiplier
  ballCollisionSparkCount: 10,
  ballInitialAngularVelocityMax: 0.15,
  sparkMinSpeed: 0.2,
  sparkMaxSpeed: 2,
  sparkLife: 1,
  impactLifeDecay: 0.03,
  impactPowerMultiplier: 0.05,
  ballMaxHealth: 200, // New constant for ball health

  // Damage model parameters
  damageScale: 0.2, // Lower base damage
  damageThreshold: 3, // Higher threshold before damage
  damageExponent: 1.2, // Lower exponent for less scaling
  wallDamageMultiplier: 0.05, // Lower wall collision damage
  spinDamageMultiplier: 0.05, // Lower spin damage

  // Sustained contact behavior
  sustainedContactIntervalMs: 50,
  sustainedDamageScale: 0.025,

  // Safety clamps
  minDamagePerHit: 0.5,
  maxDamagePerHit: 5,

  // Betting parameters
  houseMargin: 0.2,      // 10% bookmaker margin on decimal odds
  top3Factor: 2.5        // Approx multiplier on win probability for Top3
};
const COLORS = [
  '#5ad1ff','#ff7ee6','#eaff5a','#7cffb7','#ff9b5a',
  '#a99bff','#7af7ff','#ffeb8a','#ffa5b0','#8df58a'
];

const BALL_NAMES = [
  "JayBoi", "HexBot", "DerbyDude", "LabRat", "Martooni", "HexHammer", "DerbyKing",
  "ArenaAce", "PhysiX", "Combatant", "JayStriker", "HexWarrior",
  "DerbyDash", "MartooniMech", "ArenaBrawler", "PhysicsPro", "CombatCore"
];

const SOUNDS = {
  gameStart: 'game_start.wav',
  buttonClick: 'button_click.wav',
  countdownBeep: 'countdown_beep.wav',
  ballDrop: 'ball_drop.wav',
  ballCollision: 'ball_collision.wav',
  explosion: 'explosion.wav',
  gapOpen: 'gap_open.wav',
  gameOver: 'game_over.wav',
  win: 'win.wav',
  lose: 'lose.wav'
};
