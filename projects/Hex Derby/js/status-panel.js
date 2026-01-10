// Enhanced Match Status Panel helpers
(function(){
  function updateMatchStatusHeaderEnhanced() {
    const header = document.getElementById('matchStatusHeader');
    if (!header) return;

    const betCount = Array.isArray(window.bets) ? window.bets.length : 0;
    const totalStake = Array.isArray(window.bets) ? window.bets.reduce((s,b)=>s+(b.stake||0),0) : 0;
    const remaining = Array.isArray(window.balls) ? window.balls.length : 0;

    const eliminated = new Set(Array.isArray(window.finishingOrder) ? window.finishingOrder : []);
    let aliveWIN=0, aliveTOP3=0, aliveEXACTA=0, aliveQUINELLA=0, hitsELIM=0, aliveMATCHWIN=0;
    if (Array.isArray(window.bets)) {
      for (const b of window.bets) {
        if (!b || !b.type) continue;
        if (b.type === 'WIN') {
          if (!eliminated.has(b.ids[0])) aliveWIN++;
        } else if (b.type === 'TOP3') {
          if (!eliminated.has(b.ids[0])) aliveTOP3++;
        } else if (b.type === 'EXACTA') {
          if (!eliminated.has(b.ids[0]) && !eliminated.has(b.ids[1])) aliveEXACTA++;
        } else if (b.type === 'QUINELLA') {
          if (!eliminated.has(b.ids[0]) && !eliminated.has(b.ids[1])) aliveQUINELLA++;
        } else if (b.type === 'MATCH_WIN') {
          if (!eliminated.has(b.ids[0])) aliveMATCHWIN++;
        } else if (b.type === 'MATCH_ELIMINATION') {
          if (eliminated.has(b.ids[0])) hitsELIM++;
        }
      }
    }

    header.innerHTML = `
      <div><strong>Bets:</strong> ${betCount} • <strong>Stake:</strong> ${numberWithCommas(totalStake)}</div>
      <div><strong>Remaining:</strong> ${remaining}</div>
      <div style="margin-top:4px; opacity:.9;">
        <span>WIN alive: ${aliveWIN}</span> • <span>TOP3 alive: ${aliveTOP3}</span>${aliveMATCHWIN?` • <span>MATCH_WIN alive: ${aliveMATCHWIN}</span>`:''}${hitsELIM?` • <span>ELIM hits: ${hitsELIM}</span>`:''}${aliveEXACTA?` • <span>EXACTA alive: ${aliveEXACTA}</span>`:''}${aliveQUINELLA?` • <span>QUINELLA alive: ${aliveQUINELLA}</span>`:''}
      </div>`;
  }

  // Expose globally
  window.updateMatchStatusHeaderEnhanced = updateMatchStatusHeaderEnhanced;

  // Wire clear button
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('clearMatchStatus');
    if (btn) btn.onclick = () => {
      const log = document.getElementById('matchStatusLog');
      if (log) log.innerHTML = '';
    };
  });
})();

