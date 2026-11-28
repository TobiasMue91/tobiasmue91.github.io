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
//   node test/getting_up_here.mjs softlock         # every rest on the course can get back onto the route (slow, ~1 h)
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
// the page ships Planck.js in its own block; the core runs on top of it
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="planck">([\s\S]*?)<\/script>/)[1], ctx);
const Core = vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';Core', ctx);
const ROUTE = join(HERE, 'getting_up_here.route.json');

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.VERBOSE) console.log('ok  ', m); };
const run = (s, secs, f) => { const ev = []; const k = Math.round(secs / Core.DT); for (let i = 0; i < k; i++) Core.step(s, f ? f(i * Core.DT) : null, ev); return ev; };
const speed = s => Math.hypot(s.bx - s.pbx, s.by - s.pby) / (Core.DT / Core.SUB);

// The legs of the climb: each a region the tub must come to rest in, in order.
const LEGS = [
  ['first crate', 2.3, 3.1, 1.25], ['past the crate', 3.6, 4.8, 0.4], ['crate stack', 5.3, 6.0, 2.15], ['boulder', 8.3, 9.8, 2.6],
  ['bow', 11.0, 13.0, 3.6], ['mast step', 11.8, 13.0, 6.2], ['mast cleat 1', 13.6, 14.4, 6.8], ['mast cleat 2', 14.7, 15.5, 8.1], ['mast cleat 3', 15.8, 16.6, 9.4], ['crow\'s nest', 17.2, 19.6, 11.6],
  ['wall step 1', 20.1, 21.2, 13.95], ['wall step 2', 21.1, 22.1, 16.05], ['wall step 3', 22.05, 23.05, 18.15], ['wall step 4', 23.0, 24.0, 20.25],
  ['wall top', 23.9, 25.0, 22.3], ['weed 1', 26.2, 27.8, 24.0], ['weed 2', 28.4, 30.2, 25.8], ['weed 3', 30.8, 32.6, 27.6], ['weed rock', 33.3, 36.0, 28.9],
  ['boom 1', 35.6, 39.6, 30.8], ['landing 1', 40.0, 42.0, 33.0], ['crate on the landing', 40.6, 41.4, 34.0], ['boom 2 cleat 1', 37.79, 38.59, 36.19], ['boom 2 cleat 2', 36.88, 37.68, 36.8], ['boom 2 cleat 3', 35.96, 36.76, 37.41], ['boom 2 cleat 4', 35.04, 35.84, 38.03], ['boom 2 cleat 5', 34.05, 34.85, 38.52], ['landing 2', 30.5, 33.6, 38.6],
  ['crate on landing 2', 29.0, 30.3, 40.4], ['foot plate', 31.0, 32.4, 42.1], ['boom 3 cleat 1', 33.65, 34.45, 43.41], ['boom 3 cleat 2', 34.88, 35.68, 44.17], ['boom 3 cleat 3', 36.12, 36.92, 44.92], ['boom 3 cleat 4', 37.35, 38.15, 45.67], ['boom 3 cleat 5', 38.59, 39.39, 46.43], ['boom 3 cleat 6', 39.82, 40.62, 47.18],
  ['landing 3', 41.9, 43.9, 47.8], ['crate on landing 3', 44.3, 45.1, 49.2], ['jib', 33.0, 38.0, 50.2], ['jib end', 27.6, 29.5, 50.0],
  ['cliff step 1', 25.1, 26.8, 52.0], ['cliff step 2', 23.1, 24.8, 54.0], ['cliff step 3', 21.1, 22.8, 56.0], ['chimney foot', 17.5, 19.5, 57.9],
  ...[59.4, 60.9, 62.4, 63.9, 65.4, 66.9, 68.4].map((y, k) => ['chimney ledge ' + (k + 1), k % 2 ? 18.6 : 17.6, k % 2 ? 19.3 : 18.3, y + 0.6]),
  ['chimney top', 19.5, 22, 70.3], ['west wall', 16.0, 17.4, 72.3], ['rock step 1', 14.8, 16.0, 74.3], ['rock step 2', 13.6, 14.8, 76.3], ['rock step 3', 12.4, 13.6, 78.3],
  ['rock top', 11.2, 12.4, 80.3], ['tower step 1', 10.0, 11.2, 82.3], ['tower step 2', 8.8, 10.0, 84.3], ['tower step 3', 7.6, 8.8, 86.3],
  ['the lamp', 6.4, 7.6, 88.3]
].map(([name, x0, x1, y]) => ({name, x0, x1, y}));

