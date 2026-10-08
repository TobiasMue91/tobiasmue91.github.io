#!/usr/bin/env node
// Test suite for games/fling.html (Fling).
//
// Runs the page's DOM-free <script id="core"> and <script id="levels"> blocks in Node. The promises on that page nobody can
// see: every level stands on its own until the first bird, every level can be won by a bot that only looks at the
// rules, a throw is a pure function of the level and the pull, and the aim dots show where the bird really goes.
// The `page` suite then loads the real page in Chromium for console errors, a real pull-and-release, and the old save.
//
//   node test/fling.mjs                 # everything quick (bots on five levels)
//   node test/fling.mjs shape rules     # named suites only
//   node test/fling.mjs bots --all      # every level (about three minutes)
//   node test/fling.mjs --page=path.html
//
// Suites: physics, shape, rules, bots, page.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'fling.html'));
const ALL = ['physics', 'shape', 'rules', 'bots', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const grab = id => { const m = HTML.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) { console.log(`no <script id="${id}"> block in ${PAGE}`); process.exit(1); } return m[1]; };
const ctx = vm.createContext({});
vm.runInContext(grab('core') + '\n' + grab('levels') + '\nthis.FL = FL;', ctx);
const FL = ctx.FL;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const run = (w, s) => { for (let i = 0; i < Math.round(s / FL.DT); i++) FL.step(w); };
const dyn = w => w.bodies.filter(b => !b.static);
// level() pulls items toward the sling by LEAD, so the tests write x as if it did not
const empty = (birds, items = []) => FL.createWorld(FL.level(0, birds, items.map(it => [it[0], it[1] + FL.LEAD, ...it.slice(2)]), [1000, 2000]));

// ---------------------------------------------------------------------------------------------------------------
if (suites.includes('physics')) {
  section('physics');
  { // a box dropped from a height lands on the ground, stands still, falls asleep
    const w = empty([], [['wood', 10, 1.5, 1, 1]]); run(w, 4); const b = dyn(w)[0];
    check(near(b.y, .5, .03) && Math.abs(b.a) < .01 && !b.awake, 'a dropped plank lands flat and sleeps', `y=${b.y} a=${b.a} awake=${b.awake}`);
    check(b.dmg < .05, 'a plank dropped from a metre is not hurt', `dmg=${b.dmg}`);
  }
  { // a stone block dropped from far higher is hurt, a toad too
    const w = empty([], [['wood', 10, 14, 1, 1], ['toad', 14, 14, .5]]); run(w, 4);
    check(dyn(w).length < 2 || w.score > 0, 'a long fall breaks what it lands on', `score=${w.score}`);
  }
  { // a tower of six stands
    const items = []; for (let i = 0; i < 6; i++) items.push(['wood', 12, i * .5, 2, .5]);
    const w = empty([], items); run(w, 10);
    const drift = Math.max(...dyn(w).map(b => Math.abs(b.x - 12))), top = Math.max(...dyn(w).map(b => b.y));
    check(drift < .02 && near(top, 2.75, .04) && dyn(w).every(b => !b.awake), 'six stacked planks stand and sleep', `drift=${drift} top=${top}`);
  }
  { // a column of four tall posts, one on the other
    const items = []; for (let i = 0; i < 4; i++) items.push(['stone', 12, i * 1.5, .5, 1.5]);
    const w = empty([], items); run(w, 8);
    check(Math.max(...dyn(w).map(b => Math.abs(b.x - 12))) < .02 && w.score === 0, 'a column of four stone posts stands', `score=${w.score}`);
  }
  { // a toad that is sliding or rolling along the floor slows down and stops, it does not roll off the level
    for (const v of [4, 10, 18]) {
      const w = empty([], [['toad', 8, 0, .5]]); const b = dyn(w)[0]; run(w, 1); b.vx = v; b.awake = true; run(w, 8);
      check(Math.abs(b.vx) < .2 && b.x - (8 - FL.LEAD) < v * .9 + .5, `a toad pushed along the floor at ${v} m/s comes to rest`, `vx=${b.vx.toFixed(2)} travelled ${(b.x - (8 - FL.LEAD)).toFixed(1)} m`);
    }
    const w = empty(['finch'], []); const bd = FL.launch(w, -1.5, -.2); run(w, 12);
    check(!w.active.length, 'a finch that lands and rolls is gone within twelve seconds');
  }
  { // determinism: same level, same pull, same everything
    const sig = () => { const w = FL.createWorld(FL.LEVELS[2]); run(w, 1); FL.launch(w, -1.7, -1); run(w, 6); return dyn(w).map(b => [b.id, b.x.toFixed(6), b.y.toFixed(6), b.a.toFixed(6)].join(':')).join('|') + '|' + w.score; };
    check(sig() === sig(), 'a throw is the same throw every time');
  }
  { // a clone carries on exactly like the original
    const w = FL.createWorld(FL.LEVELS[3]); run(w, 1); FL.launch(w, -1.7, -1); run(w, .5);
    const c = FL.clone(w); run(w, 4); run(c, 4);
    check(dyn(w).map(b => b.x.toFixed(6) + b.y.toFixed(6)).join() === dyn(c).map(b => b.x.toFixed(6) + b.y.toFixed(6)).join() && w.score === c.score, 'a clone carries on move for move');
  }
  { // nothing ends up inside the ground or flies off the level after a heavy hit
    const w = FL.createWorld(FL.LEVELS[12]); run(w, 1); FL.launch(w, -2.4, -1.2); run(w, 10);
    check(dyn(w).every(b => b.y > -1 && b.x > -5 && b.x < w.width + 50), 'after a hard shot every body is still somewhere sane');
  }
}

