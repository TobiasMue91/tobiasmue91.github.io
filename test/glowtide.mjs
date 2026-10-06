#!/usr/bin/env node
// Test suite for games/chain_reaction.html (Glowtide).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that a single tap can
// always be enough: every level it deals has a tap that clears the goal, a tap in the wrong place
// usually does not, a bloom touches exactly what its radius covers, and a tide is the same for
// everyone who shares its seed. No browser, no server.
//
//   node test/glowtide.mjs                 # everything
//   node test/glowtide.mjs reach levels    # named suites only
//
// Suites: reach, chain, levels, bots, run, save.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PAGE = (args.find(a => a.startsWith('--page=')) || '').slice(7) || join(HERE, '..', 'games', 'chain_reaction.html');
const ALL = ['reach', 'chain', 'levels', 'bots', 'run', 'save'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const check = (ok, what, detail) => { if (ok) { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); } else fail(what, detail); };
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.T = TIDE;', ctx);
const T = ctx.T;

const FIELDS = {phone: {w: 1, h: 2.1, top: 0.3}, desk: {w: 1.6, h: 1, top: 0.14}};
const rnd = T.rng(20240607);

if (suites.includes('reach')) {
  section('reach: a bloom touches what its radius covers');
  // Stack orbs on a ring around a bloom at its full size, a hair inside and a hair outside.
  const f = FIELDS.desk;
  for (const kind of ['spark', 'giant', 'long']) {
    const K = T.KINDS[kind];
    const orbs = [];
    // a giant/long seed isn't possible (a tap is always a spark), so chain from a spark whose ignition is a kind bloom
    const r = 0.03;
    orbs.push({x: 0.8, y: 0.5, vx: 0, vy: 0, kind, r, phase: 0});
    const sim = T.newSim(orbs, f);
    T.tap(sim, 0.8 - (T.KINDS.spark.R + r) + 0.004, 0.5); // inside by 4/1000
    T.runToEnd(sim, 0);
    check(sim.caught === 1, `${kind} inside the reach is lit`);
    const sim2 = T.newSim(orbs, f);
    T.tap(sim2, 0.8 - (T.KINDS.spark.R + r) - 0.004, 0.5); // outside by 4/1000
    T.runToEnd(sim2, 0);
    check(sim2.caught === 0, `${kind} a hair outside is not lit`);
    void K;
  }
  // reference: after every step, each orb that was lit sits inside a bloom that was alive that step, and
  // no orb left standing does
  let bad = 0, steps = 0;
  for (let i = 0; i < 40; i++) {
    const orbs = T.layout(1000 + i, 6 + (i % 10), f, 0);
    const sim = T.newSim(orbs, f);
    T.tap(sim, 0.3 + rnd() * 1.0, 0.2 + rnd() * 0.7);
    while (!sim.done && steps < 1e6) {
      const pre = sim.blooms.map(b => ({...b, age: b.age + T.DT}));
      const covers = o => pre.some(b => Math.hypot(o.x - b.x, o.y - b.y) <= T.bloomRadius(b) + o.r);
      T.step(sim, 0); steps++;
      const lit = sim.events.filter(e => e.type === 'ignite'); sim.events = [];
      const radius = {spark: T.KINDS.spark.r, giant: T.KINDS.giant.r, long: T.KINDS.long.r};
      for (const e of lit) if (!covers({x: e.x, y: e.y, r: radius[e.kind]})) bad++;
      for (const o of sim.orbs) if (covers(o)) bad++;
    }
  }
  check(bad === 0, 'every lit orb was in reach and no orb in reach is left unlit', `${bad} cases`);
  check(T.bloomRadius({kind: 'spark', age: 0}) === 0, 'a bloom starts at nothing');
  check(Math.abs(T.bloomRadius({kind: 'spark', age: T.GROW + 0.1}) - T.KINDS.spark.R) < 1e-12, 'a bloom holds its full radius');
  check(T.bloomRadius({kind: 'spark', age: T.bloomLife('spark') + 0.001}) === 0, 'a bloom ends at nothing');
  let mono = true, prev = -1;
  for (let a = 0; a <= T.GROW; a += 0.01) { const r = T.bloomRadius({kind: 'giant', age: a}); if (r < prev) mono = false; prev = r; }
  check(mono, 'a bloom only grows while growing');
  check(T.bloomLife('long') > T.bloomLife('spark') + 2, 'a long bloom lingers longer');
  check(T.KINDS.giant.R > T.KINDS.spark.R * 1.3, 'a giant reaches clearly further');
}

