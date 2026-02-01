// ── Config ──
const SUPABASE_URL = 'https://buwczcoejllfielwirvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2N6Y29lamxsZmllbHdpcnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Nzg2NDUsImV4cCI6MjA4NTQ1NDY0NX0.uhWCkPj3QcQ9yBQheaEJKDr5MzgF4C1tHjYeWOQart4';

const DOMAIN = 'onchaintrends.net';

const TRENDS = [
  'Tokenized Equities',
  'Onchain Vaults',
  'Prediction Markets',
  'Equity Perpetuals',
  'Stablecoin-linked Cards',
  'Onchain Privacy',
  'Stablecoin-based Cross-Border Payments',
  'Tokenized Collateral in Traditional Markets',
  'Stablecoin-based Neobanks',
  'Regulated ICOs',
  'Onchain FX',
  'Undercollateralized Lending',
  'Yield Tokenization',
  'AI Agents on Crypto Rails',
  'Payments-focused Blockchains',
];

// Seed data: excited_rate and first_pick_rate at 180 base voters
// Used as fallback when Supabase is unavailable
const SEED_DATA = {
  'Tokenized Equities':               { excited_rate: 0.74, first_pick_rate: 0.18 },
  'Onchain Vaults':                    { excited_rate: 0.71, first_pick_rate: 0.14 },
  'Prediction Markets':                { excited_rate: 0.69, first_pick_rate: 0.12 },
  'Equity Perpetuals':                 { excited_rate: 0.64, first_pick_rate: 0.09 },
  'Stablecoin-linked Cards':           { excited_rate: 0.62, first_pick_rate: 0.08 },
  'Onchain Privacy':                   { excited_rate: 0.58, first_pick_rate: 0.07 },
  'Stablecoin-based Cross-Border Payments': { excited_rate: 0.56, first_pick_rate: 0.06 },
  'Tokenized Collateral in Traditional Markets': { excited_rate: 0.53, first_pick_rate: 0.05 },
  'Stablecoin-based Neobanks':         { excited_rate: 0.51, first_pick_rate: 0.04 },
  'Regulated ICOs':                    { excited_rate: 0.47, first_pick_rate: 0.04 },
  'Onchain FX':                        { excited_rate: 0.44, first_pick_rate: 0.03 },
  'Undercollateralized Lending':        { excited_rate: 0.41, first_pick_rate: 0.03 },
  'Yield Tokenization':                { excited_rate: 0.38, first_pick_rate: 0.03 },
  'AI Agents on Crypto Rails':         { excited_rate: 0.34, first_pick_rate: 0.02 },
  'Payments-focused Blockchains':      { excited_rate: 0.29, first_pick_rate: 0.02 },
};
const SEED_VOTERS = 180;

// ── Supabase client ──
let db = null;
if (window.supabase && !window._supabaseFailed) {
  try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch(e) { db = null; }
}

