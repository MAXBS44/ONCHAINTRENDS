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

const SEED_DATA = {
  'Tokenized Equities':               { excited_rate: 0.74, cold_rate: 0.26, first_pick_rate: 0.18 },
  'Onchain Vaults':                    { excited_rate: 0.71, cold_rate: 0.29, first_pick_rate: 0.14 },
  'Prediction Markets':                { excited_rate: 0.69, cold_rate: 0.31, first_pick_rate: 0.12 },
  'Equity Perpetuals':                 { excited_rate: 0.64, cold_rate: 0.36, first_pick_rate: 0.09 },
  'Stablecoin-linked Cards':           { excited_rate: 0.62, cold_rate: 0.38, first_pick_rate: 0.08 },
  'Onchain Privacy':                   { excited_rate: 0.58, cold_rate: 0.42, first_pick_rate: 0.07 },
  'Stablecoin-based Cross-Border Payments': { excited_rate: 0.56, cold_rate: 0.44, first_pick_rate: 0.06 },
  'Tokenized Collateral in Traditional Markets': { excited_rate: 0.53, cold_rate: 0.47, first_pick_rate: 0.05 },
  'Stablecoin-based Neobanks':         { excited_rate: 0.51, cold_rate: 0.49, first_pick_rate: 0.04 },
  'Regulated ICOs':                    { excited_rate: 0.47, cold_rate: 0.53, first_pick_rate: 0.04 },
  'Onchain FX':                        { excited_rate: 0.44, cold_rate: 0.56, first_pick_rate: 0.03 },
  'Undercollateralized Lending':        { excited_rate: 0.41, cold_rate: 0.59, first_pick_rate: 0.03 },
  'Yield Tokenization':                { excited_rate: 0.38, cold_rate: 0.62, first_pick_rate: 0.03 },
  'AI Agents on Crypto Rails':         { excited_rate: 0.34, cold_rate: 0.66, first_pick_rate: 0.02 },
  'Payments-focused Blockchains':      { excited_rate: 0.29, cold_rate: 0.71, first_pick_rate: 0.02 },
};
const SEED_VOTES = 27 * 15;  // 405 seed votes (27 users × 15 trends each)

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
let globalStats = null;
let isAnimating = false;
let contrarianData = null;
let rankingsUnlocked = false;

// ── Vote counter (counts individual trend votes, not sessions) ──
let realVoteCount = 0;   // sum of all votes from trend_stats minus seed
let localVotesBumps = 0;

function getTotalVotes() {
  return SEED_VOTES + realVoteCount + localVotesBumps;
}

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

function getDisplayStats() {
  if (globalStats && globalStats.length) {
    return [...globalStats]
      .map(s => {
        // Use per-trend vote totals for accurate percentages
        const trendTotal = (s.excited_count || 0) + (s.meh_count || 0) + (s.skip_count || 0);
        // For first pick %, use total completed sessions (people who actually picked a #1)
        const totalSessions = getTotalVotes();
        return {
          name: s.name,
          excitedPct: trendTotal > 0 ? Math.round(((s.excited_count || 0) / trendTotal) * 100) : 0,
          coldPct: trendTotal > 0 ? Math.round(((s.meh_count || 0) / trendTotal) * 100) : 0,
          firstPct: totalSessions > 0 ? Math.round(((s.first_pick_count || 0) / totalSessions) * 100) : 0,
        };
      })
      .sort((a, b) => b.firstPct - a.firstPct);
  }
  return TRENDS.map(name => ({
    name,
    excitedPct: Math.round(SEED_DATA[name].excited_rate * 100),
    coldPct: Math.round(SEED_DATA[name].cold_rate * 100),
    firstPct: Math.round(SEED_DATA[name].first_pick_rate * 100),
  })).sort((a, b) => b.firstPct - a.firstPct);
}

function getSentimentForTrend(trendName) {
  const stats = getDisplayStats();
  const s = stats.find(x => x.name === trendName);
  if (s) return { excitedPct: s.excitedPct, coldPct: s.coldPct };
  const seed = SEED_DATA[trendName];
  if (seed) return { excitedPct: Math.round(seed.excited_rate * 100), coldPct: Math.round(seed.cold_rate * 100) };
  return { excitedPct: 50, coldPct: 50 };
}

function updateVoteCounter() {
  const el = document.getElementById('total-votes');
  if (el) el.textContent = getTotalVotes().toLocaleString();
}

