// Settings management for Hex Derby
(function(){
  const KEY = 'hexderby_settings_v1';
  const DEFAULT_SETTINGS = {
    audio: false,
    motionReduced: false,
    colorblind: false,
    difficulty: 'Balanced',
    autoTune: false
  };

  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const obj = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...obj };
    } catch(e){ return { ...DEFAULT_SETTINGS }; }
  }

  function save(s){
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e) {}
  }

  // Apply settings to runtime
  function apply(s){
    // Audio
    if (typeof window.audioEnabled !== 'undefined'){
      if (!!s.audio !== !!window.audioEnabled){
        if (typeof window.toggleAudio === 'function') window.toggleAudio();
      }
    }

    // Motion reduction: lower stars + sparks
    window.motionReduced = !!s.motionReduced;
    if (window.P && window.DEFAULTS){
      const baseSparks = DEFAULTS.ballCollisionSparkCount || 10;
      P.ballCollisionSparkCount = window.motionReduced ? Math.max(2, Math.floor(baseSparks/3)) : baseSparks;
    }

    // Colorblind/high-contrast mode
    document.documentElement.classList.toggle('colorblind', !!s.colorblind);

    // Difficulty presets derive from DEFAULTS to avoid compounding
    if (window.P && window.DEFAULTS){
      const d = s.difficulty || 'Balanced';
      const mult = {
        Casual:   { damageScale: 0.8, spinAccel: 0.7, gapInterval: 1.2, widenRate: 0.85 },
        Balanced: { damageScale: 1.0, spinAccel: 1.0, gapInterval: 1.0, widenRate: 1.0 },
        Chaos:    { damageScale: 1.25, spinAccel: 1.3, gapInterval: 0.8, widenRate: 1.2 }
      }[d] || { damageScale: 1, spinAccel: 1, gapInterval: 1, widenRate: 1 };

      P.damageScale = (DEFAULTS.damageScale||0.2) * mult.damageScale;
      P.spinAccel = (DEFAULTS.spinAccel||0.000005) * mult.spinAccel;
      P.gapInterval = (DEFAULTS.gapInterval||30) * mult.gapInterval;
      P.widenRate = (DEFAULTS.widenRate||0.15) * mult.widenRate;
    }

    // Refresh on-screen values if needed
    if (typeof window.updateBetUI === 'function') window.updateBetUI();
  }

  function bindUI(){
    const modal = document.getElementById('settingsModal');
    const openBtns = [document.getElementById('openSettings'), document.getElementById('openSettingsFromMenu')].filter(Boolean);
    const closeBtn = document.getElementById('closeSettings');
    const applyBtn = document.getElementById('applySettings');
    const saveBtn = document.getElementById('saveSettings');

    function show(){ if (modal){ modal.style.display = 'flex'; } }
    function hide(){ if (modal){ modal.style.display = 'none'; } }

    openBtns.forEach(b => b.onclick = show);
    if (closeBtn) closeBtn.onclick = hide;

    function readFromForm(){
      return {
        audio: !!document.getElementById('setAudio')?.checked,
        motionReduced: !!document.getElementById('setMotion')?.checked,
        colorblind: !!document.getElementById('setColorblind')?.checked,
        difficulty: document.getElementById('setDifficulty')?.value || 'Balanced',
        autoTune: !!document.getElementById('setAutoTune')?.checked
      };
    }

    if (applyBtn) applyBtn.onclick = ()=>{ const s = readFromForm(); apply(s); };
    if (saveBtn) saveBtn.onclick = ()=>{ const s = readFromForm(); save(s); apply(s); };

    // Populate form from loaded settings
    const s = load();
    const set = (id, val, isCheck=false)=>{ const el=document.getElementById(id); if (!el) return; if (isCheck) el.checked=!!val; else el.value=val; };
    set('setAudio', s.audio, true);
    set('setMotion', s.motionReduced, true);
    set('setColorblind', s.colorblind, true);
    set('setDifficulty', s.difficulty, false);
    set('setAutoTune', s.autoTune, true);

    // Expose autoTune flag globally
    window.autoTune = !!s.autoTune;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // Load + apply at startup
    const s = load();
    apply(s);
    bindUI();
  });

  // Export basic API
  window.Settings = { load, save, apply };
})();
