let currentSelectedStake = 0;
let currentSelectedBalls = []; // Stores IDs of balls selected for the current bet

// Match timer state
let matchTimer = {
  startTime: null,
  isRunning: false,
  intervalId: null
};

function showBanner(html){
  const div=document.createElement('div');
  div.className='centerBanner';
  
  // Check if we have detailed match results to display
  let bannerContent = html;
  if (window.lastMatchResults && (window.lastMatchResults.totalWinners > 0 || window.lastMatchResults.totalLosers > 0)) {
    bannerContent += createDetailedResultsDisplay();
  }
  
  bannerContent += `<div class="sub">Click "New Match" for next round</div>`;
  div.innerHTML = bannerContent;
  document.body.appendChild(div);
  // Banner is now removed by resetMatch()
}

function createDetailedResultsDisplay() {
  const results = window.lastMatchResults;
  if (!results) return '';

  let details = '<div class="match-results">';

  // Show winning bets (always display section)
  details += '<div class="results-section"><strong style="color: #b7ffb7;">Winning Bets:</strong>';
  if (results.winningBets.length > 0) {
    for (const bet of results.winningBets) {
      const ballNames = bet.ballIds.map(id => `#${id + 1}`).join(' & ');
      details += `<div class="bet-result">
        ${bet.type} on ${ballNames}: £${numberWithCommas(bet.stake)} → <span style="color: #b7ffb7;">£${numberWithCommas(bet.winnings)}</span>
      </div>`;
    }
  } else {
    details += '<div class="bet-result">None</div>';
  }
  details += '</div>';

  // Show losing bets (always display section)
  details += '<div class="results-section"><strong style="color: #ff9999;">Lost Bets:</strong>';
  if (results.losingBets.length > 0) {
    for (const bet of results.losingBets) {
      const ballNames = bet.ballIds.map(id => `#${id + 1}`).join(' & ');
      details += `<div class="bet-result">
        ${bet.type} on ${ballNames}: <span style="color: #ff9999;">-£${numberWithCommas(bet.stake)}</span>
      </div>`;
    }
  } else {
    details += '<div class="bet-result">None</div>';
  }
  details += '</div>';

  details += '</div>';
  return details;
}

function bindUI(){
  const restartBtn = document.getElementById('restart');
  if (restartBtn) {
    restartBtn.textContent = 'New Match';
    restartBtn.onclick = () => { playSound('buttonClick'); resetMatch(); };
  }
  document.getElementById('audio').onclick = toggleAudio;
  document.getElementById('playgroundMode').onclick = togglePlaygroundMode;
  document.getElementById('tournamentMode').onclick = toggleTournamentMode;
  
  // Back to menu button
  const backBtn = document.getElementById('backToMenu');
  if (backBtn) backBtn.onclick = returnToMainMenu;
  
  // Match phase navigation
  const returnToBettingBtn = document.getElementById('returnToBetting');
  if (returnToBettingBtn) returnToBettingBtn.onclick = returnToBettingPhase;
  
  const returnToMainMenuBtn = document.getElementById('returnToMainMenu');
  if (returnToMainMenuBtn) returnToMainMenuBtn.onclick = returnToMainMenu;

  // Betting phase navigation
  const bettingReturnToMenuBtn = document.getElementById('bettingReturnToMenu');
  if (bettingReturnToMenuBtn) bettingReturnToMenuBtn.onclick = returnToMainMenu;
  
  // Duplicate audio buttons (we have two sets now)
  const audio2Btn = document.getElementById('audio2');
  if (audio2Btn) audio2Btn.onclick = toggleAudio;

  // New betting UI elements
  document.querySelectorAll('#bettingControls .stake-buttons .btn[data-bet]').forEach(btn => {
      btn.onclick = () => {
        playSound('buttonClick');
        setStake(parseInt(btn.dataset.bet, 10));
        // Highlight selected stake button
        document.querySelectorAll('#bettingControls .stake-buttons .btn').forEach(b => b.classList.remove('selected-stake'));
        btn.classList.add('selected-stake');
      };
  });
  document.getElementById('betAll').onclick = () => {
    playSound('buttonClick');
    setStake(bankroll);
    document.querySelectorAll('#bettingControls .stake-buttons .btn').forEach(b => b.classList.remove('selected-stake'));
    document.getElementById('betAll').classList.add('selected-stake');
  };
  document.getElementById('resetBank').onclick = () => { playSound('buttonClick'); bankroll=DEFAULT_BANKROLL; persistBankroll(); updateBankrollUI(); };
  document.getElementById('start').onclick = onStartMatch;
  // Settings open from UI
  const openSettingsBtn = document.getElementById('openSettings');
  const openSettingsFromMenu = document.getElementById('openSettingsFromMenu');
  const settingsModal = document.getElementById('settingsModal');
  if (openSettingsBtn && settingsModal) openSettingsBtn.onclick = ()=>{ settingsModal.style.display='flex'; };
  if (openSettingsFromMenu && settingsModal) openSettingsFromMenu.onclick = ()=>{ settingsModal.style.display='flex'; };

  // New Game buttons
  const newGameBtn = document.getElementById('newGame');
  const newGameBtnMenu = document.getElementById('newGameFromMenu');
  if (newGameBtn) newGameBtn.onclick = newGameReset;
  if (newGameBtnMenu) newGameBtnMenu.onclick = newGameReset;

  const betTypeSel = document.getElementById('betType');
  if (betTypeSel) {
    // Clear existing options
    betTypeSel.innerHTML = '';
    
    // Determine which bet types to show
    let availableBetTypes;
    if (tournament.active) {
      // Tournament mode: show tournament-specific bets
      if (tournament.currentMatch === 1) {
        // First match: show both match and tournament-long bets
        availableBetTypes = [
          { value: TOURNAMENT_BET_TYPES.MATCH_WIN, text: 'Match Winner' },
          { value: TOURNAMENT_BET_TYPES.TOURNAMENT_WIN, text: 'Tournament Winner' },
          { value: TOURNAMENT_BET_TYPES.REACH_FINAL, text: 'Reach Final' },
          { value: TOURNAMENT_BET_TYPES.REACH_SEMI, text: 'Reach Semi-Final' },
          { value: TOURNAMENT_BET_TYPES.MATCH_ELIMINATION, text: 'Match Elimination' }
        ];
      } else {
        // Later matches: only match-specific bets
        availableBetTypes = [
          { value: TOURNAMENT_BET_TYPES.MATCH_WIN, text: 'Match Winner' },
          { value: TOURNAMENT_BET_TYPES.MATCH_ELIMINATION, text: 'Match Elimination' }
        ];
      }
    } else {
      // Normal mode: show standard bet types
      availableBetTypes = [
        { value: BET_TYPES.WIN, text: 'Win' },
        { value: BET_TYPES.TOP3, text: 'Top 3' },
        { value: BET_TYPES.EXACTA, text: 'Exacta (1st-2nd)' },
        { value: BET_TYPES.QUINELLA, text: 'Quinella (Any order 1st/2nd)' }
      ];
    }
    
    // Add options to select
    availableBetTypes.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type.value;
      opt.textContent = type.text;
      betTypeSel.appendChild(opt);
    });
    
    betTypeSel.onchange = () => { playSound('buttonClick'); updateBetUI(); };
  }
  const addBtn = document.getElementById('addBet');
  if (addBtn) addBtn.onclick = () => { playSound('buttonClick'); addBetFromSelection(); };
  const rebetBtn = document.getElementById('rebet');
  if (rebetBtn) rebetBtn.onclick = () => { playSound('buttonClick'); rebet(); };

  updateBankrollUI();
  if (typeof updateBetSlip === 'function') updateBetSlip();
}

function updateBankrollUI(){
  // Skip bankroll UI updates in playground mode
  if (playgroundMode) return;
  
  const bankElement = document.getElementById('bank');
  if (bankElement) {
    bankElement.textContent = `£${numberWithCommas(bankroll)}`;
  } else {
    console.warn("Bank element not found in DOM.");
  }
}

