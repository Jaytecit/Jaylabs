// Hex Derby Professional Matches & Betting
// League progression, talent scout system, betting, leaderboards

import { Player } from './core.js';

class League {
    constructor(name, rankPointsRequired) {
        this.name = name;
        this.rankPointsRequired = rankPointsRequired;
        this.players = [];
        this.leaderboard = [];
    }

    addPlayer(player) {
        this.players.push(player);
    }

    updateLeaderboard() {
        // Sort by rank points (placeholder: use currency as proxy)
        this.leaderboard = [...this.players].sort((a, b) => b.currency - a.currency);
    }

    getTopPlayers(n = 3) {
        this.updateLeaderboard();
        return this.leaderboard.slice(0, n);
    }
}

class BettingSystem {
    constructor() {
        this.bets = [];
    }

    placeBet(player, amount, onPlayer) {
        if (player.currency < amount) return { success: false, message: 'Not enough currency.' };
        player.currency -= amount;
        this.bets.push({ bettor: player.name, amount, onPlayer });
        return { success: true, message: `Bet placed on ${onPlayer.name}.` };
    }

    resolveBets(winner) {
        let results = [];
        this.bets.forEach(bet => {
            if (bet.onPlayer.name === winner.name) {
                results.push({ bettor: bet.bettor, won: true, payout: bet.amount * 2 });
            } else {
                results.push({ bettor: bet.bettor, won: false, payout: 0 });
            }
        });
        this.bets = [];
        return results;
    }
}

class TalentScout {
    constructor() {
        this.interest = {};
    }

    evaluate(player) {
        // Simple logic: interest increases with currency and wins
        const score = player.currency + (player.stats.speed + player.stats.power);
        this.interest[player.name] = score;
        return score;
    }
}

// Usage Example:
// const league = new League('Pro', 1000);
// league.addPlayer(player);
// league.updateLeaderboard();
// const betting = new BettingSystem();
// betting.placeBet(player, 50, otherPlayer);
// betting.resolveBets(winner);
// const scout = new TalentScout();
// scout.evaluate(player);

export { League, BettingSystem, TalentScout };