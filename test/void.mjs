#!/usr/bin/env node
// Test suite for games/void.html (VOID).
//
// Runs the page's DOM-free <script id="core"> block in Node. A black-hole game promises three things nobody can see from the
// page: that the world is one world however you meet it (the same street whichever order its cells are asked for, nothing
// overlapping, the start never inside a road), that the rules are exactly what the picture says (a thing falls only if it fits,
// the hole grows by the area it ate, the clock pays for size), and that you are never left hungry: at every size there is something
// that fits within reach, and bots with a person's reaction time are paid in order of their skill. No browser, no server.
// The `page` suite (Playwright's Chromium, skipped without it) plays the real page on a laptop and a phone.
//
//   node test/void.mjs                 # everything
//   node test/void.mjs world rules     # named suites only
//   node test/void.mjs --page=path.html
//
// Suites: catalogue, world, rules, scale, fair, bots, save, page.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import http from 'http';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'void.html'));
const ALL = ['catalogue', 'world', 'rules', 'scale', 'fair', 'bots', 'save', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const seen = new Map();
const fail = (what, detail) => { failures++; const n = (seen.get(what) || 0) + 1; seen.set(what, n); if (n <= 3) console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.VOID = VOID;', ctx);
const V = ctx.VOID;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
const PALETTE = new Set(['ink', 'cre', 'tom', 'och', 'tea', 'mos', 'plu', 'sky', 'sla', 'san', 'whi', 'gol', 'mag', 'sea', 'ice', 'win', '$']);
const PARTS = {B: 8, C: 7, K: 7, S: 6, D: 6, G: 8, O: 7, H: 7, W: 6, Y: 5, A: 6, F: 8, P: 7, T: 6, M: 9};

// a person at the stick: sees five hole-radii, picks the thing that is worth most for the distance, reacts after `react` seconds
function play(seed, o) {
  const s = V.newRun(seed), dt = 1 / 30, max = o.max || 400;
  let tgt = null, rt = 0, wob = 0, r = seed * 7 + 1;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  while (!s.over && s.t < max) {
    const H = s.hole, R = H.R; rt -= dt;
    if (!tgt || s.eaten.has(tgt.id) || rt <= 0) {
      const reach = R * (o.look || 4.5), c = V.query(s.seed, H.x - reach, H.x + reach, H.y - reach, H.y + reach, R * .1, R * V.WALL, s.eaten, []);
      let best = -1; tgt = null;
      for (const q of c) { if (V.presence(q.r, R, q.u) < .5) continue; const d = Math.hypot(q.x - H.x, q.y - H.y), sc = (q.r * q.r + .05 * R * R) / ((d + R) * (d + R)); if (sc > best) { best = sc; tgt = q; } }
      rt = (o.react || .5) * (.7 + .6 * rnd()); wob = (rnd() - .5) * 2 * (o.err || 0);
    }
    const spd = o.spd || 1; let ix, iy;
    if (o.idle) { ix = iy = 0; }
    else if (tgt) { const a = Math.atan2(tgt.y - H.y, tgt.x - H.x) + wob; ix = Math.cos(a) * spd; iy = Math.sin(a) * spd; }
    else { ix = Math.cos(s.t * .3) * spd; iy = Math.sin(s.t * .3) * spd; }
    V.step(s, dt, {x: ix, y: iy}); s.events.length = 0;
  }
  return s;
}

if (suites.includes('catalogue')) {
  section('catalogue');
  const ids = new Set();
  for (const k of V.KINDS.concat(V.BEYOND)) {
    check(!ids.has(k.id), 'kind ids are unique', k.id); ids.add(k.id);
    check(k.r > 0 && isFinite(k.r) && k.parts.length > 0, 'a kind has a size and a shape', k.id);
    for (const c of k.pal) check(PALETTE.has(c), 'palette colours are known', k.id + ':' + c);
    for (const p of k.parts) {
      check(PARTS[p[0]] === p.length, 'a part has the arguments its type takes', k.id + ':' + p[0] + ' has ' + p.length);
      const col = p[p.length - 1];
      check(PALETTE.has(col), 'part colours are known', k.id + ':' + col);
      check(p.slice(1, -1).every(v => typeof v === 'number' && isFinite(v)), 'part numbers are numbers', k.id + ':' + p[0]);
    }
  }
  for (let n = 0; n <= 27; n++) check((V.LAYERS[n] || []).length >= 2, 'every size from a can to a galaxy has at least two kinds', 'layer ' + n);
  for (let n = 0; n <= 27; n++) { const ks = V.LAYERS[n] || []; check(ks.some(k => k.zone === 'road' || k.zone === 'walk' || k.zone === 'lot') || n > 13, 'each of the city\'s first fourteen sizes has a kind a street can place (lane, footpath or lot)', 'layer ' + n); }
  const rs = V.KINDS.map(k => k.r); check(Math.min(...rs) < V.R0 * V.WALL, 'the first thing fits the first hole', 'smallest ' + Math.min(...rs));
  check(V.CHAPTERS.length === 4 && V.CHAPTERS.map(c => c.from).join() === '0,7,14,21', 'four chapters, seven sizes apart');
  for (let c = 0; c < 4; c++) { const lo = V.CHAPTERS[c].from, hi = c < 3 ? V.CHAPTERS[c + 1].from : 28; let n = 0; for (let l = lo; l < hi; l++) n += (V.LAYERS[l] || []).length; check(n >= 18, 'each chapter has enough different things to look at', V.CHAPTERS[c].name + ' ' + n); }
}

if (suites.includes('world')) {
  section('world');
  const sx = V.SX, sy = V.SY;
  // the start: on a footpath at a junction of the finest streets and inside a lot at every larger road
  const z = V.zoneAt(sx, sy); check(z.zone === 'walk', 'the first night starts on a footpath', JSON.stringify(z));
  for (let k = 1; k <= 6; k++) { const P = 48 * Math.pow(10, k), d = Math.min(sx % P, P - sx % P); check(d > P * .1875 / 2 + P * .05, 'the start is clear of the roads of tier ' + k, `${d} of ${P}`); }
  // the same street whichever order it is asked for
  for (const seed of [11, 4242, 987654]) {
    V.clearMemo();
    const rect = [sx - 60, sx + 60, sy - 60, sy + 60];
    const a = V.query(seed, ...rect, .05, 1e5, null, []).map(o => o.id + '@' + o.x.toFixed(4) + ',' + o.y.toFixed(4)).sort();
    V.clearMemo();
    for (const [i, j] of [[3, 7], [-5, 2], [9, -9], [0, 0]]) V.query(seed + 1, sx + i * 40, sx + i * 40 + 5, sy + j * 40, sy + j * 40 + 5, .01, 1e5, null, []);   // ask for other places first
    for (let n = 14; n >= 0; n--) V.query(seed, sx - 70, sx + 70, sy - 70, sy + 70, V.lo(n), V.lo(n + 1), null, []);                                              // and in a different layer order
    const b = V.query(seed, ...rect, .05, 1e5, null, []).map(o => o.id + '@' + o.x.toFixed(4) + ',' + o.y.toFixed(4)).sort();
    check(a.length > 50 && a.join('|') === b.join('|'), 'a street is the same whichever order it is met in', `${a.length} vs ${b.length}`);
  }
  // nothing overlaps (any two things in the same patch of ground, whatever their layers)
  for (const seed of [3, 4242]) {
    V.clearMemo();
    for (const [lo, hi, box] of [[.02, 3, 25], [1, 40, 120], [30, 900, 900], [600, 40000, 30000], [3e4, 5e6, 3e6]]) {
      const l = V.query(seed, sx - box, sx + box, sy - box, sy + box, lo, hi, null, []).slice(0, 900);
      let bad = 0;
      for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
        const a = l[i], b = l[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        const gap = (Math.abs(a.layer - b.layer) <= 6 && !(a.layer > b.layer ? a : b).kind.plate) || a.layer === b.layer;
        if (gap && d < (a.r + b.r) * .985 - 1e-9) bad++;
      }
      check(bad === 0, 'things within six sizes of each other never overlap (ground, a country, a continent, a glacier, a storm, carries things instead)', `${bad} of ${l.length} at ${lo}-${hi}`);
    }
  }
  // zones: vehicles on roads, benches on footpaths, houses on lots; nothing stands in the opening handful
  V.clearMemo();
  const all = V.query(77, sx - 140, sx + 140, sy - 140, sy + 140, .05, 40, null, []);
  const bad = {road: 0, walk: 0, lot: 0}, cnt = {road: 0, walk: 0, lot: 0};
  for (const o of all) { if (o.layer > 6 || o.kind.zone === 'any' || o.id.startsWith('pre')) continue; cnt[o.kind.zone]++; if (V.zoneAt(o.x, o.y).zone !== o.kind.zone) bad[o.kind.zone]++; }
  check(cnt.road > 10 && cnt.walk > 10 && cnt.lot > 10 && bad.road + bad.walk + bad.lot === 0, 'cars stand on roads, benches on footpaths, houses on lots', JSON.stringify({cnt, bad}));
  // yaw follows the road
  for (const o of all) if (o.kind.zone === 'road' && o.layer <= 6) { const zz = V.zoneAt(o.x, o.y); if (zz.yaw >= 0) { const d = Math.abs(Math.sin(o.yaw - zz.yaw)); check(d < 1e-6, 'a car lies along its road', o.id); } }
  // the opening handful
  const run = V.newRun(5);
  check(V.PRELUDE.length === 5 && V.PRELUDE.every(p => p.r <= run.hole.R * V.WALL && Math.hypot(p.x - sx, p.y - sy) < run.hole.R * 4.2), 'five things that fit lie within four radii of the start');
  const near = V.query(5, sx - 8, sx + 8, sy - 8, sy + 8, .05, 3, null, []).filter(o => !o.id.startsWith('pre'));
  check(near.every(o => V.PRELUDE.every(p => Math.hypot(p.x - o.x, p.y - o.y) >= p.r + o.r)), 'nothing else stands where the opening handful lies');
  // the street is not the same everywhere: different seeds, different streets
  const sig = seed => V.query(seed, sx - 30, sx + 30, sy - 30, sy + 30, .1, 30, null, []).map(o => o.kind.id).join();
  check(sig(1) !== sig(2) && sig(2) !== sig(3), 'a seed is a street');
  // days
  check(V.daySeed('2026-10-09') === V.daySeed('2026-10-09') && V.daySeed('2026-10-09') !== V.daySeed('2026-10-10') && V.daySeed('x') > 0, 'a day has one seed for everyone');
}

if (suites.includes('rules')) {
  section('rules');
  const sx = V.SX, sy = V.SY;
  // a thing that fits falls when the hole is over it; one that does not never does
  for (const [id, fits] of [['can', true], ['bin', true], ['car', false], ['bus', false]]) {
    V.clearMemo();
    const s = V.newRun(9), k = V.KINDS.find(q => q.id === id), o = {id: 'test:' + id, kind: k, layer: k.layer, x: sx, y: sy, r: k.r, yaw: 0, pick: 0, u: 0, seed: 1};
    s.hole.R = 1.0; s.hole.x = sx; s.hole.y = sy;
    const orig = V.query; // put the thing in the world by stacking it into the opening handful
    V.PRELUDE.length = 0; V.PRELUDE.push(o);
    V.step(s, 1 / 60, null);
    check(s.eaten.has(o.id) === fits && (k.r <= .8) === fits, id + (fits ? ' falls when it fits' : ' does not fall when it is bigger than the hole'), JSON.stringify([k.r, s.eaten.has(o.id)]));
    V.PRELUDE.length = 0;
  }
  // restore the handful for the rest of the suite
  { const ids = ['can', 'cone', 'ball', 'can', 'bottle'], ang = [-2.2, -.9, .5, 1.7, 2.7], dist = [1.05, 1.5, 1.2, 1.6, 1.0]; for (let i = 0; i < 5; i++) { const k = V.KINDS.find(q => q.id === ids[i]); V.PRELUDE.push({id: 'pre:' + i, kind: k, layer: 0, x: sx + Math.cos(ang[i]) * dist[i], y: sy + Math.sin(ang[i]) * dist[i], r: k.r, yaw: ang[i] * 2, pick: i, u: 0, seed: i * 77}); } V.clearMemo(); }
  // a thing just outside the reach stays, one just inside falls
  { const k = V.KINDS.find(q => q.id === 'crate'); const s = V.newRun(2); s.hole.R = 1.2; V.PRELUDE.length = 0;
    const inside = {id: 't:in', kind: k, layer: k.layer, x: sx + 1.2 * 1.02 - k.r * .12 - .02, y: sy, r: k.r, yaw: 0, pick: 0, u: 0, seed: 1}, outside = {id: 't:out', kind: k, layer: k.layer, x: sx - (1.2 * 1.02 - k.r * .12 + .02), y: sy, r: k.r, yaw: 0, pick: 0, u: 0, seed: 2};
    V.PRELUDE.push(inside, outside); V.step(s, 1 / 60, null);
    check(s.eaten.has('t:in') && !s.eaten.has('t:out'), 'a thing a hair inside the lip falls and one a hair outside does not');
    V.PRELUDE.length = 0; }
  { const ids = ['can', 'cone', 'ball', 'can', 'bottle'], ang = [-2.2, -.9, .5, 1.7, 2.7], dist = [1.05, 1.5, 1.2, 1.6, 1.0]; for (let i = 0; i < 5; i++) { const k = V.KINDS.find(q => q.id === ids[i]); V.PRELUDE.push({id: 'pre:' + i, kind: k, layer: 0, x: sx + Math.cos(ang[i]) * dist[i], y: sy + Math.sin(ang[i]) * dist[i], r: k.r, yaw: ang[i] * 2, pick: i, u: 0, seed: i * 77}); } V.clearMemo(); }
  // growth is area: R^2 rises by kappa * r^2 for every bite, exactly, and the clock pays for size
  { const s = V.newRun(31); let sum = 0, tl = s.timeLeft, expectBonus = 0; const dt = 1 / 30; let tgt = null, bites = 0, ok = true, last = s.hole.R;
    for (let i = 0; i < 30 * 40 && !s.over; i++) {
      const H = s.hole, R = H.R, reach = R * 5, c = V.query(s.seed, H.x - reach, H.x + reach, H.y - reach, H.y + reach, R * .1, R * V.WALL, s.eaten, []);
      let best = 1e9; tgt = null; for (const q of c) { if (V.presence(q.r, R, q.u) < .5) continue; const d = Math.hypot(q.x - H.x, q.y - H.y); if (d < best) { best = d; tgt = q; } }
      const lvl = s.level, R0 = H.R; V.step(s, dt, tgt ? {x: (tgt.x - H.x), y: (tgt.y - H.y)} : {x: 1, y: .3});
      for (const e of s.events) { if (e.type === 'swallow') { bites++; } }
      s.events.length = 0;
    }
    check(bites > 40, 'a careful bot eats plenty in forty seconds', String(bites));
    // exact bookkeeping: replay with a recorder
    const t = V.newRun(31); let area = V.R0 * V.R0, steps = 0, exact = true, lv = 0;
    for (let i = 0; i < 30 * 30; i++) {
      const H = t.hole, R = H.R, c = V.query(t.seed, H.x - R * 5, H.x + R * 5, H.y - R * 5, H.y + R * 5, R * .1, R * V.WALL, t.eaten, []);
      let b = null, bd = 1e9; for (const q of c) { if (V.presence(q.r, R, q.u) < .5) continue; const d = Math.hypot(q.x - H.x, q.y - H.y); if (d < bd) { bd = d; b = q; } }
      V.step(t, dt, b ? {x: b.x - H.x, y: b.y - H.y} : {x: 1, y: 0});
      for (const e of t.events) if (e.type === 'swallow') { const k = V.kappa(lv); area += k * e.o.r * e.o.r; steps++; }
      // levels are announced in the step that grew the hole, after the bite; track the level the bite was made at
      lv = t.level; t.events.length = 0;
      if (Math.abs(Math.sqrt(area) - t.hole.R) > 1e-6 * t.hole.R + 1e-9 && steps) { exact = false; break; }
    }
    check(exact, 'the hole grows by the area it ate, bite by bite', `${Math.sqrt(area)} vs ${t.hole.R}`);
  }
  // levels: announced once each, in order, never skipped, each with a bonus, and the chapter flag only at 7, 14, 21
  { const s = V.newRun(88), seenL = []; const dt = 1 / 30;
    for (let i = 0; i < 30 * 200 && !s.over; i++) {
      const H = s.hole, R = H.R, c = V.query(s.seed, H.x - R * 5, H.x + R * 5, H.y - R * 5, H.y + R * 5, R * .1, R * V.WALL, s.eaten, []);
      let b = null, bd = 1e9; for (const q of c) { if (V.presence(q.r, R, q.u) < .5) continue; const d = Math.hypot(q.x - H.x, q.y - H.y); if (d < bd) { bd = d; b = q; } }
      V.step(s, dt, b ? {x: b.x - H.x, y: b.y - H.y} : {x: 1, y: .2});
      for (const e of s.events) if (e.type === 'level') seenL.push(e); s.events.length = 0;
    }
    check(seenL.length >= 8 && seenL.every((e, i) => e.level === i + 1), 'sizes are announced once each, in order, none skipped', seenL.map(e => e.level).join());
    check(seenL.every(e => e.bonus >= V.TUNE.bonusMin - 1e-9 && e.bonus <= V.TUNE.bonus0), 'every new size pays a bonus within its limits');
    check(seenL.every(e => e.chapterChanged === (e.level === 7 || e.level === 14 || e.level === 21)), 'a chapter changes at 7, 14 and 21 and nowhere else');
    check(seenL.every((e, i) => i === 0 || e.bonus <= seenL[i - 1].bonus + 1e-9), 'the bonus for a size never grows');
  }
  // the moment the game is about: what a bite unlocks is announced, and is exactly what was a wall a moment ago and fits now
  { const s = V.newRun(88), dt = 1 / 30; let unlocks = 0, ok = true, prevR = s.hole.R;
    for (let i = 0; i < 30 * 60 && !s.over; i++) {
      const H = s.hole, R = H.R, c = V.query(s.seed, H.x - R * 5, H.x + R * 5, H.y - R * 5, H.y + R * 5, R * .1, R * V.WALL, s.eaten, []);
      let b = null, bd = 1e9; for (const q of c) { if (V.presence(q.r, R, q.u) < .5) continue; const d = Math.hypot(q.x - H.x, q.y - H.y); if (d < bd) { bd = d; b = q; } }
      const R0 = H.R; V.step(s, dt, b ? {x: b.x - H.x, y: b.y - H.y} : {x: 1, y: .2});
      for (const e of s.events) if (e.type === 'unlock') { unlocks++; for (const q of e.list) if (!(q.r > R0 * V.WALL * .999 && q.r <= s.hole.R * V.WALL * 1.001) || s.eaten.has(q.id)) ok = false; }
      s.events.length = 0;
    }
    check(unlocks > 10 && ok, 'a bite announces what it has just made swallowable, and only that', `${unlocks} unlocks`); }
  // the clock: it runs down at one second a second, an idle hole ends exactly when the time is up, and the run ends once
  { const s = V.newRun(1); let ends = 0, tt = 0; while (!s.over && tt < 100) { V.step(s, 1 / 60, null); tt += 1 / 60; for (const e of s.events) if (e.type === 'end') ends++; s.events.length = 0; }
    check(ends === 1 && near(s.t, V.TUNE.T0, .01) && s.timeLeft === 0 && s.level === 0, 'an idle hole runs out of time at the second it was given and the run ends once', `${s.t}`);
    const t = s.t; V.step(s, .5, {x: 1, y: 0}); check(s.t === t, 'a finished run does not move'); }
  // movement does not depend on the frame rate: the same stick for the same seconds goes to the same place
  { const end = fps => { const s = V.newRun(5); const n = Math.round(fps * 4); for (let i = 0; i < n; i++) { V.step(s, 1 / fps, {x: .6, y: -.4}); s.events.length = 0; } return s.hole; };
    const a = end(30), b = end(60), c = end(120); const R = V.R0;
    check(Math.hypot(a.x - c.x, a.y - c.y) < R * .2 && Math.hypot(b.x - c.x, b.y - c.y) < R * .1, 'thirty, sixty and a hundred and twenty frames a second travel the same road', JSON.stringify([a.x - c.x, a.y - c.y, b.x - c.x, b.y - c.y]));
    const h = end(60); check(Math.hypot(h.vx, h.vy) <= V.vmax(h.R) * 1.0001, 'the hole never moves faster than its top speed'); }
  // a big mouthful buys more time than a crumb
  { const k1 = V.KINDS.find(q => q.id === 'can'), k2 = V.KINDS.find(q => q.id === 'crate'); const bite = k => { const s = V.newRun(3); V.PRELUDE.length = 0; s.hole.R = 1; V.PRELUDE.push({id: 'b', kind: k, layer: k.layer, x: s.hole.x, y: s.hole.y, r: k.r, yaw: 0, pick: 0, u: 0, seed: 1}); const t0 = s.timeLeft; V.step(s, 0, null); return s.timeLeft - t0; };
    const a = bite(k1), b = bite(k2); check(b > a && a >= 0, 'a big bite buys more time than a crumb', `${a} ${b}`);
    V.PRELUDE.length = 0; const ids = ['can', 'cone', 'ball', 'can', 'bottle'], ang = [-2.2, -.9, .5, 1.7, 2.7], dist = [1.05, 1.5, 1.2, 1.6, 1.0]; for (let i = 0; i < 5; i++) { const k = V.KINDS.find(q => q.id === ids[i]); V.PRELUDE.push({id: 'pre:' + i, kind: k, layer: 0, x: V.SX + Math.cos(ang[i]) * dist[i], y: V.SY + Math.sin(ang[i]) * dist[i], r: k.r, yaw: ang[i] * 2, pick: i, u: 0, seed: i * 77}); } V.clearMemo(); }
  // touching something too big is reported once per touch
  { const s = V.newRun(4); const k = V.KINDS.find(q => q.id === 'car'); V.PRELUDE.length = 0; V.PRELUDE.push({id: 'big', kind: k, layer: k.layer, x: s.hole.x + .1, y: s.hole.y, r: k.r, yaw: 0, pick: 0, u: 0, seed: 1});
    let bonks = 0; for (let i = 0; i < 20; i++) { V.step(s, 1 / 60, null); for (const e of s.events) if (e.type === 'bonk') bonks++; s.events.length = 0; }
    check(bonks === 1 && !s.eaten.has('big'), 'resting on something too big is one knock, not twenty', String(bonks));
    V.PRELUDE.length = 0; const ids = ['can', 'cone', 'ball', 'can', 'bottle'], ang = [-2.2, -.9, .5, 1.7, 2.7], dist = [1.05, 1.5, 1.2, 1.6, 1.0]; for (let i = 0; i < 5; i++) { const q = V.KINDS.find(z => z.id === ids[i]); V.PRELUDE.push({id: 'pre:' + i, kind: q, layer: 0, x: V.SX + Math.cos(ang[i]) * dist[i], y: V.SY + Math.sin(ang[i]) * dist[i], r: q.r, yaw: ang[i] * 2, pick: i, u: 0, seed: i * 77}); } V.clearMemo(); }
  // presence: nothing appears as you grow, small things thin out and then go
  { let monotone = true; for (let i = 0; i < 400; i++) { const u = (i * 0.618) % 1, r = .3; let prev = 2; for (let R = .5; R < 60; R *= 1.07) { const p = V.presence(r, R, u); if (p > prev + 1e-9) monotone = false; prev = p; } }
    check(monotone, 'as the hole grows a thing is only ever fainter, never fresher'); check(V.presence(1, 1, .99) === 1 && V.presence(.001, 1, .5) === 0, 'big things are always there, dust is not'); }
}

if (suites.includes('scale')) {
  section('scale');
  let prev = -1, mono = true;
  for (let L = -1; L <= 45; L += .05) { const m = V.log10Size(L); if (m <= prev) mono = false; prev = m; }
  check(mono, 'the size of the hole only grows with its level');
  const t0 = V.sizeText(0), t7 = V.sizeText(7), t14 = V.sizeText(14), t21 = V.sizeText(21), t28 = V.sizeText(28);
  check(t0.unit === 'm' && near(t0.m, .8, 1e-6), 'the first hole is eighty centimetres across', JSON.stringify(t0));
  check(t7.unit === 'm' && t7.m > 40 && t7.m < 80, 'a city-sized hole is tens of metres', JSON.stringify(t7));
  check(t14.unit === 'km' && t14.m > 3000 && t14.m < 6000, 'a world-sized hole is kilometres', JSON.stringify(t14));
  check(t28.m > 1e20 && /ly$/.test(t28.unit), 'the last chapter ends in light-years', JSON.stringify(t28));
  for (let L = 0; L <= 60; L += .37) { const t = V.sizeText(L); check(/^\d{1,4}(\.\d{1,2})?$/.test(t.digits) && t.digits.replace('.', '').length <= 4 && t.unit.length > 0 && t.unit.length <= 18, 'the odometer always has four figures or fewer', `${L}: ${JSON.stringify(t)}`); }
  check(V.likeText(.8) === 'a manhole cover' && V.likeText(6e5).length > 0 && V.likeText(1e30).length > 0, 'every size is like something');
  check(V.chapterOfLevel(0) === 0 && V.chapterOfLevel(6.9) === 0 && V.chapterOfLevel(7) === 1 && V.chapterOfLevel(21) === 3 && V.chapterOfLevel(99) === 3, 'chapters begin where they say');
  check(near(V.levelOfR(V.R0), 0) && near(V.levelOfR(V.R0 * V.F), 1) && V.layerOfR(.2) === 0 && V.layerOfR(.4) === 1, 'level and layer are the logarithms they say');
}

if (suites.includes('fair')) {
  section('fair');
  // at every size, wherever you stand, something that fits is in reach and a bigger kind is in sight
  let worst = 1e9, worstAt = '', samples = 0, missed = 0;
  for (let L = 0; L <= 36; L += 1.5) {
    const R = V.R0 * Math.pow(V.F, L);
    for (const seed of [1, 4242, 777]) for (const [ox, oy] of [[0, 0], [37, -20], [-90, 55], [400, 400], [-1e3, 300]]) {
      V.clearMemo();
      const x = V.SX + ox * R / 4, y = V.SY + oy * R / 4;
      const reach = Math.max(R * 9, 8);   // nine radii, but a bus is longer than nine radii of the first hole
      const c = V.query(seed, x - reach, x + reach, y - reach, y + reach, R * .1, R * V.WALL, null, []).filter(o => V.presence(o.r, R, o.u) >= .5);
      const within = c.filter(o => Math.hypot(o.x - x, o.y - y) < reach).length;
      if (within < worst) { worst = within; worstAt = `L${L} seed ${seed} at ${ox},${oy}`; }
      const big = V.query(seed, x - R * 12, x + R * 12, y - R * 12, y + R * 12, R * V.WALL * 1.01, R * 8, null, []);
      const far = V.query(seed, x - R * 30, x + R * 30, y - R * 30, y + R * 30, R * V.WALL * 1.01, R * 12, null, []);
      samples++; if (!big.length) missed++;
      check(far.length >= 1, 'something bigger than the hole is always within thirty radii, so there is always a next size to want', `L${L} seed ${seed}`);
    }
  }
  check(missed / samples <= .05, 'something bigger than the hole is in sight from almost everywhere', `${missed} of ${samples}`);
  check(worst >= 4, 'at every size, anywhere, at least four things that fit are within nine radii (eight metres at the start)', `${worst} at ${worstAt}`);
  // not too crowded either: no more than a few hundred things in a nine-radius circle
  { let most = 0; for (let L = 0; L <= 30; L += 3) { const R = V.R0 * Math.pow(V.F, L); V.clearMemo(); const c = V.query(5, V.SX - R * 9, V.SX + R * 9, V.SY - R * 9, V.SY + R * 9, R * .1, R * V.WALL, null, []).filter(o => V.presence(o.r, R, o.u) >= .03); most = Math.max(most, c.length); }
    check(most < 400, 'never more than four hundred things to draw that fit', String(most)); }
}

if (suites.includes('bots')) {
  section('bots');
  const kinds = {
    expert: {react: .25, spd: 1, err: .05}, good: {react: .6, spd: .9, err: .25}, casual: {react: 1.1, spd: .75, err: .5, look: 3.5}, sloppy: {react: 1.6, spd: .6, err: .9, look: 3},
  };
  const res = {};
  for (const k in kinds) { res[k] = [11, 22].map(sd => play(sd * 101, {...kinds[k], max: 800})); }
  const lv = k => res[k].reduce((a, s) => a + s.level, 0) / res[k].length, sec = k => res[k].reduce((a, s) => a + s.t, 0) / res[k].length;
  console.log('  levels: ' + Object.keys(kinds).map(k => `${k} ${lv(k).toFixed(0)} in ${sec(k).toFixed(0)}s`).join(', '));
  check(lv('expert') > lv('good') && lv('good') > lv('casual') && lv('casual') > lv('sloppy'), 'bots are paid in order of their skill');
  check(lv('sloppy') >= 5 && sec('sloppy') > 90, 'even a sloppy player gets out of the first chapter, and has a minute and a half', `${lv('sloppy')} ${sec('sloppy')}`);
  check(lv('casual') >= 12 && sec('casual') > 150 && sec('casual') < 360, 'a casual player reaches the city and the world in three to five minutes', `${lv('casual')} ${sec('casual')}`);
  check(lv('good') >= 21, 'a good player reaches the cosmos', String(lv('good')));
  check(res.good.every(s => s.over), 'a good player is still beaten by the clock in the end', res.good.map(s => s.t).join());
  const idle = play(5, {idle: true, max: 200}); check(idle.over && idle.level === 0 && near(idle.t, V.TUNE.T0, .02), 'a hole that never moves is gone when the clock says', `${idle.t} ${idle.level}`);
  // nobody starves on the way: every seed gets to size 3 within 45 s for a casual player
  for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) { const s = play(sd * 313, {...kinds.casual, max: 45}); check(s.level >= 3, 'no street leaves a casual player hungry in the first 45 seconds', `seed ${sd * 313}: level ${s.level}`); }
}

if (suites.includes('save')) {
  section('save');
  const c = V.cleanSave(null); check(c.best === 0 && c.runs === 0 && !c.mute && Object.keys(c.days).length === 0, 'no save is a fresh save');
  const h = V.cleanSave({best: 1e99, runs: -5, eaten: 'many', mute: 'yes', hinted: 1, bestName: 'x'.repeat(500), lastSeed: -1, days: {'2026-10-09': 7, 'bad': 9, '2026-10-10': NaN, '20-1-1': 3}});
  check(h.best === 80 && h.runs === 0 && h.eaten === 0 && h.mute === false && h.hinted === false && h.bestName.length === 40 && h.lastSeed === 0, 'hostile numbers are clamped and hostile types refused', JSON.stringify(h));
  check(Object.keys(h.days).join() === '2026-10-09' && h.days['2026-10-09'] === 7, 'only real days with real numbers are kept');
  const many = {}; for (let i = 0; i < 200; i++) many['2026-' + String(1 + i % 12).padStart(2, '0') + '-' + String(1 + (i * 7) % 28).padStart(2, '0')] = 1; check(Object.keys(V.cleanSave({days: many}).days).length <= 60, 'a save keeps at most sixty days');
  const good = {best: 12.5, bestName: 'bus', days: {'2026-10-09': 12.5}, runs: 3, eaten: 400, hinted: true, mute: true, lastSeed: 99}; check(JSON.stringify(V.cleanSave(good)) === JSON.stringify(good), 'a good save comes back exactly');
  check(V.dayKey(new Date(2026, 9, 9)) === '2026-10-09', 'a day is year-month-day');
}

async function page() {
  section('page');
  let chromium = null;
  try { ({chromium} = await import('playwright')); } catch (e) { try { const {createRequire} = await import('module'); const {execSync} = await import('child_process'); chromium = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright').chromium; } catch (e2) {} }
  if (!chromium) { console.log('  skipped: Playwright is not installed'); return; }
  const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  const server = http.createServer((q, s) => { s.setHeader('content-type', 'text/html; charset=utf-8'); s.end(HTML); }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`, errors = [];
  const open = async (o = {}) => {
    const c = await browser.newContext({viewport: o.phone ? {width: 390, height: 844} : {width: 1280, height: 720}, hasTouch: !!o.phone, isMobile: !!o.phone, reducedMotion: o.reduced ? 'reduce' : 'no-preference'});
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(url + (o.q || '')); await p.waitForFunction(() => window.__void); return {c, p};
  };
  const bot = `window.__bot = (S => { let tgt = null, rt = 0; return dt => { const run = S.run; if (!run || run.over) return; const V = __void.VOID, H = run.hole, R = H.R; rt -= dt;
    if (!tgt || run.eaten.has(tgt.id) || rt <= 0) { const r = R * 5, c = V.query(run.seed, H.x - r, H.x + r, H.y - r, H.y + r, R * .1, R * .8, run.eaten, []); let best = -1; tgt = null; for (const o of c) { if (V.presence(o.r, R, o.u) < .5) continue; const d = Math.hypot(o.x - H.x, o.y - H.y), sc = (o.r * o.r + .05 * R * R) / ((d + R) ** 2); if (sc > best) { best = sc; tgt = o; } } rt = .45; }
    if (tgt) { const dx = tgt.x - H.x, dy = tgt.y - H.y, d = Math.hypot(dx, dy) || 1; S.input.drive = {x: dx / d * .9, y: dy / d * .9}; } else S.input.drive = {x: Math.cos(S.rt), y: Math.sin(S.rt)}; }; })(__void.S)`;
  for (const o of [{name: 'laptop'}, {name: 'phone', phone: true}, {name: 'reduced motion', reduced: true}]) {
    const {c, p} = await open(o);
    check(await p.evaluate(() => __void.S.mode) === 'title', o.name + ': it opens on the title, with the hole as the button');
    check(await p.isVisible('#playhole') && await p.isVisible('#wordmark'), o.name + ': the title shows the wordmark and the hole to press');
    await p.click('#playhole');
    check(await p.evaluate(() => __void.S.mode) === 'play' && await p.isVisible('#hud'), o.name + ': pressing the hole starts a run and shows the clock');
    await p.evaluate(bot);
    // play a minute of game time, stepping by hand so the test does not depend on the machine
    await p.evaluate(() => { for (let i = 0; i < 60 * 25; i++) { __bot(1 / 60); __void.tick(1 / 60, 1); } });
    const st = await p.evaluate(() => ({lvl: __void.S.run.level, n: __void.S.run.count, mode: __void.S.mode, t: __void.S.run.t}));
    check(st.n > 20 && st.lvl >= 2 && st.mode === 'play', o.name + ': twenty-five seconds of play eat things and grow', JSON.stringify(st));
    check((await p.textContent('#odo')).length >= 0 && (await p.locator('#odo svg').count()) >= 3, o.name + ': the odometer shows its figures');
    // pause and resume
    await p.evaluate(() => __void.pause(true)); check(await p.evaluate(() => __void.S.mode) === 'pause' && await p.isVisible('#pause'), o.name + ': pausing shows the pause sheet');
    const t1 = await p.evaluate(() => { __void.tick(1 / 60, 30); return __void.S.run.t; }), t2 = await p.evaluate(() => { __void.tick(1 / 60, 30); return __void.S.run.t; });
    check(t1 === t2, o.name + ': nothing moves while paused'); await p.click('#resume'); check(await p.evaluate(() => __void.S.mode) === 'play', o.name + ': resume carries on');
    // the clock runs out: the iris closes and the card arrives, and the best is saved
    await p.evaluate(() => { __void.S.run.timeLeft = .3; for (let i = 0; i < 60 * 3; i++) { __bot(1 / 60); __void.tick(1 / 60, 1); } });
    check(await p.evaluate(() => __void.S.mode) === 'result' && await p.isVisible('#result') && await p.isVisible('#again'), o.name + ': time out closes the iris and shows the result');
    const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('void.v2')));
    check(sv && sv.best > 0 && sv.runs === 1 && sv.eaten > 20, o.name + ': the best and the count are saved', JSON.stringify(sv));
    const txt = await p.textContent('#rstats'); check(/swallowed/.test(txt) && /biggest bite/.test(txt), o.name + ': the card says what you swallowed');
    await p.click('#again'); check(await p.evaluate(() => __void.S.mode === 'play' && __void.S.run.count === 0 && __void.S.run.level === 0), o.name + ': again starts a fresh run on the same street');
    await c.close();
  }
  // a seed in the address is the same street; a bad save does not break the page
  { const {c, p} = await open({q: '?seed=4242'}); check(await p.evaluate(() => __void.S.run.seed) === 4242, 'a seed in the address is the street'); await c.close(); }
  { const c = await browser.newContext({viewport: {width: 800, height: 600}}); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.addInitScript(() => localStorage.setItem('void.v2', '{"best":"lots","days":[1,2],"runs":-9}')); await p.goto(url); await p.waitForFunction(() => window.__void); check(await p.evaluate(() => __void.S.mode) === 'title', 'a broken save opens the title all the same'); await c.close(); }
  // keyboard
  { const {c, p} = await open({}); await p.keyboard.press('Enter'); check(await p.evaluate(() => __void.S.mode) === 'play', 'Enter starts'); await p.keyboard.press('Escape'); check(await p.evaluate(() => __void.S.mode) === 'pause', 'Escape pauses'); await p.keyboard.press('Escape'); check(await p.evaluate(() => __void.S.mode) === 'play', 'Escape resumes');
    await p.evaluate(() => { __void.S.hold = 0; __void.tick(1 / 60, 1); }); const x0 = await p.evaluate(() => __void.S.run.hole.x); await p.keyboard.down('ArrowRight'); await p.evaluate(() => { __void.tick(1 / 60, 40); }); await p.keyboard.up('ArrowRight'); const x1 = await p.evaluate(() => __void.S.run.hole.x); check(x1 > x0 + .3, 'the arrow keys steer', `${x0} ${x1}`); await c.close(); }
  // a mouse steers by pointing: the hole heads for the cursor, and a cursor on the hole holds it still
  { const {c, p} = await open({}); await p.click('#playhole'); await p.evaluate(() => { __void.S.hold = 0; __void.tick(1 / 60, 1); });
    const x0 = await p.evaluate(() => __void.S.run.hole.x), hxy = await p.evaluate(() => ({x: innerWidth / 2, y: innerHeight * .54}));
    await p.mouse.move(hxy.x + 300, hxy.y); await p.evaluate(() => __void.tick(1 / 60, 40)); const x1 = await p.evaluate(() => __void.S.run.hole.x);
    check(x1 > x0 + .3, 'the hole follows the cursor', `${x0} ${x1}`);
    await p.mouse.move(hxy.x, hxy.y); await p.evaluate(() => __void.tick(1 / 60, 60)); const v = await p.evaluate(() => Math.hypot(__void.S.run.hole.vx, __void.S.run.hole.vy)); check(v < .05, 'a cursor on the hole holds it still', String(v)); await c.close(); }
  // a swipe on a phone steers: a real touch drag through the page's own pointer handling
  { const {c, p} = await open({phone: true}); await p.click('#playhole'); await p.evaluate(() => { __void.S.hold = 0; __void.tick(1 / 60, 1); });
    const x0 = await p.evaluate(() => __void.S.run.hole.x); const cdp = await c.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 150, y: 700}]}); await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 230, y: 700}]});
    await p.evaluate(() => __void.tick(1 / 60, 40)); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    const x1 = await p.evaluate(() => __void.S.run.hole.x); check(x1 > x0 + .3, 'dragging a thumb steers the hole', `${x0} ${x1}`); await c.close(); }
  // whatever stands on the screen is drawn, at every size and wherever the hole is: things never blink out while they are in view
  { const {c, p} = await open({phone: true}); await p.click('#playhole');
    const bad = await p.evaluate(() => { const S = __void.S, V = __void.VOID, r = S.run; let missed = 0, checked = 0; const where = [];
      for (let L = 0; L <= 30; L += 1.5) for (const [ox, oy] of [[0, 0], [7, -3], [-12, 9], [30, 30], [-60, 15]]) {
        r.hole.R = V.R0 * Math.pow(V.F, L + .2); r.hole.x = V.SX + ox * r.hole.R; r.hole.y = V.SY + oy * r.hole.R; r.level = Math.floor(V.levelOfR(r.hole.R)); r.timeLeft = 50; S.hold = 0; S.cam.x = r.hole.x; S.cam.y = r.hole.y; S.cam.R = S.cam.Rd = r.hole.R;
        __void.tick(1 / 60, 2);
        const v = __void.view(), cam = S.cam, truth = V.query(r.seed, v.x0, v.x1, v.y0, v.y1, cam.R * .09, cam.R * 12, r.eaten, []), drawn = new Set(S.drawn.map(q => q.o.id));
        for (const o of truth) {
          const R = r.hole.R, pres = o.r > R ? Math.min(1, Math.max(0, (cam.R * 12 - o.r) / (cam.R * 6))) : V.presence(o.r, R, o.u); if (pres < .03 || Math.floor(o.layer / 7) > Math.floor(L / 7)) continue;   // what belongs to the next chapter is shown once its floor is on the way
          const X = (o.x - cam.x) * v.ppm + v.hx, Y = (o.y - cam.y) * v.ppm + v.hy, e = o.r * v.ppm; if (e < 1.2) continue;
          if (Math.hypot(X - Math.max(0, Math.min(v.W, X)), Y - Math.max(0, Math.min(v.H, Y))) > e) continue;
          checked++; if (!drawn.has(o.id)) { missed++; if (where.length < 3) where.push(o.kind.id + ' r' + o.r.toFixed(1) + ' at L' + L + ' (' + Math.round(X) + ',' + Math.round(Y) + ') e' + Math.round(e)); }
        } }
      return {missed: missed, checked: checked, where: where}; });
    check(bad.checked > 300 && bad.missed === 0, 'every thing standing on the screen is drawn, up to twelve hole radii', JSON.stringify(bad)); await c.close(); }
  check(errors.length === 0, 'no console errors anywhere in the page', errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
}

(async () => {
  if (suites.includes('page')) await page();
  console.log(`\n${failures ? failures + ' FAILED' : 'all passed'} (${passes} checks)`);
  process.exit(failures ? 1 : 0);
})();