function updateBetUI(){
  // Skip bet UI updates in playground mode
  if (playgroundMode) return;
  
  updateBankrollUI();
  const betType = (document.getElementById('betType')||{}).value || BET_TYPES.WIN;
  const probs = computeBallWinProbs();

  balls.forEach(b => {
    const entry = document.getElementById(`ball-health-${b.id}`);
    if (!entry) return;

    // Update odds display for each ball
    const oddsEl = entry.querySelector('.ball-odds');
    if (oddsEl) {
      if (betType === BET_TYPES.WIN) {
        const o = offeredOddsFromProb(probs.get(b.id) || 0.0001);
        oddsEl.textContent = o.toFixed(2);
      } else if (betType === BET_TYPES.TOP3) {
        const pWin = probs.get(b.id) || 0.0001;
        const pTop3 = Math.min(1, pWin * (P.top3Factor || 2.5));
        const o = offeredOddsFromProb(pTop3);
        oddsEl.textContent = o.toFixed(2);
      } else {
        oddsEl.textContent = 'pick 2'; // For EXACTA/QUINELLA, odds are for pairs
      }
    }

    // Highlight selected balls for the current bet
    if (currentSelectedBalls.includes(b.id)) {
      entry.classList.add('selected-for-bet');
    } else {
      entry.classList.remove('selected-for-bet');
    }
  });

  // Update the "Selected" text based on currentSelectedBalls
  const selEl = document.getElementById('sel'); // This element is removed from HTML, will need to be added back or removed from JS
  if (selEl) { // Keep this check for now, will remove if not needed
    let selText = 'None';
    if (currentSelectedBalls.length > 0) {
      selText = currentSelectedBalls.map(id => {
        const ball = balls.find(b => b.id === id);
        return ball ? `<span class="colorDot" style="background:${ball.renderColor}"></span> #${ball.id + 1}` : `#${id + 1}`;
      }).join(' + ');
    }
    selEl.innerHTML = selText;
  }

  // Update the "Odds" text based on currentSelectedBalls
  const oddsDisplayEl = document.getElementById('odds'); // This element is removed from HTML, will need to be added back or removed from JS
  if (oddsDisplayEl) { // Keep this check for now, will remove if not needed
    const currOdds = computeCurrentSelectionOdds();
    oddsDisplayEl.textContent = (currOdds ? currOdds.toFixed(2) : '—');
  }

  recomputeBallStakeTotals(); // Ensure this is called to update total stakes
}

function showBanner(html){
  const div=document.createElement('div');
  div.className='centerBanner';
  div.innerHTML = html + `<div class="sub">Click “Restart” for next round</div>`;
  document.body.appendChild(div);
  // Banner is now removed by resetMatch()
}


function updateBallHealthDisplay(){
  const container = document.getElementById('ballHealthDisplay');

  // Update each entry's health bar and color
  balls.forEach(ball => {
    const ballEntry = document.getElementById(`ball-health-${ball.id}`);
    if (ballEntry) {
      const healthBar = ballEntry.querySelector('.health-bar');
      const healthPercentage = Math.max(0, ball.health / P.ballMaxHealth) * 100;
      healthBar.style.width = `${healthPercentage}%`;

      // Optional: Change color based on health
      if (healthPercentage > 60) {
        healthBar.style.backgroundColor = '#4CAF50'; // Green
      } else if (healthPercentage > 30) {
        healthBar.style.backgroundColor = '#FFEB3B'; // Yellow
      } else {
        healthBar.style.backgroundColor = '#F44336'; // Red
      }

      // Store current value for potential CSS/data uses
      ballEntry.dataset.health = String(ball.health);

      // Add/remove 'selected-for-bet' class based on currentSelectedBalls
      if (currentSelectedBalls.includes(ball.id)) {
        ballEntry.classList.add('selected-for-bet');
      } else {
        ballEntry.classList.remove('selected-for-bet');
      }
    }
  });

  // Reorder entries to form a leaderboard (highest health at the top)
  if (container) {
    const sorted = [...balls].sort((a, b) => b.health - a.health);
    sorted.forEach((ball, idx) => {
      const entry = document.getElementById(`ball-health-${ball.id}`);
      if (entry) {
        container.appendChild(entry); // appending moves the node to the new position
      }
    });
  }

  // Update stake amounts shown per ball
  recomputeBallStakeTotals();
  if (typeof updateMatchStatusHeaderEnhanced === 'function') updateMatchStatusHeaderEnhanced();
  
  // Reposition playground arena controls if in playground mode
  if (playgroundMode) {
    positionPlaygroundArenaControls();
  }
}

// ===== Match Timer Functions =====
function startMatchTimer() {
  if (matchTimer.isRunning) return; // Already running
  
  matchTimer.startTime = Date.now();
  matchTimer.isRunning = true;
  
  const timerElement = document.getElementById('matchTimer');
  if (timerElement) {
    timerElement.style.display = 'block';
  }
  
  // Update timer every 100ms for smooth display
  matchTimer.intervalId = setInterval(updateMatchTimer, 100);
}

function stopMatchTimer() {
  if (!matchTimer.isRunning) return; // Not running
  
  matchTimer.isRunning = false;
  
  if (matchTimer.intervalId) {
    clearInterval(matchTimer.intervalId);
    matchTimer.intervalId = null;
  }
}

function resetMatchTimer() {
  stopMatchTimer();
  matchTimer.startTime = null;
  
  const timerElement = document.getElementById('matchTimer');
  if (timerElement) {
    timerElement.style.display = 'none';
    timerElement.textContent = '00:00';
  }
}

function updateMatchTimer() {
  if (!matchTimer.isRunning || !matchTimer.startTime) return;
  
  const elapsed = Date.now() - matchTimer.startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  
  const timerElement = document.getElementById('matchTimer');
  if (timerElement) {
    timerElement.textContent = formattedTime;
  }
}

// ===== Betting helpers =====
const BET_TYPES = { WIN:'WIN', TOP3:'TOP3', EXACTA:'EXACTA', QUINELLA:'QUINELLA' };

// Tournament-specific bet types
const TOURNAMENT_BET_TYPES = {
  // Per-match bets (available before each match)
  MATCH_WIN: 'MATCH_WIN',
  MATCH_ELIMINATION: 'MATCH_ELIMINATION', 
  MATCH_SURVIVAL: 'MATCH_SURVIVAL',
  
  // Tournament-long bets (available before tournament starts)
  TOURNAMENT_WIN: 'TOURNAMENT_WIN',
  REACH_FINAL: 'REACH_FINAL',
  REACH_SEMI: 'REACH_SEMI',
  FIRST_OUT: 'FIRST_OUT',
  
  // Advanced bets
  ELIMINATION_ORDER: 'ELIMINATION_ORDER',
  PERFECT_BRACKET: 'PERFECT_BRACKET'
};

function computeBallWinProbs(){
  // Strength proxy by radius (simple heuristic)
  const eps = 0.00001;
  const strengths = balls.map(b=>Math.max(eps, b.circleRadius||1));
  const sum = strengths.reduce((a,b)=>a+b,0) || 1;
  const probs = new Map();
  balls.forEach((b,i)=>probs.set(b.id, Math.max(eps, strengths[i]/sum)));
  return probs;
}

function offeredOddsFromProb(p){
  const adj = Math.max(0.0001, p);
  const dec = 1 / (adj * (1 + (P.houseMargin||0)));
  return Math.max(1.1, dec);
}

