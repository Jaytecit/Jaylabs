import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

const ui = {
  bar: document.querySelector(".ui"),
  fileInput: document.getElementById("audio-file"),
  playBtn: document.getElementById("play-btn"),
  watchBtn: document.getElementById("watch-btn"),
  vrBtn: document.getElementById("vr-btn"),
  status: document.getElementById("status"),
};

function setStatus(message) {
  if (ui.status) {
    ui.status.textContent = message;
  }
  console.log(message);
}

const gameStats = {
  score: 0,
  combo: 1,
  streak: 0,
  bestStreak: 0,
  hits: 0,
  shotsFired: 0,
  shield: 1,
  overdrive: 0,
  hype: 0.2,
  comboTimer: 0,
  trackName: "UHOH.mp3",
};
let hudDirty = false;
const SHIELD_FLOOR = 0.25;
const analyzerBandCount = 16;
const wallBandPerSide = 6;
const corridorSpectra = { boost: 0 };
const wallAnalyzerGeometry = new THREE.PlaneGeometry(0.35, 0.4);
const wallAnalyzerMaterialTemplate = {
  transparent: true,
  opacity: 0.08,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
};
const overdriveState = { engaged: false, timer: 0 };
const xrState = {
  sessionActive: false,
  leftController: null,
  rightController: null,
  controllers: [],
  grips: [],
  headPosition: new THREE.Vector3(),
};
const autoPilotState = {
  enabled: false,
  phase: Math.random() * Math.PI * 2,
  verticalPhase: Math.random() * Math.PI * 2,
  extendPulse: 0,
  lastAudio: null,
  fireTimer: 0,
};
function formatScore(value) {
  const safe = Math.max(0, Math.floor(value));
  return safe.toLocaleString("en-US", { minimumIntegerDigits: 6, useGrouping: false });
}

function queueHudSync() {
  hudDirty = true;
}

function setTrackLabel(label) {
  gameStats.trackName = label;
}

function updateHud() {
  if (!hudDirty) return;
  hudDirty = false;
}

function lockReticle() { }

function pushFeed(title, detail) {
  if (detail) {
    setStatus(`${title ?? "Update"} - ${detail}`);
  } else if (title) {
    setStatus(title);
  }
}

function updateWatchButtonLabel() {
  if (!ui.watchBtn) return;
  ui.watchBtn.textContent = autoPilotState.enabled ? "Exit Watch Mode" : "Watch Mode";
}

function setShowcaseMode(enabled, options = {}) {
  const { silent = false } = options;
  if (autoPilotState.enabled === enabled) return;
  autoPilotState.enabled = enabled;
  autoPilotState.phase = Math.random() * Math.PI * 2;
  autoPilotState.verticalPhase = Math.random() * Math.PI * 2;
  autoPilotState.extendPulse = 0;
  updateWatchButtonLabel();
  document.body?.classList.toggle("watch-mode", enabled);
  if (enabled) {
    if (!silent) {
      pushFeed("Showcase mode", "Autonomous flight engaged. Sit back and sync.");
      setStatus("Showcase mode: observing Iron Man dance with the music.");
    }
  } else if (!silent) {
    pushFeed("Manual control", "You're back at the helm.");
    setStatus("Manual mode: pilot ready.");
  }
}

function toggleShowcaseMode() {
  setShowcaseMode(!autoPilotState.enabled);
}

function handleManualOverride() {
  if (!autoPilotState.enabled) return;
  setShowcaseMode(false, { silent: true });
  pushFeed("Manual override", "Inputs detected. Manual control restored.");
  setStatus("Manual mode: pilot ready.");
}

function chargeOverdrive(amount) {
  gameStats.overdrive = Math.min(1.4, gameStats.overdrive + amount);
  queueHudSync();
}

function registerHit(baseScore, audioLevels, options = {}) {
  const { feedTitle = null, feedDetail = null, hypeBonus = 0 } = options;
  const avg = audioLevels?.avg ?? 0.3;
  const bass = audioLevels?.bass ?? 0.3;
  const high = audioLevels?.high ?? 0.3;
  gameStats.hits += 1;
  gameStats.streak += 1;
  gameStats.bestStreak = Math.max(gameStats.bestStreak, gameStats.streak);
  gameStats.combo = Math.min(9, gameStats.combo + 0.25 + avg * 0.4);
  gameStats.comboTimer = 5;
  const comboBoost = 1 + Math.min(gameStats.streak, 100) * 0.02;
  const energyBoost = 1 + (avg + bass + high) * 0.35;
  const overdriveBoost = gameStats.overdrive > 1 ? 1.35 : 1;
  const scoreGain = Math.round(baseScore * comboBoost * energyBoost * gameStats.combo * overdriveBoost);
  gameStats.score += scoreGain;
  gameStats.hype = THREE.MathUtils.clamp(
    gameStats.hype + 0.08 + avg * 0.12 + hypeBonus,
    0,
    1.2
  );
  chargeOverdrive(0.06 + bass * 0.09 + high * 0.04);
  boostCorridorSpectrum(0.18 + avg * 0.2 + high * 0.3);
  lockReticle();
  queueHudSync();
  if (feedTitle || feedDetail) {
    const detail = feedDetail
      ? `${feedDetail} +${scoreGain.toLocaleString()} pts`
      : `+${scoreGain.toLocaleString()} pts`;
    pushFeed(feedTitle ?? "Target down", detail);
  }
  checkRewardMilestones(audioLevels);
  return scoreGain;
}

function checkRewardMilestones(audioLevels) {
  while (gameStats.score >= rewardState.nextScoreMilestone) {
    const milestoneValue = rewardState.nextScoreMilestone;
    celebrateMilestone(
      "Score Surge",
      `Passed ${milestoneValue.toLocaleString()} pts.`,
      0.6,
      audioLevels
    );
    rewardState.nextScoreMilestone += 5000;
  }
  if (gameStats.streak >= rewardState.nextStreakMilestone) {
    celebrateMilestone(
      "Streak Ignition",
      `${gameStats.streak} hits without a miss.`,
      0.45 + rewardState.nextStreakMilestone * 0.01,
      audioLevels
    );
    rewardState.nextStreakMilestone += 10;
  }
}

function drainShield(amount, reason) {
  if (amount <= 0) return;
  const prev = gameStats.shield;
  gameStats.shield = Math.max(SHIELD_FLOOR, gameStats.shield - amount);
  gameStats.combo = Math.max(1, gameStats.combo * 0.75);
  gameStats.streak = 0;
  queueHudSync();
  if (reason) {
    const delta = Math.max(0, (prev - gameStats.shield) * 100);
    const suffix = gameStats.shield <= SHIELD_FLOOR + 0.001 ? "Stability auto-holds." : "";
    pushFeed("Shield Impact", `${reason} (-${delta.toFixed(0)}%) ${suffix}`.trim());
  }
}

function boostShield(amount, reason) {
  if (amount <= 0) return;
  gameStats.shield = Math.min(1, gameStats.shield + amount);
  queueHudSync();
  if (reason) {
    pushFeed("Shield Boost", reason);
  }
}

function updateGameStats(delta, audioLevels) {
  if (gameStats.comboTimer > 0) {
    gameStats.comboTimer = Math.max(0, gameStats.comboTimer - delta);
  } else {
    gameStats.combo = THREE.MathUtils.lerp(gameStats.combo, 1, delta * 0.6);
  }
  const avg = audioLevels?.avg ?? 0.3;
  const hypeTarget = Math.max(avg, 0.2);
  gameStats.hype = THREE.MathUtils.lerp(gameStats.hype, hypeTarget, delta * 0.8);
  const regen = (0.01 + avg * 0.025) * delta;
  gameStats.shield = THREE.MathUtils.clamp(gameStats.shield + regen, 0, 1);
  const decay = gameStats.overdrive > 1 ? 0.2 : 0.05;
  gameStats.overdrive = Math.max(0, gameStats.overdrive - decay * delta);
  queueHudSync();
}

function updateOverdriveState(delta, audioLevels) {
  const body = document.body;
  if (!overdriveState.engaged && gameStats.overdrive >= 1) {
    overdriveState.engaged = true;
    overdriveState.timer = 6;
    pushFeed("OVERDRIVE ONLINE", "Arc reactor vented - visuals surge with the beat!");
    if (body) body.classList.add("overdrive");
  }
  if (overdriveState.engaged) {
    overdriveState.timer = Math.max(0, overdriveState.timer - delta);
    gameStats.overdrive = Math.max(0, gameStats.overdrive - delta * 0.35);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      1.35 + (audioLevels?.avg ?? 0) * 0.35,
      0.04
    );
    corridorState.baseSpeed = THREE.MathUtils.lerp(corridorState.baseSpeed, 6.2, 0.05);
    if (overdriveState.timer <= 0 || gameStats.overdrive <= 0.05) {
      overdriveState.engaged = false;
      if (body) body.classList.remove("overdrive");
      pushFeed("Overdrive spent", "Stack hype again to rearm the core.");
    }
  } else {
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, 1.1, 0.04);
    corridorState.baseSpeed = THREE.MathUtils.lerp(corridorState.baseSpeed, 4, 0.05);
  }
}

setTrackLabel(gameStats.trackName);

function lerpAngle(current, target, alpha) {
  const tau = Math.PI * 2;
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, tau) - Math.PI;
  return current + delta * alpha;
}

// Audio handling -----------------------------------------------------------
const audioElement = new Audio();
audioElement.preload = "auto";
audioElement.crossOrigin = "anonymous";

const audioState = {
  ctx: null,
  analyser: null,
  buffer: null,
  fileLabel: "UHOH.mp3",
  isReady: false,
  levels: { bass: 0, mid: 0, high: 0, avg: 0 },
  spectrum: [],
};
let fileObjectUrl = null;

const analysisState = {
  status: "idle",
  cues: [],
  pointer: 0,
  active: 0,
  trackLabel: "",
  downloadUrl: null,
};

const builtInCues = {
  "UHOH.mp3": [
    { time: 2.4, intensity: 0.78, sustain: 0.32, kind: "impact" },
    { time: 6.8, intensity: 0.64, sustain: 0.28, kind: "accent" },
    { time: 11.3, intensity: 0.85, sustain: 0.36, kind: "impact" },
    { time: 15.2, intensity: 0.71, sustain: 0.33, kind: "accent" },
    { time: 21.6, intensity: 0.92, sustain: 0.41, kind: "impact" },
    { time: 28.4, intensity: 0.75, sustain: 0.34, kind: "accent" },
    { time: 35.8, intensity: 0.88, sustain: 0.37, kind: "impact" },
    { time: 42.1, intensity: 0.68, sustain: 0.3, kind: "accent" },
  ],
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim() || "track";
}

function updateAnalysisStatus(message) {
  analysisState.status = message;
  setStatus(message);
}

function resetCuePlayback() {
  analysisState.pointer = 0;
  analysisState.active = 0;
}

function alignCuePointer(time = 0) {
  if (!analysisState.cues.length) {
    resetCuePlayback();
    return;
  }
  let idx = 0;
  while (idx < analysisState.cues.length && analysisState.cues[idx].time < time) idx += 1;
  analysisState.pointer = idx;
  analysisState.active = 0;
}

