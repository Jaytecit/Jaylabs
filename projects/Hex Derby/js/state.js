// Matter.js aliases
const { Engine, World, Bodies, Body, Vector, Events } = Matter;

// Load parameters from localStorage or use defaults
let P = { ...DEFAULTS };

// Game state variables
let engine, world, balls = [], walls = [];
let starfield = [], impacts = [], sparks = [];
let gameState = 'pre'; // pre | countdown | playing | gameover
let freePeople = [];
let countdownEndAt = 0;
let playgroundMode = false; // Toggle between normal betting mode and playground parameter mode
let arena = {
  sides: 6,
  radius: P.arenaRadius,
  wallThickness: P.wallThickness,
  rotation: 0,
  rotSpeed: P.spinStart,
  rotAccel: P.spinAccel,
  spinMax: P.spinMax,
  center: { x: 0, y: 0 },
  gapOrder: [],
  gapsOpened: 0,
  gapWidths: [],
  baseGapWidth: 40,
  widening: false,
  widenRate: P.widenRate,
  firstGapDelay: P.firstGap * 1000,
  gapInterval: P.gapInterval * 1000,
  nextGapAt: 0
};
let camera = { zoom: 1, targetZoom: 1, slowmo: 1, targetSlowmo: 1 };

const DEFAULT_BANKROLL = 1000;
let bankroll = (() => {
  const s = parseInt(localStorage.getItem('hexderby_bankroll'), 10);
  return Number.isFinite(s) && s >= 0 ? s : DEFAULT_BANKROLL; // Allow 0 bankroll
})();
let selectedBallId = null, selectedStake = 0, lockedBet = null;
let selectedBallId2 = null; // For pair bets (EXACTA/QUINELLA)

// Enhanced betting state
let bets = [];          // Active bets for the current round
let lastBets = [];      // Copy of previous round's bets for Rebet
let finishingOrder = []; // Records elimination order; winner will be appended last

// Tournament state
let tournamentMode = false;
let tournament = {
  active: false,
  currentMatch: 0,
  totalMatches: 5,
  participantHistory: [], // Array of arrays: each element contains the ball IDs for that match
  eliminationHistory: [], // Array of arrays: each element contains eliminated ball IDs for that match
  survivorCount: [12, 8, 6, 4, 2, 1], // Number of balls that should survive each match (index 0 = start)
  eliminationCount: [4, 2, 2, 2, 1], // Number to eliminate each match
  ballSeedings: {}, // Ball ID -> seeding rank (1-12)
  ballStats: {}, // Ball ID -> { matches: 0, eliminations: 0, totalDamage: 0, health: 200 }
  tournamentBets: [], // Long-term tournament bets (tournament winner, reach final, etc.)
  bracketResults: [], // Results of each completed match
  champion: null
};