if (suites.includes('chain')) {
  section('chain: every ignition is accounted for');
  const f = FIELDS.phone;
  let games = 0, bad = 0;
  for (let i = 0; i < 120; i++) {
    const n = 1 + (i % 18), orbs = T.layout(500 + i, n, f, 0), sp = T.spec(n, f);
    const sim = T.newSim(orbs, f);
    T.tap(sim, rnd() * f.w, f.top + rnd() * (f.h - f.top));
    const evs = [];
    for (let s = 0; s < 3000 && !sim.done; s++) { T.step(sim, sp.goal); evs.push(...sim.events); sim.events = []; }
    games++;
    const ign = evs.filter(e => e.type === 'ignite');
    const ends = evs.filter(e => e.type === 'end');
    const goals = evs.filter(e => e.type === 'goal');
    let ok = sim.done && ends.length === 1 && ign.length === sim.caught && sim.caught + sim.orbs.length === orbs.length;
    ok = ok && ign.every((e, j) => e.k === j + 1) && ign.every(e => e.depth >= 1);
    ok = ok && goals.length === (sim.caught >= sp.goal ? 1 : 0);
    let pts = 0; ign.forEach(e => { pts += 10 * e.k; });
    ok = ok && pts === sim.score;
    if (!ok) bad++;
  }
  check(bad === 0, `${games} random taps: one end, counts in order, goal once, score = 10 x k`, `${bad} bad`);
  const sim = T.newSim(T.layout(1, 3, f, 0), f);
  check(T.tap(sim, 0.5, 1) === true && T.tap(sim, 0.4, 1) === false, 'only one tap per level');
  const e = T.newSim([], f); T.tap(e, 0.5, 1); T.runToEnd(e, 1);
  check(e.done && e.caught === 0, 'a tap on nothing ends with nothing lit');
  const a = T.newSim(T.layout(9, 8, f, 0), f), b = T.newSim(T.layout(9, 8, f, 0), f);
  T.tap(a, 0.5, 1); T.tap(b, 0.5, 1); T.runToEnd(a, 5); T.runToEnd(b, 5);
  check(a.caught === b.caught && a.score === b.score && a.t === b.t, 'the same level and tap play out identically');
  // chain depth follows the parent
  const sim3 = T.newSim(T.layout(77, 6, FIELDS.desk, 0), FIELDS.desk); T.tap(sim3, 0.8, 0.5);
  const byId = new Map(); let depthOk = true;
  for (let s = 0; s < 3000 && !sim3.done; s++) { for (const b2 of sim3.blooms) byId.set(b2.id, b2); T.step(sim3, 0); for (const b2 of sim3.blooms) { byId.set(b2.id, b2); if (b2.parent && byId.get(b2.parent) && b2.depth !== byId.get(b2.parent).depth + 1) depthOk = false; } }
  check(depthOk, 'each link is one deeper than the bloom that lit it');
}

