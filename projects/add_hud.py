#!/usr/bin/env python3
with open('Flingers.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and insert the HUD element after WAVE line
new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'id="hud-wave"' in line and '</span><br>' in line:
        # Insert multiplier element on next line
        indent = '                '
        new_lines.append(indent + '<small id="hud-mult" style="color:var(--neon-yellow)">MULT: 1.0x</small><br>\n')

with open('Flingers.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('✓ HUD multiplier element added')
