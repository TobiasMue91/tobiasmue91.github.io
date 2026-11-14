#!/usr/bin/env node
// Test suite for games/skyline.html (Skyline).
//
// Runs the page's DOM-free <script id="core"> (SkyCore): the stacking rules, the plans and the architect,
// storms, struts, the vault, golden slabs, the city plots and the economy. What breaks there still looks
// fine on screen - a cut that loses a sliver of slab, a perfect window that is never reachable, a plot order
// that puts a new tower behind an old one, an upgrade that pays nothing - so:
//
//   wave     the slab's triangle-wave swing, axis alternation, speed ramp
//   drop     every drop on thousands of random towers across plan levels and slab types: placed +
//            sliced-off = slab in hand, windows carried by the slab and fixed once placed, the placed floor lies inside the one below, perfects snap, near misses
//            align only inside the auto-align window, growth only on a long chain and never past the lot, a
//            miss only when nothing overlaps, a strut saves exactly one miss each
//   systems  storm timing and escalation, the vault, golden slabs, the crane never aiming inside the window,
//            plan prerequisites, every plan changes what a run pays or how it plays
//   city     plots are unique and every new plot stands on the frontmost diagonal (nothing older can hide it)
//   economy  plan and architect costs rise and stop at max, rent and its offline cap, blueprints, achievements
//   pacing   bots with human timing error: how high they build, how often they hit perfect, and a whole
//            career - runs, rent between them, greedy buying - until the first new district. Prints a table;
//            fails when the game drifts out of its intended band.
//
//   node test/skyline.mjs              # everything
//   node test/skyline.mjs drop pacing  # named suites only
//   node test/skyline.mjs --page=x.html

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'skyline.html'));
const ALL = ['wave', 'drop', 'systems', 'city', 'economy', 'pacing'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

const HTML = readFileSync(PAGE, 'utf8');
const m = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in ' + PAGE); process.exit(1); }
const sandbox = {module: {}};
vm.runInNewContext(m[1], sandbox);
const C = sandbox.module.exports;

let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// a player who taps when the slab passes the centre, off by a normal timing error of sigma seconds
function play(up, sigma, cap = 400, opt = {}, arch = {}) {
  const s = C.newRun(up, arch, {seed: (rnd() * 1e9) | 0, ...opt}), log = [];
  while (!s.over && s.floors.length < cap) {
    s.time += 1.3; // a human takes about this long per floor; the storm follows build time
    const v = C.speedAt(s.floors.length, s.p) * (1 + 0.6 * C.storm(s));
    const pass = rnd() < .5 ? C.RANGE : 3 * C.RANGE; // first or second crossing of the centre
    s.phase = pass + gauss() * sigma * v;
    const top = s.floors[s.floors.length - 1], mv = C.mover(s);
    const r = C.drop(s);
    log.push({r, top, mv});
  }
  return {s, log};
}

if (suites.includes('wave')) {
  section('wave');
  check(near(C.offset(0), -C.RANGE), 'swing starts at -RANGE');
  check(near(C.offset(C.RANGE), 0), 'centre after RANGE units');
  check(near(C.offset(2 * C.RANGE), C.RANGE), 'far end after 2 RANGE');
  check(near(C.offset(3 * C.RANGE), 0), 'back through the centre');
  check(near(C.offset(4 * C.RANGE), -C.RANGE), 'period 4 RANGE');
  let cont = true;
  for (let ph = 0; ph < 4000; ph += 0.37) if (Math.abs(C.offset(ph + .37) - C.offset(ph)) > .37 + 1e-9) cont = false;
  check(cont, 'swing is continuous, never jumps');
  check(C.axisOf(1) !== C.axisOf(2) && C.axisOf(2) !== C.axisOf(3), 'axes alternate');
  const p = C.params({}, {});
  let mono = true;
  for (let n = 1; n < 200; n++) if (C.speedAt(n + 1, p) < C.speedAt(n, p)) mono = false;
  check(mono, 'speed never drops as the tower rises');
  check(C.speedAt(400, p) <= 300, 'speed is capped');
  const s = C.newRun({}, {}); C.step(s, 1);
  check(near(s.phase, C.speedAt(1, s.p)), 'step advances the swing by speed x dt while calm');
}

if (suites.includes('drop')) {
  section('drop');
  let bad = [], perfects = 0, cuts = 0, misses = 0, grows = 0, aligns = 0, saves = 0;
  const types = ['standard', 'heavy', 'light'];
  for (let g = 0; g < 3000; g++) {
    const up = {laser: g % 7, align: g % 15, repair: g % 16, struts: g % 6, heavy: 1, light: 1, value: 1, altitude: 1, core: 1};
    const {s, log} = play(up, .01 + rnd() * .06, 200, {type: types[g % 3]});
    let saved = 0;
    for (const {r, top, mv} of log) {
      const ax = mv.axis, dim = ax === 'x' ? 'w' : 'd', other = ax === 'x' ? 'd' : 'w', oax = ax === 'x' ? 'z' : 'x';
      if (r.kind === 'miss' || r.kind === 'saved') {
        if (r.kind === 'miss') misses++; else { saves++; saved++; }
        if (Math.abs(mv[ax] - top[ax]) < top[dim] - 1e-9) bad.push('miss with overlap');
        continue;
      }
      if (!(r.value > 0)) bad.push('a placed floor paid nothing');
      // windows: the slab in hand carries the grid of the floor below shifted by its slide; a placed floor
      // keeps the grid it was seen with (a cut) or the one below it snapped onto (perfect, align)
      const G = C.GRID, wrap = v => ((v % G) + G) % G, same = (a, b) => Math.min(Math.abs(a - b), G - Math.abs(a - b)) < 1e-6;
      const slid = ax === 'x' ? 'ox' : 'oz', still = ax === 'x' ? 'oz' : 'ox';
      if (!same(mv[slid], wrap((top[slid] || 0) + (mv[ax] - top[ax]))) || !same(mv[still], top[still] || 0)) bad.push('the slab in hand does not carry its windows');
      const want = r.kind === 'cut' ? mv : top;
      if (!same(r.placed.ox, want.ox || 0) || !same(r.placed.oz, want.oz || 0)) bad.push('windows moved when the floor was placed');
      if (r.debris && (!same(r.debris.ox, mv.ox) || !same(r.debris.oz, mv.oz))) bad.push('the sliced piece lost its windows');
      if (r.kind === 'align') {
        aligns++;
        const a = Math.abs(mv[ax] - top[ax]);
        if (a <= s.p.tol || a > s.p.snap + 1e-9) bad.push('align outside its window');
        if (!near(r.placed[dim], top[dim]) || !near(r.placed[ax], top[ax])) bad.push('align changed the floor');
        continue;
      }
      const P = r.placed;
      if (!near(P[other], top[other]) || !near(P[oax], top[oax])) bad.push('cross-axis changed');
      if (r.kind === 'perfect') {
        perfects++;
        if (Math.abs(mv[ax] - top[ax]) > s.p.tol + 1e-9) bad.push('perfect outside tolerance');
        if (!near(P[ax], top[ax])) bad.push('perfect did not snap');
        if (r.grew) {
          grows++;
          if (r.streak < s.p.regrowAt) bad.push('grew on a short chain');
          if (P[dim] > s.p.size + 1e-9) bad.push('grew past the lot');
        } else if (!near(P[dim], top[dim])) bad.push('perfect changed size');
      } else {
        cuts++;
        if (Math.abs(mv[ax] - top[ax]) <= s.p.tol) bad.push('cut inside tolerance');
        const D = r.debris;
        if (!near(P[dim] + D[dim], mv[dim])) bad.push('placed + debris != slab');
        const lo = Math.min(P[ax] - P[dim] / 2, D[ax] - D[dim] / 2), hi = Math.max(P[ax] + P[dim] / 2, D[ax] + D[dim] / 2);
        if (!near(lo, mv[ax] - mv[dim] / 2, 1e-6) || !near(hi, mv[ax] + mv[dim] / 2, 1e-6)) bad.push('pieces do not tile the slab');
        if (P[ax] - P[dim] / 2 < top[ax] - top[dim] / 2 - 1e-6 || P[ax] + P[dim] / 2 > top[ax] + top[dim] / 2 + 1e-6) bad.push('placed overhangs the floor below');
      }
    }
    if (s.streak !== 0 && log[log.length - 1].r.kind === 'miss') bad.push('streak survives a miss');
    if (s.over && saved !== s.p.struts) bad.push(`struts saved ${saved} of ${s.p.struts}`);
  }
  check(bad.length === 0, `${perfects} perfects, ${aligns} aligns, ${cuts} cuts, ${grows} growths, ${saves} saves, ${misses} misses all consistent`, [...new Set(bad)].join(', '));
  check(aligns > 0 && saves > 0, 'auto-align and struts both come into play');
  const s = C.newRun({}, {}); s.over = true;
  check(C.drop(s) === null, 'no drop after the tower is over');
}

if (suites.includes('systems')) {
  section('systems');
  // storm: calm, then wind; shutters and weathering push it later and soften it; it keeps escalating
  const s0 = C.newRun({}, {});
  s0.time = s0.p.stormCalm - .01; check(C.storm(s0) === 0, 'calm before the storm');
  s0.time = s0.p.stormCalm + C.STORM_BUILD; check(near(C.storm(s0), 1), 'full storm after the build-up');
  s0.time += 200; check(C.storm(s0) > 1.5, 'the storm keeps escalating, so every tower ends');
  const s1 = C.newRun({shutters: 10, align: 1, struts: 1}, {weather: 8});
  check(s1.p.stormCalm > s0.p.stormCalm + 80 && s1.p.stormPower < s0.p.stormPower, 'shutters and weathering delay and soften it');
  const sw = C.newRun({}, {}); sw.time = sw.p.stormCalm + 30; const ph = sw.phase; C.step(sw, .5);
  const calm = C.newRun({}, {}); C.step(calm, .5);
  check(sw.phase - ph > calm.phase * 1.1, 'wind speeds the slab up');
  // vault: fills on perfects, pays eight perfect floors, empties
  const v = C.newRun({vault: 1, momentum: 1}, {});
  for (let i = 0; i < C.VAULT_FILL; i++) { v.phase = C.RANGE; C.drop(v); }
  check(v.vault >= 1, 'eight perfects fill the vault');
  const before = v.earned, pay = C.cashVault(v);
  check(pay > 0 && near(v.earned, before + pay) && v.vault === 0, 'cashing pays once and empties it');
  check(C.cashVault(v) === 0, 'an empty vault pays nothing');
  check(C.cashVault(C.newRun({}, {})) === 0, 'no vault without the plan');
  // golden slabs: about the advertised chance, and they pay the multiplier
  let gold = 0, n = 0;
  for (let k = 0; k < 400; k++) { const g = C.newRun({}, {}, {seed: k + 1}); for (let i = 0; i < 50; i++) { gold += g.golden ? 1 : 0; n++; g.phase = C.RANGE; C.drop(g); } }
  check(Math.abs(gold / n - C.GOLDEN_CHANCE) < .006, `golden slabs at ${(100 * gold / n).toFixed(2)}%`);
  const gr = C.newRun({}, {}); gr.golden = true; gr.phase = C.RANGE + 20; const rg = C.drop(gr);
  const pr = C.newRun({}, {}); pr.golden = false; pr.phase = C.RANGE + 20; const rp = C.drop(pr);
  check(near(rg.value, rp.value * C.GOLDEN_MULT), 'a golden floor pays ×' + C.GOLDEN_MULT);
  // rush hour
  const ru = C.newRun({}, {}); ru.phase = C.RANGE + 20; ru.golden = false;
  check(near(C.drop(ru, {rush: true}).value, rp.value * C.RUSH_MULT), 'rush hour pays ×' + C.RUSH_MULT);
  // crane: error shrinks with servo, never down to the perfect window
  let ok = true;
  for (let L = 0; L <= 30; L++) for (let A = 0; A <= 6; A++) { const e = C.craneError({crane: 1, servo: L}, {servos: A}); if (e * 100 < 2.2 * 1.5 / 1) ok = ok && e > 0.04; }
  check(ok && C.craneError({crane: 1, servo: 30}, {servos: 6}) < C.craneError({crane: 1}, {}), 'servos tighten the crane, with a floor');
  check(C.craneRhythm({cranes: 6}) < C.craneRhythm({}) && C.craneRhythm({cranes: 99}) >= .85, 'fast cranes drop sooner, never frantic');
  // prerequisites and slab types
  check(!C.unlocked('altitude', {}) && C.unlocked('altitude', {value: 1}), 'a plan needs its prerequisite');
  check(C.UPGRADES.every(u => !u.req || C.UPGRADES.some(x => x.id === u.req && x.branch === u.branch)), 'prerequisites stay inside their branch');
  check(!C.typeOpen('light', {}) && C.typeOpen('light', {light: 1}) && C.params({}, {}, {type: 'light'}).type === 'standard', 'slab types need their plan');
  check(C.params({overdrive: 1}, {}, {overdrive: true}).global === 2 * C.params({}, {}).global, 'overdrive doubles pay');
  // every plan and architect level does something to a run or to the city
  const baseP = JSON.stringify(C.params({}, {}, {towers: 10, best: 60, type: 'standard'}));
  const dead = [];
  for (const u of C.UPGRADES) {
    const up = {[u.id]: 1}; if (u.req) up[u.req] = 1;
    const pr = JSON.stringify(C.params(up, {}, {towers: 10, best: 60, type: u.id === 'heavy' ? 'heavy' : u.id === 'light' ? 'light' : 'standard', overdrive: u.id === 'overdrive'}));
    const city = C.rentPerHour([{f: new Array(11)}], up, {}) !== C.rentPerHour([{f: new Array(11)}], {}, {});
    const crane = C.craneError(up, {}) !== C.craneError({}, {});
    if (pr === baseP && !city && !crane && !['crane', 'handoff'].includes(u.id) && !(u.req && JSON.stringify(C.params({[u.req]: 1}, {}, {towers: 10, best: 60})) !== pr)) dead.push(u.id);
  }
  for (const a of C.ARCH) {
    const pr = JSON.stringify(C.params({}, {[a.id]: 1}, {towers: 10, best: 60}));
    const other = C.rentPerHour([{f: new Array(11)}], {}, {[a.id]: 1}) !== C.rentPerHour([{f: new Array(11)}], {}, {})
      || C.craneError({servo: 30}, {[a.id]: 1}) !== C.craneError({servo: 30}, {}) || C.craneRhythm({[a.id]: 1}) !== C.craneRhythm({}) || C.rentCapHours({[a.id]: 1}) !== C.rentCapHours({});
    if (pr === baseP && !other) dead.push('arch:' + a.id);
  }
  check(dead.length === 0, 'every plan and architect level changes something', dead.join(', '));
}

if (suites.includes('city')) {
  section('city');
  const seen = new Set(); let maxDiag = -1, ok = true, uniq = true;
  for (let i = 0; i < 500; i++) {
    const q = C.plotPos(i), key = q.x + ',' + q.z;
    if (seen.has(key)) uniq = false; seen.add(key);
    if (q.diag < maxDiag) ok = false;
    maxDiag = Math.max(maxDiag, q.diag);
    if (q.x + q.z !== q.diag * C.SPACING) ok = false;
  }
  check(uniq, 'plots are unique');
  check(ok, 'every new plot is on the frontmost diagonal');
}

if (suites.includes('economy')) {
  section('economy');
  let rising = true, capped = true;
  for (const u of C.UPGRADES) {
    for (let l = 0; l + 1 < Math.min(u.max, 60); l++) if (!(C.cost(u.id, l + 1) > C.cost(u.id, l))) rising = false;
    if (u.max !== Infinity && C.cost(u.id, u.max) !== Infinity) capped = false;
  }
  for (const a of C.ARCH) {
    for (let l = 0; l + 1 < a.max; l++) if (!(C.archCost(a.id, l + 1) >= C.archCost(a.id, l))) rising = false;
    if (C.archCost(a.id, a.max) !== Infinity) capped = false;
  }
  check(rising, 'costs rise'); check(capped, 'nothing past its max');
  const L = C.levels({struts: 99, laser: -3, junk: 4, value: 1e9});
  check(L.struts === 5 && L.laser === 0 && !('junk' in L) && L.value === 1e9, 'levels are clamped and cleaned');
  const towers = [{f: new Array(11)}, {f: new Array(21)}];
  check(C.rentPerHour(towers, {}, {}) === 90, 'rent is 3 per floor per hour to start', C.rentPerHour(towers, {}, {}));
  check(C.offlineRent(towers, {}, {}, 3.6e6) === 90, 'an hour away pays an hour');
  check(C.offlineRent(towers, {}, {}, 1e12) === 90 * C.rentCapHours({}), 'offline rent is capped');
  check(C.rentCapHours({night: 2}) === C.rentCapHours({}) + 4, 'night shift raises the cap');
  check(C.offlineRent(towers, {}, {}, -5) === 0, 'a clock running backwards pays nothing');
  const tall = n => ({f: new Array(n + 1)});
  check(C.blueprints(new Array(20).fill(tall(C.PRESTIGE_MIN - 1))) === 0 && C.blueprints(new Array(20).fill(tall(C.PRESTIGE_MIN))) > 0, 'a new district needs one tall tower');
  check(C.blueprints([tall(80), tall(30), tall(30)]) > C.blueprints([tall(80)]), 'a bigger city pays more blueprints');
  const got = C.newAchievements({bestEver: 60, bestChain: 0, perfects: 0, goldens: 0, rushes: 0, stormFloors: 0, bestStormFloors: 0, mostTowers: 0, districts: 0, lifetime: 0}, {floors_25: 1});
  check(got.map(a => a.id).join() === 'floors_50', 'achievements are earned once each', got.map(a => a.id).join());
}

if (suites.includes('pacing')) {
  section('pacing');
  const row = (label, up, sigma, n = 400) => {
    const H = [], P = [];
    for (let i = 0; i < n; i++) { const {s} = play(up, sigma); H.push(s.floors.length - 1); P.push(s.perfects / Math.max(1, s.floors.length - 1)); }
    H.sort((a, b) => a - b);
    const med = H[n >> 1], p90 = H[Math.floor(n * .9)], pr = P.reduce((a, b) => a + b, 0) / n;
    console.log(`  ${label.padEnd(30)} median ${String(med).padStart(4)}  p90 ${String(p90).padStart(4)}  perfect ${(pr * 100).toFixed(0).padStart(3)}%`);
    return {med, p90, pr};
  };
  const casual = row('casual (60 ms error)', {}, .06);
  const decent = row('decent (35 ms)', {}, .035);
  const sharp = row('sharp (18 ms)', {}, .018);
  const maxed = row('decent, forgiveness maxed', {align: 14, repair: 15, struts: 5, shutters: 10, laser: 6}, .035);
  check(casual.med >= 6 && casual.med <= 25, 'a casual first tower is 6-25 floors', casual.med);
  check(decent.med >= 15 && decent.med <= 60, 'a decent player builds 15-60 floors', decent.med);
  check(sharp.med > decent.med * 1.5, 'skill pays: a sharp player builds much higher');
  check(maxed.med > decent.med * 1.25, 'plans matter');
  check(decent.pr > .08 && decent.pr < .6, 'perfects are earned, not constant', decent.pr);
  // a career: runs, rent between them, buying the cheapest open plan, until a new district pays 5 blueprints
  const career = sigma => {
    let up = {}, money = 0, towers = [], minutes = 0, runs = 0, firstBuy = 0, bought = 0;
    while (runs < 400) {
      const best = towers.reduce((m, t) => Math.max(m, t.f.length - 1), 0);
      const {s} = play(up, sigma, 400, {towers: towers.length, best});
      runs++; minutes += s.time / 60 + .4;
      money += s.earned + C.rentPerHour(towers, up, {}) * (s.time + 24) / 3600;
      if (s.p.vault) money += 0;
      towers.push({f: s.floors});
      for (;;) {
        let pick = null, c = Infinity;
        for (const u of C.UPGRADES) if (C.unlocked(u.id, up)) { const k = C.cost(u.id, up[u.id] || 0); if (k < c) { c = k; pick = u.id; } }
        if (c > money) break;
        money -= c; up[pick] = (up[pick] || 0) + 1; bought++; if (!firstBuy) firstBuy = runs;
      }
      if (C.blueprints(towers) >= 5) break;
    }
    return {runs, minutes, firstBuy, bought};
  };
  for (const [label, sg] of [['casual', .06], ['decent', .035], ['sharp', .018]]) {
    const c = career(sg);
    console.log(`  ${label.padEnd(8)} first plan after run ${c.firstBuy}, 5 blueprints after ${c.runs} runs (~${c.minutes.toFixed(0)} min), ${c.bought} plans bought`);
    if (label === 'decent') {
      check(c.firstBuy === 1, 'the first plan is bought after the first tower');
      check(c.minutes >= 4 && c.minutes <= 90, 'a new district is worth it within 4-90 minutes', c.minutes.toFixed(0));
    }
    if (label === 'casual') check(c.runs < 400, 'a casual player reaches a new district too');
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
