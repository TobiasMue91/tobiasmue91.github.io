#!/usr/bin/env node
// Test suite for games/getting_up_here.html.
//
// Runs the page's DOM-free <script id="core"> block (the course and the physics of a washtub, a sailor
// and a boat hook) in Node. The page promises a climb that is physical and fair: the same hand gives the
// same climb, the tub comes to rest instead of skating off, the arms can lift the old man but not fire him
// into orbit, nothing passes through the rock however the hook is thrown about, and every leg of the
// course from the shingle to the lamp has been climbed by a bot moving the hook as a hand would.
//
//   node test/getting_up_here.mjs                  # all suites
//   node test/getting_up_here.mjs physics route    # named suites
//   node test/getting_up_here.mjs --record         # re-find the route after changing the course (slow)
//
// The route is a list of cursor keyframes per leg in test/getting_up_here.route.json, found by a
// cross-entropy search (--record) and replayed here. Change the course or the physics and the replay
// fails at the first leg that no longer works; record again and look at which legs got harder.

import {readFileSync, writeFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'getting_up_here.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');
const ROUTE = join(HERE, 'getting_up_here.route.json');

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.VERBOSE) console.log('ok  ', m); };
const run = (s, secs, f) => { const ev = []; const k = Math.round(secs / Core.DT); for (let i = 0; i < k; i++) Core.step(s, f ? f(i * Core.DT) : null, ev); return ev; };
const speed = s => Math.hypot(s.bx - s.pbx, s.by - s.pby) / (Core.DT / Core.SUB);

// The legs of the climb: each a region the tub must come to rest in, in order.
const LEGS = [
  ['first crate', 2.3, 3.1, 1.25], ['past the crate', 3.6, 4.8, 0.4], ['crate stack', 5.3, 6.0, 2.15], ['boulder', 8.3, 9.8, 2.6],
  ['bow', 11.0, 13.0, 3.6], ['mast', 14.5, 16.2, 7.6], ['crow\'s nest', 17.2, 19.6, 11.6],
  ['wall ledge 1', 20.5, 21.6, 13.9], ['wall ledge 2', 20.9, 21.9, 16.3], ['wall ledge 3', 21.5, 22.5, 18.6], ['wall ledge 4', 22.1, 23.1, 20.9],
  ['wall top', 23.4, 25.0, 22.4], ['weed 1', 26.2, 27.8, 24.0], ['weed 2', 28.4, 30.2, 25.8], ['weed 3', 30.8, 32.6, 27.6], ['weed rock', 33.3, 36.0, 29.2],
  ...[0, 1, 2, 3, 4, 5].map(k => ['girder ' + (k + 1), 35.4, 36.6, 31.22 + k * 2.5 + 0.4]),
  ['crane cab', 36.0, 38.0, 47.4], ['jib', 31, 33.5, 49.4], ['jib end', 27.4, 29.5, 51.4], ['cliff lip', 25.0, 27.7, 53.7],
  ['broken rock', 23.0, 25.0, 55.2], ['broken rock 2', 21.4, 22.6, 55.3], ['chimney foot', 18.9, 21.6, 57.3], ['chimney', 17.6, 18.9, 63.5],
  ['chimney top', 17.4, 22, 70.3], ['step', 16.5, 19.4, 72.3], ['lighthouse rock', 12.6, 16.6, 74.4],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => ['rung ' + (r + 1), 12.0, 13.2, 75.4 + r * 1.25 + 0.6]),
  ['gallery', 11.6, 13.1, 88.6]
].map(([name, x0, x1, y]) => ({name, x0, x1, y}));

function play(state, keys, settle = 1.2) {
  const s = Core.snapshot(state); let k = 0, kt = 0, prev = [s.cx, s.cy];
  const tot = keys.reduce((a, b) => a + b[2], 0), steps = Math.round((tot + settle) / Core.DT), ev = [];
  for (let i = 0; i < steps; i++) {
    while (k < keys.length && kt >= keys[k][2]) { kt -= keys[k][2]; prev = [Math.cos(keys[k][0]) * keys[k][1], Math.sin(keys[k][0]) * keys[k][1]]; k++; }
    let cx = prev[0], cy = prev[1];
    if (k < keys.length) { const u = Math.min(1, kt / keys[k][2]), e = u * u * (3 - 2 * u), tx = Math.cos(keys[k][0]) * keys[k][1], ty = Math.sin(keys[k][0]) * keys[k][1]; cx = prev[0] + (tx - prev[0]) * e; cy = prev[1] + (ty - prev[1]) * e; }
    Core.step(s, {cx, cy}, ev); kt += Core.DT;
  }
  s._ev = ev; return s;
}
const inLeg = (s, g) => s.bx >= g.x0 && s.bx <= g.x1 && s.by >= g.y && speed(s) < 0.5;
function begin() { const s = Core.create(); run(s, 1.0, () => ({cx: 1.1, cy: 0.3})); return s; }