// ---------------------------------------------------------------------------------------------------------------
if (suites.includes('shape')) {
  section('shape');
  const LV = FL.LEVELS;
  check(LV.length === 20, 'twenty levels', 'got ' + LV.length);
  LV.forEach((spec, i) => {
    const n = i + 1, w = FL.createWorld(spec);
    check(spec.birds.length >= 3 && spec.birds.length <= 5 && spec.birds.every(k => FL.BIRDS[k]), `level ${n}: three to five known birds`);
    check(w.toads >= 1 && w.toads <= 6, `level ${n}: ${w.toads} toads`);
    check(spec.par[0] > 0 && spec.par[1] > spec.par[0], `level ${n}: the star scores climb`, spec.par.join());
    const bs = dyn(w).filter(b => !b.circle);
    let overlap = null;
    const box = b => [b.x - b.hw, b.x + b.hw, b.y - b.hh, b.y + b.hh];
    const all = dyn(w);
    for (let a = 0; a < all.length && !overlap; a++) for (let c = a + 1; c < all.length; c++) {
      const A = all[a], B = all[c]; const ax = A.circle ? [A.x - A.r, A.x + A.r, A.y - A.r, A.y + A.r] : box(A), bx = B.circle ? [B.x - B.r, B.x + B.r, B.y - B.r, B.y + B.r] : box(B);
      const ox = Math.min(ax[1], bx[1]) - Math.max(ax[0], bx[0]), oy = Math.min(ax[3], bx[3]) - Math.max(ax[2], bx[2]);
      if (ox > .06 && oy > .06) { overlap = `${A.mat}@${A.x},${A.y} / ${B.mat}@${B.x},${B.y}`; break; }
    }
    check(!overlap, `level ${n}: nothing starts inside anything else`, overlap);
    const start = all.map(b => [b.x, b.y]);
    run(w, 6);
    const moved = Math.max(...all.map((b, k) => Math.hypot(b.x - start[k][0], b.y - start[k][1])));
    check(w.score === 0 && w.toads === spec.items.filter(it => it[0] === 'toad').length, `level ${n}: stands on its own for six seconds`, `score=${w.score}`);
    check(moved < .12, `level ${n}: nothing slides more than a hand's width`, `moved ${moved.toFixed(3)}`);
    check(Math.max(...spec.items.map(it => it[1])) < spec.width - 2, `level ${n}: inside the level width`);
  });
}

