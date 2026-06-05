const app = document.getElementById('app');
const pageTitle = document.getElementById('pageTitle');
const backBtn = document.getElementById('backBtn');
const rounds = window.APP_ROUNDS || [];

const clone = obj => JSON.parse(JSON.stringify(obj));
const escapeHtml = (value) => String(value)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');
const splitCountry = country => {
  const parts = country.split(' ');
  return { flag: parts[0] || '', code: parts.slice(1).join(' ') || country };
};
const countryName = (round, country) => round.countryMeta?.[country]?.name || splitCountry(country).code;
const flag = (country, cls='flag') => `<span class="${cls}" role="img" aria-label="${escapeHtml(splitCountry(country).code)}">${splitCountry(country).flag}</span>`;
const label = (round, country, cls='small-flag') => `${flag(country, cls)}<span>${escapeHtml(splitCountry(country).code)}</span>`;

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function computeRanking(round){
  const categories = round.categories;
  const countries = Object.keys(round.rawValues);
  const originalOrder = Object.fromEntries(countries.map((c,i)=>[c,i]));
  const scored = Object.fromEntries(countries.map(c=>[c,{ country:c, OriginalOrder:originalOrder[c] }]));
  for(const cat of categories){
    const idx = categories.indexOf(cat);
    const sorted = [...countries].sort((a,b)=>{
      const diff = round.rawValues[b][idx] - round.rawValues[a][idx];
      return diff || originalOrder[a] - originalOrder[b];
    });
    sorted.forEach((country, index)=>{
      const rank = index + 1;
      scored[country][cat] = rank <= 12 ? 13 - rank : 0;
    });
  }
  let rows = Object.values(scored).map(row=>{
    row.total = categories.reduce((s,cat)=>s + row[cat],0);
    return row;
  });
  rows.sort((a,b)=> b.total - a.total || a.OriginalOrder - b.OriginalOrder);
  rows.forEach((row,i)=> row.rank = i+1);
  return rows;
}

function getQualified(rows, n=8){
  const byScore = new Map();
  rows.forEach(r=>{
    if(!byScore.has(r.total)) byScore.set(r.total, []);
    byScore.get(r.total).push(r.country);
  });
  const scores = [...byScore.keys()].sort((a,b)=>b-a);
  const out=[];
  for(const score of scores){
    out.push(...shuffle(byScore.get(score)));
    if(out.length >= n) break;
  }
  return out.slice(0,n);
}

function computeCategoryLeaders(round, rows){
  return round.categories.map(cat=>{
    const top = [...rows].sort((a,b)=> b[cat] - a[cat] || a.OriginalOrder - b.OriginalOrder)[0];
    return {cat, country: top.country, score: top[cat]};
  });
}

function showMenu(){
  backBtn.classList.remove('visible');
  pageTitle.textContent = 'Choose a section';
  app.innerHTML = `
    <section class="menu-wrap">
      <div class="menu-card">
        <h2 class="menu-title">Main menu</h2>
        <p class="menu-sub">Choose one of the sections. Each section opens as a separate interactive page with its own reveal, ranking and results table.</p>
        <div class="menu-grid">
          ${rounds.map(r=>`<button class="menu-btn ${r.type === 'final' ? 'final' : ''}" data-id="${r.id}">
            <span class="menu-label">${escapeHtml(r.label)}</span>
            <span class="menu-desc">${r.type === 'final' ? 'Final scoreboard' : 'Top 8 reveal'}</span>
          </button>`).join('')}
        </div>
      </div>
    </section>`;
  app.querySelectorAll('.menu-btn').forEach(btn=>btn.addEventListener('click',()=>openRound(btn.dataset.id)));
}

function openRound(id){
  const round = rounds.find(r=>r.id === id);
  if(!round) return;
  backBtn.classList.add('visible');
  pageTitle.textContent = round.label;
  location.hash = id;
  if(round.type === 'final') renderFinal(round); else renderRevealRound(round);
}

backBtn.addEventListener('click',()=>{history.pushState('', document.title, window.location.pathname + window.location.search); showMenu();});
window.addEventListener('hashchange',()=>{
  const id = location.hash.replace('#','');
  if(id && rounds.some(r=>r.id===id)) openRound(id); else showMenu();
});

