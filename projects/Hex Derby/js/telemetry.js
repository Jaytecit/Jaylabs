// Lightweight match telemetry and auto-tuning
(function(){
  const KEY = 'hexderby_telemetry_v1';
  const MAX = 20;
  const DIFFICULTY_TARGETS = {
    Casual:   { min: 90, max: 120 },
    Balanced: { min: 60, max: 90 },
    Chaos:    { min: 30, max: 60 }
  };

  function load(){
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch(e){ return []; }
  }
  function save(arr){ try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); } catch(e){} }

  const Telemetry = {
    _start: null,
    _elims: [],
    _balls: 0,
    startMatch(ballsCount, difficulty){
      this._start = performance.now();
      this._elims = [];
      this._balls = ballsCount||0;
      this._difficulty = difficulty || (window.Settings?.load()?.difficulty) || 'Balanced';
    },
    elimination(){
      if (this._start==null) return;
      const t = (performance.now() - this._start) / 1000;
      this._elims.push(t);
    },
    endMatch(winnerId){
      if (this._start==null) return null;
      const dur = (performance.now() - this._start) / 1000;
      const entry = {
        t: Date.now(),
        duration: +dur.toFixed(1),
        elimCount: this._elims.length,
        balls: this._balls,
        difficulty: this._difficulty
      };
      const data = load(); data.push(entry); save(data);
      this._start = null; this._elims = []; this._balls = 0;
      return entry;
    },
    statsLastN(n=10){
      const d = load();
      const last = d.slice(-n);
      if (last.length===0) return { avg: null, count: 0 };
      const avg = last.reduce((s,x)=>s+x.duration,0)/last.length;
      return { avg, count: last.length };
    },
    recommendAdjustments(difficulty, avgDur){
      const tgt = DIFFICULTY_TARGETS[difficulty] || DIFFICULTY_TARGETS.Balanced;
      if (!avgDur) return null;
      const mid = (tgt.min + tgt.max) * 0.5;
      let factor = mid / avgDur; // <1 means slow, >1 fast
      factor = Math.max(0.85, Math.min(1.15, factor));
      return { factor, targetMid: mid };
    },
    maybeAutoTune(){
      const s = window.Settings?.load?.();
      if (!s || !window.autoTune) return null;
      const { avg } = this.statsLastN(8);
      if (!avg) return null;
      const rec = this.recommendAdjustments(s.difficulty || 'Balanced', avg);
      if (!rec) return null;
      const f = rec.factor;
      if (window.P && window.DEFAULTS){
        const ds0 = DEFAULTS.damageScale||0.2;
        const sa0 = DEFAULTS.spinAccel||0.000005;
        // Derive current multipliers vs defaults (best effort)
        const curDS = P.damageScale/(ds0||0.0001);
        const curSA = P.spinAccel/(sa0||0.000001);
        const newDS = ds0 * Math.max(0.5, Math.min(1.6, curDS * f));
        const newSA = sa0 * Math.max(0.5, Math.min(1.6, curSA * f));
        P.damageScale = newDS;
        P.spinAccel = newSA;
        if (typeof window.addMatchStatusUpdate === 'function'){
          window.addMatchStatusUpdate(`Auto-tune: damageScale→${newDS.toFixed(3)}, spinAccel→${newSA.toExponential(2)} (target ~${rec.targetMid|0}s)`, 'payout');
        }
        return { newDS, newSA, factor: f };
      }
      return null;
    }
  };

  window.Telemetry = Telemetry;
})();