async function fetchSavedCues(label) {
  const precomputed = builtInCues[label];
  if (precomputed?.length) {
    return precomputed;
  }
  const slug = slugify(label);
  const endpoints = [
    `/analysis/cues?track=${encodeURIComponent(label)}`,
    `./cues/${slug}.json`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        if (response.status !== 404) {
          console.warn("Cue fetch failed:", endpoint, response.status);
        }
        continue;
      }
      const payload = await response.json();
      const cues = Array.isArray(payload?.cues) ? payload.cues : Array.isArray(payload) ? payload : null;
      if (cues?.length) return cues;
    } catch (error) {
      console.warn("Cue fetch failed:", endpoint, error);
    }
  }
  return null;
}

async function uploadTrackForAnalysis(file) {
  const formData = new FormData();
  formData.append("track", file, file.name || "track");
  const response = await fetch("/analysis", { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`Backend analysis failed (${response.status})`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.cues) ? payload.cues : [];
}

async function generateLocalCuesFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = ensureAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.max(1024, Math.floor(sampleRate * 0.25));
  const cues = [];
  for (let i = 0; i < data.length; i += windowSize) {
    let peak = 0;
    let sum = 0;
    for (let j = 0; j < windowSize; j += 1) {
      const sample = Math.abs(data[i + j] || 0);
      sum += sample;
      if (sample > peak) peak = sample;
    }
    const energy = sum / Math.max(1, windowSize);
    if (peak > 0.32) {
      cues.push({
        time: Number((i / sampleRate).toFixed(2)),
        intensity: Number(peak.toFixed(3)),
        sustain: Number(energy.toFixed(3)),
        kind: peak > 0.6 ? "impact" : "accent",
      });
      if (cues.length > 600) break;
    }
  }
  return cues;
}

