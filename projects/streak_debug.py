#!/usr/bin/env python3
"""
Add proper volley tracking to avoid streak loss bugs with multishot.
Each stone gets a volleyId so we can track if ANY stone from a volley hit.
"""

with open('Flingers.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add volleyId and volleyHits tracking to game object
old_game_init = """            wisps: [], // Array of orbital wisps
            harpoon: {"""

new_game_init = """            wisps: [], // Array of orbital wisps
            volleyId: 0, // Counter for each shot volley
            volleyHits: {}, // Track which volleys had hits
            harpoon: {"""

content = content.replace(old_game_init, new_game_init)

# Update Stone constructor to include volleyId
old_stone = """        class Stone {
            constructor(x, y, vx, vy, isCenterProjectile = false) {
                this.x = x; this.y = y; this.vx = vx; this.vy = vy;
                this.trail = [];
                this.hitIds = []; // enemies already hit
                this.hasHit = false; // Fix: Track if stone has hit anything to prevent streak break
                this.isCenterProjectile = isCenterProjectile; // Track if this is the center projectile for streak counting"""

new_stone = """        class Stone {
            constructor(x, y, vx, vy, isCenterProjectile = false, volleyId = 0) {
                this.x = x; this.y = y; this.vx = vx; this.vy = vy;
                this.trail = [];
                this.hitIds = []; // enemies already hit
                this.hasHit = false; // Fix: Track if stone has hit anything to prevent streak break
                this.isCenterProjectile = isCenterProjectile; // Track if this is the center projectile for streak counting
                this.volleyId = volleyId; // Track which volley this stone belongs to"""

content = content.replace(old_stone, new_stone)

# Update fireStone to pass volleyId
old_fireStone_push = """                const fireStone = (angleOffset = 0, isCenterProjectile = false) => {
                    game.stones.push(new Stone(
                        800 + Math.cos(pilot.angle + angleOffset) * 55,
                        800 + Math.sin(pilot.angle + angleOffset) * 55,
                        Math.cos(pilot.angle + angleOffset) * shop.stoneSpeed.val,
                        Math.sin(pilot.angle + angleOffset) * shop.stoneSpeed.val,
                        isCenterProjectile
                    ));\n                };"""

new_fireStone_push = """                const fireStone = (angleOffset = 0, isCenterProjectile = false) => {
                    game.stones.push(new Stone(
                        800 + Math.cos(pilot.angle + angleOffset) * 55,
                        800 + Math.sin(pilot.angle + angleOffset) * 55,
                        Math.cos(pilot.angle + angleOffset) * shop.stoneSpeed.val,
                        Math.sin(pilot.angle + angleOffset) * shop.stoneSpeed.val,
                        isCenterProjectile,
                        game.volleyId
                    ));\n                };"""

content = content.replace(old_fireStone_push, new_fireStone_push)

# Replace lastShotHit logic with proper volley tracking
old_reset = """                // Track this volley's hit state: reset when firing. If ANY projectile hits,
                // we will preserve streak even if the center projectile misses.
                game.lastShotHit = false;"""

new_reset = """                // Increment volleyId for this new volley and reset its hit state
                game.volleyId++;
                game.volleyHits[game.volleyId] = false;"""

content = content.replace(old_reset, new_reset)

# Update onHit to mark volley as hit
old_onhit = """        function onHit(enemy, stone) {
            game.shake = 8;
            // Mark that some projectile in this volley hit
            game.lastShotHit = true;
            // Only increment streak and update focus if this is the center projectile
            if (stone.isCenterProjectile) {
                game.streak++;"""

new_onhit = """        function onHit(enemy, stone) {
            game.shake = 8;
            // Mark that this volley had a hit
            game.volleyHits[stone.volleyId] = true;
            // Only increment streak and update focus if this is the center projectile
            if (stone.isCenterProjectile) {
                game.streak++;"""

content = content.replace(old_onhit, new_onhit)

# Update streak reset logic
old_streak_reset = """                if (s.x < 0 || s.x > 1600 || s.y < 0 || s.y > 1600) {
                    // Only reset streak if the CENTER projectile missed AND no projectile
                    // from this volley hit anything. Secondary projectiles missing
                    // should not break the streak if any other projectile hit.
                    if (s.isCenterProjectile && !game.lastShotHit) {
                        game.streak = 0;
                        updateHUD();
                    }
                    game.stones.splice(i, 1);
                }"""

new_streak_reset = """                if (s.x < 0 || s.x > 1600 || s.y < 0 || s.y > 1600) {
                    // Only reset streak if the CENTER projectile missed AND no projectile
                    // from this volley hit anything. Secondary projectiles missing
                    // should not break the streak if any other projectile hit.
                    if (s.isCenterProjectile && !game.volleyHits[s.volleyId]) {
                        game.streak = 0;
                        updateHUD();
                    }
                    game.stones.splice(i, 1);
                }"""

content = content.replace(old_streak_reset, new_streak_reset)

with open('Flingers.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Streak tracking fixed with proper volley IDs')
