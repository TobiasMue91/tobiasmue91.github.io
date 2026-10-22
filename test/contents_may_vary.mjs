#!/usr/bin/env node
// Test suite for games/contents_may_vary.html.
//
// The page is an anthology: a shell, a kit, and one box after another, each a whole incremental
// game with its rules in a <script type="text/x-core" data-world="<id>"> block that has no DOM.
// This suite holds every box to the promises it makes the shell (the contract, saves that survive a
// round trip, a pace between half an hour and an hour and a half for a person), holds the shell to
// the promises it makes players (boxes only ever append, so no save loses its place), and keeps the
// whole file inside its budget. Each box can add a suite of its own, named after its id.
//
//   node test/contents_may_vary.mjs                         # everything but the browser
//   node test/contents_may_vary.mjs registry contract       # named suites only
//   node test/contents_may_vary.mjs pacing --world=starter --report
//   node test/contents_may_vary.mjs browser                 # needs Playwright's Chromium
//   node test/contents_may_vary.mjs --page=old.html
//
// Suites: registry, budget, contract, saves, pacing, starter, browser.

import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const PAGE = opt('page') || join(ROOT, 'games', 'contents_may_vary.html');
const ONLY = opt('world');
const REPORT = args.includes('--report');
const ALL = ['registry', 'budget', 'contract', 'saves', 'pacing', 'starter'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

/* Boxes that have shipped, in play order. Saves refer to boxes by id and the page plays them in
   file order, so this list may only ever grow at the end. Append a box's id here when it ships. */
const SHIPPED = ['starter', 'guests'];
// the budget: what one box and the shell may weigh, unminified, in bytes
const BOX_MAX = 100 * 1024, BOX_AIM = 85 * 1024, SHELL_MAX = 64 * 1024;
// a person's pace, in minutes, for every box: the eager bot may not finish sooner, the casual one not later
const PACE = { eager: 30, casual: 90 };

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);
const min = s => (s / 60).toFixed(1) + ' min';

const HTML = readFileSync(PAGE, 'utf8');
const kitSrc = (HTML.match(/<script id="core-kit">([\s\S]*?)<\/script>/) || [])[1];
const marker = HTML.indexOf('<!-- ═══════════════════════════════ WORLDS');
const worlds = [...HTML.matchAll(/<template data-world="([^"]+)"([^>]*)>/g)].map(m => {
  const id = m[1], attrs = m[2], start = m.index, end = HTML.indexOf('</template>', start) + 11;
  const coreM = HTML.match(new RegExp(`<script type="text/x-core" data-world="${id}">([\\s\\S]*?)</script>`));
  const at = k => (attrs.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
  return { id, title: at('title'), handling: at('handling'), tpl: HTML.slice(start, end), core: coreM ? coreM[1] : null };
}).filter(w => !ONLY || w.id === ONLY);
if (!kitSrc) { console.log('no <script id="core-kit"> in ' + PAGE); process.exit(1); }

// every box's core runs in a context of its own, with the kit
function load(w) {
  const ctx = vm.createContext({});
  vm.runInContext(kitSrc + '\n' + w.core + '\nthis.CORE = CORE; this.KIT = KIT;', ctx, { filename: w.id + '.core.js' });
  return { CORE: ctx.CORE, KIT: ctx.KIT };
}

