// Hex Derby Shop Mode
// Shop logic for upgrades, power-ups, cosmetics, protection, offense items
// Inventory management and purchase system

import { Item } from './core.js';

class Shop {
    constructor(catalog = []) {
        this.catalog = catalog; // Array of Item objects
    }

    listItems() {
        return this.catalog;
    }

    buyItem(player, itemName) {
        const item = this.catalog.find(i => i.name === itemName);
        if (!item) return { success: false, message: 'Item not found.' };
        if (player.currency < item.effect.price) return { success: false, message: 'Not enough currency.' };
        player.currency -= item.effect.price;
        player.inventory.addItem(item);
        return { success: true, message: `${item.name} purchased!` };
    }
}

// Example shop catalog
const defaultCatalog = [
    new Item('Speed Boost', 'upgrade', { speed: +1, price: 50 }),
    new Item('Power Shield', 'protection', { durability: +2, price: 75 }),
    new Item('Lucky Charm', 'power-up', { luck: +1, price: 40 }),
    new Item('Cosmetic Skin', 'cosmetic', { price: 20 })
];

// Usage Example:
// const shop = new Shop(defaultCatalog);
// shop.buyItem(player, 'Speed Boost');

export { Shop, defaultCatalog };