function computeCurrentSelectionOdds(){
  const betType = (document.getElementById('betType')||{}).value || BET_TYPES.WIN;
  const [id1, id2] = currentSelectedBalls; // Use currentSelectedBalls

  // Handle tournament bet types
  if (tournament.active && Object.values(TOURNAMENT_BET_TYPES).includes(betType)) {
    if (id1 == null) return null;
    return computeTournamentOdds(id1, betType);
  }

  // Handle normal bet types
  const probs = computeBallWinProbs();

  if (betType===BET_TYPES.WIN){
    if (id1==null) return null;
    return offeredOddsFromProb(probs.get(id1)||0.0001);
  }
  if (betType===BET_TYPES.TOP3){
    if (id1==null) return null;
    const pWin = probs.get(id1)||0.0001;
    const pTop3 = Math.min(1, pWin * (P.top3Factor||2.5));
    return offeredOddsFromProb(pTop3);
  }
  if (betType===BET_TYPES.EXACTA){
    if (id1==null || id2==null || id1===id2) return null;
    const pA = probs.get(id1)||0.0001;
    const pB = probs.get(id2)||0.0001;
    const cond = Math.max(0.0001, 1 - pA);
    const p = Math.min(1, pA * (pB/cond));
    return offeredOddsFromProb(p);
  }
  if (betType===BET_TYPES.QUINELLA){
    if (id1==null || id2==null || id1===id2) return null;
    const pA = probs.get(id1)||0.0001;
    const pB = probs.get(id2)||0.0001;
    const condA = Math.max(0.0001, 1 - pA);
    const condB = Math.max(0.0001, 1 - pB);
    const p = Math.min(1, pA*(pB/condA) + pB*(pA/condB));
    return offeredOddsFromProb(p);
  }
  return null;
}

/* ===== Tournament Odds Calculation ===== */
function computeTournamentOdds(ballId, betType) {
  if (!tournament.active) return null;
  
  const ballStats = tournament.ballStats[ballId];
  if (!ballStats) return null;
  
  // Base probability calculation using seeding and current performance
  const seedingFactor = (13 - ballStats.seeding) / 12; // Higher seeded balls get better odds
  const healthFactor = ballStats.health / P.ballMaxHealth; // Current health affects odds
  const matchPerformance = ballStats.matches > 0 ? (ballStats.matches - ballStats.eliminations) / ballStats.matches : 1;
  
  let baseProbability = (seedingFactor * 0.4 + healthFactor * 0.4 + matchPerformance * 0.2);
  
  switch (betType) {
    case TOURNAMENT_BET_TYPES.TOURNAMENT_WIN:
      // Very long odds for tournament winner
      const remainingMatches = tournament.totalMatches - tournament.currentMatch + 1;
      const adjustedProb = Math.pow(baseProbability, remainingMatches) / balls.length;
      return offeredOddsFromProb(adjustedProb);
      
    case TOURNAMENT_BET_TYPES.MATCH_WIN:
      // Standard match win odds but adjusted for tournament context
      return offeredOddsFromProb(baseProbability / balls.length);
      
    case TOURNAMENT_BET_TYPES.REACH_FINAL:
      // Probability of reaching the final match
      const matchesToFinal = Math.max(0, tournament.totalMatches - tournament.currentMatch);
      const finalProb = Math.pow(baseProbability, matchesToFinal * 0.7);
      return offeredOddsFromProb(finalProb);
      
    case TOURNAMENT_BET_TYPES.REACH_SEMI:
      // Probability of reaching semi-finals (match 4 or 5)
      const matchesToSemi = Math.max(0, Math.min(2, tournament.totalMatches - tournament.currentMatch - 1));
      const semiProb = Math.pow(baseProbability, matchesToSemi * 0.8);
      return offeredOddsFromProb(semiProb);
      
    case TOURNAMENT_BET_TYPES.MATCH_ELIMINATION:
      // Inverse probability for elimination bets
      return offeredOddsFromProb(1 - baseProbability / balls.length);
      
    default:
      return offeredOddsFromProb(baseProbability / balls.length);
  }
}

function addBetFromSelection(options = {}){
  const { keepStake = false } = options;
  if (gameState!=='pre') return alert('Bets can only be placed before the match starts.');
  if (bankroll<=0) return alert('Insufficient funds. Your account balance must be greater than 0.');
  const stake = Math.floor(currentSelectedStake||0); // Use currentSelectedStake
  if (!(stake>0)) return alert('Please choose a stake.');
  if (stake>bankroll) return alert('Stake exceeds bankroll.');

  const betType = (document.getElementById('betType')||{}).value || BET_TYPES.WIN;
  const odds = computeCurrentSelectionOdds();
  if (!odds) return alert('Please select valid competitors for this bet type.');
  if (currentSelectedBalls.length === 0) return alert('Please select at least one ball for your bet.');

  const bet = { type: betType, stake, odds, ids: currentSelectedBalls.slice() };

  if (tournament.active && (betType === TOURNAMENT_BET_TYPES.TOURNAMENT_WIN || betType === TOURNAMENT_BET_TYPES.REACH_FINAL || betType === TOURNAMENT_BET_TYPES.REACH_SEMI || betType === TOURNAMENT_BET_TYPES.FIRST_OUT)) {
    // Long-term tournament bet
    tournament.tournamentBets.push(bet);
  } else {
    // Match bet (normal or tournament match-specific)
    bets.push(bet);
  }
  bankroll -= stake; persistBankroll();
  updateBankrollUI();
  updateBetSlip();
  recomputeBallStakeTotals();

  // After placing the bet, clear selected balls; keep or clear stake per option
  currentSelectedBalls = [];
  if (!keepStake) {
    currentSelectedStake = 0;
    document.querySelectorAll('#bettingControls .stake-buttons .btn').forEach(b => b.classList.remove('selected-stake'));
  }
  updateBetUI();
}

function updateBetSlip(){
  const wrap = document.getElementById('betItems'); if (!wrap) return;
  wrap.innerHTML = '';
  bets.forEach((b, i)=>{
    const mkTag = id=>{
      const ball = balls.find(x=>x.id===id);
      return ball ? `<span class="colorDot" style="background:${ball.renderColor}"></span> #${ball.id+1}` : `#${id+1}`;
    };
  let desc = '';
  if (b.type===BET_TYPES.WIN) desc = `WIN ${mkTag(b.ids[0])}`;
  if (b.type===BET_TYPES.TOP3) desc = `TOP3 ${mkTag(b.ids[0])}`;
  if (b.type===BET_TYPES.EXACTA) desc = `EXACTA ${mkTag(b.ids[0])} » ${mkTag(b.ids[1])}`;
  if (b.type===BET_TYPES.QUINELLA) desc = `QUINELLA ${mkTag(b.ids[0])} & ${mkTag(b.ids[1])}`;
    const div=document.createElement('div');
    div.className='betItem';
    div.innerHTML = `${desc} — £${numberWithCommas(b.stake)} @ ${b.odds.toFixed(2)}`;
    wrap.appendChild(div);
  });
}

function rebet(){
  if (gameState!=='pre') return alert('Rebet is only available before the match starts.');
  if (!lastBets || lastBets.length===0) return alert('No previous bets to rebet.');

  for (const b of lastBets){
    if (bankroll<=0) break;
    if (b.stake>bankroll) continue; // skip if insufficient
    bets.push({...b});
    bankroll -= b.stake;
  }
  persistBankroll();
  updateBankrollUI();
  updateBetSlip();
  recomputeBallStakeTotals();
}

function recomputeBallStakeTotals(){
  // Aggregate stakes per ball
  const totals = new Map();
  for (const b of bets){
    if (!Array.isArray(b.ids)) continue;
    if (b.type===BET_TYPES.WIN || b.type===BET_TYPES.TOP3 || b.type===TOURNAMENT_BET_TYPES.TOURNAMENT_WIN || b.type===TOURNAMENT_BET_TYPES.REACH_FINAL || b.type===TOURNAMENT_BET_TYPES.REACH_SEMI || b.type===TOURNAMENT_BET_TYPES.FIRST_OUT) {
      const id = b.ids[0];
      if (typeof id !== 'undefined') totals.set(id, (totals.get(id)||0) + (b.stake||0));
    } else if (b.type===BET_TYPES.EXACTA || b.type===BET_TYPES.QUINELLA || b.type===TOURNAMENT_BET_TYPES.ELIMINATION_ORDER) {
      const s = (b.stake||0)/Math.max(1, b.ids.length); // split attribution
      for (const id of b.ids) {
        if (typeof id !== 'undefined') totals.set(id, (totals.get(id)||0) + s);
      }
    }
  }
  // Update UI labels
  balls.forEach(ball=>{
    const entry = document.getElementById(`ball-health-${ball.id}`);
    if (!entry) return;
    const stakeColumn = entry.querySelector('.ball-stake-column');
    if (stakeColumn) {
      const amt = totals.get(ball.id)||0;
      stakeColumn.textContent = amt>0 ? `£${numberWithCommas(Math.floor(amt))}` : '';
      stakeColumn.style.cssText = 'text-align: right; opacity: 0.85; font-size: 12px; color: #ffe8a6;';
    }
  });
}

