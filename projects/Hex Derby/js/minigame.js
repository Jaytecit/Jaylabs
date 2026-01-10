// Bank Boost: Hex Flip mini-game
(function(){
  let selectedSide = null;
  let selectedStake = 0;
  const hist = [];

  function show(){ const m = document.getElementById('bankBoostModal'); if (m) m.style.display='flex'; update(); }
  function hide(){ const m = document.getElementById('bankBoostModal'); if (m) m.style.display='none'; }

  function update(){
    const status = document.getElementById('bbStatus');
    const stakeIn = document.getElementById('bbCustomStake');
    if (stakeIn) stakeIn.value = selectedStake || '';
    if (status) status.innerHTML = `Selected side: <strong>${selectedSide??'-'}</strong> • Stake: <strong>£${selectedStake||0}</strong>`;
    renderHistory();
  }

  function renderHistory(){
    const wrap = document.getElementById('bbHistory'); if (!wrap) return;
    if (hist.length===0){ wrap.innerHTML = ''; return; }
    wrap.innerHTML = hist.slice(-8).reverse().map(h=>`<div>[${new Date(h.t).toLocaleTimeString()}] Picked ${h.pick}, result ${h.result} • ${h.win?'<span style="color:#b7ffb7">Won £'+h.amount+'</span>':'<span style="color:#ff9999">Lost £'+h.amount+'</span>'}</div>`).join('');
  }

  function setStake(v){ selectedStake = Math.max(1, Math.floor(v||0)); update(); }
  function setSide(s){ selectedSide = s; update(); }

  function play(){
    const stake = selectedStake || parseInt(document.getElementById('bbCustomStake')?.value||'0',10) || 0;
    if (!selectedSide) return alert('Pick a side (1–6).');
    if (stake<=0) return alert('Enter a valid stake.');
    if (stake>bankroll) return alert('Insufficient funds.');

    bankroll -= stake; persistBankroll(); if (typeof updateBankrollUI==='function') updateBankrollUI();
    const result = 1 + Math.floor(Math.random()*6);
    let payout = 0;
    if (result === selectedSide){ payout = stake * 5; }
    const win = payout>0;
    if (win){ bankroll += payout; persistBankroll(); if (typeof updateBankrollUI==='function') updateBankrollUI(); }
    hist.push({ t: Date.now(), pick: selectedSide, result, amount: win? payout : stake, win });
    const status = document.getElementById('bbStatus');
    if (status){ status.innerHTML = `Result: <strong>${result}</strong> — ${win? ('<span style="color:#b7ffb7">You win £'+payout+'</span>') : ('<span style="color:#ff9999">You lose £'+stake+'</span>')}`; }
    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const openBtns = [document.getElementById('openBankBoost'), document.getElementById('openBankBoostFromMenu')].filter(Boolean);
    const closeBtn = document.getElementById('closeBankBoost');
    openBtns.forEach(b=> b.onclick = show);
    if (closeBtn) closeBtn.onclick = hide;
    document.querySelectorAll('.bb-side').forEach(btn=> btn.onclick = ()=>{ document.querySelectorAll('.bb-side').forEach(x=>x.classList.remove('selected-stake')); btn.classList.add('selected-stake'); setSide(parseInt(btn.dataset.side,10)); });
    document.querySelectorAll('.bb-stake').forEach(btn=> btn.onclick = ()=>{ document.querySelectorAll('.bb-stake').forEach(x=>x.classList.remove('selected-stake')); btn.classList.add('selected-stake'); setStake(parseInt(btn.dataset.stake,10)); });
    const stakeIn = document.getElementById('bbCustomStake'); if (stakeIn) stakeIn.oninput = ()=> setStake(parseInt(stakeIn.value||'0',10)||0);
    const playBtn = document.getElementById('bbPlay'); if (playBtn) playBtn.onclick = play;
  });

  // expose for debugging
  window.BankBoost = { show, hide, setStake, setSide, play };
})();