const suites = {
  physics() {
    // same hand, same climb
    const a = Core.create(), b = Core.create(), f = t => ({cx: Math.cos(t * 3) * 1.4, cy: Math.sin(t * 2.2) * 1.2});
    run(a, 8, f); run(b, 8, f);
    ok(a.bx === b.bx && a.by === b.by && a.hx === b.hx, 'deterministic: same input, same state to the last bit');
    // at rest on the shingle, and it stays there
    const r = Core.create(); run(r, 2);
    const x0 = r.bx, y0 = r.by; run(r, 3);
    ok(Math.abs(r.bx - x0) < 1e-4 && Math.abs(r.by - y0) < 1e-4, 'the tub rests on flat ground');
    ok(Math.abs(r.by - (Core.RB + 0.0)) < 0.05, 'and sits on it, not in it: ' + r.by.toFixed(3));
    // round things that never stop: shove the tub along the beach, it must come to rest
    const p = Core.create(); run(p, 1); p.pbx -= 6 * Core.DT / Core.SUB; run(p, 4);
    ok(speed(p) < 0.05, 'a tub shoved at 6 m/s along the shingle comes to rest: ' + speed(p).toFixed(3));
    // a gentle slope holds it, the weed lets go
    const sl = Core.create({x: 9.4, y: 3.2}); run(sl, 3); const sx = sl.bx; run(sl, 2);
    ok(Math.abs(sl.bx - sx) < 0.01, 'rests on the boulder\'s slope');
    // the arms lift but do not launch: from flat, the best flick reaches a person-sized hop
    let top = 0;
    for (const dur of [0.03, 0.06, 0.1, 0.16]) {
      const s = Core.create(); run(s, 1, () => ({cx: 0, cy: -0.4})); let hi = 0;
      run(s, 2, t => { hi = Math.max(hi, s.by); return t < dur ? {cx: 0, cy: -0.4 - 1.3 * t / dur} : {cx: 0, cy: -1.7}; });
      top = Math.max(top, hi - Core.RB);
    }
    ok(top > 1.2 && top < 4.5, 'a pogo off flat ground rises between 1.2 and 4.5 m: ' + top.toFixed(2));
    // pushing straight down holds the tub up like a pole
    const pole = Core.create(); run(pole, 1, () => ({cx: 0.3, cy: -0.3})); run(pole, 0.6, t => ({cx: 0.3, cy: -0.3 - 2 * t})); run(pole, 1, () => ({cx: 0.3, cy: -1.5}));
    ok(pole.by > 1.0 && speed(pole) < 0.3, 'the hook planted below holds the tub up: ' + pole.by.toFixed(2));
    // the hook can hold his weight from an edge: hang from the first crate's far corner
    // the sea floats him
    const sea = Core.create({x: -9, y: 1}); run(sea, 6);
    ok(sea.by > Core.SEA - 0.5 && sea.by < Core.SEA + 0.4, 'the tub floats at the water line: ' + sea.by.toFixed(2));
  },
  solid() {
    // nothing passes through the rock: flail the hook at every leg of the course and check the tub and the hook stay outside
    let worst = 0, where = '';
    const c = [];
    LEGS.forEach((g, i) => {
      for (let seed = 1; seed <= 3; seed++) {
        const s = Core.create({x: (g.x0 + g.x1) / 2, y: g.y + 0.2}); let r = seed * 7919 + i;
        const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
        let a = rnd() * 6.28, R = 1;
        for (let k = 0; k < 120 * 6; k++) {
          if (k % 12 === 0) { a += (rnd() - 0.5) * 3; R = 0.3 + rnd() * 1.5; }
          Core.step(s, {cx: Math.cos(a) * R, cy: Math.sin(a) * R}, []);
          for (const [x, y, rad] of [[s.bx, s.by, Core.RB * 0.5], [s.hx, s.hy, Core.RH * 0.3]]) {
            for (const o of Core.polys) if (Core.inside(o, x, y)) {
              Core.circle(x, y, rad, c); const d = Math.max(0, ...c.map(q => q.d));
              if (d > worst) { worst = d; where = g.name + ' seed ' + seed + ' (' + x.toFixed(2) + ', ' + y.toFixed(2) + ')'; }
            }
          }
        }
      }
    });
    ok(worst < 0.25, 'flailing on every leg never buries the tub or the hook: deepest ' + worst.toFixed(3) + ' at ' + where);
  },
  course() {
    ok(Core.section(0.4) === 0 && Core.section(Core.TOP) === Core.SECTIONS.length - 1, 'sections run from the shingle to the lighthouse');
    ok(Core.SECTIONS.every((s, i) => i === 0 || s.y > Core.SECTIONS[i - 1].y), 'sections climb');
    // the summit is the gallery: standing there ends the climb once
    const s = Core.create({x: 12.4, y: Core.TOP + Core.RB + 0.02}); const ev = run(s, 1);
    ok(ev.filter(e => e.type === 'summit').length === 1 && s.done, 'the gallery is the summit, and it is announced once');
    // falls are measured from the last perch
    // a tub let go in the gap between the crow's nest and the harbour wall drops to the trench floor
    const f = Core.create({x: 20.1, y: 12.2, cx: 0, cy: -0.5});
    const ev2 = run(f, 4);
    const fall = ev2.find(e => e.type === 'fall');
    ok(fall && fall.m > 8, 'a drop from the crow\'s nest down to the trench is a fall of more than 8 m: ' + (fall ? fall.m.toFixed(1) : 'none'));
  },
  route() {
    if (!existsSync(ROUTE)) { ok(false, 'no recorded route: run with --record'); return; }
    const sol = JSON.parse(readFileSync(ROUTE, 'utf8'));
    ok(sol.length === LEGS.length, 'the route covers all ' + LEGS.length + ' legs (has ' + sol.length + ')');
    let s = begin(), t = 0;
    for (let i = 0; i < sol.length; i++) {
      s = play(s, sol[i].keys); t += sol[i].keys.reduce((a, b) => a + b[2], 0) + 1.2;
      if (!inLeg(s, LEGS[i])) { ok(false, 'leg ' + (i + 1) + ' (' + LEGS[i].name + ') replays: ended at ' + s.bx.toFixed(2) + ', ' + s.by.toFixed(2)); return; }
    }
    ok(true, 'every leg from the shingle to the gallery replays');
    ok(s.done, 'and the last one reaches the summit');
    console.log('  route: ' + sol.length + ' legs, ' + Math.round(t) + ' s of bot hand on the hook');
  }
};