/* ===== Playground Mode Functions ===== */
function togglePlaygroundMode() {
  // Prevent switching to playground mode during active betting matches
  if (!playgroundMode && (gameState !== 'pre' || bets.length > 0)) {
    alert('Cannot enter Playground Mode while a match is active or bets are placed. Please wait for the match to complete or restart.');
    return;
  }
  
  playgroundMode = !playgroundMode;
  const button = document.getElementById('playgroundMode');
  const bettingControls = document.getElementById('bettingControls');
  const playgroundControls = document.getElementById('playgroundControls');
  const betSlip = document.getElementById('betSlip');
  const playgroundIndicator = document.getElementById('playgroundIndicator');
  const matchControls = document.getElementById('matchControls');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  
  if (playgroundMode) {
    // Entering playground mode - reset everything and set up playground
    resetToPlaygroundMode();
    
    button.textContent = 'Exit Playground';
    button.style.background = '#ff6b6b';
    bettingControls.style.display = 'none';
    matchControls.style.display = 'none';
    betSlip.style.display = 'none';
    playgroundControls.style.display = 'block';
    playgroundArenaControls.style.display = 'flex';
    playgroundIndicator.style.display = 'inline';
    
    // Position the arena controls underneath the ball health display
    setTimeout(() => positionPlaygroundArenaControls(), 100);
    
    initializePlaygroundControls();
    
    // Add playground-specific button handlers
    document.getElementById('playgroundStart').onclick = () => {
      playSound('buttonClick');
      startPlaygroundArena();
    };
    document.getElementById('playgroundReset').onclick = () => {
      playSound('buttonClick');
      resetPlaygroundBalls();
    };
  } else {
    // Exiting playground mode - return to normal betting mode
    button.textContent = 'Playground Mode';
    button.style.background = '';
    bettingControls.style.display = 'flex';
    matchControls.style.display = 'flex';
    betSlip.style.display = 'block';
    playgroundControls.style.display = 'none';
    playgroundArenaControls.style.display = 'none';
    playgroundIndicator.style.display = 'none';
    
    // Reset to normal betting mode
    resetMatch();
  }
}

/* ===== Tournament Mode Functions ===== */
function toggleTournamentMode() {
  // Prevent switching to tournament mode during active matches or with bets placed
  if (!tournament.active && (gameState !== 'pre' || bets.length > 0)) {
    alert('Cannot enter Tournament Mode while a match is active or bets are placed. Please wait for the match to complete or restart.');
    return;
  }

  if (playgroundMode) {
    alert('Cannot start tournament while in Playground Mode. Please exit Playground Mode first.');
    return;
  }

  const button = document.getElementById('tournamentMode');
  const tournamentIndicator = document.getElementById('tournamentIndicator');

  if (!tournament.active) {
    // Starting tournament mode
    tournament.active = true;
    button.textContent = 'Exit Tournament';
    button.style.background = '#4ade80';
    tournamentIndicator.style.display = 'inline';

    // Initialize tournament
    initializeTournament();

    playSound('buttonClick');
  } else {
    // Exiting tournament mode
    tournament.active = false;
    button.textContent = 'Tournament Mode';
    button.style.background = '';
    tournamentIndicator.style.display = 'none';

    // Reset to normal mode
    resetMatch();

    playSound('buttonClick');
  }
}

// ===== Tournament Betting Phase Functions =====
function enterTournamentBettingPhase() {
  activeBettingPhase = {
    selectedStake: 0,
    marketOdds: new Map(),
    oddsFluctuations: new Map(),
    activeBets: [],
    marketActivity: []
  };
  // Show betting phase UI
  document.getElementById('bettingPhase').style.display = '';
  document.getElementById('gameInterface').style.display = '';
  document.getElementById('mainMenu').style.display = 'none';
  setupTournamentBettingPhase();
}

function setupTournamentBettingPhase() {
  // For tournament initialization, use the main betting phase interface
  enterBettingPhase();
}

