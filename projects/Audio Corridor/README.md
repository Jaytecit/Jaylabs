# Audio-Reactive Wireframe Tunnel

This experience is a fresh Three.js scene built around a wireframe corridor that stretches toward the viewer. Ribbons tied to the low/mid/high frequency bands behave like spectrum bars, particles drift through the tunnel, and a shader-based horizon glow adds depth. A cue-sheet analyser scans the loaded audio track to trigger macro visual events in addition to the per-beat reactivity.

## Running
1. Open `index.html` in a Chromium-based browser (Chrome, Edge, etc.).
2. Use **Select Audio** to load `.mp3`/`.wav` files (default `Trancelush.mp3` is already bundled). The **Play** button will become enabled.
3. Click **Play** to start the music and watch the tunnel evolve with ribbon colouring, panel ripples, and cue-driven pulses.
4. Toggle **SBS** if you want to split-screen for VR viewing.

## Features
- Wireframe tunnel made from square loops that continuously flow past the camera.
- Three ribbon ropes colored by spectral bands, reacting to the current low/mid/high energy.
- Particle field adds subtle parallax to reinforce motion.
- Shader horizon glow at the far end that responds to the averaged energy.
- Cue-sheet analyser pre-scans the loaded audio and schedules visual events (ribbon/panel bursts, particle pulses) when it detects surges.
- Minimal UI keeps the experience focused on the visuals.

Enjoy the new immersive corridor! Leave feedback or request tweaks to the cue logic or ribbon behavior at any time.