// ---------------------------------------------------------------------------------------------------------------
if (suites.includes('rules')) {
  section('rules');
  { // pull clamps, a tiny pull is no shot, the speed is the pull
    const w = empty(['finch', 'finch']);
    check(FL.launch(w, -.1, 0) === null && w.queue.length === 2, 'a tiny pull launches nothing and costs nothing');
    const b = FL.launch(w, -10, 0);
    check(near(Math.hypot(b.x - FL.SLING.x, b.y - FL.SLING.y), FL.MAXPULL, 1e-9), 'the pull clamps to the sling');
    check(near(b.vx, FL.MAXPULL * FL.POWER, 1e-9) && near(b.vy, 0, 1e-9), 'launch speed is pull times power, opposite to the pull');
    check(!FL.canLaunch(w) && FL.launch(w, -1, -1) === null, 'only one bird flies at a time');
  }
  { // aim dots show where the bird really goes (until it touches something)
    for (const [px, py] of [[-1.7, -1], [-2.2, -.4], [-1, -1.6]]) {
      const w = empty(['finch']); const path = FL.aimPath(px, py, 8, .085); const b = FL.launch(w, px, py);
      let worst = 0, t = 0;
      for (let i = 0; i < 8; i++) { while (t < (i + 1) * .085 - 1e-9) { FL.step(w); t += FL.DT; } worst = Math.max(worst, Math.hypot(b.x - path[i][0], b.y - path[i][1])); }
      check(worst < .35, `the dots follow the bird (pull ${px},${py})`, `worst ${worst.toFixed(3)} m`);
    }
  }
  { // abilities
    const w = empty(['swift']); const b = FL.launch(w, -1.7, -1); run(w, .2); const v0 = Math.hypot(b.vx, b.vy); FL.tapBird(w); const v1 = Math.hypot(b.vx, b.vy);
    check(v1 > v0 * 1.4 && v1 <= 26.5, 'swift dashes once, not past the limit', `${v0.toFixed(1)} -> ${v1.toFixed(1)}`);
    check(FL.tapBird(w) === false, 'and only once');
    const t = empty(['triplet']); FL.launch(t, -1.7, -1); run(t, .2); FL.tapBird(t);
    check(t.active.length === 3 && t.active.every(q => q.kind === 'triplet'), 'triplet splits into three');
    const bm = empty(['bomb'], [['wood', 8.2, 0, 1, 1], ['wood', 30, 0, 1, 1]]); const bb = FL.launch(bm, -.4, 0); bb.x = 8.2; bb.y = 2; bb.vx = bb.vy = 0; FL.tapBird(bm);
    check(bb.dead && bm.bodies.find(q => q.x === 8.2).dmg > 0 && bm.bodies.find(q => q.x === 30).dmg === 0, 'a bomb hurts what is near and nothing far');
  }
  { // kegs go off when something hard hits them, chain, and pay
    const w = empty(['finch'], [['keg', 14, 0], ['keg', 15.1, 0], ['toad', 16.4, 0, .5], ['toad', 30, 0, .5]]);
    run(w, 1); const b = FL.launch(w, -1, 0); b.x = 10; b.y = .6; b.vx = 14; b.vy = 0; b.touched = true;
    const evs = []; for (let i = 0; i < 4 / FL.DT; i++) evs.push(...FL.step(w));
    check(evs.filter(e => e.t === 'boom').length >= 2, 'a keg goes off when hit, and sets the next one off', 'booms ' + evs.filter(e => e.t === 'boom').length);
    check(w.score >= 1600 + 5000 && w.toads === 1, 'and pays, and takes the toad beside it but not the far one', 'score ' + w.score + ' toads ' + w.toads);
  }
  { // score is exactly the sum of what the events paid, win pays the spare birds
    const spec = FL.LEVELS[0]; const w = FL.createWorld(spec); run(w, 1); let paid = 0;
    const b = FL.launch(w, -.4 * 2.4 * Math.cos(1.1), -.4 * 2.4 * Math.sin(1.1) * 0 - 1.0); // some shot; we only need to know accounting
    for (let i = 0; i < 14 / FL.DT; i++) { for (const e of FL.step(w)) if (e.t === 'score') paid += e.pts; }
    check(paid === w.score, 'the score is what the pop-ups paid', `${paid} vs ${w.score}`);
  }
  { // won / lost
    const w = empty(['finch', 'finch'], [['toad', 14, 14, .5]]); run(w, 6);
    check(w.over === 'won' && w.bonusBirds === 2 && FL.total(w) === 5000 + 2 * FL.BONUS, 'killing the last toad wins and pays the spare birds', `${w.over} ${w.bonusBirds} ${FL.total(w)}`);
    const l = empty(['finch'], [['toad', 25, 0, .5]]); FL.launch(l, -.5, -.3); run(l, 20);
    check(l.over === 'lost' && FL.total(l) === l.score, 'out of birds with a toad left is a loss');
    check(!FL.canLaunch(l), 'and nothing can be launched afterwards');
  }
  { // stars follow the par
    const s = FL.LEVELS[0];
    check(FL.stars(s, 0) === 1 && FL.stars(s, s.par[0]) === 2 && FL.stars(s, s.par[1]) === 3, 'stars are 1 / 2 / 3 at 0 / par / par');
  }
}

