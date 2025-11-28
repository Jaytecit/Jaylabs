# JayLabs Playground

Static site for JayLabs experiments: playable arcade-style games, pattern generators, and a PCVR lab. Everything is plain HTML/CSS/JS with no build step; open `index.html` locally or host the folder as-is.

## What's inside
- `index.html` - landing page that links to the hubs.
- `games.html` - cards that launch the current games:
  - `projects/Chrono Clash/index.html` (5v5 chrono-ball tournament with ultimates, wind, and power-ups)
  - `projects/Astral Core/AstralCore.html` (zero-g arena core-run with dash/phase tools)
  - `projects/AetheriumLeagueGame/AetheriumLeague.html` (p5.js cyber paddle duels)
  - `projects/DefendorksGame/Defendorks.html` (Defender-inspired arcade remix)
- `generators.html` - pattern toys:
  - `projects/PatternGenerators/PatternStudio.html` (audio-reactive harmonograph)
  - `projects/PatternGenerators/SpiroDeluxe.html` (spirograph sandbox)
- `pcvr.html` - VR/3D experiments:
  - `projects/PendulumVRexperience/chaos_pendulum_3d.html`
  - `projects/BongsVR/Bongs.html` (Bongs VR sandbox: unstoppable double pendulum with WebXR)
- `legal.html` - legal/terms page.
- `Images/` - favicon, logo, and hero video assets.
- `.gitignore` - ignores OS/editor cruft and common Node/tooling folders (`node_modules`, `dist`, `.env`).

## Run locally
1) Clone the repo: `git clone https://github.com/Jaytecit/Jaylabs.git`
2) Open `index.html` in your browser **or** start a quick static server (recommended for some browser autoplay/security rules):
   - With Node: `npx serve .` (or any static server) then visit the shown URL.
   - With Python: `python -m http.server 8000` and visit `http://localhost:8000`.
3) Click/tap once inside the game canvases to unlock audio if the browser mutes it initially.

## Tech notes
- Pure front-end: vanilla HTML/CSS/JS; external libraries are loaded from CDNs (e.g., p5.js for Aetherium League).
- No build tooling; assets are local and paths are relative, so you can host the folder on GitHub Pages, Netlify, or any static host.
- Designed for desktop-first experiences (games and VR); some pieces may require mouse/keyboard or WebXR support.

## Contributing / changes
- Keep pages self-contained (inline styles/scripts) unless adding shared assets.
- If you add new tools that generate build outputs, extend `.gitignore` accordingly.

## License
- Source code is MIT licensed (see `LICENSE`).
- Original music/audio tracks in `projects/**` (e.g., .wav/.mp3 files) remain the property of JayLabs and are not licensed for reuse or redistribution without written permission.