function renderRevealRound(round){
  const rows = computeRanking(round);
  const qualified = getQualified(rows, 8);
  const qualifiedSet = new Set(qualified);
  const revealOrder = shuffle(qualified);
  const rowByCountry = Object.fromEntries(rows.map(r=>[r.country,r]));
  const maxScore = Math.max(...rows.map(r=>r.total));
  const winner = rows[0];
  const cutoff = rows.find(r=>r.rank === 8);
  const next = rows.find(r=>r.rank === 9);
  const gap = cutoff && next ? cutoff.total - next.total : 0;
  const avgTop = rows.filter(r=>qualifiedSet.has(r.country)).reduce((s,r)=>s+r.total,0)/8;
  const leaders = computeCategoryLeaders(round, rows);
  const leaderCounts = leaders.reduce((m,l)=>{m[l.country]=(m[l.country]||0)+1; return m;},{});
  const mostWins = Object.entries(leaderCounts).sort((a,b)=> b[1]-a[1] || rowByCountry[a[0]].rank-rowByCountry[b[0]].rank)[0];

  app.innerHTML = `
    <section class="round-shell">
      <div class="round-card" id="roundRoot">
        <div class="center-banner hidden" id="centerBanner">
          <div class="banner-flag" id="bannerFlag"></div>
          <div>
            <div class="banner-label">Qualified</div>
            <div class="banner-country" id="bannerCountry"></div>
            <div class="banner-sub">QUALIFIED</div>
          </div>
        </div>
        <div class="round-topbar">
          <div class="round-title-wrap">
            <div class="round-badge">${round.label.includes('SF') ? 'SF' : 'QF'}</div>
            <h2 class="round-title">${escapeHtml(round.title)}</h2>
          </div>
          <div class="progress-box">
            <div class="progress-text"><span id="progressText">0 / 8</span></div>
            <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
          </div>
        </div>
        <div class="round-body">
          <div class="countries-panel"><div class="countries-grid">
            ${Object.keys(round.rawValues).map(country=>`<div class="country-card" data-country="${escapeHtml(country)}">
              <div class="country-main">${flag(country,'flag')}<span class="country-code">${escapeHtml(splitCountry(country).code)}</span></div>
              <div class="country-state"><span class="state-dot"></span></div>
            </div>`).join('')}
          </div></div>
          <div class="reveal-panel">
            <div class="reveal-grid">
              ${Array.from({length:8},(_,i)=>`<button class="reveal-btn" data-position="${i+1}"><span>${i+1}</span></button>`).join('')}
            </div>
            <div class="final-banner hidden" id="completeBanner">Complete</div>
            <div class="controls">
              <button class="control-btn primary" id="showResultsBtn">Show table</button>
              <button class="control-btn" id="resetBtn">Reset round</button>
            </div>
            <p class="muted-note">Buttons unlock one by one, as in the original reveal logic.</p>
          </div>
        </div>
      </div>
    </section>`;

  const root = document.getElementById('roundRoot');
  const buttons = [...root.querySelectorAll('.reveal-btn')];
  const cards = new Map([...root.querySelectorAll('.country-card')].map(c=>[c.dataset.country,c]));
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const completeBanner = document.getElementById('completeBanner');
  const centerBanner = document.getElementById('centerBanner');
  const bannerFlag = document.getElementById('bannerFlag');
  const bannerCountry = document.getElementById('bannerCountry');
  let revealedCount = 0;
  let bannerTimer = null;

  function updateLocks(){
    buttons.forEach(btn=>{
      const pos = Number(btn.dataset.position);
      btn.disabled = btn.classList.contains('revealed') ? true : pos !== revealedCount + 1;
    });
  }
  function updateProgress(){
    progressText.textContent = `${revealedCount} / 8`;
    progressFill.style.width = `${revealedCount/8*100}%`;
  }
  function gradient(country){
    const colors = round.countryMeta?.[country]?.colors || ['#ff2a2a','#b00020'];
    if(colors.length === 1) return colors[0];
    const step = 100/colors.length;
    const parts=[];
    for(let i=0;i<colors.length;i++){parts.push(`${colors[i]} ${i*step}%`, `${colors[i]} ${(i+1)*step}%`)}
    return `linear-gradient(135deg, ${parts.join(',')})`;
  }
  function showBanner(country){
    bannerFlag.innerHTML = splitCountry(country).flag;
    bannerCountry.textContent = countryName(round,country);
    centerBanner.style.background = `linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.24)), ${gradient(country)}`;
    centerBanner.classList.remove('hidden','show');
    void centerBanner.offsetWidth;
    centerBanner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(()=>{centerBanner.classList.remove('show');centerBanner.classList.add('hidden');},2600);
  }
  function reveal(btn){
    const pos = Number(btn.dataset.position) - 1;
    const country = revealOrder[pos];
    if(!country || btn.classList.contains('revealed')) return;
    btn.classList.add('revealed');
    btn.innerHTML = `<span class="revealed-country">${flag(country,'small-flag')}<span>${escapeHtml(splitCountry(country).code)}</span></span>`;
    const card = cards.get(country);
    if(card) card.classList.add('qualified');
    showBanner(country);
    revealedCount++;
    updateProgress();
    if(revealedCount === 8){
      cards.forEach((card,country)=>{if(!qualifiedSet.has(country)) card.classList.add('dimmed');});
      completeBanner.classList.remove('hidden');
    }
    updateLocks();
  }
  buttons.forEach(btn=>btn.addEventListener('click',()=>reveal(btn)));
  document.getElementById('resetBtn').addEventListener('click',()=>renderRevealRound(round));
  document.getElementById('showResultsBtn').addEventListener('click',()=>{
    const dashboardHtml = buildRevealDashboard(round, rows, qualifiedSet, leaders, {winner, cutoff, next, gap, avgTop, maxScore, mostWins});
    showInfoModal(dashboardHtml, `${round.title} results`);
  });
  updateProgress(); updateLocks();
}


