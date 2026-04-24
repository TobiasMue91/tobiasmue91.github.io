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
  const desc = x => ((x.description)||'').replace(/\s+/g,' ').trim();

  const MOBILE_Q = window.matchMedia('(max-width: 1000px)');

  // ── Dynamic counts ─────────────
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

  // ── Daily pick ─────
  const today = new Date();
  const doy = Math.floor((today - new Date(today.getFullYear(),0,0)) / 86400000);
  const pool = featList.length ? featList : all;
  const dailyIdx = doy % pool.length;
  const daily = pool[dailyIdx];
  set('dateLabel', today.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase());
  html('dailypick', `
    <a class="dailypick-img" href="${href(daily)}" target="_blank" rel="noopener" aria-label="${esc(daily.title)}"><img src="${img(daily)}" alt="${esc(daily.title)}" width="800" height="500" loading="eager"></a>
    <div class="dailypick-body">
      <div class="dailypick-kicker">
        <span>◆ ${daily.type==='game'?'GAME':'TOOL'}${daily.aiPowered?' · AI-NATIVE':''}</span>
        <span class="date">PICKED ${today.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()}</span>
      </div>
      <h3>${clean(daily.title)}</h3>
      <p>${esc(desc(daily))}</p>
      <div class="dailypick-cta">
        <a class="pixbtn hot" href="${href(daily)}" target="_blank" rel="noopener" style="font-size:12px;padding:10px 18px">▶ &nbsp;Open</a>
        <div class="chips">${(daily.tags||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>`);

  // ── Featured strip ─────
  const featSorted = [...featList].sort((a,b)=>new Date(b.date)-new Date(a.date)).filter(x=>x.id!==daily.id);
  const featToolsArr = featSorted.filter(x=>x.type==='tool');
  const featGamesArr = featSorted.filter(x=>x.type==='game');
  const strip = [];
  if(featToolsArr[0]) strip.push(featToolsArr[0]);
  if(featGamesArr[0]) strip.push(featGamesArr[0]);
  if(featToolsArr[1]) strip.push(featToolsArr[1]);
  while(strip.length<3 && featSorted.length){
    const next = featSorted.find(x=>!strip.includes(x));
    if(!next) break;
    strip.push(next);
  }
  html('featGrid', strip.slice(0,3).map((x,i)=>`
    <a class="feat" href="${href(x)}" target="_blank" rel="noopener" aria-label="${esc(x.title)}">
      <div class="feat-img">
        <div class="feat-top">
          <span class="feat-num">№${String(i+1).padStart(2,'0')}</span>
          <span class="feat-badge ${x.type}">${x.type.toUpperCase()}</span>
        </div>
        <img src="${img(x)}" alt="${esc(x.title)}" width="400" height="250" loading="lazy">
      </div>
      <div class="feat-body">
        <div class="feat-title">${clean(x.title)}</div>
        <div class="feat-desc">${esc(desc(x))}</div>
        <div class="feat-meta">
          <span class="t">${esc((x.tags||[])[0]||x.type)}</span>
          <span>· ${new Date(x.date).toLocaleDateString('en-US',{month:'short',year:'numeric'}).toUpperCase()}</span>
        </div>
      </div>
    </a>`).join(''));

  // ── Ticker ─────
  const recent = [...all].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,24);
  const tickItem = x => `<a class="ticker-item" href="${href(x)}" target="_blank" rel="noopener"><span class="star" aria-hidden="true">★</span><span>${clean(x.title)}</span><span class="tag ${x.type}">${x.type}</span></a>`;
  const tickHtml = recent.map(tickItem).join('');
  const track = document.getElementById('ticker');
  track.innerHTML = tickHtml + tickHtml;

  function measureTicker(){
    const half = track.scrollWidth / 2;
    const duration = Math.max(40, half/60);
    const styleId = 'tickerKF';
    let styleEl = document.getElementById(styleId);
    if(!styleEl){styleEl=document.createElement('style');styleEl.id=styleId;document.head.appendChild(styleEl)}
    styleEl.textContent = `@keyframes tickerMarq{from{transform:translateX(0)}to{transform:translateX(-${half}px)}}`;
    track.style.animation = `tickerMarq ${duration}s linear infinite`;
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(()=>requestAnimationFrame(measureTicker));
  } else {
    requestAnimationFrame(measureTicker);
  }

  // ── Sidebar / Drawer content ──
  // State is single source of truth. List items live in desktop aside AND mobile
  // drawer simultaneously — we just mark both sets of matching items as "on"
  // via data attributes. Delegated click handler on document.body dispatches
  // correctly regardless of which one the user tapped.
  const state = { type:'all', filter:null, tag:null, sort:'newest', search:'', limit:48 };

  function typeListHtml(){
    return `
      <li role="button" tabindex="0" data-type="all" class="on">All <span class="n">${all.length}</span></li>
      <li role="button" tabindex="0" data-type="tool">Tools <span class="n">${tools.length}</span></li>
      <li role="button" tabindex="0" data-type="game">Games <span class="n">${games.length}</span></li>`;
  }
  function specListHtml(){
    const newCount = all.filter(isNew).length;
    return `
      <li role="button" tabindex="0" data-filter="featured">★ Featured <span class="n">${featList.length}</span></li>
      <li role="button" tabindex="0" data-filter="ai">✦ AI-native <span class="n">${aiCount}</span></li>
      <li role="button" tabindex="0" data-filter="new">+ New <span class="n">${newCount}</span></li>`;
  }
  function tagListHtml(){
    const tagCounts = {};
    all.forEach(x=>(x.tags||[]).forEach(t=>tagCounts[t]=(tagCounts[t]||0)+1));
    return Object.entries(tagCounts).sort((a,b)=>b[1]-a[1])
        .map(([t,n])=>`<li role="button" tabindex="0" data-tag="${esc(t)}">${esc(t)} <span class="n">${n}</span></li>`).join('');
  }

  // Populate both containers. They're selector-distinct (#typeList vs #mfType).
  // CSS hides whichever container doesn't belong to the current breakpoint.
  function buildFilterLists(){
    const typeD = document.getElementById('typeList');
    const specD = document.getElementById('specList');
    const tagD  = document.getElementById('tagList');
    const typeM = document.getElementById('mfType');
    const specM = document.getElementById('mfSpec');
    const tagM  = document.getElementById('mfTags');
    if(typeD) typeD.innerHTML = typeListHtml();
    if(specD) specD.innerHTML = specListHtml();
    if(tagD)  tagD.innerHTML  = tagListHtml();
    if(typeM) typeM.innerHTML = typeListHtml();
    if(specM) specM.innerHTML = specListHtml();
    if(tagM)  tagM.innerHTML  = tagListHtml();
    reflectSelection();
  }

  function reflectSelection(){
    // Update BOTH desktop and mobile copies so state is visually consistent.
    document.querySelectorAll('[data-type]').forEach(li=>{
      li.classList.toggle('on', li.dataset.type===state.type);
    });
    document.querySelectorAll('[data-filter]').forEach(li=>{
      li.classList.toggle('on', !!state.filter && li.dataset.filter===state.filter);
    });
    document.querySelectorAll('[data-tag]').forEach(li=>{
      li.classList.toggle('on', !!state.tag && li.dataset.tag===state.tag);
    });
  }

  buildFilterLists();

  // Count of active filters — shown as a dot on the burger button.
  function activeFilterCount(){
    let n = 0;
    if(state.type!=='all') n++;
    if(state.filter) n++;
    if(state.tag) n++;
    if(state.search) n++;
    return n;
  }
  function updateBurgerDot(){
    const b = document.getElementById('burger');
    const d = document.getElementById('burgerDot');
    if(!b || !d) return;
    const n = activeFilterCount();
    d.textContent = n;
    b.classList.toggle('has-filters', n>0);
  }

  // ── Drawer open/close ──
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const burger = document.getElementById('burger');
  let lastFocusedBeforeDrawer = null;

  function openDrawer(){
    lastFocusedBeforeDrawer = document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    // next frame so display change doesn't swallow the transition
    requestAnimationFrame(()=>{
      drawer.classList.add('open');
      backdrop.classList.add('open');
    });
    drawer.setAttribute('aria-hidden','false');
    burger.setAttribute('aria-expanded','true');
    document.body.classList.add('drawer-open');
    // Focus first focusable in drawer
    setTimeout(()=>{
      const firstInput = document.getElementById('srchMobile');
      if(firstInput) firstInput.focus();
    }, 250);
  }
  function closeDrawer(opts){
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    burger.setAttribute('aria-expanded','false');
    document.body.classList.remove('drawer-open');
    // Match transition duration before hiding
    setTimeout(()=>{
      drawer.hidden = true;
      backdrop.hidden = true;
    }, 250);
    if(lastFocusedBeforeDrawer && !(opts && opts.skipRefocus)) {
      try { lastFocusedBeforeDrawer.focus(); } catch(e){}
    }
  }

  burger.addEventListener('click', ()=>{
    const isOpen = drawer.classList.contains('open');
    if(isOpen) closeDrawer(); else openDrawer();
  });
  document.getElementById('drawerClose').addEventListener('click', ()=>closeDrawer());
  backdrop.addEventListener('click', ()=>closeDrawer());

  // Escape to close, basic focus trap while open.
  document.addEventListener('keydown', e=>{
    if(!drawer.classList.contains('open')) return;
    if(e.key==='Escape'){ e.preventDefault(); closeDrawer(); return; }
    if(e.key==='Tab'){
      const focusables = drawer.querySelectorAll('input, button, [tabindex="0"]');
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  });

  // Close drawer if viewport grows past mobile threshold (drawer is meaningless at desktop)
  MOBILE_Q.addEventListener('change', e=>{
    if(!e.matches && drawer.classList.contains('open')) closeDrawer({skipRefocus:true});
  });

  // ── Helpers for applying filters from either surface ──
  function scrollToBrowse(){
    const el = document.getElementById('browse');
    if(!el) return;
    // account for sticky header
    const y = el.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({top:y, behavior:'smooth'});
  }

  function applyAndClose(opts){
    reflectSelection();
    updateBurgerDot();
    apply();
    if(MOBILE_Q.matches && drawer.classList.contains('open')){
      closeDrawer({skipRefocus:true});
      // After drawer slides out, scroll to browse so user sees the filtered result.
      setTimeout(()=>scrollToBrowse(), 260);
    }
  }

  // Delegated click on filter li elements.
  // Works for #typeList/#specList/#tagList AND #mfType/#mfSpec/#mfTags.
  function onFilterClick(e){
    const li = e.target.closest('li[role="button"]');
    if(!li) return;
    // Only act if inside a known filter list
    const inDesktop = li.closest('#typeList, #specList, #tagList');
    const inMobile = li.closest('#mfType, #mfSpec, #mfTags');
    if(!inDesktop && !inMobile) return;

    if(li.dataset.type){
      state.type = li.dataset.type;
    } else if(li.dataset.filter){
      state.filter = (state.filter===li.dataset.filter) ? null : li.dataset.filter;
    } else if(li.dataset.tag){
      state.tag = (state.tag===li.dataset.tag) ? null : li.dataset.tag;
    } else {
      return;
    }
    state.limit = 48;
    applyAndClose();
  }
  document.body.addEventListener('click', onFilterClick);

  // Keyboard: Enter/Space on role=button li
  document.body.addEventListener('keydown', e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const li = e.target.closest('li[role="button"]');
    if(!li) return;
    const inFilter = li.closest('#typeList, #specList, #tagList, #mfType, #mfSpec, #mfTags');
    if(!inFilter) return;
    e.preventDefault();
    li.click();
  });

  // Sort pills
  document.querySelectorAll('.pill-btn[data-sort]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.pill-btn[data-sort]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); state.sort=b.dataset.sort; apply();
  }));

  // ── Search (desktop header + mobile drawer) ──
  function syncSearchInputs(v, source){
    const a = document.getElementById('srch');
    const b = document.getElementById('srchMobile');
    if(source!==a && a && a.value!==v) a.value = v;
    if(source!==b && b && b.value!==v) b.value = v;
  }
  function onSearchInput(e){
    state.search = e.target.value;
    state.limit = 48;
    syncSearchInputs(state.search, e.target);
    updateBurgerDot();
    apply();
  }
  const srchEl = document.getElementById('srch');
  if(srchEl) srchEl.addEventListener('input', onSearchInput);
  const srchElM = document.getElementById('srchMobile');
  if(srchElM){
    srchElM.addEventListener('input', onSearchInput);
    // Pressing Enter in the mobile search closes the drawer and jumps to results.
    srchElM.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        closeDrawer({skipRefocus:true});
        setTimeout(()=>scrollToBrowse(), 260);
      }
    });
  }

  // Clear controls
  document.getElementById('clearFilter').addEventListener('click',()=>{
    state.filter=null; state.tag=null;
    reflectSelection(); updateBurgerDot(); apply();
  });
  document.getElementById('filterBannerClear').addEventListener('click',()=>{
    state.type='all'; state.filter=null; state.tag=null; state.search='';
    syncSearchInputs('', null);
    reflectSelection(); updateBurgerDot(); apply();
  });
  document.getElementById('drawerClear').addEventListener('click',()=>{
    state.type='all'; state.filter=null; state.tag=null; state.search='';
    syncSearchInputs('', null);
    reflectSelection(); updateBurgerDot(); apply();
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
    const visibleCount = Math.min(list.length, state.limit);
    set('browseCount', visibleCount);
    const lm = document.getElementById('loadmore');
    lm.style.display = list.length > visibleCount ? '' : 'none';
    lm.textContent = `Load more ▾  (${list.length - visibleCount} remaining)`;

    // Desktop-side filter label
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

    // Mobile-friendly filter banner above the grid
    const banner = document.getElementById('filterBanner');
    const bannerText = document.getElementById('filterBannerText');
    const summary = [];
    if(state.type!=='all') summary.push(state.type.toUpperCase()+'S');
    if(state.filter) summary.push(state.filter.toUpperCase());
    if(state.tag) summary.push(state.tag.toUpperCase());
    if(state.search) summary.push(`SEARCH: "${state.search}"`);
    if(summary.length){
      bannerText.textContent = summary.join(' · ');
      banner.classList.add('vis');
    } else {
      banner.classList.remove('vis');
    }

    // SEO: render ALL matched items, hide overflow.
    render(list, visibleCount);
  }

  function render(list, visibleCount){
    if(!list.length){
      html('cards', `<div class="empty" style="grid-column:1/-1">GAME OVER<br><span class="sub">No entries match · try clearing filters</span></div>`);
      return;
    }
    html('cards', list.map((x,i)=>{
      const tags = [];
      tags.push(`<span class="cab-tag ${x.type}">${x.type.toUpperCase()}</span>`);
      if(x.aiPowered) tags.push('<span class="cab-tag ai">AI</span>');
      if(x.featured) tags.push('<span class="cab-tag star">★</span>');
      if(isNew(x)) tags.push('<span class="cab-tag new">NEW</span>');
      const cat = (x.tags||[])[0] || '';
      const hiddenCls = i >= visibleCount ? ' hidden' : '';
      return `<a class="cab${hiddenCls}" href="${href(x)}" target="_blank" rel="noopener" aria-label="${esc(x.title)}">
        <div class="cab-img">
          <div class="cab-corner">${tags.join('')}</div>
          <img src="${img(x)}" alt="${esc(x.title)}" width="320" height="200" loading="lazy">
        </div>
        <div class="cab-body">
          <div class="cab-title">${clean(x.title)}</div>
          <div class="cab-desc">${esc(desc(x))}</div>
          <div class="cab-footer">
            <span class="cat">${esc(cat)}</span>
            <span class="play">▶ OPEN</span>
          </div>
        </div>
      </a>`;
    }).join(''));
  }

  // ── Toolshed ─────────
  const toolsSorted = [...tools].sort((a,b)=>a.title.localeCompare(b.title));
  html('ledger', toolsSorted.map((x,i)=>{
    const cat = (x.tags||[])[0] || '—';
    return `<a class="ledger-row" href="${href(x)}" target="_blank" rel="noopener" aria-label="${esc(x.title)}">
      <span class="idx">${String(i+1).padStart(3,'0')}</span>
      <span class="t">${clean(x.title)}</span>
      <span class="c">${esc(cat)}</span>
      <span class="go">OPEN ↗</span>
    </a>`;
  }).join(''));

  // ── Random ─────────
  const lucky = ()=>{const x=all[Math.floor(Math.random()*all.length)];window.open(href(x),'_blank')};
  const lb1 = document.getElementById('luckyBtn');   if(lb1) lb1.addEventListener('click',lucky);
  const lb2 = document.getElementById('luckyBtn2');  if(lb2) lb2.addEventListener('click',lucky);
  const lbM = document.getElementById('luckyBtnM');  if(lbM) lbM.addEventListener('click',()=>{lucky(); closeDrawer({skipRefocus:true});});

  // keyboard shortcut /
  document.addEventListener('keydown',e=>{
    if(e.key==='/' && document.activeElement.tagName!=='INPUT'){
      e.preventDefault();
      if(MOBILE_Q.matches){
        openDrawer();
      } else {
        const target = document.getElementById('srch');
        if(target) target.focus();
      }
    }
  });

  set('hiScoreRow', `RECENT · ${recent[0]?clean(recent[0].title).toUpperCase():'—'}`);

  apply();
  updateBurgerDot();

  // ── Tweaks ─────────
  const TWEAKS=/*EDITMODE-BEGIN*/{"accent":"#ffc857","scanlines":"on","density":"dense","hstyle":"pixel"}/*EDITMODE-END*/;
  const accents=[{n:'Amber',c:'#ffc857'},{n:'Coin-op Red',c:'#ff4d2e'},{n:'Neon Cyan',c:'#4ee1d2'},{n:'Lime',c:'#b4f04a'},{n:'Magenta',c:'#ff3ca1'}];
  function applyTweaks(t){
    document.documentElement.style.setProperty('--amber',t.accent);
    const c=document.getElementById('cards');
    c.style.gridTemplateColumns = t.density==='cozy'?'repeat(auto-fill,minmax(280px,1fr))':t.density==='compact'?'repeat(auto-fill,minmax(170px,1fr))':'repeat(auto-fill,minmax(210px,1fr))';
    if(t.scanlines==='off') document.body.classList.add('noscan'); else document.body.classList.remove('noscan');
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