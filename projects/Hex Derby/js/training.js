// Hex Derby Training Mode
// Practice rounds and mini-games to improve stats
// End-of-round summary: stat changes, performance analysis, tips

import { Player } from './core.js';

class TrainingMode {
    constructor(player) {
        this.player = player;
        this.sessionStats = {
            speed: 0,
            power: 0,
            durability: 0,
            control: 0,
            luck: 0
        };
        this.rounds = [];
    }

    startRound(miniGame) {
        // Simulate a training mini-game (placeholder logic)
        const result = miniGame();
        this.applyStatChanges(result);
        this.rounds.push(result);
    }

    applyStatChanges(result) {
        for (let stat in result) {
            if (this.player.stats.hasOwnProperty(stat)) {
                this.player.stats[stat] += result[stat];
                this.sessionStats[stat] += result[stat];
            }
        }
    }

    getSummary() {
        return {
            statChanges: this.sessionStats,
            performance: this.rounds,
            tips: this.generateTips()
        };
    }

    generateTips() {
        // Simple tips based on stat changes
        let tips = [];
        for (let stat in this.sessionStats) {
            if (this.sessionStats[stat] > 0) {
                tips.push(`Great job improving your ${stat}!`);
            } else if (this.sessionStats[stat] < 0) {
                tips.push(`Focus on your ${stat} next time.`);
            }
        }
        return tips;
    }
}

// Example mini-game function
function speedMiniGame() {
    // Simulate stat gain
    return { speed: Math.random() > 0.5 ? 1 : 0 };
}

// Usage Example:
// const player = new Player('YourName');
// const training = new TrainingMode(player);
// training.startRound(speedMiniGame);
// console.log(training.getSummary());

export { TrainingMode, speedMiniGame };