(async function(){
  const SITE='https://www.gptgames.dev/';
  const [games,tools] = await Promise.all([
    fetch('data/games.json').then(r=>r.json()),
    fetch('data/tools.json').then(r=>r.json())
  ]);
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  const html = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
  const all = [...games, ...tools].map(x=>({...x, url:(x.url||'').replace(/\\/g,'/')}));
  const isNew = x => (Date.now() - new Date(x.date).getTime()) < 1000*60*60*24*120;
  const img = x => SITE + (x.screenshot||'').replace(/^\//,'');
  const href = x => SITE + (x.url||'').replace(/^\//,'');
  const clean = t => (t||'').replace(/\(AI\)\s*/,'').replace(/&/g,'&amp;');
  const esc = s => (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // ── Dynamic counts everywhere ─────────────
  const aiCount = all.filter(x=>x.aiPowered).length;
  const featList = all.filter(x=>x.featured);
  set('sGames', games.length);
  set('sTools', tools.length);
  set('sAI', aiCount);
  set('hGames', games.length);
  set('hTools', tools.length);
  set('featCount', featList.length);
  const featTools = featList.filter(x=>x.type==='tool').length;
  const featGames = featList.filter(x=>x.type==='game').length;
  set('featMix', `${featTools} tools · ${featGames} games`);
  set('browseTotal', all.length);
  set('ledgerCount', tools.length);
  set('topRight', `CRT-01 · ONLINE · ${all.length} ENTRIES LOADED`);
  set('year', new Date().getFullYear());

  // ── Daily pick (seeded by day-of-year) ─────
  const today = new Date();
  const doy = Math.floor((today - new Date(today.getFullYear(),0,0)) / 86400000);
  // pool: featured first; if none for today slot, fall back to whole catalogue
  const pool = featList.length ? featList : all;
  const dailyIdx = doy % pool.length;
  const daily = pool[dailyIdx];
  set('dateLabel', today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase());
  html('dailypick', `
    <a class="dailypick-img" href="${href(daily)}" target="_blank" rel="noopener"><img src="${img(daily)}" alt="" loading="lazy"></a>
    <div class="dailypick-body">
      <div class="dailypick-kicker">
        <span>◆ ${daily.type==='game'?'GAME':'TOOL'}${daily.aiPowered?' · AI-NATIVE':''}</span>
        <span class="date">PICKED ${today.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()}</span>
      </div>
      <h2>${clean(daily.title)}</h2>
      <p>${esc(daily.description.replace(/\s+/g,' ').trim())}</p>
      <div class="dailypick-cta">
        <a class="pixbtn hot" href="${href(daily)}" target="_blank" rel="noopener" style="font-size:12px);padding:10px 18px">▶ &nbsp;Open</a>
        <div class="chips">${(daily.tags||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>`);

  // ── Featured strip: 3 cards, balanced by catalogue ratio ─────────
  // catalogue is ~71% tools / 29% games → 2 tools + 1 game for a 3-card strip
  const featSorted = [...featList].sort((a,b)=>new Date(b.date)-new Date(a.date)).filter(x=>x.id!==daily.id);
  const featToolsArr = featSorted.filter(x=>x.type==='tool');
  const featGamesArr = featSorted.filter(x=>x.type==='game');
  const strip = [];
  if(featToolsArr[0]) strip.push(featToolsArr[0]);
  if(featGamesArr[0]) strip.push(featGamesArr[0]);
  if(featToolsArr[1]) strip.push(featToolsArr[1]);
  // pad if not enough
  while(strip.length<3 && featSorted.length){
    const next = featSorted.find(x=>!strip.includes(x));
    if(!next) break;
    strip.push(next);
  }
  html('featGrid', strip.slice(0,3).map((x,i)=>`
    <a class="feat" href="${href(x)}" target="_blank" rel="noopener">
      <div class="feat-img">
        <div class="feat-top">
          <span class="feat-num">№${String(i+1).padStart(2,'0')}</span>
          <span class="feat-badge ${x.type}">${x.type.toUpperCase()}</span>
        </div>
        <img src="${img(x)}" alt="" loading="lazy">
      </div>
      <div class="feat-body">
        <div class="feat-title">${clean(x.title)}</div>
        <div class="feat-desc">${esc(x.description.replace(/\s+/g,' ').trim())}</div>
        <div class="feat-meta">
          <span class="t">${esc((x.tags||[])[0]||x.type)}</span>
          <span>· ${new Date(x.date).toLocaleDateString('en-US',{month:'short',year:'numeric'}).toUpperCase()}</span>
        </div>
      </div>
    </a>`).join(''));

  // ── Ticker: linked, proper duplicated track ─────────
  const recent = [...all].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,24);
  const tickItem = x => `<a class="ticker-item" href="${href(x)}" target="_blank" rel="noopener"><span class="star">★</span><span>${clean(x.title)}</span><span class="tag ${x.type}">${x.type}</span></a>`;
  const tickHtml = recent.map(tickItem).join('');
  const track = document.getElementById('ticker');
  track.innerHTML = tickHtml + tickHtml; // duplicated so translateX(-50%) loops seamlessly
  // measure for smooth seamless animation
  requestAnimationFrame(()=>{
    const half = track.scrollWidth / 2;
    const duration = Math.max(40, half/60); // ~60px/s
    track.style.animation = `none`;
    // inject keyframes with measured half-width for perfect loop
    const styleId = 'tickerKF';
    let styleEl = document.getElementById(styleId);
    if(!styleEl){styleEl=document.createElement('style');styleEl.id=styleId;document.head.appendChild(styleEl)}
    styleEl.textContent = `@keyframes tickerMarq{from{transform:translateX(0)}to{transform:translateX(-${half}px)}}`;
    track.style.animation = `tickerMarq ${duration}s linear infinite`;
  });

  // ── Sidebar: Type, Specials, Categories (tags) ──
  const state = { type:'all', filter:null, tag:null, sort:'newest', search:'', limit:48 };

  function buildSidebar(){
    const typeUl = document.getElementById('typeList');
    typeUl.innerHTML = `
      <li data-type="all" class="on">All <span class="n">${all.length}</span></li>
      <li data-type="tool">Tools <span class="n">${tools.length}</span></li>
      <li data-type="game">Games <span class="n">${games.length}</span></li>
    `;
    const specUl = document.getElementById('specList');
    const newCount = all.filter(isNew).length;
    specUl.innerHTML = `
      <li data-filter="featured">★ Featured <span class="n">${featList.length}</span></li>
      <li data-filter="ai">✦ AI-native <span class="n">${aiCount}</span></li>
      <li data-filter="new">+ New <span class="n">${newCount}</span></li>
    `;
    // tag list — sort by count desc, show all
    const tagCounts = {};
    all.forEach(x=>(x.tags||[]).forEach(t=>tagCounts[t]=(tagCounts[t]||0)+1));
    const tagUl = document.getElementById('tagList');
    const tagEntries = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
    tagUl.innerHTML = tagEntries.map(([t,n])=>`<li data-tag="${esc(t)}">${esc(t)} <span class="n">${n}</span></li>`).join('');
  }
  buildSidebar();

  // clicks
  document.getElementById('typeList').addEventListener('click',e=>{
    const li = e.target.closest('li[data-type]'); if(!li) return;
    document.querySelectorAll('#typeList li').forEach(x=>x.classList.remove('on'));
    li.classList.add('on'); state.type = li.dataset.type; state.limit=48; apply();
  });
  document.getElementById('specList').addEventListener('click',e=>{
    const li = e.target.closest('li[data-filter]'); if(!li) return;
    const was = li.classList.contains('on');
    document.querySelectorAll('#specList li').forEach(x=>x.classList.remove('on'));
    state.filter = was ? null : li.dataset.filter;
    if(!was) li.classList.add('on');
    state.limit=48; apply();
  });
  document.getElementById('tagList').addEventListener('click',e=>{
    const li = e.target.closest('li[data-tag]'); if(!li) return;
    const was = li.classList.contains('on');
    document.querySelectorAll('#tagList li').forEach(x=>x.classList.remove('on'));
    state.tag = was ? null : li.dataset.tag;
    if(!was) li.classList.add('on');
    state.limit=48; apply();
  });
  document.querySelectorAll('.pill-btn[data-sort]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.pill-btn[data-sort]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); state.sort=b.dataset.sort; apply();
  }));
  document.getElementById('srch').addEventListener('input', e => {
    state.search = e.target.value;
    state.limit = 48;
    const el = document.getElementById('browse');
    if (el) el.scrollIntoView();
    apply();
  });
  document.getElementById('clearFilter').addEventListener('click',()=>{
    state.filter=null; state.tag=null;
    document.querySelectorAll('#specList li, #tagList li').forEach(x=>x.classList.remove('on'));
    apply();
  });
  document.getElementById('loadmore').addEventListener('click',()=>{state.limit+=48;apply()});

  function apply(){
    let list = [...all];
    if(state.type!=='all') list = list.filter(x=>x.type===state.type);
    if(state.filter==='featured') list = list.filter(x=>x.featured);
    else if(state.filter==='ai') list = list.filter(x=>x.aiPowered);
    else if(state.filter==='new') list = list.filter(isNew);
    if(state.tag) list = list.filter(x=>(x.tags||[]).includes(state.tag));
    if(state.search){
      const q=state.search.toLowerCase();
      list=list.filter(x=>x.title.toLowerCase().includes(q)||(x.description||'').toLowerCase().includes(q)||(x.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }
    if(state.sort==='newest') list.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(state.sort==='az') list.sort((a,b)=>a.title.localeCompare(b.title));
    if(state.sort==='feat') list.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||new Date(b.date)-new Date(a.date));

    set('browseTotal', list.length);
    const shown = list.slice(0, state.limit);
    set('browseCount', shown.length);
    const lm = document.getElementById('loadmore');
    lm.style.display = list.length > shown.length ? '' : 'none';
    lm.textContent = `Load more ▾  (${list.length - shown.length} remaining)`;

    // active filter label
    const lbl = document.getElementById('activeFilterLabel');
    const clr = document.getElementById('clearFilter');
    const parts = [];
    if(state.filter) parts.push(state.filter);
    if(state.tag) parts.push(state.tag);
    if(parts.length){
      lbl.textContent = 'FILTER · ' + parts.join(' + ');
      lbl.style.display = '';
      clr.style.display = '';
    } else {
      lbl.style.display='none';clr.style.display='none';
    }

    render(shown);
  }

  function render(list){
    if(!list.length){
      html('cards', `<div class="empty" style="grid-column:1/-1">GAME OVER<br><span class="sub">No entries match · try clearing filters</span></div>`);
      return;
    }
    html('cards', list.map(x=>{
      const tags = [];
      tags.push(`<span class="cab-tag ${x.type}">${x.type.toUpperCase()}</span>`);
      if(x.aiPowered) tags.push('<span class="cab-tag ai">AI</span>');
      if(x.featured) tags.push('<span class="cab-tag star">★</span>');
      if(isNew(x)) tags.push('<span class="cab-tag new">NEW</span>');
      const cat = (x.tags||[])[0] || '';
      return `<a class="cab" href="${href(x)}" target="_blank" rel="noopener">
        <div class="cab-img">
          <div class="cab-corner">${tags.join('')}</div>
          <img src="${img(x)}" alt="" loading="lazy">
        </div>
        <div class="cab-body">
          <div class="cab-title">${clean(x.title)}</div>
          <div class="cab-desc">${esc(x.description.replace(/\s+/g,' ').trim())}</div>
          <div class="cab-footer">
            <span class="cat">${esc(cat)}</span>
            <span class="play">▶ OPEN</span>
          </div>
        </div>
      </a>`;
    }).join(''));
  }

  // ── Toolshed A-Z ledger ─────────
  const toolsSorted = [...tools].sort((a,b)=>a.title.localeCompare(b.title));
  html('ledger', toolsSorted.map((x,i)=>{
    const cat = (x.tags||[])[0] || '—';
    return `<a class="ledger-row" href="${href(x)}" target="_blank" rel="noopener">
      <span class="idx">${String(i+1).padStart(3,'0')}</span>
      <span class="t">${clean(x.title)}</span>
      <span class="c">${esc(cat)}</span>
      <span class="go">OPEN ↗</span>
    </a>`;
  }).join(''));

  // ── Random ─────────
  const lucky = ()=>{const x=all[Math.floor(Math.random()*all.length)];window.open(href(x),'_blank')};
  document.getElementById('luckyBtn').addEventListener('click',lucky);
  document.getElementById('luckyBtn2').addEventListener('click',lucky);

  // keyboard shortcut /
  document.addEventListener('keydown',e=>{
    if(e.key==='/' && document.activeElement.tagName!=='INPUT'){e.preventDefault();document.getElementById('srch').focus()}
  });

  // Hi-score-ish random stat for footer (dynamic, not arbitrary)
  set('hiScoreRow', `RECENT · ${recent[0]?clean(recent[0].title).toUpperCase():'—'}`);

  apply();

  // ── Tweaks ─────────
  const TWEAKS=/*EDITMODE-BEGIN*/{"accent":"#ffc857","scanlines":"on","density":"dense","hstyle":"pixel"}/*EDITMODE-END*/;
  const accents=[{n:'Amber',c:'#ffc857'},{n:'Coin-op Red',c:'#ff4d2e'},{n:'Neon Cyan',c:'#4ee1d2'},{n:'Lime',c:'#b4f04a'},{n:'Magenta',c:'#ff3ca1'}];
  function applyTweaks(t){
    document.documentElement.style.setProperty('--amber',t.accent);
    const c=document.getElementById('cards');
    c.style.gridTemplateColumns = t.density==='cozy'?'repeat(auto-fill,minmax(280px,1fr))':t.density==='compact'?'repeat(auto-fill,minmax(170px,1fr))':'repeat(auto-fill,minmax(210px,1fr))';
    if(t.scanlines==='off') document.body.classList.add('noscan'); else document.body.classList.remove('noscan');
    // headline style
    const ht = document.querySelector('.hero-title');
    if(t.hstyle==='chrome'){
      ht.style.textShadow='2px 2px 0 var(--hot), 4px 4px 0 var(--bg-2), 0 0 20px rgba(255,200,87,0.3)';
    } else if(t.hstyle==='outline'){
      ht.style.textShadow='none';
      ht.style.webkitTextStroke='2px var(--amber)';
      ht.style.color='transparent';
    } else {
      ht.style.textShadow='4px 4px 0 var(--bg-2)';
      ht.style.webkitTextStroke='';
      ht.style.color='';
    }
  }
  applyTweaks(TWEAKS);
  const swA=document.getElementById('acSwatches');
  swA.innerHTML = accents.map(a=>`<div class="sw${a.c===TWEAKS.accent?' on':''}" style="background:${a.c}" data-c="${a.c}" title="${a.n}"></div>`).join('');
  swA.addEventListener('click',e=>{const sw=e.target.closest('.sw');if(!sw)return;TWEAKS.accent=sw.dataset.c;[...swA.children].forEach(x=>x.classList.remove('on'));sw.classList.add('on');applyTweaks(TWEAKS);sendEdits({accent:TWEAKS.accent})});
  document.getElementById('scanSel').value=TWEAKS.scanlines;
  document.getElementById('scanSel').addEventListener('change',e=>{TWEAKS.scanlines=e.target.value;applyTweaks(TWEAKS);sendEdits({scanlines:TWEAKS.scanlines})});
  document.getElementById('density').value=TWEAKS.density;
  document.getElementById('density').addEventListener('change',e=>{TWEAKS.density=e.target.value;applyTweaks(TWEAKS);sendEdits({density:TWEAKS.density})});
  document.getElementById('hstyle').value=TWEAKS.hstyle;
  document.getElementById('hstyle').addEventListener('change',e=>{TWEAKS.hstyle=e.target.value;applyTweaks(TWEAKS);sendEdits({hstyle:TWEAKS.hstyle})});
  function sendEdits(edits){try{window.parent.postMessage({type:'__edit_mode_set_keys',edits},'*')}catch(e){}}
  window.addEventListener('message',e=>{const d=e.data||{};if(d.type==='__activate_edit_mode')document.getElementById('tweaks').classList.add('vis');if(d.type==='__deactivate_edit_mode')document.getElementById('tweaks').classList.remove('vis')});
  try{window.parent.postMessage({type:'__edit_mode_available'},'*')}catch(e){}
})();