// ── Session ──
function getSessionId() {
  let id = localStorage.getItem('trend_session_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('trend_session_id', id); }
  return id;
}
const SESSION_ID = getSessionId();

// ── State ──
let phase1Order = [];
let phase1Index = 0;
let votes = {};
let excitedTrends = [];
let top3 = [];
let pickStep = 0;
let globalStats = null;
let isAnimating = false;
let contrarianData = null; // { isContrarian, trend, pct }

// ── Helpers ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// Total voters: seed + real session count from Supabase
let realSessionCount = 0;

function getTotalVoters() {
  return SEED_VOTERS + realSessionCount;
}

// Compute display stats from globalStats (which includes seed counts)
function getDisplayStats() {
  const totalVoters = getTotalVoters();
  if (globalStats && globalStats.length) {
    return [...globalStats]
      .map(s => ({
        name: s.name,
        excitedPct: Math.round(((s.excited_count || 0) / Math.max(1, totalVoters)) * 100),
        firstPct: Math.round(((s.first_pick_count || 0) / Math.max(1, totalVoters)) * 100),
      }))
      .sort((a, b) => b.firstPct - a.firstPct);
  }
  // Fallback to seed
  return TRENDS.map(name => ({
    name,
    excitedPct: Math.round(SEED_DATA[name].excited_rate * 100),
    firstPct: Math.round(SEED_DATA[name].first_pick_rate * 100),
  })).sort((a, b) => b.firstPct - a.firstPct);
}

function updateVoteCounter() {
  const el = document.getElementById('total-votes');
  if (el) el.textContent = getTotalVoters().toLocaleString();
}

// ── Init ──
async function init() {
  const saved = localStorage.getItem('trend_progress');
  const completed = localStorage.getItem('trend_completed');

  // Load global stats first
  await loadGlobalStats();
  updateVoteCounter();

  if (completed) {
    try {
      const data = JSON.parse(completed);
      votes = data.votes || {};
      top3 = data.top3 || [];
      excitedTrends = Object.keys(votes).filter(k => votes[k] === 'excited');
      hide('phase1');
      showResults();
      return;
    } catch(e) {}
  }

  if (saved) {
    hide('phase1');
    show('resume-prompt');
    renderVotingGlobalRankings();
    return;
  }

  startPhase1();
  renderVotingGlobalRankings();
}

function resumeVoting() {
  hide('resume-prompt');
  try {
    const data = JSON.parse(localStorage.getItem('trend_progress'));
    votes = data.votes || {};
    phase1Order = data.order || shuffle(TRENDS);
    phase1Index = data.index || 0;
    excitedTrends = Object.keys(votes).filter(k => votes[k] === 'excited');

    if (phase1Index >= TRENDS.length) {
      startPhase2();
    } else {
      show('phase1');
      showPhase1Trend();
    }
  } catch(e) {
    startFresh();
  }
}

function startFresh() {
  hide('resume-prompt');
  localStorage.removeItem('trend_progress');
  localStorage.removeItem('trend_completed');
  votes = {};
  top3 = [];
  excitedTrends = [];
  pickStep = 0;
  contrarianData = null;
  startPhase1();
}

// ════════════════════════════════════
// PHASE 1: Excitement Filter
// ════════════════════════════════════

function startPhase1() {
  phase1Order = shuffle(TRENDS);
  phase1Index = 0;
  votes = {};
  excitedTrends = [];
  show('phase1');
  hide('phase2');
  hide('results-section');
  showPhase1Trend();
  renderVotingGlobalRankings();
}

function showPhase1Trend() {
  const trend = phase1Order[phase1Index];
  const card = document.getElementById('phase1-card');
  const nameEl = document.getElementById('phase1-trend-name');

  card.style.opacity = '0';
  card.style.transform = 'translateY(8px)';
  requestAnimationFrame(() => {
    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  nameEl.textContent = trend;
  document.getElementById('p1-current').textContent = phase1Index + 1;
  const pct = (phase1Index / TRENDS.length) * 100;
  document.getElementById('p1-progress-fill').style.width = pct + '%';
}

function phase1Vote(choice) {
  if (isAnimating) return;
  isAnimating = true;

  const trend = phase1Order[phase1Index];
  votes[trend] = choice;
  if (choice === 'excited') excitedTrends.push(trend);

  phase1Index++;
  saveProgress();

  const pct = (phase1Index / TRENDS.length) * 100;
  document.getElementById('p1-progress-fill').style.width = pct + '%';
  document.getElementById('p1-current').textContent = Math.min(phase1Index + 1, TRENDS.length);

  setTimeout(() => {
    isAnimating = false;
    if (phase1Index >= TRENDS.length) {
      hide('phase1');
      startPhase2();
    } else {
      showPhase1Trend();
    }
  }, 150);
}

function saveProgress() {
  localStorage.setItem('trend_progress', JSON.stringify({
    votes,
    order: phase1Order,
    index: phase1Index,
  }));
}

// ════════════════════════════════════
// PHASE 2: Top Pick Selection
// ════════════════════════════════════

function startPhase2() {
  top3 = [];
  pickStep = 0;
  const count = excitedTrends.length;

  if (count === 0) { submitAndShowResults(); return; }
  if (count === 1) { top3 = [excitedTrends[0]]; submitAndShowResults(); return; }

  show('phase2');
  if (count === 2) {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Pick your favorite.`;
  } else if (count === 3) {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Now rank them.`;
  } else {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Now pick your top 3.`;
  }
  renderPickStep();
}

function renderPickStep() {
  const remaining = excitedTrends.filter(t => !top3.includes(t));
  const prompts = ["What's your #1?", "And #2?", "And #3?"];
  const count = excitedTrends.length;

  if (count === 2 && top3.length === 1) { top3.push(remaining[0]); submitAndShowResults(); return; }
  if (count === 3 && top3.length === 2) { top3.push(remaining[0]); submitAndShowResults(); return; }
  if (top3.length >= 3) { submitAndShowResults(); return; }

  document.getElementById('p2-prompt').textContent = prompts[top3.length] || `Pick #${top3.length + 1}`;

  const grid = document.getElementById('p2-grid');
  grid.innerHTML = remaining.map(trend =>
    `<button class="pick-card" onclick="pickTrend('${trend.replace(/'/g, "\\'")}')">${trend}</button>`
  ).join('');
}

function pickTrend(trend) {
  if (isAnimating) return;
  isAnimating = true;

  const cards = document.querySelectorAll('.pick-card');
  cards.forEach(c => { if (c.textContent === trend) c.classList.add('selected'); });

  top3.push(trend);

  setTimeout(() => {
    isAnimating = false;
    const remaining = excitedTrends.filter(t => !top3.includes(t));
    if (top3.length >= 3 || remaining.length === 0) {
      submitAndShowResults();
    } else {
      renderPickStep();
    }
  }, 250);
}

// ════════════════════════════════════
// SUBMIT & RESULTS
// ════════════════════════════════════

async function submitAndShowResults() {
  hide('phase1');
  hide('phase2');

  localStorage.removeItem('trend_progress');
  localStorage.setItem('trend_completed', JSON.stringify({ votes, top3 }));

  if (db) {
    try {
      // Insert session first
      await db.from('voter_sessions').insert({
        session_id: SESSION_ID,
        votes,
        top3,
        excited_count: excitedTrends.length,
      });

      // Immediately increment local counter so UI updates fast
      realSessionCount++;
      updateVoteCounter();

      // Update trend stats
      for (const trend of TRENDS) {
        const vote = votes[trend];
        if (!vote) continue;
        const { data: current } = await db.from('trend_stats').select('*').eq('name', trend).single();
        if (current) {
          const patch = {};
          if (vote === 'excited') patch.excited_count = (current.excited_count || 0) + 1;
          if (vote === 'meh') patch.meh_count = (current.meh_count || 0) + 1;
          if (vote === 'skip') patch.skip_count = (current.skip_count || 0) + 1;
          if (top3[0] === trend) patch.first_pick_count = (current.first_pick_count || 0) + 1;
          if (top3[1] === trend) patch.second_pick_count = (current.second_pick_count || 0) + 1;
          if (top3[2] === trend) patch.third_pick_count = (current.third_pick_count || 0) + 1;
          if (Object.keys(patch).length) {
            await db.from('trend_stats').update(patch).eq('name', trend);
          }
        }
      }

      // Reload from DB for accurate global state
      await loadGlobalStats();
      updateVoteCounter();
      renderVotingGlobalRankings();
    } catch(e) {
      console.warn('Supabase submit error:', e);
    }
  }

  fireConfetti();
  showResults();
}

async function loadGlobalStats() {
  if (!db) return;
  try {
    const { data } = await db.from('trend_stats').select('*');
    if (data && data.length) globalStats = data;
  } catch(e) {}
  // Count real sessions (not seed data)
  try {
    const { count } = await db.from('voter_sessions').select('*', { count: 'exact', head: true });
    realSessionCount = count || 0;
  } catch(e) {}
}

// ════════════════════════════════════
// RENDER: Voting screen global rankings
// ════════════════════════════════════

function renderVotingGlobalRankings() {
  const el = document.getElementById('voting-global-list');
  if (!el) return;
  const stats = getDisplayStats();
  el.innerHTML = stats.map((s, i) =>
    `<div class="global-row-compact">
      <span class="global-rank">#${i + 1}</span>
      <span class="global-name">${s.name}</span>
      <span class="global-detail"><span class="global-stat-value">${s.firstPct}%</span> #1 pick · <span class="global-stat-value">${s.excitedPct}%</span> excited</span>
    </div>`
  ).join('');
}

// ════════════════════════════════════
// RENDER RESULTS
// ════════════════════════════════════

function showResults() {
  show('results-section');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const isSkeptic = excitedTrends.length === 0;

  if (isSkeptic) {
    document.getElementById('results-headline').textContent = "You're a skeptic.";
    document.getElementById('results-subtext').textContent =
      "You're not excited about any 2026 trend.";
  } else {
    document.getElementById('results-headline').textContent = 'Your 2026 Top Trends';
    document.getElementById('results-subtext').textContent = '';
  }

  renderTopPicks(isSkeptic);
  renderContrarian();
  renderAlsoExcited();
  renderGlobalRankings();
}

function renderTopPicks(isSkeptic) {
  const el = document.getElementById('top-picks-list');
  if (isSkeptic) {
    el.innerHTML = `<div class="skeptic-message">
      <p>You're not excited about any 2026 trend.</p>
      <p style="margin-top:8px;">Think the industry is missing something? Share your take.</p>
    </div>`;
    return;
  }
  el.innerHTML = top3.map((trend, i) =>
    `<div class="top-pick-item rank-${i + 1}">
      <span class="top-pick-rank">#${i + 1}</span>
      <span class="top-pick-name">${trend}</span>
    </div>`
  ).join('');
}

function renderContrarian() {
  if (!top3.length) { hide('contrarian-section'); contrarianData = null; return; }

  const stats = getDisplayStats();
  const userPick = top3[0];
  const pickStat = stats.find(s => s.name === userPick);
  const firstPct = pickStat ? pickStat.firstPct : 0;

  // Find global #1
  const global1 = stats[0];
  const isAligned = (userPick === global1.name) || firstPct >= 15;

  const el = document.getElementById('contrarian-callout');
  show('contrarian-section');

  if (isAligned) {
    contrarianData = { isContrarian: false, trend: userPick, pct: firstPct };
    if (userPick === global1.name) {
      el.className = 'contrarian-callout aligned-style';
      el.innerHTML = `<span class="contrarian-label aligned-color">You're with the crowd</span>
        Your #1, <strong>${userPick}</strong>, is the global #1 too.`;
    } else {
      el.className = 'contrarian-callout aligned-style';
      el.innerHTML = `<span class="contrarian-label aligned-color">You're with the crowd</span>
        Your #1, <strong>${userPick}</strong>, is a popular pick — <strong>${firstPct}%</strong> of voters agree.`;
    }
  } else {
    contrarianData = { isContrarian: true, trend: userPick, pct: firstPct };
    el.className = 'contrarian-callout contrarian-style';
    el.innerHTML = `<span class="contrarian-label contrarian-color">Your contrarian take</span>
      You picked <strong>${userPick}</strong> as your #1 — only <strong>${firstPct}%</strong> of voters agree.`;
  }
}

function renderAlsoExcited() {
  const also = excitedTrends.filter(t => !top3.includes(t));
  if (also.length === 0) { hide('also-excited-section'); return; }
  show('also-excited-section');
  document.getElementById('also-excited-list').innerHTML =
    `<div class="also-pills">${also.map(t => `<span class="also-pill">${t}</span>`).join('')}</div>`;
}

function renderGlobalRankings() {
  const el = document.getElementById('global-rankings');
  const stats = getDisplayStats();
  const totalVoters = getTotalVoters();

  el.innerHTML = stats.map((s, i) => {
    const isUserPick = top3.includes(s.name);
    return `<div class="global-row${isUserPick ? ' user-pick' : ''}">
      <span class="global-rank">#${i + 1}</span>
      <span class="global-name">${s.name}</span>
      <span class="global-detail"><span class="global-stat-value">${s.firstPct}%</span> picked first · <span class="global-stat-value">${s.excitedPct}%</span> excited</span>
      ${isUserPick ? '<span class="user-check">✓</span>' : ''}
    </div>`;
  }).join('');
}

// ════════════════════════════════════
// VOTE AGAIN
// ════════════════════════════════════

function voteAgain() {
  localStorage.removeItem('trend_completed');
  localStorage.removeItem('trend_progress');
  votes = {};
  top3 = [];
  excitedTrends = [];
  pickStep = 0;
  contrarianData = null;
  hide('results-section');
  startPhase1();
  loadGlobalStats().then(updateVoteCounter);
}

// ════════════════════════════════════
// CONFETTI
// ════════════════════════════════════

function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#7c3aed', '#a78bfa', '#059669', '#34d399', '#ea580c', '#fb923c', '#3b82f6', '#f472b6'];
  const pieces = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 200,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
      rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 8,
    });
  }
  const start = Date.now(), duration = 1400;
  function animate() {
    const elapsed = Date.now() - start;
    if (elapsed > duration) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fadeStart = duration * 0.6;
    const alpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (duration - fadeStart) : 1;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rotation += p.rotSpeed;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ════════════════════════════════════
// SHARE & DOWNLOAD
// ════════════════════════════════════

function shareOnX() {
  const pick1 = top3[0];
  let text;
  if (!pick1) {
    text = "I'm not excited about any 2026 digital asset trend. Call me a skeptic.";
  } else if (contrarianData && contrarianData.isContrarian) {
    text = `My 2026 digital asset outlook:\n\n#1 ${pick1}\n\nOnly ${contrarianData.pct}% agree with my top pick 👀\n\nWhat's yours? ${DOMAIN}`;
  } else {
    text = `My 2026 digital asset outlook:\n\n#1 ${pick1}\n\nI'm with the consensus on this one.\n\nWhat's yours? ${DOMAIN}`;
  }
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnLinkedIn() {
  // LinkedIn share-offsite only supports url param; text goes in og tags
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://' + DOMAIN)}`, '_blank');
}

function copyLink() {
  navigator.clipboard.writeText('https://' + DOMAIN).then(() => {
    const btn = document.querySelector('.share-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
  });
}

async function downloadScorecard() {
  if (!window.html2canvas) return;

  const isSkeptic = excitedTrends.length === 0;
  const offscreen = document.createElement('div');
  offscreen.className = 'scorecard-offscreen';

  // Light gradient background
  offscreen.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%)';
  offscreen.style.position = 'relative';

  let topContent = '';
  if (isSkeptic) {
    topContent = `<div style="padding:20px 28px;background:#f3f4f6;border-radius:12px;margin-bottom:16px;">
      <p style="font-size:22px;font-weight:700;color:#1a1a1a;">I'm not excited about any 2026 trend. Call me a skeptic.</p>
    </div>`;
  } else {
    // #1 with green bg
    topContent = `<div style="padding:20px 28px;background:#ecfdf5;border-left:5px solid #059669;border-radius:12px;margin-bottom:12px;">
      <p style="font-size:14px;font-weight:600;color:#059669;margin-bottom:4px;">#1</p>
      <p style="font-size:26px;font-weight:800;color:#1a1a1a;">${top3[0]}</p>
    </div>`;
    if (top3[1]) {
      topContent += `<div style="padding:14px 24px;background:#ffffff;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:8px;display:inline-block;margin-right:8px;">
        <span style="font-size:13px;font-weight:600;color:#7c3aed;">#2</span>
        <span style="font-size:16px;font-weight:600;color:#1a1a1a;margin-left:8px;">${top3[1]}</span>
      </div>`;
    }
    if (top3[2]) {
      topContent += `<div style="padding:14px 24px;background:#ffffff;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:8px;display:inline-block;">
        <span style="font-size:13px;font-weight:600;color:#ea580c;">#3</span>
        <span style="font-size:16px;font-weight:600;color:#1a1a1a;margin-left:8px;">${top3[2]}</span>
      </div>`;
    }
  }

  // Contrarian / aligned box
  let contrarianBox = '';
  if (contrarianData) {
    if (contrarianData.isContrarian) {
      contrarianBox = `<div style="margin-top:20px;padding:16px 24px;background:#fef3c7;border:2px solid #fbbf24;border-radius:10px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#b45309;margin-bottom:4px;">My contrarian take</p>
        <p style="font-size:15px;color:#1a1a1a;">Only <strong>${contrarianData.pct}%</strong> agree with my #1</p>
      </div>`;
    } else {
      contrarianBox = `<div style="margin-top:20px;padding:16px 24px;background:#ecfdf5;border:2px solid rgba(5,150,105,0.3);border-radius:10px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#059669;margin-bottom:4px;">I'm with the crowd</p>
        <p style="font-size:15px;color:#1a1a1a;">${contrarianData.pct}% share my #1</p>
      </div>`;
    }
  }

  // Also excited
  const also = excitedTrends.filter(t => !top3.includes(t));
  let alsoContent = '';
  if (also.length) {
    alsoContent = `<p style="margin-top:16px;font-size:13px;color:#999;">Also excited: ${also.join(', ')}</p>`;
  }

  offscreen.innerHTML = `
    <div style="padding:56px 64px;height:100%;position:relative;">
      <p style="font-size:13px;color:#999;margin-bottom:6px;">My 2026 Digital Asset Outlook</p>
      <h2 style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;margin-bottom:28px;">Top Trends in Digital Assets 2026</h2>
      ${topContent}
      ${contrarianBox}
      ${alsoContent}
      <div style="position:absolute;bottom:40px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:14px;font-weight:600;color:#1a1a1a;">${DOMAIN}</span>
        <span style="font-size:12px;color:#bbb;">built by @maximilianvargas</span>
      </div>
    </div>
  `;

  document.body.appendChild(offscreen);
  const canvas = await html2canvas(offscreen, {
    backgroundColor: null, scale: 2, width: 1200, height: 627, useCORS: true,
  });
  document.body.removeChild(offscreen);

  const link = document.createElement('a');
  link.download = 'digital-asset-outlook-2026.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Start ──
init();
