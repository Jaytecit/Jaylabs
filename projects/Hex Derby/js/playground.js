// Hex Derby Playground Mode
// Underground matches with hazards, unique rules, and reputation system

import { Player, Vessel } from './core.js';

class PlaygroundMatch {
    constructor(players, options = {}) {
        this.players = players; // Array of Player objects
        this.hazards = options.hazards || [];
        this.rules = options.rules || {};
        this.reputation = options.reputation || {};
        this.duration = options.duration || 120; // seconds
        this.results = [];
    }

    startMatch() {
        // Simulate match logic (placeholder)
        this.players.forEach(player => {
            // Apply hazard effects
            this.hazards.forEach(hazard => hazard(player));
            // Simulate outcome
            const survived = Math.random() > 0.3;
            this.results.push({
                player: player.name,
                survived,
                reputationChange: survived ? +5 : -10
            });
            // Update reputation
            this.reputation[player.name] = (this.reputation[player.name] || 0) + (survived ? 5 : -10);
        });
    }

    getSummary() {
        return {
            results: this.results,
            reputation: this.reputation
        };
    }
}

// Example hazard function
function bombHazard(player) {
    // Simulate hazard effect
    if (Math.random() < 0.2) {
        player.vessel.durability -= 10;
    }
}

// Usage Example:
// const match = new PlaygroundMatch([player1, player2], { hazards: [bombHazard] });
// match.startMatch();
// console.log(match.getSummary());

export { PlaygroundMatch, bombHazard };