// A bot's hand: each keyframe is a point in the world, given as an offset from where the shoulder was when the
// keyframe began, reached along an eased path. Between keyframes the hand stays put, like a player's, so a hook
// planted on something stays planted while the tub moves.
function play(state, keys, settle = 1.2) {
  const s = Core.snapshot(state); let k = -1, kt = 0, from = [s.mx, s.my], to = from;
  const tot = keys.reduce((a, b) => a + b[2], 0), steps = Math.round((tot + settle) / Core.DT), ev = [];
  for (let i = 0; i < steps; i++) {
    while (k < keys.length && (k < 0 || kt >= keys[k][2])) {
      if (k >= 0) kt -= keys[k][2];
      from = to; k++;
      if (k < keys.length) { const sx = s.bx, sy = s.by + Core.PDY; to = [sx + Math.cos(keys[k][0]) * keys[k][1], sy + Math.sin(keys[k][0]) * keys[k][1]]; }
    }
    let tx = to[0], ty = to[1];
    if (k < keys.length) { const u = Math.min(1, kt / keys[k][2]), e = u * u * (3 - 2 * u); tx = from[0] + (to[0] - from[0]) * e; ty = from[1] + (to[1] - from[1]) * e; }
    Core.step(s, {dx: tx - s.mx, dy: ty - s.my}, ev); kt += Core.DT;
    if (i === steps - 30) { s._rx = s.bx; s._ry = s.by; }
  }
  s._ev = ev; return s;
}
const settled = s => s._rx == null || Math.hypot(s.bx - s._rx, s.by - s._ry) < 0.06; // moved under 6 cm in the last quarter second
const inLeg = (s, g) => s.bx >= g.x0 && s.bx <= g.x1 && s.by >= g.y && settled(s);
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
    // and he stays up when the hand stops: a planted push must not drain away (it once did, in about a second)
    const hold = Core.create(); run(hold, 1, () => ({cx: 0.5, cy: -0.85}));
    const hx0 = hold.mx, hy0 = hold.my, hn = Math.round(1 / Core.DT);
    for (let i = 0; i < hn; i++) Core.step(hold, {dx: hx0 - hold.mx, dy: (hy0 - 0.9 * (i + 1) / hn) - hold.my}, []);
    const up = hold.by; run(hold, 3, () => ({dx: 0, dy: 0}));
    ok(up > 1.8 && Math.abs(hold.by - up) < 0.25, 'pushed up on a planted hook, he stays up with the hand still: ' + up.toFixed(2) + ' -> ' + hold.by.toFixed(2));
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
        let sy = g.y + 0.2; const sx = (g.x0 + g.x1) / 2;
        while (Core.circle(sx, sy, Core.RB + 0.05, c).length || Core.circle(sx, sy + Core.TDY, Core.RT + 0.05, c).length || Core.circle(sx, sy + Core.PDY + 0.8, Core.RH + 0.05, c).length) sy += 0.1; // start clear of the rock
        const s = Core.create({x: sx, y: sy, cx: 0, cy: 0.8}); let r = seed * 7919 + i;
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
    const s = Core.create({x: 7.0, y: Core.TOP + Core.RB + 0.02, cx: 0.5, cy: 0.8}); const ev = run(s, 1);
    ok(ev.filter(e => e.type === 'summit').length === 1 && s.done, 'the gallery is the summit, and it is announced once');
    // falls are measured from the last perch
    // a tub let go twelve metres over open shingle lands as one fall of about that height
    const f = Core.create({x: 4.2, y: 12.2, cx: 0, cy: -0.5});
    const ev2 = run(f, 4);
    const fall = ev2.find(e => e.type === 'fall');
    ok(fall && fall.m > 10 && ev2.filter(e => e.type === 'fall').length === 1, 'a drop from 12 m onto the shingle is one fall of more than 10 m: ' + (fall ? fall.m.toFixed(1) : 'none'));
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
function solve(state, goal, seed, K = 5, iters = 10) {
  let r = seed >>> 0 || 1; const rnd = () => { r ^= r << 13; r >>>= 0; r ^= r >> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const mu = [], sd = []; for (let k = 0; k < K; k++) { mu.push([Math.PI / 2, 1.6, 0.4]); sd.push([1.8, 0.7, 0.25]); }
  const score = s => (s.bx < goal.x0 ? goal.x0 - s.bx : s.bx > goal.x1 ? s.bx - goal.x1 : 0) + Math.max(0, goal.y - s.by) * 1.5 + (settled(s) ? 0 : 0.3);
  let best = null;
  for (let it = 0; it < iters; it++) {
    const cand = [];
    for (let p = 0; p < 64; p++) {
      const keys = mu.map((m, k) => [m[0] + gauss() * sd[k][0], Math.min(Core.LMAX + 0.1, Math.max(Core.LMIN, m[1] + gauss() * sd[k][1])), Math.min(0.9, Math.max(0.06, m[2] + gauss() * sd[k][2]))]);
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
  let s = begin(), kept = 0;
  for (const d of sol) { const n2 = play(s, d.keys); if (!inLeg(n2, LEGS[kept])) break; s = n2; kept++; } // keep only the legs that still replay
  if (kept < sol.length) { console.log('legs ' + (kept + 1) + '..' + sol.length + ' no longer replay; searching again from leg ' + (kept + 1)); sol.length = kept; }
  for (let i = sol.length; i < LEGS.length; i++) {
    let b = null; const t0 = Date.now();
    for (let seed = 1; seed <= 8 && !(b && b.sc === 0); seed++) { const r = solve(s, LEGS[i], seed); if (!b || r.sc < b.sc) b = r; }
    // a hard leg gets a second, longer search with one more keyframe
    for (let seed = 9; seed <= 16 && !(b && b.sc === 0); seed++) { const r = solve(s, LEGS[i], seed, 6, 14); if (!b || r.sc < b.sc) b = r; }
    console.log((i + 1) + ' ' + LEGS[i].name + ': ' + (b.sc === 0 ? 'climbed' : 'STUCK at ' + b.s.bx.toFixed(2) + ', ' + b.s.by.toFixed(2)) + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    if (b.sc > 0) process.exit(1);
    sol.push({name: LEGS[i].name, keys: b.keys}); writeFileSync(ROUTE, JSON.stringify(sol)); s = play(s, sol[i].keys);
  }
}

// Slow suites, run only by name. `softlock` lets the tub come to rest at every free spot of the course (a 0.6 x 0.8 m
// grid), gives a hand random moves from each rest and records where the tub comes to rest again. From every rest some
// chain of such moves must lead onto the bot's route (or into the sea, which floats him back to the shingle): a rest
// that cannot is a pocket a player would be stuck in for good, like the old gap by the crow's nest.
const slow = {
  softlock() {
    const c = [], t0 = Date.now();
    const clear = (x, y, r) => !Core.circle(x, y, r, c).length && !Core.polys.some(o => Core.inside(o, x, y));
    const rests = [];
    for (let x = -6; x <= 46.4; x += 0.6) for (let y = 0.5; y <= 92; y += 0.8) {
      if (!clear(x, y, 0.5) || !clear(x, y + Core.TDY, Core.RT + 0.05)) continue;
      const dir = [[0, 1.2], [1.1, 0.5], [-1.1, 0.5], [0, -0.7]].find(([dx, dy]) => clear(x + dx, y + Core.PDY + dy, 0.3));
      if (!dir) continue;
      const s = Core.create({x, y, cx: dir[0], cy: dir[1]}); run(s, 2.5, () => ({dx: 0, dy: 0}));
      const a0 = [s.bx, s.by]; run(s, 0.25, () => ({dx: 0, dy: 0}));
      if (Math.hypot(s.bx - a0[0], s.by - a0[1]) > 0.03 || s.wet) continue; // still moving, or in the sea (which floats him ashore)
      if (rests.some(r => Math.hypot(r.bx - s.bx, r.by - s.by) < 0.45)) continue;
      rests.push(Core.serialize(s));
    }
    console.log('  ' + rests.length + ' places to rest, found in ' + Math.round((Date.now() - t0) / 1000) + ' s');
    // the places a player is known to get on from: the bot's route, from the shingle to the lamp
    const route = existsSync(ROUTE) ? JSON.parse(readFileSync(ROUTE, 'utf8')) : [];
    const good = []; { let st = begin(); good.push([st.bx, st.by]); for (const d of route) { st = play(st, d.keys); good.push([st.bx, st.by]); } }
    const nodes = rests.map(st => [st.bx, st.by]), N = nodes.length;
    const near = (x, y) => { let bi = -1, bd = 0.7; for (let i = 0; i < N; i++) { const d = Math.hypot(nodes[i][0] - x, nodes[i][1] - y); if (d < bd) { bd = d; bi = i; } } return bi; };
    const isGood = (x, y, wet) => wet || good.some(g => Math.hypot(g[0] - x, g[1] - y) < 0.8);
    // from each rest, a hand tries random moves; where the tub comes to rest again is an edge of the graph
    let r = 12345; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const edges = rests.map(() => new Set()), ok0 = rests.map(st => isGood(st.bx, st.by, false));
    rests.forEach((st, i) => {
      const s0 = Core.restore(st);
      for (let k = 0; k < 40; k++) {
        const keys = []; for (let j = 0; j < 4; j++) keys.push([rnd() * Math.PI * 2, Core.LMIN + rnd() * (Core.LMAX - Core.LMIN), 0.15 + rnd() * 0.55]);
        const e = play(s0, keys);
        if (isGood(e.bx, e.by, e.wet)) { ok0[i] = true; break; }
        const j = near(e.bx, e.by); if (j >= 0 && j !== i) edges[i].add(j);
      }
    });
    // a rest is fine if some chain of moves leads from it to a place on the route (or into the sea, which floats him home)
    const fine = ok0.slice(); let changed = true;
    while (changed) { changed = false; for (let i = 0; i < N; i++) if (!fine[i]) for (const j of edges[i]) if (fine[j]) { fine[i] = true; changed = true; break; } }
    const stuck = nodes.filter((_, i) => !fine[i]).map(q => q[0].toFixed(2) + ', ' + q[1].toFixed(2));
    ok(!stuck.length, 'from every place he can come to rest, some way leads back onto the route: ' + (stuck.length ? stuck.length + ' cut off: ' + stuck.join(' | ') : N + ' places, ' + Math.round((Date.now() - t0) / 1000) + ' s'));
  }
};
if (process.argv.includes('--record')) record();
else {
  const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
  for (const [name, fn] of Object.entries(suites).concat(Object.entries(slow).filter(([k]) => want.includes(k)))) if (!want.length && !(name in slow) || want.includes(name)) { const f0 = fails; fn(); console.log(name + ': ' + (fails === f0 ? 'ok' : (fails - f0) + ' failed')); }
  console.log(fails ? fails + ' of ' + n + ' checks failed' : 'all ' + n + ' checks passed');
  process.exit(fails ? 1 : 0);
}