function buildTournamentOddsTable() {
  const oddsTable = document.getElementById('oddsTable');
  if (!oddsTable) return;
  oddsTable.innerHTML = '';
  // List all balls and tournament bet types
  const betTypes = [
    TOURNAMENT_BET_TYPES.TOURNAMENT_WIN,
    TOURNAMENT_BET_TYPES.REACH_FINAL,
    TOURNAMENT_BET_TYPES.REACH_SEMI,
    TOURNAMENT_BET_TYPES.FIRST_OUT
  ];
  let html = '<table style="width:100%; color:#fff; font-size:13px; border-collapse:collapse;">';
  html += '<tr><th>Ball</th>';
  betTypes.forEach(type => {
    html += `<th>${type.replace('_',' ')}</th>`;
  });
  html += '</tr>';
  balls.forEach(ball => {
    html += `<tr><td>${ball.name||('Ball '+ball.id)}</td>`;
    betTypes.forEach(type => {
      const odds = computeTournamentOdds(ball.id, type);
      html += `<td><button class="btn" style="padding:4px 8px;" onclick="placeTournamentBet('${ball.id}','${type}',this)">${odds ? odds.toFixed(2) : '--'}</button></td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  oddsTable.innerHTML = html;
}

function placeTournamentBet(ballId, betType, buttonEl) {
  // Use current stake or default
  const stake = activeBettingPhase.selectedStake || 10;
  if (stake > bankroll) {
    addMarketActivity('Insufficient funds for this bet.');
    return;
  }
  const odds = computeTournamentOdds(ballId, betType);
  if (!odds) {
    addMarketActivity('Odds unavailable.');
    return;
  }
  const bet = { type: betType, stake, odds, ids: [ballId] };
  bets.push(bet);
  bankroll -= stake; persistBankroll();
  updateBettingSlip();
  addMarketActivity(`Bet placed: ${betType} on Ball ${ballId} @ ${odds.toFixed(2)} for £${stake}`);
  updateBankrollUI();
}

function startTournamentMatchFromBetting() {
  // Hide betting phase, start match
  document.getElementById('bettingPhase').style.display = 'none';
  startTournamentMatch();
}

function startTournamentMatchAction() {
  // Start the actual tournament match gameplay (called after betting phase)
  console.log(`Starting gameplay for Tournament Match ${tournament.currentMatch}`);
  
  // Switch to match phase UI
  setMatchPhaseUI(true);
  
  // Start the match using the same logic as normal matches
  beginStagingAnimation();
  gameState = 'staging';
  document.getElementById('preMsg').style.display = 'none';
  document.getElementById('countdown').style.display = 'none';
  updateBetUI();
}

function positionPlaygroundArenaControls() {
  const ballHealthDisplay = document.getElementById('ballHealthDisplay');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  
  if (ballHealthDisplay && playgroundArenaControls) {
    const rect = ballHealthDisplay.getBoundingClientRect();
    const topPosition = rect.bottom + 10; // 10px gap below the ball health display
    playgroundArenaControls.style.top = `${topPosition}px`;
  }
}

function initializePlaygroundControls() {
  // Set up all parameter sliders with current values
  const paramMappings = {
    'arenaRadius': 'arenaRadius',
    'wallThickness': 'wallThickness', 
    'spinAccel': 'spinAccel',
    'spinMax': 'spinMax',
    'gravityY': 'gravityY',
    'restitution': 'restitution',
    'air': 'air',
    'ballFriction': 'ballFriction',
    'damageScale': 'damageScale',
    'damageThreshold': 'damageThreshold',
    'ballRepulsionForce': 'ballRepulsionForce',
    'ballCount': 'ballCount',
    'ballMin': 'ballMin',
    'ballMax': 'ballMax',
    'dropKick': 'dropKick'
  };
  
  Object.entries(paramMappings).forEach(([sliderId, paramKey]) => {
    const slider = document.getElementById(sliderId);
    const valueLabel = document.getElementById(sliderId + '-value');
    
    if (slider && valueLabel) {
      // Set initial value
      slider.value = P[paramKey];
      valueLabel.textContent = P[paramKey];
      
      // Add event listener for real-time updates
      slider.oninput = () => {
        const newValue = parseFloat(slider.value);
        P[paramKey] = newValue;
        valueLabel.textContent = newValue;
        updateParameterInGame(paramKey, newValue);
      };
    }
  });
}

function updateParameterInGame(paramKey, value) {
  // Apply parameter changes to the running game immediately
  switch(paramKey) {
    case 'arenaRadius':
      arena.radius = value;
      buildWalls(false);
      break;
    case 'wallThickness':
      arena.wallThickness = value;
      buildWalls(false);
      break;
    case 'spinAccel':
      arena.rotAccel = value;
      break;
    case 'spinMax':
      arena.spinMax = value;
      break;
    case 'gravityY':
      if (engine && engine.world) {
        engine.world.gravity.y = value;
      }
      break;
    case 'restitution':
      // Update existing balls
      balls.forEach(ball => {
        if (ball.restitution !== undefined) {
          ball.restitution = value * (ball.restitutionMod || 1);
        }
      });
      break;
    case 'air':
      // Update existing balls
      balls.forEach(ball => {
        if (ball.frictionAir !== undefined) {
          ball.frictionAir = value;
        }
      });
      break;
    case 'ballFriction':
      // Update existing balls
      balls.forEach(ball => {
        if (ball.friction !== undefined) {
          ball.friction = value;
        }
      });
      break;
    case 'ballCount':
      // This requires regenerating balls - do it on next restart
      console.log('Ball count will change on next restart');
      break;
    case 'ballMin':
    case 'ballMax':
      // Ball size changes require restart
      console.log('Ball size will change on next restart');
      break;
  }
}

// Preset functions (global for HTML onclick)
window.applyPreset = function(presetName) {
  const presets = {
    default: { ...DEFAULTS },
    chaos: {
      gravityY: 0.8,
      spinAccel: 0.0002,
      spinMax: 0.25,
      damageScale: 0.5,
      ballRepulsionForce: 0.5,
      dropKick: 8,
      restitution: 2.0
    },
    slowmo: {
      gravityY: 0.1,
      spinAccel: 0.000001,
      spinMax: 0.03,
      damageScale: 0.05,
      air: 0.05
    },
    bouncy: {
      restitution: 3.0,
      gravityY: 0.2,
      wallRestitution: 3.0,
      damageScale: 0.05,
      ballRepulsionForce: 0.8
    }
  };
  
  const preset = presets[presetName];
  if (!preset) return;
  
  // Apply preset values to P
  Object.assign(P, preset);
  
  // Update all sliders and value displays
  if (playgroundMode) {
    initializePlaygroundControls();
  }
  
  // Apply changes to current game
  Object.entries(preset).forEach(([key, value]) => {
    updateParameterInGame(key, value);
  });
  
  playSound('buttonClick');
};

/* ===== Playground Mode Game Functions ===== */

function resetToPlaygroundMode() {
  // Reset match timer
  resetMatchTimer();
  
  // Complete reset for playground mode
  document.querySelectorAll('.centerBanner').forEach(el => el.remove());
  World.clear(world, false);
  Engine.clear(engine);
  
  balls = [];
  freePeople = [];
  walls = new Array(arena.sides).fill(null).map(() => [null, null]);
  gameState = 'pre';
  camera = { zoom: 1, targetZoom: 1, slowmo: 1, targetSlowmo: 1 };
  
  arena.rotation = 0;
  arena.rotSpeed = P.spinStart;
  arena.rotAccel = P.spinAccel;
  arena.spinMax = P.spinMax;
  arena.gapOrder = shuffleArray([...Array(arena.sides).keys()]);
  arena.gapsOpened = 0;
  arena.gapWidths = new Array(arena.sides).fill(0);
  arena.widening = false;
  
  // Clear any betting state
  bets = [];
  finishingOrder = [];
  selectedBallId = null;
  selectedStake = 0;
  lockedBet = null;
  selectedBallId2 = null;
  if (typeof currentSelectedStake !== 'undefined') currentSelectedStake = 0;
  if (typeof currentSelectedBalls !== 'undefined') currentSelectedBalls = [];
  
  impacts = [];
  sparks = [];
  
  // Reset pulse beat state
  pulse.phase = 0;
  pulse.lastRot = null;
  pulse.anglePerBeat = Math.PI * 2 / Math.max(1, pulse.beatsPerRotation);
  
  // Generate balls and position them in arena immediately
  generateBallRoster();
  createPlaygroundBallsInArena();
  
  const maxR = Math.max(...balls.map(b => b.circleRadius));
  arena.baseGapWidth = Math.ceil(maxR * 2 + P.gapMargin);
  
  buildWalls(false);
  
  // Hide pre-game message in playground mode
  document.getElementById('preMsg').style.display = 'none';
  document.getElementById('countdown').style.display = 'none';
  
  // Clear existing interval if any
  if (healthUpdateInterval) {
    clearInterval(healthUpdateInterval);
  }
  // Start timed health display update
  healthUpdateInterval = setInterval(updateBallHealthDisplay, 3000);
}

function createPlaygroundBallsInArena() {
  // Create balls directly in arena positions, visible and ready
  const n = balls.length;
  const Rring = arena.radius * 0.65;
  
  // Clear any existing ball health entries
  const ballHealthDisplay = document.getElementById('ballHealthDisplay');
  const oldEntries = ballHealthDisplay.querySelectorAll('.ball-health-entry');
  oldEntries.forEach(el => el.remove());
  
  const newBodies = [];
  for (let i = 0; i < n; i++) {
    const rb = balls[i];
    const a = -PI/2 + i * (TWO_PI / n);
    const pos = { 
      x: arena.center.x + Math.cos(a) * Rring, 
      y: arena.center.y + Math.sin(a) * Rring 
    };
    
    const body = Bodies.circle(pos.x, pos.y, rb.circleRadius, { 
      restitution: P.restitution * rb.restitutionMod, 
      friction: P.ballFriction, 
      frictionAir: P.air, 
      label: 'ball' 
    });
    
    // Copy ball properties
    body.speedMod = rb.speedMod;
    body.agilityMod = rb.agilityMod;
    body.healthMod = rb.healthMod;
    body.damageMod = rb.damageMod;
    body.renderColor = rb.renderColor;
    body.id = rb.id;
    body.health = rb.health;
    body.ballName = rb.ballName;
    
    // Add person physics
    body.person = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      angle: 0,
      previousVelocity: { x: 0, y: 0 }
    };
    
    // Start as static until arena starts (but visible and collision-enabled)
    Body.setStatic(body, true);
    body.collisionFilter.mask = 0xFFFFFFFF;
    body.isSensor = false;
    body.restitution = P.restitution * (body.restitutionMod || 1);
    body.frictionAir = P.air;
    
    newBodies.push(body);
    
    // Create UI element for playground mode
    const ballEntry = document.createElement('div');
    ballEntry.id = `ball-health-${body.id}`;
    ballEntry.className = 'ball-health-entry';
    ballEntry.dataset.id = body.id;
    ballEntry.innerHTML = `
      <canvas width="28" height="28" style="display:inline-block; vertical-align:middle; margin-right:8px;"></canvas>
      <span class="ball-name" title="${body.ballName}">${body.ballName}</span>
      <span class="ball-odds">-</span>
      <div class="health-bar-container"><div class="health-bar"></div></div>
      <span class="ball-stake-column"></span>
    `;
    ballHealthDisplay.appendChild(ballEntry);
    
    // Draw the mini ball on its canvas
    const cvs = ballEntry.querySelector('canvas');
    if (cvs) {
      const ctx = cvs.getContext('2d');
      const r = 12;
      ctx.clearRect(0, 0, 28, 28);
      ctx.save();
      ctx.translate(14, 14);
      ctx.fillStyle = body.renderColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  
  balls = newBodies;
  if (balls.length) World.add(world, balls);
  
  // Update the health display
  setTimeout(() => {
    if (typeof updateBallHealthDisplay === 'function') {
      updateBallHealthDisplay();
    }
  }, 100);
}

function startPlaygroundArena() {
  console.log('startPlaygroundArena called, gameState:', gameState, 'balls:', balls.length);
  
  if (gameState !== 'pre') {
    console.log('Cannot start arena, gameState is not pre');
    return;
  }
  
  console.log('Starting playground arena...', balls.length, 'balls');
  
  // Skip staging animation in playground mode - balls are already positioned
  gameState = 'playing';
  arena.rotSpeed = P.spinStart;
  arena.rotAccel = P.spinAccel;
  arena.spinMax = P.spinMax;
  
  // Start match timer when arena rotation begins
  startMatchTimer();
  
  // Enable physics on all balls immediately
  balls.forEach(ball => {
    console.log('Activating ball', ball.id, 'at position', ball.position);
    
    // Enable collisions and physics
    ball.collisionFilter.mask = 0xFFFFFFFF;
    ball.isSensor = false;
    ball.restitution = P.restitution * (ball.restitutionMod || 1);
    ball.frictionAir = P.air;
    
    // Give balls a small random kick to start the action
    const sp = P.dropKick * 0.5; // Smaller kick than normal drop
    Body.setVelocity(ball, { 
      x: (Math.random() * 2 - 1) * sp * (ball.speedMod || 1), 
      y: (Math.random() - 0.5) * sp * (ball.speedMod || 1) 
    });
    
    if (P.tanPush !== 0) {
      const vecToBall = Matter.Vector.sub(ball.position, arena.center);
      const tangentialVec = Matter.Vector.normalise({ x: -vecToBall.y, y: vecToBall.x });
      Matter.Body.applyForce(ball, ball.position, {
        x: tangentialVec.x * P.tanPush * (ball.agilityMod || 1),
        y: tangentialVec.y * P.tanPush * (ball.agilityMod || 1)
      });
    }
    
    Body.setAngularVelocity(ball, (Math.random() * 2 - 1) * P.ballInitialAngularVelocityMax * (ball.agilityMod || 1));
    Body.setStatic(ball, false);
  });
  
  // Schedule gap events for playground mode
  if (typeof scheduleGapEvents === 'function') {
    scheduleGapEvents();
  }
  
  // Update start button to show it's active
  const startBtn = document.getElementById('playgroundStart');
  if (startBtn) {
    startBtn.textContent = 'Arena Running';
    startBtn.style.background = '#28a745';
    startBtn.disabled = true;
  }
  
  console.log('Playground arena started, gameState:', gameState);
  console.log('Arena rotation speed:', arena.rotSpeed);
  console.log('Arena rotation acceleration:', arena.rotAccel);
  console.log('Arena max spin:', arena.spinMax);
  console.log('Number of active balls:', balls.length);
}

function resetPlaygroundBalls() {
  // Reset to fresh playground state
  resetToPlaygroundMode();
  
  // Reset start button
  const startBtn = document.getElementById('playgroundStart');
  if (startBtn) {
    startBtn.textContent = 'Start Arena';
    startBtn.style.background = '#4a90e2';
    startBtn.disabled = false;
  }
}

/* ===== Betting Phase Interface ===== */
let activeBettingPhase = {
  selectedStake: 0,
  marketOdds: new Map(), // ballId -> odds
  oddsFluctuations: new Map(), // ballId -> { direction, intensity, lastUpdate }
  activeBets: [],
  marketActivity: []
};

function enterBettingPhase() {
  bettingPhaseActive = true;
  
  // Show betting phase overlay (fullscreen)
  document.getElementById('bettingPhase').style.display = 'block';
  
  // Hide the game interface during betting
  document.getElementById('gameInterface').style.display = 'none';
  
  // Also hide the canvas if it exists
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.style.display = 'none';
  }
  
  // Update title based on mode
  const title = document.getElementById('bettingPhaseTitle');
  const subtitle = document.getElementById('bettingPhaseSubtitle');
  
  if (tournament.active) {
    title.textContent = `Tournament Match ${tournament.currentMatch} - Place Your Bets`;
    subtitle.textContent = `${balls?.length || 12} contestants • ${tournament.eliminationCount[tournament.currentMatch - 1] || 0} will be eliminated`;
  } else {
    title.textContent = 'Place Your Bets';
    subtitle.textContent = 'All 12 balls enter the arena - who will survive?';
  }
  
  // Initialize betting interface
  setupBettingPhase();
  
  // Start odds fluctuation system
  startOddsFluctuation();
}

function setupBettingPhase() {
  // Setup stake buttons
  document.querySelectorAll('.stake-btn').forEach(btn => {
    btn.onclick = () => {
      playSound('buttonClick');
      activeBettingPhase.selectedStake = parseInt(btn.dataset.stake);
      updateStakeSelection();
    };
  });
  
  // Custom stake input
  document.getElementById('customStake').oninput = (e) => {
    const value = parseInt(e.target.value) || 0;
    activeBettingPhase.selectedStake = Math.min(value, bankroll);
    updateStakeSelection();
  };
  
  // Start match button – exit betting and start gameplay
  document.getElementById('startMatchFromBetting').onclick = () => {
    exitBettingPhase();
    onStartMatch();
  };
  
  // Clear bets button
  document.getElementById('clearBets').onclick = () => {
    activeBettingPhase.activeBets = [];
    updateBettingSlip();
    playSound('buttonClick');
  };
  
  // Update bankroll display
  document.getElementById('bettingBankroll').textContent = `£${numberWithCommas(bankroll)}`;
  
  // Initialize contestants if not already done
  if (!balls || balls.length === 0) {
    spawnBallsStaged(tournament.active ? tournament.participantHistory[tournament.currentMatch - 1]?.length || 12 : 12);
  }
  
  // Build odds table
  buildOddsTable();
  updateBettingSlip();
}

function buildOddsTable() {
  const table = document.getElementById('oddsTable');
  table.innerHTML = '';
  
  // Header
  const header = document.createElement('div');
  header.className = 'odds-row';
  header.style.background = 'rgba(0,0,0,0.5)';
  header.style.fontWeight = 'bold';
  header.style.borderBottom = '2px solid #374151';
  header.innerHTML = `
    <div style="color: #94a3b8;">#</div>
    <div style="color: #94a3b8;">Contestant</div>
    <div style="color: #94a3b8;">${tournament.active ? 'Match Win' : 'Win'}</div>
    <div style="color: #94a3b8;">${tournament.active ? (tournament.currentMatch === 1 ? 'Tournament Win' : 'Reach Final') : 'Top 3'}</div>
    <div style="color: #94a3b8;">${tournament.active ? 'Elimination' : 'Exacta'}</div>
  `;
  table.appendChild(header);
  
  // Contestant rows
  balls.forEach(ball => {
    const row = document.createElement('div');
    row.className = 'odds-row';
    
    // Calculate initial odds
    const winOdds = tournament.active ? 
      computeTournamentOdds(ball.id, TOURNAMENT_BET_TYPES.MATCH_WIN) : 
      offeredOddsFromProb((computeBallWinProbs().get(ball.id) || 0.001));
    
    // Calculate tournament-specific odds
    const specialOdds = tournament.active ? 
      (tournament.currentMatch === 1 ? 
        computeTournamentOdds(ball.id, TOURNAMENT_BET_TYPES.TOURNAMENT_WIN) : 
        computeTournamentOdds(ball.id, TOURNAMENT_BET_TYPES.REACH_FINAL)) : 
      offeredOddsFromProb(0.25); // Rough TOP3 odds for normal mode
    
    const eliminationOdds = tournament.active ?
      computeTournamentOdds(ball.id, TOURNAMENT_BET_TYPES.MATCH_ELIMINATION) :
      null; // EXACTA odds for normal mode could go here
    
    activeBettingPhase.marketOdds.set(ball.id, winOdds);
    activeBettingPhase.oddsFluctuations.set(ball.id, { direction: 0, intensity: 0, lastUpdate: Date.now() });
    
    row.innerHTML = `
      <div style="color: #64748b;">#${ball.seeding || ball.id + 1}</div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${ball.renderColor};"></div>
        <span style="color: #fff; font-weight: 500;">${ball.ballName}</span>
        ${ball.health < P.ballMaxHealth ? `<span style="color: #f87171; font-size: 11px;">(${ball.health}/${P.ballMaxHealth})</span>` : ''}
      </div>
      <button class="odds-button" data-ball="${ball.id}" data-bet-type="${tournament.active ? 'MATCH_WIN' : 'WIN'}">${winOdds?.toFixed(2) || '—'}</button>
      <button class="odds-button" data-ball="${ball.id}" data-bet-type="${tournament.active ? (tournament.currentMatch === 1 ? 'TOURNAMENT_WIN' : 'REACH_FINAL') : 'TOP3'}">${specialOdds?.toFixed(2) || '—'}</button>
      <button class="odds-button" data-ball="${ball.id}" data-bet-type="${tournament.active ? 'MATCH_ELIMINATION' : 'EXACTA'}">${eliminationOdds?.toFixed(2) || '—'}</button>
    `;
    
    table.appendChild(row);
    
    // Add click handlers for odds buttons
    row.querySelectorAll('.odds-button').forEach(btn => {
      btn.onclick = () => placeBetFromOdds(ball.id, btn.dataset.betType, btn);
    });
  });
}

function placeBetFromOdds(ballId, betType, buttonEl) {
  if (activeBettingPhase.selectedStake <= 0) {
    alert('Please select a stake amount first!');
    return;
  }
  
  if (activeBettingPhase.selectedStake > bankroll) {
    alert('Insufficient funds!');
    return;
  }
  
  const ball = balls.find(b => b.id === ballId);
  if (!ball) return;
  
  const odds = parseFloat(buttonEl.textContent);
  if (isNaN(odds)) return;
  
  // Create bet
  const bet = {
    id: Date.now(),
    ballId: ballId,
    ballName: ball.ballName,
    ballColor: ball.renderColor,
    betType: betType,
    stake: activeBettingPhase.selectedStake,
    odds: odds,
    potentialPayout: activeBettingPhase.selectedStake * odds
  };
  
  activeBettingPhase.activeBets.push(bet);
  
  // Deduct from bankroll
  bankroll -= activeBettingPhase.selectedStake;
  document.getElementById('bettingBankroll').textContent = `£${numberWithCommas(bankroll)}`;
  
  // Add market activity
  addMarketActivity(`£${activeBettingPhase.selectedStake} on ${ball.ballName} to ${betType.toLowerCase()} @ ${odds.toFixed(2)}`);
  
  // Trigger odds fluctuation
  triggerOddsFluctuation(ballId, 'down'); // Odds go down when bet is placed
  
  // Update displays
  updateBettingSlip();
  playSound('buttonClick');
}

function updateStakeSelection() {
  // Update visual selection
  document.querySelectorAll('.stake-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.stake) === activeBettingPhase.selectedStake);
  });
  
  // Update custom input
  document.getElementById('customStake').value = activeBettingPhase.selectedStake || '';
}

function updateBettingSlip() {
  const container = document.getElementById('activeBetsDisplay');
  const summary = document.getElementById('betSummary');
  
  if (activeBettingPhase.activeBets.length === 0) {
    container.innerHTML = `
      <div style="color: #64748b; text-align: center; padding: 40px 20px;">
        <div style="font-size: 24px; margin-bottom: 10px;">📋</div>
        <div>No bets placed yet</div>
        <div style="font-size: 12px; margin-top: 5px;">Click on odds to add bets</div>
      </div>
    `;
    summary.style.display = 'none';
    return;
  }
  
  // Show bets
  container.innerHTML = activeBettingPhase.activeBets.map(bet => `
    <div class="bet-item">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${bet.ballColor};"></div>
          <span style="color: #fff; font-weight: 500;">${bet.ballName}</span>
        </div>
        <button onclick="removeBet(${bet.id})" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px; cursor: pointer;">×</button>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px;">
        <span style="color: #94a3b8;">${bet.betType} @ ${bet.odds.toFixed(2)}</span>
        <span style="color: #22c55e;">£${numberWithCommas(bet.stake)} → £${numberWithCommas(bet.potentialPayout.toFixed(0))}</span>
      </div>
    </div>
  `).join('');
  
  // Update summary
  const totalStake = activeBettingPhase.activeBets.reduce((sum, bet) => sum + bet.stake, 0);
  const totalPayout = activeBettingPhase.activeBets.reduce((sum, bet) => sum + bet.potentialPayout, 0);
  const totalProfit = totalPayout - totalStake;
  
  document.getElementById('totalStake').textContent = `£${numberWithCommas(totalStake)}`;
  document.getElementById('totalPayout').textContent = `£${numberWithCommas(totalPayout.toFixed(0))}`;
  document.getElementById('totalProfit').textContent = `£${numberWithCommas(totalProfit.toFixed(0))}`;
  
  summary.style.display = 'block';
}

function removeBet(betId) {
  const betIndex = activeBettingPhase.activeBets.findIndex(bet => bet.id === betId);
  if (betIndex === -1) return;
  
  const bet = activeBettingPhase.activeBets[betIndex];
  
  // Refund stake
  bankroll += bet.stake;
  document.getElementById('bettingBankroll').textContent = `£${numberWithCommas(bankroll)}`;
  
  // Remove bet
  activeBettingPhase.activeBets.splice(betIndex, 1);
  
  // Update displays
  updateBettingSlip();
  addMarketActivity(`Cancelled £${bet.stake} bet on ${bet.ballName}`);
  playSound('buttonClick');
}

function addMarketActivity(message) {
  const container = document.getElementById('marketActivity');
  const timestamp = new Date().toLocaleTimeString();
  
  activeBettingPhase.marketActivity.unshift(`[${timestamp}] ${message}`);
  
  // Keep only last 20 activities
  if (activeBettingPhase.marketActivity.length > 20) {
    activeBettingPhase.marketActivity = activeBettingPhase.marketActivity.slice(0, 20);
  }
  
  container.innerHTML = activeBettingPhase.marketActivity.map(activity => 
    `<div style="margin-bottom: 3px;">${activity}</div>`
  ).join('');
}

function startOddsFluctuation() {
  // Simulate market movement every 2-5 seconds
  function fluctuateOdds() {
    if (!bettingPhaseActive) return;
    
    balls.forEach(ball => {
      const fluctuation = activeBettingPhase.oddsFluctuations.get(ball.id);
      if (!fluctuation) return;
      
      // Random chance of odds change
      if (Math.random() < 0.3) {
        const direction = Math.random() < 0.5 ? 'up' : 'down';
        triggerOddsFluctuation(ball.id, direction);
      }
    });
    
    setTimeout(fluctuateOdds, 2000 + Math.random() * 3000);
  }
  
  fluctuateOdds();
}

function triggerOddsFluctuation(ballId, direction) {
  const fluctuation = activeBettingPhase.oddsFluctuations.get(ballId);
  if (!fluctuation) return;
  
  const currentOdds = activeBettingPhase.marketOdds.get(ballId) || 2.0;
  const changePercent = 0.02 + Math.random() * 0.08; // 2-10% change
  
  let newOdds;
  if (direction === 'up') {
    newOdds = currentOdds * (1 + changePercent);
    fluctuation.direction = 1;
  } else {
    newOdds = currentOdds * (1 - changePercent);
    fluctuation.direction = -1;
  }
  
  // Clamp odds to reasonable range
  newOdds = Math.max(1.1, Math.min(50, newOdds));
  
  activeBettingPhase.marketOdds.set(ballId, newOdds);
  fluctuation.intensity = 1;
  fluctuation.lastUpdate = Date.now();
  
  // Update UI
  updateOddsDisplay(ballId, newOdds, direction);
  
  // Add to market activity
  const ball = balls.find(b => b.id === ballId);
  if (ball) {
    addMarketActivity(`${ball.ballName} odds ${direction === 'up' ? 'lengthened' : 'shortened'} to ${newOdds.toFixed(2)}`);
  }
}

function updateOddsDisplay(ballId, newOdds, direction) {
  const button = document.querySelector(`[data-ball="${ballId}"][data-bet-type="WIN"]`);
  if (!button) return;
  
  button.textContent = newOdds.toFixed(2);
  
  // Add visual effect
  button.classList.remove('hot', 'rising');
  if (direction === 'up') {
    button.classList.add('rising');
  } else {
    button.classList.add('hot');
  }
  
  // Remove effect after animation
  setTimeout(() => {
    button.classList.remove('hot', 'rising');
  }, 1000);
}

function exitBettingPhase() {
  bettingPhaseActive = false;
  document.getElementById('bettingPhase').style.display = 'none';
  
  // Show the main game interface for the match phase
  document.getElementById('gameInterface').style.display = 'block';
  
  // Show the canvas again
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.style.display = 'block';
  }
  
  // Transfer bets to the appropriate pool (match or tournament-long)
  activeBettingPhase.activeBets.forEach(bet => {
    const isTournamentLong = (
      bet.betType === TOURNAMENT_BET_TYPES?.TOURNAMENT_WIN ||
      bet.betType === TOURNAMENT_BET_TYPES?.REACH_FINAL ||
      bet.betType === TOURNAMENT_BET_TYPES?.REACH_SEMI ||
      bet.betType === TOURNAMENT_BET_TYPES?.FIRST_OUT
    );

    if (tournament.active && isTournamentLong) {
      // Store as tournament-long bet
      tournament.tournamentBets.push({
        type: bet.betType,
        stake: bet.stake,
        odds: bet.odds,
        ids: [bet.ballId]
      });
    } else {
      // Store as match-level bet
      const gameBet = {
        ids: [bet.ballId],
        stake: bet.stake,
        odds: bet.odds,
        type: bet.betType
      };
      bets.push(gameBet);
    }
  });
  
  // Clear betting phase state
  activeBettingPhase.activeBets = [];
}

function returnToMainMenu() {
  // Complete cleanup of all game state
  cleanupModeState();
  
  // Reset all game state
  tournament.active = false;
  playgroundMode = false;
  bettingPhaseActive = false;
  currentGameMode = null;
  gameState = 'pre';
  
  // Clear any game objects
  if (world) {
    World.clear(world, false);
  }
  if (engine) {
    Engine.clear(engine);
  }
  
  balls = [];
  freePeople = [];
  bets = [];
  finishingOrder = [];
  
  // Reset UI elements
  document.querySelectorAll('.centerBanner').forEach(el => el.remove());
  
  // Hide all interfaces
  document.getElementById('gameInterface').style.display = 'none';
  document.getElementById('bettingPhase').style.display = 'none';
  
  // Show main menu
  document.getElementById('mainMenu').style.display = 'flex';
  
  // Reset indicators
  document.getElementById('tournamentIndicator').style.display = 'none';
  document.getElementById('playgroundIndicator').style.display = 'none';
  
  // Hide playground controls completely
  const playgroundControls = document.getElementById('playgroundControls');
  const playgroundArenaControls = document.getElementById('playgroundArenaControls');
  if (playgroundControls) playgroundControls.style.display = 'none';
  if (playgroundArenaControls) playgroundArenaControls.style.display = 'none';
  
  // Show normal controls
  const bettingControls = document.getElementById('bettingControls');
  const matchControls = document.getElementById('matchControls');
  const betSlip = document.getElementById('matchStatusPanel');
  if (bettingControls) bettingControls.style.display = 'flex';
  if (matchControls) matchControls.style.display = 'flex';
  if (betSlip) betSlip.style.display = 'block';
  
  // Reset match phase UI
  setMatchPhaseUI(false);
  
  playSound('buttonClick');
}

// NEW GAME: reset bankroll and tournament progress, return to main menu
function newGameReset(){
  // Reset bankroll
  bankroll = DEFAULT_BANKROLL; persistBankroll(); updateBankrollUI?.();
  // Reset tournament progress
  if (typeof resetTournamentState === 'function') {
    resetTournamentState();
  } else {
    // Fallback: manually clear tournament object
    tournament.active = false;
    tournament.currentMatch = 0;
    tournament.participantHistory = [];
    tournament.eliminationHistory = [];
    tournament.ballSeedings = {};
    tournament.ballStats = {};
    tournament.tournamentBets = [];
    tournament.bracketResults = [];
    tournament.champion = null;
  }
  // Clear bets and match state
  bets = []; lastBets = []; finishingOrder = [];
  // Return to main menu UI
  returnToMainMenu();
}

function returnToBettingPhase() {
  // Only allow if game is not in progress
  if (gameState === 'playing' || gameState === 'countdown' || gameState === 'staging') {
    alert('Cannot return to betting while match is in progress!');
    return;
  }
  
  // Reset match and return to betting
  resetMatch();
  enterBettingPhase();
  
  playSound('buttonClick');
}

function setMatchPhaseUI(isMatchActive) {
  const gameInterface = document.getElementById('gameInterface');
  const preMatchNav = document.getElementById('preMatchNav');
  const matchPhaseNav = document.getElementById('matchPhaseNav');
  const matchInfo = document.getElementById('matchInfo');
  
  if (isMatchActive) {
    // Show match phase UI
    gameInterface.classList.add('match-active');
    gameInterface.classList.remove('match-inactive');
    preMatchNav.style.display = 'none';
    matchPhaseNav.style.display = 'flex';

    // Update match info with active bets
    updateActiveMatchInfo();
    // Reset and initialize match status panel
    const _logEl = document.getElementById('matchStatusLog');
    if (_logEl) _logEl.innerHTML = '';
    if (typeof updateMatchStatusHeaderEnhanced === 'function') updateMatchStatusHeaderEnhanced();
    if (typeof addMatchStatusUpdate === 'function') addMatchStatusUpdate(`Match started with ${balls.length} contestants`, 'info');
    // Reset spin max notification per match
    window._spinMaxAnnounced = false;
  } else {
    // Show pre-match UI
    gameInterface.classList.add('match-inactive');
    gameInterface.classList.remove('match-active');
    preMatchNav.style.display = 'flex';
    matchPhaseNav.style.display = 'none';
  }
}

function updateActiveMatchInfo() {
  const matchInfo = document.getElementById('activeMatchBets');
  if (!matchInfo) return;
  
  if (bets.length === 0) {
    matchInfo.textContent = 'No active bets • Spectating mode';
  } else {
    const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
    const betCount = bets.length;
    matchInfo.textContent = `${betCount} active bet${betCount > 1 ? 's' : ''} • £${totalStake} total stake`;
  }
}

// Helper function for number formatting
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ===== Match Status Panel =====
function updateMatchStatusHeader() {
  const header = document.getElementById('matchStatusHeader');
  if (!header) return;

  const betCount = Array.isArray(bets) ? bets.length : 0;
  const totalStake = Array.isArray(bets) ? bets.reduce((s,b)=>s+(b.stake||0),0) : 0;
  const remaining = Array.isArray(balls) ? balls.length : 0;

  header.innerHTML = `
    <div><strong>Bets:</strong> ${betCount} • <strong>Stake:</strong> ${numberWithCommas(totalStake)}</div>
    <div><strong>Contestants Remaining:</strong> ${remaining}</div>`;
}

function addMatchStatusUpdate(message, kind='info') {
  const log = document.getElementById('matchStatusLog');
  if (!log) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.innerHTML = `[${time}] ${message}`;
  // Override with colored entry if kind specified
  let color = '#ddd';
  if (kind==='elim') color = '#ff9999';
  else if (kind==='winner') color = '#b7ffb7';
  else if (kind==='payout') color = '#ffe8a6';
  else if (kind==='gap') color = '#9bd3ff';
  else if (kind==='spin') color = '#d0b3ff';
  entry.innerHTML = `<span style="color:#9fb7ffcc">[${time}]</span> <span style="color:${color}">${message}</span>`;
  log.prepend(entry);
  while (log.childElementCount > 50) log.removeChild(log.lastElementChild);
}
