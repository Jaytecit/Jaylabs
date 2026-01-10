/* ===== Tournament System ===== */
/*
 * Dedicated tournament management system for Hex Derby
 * Handles tournament initialization, match progression, and statistics
 */

/* ===== Tournament Management ===== */

function initializeTournament() {
  tournament.active = true;
  tournament.currentMatch = 1;
  tournament.participantHistory = [];
  tournament.eliminationHistory = [];
  tournament.ballSeedings = {};
  tournament.ballStats = {};
  tournament.tournamentBets = [];
  tournament.bracketResults = [];
  tournament.champion = null;
  
  // Generate initial 12-ball roster and assign seedings
  // Use the existing ball generation system
  if (typeof generateBallRoster === 'function') {
    generateBallRoster(12); // This modifies the global balls array
    // Now extract the IDs from the balls array
    tournament.participantHistory[0] = balls.map(b => b.id);
  } else {
    // Fallback: create simple ball IDs if generateBallRoster not available yet
    tournament.participantHistory[0] = Array.from({length: 12}, (_, i) => i);
  }
  
  // Assign random seedings (1-12, with slight bias toward larger balls)
  const shuffledIds = shuffleArray([...tournament.participantHistory[0]]);
  shuffledIds.forEach((ballId, index) => {
    tournament.ballSeedings[ballId] = index + 1;
    tournament.ballStats[ballId] = {
      matches: 0,
      eliminations: 0,
      totalDamage: 0,
      health: P.ballMaxHealth,
      seeding: index + 1
    };
  });
  
  // Set up the tournament and enter the dedicated betting phase for Match 1
  startTournamentMatch();
}

function startTournamentMatch() {
  if (!tournament.active || tournament.currentMatch > tournament.totalMatches) {
    return;
  }
  
  console.log(`Setting up Tournament Match ${tournament.currentMatch} for betting`);
  
  // Get participants for this match
  const matchParticipants = tournament.currentMatch === 1 
    ? tournament.participantHistory[0] 
    : getMatchSurvivors(tournament.currentMatch - 1);
  
  tournament.participantHistory[tournament.currentMatch - 1] = matchParticipants;
  
  // Set ball count for this match
  P.ballCount = matchParticipants.length;
  
  // Reset the match with tournament participants but don't start gameplay yet
  resetMatch();
  
  // Update UI to show tournament status
  updateTournamentUI();
  
  // Enter dedicated betting phase for this match
  enterBettingPhase();
}

function getMatchSurvivors(matchNumber) {
  // Returns ball IDs that survived the specified match
  if (matchNumber < 1 || matchNumber > tournament.currentMatch - 1) {
    return [];
  }
  
  const participants = tournament.participantHistory[matchNumber - 1] || [];
  const eliminated = tournament.eliminationHistory[matchNumber - 1] || [];
  
  return participants.filter(ballId => !eliminated.includes(ballId));
}

function processTournamentMatchEnd() {
  if (!tournament.active) return;
  
  // Record elimination order for this match
  const expectedSurvivors = tournament.survivorCount[tournament.currentMatch];
  const currentParticipants = tournament.participantHistory[tournament.currentMatch - 1];
  const eliminatedThisMatch = [];
  
  // Update ball health/stats for all current participants
  currentParticipants.forEach(ballId => {
    const ballData = balls.find(b => b.id === ballId);
    if (ballData && tournament.ballStats[ballId]) {
      tournament.ballStats[ballId].health = ballData.health;
      tournament.ballStats[ballId].matches++;
    }
  });
  
  // Determine who was eliminated (last N in finishingOrder)
  const eliminationCount = tournament.eliminationCount[tournament.currentMatch - 1];
  for (let i = 0; i < eliminationCount && i < finishingOrder.length; i++) {
    const ballId = finishingOrder[i]; // finishingOrder contains ball IDs directly
    if (currentParticipants.includes(ballId)) {
      eliminatedThisMatch.push(ballId);
      // Update ball stats
      if (tournament.ballStats[ballId]) {
        tournament.ballStats[ballId].eliminations++;
        tournament.ballStats[ballId].health = 0; // Eliminated balls have 0 health
      }
    }
  }
  
  tournament.eliminationHistory[tournament.currentMatch - 1] = eliminatedThisMatch;
  
  // Record match result
  const winnerId = finishingOrder[finishingOrder.length - 1]; // finishingOrder contains ball IDs directly
  tournament.bracketResults[tournament.currentMatch - 1] = {
    match: tournament.currentMatch,
    participants: currentParticipants,
    eliminated: eliminatedThisMatch,
    winner: winnerId || null,
    survivors: getMatchSurvivors(tournament.currentMatch)
  };
  
  console.log(`Match ${tournament.currentMatch} completed:`, tournament.bracketResults[tournament.currentMatch - 1]);
  
  // Check if tournament is complete
  if (tournament.currentMatch === tournament.totalMatches) {
    // Tournament complete!
    tournament.champion = winnerId;
    completeTournament();
  } else {
    // Advance to next match
    tournament.currentMatch++;
    setTimeout(() => {
      startTournamentMatch();
    }, 3000); // 3 second delay between matches
  }
}