function offerCueDownload(label, cues) {
  if (!cues?.length) return;
  if (analysisState.downloadUrl) {
    URL.revokeObjectURL(analysisState.downloadUrl);
  }
  const payload = { track: label, cues };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  analysisState.downloadUrl = url;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(label)}-cues.json`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function finalizeCues(label, cues, origin) {
  analysisState.cues = (cues || []).slice().sort((a, b) => a.time - b.time);
  analysisState.trackLabel = label;
  resetCuePlayback();
  if (analysisState.cues.length) {
    updateAnalysisStatus(`Analysis ready (${analysisState.cues.length} cues via ${origin}).`);
    offerCueDownload(label, analysisState.cues);
  } else {
    updateAnalysisStatus(`No cue data available for "${label}".`);
  }
}

async function prepareCuesForLabel(label) {
  analysisState.trackLabel = label;
  const cues = await fetchSavedCues(label);
  if (cues?.length) {
    finalizeCues(label, cues, "stored");
  } else {
    analysisState.cues = [];
    analysisState.pointer = 0;
    updateAnalysisStatus(`No stored cues for "${label}". Load a file to analyze it.`);
  }
}

async function analyzeSelectedTrack(file) {
  if (!file) return;
  const label = file.name || "custom-track";
  analysisState.trackLabel = label;
  updateAnalysisStatus(`Analyzing "${label}"...`);
  const stored = await fetchSavedCues(label);
  if (stored?.length) {
    finalizeCues(label, stored, "stored");
    return;
  }
  try {
    const backendCues = await uploadTrackForAnalysis(file);
    if (backendCues?.length) {
      finalizeCues(label, backendCues, "server");
      return;
    }
  } catch (error) {
    console.warn("Backend analysis failed", error);
  }
  try {
    const localCues = await generateLocalCuesFromFile(file);
    finalizeCues(label, localCues, "local");
  } catch (error) {
    console.warn("Local analysis failed", error);
    updateAnalysisStatus(`Analysis failed for "${label}". Using live audio only.`);
    analysisState.cues = [];
  }
}

function applyCueEvent(cue) {
  const strength = THREE.MathUtils.clamp(cue?.intensity ?? 0.6, 0, 1);
  boostCorridorSpectrum(0.3 + strength * 0.7);
  hoopSpawnState.timer = Math.min(hoopSpawnState.timer, 0.25 + (1 - strength) * 0.2);
  ringPassState.intensity = Math.min(1, ringPassState.intensity + strength * 0.35);
  analysisState.active = Math.min(1, analysisState.active + strength);
}

function syncCuePlayback(delta) {
  if (!analysisState.cues.length || !audioElement || Number.isNaN(audioElement.currentTime)) return;
  if (audioElement.paused) {
    analysisState.active = Math.max(0, analysisState.active - delta * 0.5);
    return;
  }
  const currentTime = audioElement.currentTime;
  while (
    analysisState.pointer < analysisState.cues.length &&
    currentTime >= analysisState.cues[analysisState.pointer].time
  ) {
    applyCueEvent(analysisState.cues[analysisState.pointer]);
    analysisState.pointer += 1;
  }
  analysisState.active = Math.max(0, analysisState.active - delta * 0.9);
}
function loadTrackFromSource(src, label, shouldRequestCues = true) {
  audioState.fileLabel = label;
  audioState.isReady = false;
  setTrackLabel(label);
  analysisState.trackLabel = label;
  analysisState.cues = [];
  resetCuePlayback();
  if (analysisState.downloadUrl) {
    URL.revokeObjectURL(analysisState.downloadUrl);
    analysisState.downloadUrl = null;
  }
  if (ui.playBtn) {
    ui.playBtn.disabled = true;
    ui.playBtn.textContent = "Play";
  }
  setStatus(`Loading ${label}...`);
  audioElement.pause();
  audioElement.src = src;
  audioElement.load();
  pushFeed("Track armed", `Syncing "${label}" to the corridor...`);
  if (shouldRequestCues) {
    prepareCuesForLabel(label).catch((error) => {
      console.warn("Cue preparation failed", error);
    });
  }
}

function handleFileSelection(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  if (fileObjectUrl) {
    URL.revokeObjectURL(fileObjectUrl);
  }
  fileObjectUrl = URL.createObjectURL(file);
  loadTrackFromSource(fileObjectUrl, file.name, false);
  analyzeSelectedTrack(file).catch((error) => {
    console.warn("Track analysis failed", error);
  });
}

function ensureAudioContext() {
  if (audioState.ctx) return audioState.ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContextClass();
  const source = ctx.createMediaElementSource(audioElement);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.85;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  audioState.ctx = ctx;
  audioState.analyser = analyser;
  audioState.buffer = new Uint8Array(analyser.frequencyBinCount);
  return ctx;
}

async function handleTogglePlayback() {
  try {
    const ctx = ensureAudioContext();
    await ctx.resume();
  } catch (error) {
    console.warn("Audio context resume failed", error);
  }

  if (audioElement.paused) {
    try {
      await audioElement.play();
      setStatus(`Playing ${audioState.fileLabel}`);
      pushFeed("Flight engaged", "Surf the beat, weave the neon corridor, chase the luminous hoops.");
      if (ui.playBtn) ui.playBtn.textContent = "Pause";
    } catch (error) {
      console.warn("Playback failed", error);
      setStatus("Playback failed - check browser permissions.");
    }
  } else {
    audioElement.pause();
    if (ui.playBtn) ui.playBtn.textContent = "Play";
    setStatus("Paused");
    pushFeed("Flight paused", "Music feed halted - cockpit coasting.");
  }
}

function attachAudioEvents() {
  if (ui.fileInput) {
    ui.fileInput.addEventListener("change", handleFileSelection);
  }
  if (ui.playBtn) {
    ui.playBtn.addEventListener("click", handleTogglePlayback);
    ui.playBtn.disabled = true;
  }

  audioElement.addEventListener("canplaythrough", () => {
    audioState.isReady = true;
    if (ui.playBtn) ui.playBtn.disabled = false;
    setStatus(`Ready: ${audioState.fileLabel}`);
    pushFeed("Audio locked", `"${audioState.fileLabel}" synced. Engage when ready.`);
  });

  audioElement.addEventListener("ended", () => {
    if (ui.playBtn) ui.playBtn.textContent = "Play";
    setStatus("Playback complete");
    pushFeed("Track complete", "Replay the lane or load fresh vibes.");
    alignCuePointer(0);
  });

  audioElement.addEventListener("error", () => {
    setStatus("Audio load error - try another file.");
    pushFeed("Audio error", "Could not decode the selected file.");
  });

  audioElement.addEventListener("play", () => {
    alignCuePointer(audioElement.currentTime || 0);
  });

  audioElement.addEventListener("seeked", () => {
    alignCuePointer(audioElement.currentTime || 0);
  });
}

function sampleAudioLevels() {
  if (!audioState.analyser || !audioState.buffer) return audioState.levels;
  audioState.analyser.getByteFrequencyData(audioState.buffer);
  const len = audioState.buffer.length;
  const bassEnd = Math.floor(len * 0.1);
  const midEnd = Math.floor(len * 0.35);

  const sumRange = (start, end) => {
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += audioState.buffer[i];
    return (sum / Math.max(1, end - start)) / 255;
  };

  const bass = sumRange(0, bassEnd);
  const mid = sumRange(bassEnd, midEnd);
  const high = sumRange(midEnd, len);

  if (!audioState.spectrum || audioState.spectrum.length !== analyzerBandCount) {
    audioState.spectrum = new Array(analyzerBandCount).fill(0);
  }
  const bandSize = Math.floor(len / analyzerBandCount);
  for (let i = 0; i < analyzerBandCount; i += 1) {
    const start = i * bandSize;
    const end = i === analyzerBandCount - 1 ? len : Math.min(len, start + bandSize);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += audioState.buffer[j];
    const level = (sum / Math.max(1, end - start)) / 255;
    audioState.spectrum[i] = THREE.MathUtils.lerp(audioState.spectrum[i], level, 0.35);
  }

  audioState.levels.bass = THREE.MathUtils.lerp(audioState.levels.bass, bass, 0.25);
  audioState.levels.mid = THREE.MathUtils.lerp(audioState.levels.mid, mid, 0.25);
  audioState.levels.high = THREE.MathUtils.lerp(audioState.levels.high, high, 0.25);
  audioState.levels.avg = (audioState.levels.bass + audioState.levels.mid + audioState.levels.high) / 3;
  return audioState.levels;
}

attachAudioEvents();
const defaultTrackSrc = new URL("./UHOH.mp3", import.meta.url).href;
loadTrackFromSource(defaultTrackSrc, "UHOH.mp3");

if (ui.watchBtn) {
  ui.watchBtn.addEventListener("click", toggleShowcaseMode);
}
updateWatchButtonLabel();

// Three.js scene -----------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040b);

// --- Restored Definitions ---
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
document.body.appendChild(renderer.domElement);

function getRenderWidth() {
  return window.innerWidth;
}

function updateRendererPixelRatio() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function buildVrButton() {
  const vrButton = VRButton.createButton(renderer);
  vrButton.id = "vr-button";
  vrButton.style.position = "static";
  vrButton.style.margin = "0";
  vrButton.style.padding = "6px 18px";
  vrButton.style.borderRadius = "999px";
  vrButton.style.fontWeight = "600";
  vrButton.style.letterSpacing = "0.02em";
  vrButton.classList.add("vr-ui-button");
  if (ui.bar) {
    if (ui.status) {
      ui.bar.insertBefore(vrButton, ui.status);
    } else {
      ui.bar.appendChild(vrButton);
    }
  } else {
    document.body.appendChild(vrButton);
  }
  ui.vrBtn = vrButton;
}

buildVrButton();

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);
const hoopInstances = [];
const cubeMaxCount = 8;
const HOOP_BOUNDS = { x: 4.8, y: 3.2 };
const hoopSpawnState = { timer: 0, anchor: new THREE.Vector2(0, 0) };

const ringGeometry = new THREE.TorusGeometry(1.1, 0.12, 24, 96);
const cubeTypeDefinitions = [
  {
    hue: 0.55, saturation: 0.88, lightness: 0.52, emissive: 0.35,
    onImpact: (audioLevels) => {
      addAudioShimmer(0.6);
      addAudioBloom(0.25 + (audioLevels?.high ?? 0) * 0.4);
    },
  },
  {
    hue: 0.03, saturation: 0.92, lightness: 0.56, emissive: 0.4,
    onImpact: (audioLevels) => {
      corridorImpactState.intensity = Math.max(corridorImpactState.intensity, 0.75);
      corridorImpactState.hue = (0.1 + audioLevels.mid * 0.4) % 1;
      addAudioShimmer(0.35);
    },
  },
  {
    hue: 0.32, saturation: 0.82, lightness: 0.54, emissive: 0.32,
    onImpact: (audioLevels) => {
      corridorImpactState.intensity = Math.min(1, corridorImpactState.intensity + 0.4);
      addAudioBloom(0.4 + (audioLevels?.mid ?? 0) * 0.4);
    },
  },
];

const fontLoader = new FontLoader();
let celebrationFont = null;
fontLoader.load(
  "https://cdn.jsdelivr.net/npm/three@0.158/examples/fonts/helvetiker_regular.typeface.json",
  (font) => { celebrationFont = font; }
);
const celebrationWordMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0.4, 0.9, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const celebrationWordGroup = new THREE.Group();
celebrationWordGroup.renderOrder = 3;
scene.add(celebrationWordGroup);
let celebrationWordMesh = null;
const celebrationWordState = { life: 0, maxLife: 0 };
const celebrationVocabulary = ["FLOW", "CLEAR", "GLIDE", "SYNC"];

const audioPulseGroup = new THREE.Group();
scene.add(audioPulseGroup);
const audioPulseStates = [];
const audioPulseGeometry = new THREE.RingGeometry(0.32, 0.44, 48);
const audioPulseColors = [0.56, 0.62, 0.48];
for (let i = 0; i < 3; i += 1) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setHSL(audioPulseColors[i], 0.9, 0.6 + i * 0.04),
    transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(audioPulseGeometry, material);
  mesh.visible = true;
  mesh.renderOrder = 2;
  audioPulseGroup.add(mesh);
  audioPulseStates.push({ mesh, baseScale: 1 + i * 0.3, offset: 0.18 + i * 0.15 });
}

const tunnelSegments = [];
const segmentCount = 17;
const segmentSpacing = 4;
const corridorState = {
  scroll: 0,
  depth: segmentCount * segmentSpacing,
  baseSpeed: 4,
};

const worldReactState = {
  energy: 0,
  volatility: 0,
  paletteShift: 0,
  evolution: 0,
};

const audioDynamics = {
  bass: 0, mid: 0, high: 0, prevBass: 0, prevMid: 0, prevHigh: 0, bassRise: 0, midRise: 0, highRise: 0, crest: 0,
};

// Tunnel creation
const tunnelLineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(9, 5, 0.5));
for (let i = 0; i < segmentCount; i++) {
  const material = new THREE.LineBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.3 });
  const line = new THREE.LineSegments(tunnelLineGeometry, material);
  line.position.z = -i * segmentSpacing;
  scene.add(line);
  tunnelSegments.push({
    line, material, baseZ: -i * segmentSpacing, index: i,
    motion: { phase: i * 0.5, speed: 1, amplitudeX: 0.5, amplitudeY: 0.5, baseScale: 1, scaleSpeed: 1, scaleOffset: 0 }
  });
}

function boostCorridorSpectrum(amount) {
  corridorSpectra.boost = Math.min(2, corridorSpectra.boost + amount);
}

function addAudioShimmer(amount) {
  boostCorridorSpectrum(amount);
}

function addAudioBloom(amount) {
  boostCorridorSpectrum(amount * 0.8);
}

function updateAudioDynamics(delta, audioLevels) {
  if (!audioLevels) return;
  const blend = Math.min(1, delta * 4);
  const { bass = 0, mid = 0, high = 0 } = audioLevels;
  audioDynamics.prevBass = THREE.MathUtils.lerp(audioDynamics.prevBass, bass, blend);
  audioDynamics.prevMid = THREE.MathUtils.lerp(audioDynamics.prevMid, mid, blend);
  audioDynamics.prevHigh = THREE.MathUtils.lerp(audioDynamics.prevHigh, high, blend);
  audioDynamics.bass = THREE.MathUtils.lerp(audioDynamics.bass, bass, blend);
  audioDynamics.mid = THREE.MathUtils.lerp(audioDynamics.mid, mid, blend);
  audioDynamics.high = THREE.MathUtils.lerp(audioDynamics.high, high, blend);
  const riseBlend = Math.min(1, delta * 7);
  audioDynamics.bassRise = THREE.MathUtils.lerp(audioDynamics.bassRise, Math.max(0, bass - audioDynamics.prevBass), riseBlend);
  audioDynamics.midRise = THREE.MathUtils.lerp(audioDynamics.midRise, Math.max(0, mid - audioDynamics.prevMid), riseBlend);
  audioDynamics.highRise = THREE.MathUtils.lerp(audioDynamics.highRise, Math.max(0, high - audioDynamics.prevHigh), riseBlend);
}

function computeCorridorFlowSpeed(audioLevels) {
  const speedBoost = 1 + (audioLevels?.bass ?? 0) * 0.6;
  const avgGain = audioLevels?.avg ?? 0;
  return (corridorState.baseSpeed + avgGain * 5.4) * speedBoost;
}

function updateHoopSpawner(delta, audioLevels) {
  hoopSpawnState.timer = Math.max(0, hoopSpawnState.timer - delta);
  if (hoopSpawnState.timer > 0 || hoopInstances.length >= cubeMaxCount) return;
  const energy = (audioLevels?.avg ?? 0) + (audioLevels?.bass ?? 0) * 0.5;
  if (energy > 0.35) {
    spawnHoop();
    hoopSpawnState.timer = 1.5 + (1 - energy) * 2;
  }
}

function updateEnemySpawner(delta, audioLevels) {
  // Placeholder if enemies are not fully implemented in main.js
}

function updateWorldReactivity(delta, audioLevels, time) {
  const avg = audioLevels?.avg ?? 0;
  const bass = audioLevels?.bass ?? 0;
  const mid = audioLevels?.mid ?? 0;
  const high = audioLevels?.high ?? 0;
  worldReactState.energy = Math.max(0, worldReactState.energy - delta * 0.5);
  worldReactState.volatility = Math.max(0, worldReactState.volatility - delta * 0.2);
  if (bass > 0.4) worldReactState.energy += bass * delta * 0.8;
  if (high > 0.4) worldReactState.volatility += high * delta * 0.5;
  worldReactState.paletteShift = (worldReactState.paletteShift + delta * (0.1 + worldReactState.volatility)) % 1;
  worldReactState.evolution += delta * (0.2 + worldReactState.energy);
}


function spawnHoop(origin = {}) {
  if (hoopInstances.length >= cubeMaxCount) {
    return;
  }
  const typeIndex = Math.floor(Math.random() * cubeTypeDefinitions.length);
  const typeDef = cubeTypeDefinitions[typeIndex];
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(typeDef.hue, typeDef.saturation, typeDef.lightness),
    metalness: 0.3,
    roughness: 0.25,
    emissive: new THREE.Color().setHSL(typeDef.hue, typeDef.saturation, typeDef.emissive),
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(ringGeometry, material);
  const spawnX = typeof origin.x === "number" ? origin.x : 0;
  const spawnY = typeof origin.y === "number" ? origin.y : 0;
  const spawnZ = typeof origin.z === "number" ? origin.z : -corridorState.depth - Math.random() * 12;
  mesh.position.set(spawnX, spawnY, spawnZ);
  const baseScale = 0.8 + Math.random() * 0.4;
  mesh.scale.setScalar(baseScale);
  cubeGroup.add(mesh);
  const approxRadius = baseScale * 0.35;
  hoopInstances.push({
    mesh,
    baseScale,
    radius: approxRadius,
    passRadius: approxRadius * 0.7,
    collisionRadius: approxRadius * 0.95,
    impactFlash: 0,
    typeIndex,
    passTriggered: false,
    collided: false,
    colliding: false,
  });
}

const corridorImpactState = { intensity: 0, hue: 0 };

function triggerRingPass(audioLevels, cube) {
  ringPassState.intensity = 1;
  registerRingCelebration(audioLevels);
  registerHit(320, audioLevels, {
    feedTitle: "Hoop cleared",
    feedDetail: "Flow locked - keep threading the beam.",
    hypeBonus: 0.05,
  });
  addAudioShimmer(0.5 + (audioLevels?.high ?? 0) * 0.4);
  addAudioBloom(0.45 + (audioLevels?.mid ?? 0) * 0.35);
  armPulseState.progress = 1;
  armPulseState.recoil = 1;
  if (cube) {
    const typeDef = cubeTypeDefinitions[cube.typeIndex] || null;
    typeDef?.onImpact?.(audioLevels);
    triggerRingFlythroughBurst(cube, audioLevels);
  }
}

function triggerRingFlythroughBurst(cube, audioLevels) {
  const hue = (0.12 + (audioLevels?.high ?? 0) * 0.4 + cube.typeIndex * 0.05) % 1;
  triggerCelebrationVisual(1, audioLevels, hue);
  spawnCelebrationWord(null, audioLevels);
}

function triggerRingCollisionEffect(cube, audioLevels) {
  const hue = (0.02 + (audioLevels?.mid ?? 0) * 0.25) % 1;
  const typeDef = cubeTypeDefinitions[cube.typeIndex] || null;
  typeDef?.onImpact?.(audioLevels);
  addAudioShimmer(0.25);
}

function registerRingCelebration(audioLevels) {
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
  if (now - rewardState.lastRingTime > rewardState.ringTimeout) {
    rewardState.ringChain = 0;
  }
  rewardState.ringChain += 1;
  rewardState.lastRingTime = now;
  if (rewardState.ringChain > 0 && rewardState.ringChain % 5 === 0) {
    const tier = rewardState.ringChain / 5;
    const hue = (0.12 + tier * 0.05 + (audioLevels?.high ?? 0) * 0.4) % 1;
    celebrateMilestone(
      "Ring Flow",
      `${rewardState.ringChain} corridor rings linked.`,
      0.55 + tier * 0.08,
      audioLevels,
      hue
    );
  }
}

function celebrateMilestone(title, detail, intensity, audioLevels, hueOverride) {
  triggerCelebrationVisual(intensity, audioLevels, hueOverride);
  if (title || detail) {
    pushFeed(title ?? "Milestone", detail ?? "");
  }
  rewardState.flash = Math.max(rewardState.flash, intensity * 0.8);
  heroGlowState.intensity = Math.max(heroGlowState.intensity, 0.5 + intensity * 0.5);
}

function acquireCelebrationBurst() {
  for (const entry of celebrationBursts) {
    if (entry.life <= 0) return entry;
  }
  const geometry = new THREE.RingGeometry(0.4, 0.9, 64);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(0, 0, 0);
  mesh.visible = false;
  scene.add(mesh);
  const entry = { mesh, life: 0, maxLife: 1, baseScale: 1 };
  celebrationBursts.push(entry);
  return entry;
}

function triggerCelebrationVisual(intensity, audioLevels, hueOverride) {
  const entry = acquireCelebrationBurst();
  entry.life = 0.85 + intensity * 0.6;
  entry.maxLife = entry.life;
  entry.baseScale = 1.1 + intensity * 1.6;
  const hue = hueOverride ?? (0.1 + (audioLevels?.avg ?? 0) * 0.6);
  entry.mesh.material.color.setHSL(hue % 1, 0.95, 0.65);
  entry.mesh.material.opacity = 0.9;
  entry.mesh.position.copy(heroAnchorPosition);
  entry.mesh.position.z -= 0.35;
  entry.mesh.visible = true;
}

function updateCelebrationBursts(delta) {
  celebrationBursts.forEach((entry) => {
    if (entry.life <= 0) return;
    entry.life = Math.max(0, entry.life - delta);
    const blend = entry.life / entry.maxLife;
    const scale = entry.baseScale * (1 + (1 - blend) * 0.8);
    entry.mesh.scale.setScalar(scale);
    entry.mesh.material.opacity = blend * 0.85;
    entry.mesh.visible = entry.life > 0;
  });
}

const celebrationTextParams = {
  size: 1.4,
  height: 0.3,
  bevelEnabled: true,
  bevelSize: 0.04,
  bevelThickness: 0.08,
  curveSegments: 12,
};

function createCelebrationWordGeometry(text = "FLOW") {
  if (!celebrationFont) return null;
  const geometry = new TextGeometry(text, {
    font: celebrationFont,
    size: celebrationTextParams.size,
    height: celebrationTextParams.height,
    bevelEnabled: celebrationTextParams.bevelEnabled,
    bevelSize: celebrationTextParams.bevelSize,
    bevelThickness: celebrationTextParams.bevelThickness,
    curveSegments: celebrationTextParams.curveSegments,
  });
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  return geometry;
}

function spawnCelebrationWord(text, audioLevels) {
  if (!celebrationFont) return;
  const word = text ?? celebrationVocabulary[Math.floor(Math.random() * celebrationVocabulary.length)];
  const geometry = createCelebrationWordGeometry(word);
  if (!geometry) return;
  if (!celebrationWordMesh) {
    celebrationWordMesh = new THREE.Mesh(geometry, celebrationWordMaterial);
    celebrationWordGroup.add(celebrationWordMesh);
  } else {
    celebrationWordMesh.geometry.dispose();
    celebrationWordMesh.geometry = geometry;
  }
  const hue =
    (0.15 + (audioLevels?.high ?? 0) * 0.35 + (audioLevels?.mid ?? 0) * 0.2) % 1;
  celebrationWordMaterial.color.setHSL(hue, 0.92, 0.65);
  const wordDepth = camera.position.z - corridorState.depth - 2.5;
  celebrationWordGroup.position.set(0, 0.8, wordDepth);
  celebrationWordGroup.scale.set(1, 1, 1);
  celebrationWordState.maxLife = 1.1;
  celebrationWordState.life = celebrationWordState.maxLife;
  celebrationWordMaterial.opacity = 0.85;
  celebrationWordMesh.quaternion.copy(camera.quaternion);
}

function updateCelebrationWord(delta) {
  if (!celebrationWordMesh) return;
  if (celebrationWordState.life <= 0) {
    celebrationWordMaterial.opacity = THREE.MathUtils.lerp(
      celebrationWordMaterial.opacity,
      0,
      0.1
    );
    return;
  }
  celebrationWordState.life = Math.max(0, celebrationWordState.life - delta);
  const blend =
    celebrationWordState.maxLife > 0 ? celebrationWordState.life / celebrationWordState.maxLife : 0;
  const targetOpacity = blend * 0.8;
  celebrationWordMaterial.opacity = THREE.MathUtils.lerp(
    celebrationWordMaterial.opacity,
    targetOpacity,
    0.2
  );
  const pulse = 1 + (1 - blend) * 0.5;
  celebrationWordGroup.scale.set(pulse, pulse, pulse);
  celebrationWordMesh.quaternion.copy(camera.quaternion);
}

const heroCollision = { radius: 0.9, active: false };
const collisionVector = new THREE.Vector3();
const heroCollisionEvent = { lastActive: false, flash: 0 };
const ringPassState = { intensity: 0 };
const rewardState = {
  ringChain: 0,
  lastRingTime: 0,
  ringTimeout: 5,
  nextScoreMilestone: 5000,
  nextStreakMilestone: 10,
  flash: 0,
};
const celebrationBursts = [];

function updateCorridor(delta, audioLevels, time) {
  const depth = corridorState.depth;
  const flowSpeed = computeCorridorFlowSpeed(audioLevels) * getThrottleBoost();
  updateHoopSpawner(delta, audioLevels);
  updateEnemySpawner(delta, audioLevels);
  updateAudioDynamics(delta, audioLevels);
  corridorState.scroll += flowSpeed * delta;
  if (corridorState.scroll > depth) {
    const wrapUnits = Math.floor(corridorState.scroll / depth);
    const wrapOffset = wrapUnits * depth;
    corridorState.scroll -= wrapOffset;
    tunnelSegments.forEach((segment) => {
      segment.baseZ += wrapOffset;
    });
  }
  const offset = corridorState.scroll;
  const heroFlashInfluence = heroCollisionEvent.flash * 0.6;
  const impactBlend = Math.max(corridorImpactState.intensity, heroFlashInfluence);
  const cueBlend = analysisState.active || 0;
  const ringBlend = Math.min(1, ringPassState.intensity + cueBlend * 0.4);
  const morphEnergy = worldReactState.energy;
  const paletteShift = worldReactState.paletteShift;
  const worldVolatility = worldReactState.volatility;
  const evolution = worldReactState.evolution;
  const bass = audioLevels?.bass ?? 0;
  const mid = audioLevels?.mid ?? 0;
  const high = audioLevels?.high ?? 0;
  const avg = audioLevels?.avg ?? 0;

  const impactHue = corridorImpactState.hue || (0.52 + high * 0.35);
  const spectrumValues = audioState.spectrum ?? [];
  tunnelSegments.forEach((segment) => {
    let z = segment.baseZ + offset;
    while (z > camera.position.z + 2) {
      z -= depth;
      segment.baseZ -= depth;
    }
    segment.line.position.z = z;
    const baseHue = 0.5 + mid * 0.18 - segment.index * 0.002 + paletteShift * 0.25;
    const hueLerp = Math.min(1, impactBlend * 0.7);
    const blendedHue = THREE.MathUtils.lerp(baseHue, impactHue, hueLerp);
    const adjustedHue = (blendedHue + ringBlend * 0.12 + audioDynamics.highRise * 0.2) % 1;
    const lightness = 0.35 + high * 0.28 + impactBlend * 0.2 + ringBlend * 0.1;
    segment.material.color.setHSL(adjustedHue, 0.82, lightness);
    const shapeBoost = 1 + impactBlend * 0.25 + ringBlend * 0.15 + morphEnergy * 0.25 + audioDynamics.midRise * 0.2;
    const targetOpacity = 0.2 + bass * 0.55 + impactBlend * 0.35 + audioDynamics.bassRise * 0.25;
    segment.material.opacity = THREE.MathUtils.lerp(
      segment.material.opacity,
      targetOpacity + ringBlend * 0.2,
      0.15
    );
    const motion = segment.motion;
    const motionSeed = time * 0.00145 + motion.phase;
    const xOffset = Math.sin(motionSeed * motion.speed) * motion.amplitudeX;
    const yOffset = Math.cos(motionSeed * motion.speed * 1.25) * motion.amplitudeY;
    segment.line.position.x = xOffset;
    segment.line.position.y = yOffset;
    const morphPhase = evolution + segment.index * 0.28;
    const motionScale = motion.baseScale + Math.sin(motionSeed * motion.scaleSpeed) * 0.08 + motion.scaleOffset;
    const morphScale = 1 + Math.sin(morphPhase * 1.1) * morphEnergy * 0.25;
    const axisScale = 1 + Math.cos(morphPhase * 0.9) * paletteShift * 0.12;
    segment.line.scale.set(
      motionScale * shapeBoost * morphScale,
      motionScale * shapeBoost * axisScale,
      motionScale * shapeBoost * (1 + morphEnergy * 0.05)
    );
    if (segment.overlay) {
      segment.overlay.position.copy(segment.line.position);
      segment.overlay.scale.copy(segment.line.scale);
      segment.wallBars?.forEach((entry) => {
        const bandValue = spectrumValues.length
          ? spectrumValues[entry.bandIndex % spectrumValues.length]
          : audioLevels.avg ?? 0;
        const boost = corridorSpectra.boost;
        entry.mesh.scale.y = 0.6 + bandValue * 3 + boost * 0.5;
        entry.mesh.material.opacity = 0.05 + bandValue * 0.45 + boost * 0.2;
        entry.mesh.material.color.setHSL(
          (0.56 - bandValue * 0.25 + ringBlend * 0.12 + paletteShift * 0.2) % 1,
          0.9,
          0.55 + bandValue * 0.35 + boost * 0.1
        );
      });
    }
  });
  corridorSpectra.boost = Math.max(0, corridorSpectra.boost - delta * 0.9);

  const hoopRemove = [];
  const spectra = [audioLevels.bass, audioLevels.mid, audioLevels.high];
  hoopInstances.forEach((entry, idx) => {
    entry.mesh.position.z += flowSpeed * delta * 1.08;
    if (entry.mesh.position.z > camera.position.z + 8) {
      hoopRemove.push(idx);
      return;
    }
    const bandValue = spectra[entry.typeIndex] ?? (audioLevels.avg ?? 0.35);
    const scale = entry.baseScale * (1 + bandValue * 0.45 + entry.impactFlash * 0.18);
    entry.mesh.scale.setScalar(scale);
    entry.radius = scale * 0.35;
    entry.passRadius = Math.max(0.5, entry.radius * 0.7);
    entry.collisionRadius = entry.radius + heroCollision.radius * 0.15;
    const hue =
      (0.56 + bandValue * 0.32 + entry.impactFlash * 0.18 + ringBlend * 0.08 + paletteShift * 0.12) % 1;
    entry.mesh.material.color.setHSL(hue, 0.82, 0.45 + bandValue * 0.35);
    entry.mesh.material.emissive.setHSL(hue, 0.82, 0.36 + bandValue * 0.3);
    entry.mesh.material.emissiveIntensity = 0.2 + bandValue * 1.6 + entry.impactFlash * 0.5;
    entry.impactFlash = Math.max(0, entry.impactFlash - delta * 1.8);
  });
  hoopRemove.reverse().forEach((idx) => {
    const [removed] = hoopInstances.splice(idx, 1);
    if (removed) {
      cubeGroup.remove(removed.mesh);
    }
  });

  if (ringPassState.intensity > 0) {
    ringPassState.intensity = Math.max(0, ringPassState.intensity - delta * 0.35);
  }

  corridorImpactState.intensity = Math.max(0, corridorImpactState.intensity - delta * 1.6);
}

function checkCubeCollisions(delta, audioLevels) {
  heroCollision.active = false;
  const heroPos = heroAnchorPosition;
  const heroRadius = heroCollision.radius;
  hoopInstances.forEach((entry) => {
    collisionVector.copy(entry.mesh.position).sub(heroPos);
    const planarDist = Math.hypot(collisionVector.x, collisionVector.y);
    const zDelta = collisionVector.z;
    const planeWindow = heroRadius * 0.6 + 0.4;
    const passRadius = entry.passRadius ?? Math.max(0.5, entry.radius * 0.6);
    const collisionRadius = entry.collisionRadius ?? entry.radius + heroRadius * 0.2;
    const nearPlane = Math.abs(zDelta) <= planeWindow;
    const insideRing = planarDist <= passRadius;
    const touchingRing = planarDist > passRadius && planarDist <= collisionRadius;
    entry.colliding = false;

    if (!entry.passTriggered && nearPlane && insideRing) {
      entry.passTriggered = true;
      entry.collided = false;
      triggerRingPass(audioLevels, entry);
    } else if (!entry.collided && nearPlane && touchingRing) {
      entry.collided = true;
      entry.passTriggered = true;
      heroCollision.active = true;
      triggerRingCollisionEffect(entry, audioLevels);
    }

    if (nearPlane && touchingRing) {
      entry.colliding = true;
    }

    if (entry.colliding) {
      heroCollision.active = true;
    }
    entry.impactFlash = Math.max(0, entry.impactFlash - delta * 2);
  });

  const levels = audioLevels || audioState.levels;
  if (heroCollision.active && !heroCollisionEvent.lastActive) {
    heroCollisionEvent.flash = 1;
    corridorImpactState.intensity = Math.max(corridorImpactState.intensity, 0.6);
    drainShield(0.05, "Hoop collision");
  }
  heroCollisionEvent.lastActive = heroCollision.active;
  heroCollisionEvent.flash = Math.max(0, heroCollisionEvent.flash - delta * 2.2);
}

function updateReactorGlow(audioLevels, time) {
  const rawEnergy = audioLevels.mid * 0.7 + audioLevels.high * 0.55;
  const pulse = Math.pow(Math.max(0, rawEnergy - 0.08), 1.4);
  reactorPulse.energy = THREE.MathUtils.lerp(reactorPulse.energy, pulse, 0.35);
  const flicker = 0.05 + Math.sin(time * 0.006) * 0.05;

  const scale = 0.45 + reactorPulse.energy * 2.3;
  reactorPulse.core.scale.setScalar(scale);
  reactorPulse.core.material.opacity = 0.18 + reactorPulse.energy * 0.8;
  reactorPulse.core.material.emissiveIntensity = 0.6 + reactorPulse.energy * 3.8;
  const coreHue = (0.5 + audioLevels.high * 0.35) % 1;
  reactorPulseColor.setHSL(coreHue, 0.8, 0.6 + reactorPulse.energy * 0.25);
  reactorPulse.core.material.emissive.copy(reactorPulseColor);

  const housingMat = reactorPulse.housing.material;
  housingMat.emissive.copy(reactorPulseColor);
  housingMat.emissiveIntensity = 0.1 + reactorPulse.energy * 2.2;
  housingMat.opacity = 0.7 + reactorPulse.energy * 0.25;

  const auraScale = 1 + reactorPulse.energy * 3.8;
  reactorPulse.aura.scale.set(auraScale, auraScale, auraScale);
  reactorPulse.aura.material.opacity =
    0.08 + reactorPulse.energy * 0.85 + Math.abs(Math.sin(time * 0.01)) * 0.08;
  reactorPulse.aura.material.color.copy(reactorPulse.core.material.color);
}

function updateHeroGlow(audioLevels) {
  if (!heroGlowTargets.length) return;
  const energy = Math.pow(Math.max(0, audioLevels.avg - 0.05), 1.5);
  heroGlowState.intensity = THREE.MathUtils.lerp(heroGlowState.intensity, energy, 0.25);
  const glowHue = (0.58 + audioLevels.high * 0.25) % 1;
  heroGlowColor.setHSL(glowHue, 0.65, 0.55 + heroGlowState.intensity * 0.3);
  heroGlowTargets.forEach((target) => {
    target.material.emissive.lerpColors(target.baseEmissive, heroGlowColor, 0.5);
    target.material.emissiveIntensity = THREE.MathUtils.lerp(
      target.material.emissiveIntensity ?? 1,
      target.baseIntensity + heroGlowState.intensity * 3.2,
      0.3
    );
    target.material.needsUpdate = true;
  });
}


// Lighting -----------------------------------------------------------------
const sunLight = new THREE.DirectionalLight(0xffc6c0, 1.2);
sunLight.position.set(-5, 6, 12);
scene.add(sunLight);

// Iron Man model + state ---------------------------------------------------
const loader = new GLTFLoader();
const manModel = new THREE.Group();
scene.add(manModel);

const reactorAnchor = new THREE.Object3D();
const reactorRig = new THREE.Object3D();
reactorRig.position.set(0, 0.2, 0.9);
reactorAnchor.add(reactorRig);
const reactorCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0x3199ff),
  emissiveIntensity: 0.6,
  metalness: 0.2,
  roughness: 0.1,
  transparent: true,
  opacity: 0.9,
});
const reactorCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 32), reactorCoreMaterial);
const reactorHousing = new THREE.Mesh(
  new THREE.CylinderGeometry(0.29, 0.35, 0.14, 36, 1, true),
  new THREE.MeshStandardMaterial({
    color: 0x0b0d12,
    metalness: 0.85,
    roughness: 0.2,
    emissive: new THREE.Color(0x02060a),
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  })
);
reactorHousing.rotation.x = Math.PI / 2;
reactorHousing.position.z = -0.02;
const reactorAuraMaterial = new THREE.SpriteMaterial({
  color: 0x6fe7ff,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const reactorAura = new THREE.Sprite(reactorAuraMaterial);
reactorAura.scale.set(0.9, 0.9, 0.9);
reactorRig.add(reactorCore);
reactorRig.add(reactorHousing);
reactorRig.add(reactorAura);
manModel.add(reactorAnchor);
const reactorPulseColor = new THREE.Color(0x3199ff);
const reactorPulse = {
  anchor: reactorAnchor,
  rig: reactorRig,
  core: reactorCore,
  housing: reactorHousing,
  aura: reactorAura,
  energy: 0,
};
const heroGlowTargets = [];
const heroGlowState = { intensity: 0 };
const heroGlowColor = new THREE.Color();
const heroHorizontalBonePattern = /shoulder|upper.*arm|collar|chest|head|neck|hand/i;
const heroVerticalBonePattern = /root|spine|hip|pelvis|thigh|leg|rootmotion/i;
let heroHeadBone = null;
const heroAnchorBones = [];
const heroAnchorPosition = new THREE.Vector3();
const heroAnchorTemp = new THREE.Vector3();
const manState = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  rotation: new THREE.Euler(0, Math.PI, 0),
  facingYaw: Math.PI,
};
function resetHeroAnchorSources() {
  heroHeadBone = null;
  heroAnchorBones.length = 0;
}

function updateHeroAnchorPosition() {
  if (heroHeadBone) {
    heroHeadBone.getWorldPosition(heroAnchorPosition);
    return;
  }
  if (heroAnchorBones.length) {
    heroAnchorPosition.set(0, 0, 0);
    heroAnchorBones.forEach((bone) => {
      bone.getWorldPosition(heroAnchorTemp);
      heroAnchorPosition.add(heroAnchorTemp);
    });
    heroAnchorPosition.multiplyScalar(1 / heroAnchorBones.length);
    return;
  }
  heroAnchorPosition.copy(manState.position);
}

let gltfMixer = null;
let rightArmBone = null;
let rightForearmBone = null;
let rightHandBone = null;
const poseRefs = { leftUpper: null, leftLower: null, leftHand: null };
const poseBones = [];
const rightArmState = {
  extend: 0,
  palmAxis: new THREE.Vector3(0, -1, 0),
  forearmAxis: new THREE.Vector3(0, -1, 0),
  handAxis: new THREE.Vector3(0, 0, -1),
  parentWorldQuat: new THREE.Quaternion(),
  parentWorldInv: new THREE.Quaternion(),
  forwardWorld: new THREE.Vector3(),
  forwardLocal: new THREE.Vector3(),
  palmLocal: new THREE.Vector3(),
  alignQuat: new THREE.Quaternion(),
  targetQuat: new THREE.Quaternion(),
};

const armPulseState = { progress: 0, recoil: 0 };
const fireworkState = { lastShotTime: 0, cooldown: 0.35 };
const fireworkProjectiles = [];
const fireworkProjectileGeometry = new THREE.SphereGeometry(0.08, 10, 10);
const fireworkSparks = [];
const fireworkSparkPoolSize = 140;
for (let i = 0; i < fireworkSparkPoolSize; i += 1) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sprite.visible = false;
  scene.add(sprite);
  fireworkSparks.push({
    sprite,
    velocity: new THREE.Vector3(),
    life: 0,
    maxLife: 0,
    hue: 0,
  });
}
const fireworkDirection = new THREE.Vector3();
const fireworkOrigin = new THREE.Vector3();
function clearPoseBones() {
  poseRefs.leftUpper = null;
  poseRefs.leftLower = null;
  poseRefs.leftHand = null;
  poseBones.length = 0;
}

function registerPoseBone(key, bone) {
  if (!bone) return;
  poseRefs[key] = bone;
  if (!bone.userData.baseQuaternion) {
    bone.userData.baseQuaternion = bone.quaternion.clone();
  }
  if (!bone.userData.restQuaternion) {
    bone.userData.restQuaternion = bone.quaternion.clone();
  }
  if (!poseBones.includes(bone)) {
    poseBones.push(bone);
  }
}

function refreshBoneBaseQuaternion(bone) {
  if (!bone) return;
  if (gltfMixer) {
    if (!bone.userData.baseQuaternion) {
      bone.userData.baseQuaternion = bone.quaternion.clone();
    } else {
      bone.userData.baseQuaternion.copy(bone.quaternion);
    }
  } else if (bone.userData.restQuaternion) {
    if (!bone.userData.baseQuaternion) {
      bone.userData.baseQuaternion = bone.userData.restQuaternion.clone();
    } else {
      bone.userData.baseQuaternion.copy(bone.userData.restQuaternion);
    }
    bone.quaternion.copy(bone.userData.restQuaternion);
  }
}

function refreshPoseBaseQuaternions() {
  poseBones.forEach((bone) => refreshBoneBaseQuaternion(bone));
  refreshBoneBaseQuaternion(rightArmBone);
  refreshBoneBaseQuaternion(rightForearmBone);
  refreshBoneBaseQuaternion(rightHandBone);
}

function applyPoseOverrides(delta, input) {
  applyRightArmExtension(delta, input);
}

function resetBoneOrientation(bone) {
  if (!bone) return;
  const baseQuat = bone.userData.baseQuaternion ?? bone.quaternion;
  bone.quaternion.copy(baseQuat);
}

function alignLimbBoneToForward(bone, axis, extendAmount) {
  if (!bone) return;
  const baseQuat = bone.userData.baseQuaternion ?? bone.quaternion;
  if (extendAmount <= 0.0001) {
    bone.quaternion.copy(baseQuat);
    return;
  }
  if (bone.parent) {
    bone.parent.getWorldQuaternion(rightArmState.parentWorldQuat);
  } else {
    rightArmState.parentWorldQuat.identity();
  }
  rightArmState.parentWorldInv.copy(rightArmState.parentWorldQuat).invert();
  rightArmState.forwardLocal
    .copy(rightArmState.forwardWorld)
    .applyQuaternion(rightArmState.parentWorldInv)
    .normalize();
  rightArmState.palmLocal.copy(axis).applyQuaternion(baseQuat).normalize();
  rightArmState.alignQuat.setFromUnitVectors(rightArmState.palmLocal, rightArmState.forwardLocal);
  rightArmState.targetQuat.copy(rightArmState.alignQuat).multiply(baseQuat);
  bone.quaternion.copy(baseQuat).slerp(rightArmState.targetQuat, extendAmount);
}

function applyRightArmExtension(delta, input) {
  const extendTarget = input?.extendArm ? 1 : 0;
  const lerpFactor = THREE.MathUtils.clamp(delta * 7, 0, 1);
  rightArmState.extend = THREE.MathUtils.lerp(rightArmState.extend, extendTarget, lerpFactor);
  const extendAmount = rightArmState.extend;
  if (extendAmount <= 0.0001) {
    resetBoneOrientation(rightArmBone);
    resetBoneOrientation(rightForearmBone);
    resetBoneOrientation(rightHandBone);
    return;
  }

  rightArmState.forwardWorld.set(0, 0, -1).applyQuaternion(manModel.quaternion).normalize();
  if (armPulseState.recoil > 0) {
    rightArmState.forwardWorld.y += armPulseState.recoil * 0.35;
    rightArmState.forwardWorld.normalize();
  }

  alignLimbBoneToForward(rightArmBone, rightArmState.palmAxis, extendAmount);
  alignLimbBoneToForward(rightForearmBone, rightArmState.forearmAxis, Math.pow(extendAmount, 0.92));
  alignLimbBoneToForward(rightHandBone, rightArmState.handAxis, Math.min(1, extendAmount * 1.15));
}

function isWeaponReady() {
  return rightArmState.extend > 0.45;
}

function loadModel() {
  const url = new URL("./Models/iron_man_flying_animation (1).glb", import.meta.url).href;
  loader.load(
    url,
    (gltf) => {
      if (reactorAnchor.parent) reactorAnchor.parent.remove(reactorAnchor);
      manModel.clear();
      rightArmBone = null;
      rightForearmBone = null;
      rightHandBone = null;
      clearPoseBones();
      heroGlowTargets.length = 0;
      resetHeroAnchorSources();
      let chestBone = null;
      gltf.scene.scale.set(0.65, 0.65, 0.65);
      gltf.scene.rotation.set(0, 0, 0);

      const seenMaterials = new Set();
      gltf.scene.traverse((node) => {
        if (node.isBone) {
          const name = node.name || "";
          const lowerName = name.toLowerCase();
          if (!heroHeadBone && /head|neck/i.test(lowerName)) {
            heroHeadBone = node;
          }
          if (
            heroHorizontalBonePattern.test(lowerName) &&
            !heroVerticalBonePattern.test(lowerName) &&
            !heroAnchorBones.includes(node)
          ) {
            heroAnchorBones.push(node);
          }
          if (!chestBone && /spine2|spine1|spine_02/i.test(lowerName)) {
            chestBone = node;
          }
          if (!rightForearmBone && /right.*(forearm|lower.?arm)/i.test(lowerName)) {
            rightForearmBone = node;
            if (!rightForearmBone.userData.restQuaternion) {
              rightForearmBone.userData.restQuaternion = rightForearmBone.quaternion.clone();
            }
          } else if (
            !rightArmBone &&
            /right.*arm/i.test(lowerName) &&
            !/forearm|lower.?arm/i.test(lowerName)
          ) {
            rightArmBone = node;
            if (!rightArmBone.userData.restQuaternion) {
              rightArmBone.userData.restQuaternion = rightArmBone.quaternion.clone();
            }
          }
          if (!rightHandBone && /right.*hand/i.test(lowerName)) {
            rightHandBone = node;
            if (!rightHandBone.userData.restQuaternion) {
              rightHandBone.userData.restQuaternion = rightHandBone.quaternion.clone();
            }
          }
          if (!poseRefs.leftUpper && /left.*arm/i.test(name)) {
            registerPoseBone("leftUpper", node);
          } else if (!poseRefs.leftLower && /left.*forearm/i.test(name)) {
            registerPoseBone("leftLower", node);
          } else if (!poseRefs.leftHand && /left.*hand/i.test(name)) {
            registerPoseBone("leftHand", node);
          }
        }
        if (node.isMesh && node.material && node.material.isMeshStandardMaterial) {
          if (!seenMaterials.has(node.material)) {
            seenMaterials.add(node.material);
            if (typeof node.material.emissiveIntensity !== "number") {
              node.material.emissiveIntensity = 1;
            }
            heroGlowTargets.push({
              material: node.material,
              baseEmissive: node.material.emissive.clone(),
              baseIntensity: node.material.emissiveIntensity,
            });
          }
        }
      });

      const flyingClip =
        gltf.animations.find((clip) => /fly/i.test(clip.name)) || gltf.animations[0] || null;
      if (flyingClip) {
        gltfMixer = new THREE.AnimationMixer(gltf.scene);
        const action = gltfMixer.clipAction(flyingClip);
        action.reset().play();
      } else {
        gltfMixer = null;
      }
      manModel.add(gltf.scene);
      if (chestBone) {
        chestBone.add(reactorAnchor);
      } else {
        manModel.add(reactorAnchor);
      }
      reactorRig.position.set(0, 0.2, 0.9);
      manModel.updateMatrixWorld(true);
      updateHeroAnchorPosition();
    },
    undefined,
    (error) => {
      console.warn("GLB load failed", error);
      if (!reactorAnchor.parent) {
        manModel.add(reactorAnchor);
      }
    }
  );
}
loadModel();

function updateAudioPulse(audioLevels) {
  const energy = Math.min(
    1,
    (audioLevels?.avg ?? 0.1) + (audioLevels?.high ?? 0) * 0.5 + (audioLevels?.bass ?? 0) * 0.3
  );
  audioPulseStates.forEach((state, idx) => {
    const targetScale = state.baseScale + energy * (0.8 + idx * 0.25);
    const currentScale = state.mesh.scale.x || 1;
    const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.08);
    state.mesh.scale.setScalar(nextScale);
    const targetOpacity = 0.04 + energy * (0.25 - idx * 0.03);
    state.mesh.material.opacity = THREE.MathUtils.lerp(state.mesh.material.opacity, targetOpacity, 0.04);
    const hueShift = (audioLevels?.high ?? 0) * 0.25 + energy * 0.15;
    const baseHue = (audioPulseColors[idx] + hueShift) % 1;
    state.mesh.material.color.setHSL(baseHue, 0.95, 0.55 + energy * 0.25);
    const anchor = heroAnchorPosition;
    state.mesh.position.set(anchor.x, anchor.y - 0.26, anchor.z - 0.9 - state.offset);
    state.mesh.quaternion.copy(camera.quaternion);
  });
}

function updateArmPulse(delta) {
  if (armPulseState.progress <= 0) {
    armPulseState.recoil = 0;
    return;
  }
  armPulseState.progress = Math.max(0, armPulseState.progress - delta * 3);
  armPulseState.recoil = Math.sin((1 - armPulseState.progress) * Math.PI);
  if (armPulseState.progress <= 0) {
    armPulseState.recoil = 0;
  }
}

function acquireFireworkSpark() {
  for (const entry of fireworkSparks) {
    if (entry.life <= 0) return entry;
  }
  return null;
}

function spawnFireworkProjectile(audioLevels) {
  // Use the character's forward axis (positive Z in model space) so projectiles track the facing direction.
  fireworkDirection.set(0, 0, 1).applyEuler(manState.rotation).normalize();
  fireworkOrigin
    .set(0, 0.2, 0.8)
    .applyEuler(manState.rotation)
    .add(heroAnchorPosition);
  const hue = (0.04 + (audioLevels?.high ?? 0) * 0.5 + analysisState.active * 0.2) % 1;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.85, 0.65),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    emissive: new THREE.Color().setHSL(hue, 0.9, 0.55),
    emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(fireworkProjectileGeometry, material);
  mesh.position.copy(fireworkOrigin);
  scene.add(mesh);
  if (fireworkProjectiles.length > 28) {
    const removed = fireworkProjectiles.shift();
    if (removed) {
      scene.remove(removed.mesh);
    }
  }
  const speed =
    16 + (audioLevels?.avg ?? 0) * 8 + (audioLevels?.high ?? 0) * 6 + analysisState.active * 8;
  fireworkProjectiles.push({
    mesh,
    velocity: fireworkDirection.clone().multiplyScalar(speed),
    life: 0.6 + (audioLevels?.high ?? 0.3) * 0.6,
    intensity: 0.5 + (audioLevels?.high ?? 0) * 0.7 + analysisState.active * 0.6,
    hue,
    speed,
    forward: fireworkDirection.clone(),
    turnRate: 2 + (audioLevels?.high ?? 0) * 2,
  });
}

function burstFirework(projectile, audioLevels) {
  const sparks = Math.min(18, 8 + Math.floor(projectile.intensity * 12));
  const hue = (projectile.hue + (audioLevels?.mid ?? 0) * 0.2) % 1;
  for (let i = 0; i < sparks; i += 1) {
    const entry = acquireFireworkSpark();
    if (!entry) break;
    entry.life = 0.35 + projectile.intensity * 0.35 + Math.random() * 0.2;
    entry.maxLife = entry.life;
    entry.hue = (hue + Math.random() * 0.2 - 0.1 + i * 0.01) % 1;
    entry.sprite.material.color.setHSL(entry.hue, 0.95, 0.6 + Math.random() * 0.25);
    entry.sprite.material.opacity = 0.95;
    entry.sprite.position.copy(projectile.mesh.position);
    entry.velocity
      .set(
        (Math.random() * 2 - 1) * (4 + projectile.intensity * 4),
        (Math.random() * 2 - 1) * (4 + projectile.intensity * 3),
        (Math.random() * 2 - 0.2) * (6 + projectile.intensity * 6)
      )
      .addScaledVector(fireworkDirection, 3);
    entry.sprite.visible = true;
  }
}

function updateFireworkProjectiles(delta, audioLevels) {
  for (let i = fireworkProjectiles.length - 1; i >= 0; i -= 1) {
    const projectile = fireworkProjectiles[i];
    projectile.mesh.position.addScaledVector(projectile.velocity, delta);
    projectile.life = Math.max(0, projectile.life - delta);
    projectile.mesh.material.opacity = projectile.life * 0.9;
    if (projectile.life <= 0 || projectile.mesh.position.z < camera.position.z - corridorState.depth) {
      burstFirework(projectile, audioLevels);
      scene.remove(projectile.mesh);
      fireworkProjectiles.splice(i, 1);
      continue;
    }
  }
}

function updateFireworkSparks(delta) {
  fireworkSparks.forEach((entry) => {
    if (entry.life <= 0) return;
    entry.life = Math.max(0, entry.life - delta);
    const blend = entry.maxLife > 0 ? entry.life / entry.maxLife : 0;
    entry.sprite.position.addScaledVector(entry.velocity, delta);
    entry.velocity.multiplyScalar(0.9);
    entry.sprite.material.opacity = blend * 0.9;
    entry.sprite.scale.setScalar(0.4 + (1 - blend) * 0.8);
    entry.sprite.visible = entry.life > 0;
  });
}

function tryFire(currentTime, audioLevels) {
  const level = audioLevels?.high ?? 0;
  const energy = Math.min(1, (audioLevels?.avg ?? 0) * 0.7 + level * 0.5 + analysisState.active * 0.5);
  if (currentTime - fireworkState.lastShotTime < fireworkState.cooldown) return;
  if (!isWeaponReady()) return;
  if (level < 0.1 && analysisState.active < 0.15) return;
  fireworkState.lastShotTime = currentTime;
  fireworkState.cooldown = 0.22 + (1 - energy) * 0.35;
  spawnFireworkProjectile(audioLevels);
  armPulseState.progress = 1;
  armPulseState.recoil = 1;
}

const controllerModelFactory = new XRControllerModelFactory();
const xrTempPos = new THREE.Vector3();
const xrTempDir = new THREE.Vector3();

function setupWebXRControllers() {
  const bindController = (index) => {
    const controller = renderer.xr.getController(index);
    controller.userData.index = index;
    controller.userData.selectPressed = false;
    controller.addEventListener("selectstart", () => {
      controller.userData.selectPressed = true;
    });
    controller.addEventListener("selectend", () => {
      controller.userData.selectPressed = false;
    });
    controller.addEventListener("connected", (event) => {
      controller.userData.inputSource = event.data;
      controller.userData.handedness = event.data.handedness;
      controller.visible = true;
      refreshXrHands();
    });
    controller.addEventListener("disconnected", () => {
      controller.userData.inputSource = null;
      controller.userData.handedness = null;
      controller.visible = false;
      refreshXrHands();
    });
    scene.add(controller);

    const grip = renderer.xr.getControllerGrip(index);
    grip.add(controllerModelFactory.createControllerModel(grip));
    scene.add(grip);

    xrState.controllers.push(controller);
    xrState.grips.push(grip);
  };

  bindController(0);
  bindController(1);

  renderer.xr.addEventListener("sessionstart", () => {
    xrState.sessionActive = true;
    setShowcaseMode(false, { silent: true });
    ui.vrBtn?.classList.add("active");
    setStatus("VR session ready - Quest controllers active.");
  });

  renderer.xr.addEventListener("sessionend", () => {
    xrState.sessionActive = false;
    ui.vrBtn?.classList.remove("active");
    setStatus("Exited VR mode.");
  });
}

function refreshXrHands() {
  xrState.leftController = null;
  xrState.rightController = null;
  xrState.controllers.forEach((controller) => {
    if (controller.userData.handedness === "left") {
      xrState.leftController = controller;
    } else if (controller.userData.handedness === "right") {
      xrState.rightController = controller;
    }
  });
}

function getXrGamepad(controller) {
  return controller?.userData?.inputSource?.gamepad || null;
}

function computeXrExtend(controller) {
  if (!controller) return false;
  const vrCamera = renderer.xr.getCamera(camera);
  vrCamera.getWorldPosition(xrState.headPosition);
  controller.getWorldPosition(xrTempPos);
  controller.getWorldDirection(xrTempDir);
  const heightDelta = xrTempPos.y - xrState.headPosition.y;
  const forwardIntent = xrTempDir.z < -0.2;
  return heightDelta > 0.05 || forwardIntent;
}

function getVrControlInput() {
  if (!renderer.xr.isPresenting || !xrState.sessionActive) return null;
  refreshXrHands();
  const right = xrState.rightController;
  const left = xrState.leftController;
  const leftPad = getXrGamepad(left);
  const rightPad = getXrGamepad(right);
  const moveX = applyDeadzone(leftPad?.axes?.[0] ?? 0);
  const moveY = -applyDeadzone(leftPad?.axes?.[1] ?? 0);
  const lookX = applyDeadzone(rightPad?.axes?.[0] ?? 0);
  const lookY = -applyDeadzone(rightPad?.axes?.[1] ?? 0);
  const throttle = applyDeadzone(-(rightPad?.axes?.[1] ?? 0) * 0.8);
  const extendArm = computeXrExtend(right) || (rightPad?.buttons?.[1]?.pressed ?? false);
  const triggerValue = rightPad?.buttons?.[0]?.value ?? 0;
  const firePressed = extendArm && (triggerValue > 0.18 || right?.userData?.selectPressed);
  const active =
    Math.abs(moveX) > 0.01 ||
    Math.abs(moveY) > 0.01 ||
    Math.abs(lookX) > 0.01 ||
    Math.abs(lookY) > 0.01 ||
    Math.abs(throttle) > 0.01 ||
    extendArm ||
    firePressed;
  if (!active) return null;
  return {
    moveX,
    moveY,
    forward: throttle,
    lookX,
    lookY,
    firePressed,
    extendArm,
    source: "vr",
    active: true,
  };
}

const touchState = {
  enabled: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  move: { id: null, start: new THREE.Vector2(), pos: new THREE.Vector2(), active: false },
  aim: { id: null, start: new THREE.Vector2(), pos: new THREE.Vector2(), active: false },
  fireHeld: false,
  fireTap: false,
};

function setupTouchControls() {
  if (!touchState.enabled) return;
  const overlay = document.createElement("div");
  overlay.className = "touch-overlay";
  const movePad = document.createElement("div");
  movePad.className = "touch-pad left glass";
  const aimPad = document.createElement("div");
  aimPad.className = "touch-pad right glass";
  const fireBtn = document.createElement("button");
  fireBtn.className = "touch-fire glass";
  fireBtn.textContent = "Fire";
  overlay.appendChild(movePad);
  overlay.appendChild(aimPad);
  overlay.appendChild(fireBtn);
  document.body.appendChild(overlay);

  const registerPad = (pad, key) => {
    pad.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchState[key].id = touch.identifier;
      touchState[key].start.set(touch.clientX, touch.clientY);
      touchState[key].pos.set(touch.clientX, touch.clientY);
      touchState[key].active = true;
      event.preventDefault();
    }, { passive: false });
    pad.addEventListener("touchmove", (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier === touchState[key].id) {
          touchState[key].pos.set(touch.clientX, touch.clientY);
          break;
        }
      }
      event.preventDefault();
    }, { passive: false });
    pad.addEventListener("touchend", (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier === touchState[key].id) {
          const travel = touchState[key].start.distanceTo(touchState[key].pos);
          if (key === "aim" && travel < 12) {
            touchState.fireTap = true;
          }
          touchState[key].id = null;
          touchState[key].active = false;
          break;
        }
      }
      event.preventDefault();
    }, { passive: false });
  };

  registerPad(movePad, "move");
  registerPad(aimPad, "aim");

  fireBtn.addEventListener("touchstart", (event) => {
    touchState.fireHeld = true;
    touchState.fireTap = true;
    event.preventDefault();
  }, { passive: false });
  fireBtn.addEventListener("touchend", (event) => {
    touchState.fireHeld = false;
    event.preventDefault();
  }, { passive: false });
}

function readTouchPad(entry) {
  if (!entry.active) return { x: 0, y: 0 };
  const dx = THREE.MathUtils.clamp((entry.pos.x - entry.start.x) / 70, -1, 1);
  const dy = THREE.MathUtils.clamp((entry.pos.y - entry.start.y) / 70, -1, 1);
  return { x: dx, y: dy };
}

function getTouchInput() {
  if (!touchState.enabled) return null;
  const move = readTouchPad(touchState.move);
  const aim = readTouchPad(touchState.aim);
  const firePressed = touchState.fireHeld || touchState.fireTap;
  const extendArm = firePressed || touchState.aim.active;
  const active =
    touchState.move.active ||
    touchState.aim.active ||
    firePressed ||
    Math.abs(move.x) > 0.01 ||
    Math.abs(move.y) > 0.01 ||
    Math.abs(aim.x) > 0.01 ||
    Math.abs(aim.y) > 0.01;
  touchState.fireTap = false;
  if (!active) return null;
  return {
    moveX: move.x,
    moveY: -move.y,
    forward: 0,
    lookX: aim.x,
    lookY: -aim.y,
    firePressed,
    extendArm,
    source: "touch",
    active: true,
  };
}

setupWebXRControllers();
setupTouchControls();

// Controls -----------------------------------------------------------------
const controlConfig = {
  lateralSpeed: 7,
  verticalSpeed: 5,
  velocityResponsiveness: 4,
  inertiaResponsiveness: 2,
  drag: 2.2,
  idleDrag: 0.9,
  lookYawGain: 0.35,
  driftYawGain: 0.25,
  movePitchGain: 0.45,
  forwardPitchGain: 0.25,
  lookPitchGain: 0.35,
  rollGain: 0.5,
};
const throttleConfig = {
  accelRate: 1.2,
  brakeRate: 1.8,
  base: 0.35,
  min: 0,
  max: 1,
  settleRate: 0.5,
};
const throttleState = { value: throttleConfig.base };
function getThrottleBoost() {
  return 0.6 + throttleState.value * 1.4;
}

let lastInputTime = 0;
const idleMotion = { phase: 0 };
let lastResolvedInput = { active: false, source: null };

let gamepadIndex = null;
window.addEventListener("gamepadconnected", (event) => {
  gamepadIndex = event.gamepad.index;
  setStatus(`Gamepad connected: ${event.gamepad.id}`);
});
window.addEventListener("gamepaddisconnected", (event) => {
  if (gamepadIndex === event.gamepad.index) {
    gamepadIndex = null;
    setStatus("Gamepad disconnected");
  }
});

const keyState = new Set();
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyV" && !event.repeat) {
    ui.vrBtn?.click();
    event.preventDefault();
    return;
  }
  if (event.repeat) return;
  if (autoPilotState.enabled) {
    handleManualOverride();
  }
  keyState.add(event.code);
});
window.addEventListener("keyup", (event) => {
  keyState.delete(event.code);
});

function getGamepad() {
  if (gamepadIndex === null) return null;
  return navigator.getGamepads()[gamepadIndex] || null;
}

function applyDeadzone(value, threshold = 0.12) {
  return Math.abs(value) < threshold ? 0 : value;
}

function getGamepadInput(gp) {
  const moveX = applyDeadzone(gp.axes[0] || 0);
  const moveY = -applyDeadzone(gp.axes[1] || 0);
  const lookX = -applyDeadzone(gp.axes[2] || 0);
  const lookY = applyDeadzone(gp.axes[3] || 0);
  const rt = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
  const lt = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);
  const forward = THREE.MathUtils.clamp(rt - lt, -1, 1);
  const extendArm = Boolean(gp.buttons[4]?.pressed);
  const firePressed = Boolean(gp.buttons[0]?.pressed || gp.buttons[5]?.pressed);
  return { moveX, moveY, forward, lookX, lookY, firePressed, extendArm, active: true };
}

function getKeyboardInput() {
  const moveX = (keyState.has("KeyD") ? 1 : 0) - (keyState.has("KeyA") ? 1 : 0);
  const moveY = (keyState.has("KeyR") ? 1 : 0) - (keyState.has("KeyF") ? 1 : 0);
  const forward = (keyState.has("KeyW") ? 1 : 0) - (keyState.has("KeyS") ? 1 : 0);
  const lookX = (keyState.has("ArrowRight") ? 1 : 0) - (keyState.has("ArrowLeft") ? 1 : 0);
  const lookY = (keyState.has("ArrowUp") ? 1 : 0) - (keyState.has("ArrowDown") ? 1 : 0);
  const firePressed = keyState.has("Space");
  const extendArm = keyState.has("KeyQ");
  const active =
    moveX || moveY || forward || lookX || lookY || firePressed || extendArm;
  return {
    moveX,
    moveY,
    forward,
    lookX,
    lookY,
    firePressed,
    extendArm,
    active: Boolean(active),
  };
}

function getManualControlInput() {
  const gp = getGamepad();
  if (gp) return { ...getGamepadInput(gp), source: "manual" };
  if (keyState.size) return { ...getKeyboardInput(), source: "manual" };
  return {
    moveX: 0,
    moveY: 0,
    forward: 0,
    lookX: 0,
    lookY: 0,
    firePressed: false,
    extendArm: false,
    source: "manual",
    active: false,
  };
}

function manualInputActive() {
  if (lastResolvedInput?.active && lastResolvedInput?.source !== "auto") return true;
  if (touchState.move.active || touchState.aim.active || touchState.fireHeld) return true;
  if (renderer.xr.isPresenting && xrState.sessionActive) return true;
  if (keyState.size) return true;
  const gp = getGamepad();
  if (gp) {
    const hasAxis = gp.axes?.some((axis) => Math.abs(axis) > 0.18) ?? false;
    const hasButton = gp.buttons?.some((btn) => btn?.pressed) ?? false;
    if (hasAxis || hasButton) return true;
  }
  return false;
}

function selectAutoPilotTarget() {
  const heroPos = heroAnchorPosition;
  let best = null;
  let bestScore = Infinity;
  const consider = (x, y, z, kind, priority = 0, entity = null) => {
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return;
    const zDelta = z - heroPos.z;
    if (zDelta < -14 || zDelta > 9) return;
    const planar = Math.abs(x - heroPos.x) * 0.75 + Math.abs(y - heroPos.y) * 0.85;
    const score = planar + Math.abs(zDelta) * 0.35 - priority;
    if (score < bestScore) {
      bestScore = score;
      best = { x, y, z, kind, entity };
    }
  };

  hoopInstances.forEach((hoop) => {
    consider(hoop.mesh.position.x, hoop.mesh.position.y, hoop.mesh.position.z, "hoop", 0.4, hoop);
  });
  return best;
}

function getAutoPilotInput(delta, audioLevels, time) {
  const avg = audioLevels?.avg ?? 0.3;
  const bass = audioLevels?.bass ?? 0.3;
  const mid = audioLevels?.mid ?? 0.3;
  const high = audioLevels?.high ?? 0.3;
  autoPilotState.phase += delta * (0.8 + avg * 1.8);
  autoPilotState.verticalPhase += delta * (0.6 + mid * 1.6);
  autoPilotState.fireTimer = Math.max(0, autoPilotState.fireTimer - delta);
  const target = selectAutoPilotTarget();
  autoPilotState.currentTarget = target;

  let aimX;
  let aimY;
  if (target) {
    aimX = THREE.MathUtils.clamp(target.x, -5.5, 5.5);
    aimY = THREE.MathUtils.clamp(target.y, -3.8, 3.8);
  } else {
    aimX = Math.sin(autoPilotState.phase) * (2.6 + avg * 1.8);
    aimY = Math.cos(autoPilotState.verticalPhase) * (1.6 + mid * 1.5);
  }
  const heroAnchor = heroAnchorPosition;
  const lateralDelta = aimX - heroAnchor.x;
  const verticalDelta = aimY - heroAnchor.y;
  let moveX = THREE.MathUtils.clamp(
    target ? lateralDelta * 0.5 : lateralDelta * 0.4 + Math.sin(autoPilotState.phase * 0.6) * 0.25,
    -1,
    1
  );
  let moveY = THREE.MathUtils.clamp(
    target ? verticalDelta * 0.55 : verticalDelta * 0.45 + Math.cos(autoPilotState.verticalPhase) * 0.22,
    -1,
    1
  );
  const forward = THREE.MathUtils.clamp(0.35 + bass * 0.6 + avg * 0.35, 0, 1);
  const lookX =
    Math.sin(autoPilotState.phase * 0.7) * 0.15 + (target ? lateralDelta * 0.08 : 0);
  const lookY =
    Math.cos(autoPilotState.verticalPhase * 0.8) * 0.12 + (target ? verticalDelta * 0.07 : 0);

  const extendIntent = target ? 1 : Math.max(avg, high);
  autoPilotState.extendPulse = THREE.MathUtils.lerp(autoPilotState.extendPulse, extendIntent, delta * 3.2);
  let extendArm = autoPilotState.extendPulse > 0.35;
  let firePressed = false;

  if (target && target.kind === "ring") {
    const zDelta = target.z - heroAnchor.z;
    const closeness = THREE.MathUtils.clamp(1 - Math.abs(zDelta) / 8, 0, 1);
    extendArm = extendArm || closeness > 0.4;
  }

  const fireIntent =
    analysisState.active > 0.3 || (target && (high > 0.35 || avg > 0.35));
  if (fireIntent && autoPilotState.fireTimer <= 0) {
    firePressed = true;
    autoPilotState.fireTimer = 0.25 + (1 - Math.min(1, high + avg * 0.5)) * 0.35;
  }

  return {
    moveX,
    moveY,
    forward,
    lookX,
    lookY,
    firePressed,
    extendArm,
    active: true,
  };
}

function resolveControlInput(delta, audioLevels, time) {
  if (autoPilotState.enabled && manualInputActive()) {
    handleManualOverride();
  }
  autoPilotState.lastAudio = audioLevels;
  const vrInput = getVrControlInput();
  if (vrInput) {
    lastResolvedInput = vrInput;
    return vrInput;
  }
  const touchInput = getTouchInput();
  if (touchInput) {
    lastResolvedInput = touchInput;
    return touchInput;
  }
  if (autoPilotState.enabled) {
    const autoInput = { ...getAutoPilotInput(delta, audioLevels, time), source: "auto" };
    lastResolvedInput = autoInput;
    return autoInput;
  }
  const manual = getManualControlInput();
  lastResolvedInput = manual;
  return manual;
}

function updateMovement(delta, currentTime, inputState, audioLevels) {
  const fallbackLevels = audioLevels || autoPilotState.lastAudio || audioState.levels;
  const input = inputState || resolveControlInput(delta, fallbackLevels, currentTime);
  const desiredVelocity = new THREE.Vector3(
    input.moveX * controlConfig.lateralSpeed,
    input.moveY * controlConfig.verticalSpeed,
    0
  );
  const hasMotionInput =
    Math.abs(input.moveX) > 0 || Math.abs(input.moveY) > 0;

  const forwardInput = THREE.MathUtils.clamp(input.forward, -1, 1);
  if (forwardInput > 0) {
    throttleState.value = Math.min(
      throttleConfig.max,
      throttleState.value + forwardInput * throttleConfig.accelRate * delta
    );
  } else if (forwardInput < 0) {
    throttleState.value = Math.max(
      throttleConfig.min,
      throttleState.value + forwardInput * throttleConfig.brakeRate * delta
    );
  } else {
    throttleState.value = THREE.MathUtils.lerp(
      throttleState.value,
      throttleConfig.base,
      delta * throttleConfig.settleRate
    );
  }

  const velocityAlpha = THREE.MathUtils.clamp(
    delta * (hasMotionInput ? controlConfig.velocityResponsiveness : controlConfig.inertiaResponsiveness),
    0,
    1
  );
  manState.velocity.lerp(desiredVelocity, velocityAlpha);
  const damping = Math.max(0, 1 - (hasMotionInput ? controlConfig.drag : controlConfig.idleDrag) * delta);
  manState.velocity.multiplyScalar(damping);
  manState.position.addScaledVector(manState.velocity, delta);

  manState.position.x = THREE.MathUtils.clamp(manState.position.x, -6, 6);
  manState.position.y = THREE.MathUtils.clamp(manState.position.y, -4, 4.5);
  manState.position.z = 0;
  manState.facingYaw = Math.PI;

  const yawTarget =
    Math.PI +
    input.lookX * controlConfig.lookYawGain +
    input.moveX * controlConfig.driftYawGain;
  const pitchTarget = THREE.MathUtils.clamp(
    -input.moveY * controlConfig.movePitchGain +
    (throttleState.value - throttleConfig.base) * controlConfig.forwardPitchGain +
    input.lookY * controlConfig.lookPitchGain,
    -0.75,
    0.75
  );
  const rollTarget = THREE.MathUtils.clamp(-input.moveX * controlConfig.rollGain, -0.6, 0.6);

  manState.rotation.y = lerpAngle(manState.rotation.y, yawTarget, 0.08);
  manState.rotation.x = THREE.MathUtils.lerp(manState.rotation.x, pitchTarget, 0.12);
  manState.rotation.z = THREE.MathUtils.lerp(manState.rotation.z, rollTarget, 0.12);

  if (input.firePressed) {
    tryFire(currentTime, fallbackLevels);
  }

  return input;
}

function applyIdleMotion(delta, audioLevels, currentTime, inputActive) {
  if (inputActive) {
    lastInputTime = currentTime;
    idleMotion.phase = 0;
    return;
  }
  if (currentTime - lastInputTime < 5) return;

  idleMotion.phase += delta;
  const swayX = Math.sin(idleMotion.phase * 0.6) * (0.45 + audioLevels.mid * 0.25);
  const swayY = Math.sin(idleMotion.phase * 0.9) * (0.22 + audioLevels.high * 0.15);
  manState.position.x = THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(manState.position.x, swayX, delta * 0.35),
    -6,
    6
  );
  manState.position.y = THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(manState.position.y, swayY, delta * 0.35),
    -4,
    4.5
  );
  const pitchTarget = -0.08 + Math.sin(idleMotion.phase * 0.7) * 0.08;
  manState.rotation.x = THREE.MathUtils.lerp(manState.rotation.x, pitchTarget, delta * 0.25);
  const rollTarget = Math.sin(idleMotion.phase * 0.5) * (0.18 + audioLevels.mid * 0.12);
  manState.rotation.z = THREE.MathUtils.lerp(manState.rotation.z, rollTarget, delta * 0.25);
}

// Rendering ----------------------------------------------------------------
function renderScene() {
  renderer.render(scene, camera);
}

// Main loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function animate(time) {
  const delta = clock.getDelta();
  const audioLevels = sampleAudioLevels();
  updateWorldReactivity(delta, audioLevels, time);
  const flowSpeed = computeCorridorFlowSpeed(audioLevels) * getThrottleBoost();
  syncCuePlayback(delta);
  const controlInput = resolveControlInput(delta, audioLevels, clock.elapsedTime);
  updateMovement(delta, clock.elapsedTime, controlInput, audioLevels);
  applyIdleMotion(delta, audioLevels, clock.elapsedTime, controlInput.active);
  updateArmPulse(delta);
  updateCorridor(delta, audioLevels, time);
  updateFireworkProjectiles(delta, audioLevels);
  updateFireworkSparks(delta);
  updateReactorGlow(audioLevels, time);
  updateHeroGlow(audioLevels);
  updateAudioPulse(audioLevels);
  updateCelebrationWord(delta);
  updateCelebrationBursts(delta);
  checkCubeCollisions(delta, audioLevels);
  updateGameStats(delta, audioLevels);
  updateOverdriveState(delta, audioLevels);
  if (gltfMixer) gltfMixer.update(delta);
  refreshPoseBaseQuaternions();
  applyPoseOverrides(delta, controlInput);
  manModel.position.copy(manState.position);
  manModel.rotation.copy(manState.rotation);
  manModel.updateMatrixWorld(true);
  updateHeroAnchorPosition();
  renderScene();
}
renderer.setAnimationLoop(animate);

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateRendererPixelRatio();
  renderer.setSize(getRenderWidth(), window.innerHeight);
  renderer.domElement.style.width = `${window.innerWidth}px`;
  renderer.domElement.style.height = `${window.innerHeight}px`;
}
window.addEventListener("resize", handleResize);
handleResize();