// ── Realtime polling ──
// Poll Supabase every 8 seconds for fresh vote counts + stats
let pollInterval = null;
function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    await loadGlobalStats();
    // Re-render rankings if on results page
    const resultsEl = document.getElementById('results-section');
    if (resultsEl && !resultsEl.classList.contains('hidden')) {
      renderGlobalRankings();
    }
    // Re-render voting screen rankings if visible
    renderVotingGlobalRankings();
  }, 8000);
}

// ── Init ──
async function init() {
  const saved = localStorage.getItem('trend_progress');
  const completed = localStorage.getItem('trend_completed');

  await loadGlobalStats();
  updateVoteCounter();
  startPolling();

  if (completed) {
    try {
      const data = JSON.parse(completed);
      votes = data.votes || {};
      top3 = data.top3 || [];
      excitedTrends = Object.keys(votes).filter(k => votes[k] === 'excited');
      hide('phase1');
      rankingsUnlocked = true;
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
      showInterstitial();
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
  contrarianData = null;
  rankingsUnlocked = false;
  localVotesBumps = 0;
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
  rankingsUnlocked = false;
  show('phase1');
  hide('phase2');
  hide('interstitial');
  hide('results-section');
  showPhase1Trend();
  renderVotingGlobalRankings();
  const overlay = document.getElementById('rankings-lock-overlay');
  const list = document.getElementById('voting-global-list');
  if (overlay) overlay.classList.remove('hidden');
  if (list) list.classList.remove('unlocked');
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

  document.getElementById('vote-buttons').classList.remove('hidden');
  document.getElementById('sentiment-bars').classList.add('hidden');
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

  localVotesBumps++;
  updateVoteCounter();

  showSentimentBars(trend, choice);
}

function showSentimentBars(trendName, userChoice) {
  const buttonsEl = document.getElementById('vote-buttons');
  const barsEl = document.getElementById('sentiment-bars');

  const sentiment = getSentimentForTrend(trendName);
  const total = sentiment.excitedPct + sentiment.coldPct;
  const excPct = total > 0 ? Math.round((sentiment.excitedPct / total) * 100) : 50;
  const coldPct = 100 - excPct;

  barsEl.innerHTML = `
    <div class="sentiment-bar-row">
      <span class="sentiment-label"${userChoice === 'excited' ? ' style="font-weight:800;color:#122b42;"' : ''}>Excited 🔥</span>
      <div class="sentiment-track">
        <div class="sentiment-fill excited-fill" style="width:0%">
          <span class="sentiment-pct">${excPct}%</span>
        </div>
      </div>
    </div>
    <div class="sentiment-bar-row">
      <span class="sentiment-label"${userChoice === 'meh' ? ' style="font-weight:800;color:#122b42;"' : ''}>Cold ❄️</span>
      <div class="sentiment-track">
        <div class="sentiment-fill cold-fill" style="width:0%">
          <span class="sentiment-pct">${coldPct}%</span>
        </div>
      </div>
    </div>
  `;

  buttonsEl.classList.add('hidden');
  barsEl.classList.remove('hidden');

  requestAnimationFrame(() => {
    const fills = barsEl.querySelectorAll('.sentiment-fill');
    if (fills[0]) fills[0].style.width = excPct + '%';
    if (fills[1]) fills[1].style.width = coldPct + '%';
  });

  setTimeout(() => {
    isAnimating = false;
    if (phase1Index >= TRENDS.length) {
      hide('phase1');
      rankingsUnlocked = true;
      const overlay = document.getElementById('rankings-lock-overlay');
      const list = document.getElementById('voting-global-list');
      if (overlay) overlay.classList.add('hidden');
      if (list) list.classList.add('unlocked');
      showInterstitial();
    } else {
      showPhase1Trend();
    }
  }, 1000);
}

function saveProgress() {
  localStorage.setItem('trend_progress', JSON.stringify({
    votes,
    order: phase1Order,
    index: phase1Index,
  }));
}

// ════════════════════════════════════
// INTERSTITIAL: Phase 1 → Phase 2
// ════════════════════════════════════

function showInterstitial() {
  const count = excitedTrends.length;

  if (count === 1) {
    top3 = [excitedTrends[0]];
    submitAndShowResults();
    return;
  }

  hide('phase1');
  hide('phase2');
  hide('results-section');
  show('interstitial');

  const headlineEl = document.getElementById('interstitial-headline');
  const pillsSection = document.getElementById('interstitial-pills-section');
  const pillsEl = document.getElementById('interstitial-pills');

  if (count === 0) {
    headlineEl.textContent = "Great. Let's pick your Top 3.";
    pillsSection.classList.add('hidden');
  } else {
    headlineEl.textContent = `Great! You've picked ${count} trends.`;
    pillsSection.classList.remove('hidden');

    const stats = getDisplayStats();
    const sorted = [...excitedTrends].sort((a, b) => {
      const aS = stats.find(s => s.name === a);
      const bS = stats.find(s => s.name === b);
      return (bS ? bS.excitedPct : 0) - (aS ? aS.excitedPct : 0);
    });

    pillsEl.innerHTML = sorted.map(t =>
      `<span class="interstitial-pill">${t}</span>`
    ).join('');
  }

  const svg = document.querySelector('.interstitial-checkmark');
  if (svg) {
    const clone = svg.cloneNode(true);
    svg.parentNode.replaceChild(clone, svg);
  }
}

function startPhase2FromInterstitial() {
  hide('interstitial');
  startPhase2();
}

// ════════════════════════════════════
// PHASE 2: Top Pick Selection
// ════════════════════════════════════

function startPhase2() {
  top3 = [];
  const count = excitedTrends.length;

  show('phase2');

  if (count === 2) {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Pick your favorite.`;
  } else if (count === 3) {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Now rank them.`;
  } else {
    document.getElementById('p2-subtitle').textContent = `You're excited about ${count} trends. Now pick your top 3.`;
  }

  updateTop3Bar();
  renderPickStep();
}

function updateTop3Bar() {
  for (let i = 0; i < 3; i++) {
    const valEl = document.getElementById(`top3-val-${i + 1}`);
    if (top3[i]) {
      valEl.textContent = top3[i];
      valEl.classList.add('filled');
    } else {
      valEl.textContent = '___';
      valEl.classList.remove('filled');
    }
  }
}

function renderPickStep() {
  const remaining = excitedTrends.filter(t => !top3.includes(t));
  const count = excitedTrends.length;

  if (count === 2 && top3.length === 1) { top3.push(remaining[0]); updateTop3Bar(); submitAndShowResults(); return; }
  if (count === 3 && top3.length === 2) { top3.push(remaining[0]); updateTop3Bar(); submitAndShowResults(); return; }
  if (top3.length >= 3) { submitAndShowResults(); return; }

  const prompts = [
    "Who's your winner? What's the #1 trend you're most excited about?",
    "Great. Now your #2.",
    "Final one. Your #3.",
  ];

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
  updateTop3Bar();

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
  hide('interstitial');

  localStorage.removeItem('trend_progress');
  localStorage.setItem('trend_completed', JSON.stringify({ votes, top3 }));

  // Show results immediately — DB writes happen in background
  fireConfetti();
  showResults();

  if (db) {
    // Fire-and-forget: persist vote then refresh stats
    (async () => {
      try {
        await db.from('voter_sessions').insert({
          session_id: SESSION_ID,
          votes,
          top3,
          excited_count: excitedTrends.length,
        });

        // Update trend_stats using Postgres increment via RPC-style batching
        const updates = TRENDS.map(trend => {
          const vote = votes[trend];
          if (!vote) return null;
          const patch = {};
          if (vote === 'excited') patch.excited_count = db.rpc ? 1 : 1;
          if (vote === 'meh') patch.meh_count = 1;
          if (vote === 'skip') patch.skip_count = 1;
          if (top3[0] === trend) patch.first_pick_count = 1;
          if (top3[1] === trend) patch.second_pick_count = 1;
          if (top3[2] === trend) patch.third_pick_count = 1;
          return { trend, vote, patch };
        }).filter(Boolean);

        // Batch: fetch all stats once, then update all in parallel
        const { data: allStats } = await db.from('trend_stats').select('*');
        if (allStats) {
          const promises = updates.map(({ trend, vote, patch }) => {
            const current = allStats.find(s => s.name === trend);
            if (!current) return null;
            const realPatch = {};
            if (vote === 'excited') realPatch.excited_count = (current.excited_count || 0) + 1;
            if (vote === 'meh') realPatch.meh_count = (current.meh_count || 0) + 1;
            if (vote === 'skip') realPatch.skip_count = (current.skip_count || 0) + 1;
            if (top3[0] === trend) realPatch.first_pick_count = (current.first_pick_count || 0) + 1;
            if (top3[1] === trend) realPatch.second_pick_count = (current.second_pick_count || 0) + 1;
            if (top3[2] === trend) realPatch.third_pick_count = (current.third_pick_count || 0) + 1;
            return Object.keys(realPatch).length
              ? db.from('trend_stats').update(realPatch).eq('name', trend)
              : null;
          }).filter(Boolean);
          await Promise.all(promises);
        }

        // Refresh stats and update display
        const displayedBefore = getTotalVotes();
        await loadGlobalStats();
        const dbTotal = SEED_VOTES + realVoteCount;
        if (dbTotal >= displayedBefore) {
          localVotesBumps = 0;
        } else {
          localVotesBumps = displayedBefore - dbTotal;
        }
        updateVoteCounter();
        renderGlobalRankings();
        renderResultsStats();
        renderContrarian();
        renderTopPicks(excitedTrends.length === 0);
      } catch(e) {
        console.warn('Supabase submit error:', e);
      }
    })();
  }
}

async function loadGlobalStats() {
  if (!db) { console.warn('[data] No Supabase connection'); return; }
  try {
    const { data, error } = await db.from('trend_stats').select('*');
    if (error) { console.warn('[data] trend_stats error:', error.message); }
    else if (data && data.length) {
      globalStats = data;
      // Compute real vote count: total votes in DB minus seed votes
      const dbTotalVotes = data.reduce((sum, s) =>
        sum + (s.excited_count || 0) + (s.meh_count || 0) + (s.skip_count || 0), 0);
      realVoteCount = Math.max(0, dbTotalVotes - SEED_VOTES);
      console.log('[data] trend_stats loaded:', data.length, 'trends, dbVotes:', dbTotalVotes, 'real:', realVoteCount, '→ displayed:', getTotalVotes());
    }
  } catch(e) { console.warn('[data] trend_stats exception:', e); }
  updateVoteCounter();
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
  const totalVoters = getTotalVotes();

  // Update the results vote counter
  const resultsVoteEl = document.getElementById('results-vote-count');
  if (resultsVoteEl) resultsVoteEl.textContent = totalVoters.toLocaleString();

  if (isSkeptic) {
    document.getElementById('results-headline').textContent = "You're a skeptic.";
    document.getElementById('results-subtext').textContent =
      "You're not excited about any 2026 trend.";
  } else {
    document.getElementById('results-headline').textContent = 'Your 2026 Outlook';
    document.getElementById('results-subtext').textContent = '';
  }

  renderTopPicks(isSkeptic);
  renderContrarian();
  renderAlsoExcited();
  renderGlobalRankings();
  renderResultsStats();
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

  const stats = getDisplayStats();
  el.innerHTML = top3.map((trend, i) => {
    const s = stats.find(x => x.name === trend);
    const excPct = s ? s.excitedPct : 0;
    const firstPct = s ? s.firstPct : 0;
    const rankInGlobal = s ? stats.indexOf(s) + 1 : '—';
    return `<div class="top-pick-item rank-${i + 1}">
      <span class="top-pick-rank">#${i + 1}</span>
      <div class="top-pick-info">
        <span class="top-pick-name">${trend}</span>
        <span class="top-pick-meta">${excPct}% excited · ${firstPct}% picked #1 · Global rank #${rankInGlobal}</span>
      </div>
    </div>`;
  }).join('');
}

function renderResultsStats() {
  const totalVoters = getTotalVotes();
  const stats = getDisplayStats();
  const global1 = stats[0];

  const el = document.getElementById('results-stats-bar');
  if (!el) return;

  el.innerHTML = `
    <div class="results-stat-item">
      <span class="results-stat-value" id="results-vote-count">${totalVoters.toLocaleString()}</span>
      <span class="results-stat-label">votes cast</span>
    </div>
    <div class="results-stat-divider"></div>
    <div class="results-stat-item">
      <span class="results-stat-value">15</span>
      <span class="results-stat-label">trends rated</span>
    </div>
    <div class="results-stat-divider"></div>
    <div class="results-stat-item">
      <span class="results-stat-value">${global1 ? global1.name : '—'}</span>
      <span class="results-stat-label">global #1 pick</span>
    </div>
  `;
}

function renderContrarian() {
  if (!top3.length) { hide('contrarian-section'); contrarianData = null; return; }

  const stats = getDisplayStats();
  const userPick = top3[0];
  const pickStat = stats.find(s => s.name === userPick);
  const firstPct = pickStat ? pickStat.firstPct : 0;

  const global1 = stats[0];
  const isAligned = (userPick === global1.name) || firstPct >= 15;

  const el = document.getElementById('contrarian-callout');
  show('contrarian-section');

  if (isAligned) {
    contrarianData = { isContrarian: false, trend: userPick, pct: firstPct };
    if (userPick === global1.name) {
      el.className = 'contrarian-callout aligned-style';
      el.innerHTML = `<span class="contrarian-label aligned-color">Consensus pick</span>
        Your #1, <strong>${userPick}</strong>, is the global #1 too.`;
    } else {
      el.className = 'contrarian-callout aligned-style';
      el.innerHTML = `<span class="contrarian-label aligned-color">Consensus pick</span>
        Your #1, <strong>${userPick}</strong>, is a popular pick — <strong>${firstPct}%</strong> of voters agree.`;
    }
  } else {
    contrarianData = { isContrarian: true, trend: userPick, pct: firstPct };
    el.className = 'contrarian-callout contrarian-style';
    el.innerHTML = `<span class="contrarian-label contrarian-color">Contrarian take</span>
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
  const totalVoters = getTotalVotes();

  el.innerHTML = `<div class="rankings-table">
    <div class="rankings-header-row">
      <span class="rh-rank">Rank</span>
      <span class="rh-name">Trend</span>
      <span class="rh-stat">#1 picks</span>
      <span class="rh-stat">Excited</span>
    </div>
    ${stats.map((s, i) => {
      const isUserPick = top3.includes(s.name);
      return `<div class="global-row${isUserPick ? ' user-pick' : ''}">
        <span class="global-rank">#${i + 1}</span>
        <span class="global-name">${s.name}${isUserPick ? ' <span class="user-badge">You</span>' : ''}</span>
        <span class="global-stat-cell">${s.firstPct}%</span>
        <span class="global-stat-cell">${s.excitedPct}%</span>
      </div>`;
    }).join('')}
  </div>`;
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
  contrarianData = null;
  rankingsUnlocked = false;
  localVotesBumps = 0;
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
  const colors = ['#122b42', '#3a6b9f', '#059669', '#34d399', '#ea580c', '#fb923c', '#3b82f6', '#c4b5a0'];
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

function getShareText() {
  const pick1 = top3[0];
  const totalVoters = getTotalVotes();
  if (!pick1) {
    return `I just voted on the Top Trends in Digital Assets 2026 — and I'm not excited about any of them. Call me a skeptic.\n\nWhat's your take?\n\nhttps://${DOMAIN}`;
  }
  const top3Text = top3.map((t, i) => `#${i + 1} ${t}`).join('\n');
  if (contrarianData && contrarianData.isContrarian) {
    return `I just voted on the Top Trends in Digital Assets 2026.\n\nMy picks:\n${top3Text}\n\nOnly ${contrarianData.pct}% agree with my #1 pick. ${totalVoters.toLocaleString()} votes and counting.\n\nWhat are yours?\nhttps://${DOMAIN}`;
  }
  return `I just voted on the Top Trends in Digital Assets 2026.\n\nMy picks:\n${top3Text}\n\n${totalVoters.toLocaleString()} votes and counting.\n\nWhat are yours?\nhttps://${DOMAIN}`;
}

function shareOnX() {
  const text = getShareText();
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnLinkedIn() {
  // LinkedIn share only supports the url param — text comes from OG tags
  const url = `https://${DOMAIN}`;
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
}

function copyLink() {
  const text = getShareText();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.share-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy text'; }, 2000);
  });
}

async function downloadScorecard() {
  if (!window.html2canvas) return;

  const isSkeptic = excitedTrends.length === 0;
  const stats = getDisplayStats();
  const totalVoters = getTotalVotes();
  const global1 = stats[0];

  const offscreen = document.createElement('div');
  offscreen.className = 'scorecard-offscreen';
  offscreen.style.position = 'relative';

  // Build top 3 section
  let picksHTML = '';
  if (isSkeptic) {
    picksHTML = `<div style="padding:24px 32px;background:rgba(18,43,66,0.04);border-radius:12px;border:1px solid rgba(18,43,66,0.08);">
      <p style="font-size:20px;font-weight:700;color:#1a1a1a;">Not excited about any 2026 trend.</p>
      <p style="font-size:14px;color:#666;margin-top:4px;">Call me a skeptic.</p>
    </div>`;
  } else {
    const rankColors = ['#122b42', '#059669', '#ea580c'];
    const rankBgs = ['rgba(18,43,66,0.06)', 'rgba(5,150,105,0.06)', 'rgba(234,88,12,0.06)'];
    picksHTML = top3.map((trend, i) => {
      const s = stats.find(x => x.name === trend);
      const excPct = s ? s.excitedPct : 0;
      const firstPct = s ? s.firstPct : 0;
      const globalRank = s ? stats.indexOf(s) + 1 : '—';
      return `<div style="display:flex;align-items:center;gap:16px;padding:${i === 0 ? '20px 24px' : '14px 24px'};background:${rankBgs[i]};border-left:4px solid ${rankColors[i]};border-radius:10px;margin-bottom:${i < 2 ? '8' : '0'}px;">
        <span style="font-size:${i === 0 ? '32' : '22'}px;font-weight:800;color:${rankColors[i]};min-width:36px;">#${i + 1}</span>
        <div style="flex:1;">
          <p style="font-size:${i === 0 ? '22' : '16'}px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">${trend}</p>
          <p style="font-size:12px;color:#888;">${excPct}% excited · ${firstPct}% picked #1 · Global #${globalRank}</p>
        </div>
      </div>`;
    }).join('');
  }

  // Contrarian badge
  let contrarianHTML = '';
  if (contrarianData) {
    if (contrarianData.isContrarian) {
      contrarianHTML = `<div style="margin-top:16px;padding:12px 20px;background:#fef3c7;border:2px solid #fbbf24;border-radius:10px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#b45309;margin-bottom:3px;">Contrarian take</p>
        <p style="font-size:14px;color:#1a1a1a;">Only <strong>${contrarianData.pct}%</strong> agree with my #1 pick</p>
      </div>`;
    } else {
      contrarianHTML = `<div style="margin-top:16px;padding:12px 20px;background:#ecfdf5;border:2px solid rgba(5,150,105,0.3);border-radius:10px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#059669;margin-bottom:3px;">Consensus pick</p>
        <p style="font-size:14px;color:#1a1a1a;"><strong>${contrarianData.pct}%</strong> share my #1 pick</p>
      </div>`;
    }
  }

  // Also excited
  const also = excitedTrends.filter(t => !top3.includes(t));
  let alsoHTML = '';
  if (also.length) {
    alsoHTML = `<div style="margin-top:20px;">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#999;margin-bottom:8px;">Also excited about</p>
      <p style="font-size:13px;color:#666;line-height:1.6;">${also.join(' · ')}</p>
    </div>`;
  }

  // Global top 5 mini leaderboard
  const top5 = stats.slice(0, 5);
  let leaderHTML = `<div style="margin-top:20px;padding:16px 20px;background:rgba(18,43,66,0.03);border-radius:10px;border:1px solid rgba(18,43,66,0.06);">
    <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#999;margin-bottom:10px;">Global Top 5</p>
    ${top5.map((s, i) => {
      const isMe = top3.includes(s.name);
      return `<div style="display:flex;align-items:center;gap:10px;padding:4px 0;${i < 4 ? 'border-bottom:1px solid rgba(18,43,66,0.06);' : ''}">
        <span style="font-size:12px;font-weight:700;color:#999;min-width:24px;">#${i + 1}</span>
        <span style="flex:1;font-size:13px;font-weight:${isMe ? '700' : '500'};color:${isMe ? '#122b42' : '#1a1a1a'};">${s.name}${isMe ? ' ←' : ''}</span>
        <span style="font-size:11px;color:#999;">${s.firstPct}%</span>
      </div>`;
    }).join('')}
  </div>`;

  offscreen.innerHTML = `
    <div style="padding:44px 56px;height:100%;position:relative;background:linear-gradient(145deg, #fafbfc 0%, #f0f2f5 40%, #e8ecf0 100%);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
        <div>
          <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#999;">My 2026 Digital Asset Outlook</p>
          <h2 style="font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#122b42;margin-top:4px;">Top Trends in Digital Assets</h2>
        </div>
        <div style="text-align:right;">
          <p style="font-size:24px;font-weight:800;color:#122b42;">${totalVoters.toLocaleString()}</p>
          <p style="font-size:11px;color:#999;">votes cast</p>
        </div>
      </div>

      <div style="display:flex;gap:24px;">
        <div style="flex:1.2;">
          ${picksHTML}
          ${contrarianHTML}
          ${alsoHTML}
        </div>
        <div style="flex:0.8;">
          ${leaderHTML}
        </div>
      </div>

      <div style="position:absolute;bottom:32px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid rgba(18,43,66,0.08);">
        <span style="font-size:13px;font-weight:700;color:#122b42;">${DOMAIN}</span>
        <span style="font-size:11px;color:#bbb;">Vote now — see how you compare</span>
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