function settleTournamentBets() {
  if (!tournament.active || !tournament.tournamentBets || tournament.tournamentBets.length === 0) {
    return 'No tournament bets placed';
  }

  const championId = tournament.champion;
  const allEliminated = tournament.eliminationHistory.flat();
  const firstOut = allEliminated.length > 0 ? allEliminated[0] : null;

  // Get final participants (survivors of penultimate match)
  const finalParticipants = tournament.currentMatch > 1 ? getMatchSurvivors(tournament.totalMatches - 1) : [];

  // Get semi-final participants (survivors of match totalMatches - 2)
  const semiParticipants = tournament.currentMatch > 2 ? getMatchSurvivors(tournament.totalMatches - 2) : [];

  let payout = 0;
  let winners = 0;
  let losers = 0;
  let winningBets = [];
  let losingBets = [];

  for (const b of tournament.tournamentBets) {
    let won = false;
    if (b.type === 'TOURNAMENT_WIN') {
      won = (b.ids[0] === championId);
    } else if (b.type === 'REACH_FINAL') {
      won = finalParticipants.includes(b.ids[0]);
    } else if (b.type === 'REACH_SEMI') {
      won = semiParticipants.includes(b.ids[0]);
    } else if (b.type === 'FIRST_OUT') {
      won = (b.ids[0] === firstOut);
    }

    if (won) {
      const w = Math.floor(b.stake * b.odds);
      payout += w;
      winners++;
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

  if (payout > 0) {
    bankroll += payout;
    persistBankroll();
  }

  // Store results similar to match
  window.lastTournamentResults = {
    winningBets,
    losingBets,
    totalPayout: payout,
    totalWinners: winners,
    totalLosers: losers
  };

  const summary = winners > 0
    ? `Tournament Payout £${numberWithCommas(payout)} across ${winners} winning bet(s)${losers > 0 ? ` • ${losers} bet(s) lost` : ''}`
    : 'All tournament bets lost';

  return summary;
}

function completeTournament() {
  tournament.active = false;
  console.log(`Tournament Complete! Champion: ${tournament.champion}`);
  
  const tournamentSummary = settleTournamentBets();
  
  // Display tournament results summary
  const championBall = balls.find(b => b.id === tournament.champion) || { ballName: 'Unknown', renderColor: '#fff' };
  let msg = `🏆 TOURNAMENT CHAMPION: <span style="color:${championBall.renderColor}">${championBall.ballName}</span>`;
  if (tournamentSummary) {
    msg += `<div class="sub">${tournamentSummary}</div>`;
  }
  showBanner(msg);
  
  updateTournamentUI();
}

function updateTournamentUI() {
  const preMsg = document.getElementById('preMsg');
  if (!preMsg) return;
  
  if (tournament.active) {
    const matchInfo = `Tournament Match ${tournament.currentMatch} of ${tournament.totalMatches}`;
    const participantCount = tournament.participantHistory[tournament.currentMatch - 1]?.length || 0;
    const eliminationCount = tournament.eliminationCount[tournament.currentMatch - 1] || 0;
    
    // Show tournament bracket info
    let bracketInfo = '';
    if (tournament.currentMatch > 1) {
      const previousEliminated = tournament.eliminationHistory[tournament.currentMatch - 2] || [];
      const eliminatedNames = previousEliminated.map(id => {
        const ball = balls.find(b => b.id === id);
        return ball ? ball.ballName : `#${id + 1}`;
      }).join(', ');
      bracketInfo = `<p style="color: #64748b; font-size: 14px;">Previous match eliminated: ${eliminatedNames}</p>`;
    }
    
    preMsg.innerHTML = `
      <div style="text-align: center; color: #fff;">
        <h3>${matchInfo}</h3>
        <p>${participantCount} contestants • ${eliminationCount} will be eliminated</p>
        <p style="color: #4ade80;">Tournament betting available!</p>
        ${bracketInfo}
      </div>
    `;
  } else if (tournament.champion) {
    const championBall = balls.find(b => b.id === tournament.champion) || { ballName: 'Unknown' };
    preMsg.innerHTML = `
      <div style="text-align: center; color: #fff;">
        <h3>🏆 Tournament Complete!</h3>
        <p>Champion: <span style="color: #4ade80;">${championBall.ballName}</span></p>
        <p style="color: #64748b;">Ready for a new tournament?</p>
      </div>
    `;
  }
  
  // Update betting UI for tournament mode
  if (tournament.active && typeof updateBetUI === 'function') {
    updateBetUI();
  }
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