if (suites.includes('levels')) {
  section('levels: fair, the same for everyone, harder as you go');
  let unsolv = 0, total = 0, easy = 0, fieldBad = 0, ms = 0;
  for (const [name, f] of Object.entries(FIELDS)) {
    for (const n of [1, 2, 3, 5, 8, 12, 17, 24]) {
      const t0 = Date.now();
      const lv = T.makeLevel(4242, n, f);
      ms = Math.max(ms, Date.now() - t0);
      total++;
      // re-judge with a finer 9x9 grid: a tap exists that clears the goal
      const best = T.bestTap(lv.orbs, f, lv.spec.goal, 9);
      if (best.caught < lv.spec.goal) unsolv++;
      if (n >= 6 && lv.hint.share > 0.6) easy++;
      if (!lv.orbs.every(o => o.x >= o.r && o.x <= f.w - o.r && o.y >= f.top + o.r && o.y <= f.h - o.r)) fieldBad++;
      check(lv.orbs.length === lv.spec.total, `${name} level ${n}: dealt ${lv.spec.total} orbs`);
    }
  }
  check(unsolv === 0, `${total} levels all have a tap that clears the goal`, `${unsolv} do not`);
  check(easy <= total * 0.08, 'from level 6 a random tap rarely clears the goal', `${easy} too easy`);
  check(fieldBad === 0, 'every orb starts inside the field, below the HUD');
  check(ms < 1500, `a level is dealt in under 1.5 s on this machine (worst ${ms} ms)`);
  const a = T.makeLevel('x'.length + 99, 9, FIELDS.phone), b = T.makeLevel(100, 9, FIELDS.phone);
  check(JSON.stringify(a.orbs) === JSON.stringify(b.orbs), 'a seed and level deal the same orbs every time');
  const c = T.makeLevel(101, 9, FIELDS.phone);
  check(JSON.stringify(a.orbs) !== JSON.stringify(c.orbs), 'another seed deals other orbs');
  check(T.seedFrom('2026-10-06') === T.seedFrom(' 2026-10-06 ') && T.seedFrom('ABC') === T.seedFrom('abc'), 'a code is read without fuss');
  let prevFrac = 0, mono = true;
  for (let n = 1; n <= 25; n++) { const s = T.spec(n, FIELDS.desk), fr = s.goal / s.total; if (fr < prevFrac - 0.08) mono = false; prevFrac = fr; check(s.goal < s.total && s.goal >= 2 && s.star2 >= s.goal && s.star3 >= s.star2 && s.star3 <= s.total, `level ${n} thresholds are ordered`); }
  check(mono, 'the share you must light never falls');
  check(T.spec(1, FIELDS.desk).giants === 0 && T.spec(1, FIELDS.desk).longs === 0, 'the first levels hold no special orbs');
  check(T.spec(4, FIELDS.desk).giants === 1 && T.spec(7, FIELDS.desk).longs === 1, 'each new kind arrives alone');
  const lv = T.layout(5, 12, FIELDS.phone, 0); const k = {}; lv.forEach(o => { k[o.kind] = (k[o.kind] || 0) + 1; });
  check(k.giant === T.spec(12, FIELDS.phone).giants && k.long === T.spec(12, FIELDS.phone).longs, 'the layout holds the kinds the spec names');
}

if (suites.includes('bots')) {
  section('bots: skill is what decides a level');
  const f = FIELDS.phone;
  const play = (seed, n, pick) => {
    const lv = T.makeLevel(seed, n, f), sim = T.newSim(lv.orbs, f);
    const [x, y] = pick(lv, sim);
    T.tap(sim, x, y); T.runToEnd(sim, lv.spec.goal);
    return sim.caught >= lv.spec.goal;
  };
  const random = () => (lv, sim) => [rnd() * f.w, f.top + rnd() * (f.h - f.top)];
  // a careful player aims at a cluster: the best of a handful of looks, after their drift time
  const careful = () => (lv, sim) => {
    const s = T.newSim(lv.orbs, f); for (let i = 0; i < 70; i++) T.step(s, 0);
    const b = T.bestTap(s.orbs, f, lv.spec.goal, 4); return [b.x, b.y];
  };
  const rate = (pick, from, to, reps) => { let w = 0, c = 0; for (let n = from; n <= to; n++) for (let r = 0; r < reps; r++) { c++; if (play(900 + r, n, pick())) w++; } return w / c; };
  const rr = rate(random, 8, 14, 6), cr = rate(careful, 8, 14, 3), r1 = rate(random, 1, 3, 8);
  check(cr > rr + 0.15, `a careful aimer beats a random tapper on levels 8-14 (${cr.toFixed(2)} vs ${rr.toFixed(2)})`);
  check(rr < 0.45, `a random tapper mostly fails from level 8 (${rr.toFixed(2)})`);
  check(r1 >= 0.15, `a random tapper can still win the first levels now and then (${r1.toFixed(2)})`);
  check(cr >= 0.4, `a careful aimer often clears 8-14 (${cr.toFixed(2)})`);
}

