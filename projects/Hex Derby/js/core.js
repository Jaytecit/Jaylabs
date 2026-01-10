// Hex Derby Core Systems
// Player profile, vessel, stats, currency, inventory

// Player Profile
class Player {
    constructor(name) {
        this.name = name;
        this.stats = new Stats();
        this.currency = 0;
        this.inventory = new Inventory();
        this.vessel = new Vessel();
    }
}

// Vessel (Ball)
class Vessel {
    constructor(type = 'Standard') {
        this.type = type;
        this.upgrades = [];
        this.durability = 100;
    }
}

// Stats
class Stats {
    constructor() {
        this.speed = 1;
        this.power = 1;
        this.durability = 1;
        this.control = 1;
        this.luck = 1;
    }
}

// Inventory
class Inventory {
    constructor() {
        this.items = [];
    }
    addItem(item) {
        this.items.push(item);
    }
    removeItem(itemName) {
        this.items = this.items.filter(item => item.name !== itemName);
    }
}

// Item
class Item {
    constructor(name, type, effect) {
        this.name = name;
        this.type = type; // upgrade, power-up, cosmetic, protection, offense
        this.effect = effect;
    }
}

// Example: Create a player
// const player = new Player('YourName');
// player.currency += 100;
// player.inventory.addItem(new Item('Speed Boost', 'upgrade', {speed: +1}));

export { Player, Vessel, Stats, Inventory, Item };