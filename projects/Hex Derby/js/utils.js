
function makeStars(n){ const arr=[]; for (let i=0;i<n;i++) arr.push({x:random(width),y:random(height),z:random(0.4,1.0),tw:random(TWO_PI)}); return arr; }
function numberWithCommas(x){ return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function persistBankroll(){ localStorage.setItem('hexderby_bankroll', bankroll.toString()); }
function shuffleArray(a){ const arr=a.slice(); for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

let audioEnabled = false; // Global flag for audio state

// Function to toggle audio
function toggleAudio() {
  audioEnabled = !audioEnabled;
  const msg = `Audio: ${audioEnabled ? 'On' : 'Off'}`;
  
  // Update both audio buttons
  const audioButton1 = document.getElementById('audio');
  const audioButton2 = document.getElementById('audio2');
  
  if (audioButton1) audioButton1.textContent = msg;
  if (audioButton2) audioButton2.textContent = msg;
  
  // Ensure audio elements reflect the toggle state
  const sfx = document.querySelectorAll('audio[id^="sfx-"]');
  sfx.forEach(a => {
    a.muted = !audioEnabled;
    a.volume = 1.0;
    try { a.load(); } catch(e) {}
  });
  // Provide immediate audible feedback when turning audio on
  if (audioEnabled) {
    // Attempt to play a UI click sound as confirmation
    const el = document.getElementById('sfx-buttonClick');
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {/* ignore; browser may still block until another user gesture */});
    }
  }
}

// Function to play a sound effect
function playSound(soundName) {
  if (!audioEnabled) return;

  const audio = document.getElementById(`sfx-${soundName}`);
  if (audio) {
    audio.currentTime = 0; // Rewind to start
    audio.play().catch(e => console.error("Error playing sound:", e));
  } else {
    console.warn(`Sound effect '${soundName}' not found.`);
  }
}

// Dynamic collision SFX with variation (volume/pitch) and type-based selection
function playCollisionSFX({ kind, vn, vt, spinA = 0, spinB = 0, rA = 0, rB = 0 }) {
  if (!audioEnabled) return;

  // Normalize parameters
  const vMag = Math.max(0, vn);
  const threshold = (P && P.damageThreshold) ? P.damageThreshold : 3;
  const vnNorm = Math.max(0, Math.min(1, (vMag - threshold * 0.5) / (threshold + 8))); // 0..1
  const vtNorm = Math.max(0, Math.min(1, vt / (threshold + 8)));
  const spinNorm = Math.max(0, Math.min(1, (Math.abs(spinA) + Math.abs(spinB)) / 10));
  const rAvg = Math.max(1, (rA + rB) * 0.5);

  // Base volume scales with normal impact velocity; add a touch of scrape
  let volume = 0.15 + 0.85 * vnNorm + 0.15 * vtNorm;
  volume = Math.max(0.05, Math.min(1.0, volume));

  // Base pitch: smaller balls and higher spin => slightly higher pitch
  let rate = 1.0;
  rate += (Math.max(10, 40 - rAvg) / 80); // smaller -> higher pitch up to +0.375
  rate += spinNorm * 0.2;                 // spin lifts pitch up to +0.2
  rate += (vtNorm - 0.3) * 0.15;          // scrape adds a bit

  // Random jitter to avoid repetition
  rate *= (0.94 + Math.random() * 0.12);  // ~±6%
  volume *= (0.9 + Math.random() * 0.2);  // ~±10%

  // Choose candidate audio element ids by collision kind; fallback to generic
  const candidates = [];
  if (kind === 'ball-wall') {
    candidates.push('sfx-wallHit'); // optional, if present
  }
  candidates.push('sfx-ballCollision'); // default

  let srcEl = null;
  for (const id of candidates) {
    const el = document.getElementById(id);
    if (el) { srcEl = el; break; }
  }
  if (!srcEl) return; // nothing to play

  // Clone to allow overlapping and customize volume/pitch per instance
  const node = srcEl.cloneNode(true);
  node.muted = !audioEnabled;
  node.volume = Math.max(0.0, Math.min(1.0, volume));
  try { node.playbackRate = Math.max(0.5, Math.min(2.0, rate)); } catch(e) {}
  // If the clone lacks a src (some browsers), copy it
  if (!node.src && srcEl.src) node.src = srcEl.src;
  node.currentTime = 0;
  node.play().catch(() => {});
}

// Prime specific SFX by name (loads the audio so first playback is not delayed)
function primeSFX(names){
  if (!Array.isArray(names)) return;
  names.forEach(n => {
    const el = document.getElementById(`sfx-${n}`);
    if (el){ try { el.load(); } catch(e) {} }
  });
}

// UI binds the click handler in bindUI(); keep utils side dumb to avoid double-binding