if (suites.includes('run')) {
  section('run: lights, stars and score');
  const sp = T.spec(5, FIELDS.desk);
  const run = T.newRun(1);
  check(run.lights === 3 && run.level === 1 && run.score === 0, 'a run starts at level 1 with three lights');
  const miss = T.settle(run, sp, {caught: sp.goal - 1, score: 50});
  check(!miss.passed && miss.run.lights === 2 && miss.run.level === 1 && miss.run.score === 50, 'a miss costs a light, keeps the level, keeps the points');
  const win = T.settle(run, sp, {caught: sp.goal, score: 100});
  check(win.passed && win.stars === 1 && win.run.level === 2 && win.run.score === 200, 'the goal clears one star and 100 bonus');
  const three = T.settle({...run, lights: 2}, sp, {caught: sp.star3, score: 0});
  check(three.stars === 3 && three.relit && three.run.lights === 3, 'three stars relight a light');
  const full = T.settle(run, sp, {caught: sp.star3, score: 0});
  check(full.run.lights === 3 && !full.relit, 'lights never pass three');
  let r = T.newRun(1), out;
  for (let i = 0; i < 3; i++) { out = T.settle(r, sp, {caught: 0, score: 0}); r = out.run; }
  check(r.over && r.lights === 0, 'the third miss ends the run');
  check(T.stars(sp, sp.star2) === 2 && T.stars(sp, sp.star2 - 1) === 1 && T.stars(sp, sp.goal - 1) === 0, 'star thresholds cut where they say');
  check(run.lights === 3 && run.level === 1, 'settling does not change the run it is given');
}

if (suites.includes('save')) {
  section('save: trust nothing');
  const s0 = T.cleanSave(null);
  check(s0.best === 0 && s0.streak === 0 && s0.daily.level === 0, 'no save gives an empty one');
  const junk = T.cleanSave({best: -5, bestLevel: 'x', runs: 1e99, streak: NaN, lastDay: 'yesterday', daily: 7, seen: 1});
  check(junk.best === 0 && junk.bestLevel === 0 && junk.runs === 1e6 && junk.streak === 0 && junk.lastDay === '' && junk.seen === true, 'junk is clamped or dropped');
  const ok = T.cleanSave({best: 1234.9, bestLevel: 12, runs: 3, streak: 4, lastDay: '2026-10-05', daily: {day: '2026-10-05', level: 9, score: 800}});
  check(ok.best === 1234 && ok.daily.level === 9 && ok.streak === 4, 'a good save survives');
  const same = JSON.stringify(T.cleanSave(ok)) === JSON.stringify(ok);
  check(same, 'cleaning is idempotent');
  check(T.cleanSave({legacy: 41230.7}).legacy === 41230 && T.cleanSave({legacy: 'x'}).legacy === 0, 'the old page\'s high score is carried apart from the new ones');
  check(T.dayBefore('2026-03-01') === '2026-02-28' && T.dayBefore('2024-03-01') === '2024-02-29' && T.dayBefore('2026-01-01') === '2025-12-31', 'the day before is right across months and years');
  let s = T.playedDaily(T.cleanSave(null), '2026-10-05');
  check(s.streak === 1, 'the first daily starts a streak');
  s = T.playedDaily(s, '2026-10-05'); check(s.streak === 1, 'a second try the same day adds nothing');
  s = T.playedDaily(s, '2026-10-06'); check(s.streak === 2, 'the next day extends it');
  s = T.playedDaily(s, '2026-10-08'); check(s.streak === 1, 'a missed day starts it over');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
