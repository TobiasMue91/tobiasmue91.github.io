// Time travel: the bar at the foot of the home page that shows gptgames.dev as it
// looked on an earlier day. The days come from timeline_data.json (util/timeline.py
// builds it from git); each one is a commit, and its pages are loaded straight from
// that commit into a frame over the live page. On a game or tool the slider can walk
// through that one page instead, commit by commit, from timeline_pages.json.
(function () {
    if (window !== window.top || window.__timeTravel) return;

    const REPO = 'TobiasMue91/tobiasmue91.github.io';
    // raw.githubusercontent.com serves every file as text/plain with nosniff, so a
    // page based there can fetch its JSON but not run a single script or stylesheet
    // of its own — which is why the home page stopped listing anything once it moved
    // to arcade.js and data/*.json. jsDelivr serves the same commit with real content
    // types, so it is the <base> of the page; raw is only a fallback for the HTML,
    // which is fetched as text either way.
    const CDN_HOST = 'https://cdn.jsdelivr.net/';
    const cdnRoot = hash => `${CDN_HOST}gh/${REPO}@${hash}/`;
    const rawRoot = hash => `https://raw.githubusercontent.com/${REPO}/${hash}/`;
    // Scripts that must not run in the past: this bar itself, the service worker,
    // the old chatbot and the old visitor counter.
    const STRIP_SCRIPT = /(^|\/)(timeline|sw|chatbot)\.js(\?|$)|gc\.zgo\.at|goatcounter/;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let points = [];        // oldest first; the last one is the live site
    let index = 0;          // the day the slider stands on; in page mode the day the version came from
    let shownIndex = -1;    // the point the frame shows, -1 while on the live site
    let path = 'index.html';
    // Page mode: on a page with several versions the slider walks through those.
    let scope = 'page';     // what the visitor last chose to walk through there: 'page' or 'site'
    let versions = null;    // the versions of the page on show, oldest first; null on the home page
    let versionsOf = null;  // the path they were looked up for
    let version = -1;       // the version the slider stands on, -1 if the page did not exist yet
    let shownVersion = -1;  // the version the frame shows, -1 when it shows a day
    let wantVersion = null; // a hash from the address bar, until the versions are known
    let moment = 0;         // the time on show, in ms; a new page opens at its version of that time
    let marks = null;       // what the slider's marks were last drawn for
    let pagesRequest = null;
    let frame = null;
    let request = 0;
    let travelTimer = null;
    const cache = new Map();

    const $ = id => document.getElementById(id);

    // A trip lives in the address bar as ?travel=2025-03-01&page=games/snake.html, so
    // the browser's Back and Forward walk through it and a reload lands in it again.
    // arcade.js tidies the URL as soon as it runs, so it is read now, before that.
    const initialParams = new URLSearchParams(location.search);
    const initialState = history.state || {};

    window.__timeTravel = {open: openPath, exit: exit};
    const SCOPE_KEY = 'timeTravelScope';
    try {
        if (localStorage.getItem(SCOPE_KEY) === 'site') scope = 'site';
    } catch (e) { /* no storage, no memory */
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function init() {
        fetch('timeline_data.json')
            .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
            .then(data => {
                points = data.filter(p => p.hash && p.GptVersion !== 'CURRENT')
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                if (!points.length) return;
                points.push({live: true, timestamp: new Date().toISOString(), GptVersion: null});
                index = points.length - 1;
                build();
                resumeFromURL();
            })
            .catch(error => console.warn('Time travel unavailable:', error));
    }

    // ---------- The bar ----------

    function build() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = 'tt';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Time travel');
        bar.innerHTML = `
            <button type="button" id="tt-tab" aria-expanded="false" aria-controls="tt-panel" title="See this site as it looked on an earlier day">
                <span aria-hidden="true">⏱</span> <span id="tt-tab-label">Time travel</span></button>
            <div id="tt-panel" hidden>
                <div class="tt-row">
                    <button type="button" class="tt-step" id="tt-prev" title="Previous snapshot" aria-label="Previous snapshot">◀</button>
                    <div class="tt-track">
                        <div class="tt-models" aria-hidden="true"></div>
                        <input type="range" id="tt-range" min="0" max="${points.length - 1}" step="1" value="${index}" aria-label="Date to travel to">
                        <div class="tt-years" aria-hidden="true"></div>
                    </div>
                    <button type="button" class="tt-step" id="tt-next" title="Next snapshot" aria-label="Next snapshot">▶</button>
                </div>
                <div class="tt-row tt-info">
                    <span id="tt-date"></span>
                    <span id="tt-count"></span>
                    <span id="tt-model"></span>
                    <span id="tt-where"></span>
                    <span id="tt-status" role="status" aria-live="polite"></span>
                    <span id="tt-scope" role="group" aria-label="What the slider walks through" hidden>
                        <button type="button" data-scope="site" title="Step through the days of the whole site">Whole site</button>
                        <button type="button" data-scope="page" title="Step through every version of this page"></button>
                    </span>
                    <span class="tt-actions">
                        <button type="button" id="tt-back" hidden>↩ Back</button>
                        <a id="tt-commit" target="_blank" rel="noopener" hidden>Commit ↗</a>
                        <button type="button" id="tt-exit" hidden>✕ Back to today</button>
                    </span>
                    <span id="tt-message" hidden></span>
                </div>
            </div>`;
        document.body.appendChild(bar);
        const models = bar.querySelector('.tt-models');

        $('tt-tab').addEventListener('click', () => setOpen($('tt-panel').hidden));
        const range = $('tt-range');
        range.addEventListener('input', () => {
            const i = Number(range.value);
            if (pageMode()) version = i;
            else index = i;
            showReadout();
            clearTimeout(travelTimer);
            travelTimer = setTimeout(() => go(i), 300);
        });
        range.addEventListener('change', () => go(Number(range.value)));
        $('tt-scope').addEventListener('click', e => {
            const button = e.target.closest('[data-scope]');
            if (button) setScope(button.dataset.scope);
        });
        $('tt-prev').addEventListener('click', () => step(-1));
        $('tt-next').addEventListener('click', () => step(1));
        $('tt-exit').addEventListener('click', leave);
        $('tt-back').addEventListener('click', () => history.back());
        models.addEventListener('click', e => {
            const tag = e.target.closest('[data-i]');
            if (tag) go(Number(tag.dataset.i));
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && shownIndex >= 0) leave();
        });
        window.addEventListener('popstate', () => followURL(new URLSearchParams(location.search)));
        window.addEventListener('resize', () => {
            layoutMarks();
            fitFrame();
        });
        showReadout();
    }

    // The slider thumb is 16px wide, so stop i of n sits that far in from either end.
    function pct(i, n) {
        return `calc(8px + (100% - 16px) * ${i / (n - 1)})`;
    }

    // The slider walks through the days of the site, or through the versions of the
    // page on show; its range and its marks (years, model names) follow.
    function syncSlider() {
        const range = $('tt-range');
        const page = pageMode();
        const stops = page ? versions : points;
        const key = page ? 'page:' + versionsOf : 'site';
        range.max = stops.length - 1;
        range.value = page ? version : index;
        range.setAttribute('aria-label', page ? 'Version of this page' : 'Date to travel to');
        if (key === marks) return;
        marks = key;
        const years = document.querySelector('#tt .tt-years');
        const models = document.querySelector('#tt .tt-models');
        years.textContent = models.textContent = '';
        let lastYear = null;
        let lastModel = null;
        stops.forEach((p, i) => {
            if (p.live === true) return;
            const year = new Date(p.timestamp).getFullYear();
            if (year !== lastYear) {
                lastYear = year;
                const tick = document.createElement('span');
                tick.textContent = year;
                tick.style.left = pct(i, stops.length);
                years.appendChild(tick);
            }
            // A day names the model that arrived on it; a version the model it was made
            // in, wherever that changes from the version before.
            const model = page ? modelAtTime(p.t) : p.GptVersion;
            if (model && model !== lastModel) {
                const tag = document.createElement('span');
                tag.textContent = model;
                tag.style.left = pct(i, stops.length);
                tag.dataset.i = i;
                models.appendChild(tag);
            }
            if (page) lastModel = model;
        });
        if (!$('tt-panel').hidden) layoutMarks();
    }

    // Each model name takes the lowest lane where it overlaps no other, and the
    // track grows to fit however many lanes that needs.
    function layoutMarks() {
        const laneEnds = [];
        const tags = document.querySelectorAll('#tt .tt-models span');
        tags.forEach(tag => {
            const left = tag.offsetLeft - tag.offsetWidth / 2;
            let lane = laneEnds.findIndex(end => left > end + 8);
            if (lane < 0) lane = laneEnds.length;
            laneEnds[lane] = left + tag.offsetWidth;
            tag.dataset.lane = lane;
        });
        // Measured from the foot of the track: year row, then the slider, then the lanes.
        const above = 16 + $('tt-range').offsetHeight + 3;
        tags.forEach(tag => {
            tag.style.bottom = (above + tag.dataset.lane * 12) + 'px';
        });
        document.querySelector('#tt .tt-track').style.paddingTop = (12 + laneEnds.length * 12) + 'px';
        // Years close together (few snapshots between them) show only the first.
        let yearEnd = -Infinity;
        document.querySelectorAll('#tt .tt-years span').forEach(year => {
            year.style.visibility = '';
            const left = year.offsetLeft - year.offsetWidth / 2;
            if (left < yearEnd + 6) year.style.visibility = 'hidden';
            else yearEnd = left + year.offsetWidth;
        });
    }

    function setOpen(open) {
        $('tt-panel').hidden = !open;
        $('tt-tab').setAttribute('aria-expanded', String(open));
        $('tt').classList.toggle('open', open);
        if (open) {
            layoutMarks();
            $('tt-range').focus();
        }
        fitFrame();
    }

    function step(delta) {
        if (pageMode()) go(Math.max(0, Math.min(versions.length - 1, version + delta)));
        else go(Math.max(0, Math.min(points.length - 1, index + delta)));
    }

    function go(i) {
        return pageMode() ? jumpVersion(i) : jump(i);
    }

    // A new day replaces the current history entry (scrubbing through a year should
    // not take a year of Back presses to undo); only the step into the past pushes.
    function jump(i) {
        clearTimeout(travelTimer);
        if (points[i].live) return leave();
        index = i;
        $('tt-range').value = i;
        if (i === shownIndex && shownVersion < 0 && tripDepth() > 0) return showReadout();
        moment = Date.parse(points[i].timestamp);
        version = versions ? versionAt(moment) : -1;
        record(tripDepth() > 0 ? 'replace' : 'push');
        showReadout();
        travel();
    }

    // Page mode is only ever reached inside a trip, so a version never starts one.
    function jumpVersion(k) {
        clearTimeout(travelTimer);
        version = k;
        moment = versions[k].live;
        index = dayIndex(liveDay(versions[k]));
        $('tt-range').value = k;
        if (k === shownVersion) return showReadout();
        record('replace');
        showReadout();
        travel();
    }

    // Choosing what the slider walks through reloads the frame from that: the day
    // holds whatever the page had become by its end, the version only itself.
    function setScope(next) {
        if (next === scope && (next === 'site' || pageMode())) return;
        scope = next;
        try {
            localStorage.setItem(SCOPE_KEY, scope);
        } catch (e) { /* remembered for this visit only */
        }
        if (scope === 'page' && versions && version < 0) version = 0;
        if (scope === 'page' && pageMode()) moment = versions[version].live;
        record('replace');
        showReadout();
        travel();
    }

    function pageMode() {
        return scope === 'page' && versions !== null && versions.length > 1 && version >= 0;
    }

    // The last version that had reached the site by then.
    function versionAt(time) {
        let k = -1;
        versions.forEach((v, i) => {
            if (v.live <= time) k = i;
        });
        return k;
    }

    // The first day of the site on or after this one; the last one if none is.
    function dayIndex(day) {
        const i = points.findIndex(p => !p.live && dayOf(p) >= day);
        return i < 0 ? points.length - 2 : i;
    }

    function formatDate(p) {
        const d = new Date(p.timestamp);
        return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }

    // The model a point was built with is the last one named at or before it.
    function modelAt(i) {
        for (let j = i; j >= 0; j--) {
            if (points[j].GptVersion) return points[j].GptVersion;
        }
        return null;
    }

    // The same for a moment in between: the last model named on or before its day.
    function modelAtTime(time) {
        const day = new Date(time).toISOString().slice(0, 10);
        let model = null;
        points.forEach(p => {
            if (!p.live && p.GptVersion && dayOf(p) <= day) model = p.GptVersion;
        });
        return model;
    }

    function showReadout() {
        syncSlider();
        const page = pageMode();
        const p = page ? versions[version] : points[index];
        const date = p.live === true ? 'Today' : formatDate(p);
        $('tt-date').textContent = date;
        $('tt-count').textContent = page ? `Version ${version + 1} of ${versions.length}` : '';
        const model = p.live === true ? null : page ? modelAtTime(p.t) : modelAt(index);
        $('tt-model').textContent = model ? model + ' era' : '';
        $('tt-range').setAttribute('aria-valuetext', p.live === true ? 'Today, the live site' :
            page ? `${date}, version ${version + 1} of ${versions.length}: ${p.message}` : date);
        const last = page ? versions.length - 1 : points.length - 1;
        $('tt-prev').disabled = (page ? version : index) === 0;
        $('tt-next').disabled = (page ? version : index) === last;
        [['tt-prev', 'Previous'], ['tt-next', 'Next']].forEach(([id, word]) => {
            const label = `${word} ${page ? 'version' : 'snapshot'}`;
            $(id).title = label;
            $(id).setAttribute('aria-label', label);
        });
        $('tt-where').textContent = shownIndex >= 0 && path !== 'index.html' ? '/' + (page ? p.path : path) : '';
        const message = $('tt-message');
        message.hidden = !page;
        message.textContent = page ? p.message : '';
        message.title = page ? p.message : '';
        const toggle = $('tt-scope');
        toggle.hidden = !(shownIndex >= 0 && versions && versions.length > 1);
        if (versions) toggle.querySelector('[data-scope="page"]').textContent = `This page · ${versions.length} versions`;
        toggle.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === (page ? 'page' : 'site'))));
        $('tt-back').hidden = !(shownIndex >= 0 && tripDepth() > 1);
        $('tt-exit').hidden = shownIndex < 0;
        const commit = $('tt-commit');
        commit.hidden = p.live === true;
        if (p.live !== true) commit.href = `https://github.com/${REPO}/commit/${p.hash}`;
        const shown = shownVersion >= 0 && versions ? versions[shownVersion] : points[shownIndex];
        $('tt-tab-label').textContent = shownIndex >= 0 ? 'Time travel · ' + formatDate(shown) : 'Time travel';
        document.querySelectorAll('#tt .tt-models span').forEach(tag => {
            tag.classList.toggle('on', tag.textContent === model);
        });
        fitFrame();
    }

    function setStatus(text, isError) {
        const el = $('tt-status');
        el.textContent = text || '';
        el.classList.toggle('err', !!isError);
    }

    // ---------- Travelling ----------

    // Called from inside the frame when a link there leads to another page of the site.
    function openPath(target) {
        let p = String(target || '').split(/[?#]/)[0].replace(/^\/+/, '');
        try {
            p = decodeURIComponent(p);
        } catch (e) { /* keep it as it is */
        }
        if (!p || p.endsWith('/')) p += 'index.html';
        if (shownIndex < 0 || p === path) return;
        path = p;
        versions = null;
        version = -1;
        record('push');
        showReadout();
        travel();
    }

    // ---------- History ----------

    function dayOf(p) {
        return p.timestamp.slice(0, 10);
    }

    // The day a version reached the site, which for a pull request is its merge.
    function liveDay(v) {
        return new Date(v.live).toISOString().slice(0, 10);
    }

    // How many entries of the current trip lie at and behind this one; 0 on the live site.
    function tripDepth() {
        return (history.state && history.state.ttDepth) || 0;
    }

    // The live URL (arcade.js's filters and all) plus the trip, or without it for null.
    // In page mode the trip names its version too: ?travel=…&page=…&v=<commit>. The day
    // stays the one of the site, so a page opened from 22 Apr is still of 22 Apr for
    // the home page and the whole-site slider until the page's own slider moves.
    function tripURL(i) {
        const url = new URL(location.href);
        ['travel', 'page', 'v'].forEach(key => url.searchParams.delete(key));
        if (i !== null) {
            url.searchParams.set('travel', dayOf(points[i]));
            if (path !== 'index.html') url.searchParams.set('page', path);
            if (pageMode()) url.searchParams.set('v', versions[version].hash.slice(0, 12));
        }
        return url.pathname + url.search.replace(/%2F/gi, '/') + url.hash;
    }

    // ttRooted: the trip began on the live page in this tab, so the live entry lies
    // right behind its first step.
    function record(mode, state) {
        const now = history.state || {};
        state = state || (mode === 'push' ?
            {ttDepth: tripDepth() + 1, ttRooted: tripDepth() > 0 ? !!now.ttRooted : true} :
            {ttDepth: Math.max(tripDepth(), 1), ttRooted: !!now.ttRooted});
        history[mode === 'push' ? 'pushState' : 'replaceState'](state, '', tripURL(index));
    }

    // Back to today steps back past the whole trip, so Forward can return to it. A
    // trip opened from a shared link has nothing behind it; there the entry is rewritten.
    function leave() {
        if (tripDepth() > 0 && history.state.ttRooted) {
            history.go(-tripDepth());
        } else {
            history.replaceState(null, '', tripURL(null));
            exit();
        }
    }

    // After Back or Forward (or on arrival), show whatever the address bar says. A
    // version in it puts the bar in page mode; without one the page opens as the
    // visitor last chose, at the version of that day.
    function followURL(params) {
        const day = params.get('travel');
        const i = day ? points.findIndex(p => !p.live && dayOf(p) >= day) : -1;
        if (i < 0) {
            exit();
            return false;
        }
        clearTimeout(travelTimer);
        index = i;
        moment = Date.parse(points[i].timestamp);
        const next = params.get('page') || 'index.html';
        if (next !== path) versions = null;
        path = next;
        wantVersion = params.get('v');
        if (wantVersion) scope = 'page';
        if (versions) pickVersion();
        travel();
        showReadout();
        return true;
    }

    function resumeFromURL() {
        if (!initialParams.has('travel')) return;
        // arcade.js has rewritten this entry by now and dropped the trip from it.
        if (followURL(initialParams)) {
            record('replace', {ttDepth: Math.max(initialState.ttDepth || 0, 1), ttRooted: !!initialState.ttRooted});
            setOpen(true);
        } else {
            history.replaceState(null, '', tripURL(null));
        }
    }

    // Loads what the slider stands on: a version of the page in page mode, else the
    // page as it was on the day. A page's versions are looked up first, so that one
    // opened from a day comes up in page mode.
    function travel() {
        const i = index;
        if (points[i].live) return exit();
        const token = ++request;
        setStatus('Travelling…');
        lookUpVersions().then(() => {
            if (token !== request) return;
            const k = pageMode() ? version : -1;
            // The address bar may have been written before the versions were known.
            if (k >= 0) history.replaceState(history.state, '', tripURL(index));
            showReadout();
            const p = k >= 0 ? versions[k] : points[index];
            return load(p.hash, k >= 0 ? p.path : path).then(html => {
                if (token !== request) return;
                show(index, k, html);
                setStatus('');
            }, error => {
                if (token !== request) return;
                if (error.missing && path !== 'index.html') {
                    show(index, -1, missingPage());
                    setStatus('');
                } else {
                    console.error('Time travel failed:', error);
                    setStatus(error.missing ? 'Nothing to show for this day.' : 'Could not load this day — try again.', true);
                }
            });
        });
    }

    // timeline_pages.json is only fetched once a trip leaves the home page. Without it
    // every page simply travels by day.
    function loadPages() {
        if (!pagesRequest) {
            pagesRequest = fetch('timeline_pages.json')
                .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
                .catch(error => {
                    console.warn('Page versions unavailable:', error);
                    return {};
                });
        }
        return pagesRequest;
    }

    function lookUpVersions() {
        if (path === 'index.html') {
            versions = versionsOf = null;
            version = -1;
            return Promise.resolve();
        }
        if (versions && versionsOf === path) return Promise.resolve();
        const wanted = path;
        return loadPages().then(pages => {
            if (path !== wanted) return;
            let key = path;
            let rows = pages[key];
            if (typeof rows === 'string') rows = pages[key = rows];
            versions = Array.isArray(rows) ? rows.map(([hash, timestamp, message, extra]) => ({
                hash, timestamp, message,
                t: Date.parse(timestamp),
                live: Date.parse((extra && extra.live) || timestamp),
                path: (extra && extra.path) || key
            })) : null;
            versionsOf = path;
            pickVersion();
        });
    }

    // Which version a page opens at: the one the address bar names, or the one that
    // was on the site at the moment on show; failing that the one of the day.
    function pickVersion() {
        version = -1;
        if (!versions) return;
        if (wantVersion) version = versions.findIndex(v => v.hash.startsWith(wantVersion));
        wantVersion = null;
        if (version < 0) version = versionAt(moment);
        if (version < 0) version = versionAt(Date.parse(points[index].timestamp));
    }

    function load(hash, file) {
        const key = hash + '/' + file;
        if (cache.has(key)) return Promise.resolve(cache.get(key));
        const get = url => fetch(url).then(r => {
            if (r.ok) return r.text();
            const error = new Error(`${r.status} for ${url}`);
            error.missing = r.status === 404;
            throw error;
        });
        const url = encodeURI(file);
        return get(cdnRoot(hash) + url).catch(error => get(rawRoot(hash) + url).catch(() => {
            throw error;
        })).then(html => {
            const prepared = prepare(html, hash, file);
            cache.set(key, prepared);
            if (cache.size > 40) cache.delete(cache.keys().next().value);
            return prepared;
        });
    }

    // Rewrites a historical page so it can run from inside the frame.
    function prepare(html, hash, file) {
        const root = cdnRoot(hash);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script[src]').forEach(s => {
            if (STRIP_SCRIPT.test(s.getAttribute('src'))) s.remove();
        });
        doc.querySelectorAll('base').forEach(b => b.remove());
        // A path from the site root ("/tools/x.html") would land on jsDelivr's own root.
        doc.querySelectorAll('[src], [href]').forEach(el => {
            ['src', 'href'].forEach(attr => {
                const v = el.getAttribute(attr);
                if (v && v.charAt(0) === '/' && v.charAt(1) !== '/') el.setAttribute(attr, root + v.slice(1));
            });
        });
        const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
        const base = doc.createElement('base');
        base.href = root + dir;
        const shim = doc.createElement('script');
        shim.textContent = `(${frameShim.toString()})(${JSON.stringify(root)}, ${JSON.stringify(CDN_HOST)});`;
        doc.head.prepend(base, shim);
        return (doc.doctype ? '<!DOCTYPE html>\n' : '') + doc.documentElement.outerHTML;
    }

    function missingPage() {
        const p = points[index];
        const esc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0b14;color:#f5ecd4;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:20px;box-sizing:border-box}
            code{color:#4ee1d2}button{margin-top:14px;font:inherit;padding:8px 16px;border:2px solid #ffc857;background:none;color:#ffc857;cursor:pointer}
            </style></head><body><div><p><code>/${esc(path)}</code> did not exist yet on ${esc(formatDate(p))}.</p>
            <button type="button" onclick="parent.__timeTravel.open('index.html')">Go to the home page of that day</button></div></body></html>`;
    }

    function show(i, k, html) {
        // A fresh frame each time: reusing one would keep the old page's timers running.
        const next = document.createElement('iframe');
        next.id = 'tt-frame';
        next.title = 'gptgames.dev on ' + formatDate(k >= 0 ? versions[k] : points[i]);
        next.srcdoc = html;
        document.body.appendChild(next);
        if (frame) frame.remove();
        frame = next;
        shownIndex = i;
        shownVersion = k;
        document.documentElement.classList.add('tt-travelling');
        fitFrame();
        showReadout();
    }

    function exit() {
        clearTimeout(travelTimer);
        request++;
        if (frame) frame.remove();
        frame = null;
        shownIndex = -1;
        shownVersion = -1;
        path = 'index.html';
        versions = versionsOf = null;
        version = -1;
        index = points.length - 1;
        $('tt-range').value = index;
        document.documentElement.classList.remove('tt-travelling');
        setStatus('');
        showReadout();
    }

    // The frame ends where the open bar begins, so the bar covers none of the page.
    function fitFrame() {
        const bar = $('tt');
        const covered = bar && bar.classList.contains('open') ? $('tt-panel').offsetHeight : 0;
        document.documentElement.style.setProperty('--tt-h', covered + 'px');
    }

    // Runs inside the frame before any of the historical page's own scripts. It is
    // injected as source, so it may only use what it is given.
    function frameShim(root, cdnHost) {
        var tt = parent.__timeTravel;

        // Paths from the site root go to the snapshot, not to jsDelivr's own root.
        function toRoot(url) {
            return typeof url === 'string' && url.charAt(0) === '/' && url.charAt(1) !== '/' ? root + url.slice(1) : url;
        }

        // The page of the site a URL points at, or null for anywhere else.
        function route(url) {
            if (url.indexOf(root) === 0) return url.slice(root.length);
            var m = /^https?:\/\/(?:www\.)?(?:gptgames\.dev|tobiasmue91\.github\.io)(\/[^?#]*)?/i.exec(url);
            if (m) return (m[1] || '/').slice(1);
            if (url.indexOf(cdnHost) === 0 && url.indexOf(cdnHost + 'gh/') !== 0) return url.slice(cdnHost.length);
            return null;
        }

        // pushState and replaceState resolve their URL against <base>, another origin,
        // and throw. Keep the state, drop the URL, and leave the visitor's history alone.
        var replaceState = history.replaceState;
        history.pushState = history.replaceState = function (state, title) {
            try {
                replaceState.call(history, state, title);
            } catch (e) { /* nothing to keep */
            }
        };

        // The past gets storage of its own, empty on every trip, so it can neither
        // read nor overwrite what the live site keeps there.
        function memoryStorage() {
            var data = Object.create(null);
            return {
                get length() {
                    return Object.keys(data).length;
                },
                key: function (i) {
                    var k = Object.keys(data)[i];
                    return k === undefined ? null : k;
                },
                getItem: function (k) {
                    k = String(k);
                    return k in data ? data[k] : null;
                },
                setItem: function (k, v) {
                    data[String(k)] = String(v);
                },
                removeItem: function (k) {
                    delete data[String(k)];
                },
                clear: function () {
                    data = Object.create(null);
                }
            };
        }

        ['localStorage', 'sessionStorage'].forEach(function (name) {
            try {
                Object.defineProperty(window, name, {configurable: true, value: memoryStorage()});
            } catch (e) { /* the real one it is */
            }
        });
        try {
            if (navigator.serviceWorker) navigator.serviceWorker.register = function () {
                return new Promise(function () {
                });
            };
        } catch (e) { /* no service worker to stop */
        }

        var fetch = window.fetch;
        window.fetch = function (input, init) {
            return fetch.call(window, toRoot(input), init);
        };
        var xhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            var args = Array.prototype.slice.call(arguments);
            args[1] = toRoot(url);
            return xhrOpen.apply(this, args);
        };

        var open = window.open;
        window.open = function (url) {
            var path = url ? route(new URL(toRoot(String(url)), document.baseURI).href) : null;
            if (path !== null) {
                tt.open(path);
                return null;
            }
            return open.apply(window, arguments);
        };

        // Links: to another page of the site they travel on in the frame, anywhere
        // else they open in a new tab, and #anchors scroll as they would have.
        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || !e.target.closest) return;
            var a = e.target.closest('a[href]');
            if (!a) return;
            var href = a.getAttribute('href').trim();
            if (href.charAt(0) === '#') {
                e.preventDefault();
                var id = decodeURIComponent(href.slice(1));
                var target = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
                if (target) target.scrollIntoView({behavior: 'smooth'});
                else if (!id) window.scrollTo({top: 0, behavior: 'smooth'});
                return;
            }
            if (/^(javascript|mailto|tel|data|blob):/i.test(href) || a.hasAttribute('download')) return;
            e.preventDefault();
            var path = route(a.href);
            if (path !== null) tt.open(path);
            else open.call(window, a.href, '_blank', 'noopener');
        });

        // Scripts that set location.href instead of using a link.
        if (window.navigation && navigation.addEventListener) {
            navigation.addEventListener('navigate', function (e) {
                if (!e.cancelable || e.hashChange || e.downloadRequest != null) return;
                e.preventDefault();
                if (e.formData) return;
                var path = route(e.destination.url);
                if (path !== null) tt.open(path);
                else open.call(window, e.destination.url, '_blank', 'noopener');
            });
        }
    }

    const CSS = `
        #tt{position:fixed;left:0;right:0;bottom:0;z-index:10000;pointer-events:none;
            font-family:'JetBrains Mono','JetBrains Mono Fallback',ui-monospace,monospace;font-size:12px;color:var(--ink,#f5ecd4)}
        #tt button,#tt a{font:inherit}
        #tt-tab{pointer-events:auto;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);
            display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;
            padding:5px 14px;border:2px solid var(--amber,#ffc857);border-bottom:none;
            background:var(--panel,#1a1628);color:var(--amber,#ffc857);
            text-transform:uppercase;letter-spacing:0.08em;font-size:11px}
        #tt:not(.open) #tt-tab{bottom:0}
        #tt-tab:hover{background:var(--panel-2,#221b35)}
        #tt-tab:focus-visible,#tt button:focus-visible,#tt a:focus-visible,#tt-range:focus-visible{outline:2px solid var(--cyan,#4ee1d2);outline-offset:2px}
        #tt-panel{pointer-events:auto;background:var(--panel,#1a1628);border-top:2px solid var(--amber,#ffc857);
            padding:8px 16px 10px;box-shadow:0 -8px 24px rgba(0,0,0,0.35)}
        #tt-panel[hidden]{display:none}
        #tt .tt-row{display:flex;align-items:center;gap:12px;max-width:1400px;margin:0 auto}
        #tt .tt-track{position:relative;flex:1;min-width:0;padding:22px 0 16px}
        #tt-range{display:block;width:100%;margin:0;accent-color:var(--amber,#ffc857);cursor:pointer}
        #tt .tt-years span,#tt .tt-models span{position:absolute;transform:translateX(-50%);white-space:nowrap;line-height:1}
        #tt .tt-years span{bottom:0;color:var(--ink-3,#968bae);font-size:10px;padding-left:1px}
        #tt .tt-years span::before{content:"";position:absolute;left:50%;bottom:calc(100% + 2px);height:5px;border-left:1px solid var(--line-2,#3a3352)}
        #tt .tt-models{position:absolute;left:0;right:0;top:0;height:100%;pointer-events:none}
        #tt .tt-models span{color:var(--cyan,#4ee1d2);font-size:10px;cursor:pointer;opacity:0.7;pointer-events:auto}
        #tt .tt-models span.on,#tt .tt-models span:hover{opacity:1;text-decoration:underline}
        #tt .tt-step{flex:none;width:32px;height:32px;border:2px solid var(--line-2,#3a3352);background:none;color:var(--ink,#f5ecd4);cursor:pointer}
        #tt .tt-step:hover:not(:disabled){border-color:var(--amber,#ffc857);color:var(--amber,#ffc857)}
        #tt .tt-step:disabled{opacity:0.35;cursor:default}
        #tt .tt-info{flex-wrap:wrap;gap:4px 14px;padding:2px 44px 0;min-height:30px}
        #tt-date{color:var(--amber,#ffc857);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
        #tt-model{color:var(--cyan,#4ee1d2)}
        #tt-count{color:var(--ink,#f5ecd4)}
        #tt-message{order:10;flex:1 1 100%;min-width:0;color:var(--ink-2,#b5abcc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        #tt-scope{display:flex}
        #tt-scope button{padding:3px 8px;border:2px solid var(--line-2,#3a3352);background:none;color:var(--ink-3,#968bae);cursor:pointer;white-space:nowrap}
        #tt-scope button+button{border-left:none}
        #tt-scope button[aria-pressed="true"]{border-color:var(--cyan,#4ee1d2);color:var(--cyan,#4ee1d2)}
        #tt-scope button[aria-pressed="true"]+button{border-left:2px solid var(--line-2,#3a3352)}
        #tt-scope button:hover{color:var(--amber,#ffc857)}
        #tt-where{color:var(--ink-2,#b5abcc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40ch}
        #tt-status{color:var(--ink-3,#968bae)}
        #tt-status.err{color:var(--magenta,#ff3ca1)}
        #tt .tt-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
        #tt .tt-actions button,#tt .tt-actions a{padding:4px 10px;border:2px solid var(--line-2,#3a3352);background:none;
            color:var(--ink,#f5ecd4);cursor:pointer;text-decoration:none;white-space:nowrap}
        #tt .tt-actions button:hover,#tt .tt-actions a:hover{border-color:var(--amber,#ffc857);color:var(--amber,#ffc857)}
        #tt-exit{border-color:var(--magenta,#ff3ca1) !important;color:var(--magenta,#ff3ca1) !important}
        #tt [hidden]{display:none !important}
        #tt-frame{position:fixed;top:0;left:0;width:100%;height:calc(100% - var(--tt-h,0px));border:0;z-index:9999;background:#fff}
        html.tt-travelling,html.tt-travelling body{overflow:hidden}
        @media (max-width:640px){
            #tt-panel{padding:6px 8px 8px}
            #tt .tt-row{gap:6px}
            #tt .tt-info{padding:2px 0 0}
            #tt .tt-actions{margin-left:0;width:100%}
            #tt .tt-models{display:none}
            #tt .tt-track{padding-top:10px !important}
        }`;
})();