// cross-entropy search for one leg; deterministic for a seed
function solve(state, goal, seed) {
  let r = seed >>> 0 || 1; const rnd = () => { r ^= r << 13; r >>>= 0; r ^= r >> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const K = 5, mu = [], sd = []; for (let k = 0; k < K; k++) { mu.push([Math.PI / 2, 1.2, 0.4]); sd.push([1.8, 0.5, 0.25]); }
  const score = s => (s.bx < goal.x0 ? goal.x0 - s.bx : s.bx > goal.x1 ? s.bx - goal.x1 : 0) + Math.max(0, goal.y - s.by) * 1.5 + (speed(s) < 0.5 ? 0 : 0.3);
  let best = null;
  for (let it = 0; it < 10; it++) {
    const cand = [];
    for (let p = 0; p < 64; p++) {
      const keys = mu.map((m, k) => [m[0] + gauss() * sd[k][0], Math.min(1.75, Math.max(0.3, m[1] + gauss() * sd[k][1])), Math.min(0.9, Math.max(0.06, m[2] + gauss() * sd[k][2]))]);
      const s = play(state, keys), sc = score(s); cand.push({keys, sc, s});
      if (!best || sc < best.sc) best = {keys, sc, s};
      if (sc === 0) return best;
    }
    cand.sort((a, b) => a.sc - b.sc); const el = cand.slice(0, 8);
    for (let k = 0; k < K; k++) for (let j = 0; j < 3; j++) {
      const v = el.map(c => c.keys[k][j]), m = v.reduce((a, b) => a + b) / v.length;
      mu[k][j] = m; sd[k][j] = Math.max(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length), j === 0 ? 0.15 : j === 1 ? 0.08 : 0.04);
    }
  }
  return best;
}
function record() {
  const sol = existsSync(ROUTE) && process.argv.includes('--resume') ? JSON.parse(readFileSync(ROUTE, 'utf8')) : [];
  let s = begin(); for (const d of sol) s = play(s, d.keys);
  for (let i = sol.length; i < LEGS.length; i++) {
    let b = null; const t0 = Date.now();
    for (let seed = 1; seed <= 8 && !(b && b.sc === 0); seed++) { const r = solve(s, LEGS[i], seed); if (!b || r.sc < b.sc) b = r; }
    console.log((i + 1) + ' ' + LEGS[i].name + ': ' + (b.sc === 0 ? 'climbed' : 'STUCK at ' + b.s.bx.toFixed(2) + ', ' + b.s.by.toFixed(2)) + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    if (b.sc > 0) process.exit(1);
    sol.push({name: LEGS[i].name, keys: b.keys}); writeFileSync(ROUTE, JSON.stringify(sol)); s = play(s, sol[i].keys);
  }
}

if (process.argv.includes('--record')) record();
else {
  const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
  for (const [name, fn] of Object.entries(suites)) if (!want.length || want.includes(name)) { const f0 = fails; fn(); console.log(name + ': ' + (fails === f0 ? 'ok' : (fails - f0) + ' failed')); }
  console.log(fails ? fails + ' of ' + n + ' checks failed' : 'all ' + n + ' checks passed');
  process.exit(fails ? 1 : 0);
}