function showInfoModal(contentHtml, title='Details'){
  const existing = document.getElementById('infoModalRoot');
  if(existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="info-modal-backdrop" id="infoModalRoot" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="info-modal">
        <div class="info-modal-head">
          <div class="info-modal-title">${escapeHtml(title)}</div>
          <button class="info-modal-close" type="button" aria-label="Close details">×</button>
        </div>
        <div class="info-modal-body">${contentHtml}</div>
      </div>
    </div>`);
  const root = document.getElementById('infoModalRoot');
  const close = () => root.remove();
  root.querySelector('.info-modal-close').addEventListener('click', close);
  root.addEventListener('click', (event)=>{ if(event.target === root) close(); });
  const onKey = (event)=>{
    if(event.key === 'Escape'){
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
}

function buildRevealDashboard(round, rows, qualifiedSet, leaders, stats){
  const qualifiedRows = rows.filter(r=>qualifiedSet.has(r.country)).sort((a,b)=>a.rank-b.rank);
  const topGap = rows[1] ? rows[0].total - rows[1].total : 0;
  let biggestBreak = {value:-1, after:1};
  for(let i=1;i<rows.length;i++){
    const v = rows[i-1].total - rows[i].total;
    if(v > biggestBreak.value) biggestBreak = {value:v, after:i};
  }
  const minScoreCountry = [...rows].sort((a,b)=>{
    const amin = Math.min(...round.categories.map(c=>a[c]));
    const bmin = Math.min(...round.categories.map(c=>b[c]));
    return bmin - amin || a.rank-b.rank;
  })[0];
  const minFloor = Math.min(...round.categories.map(c=>minScoreCountry[c]));
  return `
    <div class="dashboard-panel">
      <div class="dash-head"><div><h3 class="dash-title">${escapeHtml(round.title)} results</h3><div class="dash-sub">official ranking + detailed score table</div></div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">winner</div><div class="stat-value">${label(round, stats.winner.country)}</div><div class="stat-small">${stats.winner.total} pts</div></div>
        <div class="stat-card"><div class="stat-label">cutoff</div><div class="stat-value">${label(round, stats.cutoff.country)}</div><div class="stat-small">${stats.cutoff.total} pts</div></div>
        <div class="stat-card"><div class="stat-label">gap</div><div class="stat-value">+${stats.gap}</div><div class="stat-small">8th over 9th</div></div>
        <div class="stat-card"><div class="stat-label">top 8 avg</div><div class="stat-value">${stats.avgTop.toFixed(1)}</div><div class="stat-small">points</div></div>
      </div>
      <div class="facts-grid">
        <div class="fact-card"><div class="fact-label">photo finish</div><div class="fact-value">+${topGap}</div><div class="fact-note">#1 over #2</div></div>
        <div class="fact-card"><div class="fact-label">most 12s</div><div class="fact-value">${label(round, stats.mostWins[0])}</div><div class="fact-note">${stats.mostWins[1]} category wins</div></div>
        <div class="fact-card"><div class="fact-label">highest floor</div><div class="fact-value">${label(round, minScoreCountry.country)}</div><div class="fact-note">minimum category score: ${minFloor}</div></div>
      </div>
      <div class="results-grid">
        <div class="result-panel-small"><div class="panel-title">qualified</div><div class="top-list">
          ${qualifiedRows.map(r=>`<div class="top-row"><div class="top-rank">#${r.rank}</div><div class="country-cell">${label(round,r.country)}</div><div class="top-score">${r.total}</div></div>`).join('')}
        </div></div>
        <div class="result-panel-small"><div class="panel-title">score ladder</div>
          ${rows.map(r=>`<div class="ladder-row ${qualifiedSet.has(r.country)?'qualified':'outside'}"><div class="ladder-rank">${r.rank}</div><div class="country-cell">${label(round,r.country)}</div><div class="ladder-track"><div class="ladder-bar" style="width:${(100*r.total/stats.maxScore).toFixed(1)}%"></div></div><div class="ladder-score">${r.total}</div></div>`).join('')}
        </div>
      </div>
      <div class="result-panel-small" style="margin-top:16px"><div class="panel-title">category leaders</div><div class="cat-grid">
        ${leaders.map(l=>`<div class="cat-chip"><span>${escapeHtml(l.cat)}</span><strong class="country-cell">${label(round,l.country)}</strong></div>`).join('')}
      </div></div>
      ${buildScoreTable(round, rows, qualifiedSet)}
    </div>`;
}

function buildScoreTable(round, rows, qualifiedSet){
  return `<div class="table-wrap"><table class="score-table"><thead><tr><th class="sticky-col">Rank</th><th class="sticky-country">Country</th><th>Status</th>${round.categories.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${qualifiedSet && qualifiedSet.has(r.country)?'qualified':''}"><td class="sticky-col">${r.rank}</td><td class="sticky-country"><div class="country-cell">${label(round,r.country)}</div></td><td>${qualifiedSet && qualifiedSet.has(r.country)?'Q':''}</td>${round.categories.map(c=>`<td>${r[c]}</td>`).join('')}<td><strong>${r.total}</strong></td></tr>`).join('')}
  </tbody></table></div>`;
}

function computeFinalData(round){
  const rows = computeRanking(round);
  const rowByCountry = Object.fromEntries(rows.map(r=>[r.country,r]));
  const countries = Object.keys(round.rawValues);
  const originalOrder = Object.fromEntries(countries.map((c,i)=>[c,i]));
  const animPoints = Object.fromEntries(countries.map(c=>[c,0]));
  const podiumCount = Object.fromEntries(countries.map(c=>[c,0]));
  const categoryWins = Object.fromEntries(countries.map(c=>[c,0]));
  const rankHistory = Object.fromEntries(countries.map(c=>[c,[]]));
  const categorySteps=[];
  const categoryLeaders=[];
  round.categories.forEach((cat,catIndex)=>{
    const sorted = [...countries].sort((a,b)=> round.rawValues[b][catIndex] - round.rawValues[a][catIndex] || originalOrder[a]-originalOrder[b]);
    const awards = sorted.slice(0,3).map((country,i)=>({country, points:[12,11,10][i]}));
    awards.forEach((item,i)=>{
      animPoints[item.country] += item.points;
      podiumCount[item.country] += 1;
      if(i===0) categoryWins[item.country] += 1;
    });
    categoryLeaders.push({cat,country:sorted[0]});
    const sortedAnim = [...countries].sort((a,b)=> animPoints[b]-animPoints[a] || originalOrder[a]-originalOrder[b]);
    const pos = Object.fromEntries(sortedAnim.map((c,i)=>[c,i+1]));
    countries.forEach(c=>rankHistory[c].push(pos[c]));
    categorySteps.push({category:cat, awards});
  });
  const animationWinner = Object.entries(animPoints).sort((a,b)=> b[1]-a[1] || originalOrder[a[0]]-originalOrder[b[0]])[0][0];
  const cardsData = countries.map(country=>({
    country,
    code: splitCountry(country).code,
    name: countryName(round,country),
    finalScore: rowByCountry[country].total,
    rank: rowByCountry[country].rank,
    originalOrder: originalOrder[country],
    stageScore: animPoints[country],
    podiums: podiumCount[country],
    wins: categoryWins[country],
  }));
  return {rows,rowByCountry,cardsData,categorySteps,categoryLeaders,animPoints,podiumCount,categoryWins,rankHistory,animationWinner};
}


function getFinalLayoutDims(){
  const appWidth = Math.max(320, app?.clientWidth || window.innerWidth || 1180);
  const viewportHeight = Math.max(560, window.innerHeight || 800);
  const phone = appWidth <= 560;
  const narrow = appWidth <= 760;
  const lowHeight = viewportHeight < 820;
  let rowsPerCol, cardWidth, cardHeight, gapRow, gapCol;
  if(phone){
    rowsPerCol = 4;
    gapCol = 6;
    gapRow = 6;
    const usableWidth = Math.max(300, appWidth - 22);
    cardWidth = Math.floor((usableWidth - gapCol * 3) / 4);
    cardWidth = Math.max(68, Math.min(112, cardWidth));
    cardHeight = lowHeight ? 30 : 34;
  } else if(narrow){
    rowsPerCol = 4;
    gapCol = 10;
    gapRow = 8;
    const usableWidth = Math.max(420, appWidth - 42);
    cardWidth = Math.floor((usableWidth - gapCol * 3) / 4);
    cardWidth = Math.max(92, Math.min(152, cardWidth));
    cardHeight = lowHeight ? 38 : 44;
  } else {
    rowsPerCol = 8;
    gapCol = lowHeight ? 22 : 28;
    gapRow = lowHeight ? 8 : 14;
    const usableWidth = Math.min(850, Math.max(620, appWidth - 90));
    cardWidth = Math.floor((usableWidth - gapCol) / 2);
    cardWidth = Math.max(248, Math.min(292, cardWidth));
    cardHeight = lowHeight ? 46 : 58;
  }
  const totalCards = 16;
  const cols = Math.ceil(totalCards / rowsPerCol);
  const stageWidth = cols * cardWidth + (cols - 1) * gapCol;
  const stageHeight = rowsPerCol * cardHeight + (rowsPerCol - 1) * gapRow;
  return {rowsPerCol, cardWidth, cardHeight, gapRow, gapCol, stageWidth, stageHeight};
}

function renderFinal(round){
  const data = computeFinalData(round);
  const dims = getFinalLayoutDims();
  const {cardWidth, cardHeight, gapRow, gapCol, rowsPerCol, stageWidth, stageHeight} = dims;
  app.innerHTML = `<section class="final-wrap">
    <div class="final-card" id="finalRoot">
      <div class="final-title">FINAL</div>
      <div class="head-line"><button class="start-btn" id="finalStart">START</button><div class="category-line" id="categoryLabel"></div></div>
      <div class="final-progress-wrap"><div class="final-progress-fill" id="finalProgress"></div></div>
      <div class="cards-stage"><div class="cards-inner" style="width:${stageWidth}px;height:${stageHeight}px">
        ${data.cardsData.map((card,i)=>{
          const col=Math.floor(i/rowsPerCol); const row=i%rowsPerCol;
          return `<div class="f-card" data-country="${escapeHtml(card.country)}" data-final="${card.finalScore}" data-stage="${card.stageScore}" data-orig="${card.originalOrder}" style="width:${cardWidth}px;height:${cardHeight}px;top:${row*(cardHeight+gapRow)}px;left:${col*(cardWidth+gapCol)}px"><div class="f-left"><span class="f-flag">${splitCountry(card.country).flag}</span><span class="f-code">${escapeHtml(card.code)}</span></div><div class="f-right"><span class="f-inc hidden">+0</span><span class="f-score">0</span></div></div>`
        }).join('')}
      </div></div>
      <div class="result-panel" id="resultPanel"><div class="result-head">FINAL RESULT</div><div class="result-main"><div class="winner-card" id="winnerCard"></div><div class="super-card" id="superCard"></div></div></div>
      <div class="overlay" id="overlay"><div class="overlay-card" id="overlayCard"></div></div>
    </div>
    <div class="final-actions"><button class="control-btn primary" id="insightsBtn">INSIGHTS</button><button class="control-btn" id="summaryBtn">SUMMARY TABLE</button><button class="control-btn" id="resetFinalBtn">Reset final</button></div>
    <div id="finalExtra" class="hidden"></div>
  </section>`;
  initFinalInteraction(round, data, dims);
}

function initFinalInteraction(round, data, dims){
  const root = document.getElementById('finalRoot');
  const startBtn = document.getElementById('finalStart');
  const categoryLabel = document.getElementById('categoryLabel');
  const progressFill = document.getElementById('finalProgress');
  const overlay = document.getElementById('overlay');
  const overlayCard = document.getElementById('overlayCard');
  const resultPanel = document.getElementById('resultPanel');
  const winnerCard = document.getElementById('winnerCard');
  const superCard = document.getElementById('superCard');
  const cards = [...root.querySelectorAll('.f-card')];
  let stageScores = Object.fromEntries(data.cardsData.map(c=>[c.country,0]));
  let displayScores = Object.fromEntries(data.cardsData.map(c=>[c.country,0]));
  let categoryIndex = 0, timer = null, started=false, finalRevealMode=false, revealedCount=0, superfinalPair=null, winnerShown=false;
  const intervalMs = 7000;
  const getCard = country => root.querySelector(`.f-card[data-country="${CSS.escape(country)}"]`);
  const clearHighlights = () => cards.forEach(c=>c.classList.remove('active'));
  const hideAllIncrements = () => root.querySelectorAll('.f-inc').forEach(i=>i.classList.add('hidden'));
  const updateProgress = () => progressFill.style.width = `${categoryIndex / data.categorySteps.length * 100}%`;
  function sortCards(){
    const sorted = [...cards].sort((a,b)=>{
      const diff = (displayScores[b.dataset.country]||0)-(displayScores[a.dataset.country]||0);
      return diff || Number(a.dataset.orig)-Number(b.dataset.orig);
    });
    sorted.forEach((card,index)=>{
      const col = Math.floor(index/dims.rowsPerCol); const row = index%dims.rowsPerCol;
      card.style.top = `${row*(dims.cardHeight+dims.gapRow)}px`;
      card.style.left = `${col*(dims.cardWidth+dims.gapCol)}px`;
    });
  }
  function flagGradient(country){
    const colors = round.countryMeta?.[country]?.colors || ['#fff'];
    if(colors.length===1) return colors[0];
    const step = 100/colors.length; const parts=[];
    for(let i=0;i<colors.length;i++) parts.push(`${colors[i]} ${i*step}%`,`${colors[i]} ${(i+1)*step}%`);
    return `linear-gradient(90deg,${parts.join(',')})`;
  }
  function nameBox(country, large=false){
    return `<div class="flag-namebox" style="background:${flagGradient(country)};font-size:${large?'26px':'22px'}">${escapeHtml(countryName(round,country).toUpperCase())}</div>`;
  }
  function runCategoryStep(){
    if(!started || finalRevealMode) return;
    if(categoryIndex >= data.categorySteps.length){ enterFinalReveal(); return; }
    clearHighlights(); hideAllIncrements();
    const step = data.categorySteps[categoryIndex];
    categoryLabel.textContent = step.category;
    step.awards.forEach(item=>{
      const card = getCard(item.country); if(!card) return;
      stageScores[item.country] += item.points;
      if(!card.classList.contains('revealed')){
        card.querySelector('.f-score').textContent = String(stageScores[item.country]);
        displayScores[item.country] = stageScores[item.country];
      }
      card.classList.add('active');
      const inc = card.querySelector('.f-inc'); inc.textContent = `+${item.points}`; inc.classList.remove('hidden');
    });
    categoryIndex++; updateProgress(); sortCards();
    if(categoryIndex >= data.categorySteps.length){ clearInterval(timer); setTimeout(enterFinalReveal, intervalMs); }
  }
  function startShow(){
    if(started) return; started=true; startBtn.style.display='none'; categoryLabel.style.display='flex';
    runCategoryStep(); timer = setInterval(runCategoryStep, intervalMs);
  }
  function enterFinalReveal(){
    if(finalRevealMode) return; finalRevealMode=true; clearInterval(timer); clearHighlights(); hideAllIncrements(); categoryLabel.textContent='RESULTS';
  }
  function determineSuperfinalPair(){
    const revealed = [...root.querySelectorAll('.f-card.revealed')].map(c=>c.dataset.country);
    const candidates = revealed.filter(c=>c !== data.animationWinner).sort((a,b)=> Number(getCard(b).dataset.final)-Number(getCard(a).dataset.final) || Number(getCard(a).dataset.orig)-Number(getCard(b).dataset.orig));
    superfinalPair = [data.animationWinner, candidates[0]]; return superfinalPair;
  }
  function showSuperfinalBanner(){
    if(!superfinalPair) determineSuperfinalPair();
    const [a,b] = superfinalPair;
    const aCurrent = Number(getCard(a).querySelector('.f-score').textContent) || 0;
    const bFinal = Number(getCard(b).dataset.final);
    const needed = Math.max(0, bFinal - aCurrent + 1);
    overlayCard.innerHTML = `<div class="duel-wrap"><div>${nameBox(a,true)}</div><div class="duel-vs">VS</div><div>${nameBox(b,true)}</div></div><div class="duel-note">NEEDS ${needed} TO WIN</div>`;
    overlay.style.display='flex'; setTimeout(()=>{ if(!winnerShown) overlay.style.display='none'; },5600); categoryLabel.textContent='SUPERFINAL';
  }
  function showBottomResult(){
    if(winnerShown) return; winnerShown=true; if(!superfinalPair) determineSuperfinalPair();
    const [a,b] = superfinalPair;
    const scoreA = Number(getCard(a).dataset.final), scoreB = Number(getCard(b).dataset.final);
    const winner = scoreA >= scoreB ? a : b; const runner = scoreA >= scoreB ? b : a;
    const needed = Math.max(0, scoreB - (Number(getCard(a).dataset.stage)||0) + 1);
    winnerCard.innerHTML = `<div class="result-kicker">Winner</div>${nameBox(winner,true)}<div class="result-value">${Number(getCard(winner).dataset.final)} pts</div>`;
    superCard.innerHTML = `<div class="result-kicker">Superfinal</div><div style="display:grid;gap:10px">${nameBox(a)}${nameBox(runner)}</div><div class="result-value">Needed: ${needed}</div>`;
    resultPanel.style.display='block'; overlay.style.display='none'; categoryLabel.textContent='WINNER'; setTimeout(hideAllIncrements,10000);
  }
  function onCardClick(card){
    if(!finalRevealMode || card.classList.contains('revealed')) return;
    const country = card.dataset.country;
    if(country === data.animationWinner && revealedCount < data.cardsData.length - 1){
      card.classList.remove('blocked-pulse'); void card.offsetWidth; card.classList.add('blocked-pulse'); return;
    }
    const finalScore = Number(card.dataset.final);
    const shown = Number(card.querySelector('.f-score').textContent) || 0;
    const diff = finalScore - shown;
    const inc = card.querySelector('.f-inc'); inc.textContent = diff >= 0 ? `+${diff}` : `${diff}`; inc.classList.remove('hidden');
    setTimeout(()=>{
      card.classList.add('revealed'); card.querySelector('.f-score').textContent = String(finalScore); displayScores[country] = finalScore; sortCards(); revealedCount++;
      if(revealedCount === data.cardsData.length - 1 && !superfinalPair){ determineSuperfinalPair(); showSuperfinalBanner(); }
      if(revealedCount === data.cardsData.length){ setTimeout(showBottomResult,900); }
    },700);
  }
  cards.forEach(card=>card.addEventListener('click',()=>onCardClick(card)));
  startBtn.addEventListener('click',startShow);
  document.getElementById('resetFinalBtn').addEventListener('click',()=>renderFinal(round));
  document.getElementById('insightsBtn').addEventListener('click',()=>{
    showInfoModal(buildFinalInsights(round, data), 'FINAL insights');
  });
  document.getElementById('summaryBtn').addEventListener('click',()=>{
    showInfoModal(buildFinalSummary(round, data), 'FINAL summary table');
  });
}

function buildFinalInsights(round, data){
  const rows = data.rows;
  const maxScore = Math.max(...rows.map(r=>r.total));
  const officialWinner = rows[0];
  const animationWinner = data.rowByCountry[data.animationWinner];
  const maxCategoryWins = Object.entries(data.categoryWins).sort((a,b)=>b[1]-a[1] || data.rowByCountry[a[0]].rank-data.rowByCountry[b[0]].rank)[0];
  const maxPodiums = Object.entries(data.podiumCount).sort((a,b)=>b[1]-a[1] || data.rowByCountry[a[0]].rank-data.rowByCountry[b[0]].rank)[0];
  const metrics = [
    ['Official winner', officialWinner.country, `${officialWinner.total} pts`],
    ['Animation winner', data.animationWinner, `${data.animPoints[data.animationWinner]} anim pts`],
    ['Most category wins', maxCategoryWins[0], `${maxCategoryWins[1]} wins`],
    ['Most top-3s', maxPodiums[0], `${maxPodiums[1]} podiums`]
  ];
  return `<div class="light-dashboard">
    <div class="dash-head"><div><h3 class="dash-title">FINAL insights</h3><div class="dash-sub">overview, score ladder, category leaders and podium</div></div></div>
    <div class="stats-grid">${metrics.map(m=>`<div class="stat-card"><div class="stat-label">${m[0]}</div><div class="stat-value">${label(round,m[1])}</div><div class="stat-small">${m[2]}</div></div>`).join('')}</div>
    <div class="results-grid">
      <div class="result-panel-small"><div class="panel-title">Score ladder</div>${rows.map(r=>`<div class="ladder-row"><div class="ladder-rank">${r.rank}</div><div class="country-cell">${label(round,r.country)}</div><div class="ladder-track"><div class="ladder-bar" style="width:${(100*r.total/maxScore).toFixed(1)}%"></div></div><div class="ladder-score">${r.total}</div></div>`).join('')}</div>
      <div class="result-panel-small"><div class="panel-title">Category leaders</div><div class="cat-grid">${data.categoryLeaders.map(l=>`<div class="cat-chip"><span>${escapeHtml(l.cat)}</span><strong class="country-cell">${label(round,l.country)}</strong></div>`).join('')}</div></div>
    </div>
    <div class="result-panel-small" style="margin-top:16px"><div class="panel-title">Podium</div><div class="podium">${rows.slice(0,3).map((r,i)=>`<div class="pod-card ${i===0?'first':i===1?'second':'third'}"><div class="pod-rank">#${r.rank}</div><div class="pod-country">${label(round,r.country)}</div><div class="pod-name">${escapeHtml(countryName(round,r.country))}</div><div class="pod-score">${r.total} pts</div></div>`).join('')}</div></div>
  </div>`;
}

function buildFinalSummary(round, data){
  const rows = data.rows;
  return `<div class="summary-card"><div class="summary-title">Summary table</div><div class="summary-note">Finalists: official category scores, total score, animation score, podiums and category wins.</div><div class="summary-scroll"><table class="summary-table"><thead><tr><th>Rank</th><th>Country</th><th>Name</th>${round.categories.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}<th>Total</th><th>Anim</th><th>Top-3</th><th>Wins</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td><div class="country-cell">${label(round,r.country)}</div></td><td>${escapeHtml(countryName(round,r.country))}</td>${round.categories.map(c=>`<td>${r[c]}</td>`).join('')}<td><strong>${r.total}</strong></td><td>${data.animPoints[r.country]}</td><td>${data.podiumCount[r.country]}</td><td>${data.categoryWins[r.country]}</td></tr>`).join('')}</tbody></table></div></div>`;
}

const startId = location.hash.replace('#','');
if(startId && rounds.some(r=>r.id===startId)) openRound(startId); else showMenu();