/* ---------------- registry ---------------- */
if (suites.includes('registry')) {
  section('registry');
  const ids = [...HTML.matchAll(/<template data-world="([^"]+)"/g)].map(m => m[1]);
  check(new Set(ids).size === ids.length, 'every box has its own id', ids.join(', '));
  check(SHIPPED.every((id, i) => ids[i] === id), `the shipped boxes keep their ids and their order (${SHIPPED.join(', ')})`, `page has ${ids.join(', ')}`);
  check(marker > 0 && worlds.every(w => HTML.indexOf(`data-world="${w.id}"`) > marker), 'every box comes after the WORLDS marker');
  for (const w of worlds) {
    check(!!w.core, `${w.id}: has a <script type="text/x-core"> block`);
    check(!!w.title && !!w.handling, `${w.id}: has a title and a handling note for its box`, `title=${w.title} handling=${w.handling}`);
    check(/data-part="souvenir"/.test(w.tpl), `${w.id}: has a souvenir for the shelf`);
    check(/K\.world\(/.test(w.tpl) && /K\.complete\(/.test(w.tpl), `${w.id}: registers with K.world and ends with K.complete`);
    check(!/localStorage|sessionStorage/.test(w.tpl + w.core), `${w.id}: keeps its state through the shell, not in storage of its own`);
    check(!/Math\.random/.test(w.core), `${w.id}: its core never calls Math.random (the state carries its own PRNG)`);
  }
}

/* ---------------- budget ---------------- */
if (suites.includes('budget')) {
  section('budget');
  const kb = n => (n / 1024).toFixed(1) + ' KB';
  const shell = Buffer.byteLength(HTML.slice(0, marker));
  check(shell <= SHELL_MAX, `the shell and kit weigh ${kb(shell)} (at most ${kb(SHELL_MAX)})`);
  for (const w of worlds) {
    const n = Buffer.byteLength(w.tpl) + Buffer.byteLength(w.core || '');
    check(n <= BOX_MAX, `${w.id}: weighs ${kb(n)} (at most ${kb(BOX_MAX)})`);
    if (n > BOX_AIM) console.log(`  note  ${w.id} is over the ${kb(BOX_AIM)} a box should aim for`);
  }
}

/* ---------------- contract ---------------- */
if (suites.includes('contract')) {
  section('contract');
  for (const w of worlds) {
    let L; try { L = load(w); } catch (e) { fail(`${w.id}: its core runs in Node`, e.message); continue; }
    const { CORE } = L;
    check(Number.isInteger(CORE.version) && CORE.version >= 1, `${w.id}: has an integer version`);
    for (const f of ['init', 'step', 'act', 'done', 'progress', 'milestones']) check(typeof CORE[f] === 'function', `${w.id}: has ${f}()`);
    check(CORE.bots && typeof CORE.bots.eager === 'function' && typeof CORE.bots.casual === 'function', `${w.id}: has an eager and a casual bot`);
    const S = CORE.init(1);
    check(!CORE.done(S) && CORE.progress(S) >= 0 && CORE.progress(S) < .05, `${w.id}: a fresh state is not done and has made no progress`);
    check(JSON.stringify(CORE.init(7)) === JSON.stringify(CORE.init(7)), `${w.id}: the same seed gives the same start`);
    check(CORE.act(S, 'no-such-thing') === false || CORE.act(S, 'no-such-thing') == null, `${w.id}: an unknown action does nothing`);
  }
}

/* ---------------- saves ---------------- */
if (suites.includes('saves')) {
  section('saves');
  const clean = (o, path = '') => {
    if (typeof o === 'number' && !isFinite(o)) return path + ' is ' + o;
    if (typeof o === 'function') return path + ' is a function';
    if (o && typeof o === 'object') for (const k in o) { const r = clean(o[k], path + '.' + k); if (r) return r; }
    return null;
  };
  for (const w of worlds) {
    const { CORE, KIT } = load(w);
    for (const at of [3, 15, 40]) {
      const r = KIT.simulate(CORE, 'eager', { minutes: at, seed: 3 });
      const bad = clean(r.S);
      check(!bad, `${w.id}: after ${at} min the state is plain data`, bad);
      const json = JSON.stringify(r.S);
      check(json.length < 100 * 1024, `${w.id}: after ${at} min the save is ${(json.length / 1024).toFixed(1)} KB`);
      // a saved and loaded state goes on exactly like the one that never left
      const copy = JSON.parse(json);
      for (let k = 0; k < 600; k++) { CORE.step(r.S, .1); CORE.step(copy, .1); }
      check(JSON.stringify(r.S) === JSON.stringify(copy), `${w.id}: after ${at} min a saved and loaded state carries on identically for a minute`);
      // the shell may hand back a long absence in one go
      const away = JSON.parse(json); let ok = true;
      try { CORE.step(away, 600); } catch (e) { ok = false; }
      check(ok && !clean(away), `${w.id}: ten minutes away in a single step leave a valid state`);
    }
  }
}

/* ---------------- pacing ---------------- */
if (suites.includes('pacing')) {
  section('pacing');
  for (const w of worlds) {
    const { CORE, KIT } = load(w);
    const aim = Object.assign({}, PACE, CORE.pace || {});
    for (const bot of ['eager', 'casual']) {
      const runs = [1, 2, 3].map(seed => KIT.simulate(CORE, bot, { seed, minutes: 150, every: 30 }));
      const t = runs.map(r => r.minutes), gap = Math.max(...runs.map(r => r.gap));
      console.log(`  ${w.id} ${bot}: ${t.map(x => x.toFixed(1)).join(', ')} min; longest wait for something new ${min(gap)}`);
      check(runs.every(r => r.done), `${w.id}: the ${bot} bot opens the box within 150 minutes`);
      if (bot === 'eager') check(Math.min(...t) >= aim.eager, `${w.id}: the eager bot takes at least ${aim.eager} min`, t.join(', '));
      else check(Math.max(...t) <= aim.casual, `${w.id}: the casual bot takes at most ${aim.casual} min`, t.join(', '));
      const gapMax = (aim.gap || 5) * (bot === 'casual' ? 1.6 : 1);
      check(gap <= gapMax * 60, `${w.id}: the ${bot} bot never waits more than ${gapMax.toFixed(1)} min for something new`, min(gap));
      const first = Math.min(...runs.map(r => r.marks.length ? r.marks[0][0] : 1e9));
      check(first <= 60, `${w.id}: something can be bought or unlocked within the first minute (${first.toFixed(0)} s)`);
      for (const r of runs) {
        const ps = r.samples.map(s => s.p);
        const dips = ps.filter((p, i) => i && p < ps[i - 1] - .02).length;
        check(dips === 0, `${w.id}: progress never goes backwards for the ${bot} bot`, ps.map(p => p.toFixed(2)).join(' '));
        check(CORE.progress(r.S) >= .99, `${w.id}: progress reaches the end with the box`);
      }
      if (REPORT) for (const r of runs.slice(0, 1)) console.log('   ', r.marks.map(([s, m]) => (s / 60).toFixed(1)).join(' '));
    }
  }
}

/* ---------------- starter ---------------- */
const starter = worlds.find(w => w.id === 'starter');
if (suites.includes('starter') && starter) {
  section('starter');
  const { CORE, KIT } = load(starter);
  const S0 = () => CORE.init(5);
  const at = (S, p) => { const j = S.jars[0]; j.t = p * CORE.rise(S, j); };
  {
    const S = S0(); at(S, CORE.P.early * .9);
    check(!CORE.act(S, 'tap', 0) && S.$ === 0, 'a tap before she has risen does nothing and earns nothing');
    at(S, 1.1); CORE.act(S, 'tap', 0); const perfect = S.$;
    const S2 = S0(); at(S2, 1.9); CORE.act(S2, 'tap', 0);
    check(perfect > S2.$ * 1.5, `a tap at the peak pays well over a late one (${perfect.toFixed(3)} against ${S2.$.toFixed(3)})`);
    check(S.streak === 1 && S2.streak === 0, 'a perfect tap starts a streak and a late one does not');
    S.streak = 8; at(S, 1.8); CORE.act(S, 'tap', 0);
    check(S.streak === 4, 'a tap off the peak halves the streak');
  }
  {
    const S = S0(); S.lv.appr = 3; S.streak = 5; let worst = 0, best = 0;
    for (let k = 0; k < 4000; k++) { CORE.step(S, .1); for (const e of S.ev) if (e.k === 'bake' && e.who === 'appr') { best = Math.max(best, e.q); worst = Math.max(worst, e.perfect ? 1 : 0); } S.ev.length = 0; }
    check(best > 0 && best < 1 && !worst, `the apprentice bakes, never at the peak (best ${best.toFixed(2)})`);
    check(S.streak === 5, 'the apprentice leaves the player’s streak alone');
  }
  {
    // automation cannot replace the player: a fully built act 1 left alone earns well under the eager bot
    const r = KIT.simulate(CORE, 'eager', { minutes: 7.5, seed: 2 });
    const a = JSON.parse(JSON.stringify(r.S)), b = JSON.parse(JSON.stringify(r.S));
    a.lv.appr = b.lv.appr = 3; const a0 = a.earned, b0 = b.earned;
    for (let k = 0; k < 1800; k++) CORE.step(a, .1);
    const m = { seed: 9 }; for (let k = 0; k < 1800; k++) { CORE.bots.eager(b, m, .1); CORE.step(b, .1); }
    const alone = a.earned - a0, played = b.earned - b0;
    check(alone < played * .75, `a kitchen left to the apprentice earns ${(100 * alone / played).toFixed(0)}% of one that is played (under 75%)`);
  }
  {
    const r = KIT.simulate(CORE, 'eager', { minutes: 26, seed: 4 }); const S = r.S;
    check(S.act === 3, 'the eager bot is downstairs with Mother by minute 26');
    S.lv.pin = 3; let early = 0;
    for (let k = 0; k < 3000; k++) {
      const before = S.bulges.map(b => b.age);
      CORE.step(S, .1);
      for (const e of S.ev) if (e.k === 'punch' && e.who === 'pin') { const youngest = Math.min(...before); if (youngest < CORE.bulgeGrow(S) + CORE.bulgeLife(S) - .8) early++; }
      S.ev.length = 0;
    }
    check(early === 0, 'rolling pins only take bulges that were about to burst', early + ' taken early');
    S.$ = 1e12; check(CORE.act(S, 'buy', 'last') && S.act === 4, 'the Last Loaf ends the bakery');
    CORE.step(S, .1);
    check(S.finale === 1, 'once bought, she rises by herself');
    check(!CORE.act(S, 'finale', 3) && S.finale === 1, 'the end cannot be skipped ahead');
    for (const k of [2, 3, 4, 5]) CORE.act(S, 'finale', k);
    check(CORE.done(S) && CORE.progress(S) >= .99, 'scored, baked, sliced and opened, the box is done');
  }
  {
    const S = S0(); S.act = 2; S.bench.push({ v: 1, age: 0, pat: 0 });
    check(CORE.scoreQ(S, 0) === 1 && CORE.scoreQ(S, CORE.tol(S)) === 0, 'a perfect score is worth everything and a score a whole tolerance off is worth nothing');
    const before = S.$; CORE.act(S, 'score', 0, 0);
    check(Math.abs(S.$ - before - CORE.scoreMax(S)) < 1e-9, 'a perfect score multiplies the loaf by the pattern’s maximum');
  }
}

/* ---------------- browser ---------------- */
if (suites.includes('browser')) {
  section('browser');
  let chromium = null;
  try { ({ chromium } = await import('playwright')); } catch (e) {
    for (const p of ['/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright/index.mjs']) { if (!chromium && existsSync(p)) try { ({ chromium } = await import(p)); } catch (e2) {} }
  }
  if (!chromium) console.log('  skip  (no Playwright)');
  else {
    // serve the repository ourselves, so the suite needs nothing running
    const http = await import('http');
    const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
    const srv = http.createServer((q, s) => { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f)); });
    await new Promise(r => srv.listen(0, r));
    const base = `http://127.0.0.1:${srv.address().port}/games/contents_may_vary.html`;
    const launch = process.env.HTTPS_PROXY ? { args: [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] } : {};
    const b = await chromium.launch(launch);
    const page = async (q, w = 390, h = 844) => { const p = await b.newPage({ viewport: { width: w, height: h } }); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text())); await p.goto(base + (q || '')); return p; };
    const until = async (p, fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
    {
      const p = await page('');
      await p.evaluate(() => localStorage.clear()); await p.reload();
      check(await until(p, () => !document.querySelector('#title').hidden), 'a first visit shows the title box');
      await p.click('#tGo');
      check(await until(p, () => CMV.state === 'playing'), 'opening it lands in box 1');
      check(await p.evaluate(() => CMV.save.current) === worlds[0].id, `box 1 is ${worlds[0].id}`);
      if (worlds.length > 1) {
        await p.evaluate(() => CMV._complete(CMV.live.token, null));
        check(await until(p, () => CMV.state === 'playing' && CMV.live && CMV.live.w.n === 2), 'finishing box 1 lands in box 2');
        const sv = await p.evaluate(() => CMV.save);
        check(sv.opened[0] === worlds[0].id && sv.current === worlds[1].id, 'the save remembers the opened box and the open one');
        await p.reload();
        check(await until(p, () => !document.querySelector('#title').hidden && /Back in the box/.test(document.querySelector('#tGo').textContent)), 'coming back offers the open box');
      }
      check(p.errs.length === 0, 'no errors on the way', p.errs.join(' | '));
      await p.close();
    }
    for (const w of worlds) for (const [q, wd, ht] of [[`?world=${w.id}`, 390, 844], [`?world=${w.id}&at=12`, 1280, 800]]) {
      const p = await page(q, wd, ht);
      check(await until(p, () => CMV.state === 'playing'), `${w.id}: ${q} starts (${wd}×${ht})`);
      await p.waitForTimeout(1500);
      check(p.errs.length === 0, `${w.id}: ${q} runs without errors`, p.errs.join(' | '));
      await p.close();
    }
    await b.close(); srv.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