// ---------------------------------------------------------------------------------------------------------------
if (suites.includes('bots')) {
  section('bots');
  // a bot that only knows the rules: for each bird try a grid of pulls (and ability taps) on a copy, play the best
  const shoot = (w, ang, pull, tapAt) => {
    const a = ang * Math.PI / 180, b = FL.launch(w, -Math.cos(a) * pull * FL.MAXPULL, -Math.sin(a) * pull * FL.MAXPULL); if (!b) return;
    const t0 = w.t; let tapped = false;
    for (let i = 0; i < 14 / FL.DT; i++) { FL.step(w); if (tapAt != null && !tapped && w.t - t0 >= tapAt) { FL.tapBird(w); tapped = true; } if (w.over || (!w.active.length && w.quiet > .6)) break; }
  };
  const best = w => {
    const kind = w.queue[0], taps = kind === 'swift' ? [null, .25, .5, .8] : kind === 'triplet' ? [null, .3, .55, .8] : kind === 'bomb' ? [null, .6, 1.1] : [null];
    let top = null;
    for (const a of [12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72]) for (const p of [.5, .65, .8, .9, 1]) for (const t of taps) {
      const c = FL.clone(w); shoot(c, a, p, t); const sc = FL.total(c) + (c.over === 'won' ? 1e6 : 0) + (w.toads - c.toads) * 20000;
      if (!top || sc > top.sc) top = { a, p, t, sc };
    }
    return top;
  };
  const play = spec => {
    const w = FL.createWorld(spec); run(w, 2);
    while (!w.over && w.queue.length) { const s = best(w); shoot(w, s.a, s.p, s.t); run(w, 3); }
    run(w, 10); return w;
  };
  const list = args.includes('--all') ? FL.LEVELS.map((_, i) => i) : [0, 3, 7, 14, 19];
  const lost = [];
  for (const i of list) {
    const w = play(FL.LEVELS[i]);
    check(w.over === 'won', `a bot that tries every pull wins level ${i + 1}`, `${w.over}, ${w.toads} toads left`);
    if (w.over === 'won') {
      const sc = FL.total(w);
      check(sc >= FL.LEVELS[i].par[0], `and it earns at least two stars on level ${i + 1}`, `${sc} < par ${FL.LEVELS[i].par[0]}`);
    }
  }
  { // a player who never fires loses; one who fires at random mostly does not three-star the late levels
    const w = FL.createWorld(FL.LEVELS[5]); run(w, 20);
    check(w.over === null && w.score === 0, 'a player who never fires gets nothing');
    let rnd = 1; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    for (const L of [9, 19]) {
      let threes = 0; const N = 12;
      for (let k = 0; k < N; k++) { const q = FL.createWorld(FL.LEVELS[L]); run(q, 1); while (!q.over && q.queue.length) { shoot(q, 15 + R() * 60, .3 + R() * .7, null); run(q, 3); } run(q, 8); if (q.over === 'won' && FL.stars(FL.LEVELS[L], FL.total(q)) === 3) threes++; }
      check(threes <= 2, `throwing at random almost never three-stars level ${L + 1}`, `${threes} of ${N}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
async function pageSuite() {
  section('page');
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch (e) { try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('  skipped: playwright is not installed'); return; } }
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.log('  skipped: no Chromium'); return; }
  const url = 'file://' + PAGE;
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await browser.newPage({ viewport: vp }), errs = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url + '?level=1'); await p.waitForTimeout(600);
    check(await p.evaluate(() => !!window.FLING && FLING.w.toads === 1), `${name}: the page boots on level 1`);
    // a real pull and release with the pointer
    await p.waitForTimeout(2800);
    const [bx, by] = await p.evaluate(() => FLING.screenOf(4.2, 2.55));
    await p.mouse.move(bx, by); await p.mouse.down();
    const [tx, ty] = await p.evaluate(() => FLING.screenOf(4.2 - 1.6, 2.55 - 1.1));
    await p.mouse.move((bx + tx) / 2, (by + ty) / 2); await p.mouse.move(tx, ty); await p.waitForTimeout(100);
    await p.mouse.up(); await p.waitForTimeout(400);
    check(await p.evaluate(() => FLING.w.shots === 1 && FLING.phase !== 'aim'), `${name}: pulling the bird and letting go launches it`);
    await p.waitForTimeout(7000);
    check(errs.length === 0, `${name}: no console errors through a throw`, errs.join(' | '));
    await p.evaluate(() => FLING.openMap()); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.querySelectorAll('#mapGrid .tag').length === 20), `${name}: the map lists twenty levels`);
    await p.close();
  }
  { // the old page's progress is kept as stars
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('fling.progress.v2', JSON.stringify({ bests: { 0: 2500 }, stars: { 0: 3, 1: 2, 2: 1 }, muted: true })); } });
    await p.goto(url); await p.waitForTimeout(500);
    check(await p.evaluate(() => FLING.w && document.getElementById('lvlName').textContent === '4'), 'old progress: the page opens on the first level not yet cleared');
    await p.evaluate(() => FLING.openMap()); await p.waitForTimeout(300);
    const got = await p.evaluate(() => [...document.querySelectorAll('#mapGrid .tag')].slice(0, 5).map(t => t.querySelectorAll('s.on').length + (t.disabled ? 'x' : '')).join(','));
    check(got === '3,2,1,0,0x', 'old progress: stars carry over and the level after them unlocks', got);
    check(errs.length === 0, 'old progress: no errors', errs.join(' | '));
    await p.close();
  }
  await browser.close();
}

(async () => {
  if (suites.includes('page')) await pageSuite();
  console.log(`\n${failures ? failures + ' FAILED, ' : ''}${passes} passed`);
  process.exit(failures ? 1 : 0);
})();
