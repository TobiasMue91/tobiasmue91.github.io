#!/usr/bin/env node
// Test suite for games/frogger.html (Frog Crossing).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page only draws what the core returns, so
// the promises worth checking live here: every lane is a pure function of the clock (nothing pops on screen,
// the same night is the same for everyone), a hit is a real overlap, a log carries the frog exactly, a
// diving turtle drowns only while it is under, the bank kills and an inlet saves, the score is what the
// rules say, the same presses give the same game at any frame rate, and every night can be crossed into
// every inlet by a player who only decides five times a second.
//
//   node test/frogger.mjs                  # everything
//   node test/frogger.mjs ride home        # named suites only
//   node test/frogger.mjs --page=path.html
//
// Suites: lanes, frames, collide, ride, home, rules, save, crossable.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'frogger.html'));
const ALL = ['lanes', 'frames', 'collide', 'ride', 'home', 'rules', 'save', 'crossable'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({structuredClone});
vm.runInContext(core[1] + '\nthis.F = FROG;', ctx);
const F = ctx.F;
const {COLS, M, STEP, LIFE, BAYS, FROG_HALF, CAR_INSET} = F;

const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const clone = g => structuredClone(g);
// put a fresh frog somewhere without going through the hop rules
const place = (g, row, x) => { g.frog = {row, x, hop: null, ride: null, off: 0, dir: 'up'}; g.maxRow = row; };
// run until the frog lands (or dies); returns all events
const settle = (g, max = 1) => { let ev = []; for (let t = 0; t < max && g.frog.hop !== undefined; t += STEP) { ev = ev.concat(F.step(g, STEP)); if (!g.frog.hop) break; } return ev; };
// a car's left edge, written out separately from the core
const refLeft = (lane, it, t) => { const P = lane.P; let a = (it.x + lane.v * t) % P; if (a < 0) a += P; return a - M; };

if (suites.includes('lanes')) {
  section('lanes: pure functions of the clock, the same night for everyone');
  let same = true, overlap = 0, gaps = 0, wraps = 0;
  for (let n = 1; n <= 30; n++) {
    const a = F.night(n), b = F.night(n);
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    for (const lane of a) {
      if (!lane) continue;
      if (lane.P - M < COLS || M < lane.len) wraps++;
      // items in a lane never overlap, on the lane's circle; road gaps leave a frog room
      const xs = lane.items.map(it => it.x).sort((p, q) => p - q);
      for (let i = 0; i < xs.length; i++) {
        const gap = ((xs[(i + 1) % xs.length] - xs[i]) + lane.P) % lane.P || lane.P;
        const free = gap - lane.len;
        if (free < -1e-9) overlap++;
        if (lane.kind === 'road' && free < 1.6 + Math.abs(lane.v) * 0.3 - 1e-9) gaps++;
      }
    }
  }
  check(same, 'night(n) is the same lanes every time it is asked for');
  check(overlap === 0, 'no two things in a lane overlap', `${overlap} overlaps`);
  check(gaps === 0, 'every road gap is wide enough to stand in while the next car comes', `${gaps} short gaps`);
  check(wraps === 0, 'a lane wraps only once a thing is wholly off the board', `${wraps} lanes wrap on screen`);
  // the left edge the core reports agrees with one written separately, and moves at the lane's speed
  const g = F.create({night: 5}); let bad = 0;
  for (let t = 0; t < 200; t += 0.731) for (const lane of g.lanes) if (lane) for (const it of lane.items) {
    const L = F.left(lane, it, t);
    if (!near(L, refLeft(lane, it, t), 1e-6)) bad++;
    if (L < -M - 1e-9 || L >= lane.P - M) bad++;
  }
  check(bad === 0, 'every item sits where its speed puts it, inside [-M, P-M)', `${bad} misplaced`);
  let mono = true; for (let n = 1; n < 40; n++) if (F.speedFor(n + 1) < F.speedFor(n)) mono = false;
  check(mono && F.speedFor(40) <= 1.9 + 1e-9, 'nights only get faster, and stop getting faster at 1.9x');
  const divers = n => F.night(n).flatMap(l => l ? l.items.filter(it => it.dive) : []).length;
  check(divers(1) === 0 && divers(2) > 0 && divers(6) > divers(2), 'no divers on night 1, some from night 2, more later');
}

if (suites.includes('frames')) {
  section('frames: the same presses make the same game at any frame rate');
  const script = [[0.3, 'up'], [0.7, 'up'], [1.6, 'left'], [2.2, 'up'], [3.0, 'up'], [3.5, 'right'], [4.4, 'up'], [5.1, 'up'], [6.0, 'up'], [6.6, 'up'], [7.4, 'up'], [8.3, 'up'], [9.0, 'up']];
  const run = (dtOf) => {
    const g = F.create({night: 2, t: 11.5, seed: 7}); let t = 0, i = 0, log = [];
    while (t < 12) {
      // presses land on the substep grid, as the page's do once its frame arrives
      while (i < script.length && script[i][0] <= t + 1e-9) { F.press(g, script[i][1]); i++; }
      // a frame never straddles a press: the press is made at its moment whatever the frame rate
      let dt = dtOf(t); if (i < script.length) dt = Math.min(dt, Math.max(1 / 120, script[i][0] - t)); t += dt;
      for (const e of F.step(g, dt)) if (e.type !== 'whoosh') log.push(e.type + (e.cause ? ':' + e.cause : '') + '@' + Math.round(e.t * 120));
    }
    return {log: log.join(' '), score: g.score, x: F.pos(g).x.toFixed(9), row: g.frog.row};
  };
  // a fixed-step reference: presses only between whole substeps, so feed the same grid
  const grid = dt => () => dt;
  const a = run(grid(1 / 120)), b = run(grid(1 / 60)), c = run(grid(1 / 30));
  check(a.log === b.log && b.log === c.log && a.score === c.score && a.x === c.x, 'events, score and frog agree at 120, 60 and 30 fps', `\n${a.log}\n${c.log}`);
  check(a.log.length > 0, 'the scripted run does something');
  const r = rng(3); const j = run(() => (1 + Math.floor(r() * 4)) / 120);
  check(j.log === a.log && j.x === a.x, 'and with uneven frames');
  const g = F.create({night: 1}); const t0 = g.t; F.step(g, 5); check(near(g.t, t0 + 0.25, 1e-9), 'a stall longer than a quarter second is clipped, not replayed');
}

if (suites.includes('collide')) {
  section('collide: a hit is a real overlap and nothing else');
  const r = rng(11); let wrong = 0, hits = 0, trials = 0;
  for (let k = 0; k < 6000; k++) {
    const g = F.create({night: 1 + Math.floor(r() * 12), t: r() * 500});
    const row = 1 + Math.floor(r() * 5), x = 0.5 + r() * (COLS - 1);
    place(g, row, x);
    const ev = F.step(g, STEP); trials++;
    const lane = g.lanes[row];
    const ref = lane.items.some(it => { const L = refLeft(lane, it, g.t); return x + FROG_HALF > L + CAR_INSET && x - FROG_HALF < L + it.len - CAR_INSET; });
    const died = ev.some(e => e.type === 'die' && e.cause === 'car');
    if (ref) hits++;
    if (ref !== died) wrong++;
  }
  check(wrong === 0, `${trials} frogs dropped on the road die exactly when a body overlaps them`, `${wrong} disagree`);
  check(hits > 300 && hits < trials - 300, 'and the sample holds both hits and misses', `${hits} hits`);
  // mid-hop the frog is judged on the row it is over: the old one for the first half, the new one after
  const g = F.create({night: 1, t: 3}); place(g, 0, 4.5); F.press(g, 'up'); F.step(g, STEP);
  check(g.frog.hop && g.frog.hop.toRow === 1, 'a press starts a hop on the next substep');
  // a hop never tunnels: a car crossing the frog's column while it sits there always hits at 30 fps
  let missed = 0;
  for (let k = 0; k < 400; k++) {
    const h = F.create({night: 8, t: r() * 300}); const row = 4; place(h, row, 4.5);
    let died = false; for (let s = 0; s < 120 && !died; s++) died = F.step(h, 1 / 30).some(e => e.type === 'die');
    if (!died) missed++;
  }
  check(missed === 0, 'a frog that waits in the racer lane for four seconds is always hit, even at 30 fps', `${missed} survived`);
}

if (suites.includes('ride')) {
  section('ride: a log carries the frog exactly; the river kills only where it should');
  const r = rng(5); let drift = 0, boarded = 0, splashed = 0, wrongLand = 0, paidDead = 0;
  for (let k = 0; k < 3000; k++) {
    const g = F.create({night: 1 + Math.floor(r() * 10), t: r() * 400});
    const x = 0.5 + Math.floor(r() * COLS); place(g, 6, x); F.press(g, 'up');
    const ev = settle(g);
    const lane = g.lanes[7];
    const under = lane.items.find(it => { const L = refLeft(lane, it, g.t); return x >= L - F.LOG_GRACE && x <= L + it.len + F.LOG_GRACE && !F.submerged(it, g.t); });
    const died = ev.some(e => e.type === 'die');
    if (!!under === died) wrongLand++;
    if (died && ev.some(e => e.type === 'step')) paidDead++;
    if (died) { splashed++; continue; }
    boarded++;
    // ride for a while: the frog keeps its place on the item
    const off = F.pos(g).x - refLeft(lane, g.frog.ride, g.t);
    for (let s = 0; s < 40 && g.state === 'play'; s++) {
      F.step(g, 1 / 60);
      if (g.state !== 'play') break;
      const now = F.pos(g).x - refLeft(lane, g.frog.ride, g.t);
      if (!near(now, off, 1e-6) && Math.abs(now - off) < lane.P / 2) drift++;
    }
  }
  check(wrongLand === 0, 'landing in the river: on something afloat you ride, otherwise you drown', `${wrongLand} wrong`);
  check(paidDead === 0, 'a landing that drowns pays nothing', `${paidDead} paid`);
  check(drift === 0, 'a riding frog keeps its place on the item to a millionth of a cell', `${drift} drifted`);
  check(boarded > 300 && splashed > 300, 'both happen in the sample', `${boarded} boarded, ${splashed} splashed`);
  // swept off: riding past the board edge drowns the frog, and not before its centre leaves
  let early = 0, never = 0;
  for (let k = 0; k < 200; k++) {
    const g = F.create({night: 3, t: r() * 300}); const lane = g.lanes[9];
    const it = lane.items[0]; let L = refLeft(lane, it, g.t);
    // find a time when this log is wholly on the board and put the frog on its leading end
    let tries = 0; while ((L < 0 || L + it.len > COLS) && tries++ < 4000) { F.step(g, 1 / 60); L = refLeft(lane, it, g.t); }
    if (g.state !== 'play') continue;
    g.frog = {row: 9, x: 0, hop: null, ride: it, off: it.len - 0.01, dir: 'up'}; g.timeLeft = 30;
    let died = null; for (let s = 0; s < 2000 && !died; s++) { const ev = F.step(g, 1 / 120); const d = ev.find(e => e.type === 'die'); if (d) died = d; else if (F.frogX(g) > COLS + 1e-6 || F.frogX(g) < -1e-6) early++; }
    if (!died || died.cause !== 'swept') never++;
  }
  check(early === 0 && never === 0, 'a frog carried past the edge is swept away the moment its centre leaves', `${early} late, ${never} never`);
  // divers: safe on top and while dipping, deadly only once under
  let wrongDive = 0, dives = 0;
  for (let n = 2; n <= 8; n++) {
    const g0 = F.create({night: n}); const lane = g0.lanes[7]; const it = lane.items.find(i => i.dive); if (!it) continue;
    for (let t = 0; t < it.dive.period * 3; t += 0.05) {
      const g = F.create({night: n, t}); const it2 = g.lanes[7].items[it.i];
      g.frog = {row: 7, x: 0, hop: null, ride: it2, off: 0.5, dir: 'up'};
      const ev = F.step(g, STEP); const died = ev.some(e => e.type === 'die' && e.cause === 'dive');
      const under = F.sink(it2, g.t) >= 1; if (under) dives++;
      const L = refLeft(g.lanes[7], it2, g.t); const off = L + 0.5 < 0 || L + 0.5 > COLS;
      if (!off && died !== under) wrongDive++;
    }
  }
  check(wrongDive === 0 && dives > 0, 'a rider drowns exactly while its turtle is under', `${wrongDive} wrong`);
  let warned = true;
  for (let n = 2; n <= 10; n++) for (const lane of F.night(n)) if (lane) for (const it of lane.items) if (it.dive) {
    // two seconds before every dive the tell is showing
    for (let t = 0; t < it.dive.period * 2; t += 0.01) if (F.sink(it, t) > 0 && F.sink(it, t - 2.0) === 0 && F.warn(it, t - 1.0) === 0 && F.sink(it, t - 1.0) === 0) warned = false;
  }
  check(warned, 'every dive is preceded by bubbles (the warn tell) for the second before it dips');
}

if (suites.includes('home')) {
  section('home: inlets save, the bank kills, a taken pad kills');
  const ride = (g, x) => { // stand on a big imaginary log under the bank: put the frog on row 11 ground-free
    g.frog = {row: 11, x, hop: null, ride: null, off: 0, dir: 'up'}; g.maxRow = 11; F.press(g, 'up');
    // row 11 is river; skip its checks by hopping on the next substep
    return settle(g);
  };
  let ok = 0, wrong = 0;
  for (let x = 0.3; x < COLS - 0.3; x += 0.05) {
    const g = F.create({night: 1, t: 10}); g.fly.next = 1e9;
    const ev = ride(g, x);
    const bay = BAYS.findIndex(b => Math.abs(x - b) < F.BAY_REACH);
    const home = ev.find(e => e.type === 'home'), died = ev.find(e => e.type === 'die');
    if (bay >= 0 ? (home && home.bay === bay) : (died && died.cause === 'bank')) ok++; else wrong++;
  }
  check(wrong === 0, 'landing within reach of an inlet saves the frog; anywhere else on the bank kills', `${wrong} wrong of ${ok + wrong}`);
  {
    const g = F.create({night: 1, t: 10}); g.fly.next = 1e9; g.bays[2] = 1;
    const ev = ride(g, BAYS[2]); check(ev.some(e => e.type === 'die' && e.cause === 'taken'), 'a pad already taken kills');
  }
  {
    const g = F.create({night: 1, t: 10}); g.timeLeft = 12.3; g.fly = {bay: 3, until: 1e9, next: 1e9};
    const s0 = g.score; const ev = ride(g, BAYS[3]); const h = ev.find(e => e.type === 'home');
    check(h && h.fly && h.pts === 10 + 50 + 10 * Math.ceil(h.timeLeft) + 200, 'home pays the row, 50, ten a second left, and 200 for the firefly', JSON.stringify(h));
    check(g.score - s0 === h.pts && !ev.some(e => e.type === 'step'), 'and the score moves by exactly that, in one payment');
    check(g.fly.bay === -1, 'the firefly is eaten');
  }
  {
    const g = F.create({night: 4, t: 10}); g.fly.next = 1e9; g.bays = [1, 1, 1, 1, 0]; const s0 = g.score;
    const ev = ride(g, BAYS[4]);
    check(g.state === 'clear' && ev.some(e => e.type === 'clear'), 'the fifth frog clears the night');
    check(ev.some(e => e.type === 'clear' && e.pts === 1000), 'a night is worth 1000');
    let nev = []; for (let s = 0; s < 3 / STEP && g.state === 'clear'; s++) nev = nev.concat(F.step(g, STEP));
    check(g.state === 'play' && g.night === 5 && g.bays.every(b => !b) && JSON.stringify(g.lanes) === JSON.stringify(F.night(5)), 'then night 5 begins with empty pads and its own lanes');
    check(g.frog.row === 0 && near(g.frog.x, 4.5) && near(g.timeLeft, LIFE), 'with a fresh frog at the start and a full clock');
  }
  {
    // the firefly visits only open inlets, and each visit is seen
    const g = F.create({night: 1, t: 0, seed: 9}); g.bays = [1, 0, 1, 0, 1]; let bad = 0, visits = 0;
    for (let s = 0; s < 120 / STEP; s++) { for (const e of F.step(g, STEP)) if (e.type === 'fly') { visits++; if (g.bays[e.bay]) bad++; } g.timeLeft = 30; if (g.state !== 'play') break; }
    check(visits > 3 && bad === 0, 'the firefly only ever lands in an open inlet', `${visits} visits, ${bad} on taken pads`);
  }
}

if (suites.includes('rules')) {
  section('rules: score, clock, lives');
  {
    const g = F.create({night: 1, t: 0}); g.lanes = g.lanes.map(l => l && Object.assign({}, l, {items: []})); // an empty road
    const s0 = g.score; const hop = d => { F.press(g, d); settle(g); };
    hop('up'); hop('up'); hop('down'); hop('up'); hop('up');
    check(g.score - s0 === 30, 'ten points for each row never reached before, nothing for coming back', `${g.score - s0}`);
    hop('left'); hop('left'); check(g.score - s0 === 30 && near(g.frog.x, 2.5), 'sidesteps score nothing and land on a column');
    for (let i = 0; i < 4; i++) hop('left'); check(near(g.frog.x, 0.5), 'the board edge stops a sidestep');
    const ev = (F.press(g, 'left'), F.step(g, STEP)); check(ev.some(e => e.type === 'bump'), 'and says so');
    const h = F.create({night: 1, t: 0}); place(h, 0, 4.5); let fell = null;
    for (let s = 0; s < (LIFE + 1) / STEP && !fell; s++) fell = F.step(h, STEP).find(e => e.type === 'die');
    check(fell && fell.cause === 'time' && near(h.t, LIFE, 0.02), 'a frog that waits runs out of time at 30 s');
    check(h.lives === 3, 'and costs a life');
  }
  {
    const g = F.create({night: 1, t: 0}); let over = null, spawns = 0;
    for (let k = 0; k < 4; k++) { place(g, 2, 4.5); g.lanes[2].items[0].x = (4.5 - g.lanes[2].v * g.t + M + 1000 * g.lanes[2].P - 0.5) % g.lanes[2].P;
      for (let s = 0; s < 2 / STEP; s++) for (const e of F.step(g, STEP)) { if (e.type === 'over') over = e; if (e.type === 'spawn') spawns++; } }
    check(spawns === 3 && over && g.state === 'over', 'four frogs, three respawns, then the game is over', `${spawns} spawns, state ${g.state}`);
    check(F.press(g, 'up') === false, 'nothing moves after the end');
  }
  {
    const g = F.create({night: 1}); g.score = 9990; g.lives = 2; g.frog.row = 0; g.frog.x = 4.5; g.lanes = g.lanes.map(l => l && Object.assign({}, l, {items: []}));
    F.press(g, 'up'); const ev = settle(g); check(ev.some(e => e.type === 'life') && g.lives === 3, 'an extra frog at 10,000');
  }
  {
    const g = F.create({title: true, t: 40}); F.step(g, 3);
    check(g.state === 'title' && g.timeLeft === LIFE && F.press(g, 'up') === false, 'the title waits: no clock, no hops');
    F.start(g); check(g.state === 'play' && F.press(g, 'up'), 'until the game starts');
  }
}

if (suites.includes('save')) {
  section('save: nothing read from storage is trusted');
  const s = F.sanitizeSave;
  check(JSON.stringify(s(null)) === JSON.stringify({best: 0, bestNight: 1, hints: {}}), 'nothing saved is a clean slate');
  const h = s({best: '1e309', bestNight: -4, hints: {side: 'yes', logs: true, evil: true}});
  check(h.best === 0 && h.bestNight === 1 && h.hints.logs === true && !('side' in h.hints) && !('evil' in h.hints), 'infinite, negative and unknown values are dropped');
  const k = s({best: 123456789012, bestNight: 1e6}); check(k.best === 9999990 && k.bestNight === 99, 'absurd numbers are clamped');
  check(s({best: 4210.7, bestNight: 3.9}).best === 4210 && s({best: 4210.7, bestNight: 3.9}).bestNight === 3, 'and fractions floored');
  check(s('{"best":5}').best === 0 && s([1, 2]).best === 0, 'and a string or an array is no save at all');
}

if (suites.includes('crossable')) {
  section('crossable: every night reaches every inlet, deciding five times a second');
  // breadth-first over the real core: at each 0.2 s decision, wait or hop any way; states are kept by
  // (row, x to a tenth, mid-hop). A night passes when all five inlets are reached within one frog's clock.
  const reach = (n, t0, DT) => {
    const g0 = F.create({night: n, t: t0}); g0.fly.next = 1e9;
    let front = [g0]; const found = new Set();
    for (let tick = 0; tick * DT < LIFE - 0.5 && front.length && found.size < 5; tick++) {
      const next = new Map();
      for (const g of front) for (const a of [null, 'up', 'left', 'right', 'down']) {
        if (a && g.frog.hop) continue;
        const h = clone(g); if (a) F.press(h, a);
        const ev = F.step(h, DT);
        const home = ev.find(e => e.type === 'home'); if (home) { found.add(home.bay); continue; }
        if (h.state !== 'play') continue;
        const key = h.frog.row + ':' + Math.round(F.pos(h).x * 10) + ':' + (h.frog.hop ? 1 : 0);
        if (!next.has(key)) next.set(key, h);
      }
      front = [...next.values()];
    }
    return found;
  };
  const nights = +opt('nights', 12);
  for (let n = 1; n <= nights; n++) {
    for (const t0 of [5 + n * 3.1, 41 + n * 7.7]) {
      const f = reach(n, t0, 0.2);
      check(f.size === 5, `night ${n} from t=${t0.toFixed(1)}: all five inlets reachable`, `only ${[...f].join(',')}`);
    }
  }
}

console.log(`\n${failures ? failures + ' failed, ' : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
