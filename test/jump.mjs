#!/usr/bin/env node
// Test suite for games/jump.html (Moonhop).
//
// Moonhop is an endless bouncer, and the one promise it makes is that the course is always
// climbable: every ledge on the main chain is landable and within a bounce of the one below,
// and everything else (decoy clouds, glooms, springs) sits around that chain without breaking
// it. That is easy to break quietly from one tuning number. So the page keeps its world,
// generation and rules in a <script id="core"> block with no DOM, and this runs it in Node:
// the course is built for many seeds and measured, the rules are poked one bounce at a time,
// and a bot that plays like an attentive player climbs on fixed seeds to watch the pacing.
// No browser, no server.
//
//   node test/jump.mjs                 # everything (a few seconds)
//   node test/jump.mjs rules           # named suites only: world, rules, pacing
//   VERBOSE=1 node test/jump.mjs       # print passing assertions and the pacing table
//   node test/jump.mjs --page=old.html # run against another copy of the page

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'jump.html');
const ALL = ['world', 'rules', 'pacing'];
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
const ctx = vm.createContext({});
vm.runInContext(core[1], ctx);
const MH = vm.runInContext('MH', ctx);
const {W, T} = MH;
const JUMP = T.bounce * T.bounce / (2 * T.grav);

// Build a seed's course up to `top` world units, keeping every ledge and gloom ever made.
function course(seed, top) {
  const s = MH.create(seed, {VH: 760});
  const ledges = new Map(), glooms = new Map();
  for (let cam = 0; cam < top; cam += 400) {
    s.cam = cam; MH.generate(s);
    for (const L of s.ledges) ledges.set(L.id, {...L});
    for (const G of s.glooms) glooms.set(G.id, {...G});
    s.ledges = s.ledges.filter(L => L.y > cam - 300);
  }
  return {ledges: [...ledges.values()].sort((a, b) => a.y - b.y), glooms: [...glooms.values()]};
}

if (suites.includes('world')) {
  section('world');
  const SEEDS = 40, TOP = 40000; // 4000 m
  let worstGap = 0, worstGapAt = '', puffChain = 0, deadEnds = 0, overlaps = 0, nearGloom = 0, lane = 0, firsts = {spring: [], puff: [], balloons: [], comet: [], gloom: [], drift: [], wisp: []}, earlyGloom = 0, outside = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const {ledges, glooms} = course(seed, TOP);
    const mains = ledges.filter(L => L.main && L.kind !== 'roof' && L.kind !== 'wisp');
    let prev = 0;
    for (const L of mains) { const g = L.y - prev; if (g > worstGap) { worstGap = g; worstGapAt = `seed ${seed} at ${Math.round(L.y / 10)} m`; } prev = L.y; }
    if (mains.some(L => L.kind === 'puff')) puffChain++;
    // from any solid cloud at all (main or extra), the next chain cloud above is within a bounce:
    // whatever you used and missed on the way, where you land again is never a dead end
    for (const L of ledges) {
      if (L.kind !== 'pad' && L.kind !== 'drift' && L.kind !== 'roof') continue;
      const next = mains.find(M => M.y > L.y + 0.5);
      if (next && next.y - L.y > T.maxGap + 0.01) deadEnds++;
    }
    const real = ledges.filter(L => L.kind !== 'roof');
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length && real[j].y - real[i].y < 18; j++) {
      const a = real[i], b = real[j];
      if (Math.abs(MH.wrapD(a.x + a.w / 2, b.x + b.w / 2)) < (a.w + b.w) / 2) overlaps++;
    }
    for (const L of real) {
      if (L.x < 0 || L.x + L.w > W) outside++;
      if (L.y < 260 && Math.abs(L.x + L.w / 2 - W / 2) < L.w / 2 + 39) lane++;
    }
    for (const G of glooms) {
      if (G.y < 2200) earlyGloom++;
      const below = [...mains].reverse().find(L => L.y < G.y), above = mains.find(L => L.y > G.y);
      for (const L of [below, above]) if (L && Math.abs(MH.wrapD(G.x, L.x + L.w / 2)) < 100) nearGloom++;
    }
    const first = pred => { const L = real.find(pred); return L ? L.y / 10 : Infinity; };
    firsts.spring.push(first(L => L.item === 'spring'));
    firsts.balloons.push(first(L => L.item === 'balloons'));
    firsts.comet.push(first(L => L.item === 'comet'));
    firsts.puff.push(first(L => L.kind === 'puff'));
    firsts.drift.push(first(L => L.kind === 'drift'));
    firsts.wisp.push(first(L => L.kind === 'wisp'));
    firsts.gloom.push(Math.min(...glooms.map(G => G.y / 10)));
  }
  check(worstGap <= T.maxGap + 0.01, `main chain never asks for more than ${T.maxGap} u (worst ${worstGap.toFixed(1)}, ${worstGapAt})`);
  check(T.maxGap < JUMP * 0.85, `max gap ${T.maxGap} leaves margin under the ${JUMP.toFixed(0)} u bounce`);
  check(puffChain === 0, 'the chain is solid: no puff cloud is load-bearing', puffChain + ' seeds');
  check(deadEnds === 0, 'no solid cloud is a dead end: the chain is always in reach above it', deadEnds + ' dead ends');
  check(overlaps === 0, 'no two ledges crowd each other', overlaps + ' overlapping pairs');
  check(outside === 0, 'every ledge lies inside the column', outside + ' outside');
  check(lane === 0, 'nothing in the lane straight above the start below 26 m', lane + ' in the lane');
  check(nearGloom === 0, 'glooms keep 100 u clear of the main ledges either side', nearGloom + ' too close');
  check(earlyGloom === 0, 'no gloom before 220 m', earlyGloom + ' early');
  const max = a => Math.max(...a);
  check(max(firsts.spring) < 60, `a spring within the first 60 m on every seed (latest ${max(firsts.spring).toFixed(0)} m)`);
  check(max(firsts.puff) < 90, `a puff cloud by 90 m (latest ${max(firsts.puff).toFixed(0)} m)`);
  check(max(firsts.drift) < 140, `a drifting cloud by 140 m (latest ${max(firsts.drift).toFixed(0)} m)`);
  check(max(firsts.wisp) < 260, `a wisp by 260 m (latest ${max(firsts.wisp).toFixed(0)} m)`);
  check(max(firsts.balloons) < 260, `balloons by 260 m (latest ${max(firsts.balloons).toFixed(0)} m)`);
  check(max(firsts.comet) < 700, `a comet by 700 m (latest ${max(firsts.comet).toFixed(0)} m)`);
  check(max(firsts.gloom) < 320, `a gloom by 320 m (latest ${max(firsts.gloom).toFixed(0)} m)`);
  const a = JSON.stringify(course(7, 8000).ledges), b = JSON.stringify(course(7, 8000).ledges);
  check(a === b, 'the same seed builds the same course');
  check(a !== JSON.stringify(course(8, 8000).ledges), 'different seeds build different courses');
}

// A bare world with only what a test places in it.
function lab(opts = {}) {
  const s = MH.create(1, {VH: 760});
  s.ledges = []; s.glooms = []; s.gen.y = 1e9; s.cam = -100; s.idle = !!opts.idle;
  return s;
}
const run = (s, secs, input = {}) => { for (let t = 0; t < secs; t += 1 / 120) MH.step(s, 1 / 120, input); };
function ledge(s, kind, x, y, w = 90, extra = {}) {
  const L = {id: s.nextId++, kind, x, y, w, vx: 0, broken: false, brokeAt: 0, item: null, itemX: 0, main: true, ...extra};
  s.ledges.push(L); return L;
}
function apexAfter(s) { let top = s.p.y; for (let t = 0; t < 3 && !(s.p.vy < 0 && s.p.y < top - 1); t += 1 / 240) { MH.step(s, 1 / 240, {}); top = Math.max(top, s.p.y); } return top; }

if (suites.includes('rules')) {
  section('rules');
  { // a bounce off a plain cloud
    const s = lab(); ledge(s, 'pad', 150, 0); s.p.x = 195; s.p.y = 40; s.p.vy = 0;
    run(s, 0.3); const land = s.events.find(e => e.type === 'land');
    check(land, 'falling onto a cloud lands on it');
    s.events.length = 0; const top = apexAfter(s);
    check(Math.abs(top - JUMP) < 4, `a bounce rises ${JUMP.toFixed(0)} u`, 'rose ' + top.toFixed(1));
  }
  { // one-way: rising through a cloud from below does not land
    const s = lab(); ledge(s, 'pad', 150, 100); s.p.x = 195; s.p.y = 0; s.p.vy = T.bounce;
    run(s, 0.25);
    check(!s.events.some(e => e.type === 'land') && s.p.y > 100, 'clouds are one-way: you pass up through them');
  }
  { // missing a cloud by a hair
    const s = lab(); ledge(s, 'pad', 150, 0); s.p.x = 150 + 90 + T.footHalf + 3; s.p.y = 40; s.p.vy = 0;
    run(s, 0.4);
    check(!s.events.some(e => e.type === 'land'), 'feet past the cloud edge fall by');
  }
  { // puff: one bounce, then gone
    const s = lab(); const L = ledge(s, 'puff', 150, 0); s.p.x = 195; s.p.y = 40; s.p.vy = 0;
    run(s, 0.3);
    check(s.events.some(e => e.type === 'land' && e.kind === 'puff') && L.broken, 'a puff cloud bounces you once and bursts');
    run(s, 2.2);
    check(s.p.y < -100, 'and is not there to catch you on the way down');
  }
  { // wisp: no bounce
    const s = lab(); const L = ledge(s, 'wisp', 150, 0); s.p.x = 195; s.p.y = 40; s.p.vy = 0;
    run(s, 0.4);
    check(L.broken && !s.events.some(e => e.type === 'land') && s.p.vy < -200, 'a wisp gives way without a bounce');
  }
  { // spring
    const s = lab(); ledge(s, 'pad', 150, 0, 90, {item: 'spring', itemX: 45}); s.p.x = 195; s.p.y = 40; s.p.vy = 0;
    run(s, 0.2);
    check(s.events.some(e => e.type === 'spring'), 'landing on the spring fires it');
    s.events.length = 0; const top = apexAfter(s);
    check(top > JUMP * 2.8, `a spring throws you about three bounces high (${top.toFixed(0)} u)`);
    const s2 = lab(); ledge(s2, 'pad', 150, 0, 90, {item: 'spring', itemX: 10}); s2.p.x = 230; s2.p.y = 40; s2.p.vy = 0;
    run(s2, 0.2);
    check(!s2.events.some(e => e.type === 'spring') && s2.events.some(e => e.type === 'land'), 'landing on the cloud beside the spring is a plain bounce');
  }
  { // balloons
    const s = lab(); const L = ledge(s, 'pad', 150, 0, 90, {item: 'balloons', itemX: 45}); s.p.x = 195; s.p.y = 30; s.p.vy = 300;
    run(s, 0.1);
    check(s.events.some(e => e.type === 'balloons') && L.item === null, 'touching the balloons takes them');
    const y0 = s.p.y, R = T.ride.balloons; run(s, R.t);
    check(s.events.some(e => e.type === 'letgo'), 'the ride ends on its own');
    check(s.p.y - y0 > R.v * R.t * 0.75, `a balloon ride carries you about ${Math.round(R.v * R.t / 10)} m`, 'rose ' + (s.p.y - y0).toFixed(0));
    const c = lab(); ledge(c, 'pad', 150, 0, 90, {item: 'comet', itemX: 45}); c.p.x = 195; c.p.y = 20; c.p.vy = 300;
    run(c, 0.1); const c0 = c.p.y, C = T.ride.comet; run(c, C.t);
    check(c.events.some(e => e.type === 'comet'), 'touching a comet takes it');
    check(c.p.y - c0 > (R.v * R.t) * 1.8, `a comet carries you about twice as far as balloons (${Math.round((c.p.y - c0) / 10)} m)`);
  }
  { // stomp
    const s = lab(); const G = {id: 99, x: 200, x0: 200, y: 100, r: 21, alive: true, ph: 0, sway: 0, diedAt: 0}; s.glooms.push(G);
    s.p.x = 200; s.p.y = 140; s.p.vy = -300;
    run(s, 0.1);
    check(!G.alive && G.how === 'stomp' && !s.p.dead && s.p.vy > 0, 'landing on a gloom from above pops it and bounces you');
  }
  { // side hit
    const s = lab(); const G = {id: 99, x: 200, x0: 200, y: 100, r: 21, alive: true, ph: 0, sway: 0, diedAt: 0}; s.glooms.push(G);
    s.p.x = 200; s.p.y = 40; s.p.vy = 500;
    run(s, 0.15);
    check(s.p.dead && s.cause === 'gloom' && G.alive, 'running into a gloom from below knocks you out');
    run(s, 3);
    check(s.over && s.events.some(e => e.type === 'over' && e.cause === 'gloom'), 'and the run ends once you fall out of view');
  }
  { // blast while rocketing
    const s = lab(); const G = {id: 99, x: 200, x0: 200, y: 100, r: 21, alive: true, ph: 0, sway: 0, diedAt: 0}; s.glooms.push(G);
    s.p.x = 200; s.p.y = 40; s.p.vy = T.spring;
    run(s, 0.1);
    check(!s.p.dead && !G.alive && G.how === 'blast', 'off a spring you blast straight through a gloom');
  }
  { // shooting
    const s = lab(); const G = {id: 99, x: 200, x0: 200, y: 400, r: 21, alive: true, ph: 0, sway: 0, diedAt: 0}; s.glooms.push(G);
    s.p.x = 200; s.p.y = 100; s.p.vy = 0;
    MH.step(s, 1 / 120, {shoot: true}); run(s, 0.4);
    check(!G.alive && G.how === 'shot' && s.stats.kills === 1, 'a star seed fired straight up pops a gloom above');
    const s2 = lab(); s2.p.y = 100; MH.step(s2, 1 / 120, {shoot: true}); MH.step(s2, 1 / 120, {shoot: true});
    check(s2.seeds.length === 1, 'shots are spaced, not one per frame');
  }
  { // wrap
    const s = lab(); s.p.x = 4; s.p.y = 300; s.p.vy = 0;
    run(s, 0.2, {move: -1});
    check(s.p.x > W - 90, 'leaving the left edge brings you in on the right', 'x ' + s.p.x.toFixed(1));
    const s2 = lab(); ledge(s2, 'pad', W - 50, 0, 90 - 40); s2.p.x = 8; s2.p.y = 40; s2.p.vy = 0;
    run(s2, 0.3);
    check(s2.events.some(e => e.type === 'land'), 'a cloud at the right edge catches feet that just wrapped to the left');
  }
  { // drag steering is immediate and capped
    const s = lab(); s.p.x = 100; s.p.y = 300; s.p.vy = 0;
    MH.step(s, 1 / 60, {drag: 12});
    check(Math.abs(s.p.x - 112) < 0.01, 'a finger drag moves the moonling in the same frame');
    const s2 = lab(); s2.p.x = 100; s2.p.y = 300; MH.step(s2, 1 / 60, {drag: 500});
    check(s2.p.x - 100 <= T.dragMax / 60 + 0.01, 'but no faster than ' + T.dragMax + ' u/s');
  }
  { // drifting clouds stay in the column
    const s = lab(); const L = ledge(s, 'drift', 10, 500, 80, {vx: -130});
    s.p.y = 300; run(s, 6);
    check(L.x >= 2 && L.x + L.w <= W - 2, 'drifting clouds turn at the walls');
  }
  { // before the run, only the roof is solid
    const s = MH.create(3, {VH: 760, idle: true});
    run(s, 8);
    check(s.maxY < JUMP + 5 && !s.events.some(e => e.type === 'land' && e.kind !== 'roof'), 'while idle the moonling only bounces on the roof');
    s.idle = false; s.events.length = 0;
    let landedHigher = false;
    for (let t = 0; t < 4 && !landedHigher; t += 1 / 60) { MH.step(s, 1 / 60, {move: 1}); landedHigher = s.events.some(e => e.type === 'land' && e.kind !== 'roof'); }
    check(landedHigher, 'and the first steer reaches a cloud');
  }
  { // falling out
    const s = lab(); s.cam = 1000; s.p.y = 1100; s.p.vy = 0;
    run(s, 2);
    check(s.over && s.cause === 'fall', 'falling below the view ends the run');
  }
  { // the camera only goes up
    const s = lab(); s.cam = 500; s.p.y = 600; s.p.vy = 0; const c0 = s.cam;
    run(s, 0.3);
    check(s.cam >= c0, 'the camera never follows you down');
  }
}

// ---- pacing: an attentive bot on fixed seeds ----
function bot(s) {
  const p = s.p;
  const reachT = y => { const d = p.y - y - 10, disc = p.vy * p.vy + 2 * T.grav * d; return disc < 0 ? -1 : (p.vy + Math.sqrt(disc)) / T.grav; };
  let score = -1e9, tx = p.x;
  for (const L of s.ledges) {
    if (L.broken || L.kind === 'wisp') continue;
    const t = reachT(L.y); if (t < 0.05) continue;
    let cx = L.kind === 'roof' ? p.x : L.x + L.w / 2 + (L.vx || 0) * Math.min(t, 0.5);
    if (L.item === 'spring') cx = L.x + L.itemX;
    const dx = Math.abs(MH.wrapD(cx, p.x)), slack = L.kind === 'roof' ? 999 : L.w / 2;
    if (dx - slack > T.runV * t * 0.85) continue;
    let sc = L.y - dx * 0.05;
    if (L.item === 'spring' && L.y > p.y - 40) sc += 300;
    if (L.kind === 'puff') sc -= 20;
    for (const G of s.glooms) if (G.alive && Math.abs(MH.wrapD(G.x0 ?? G.x, cx)) < 50 + (G.sway || 0) && G.y > Math.min(L.y, p.y) - 40 && G.y < Math.max(L.y, p.y) + 260 && G.y > p.y - 60) sc -= 400;
    if (sc > score) { score = sc; tx = cx; }
  }
  for (const L of s.ledges) if ((L.item === 'balloons' || L.item === 'comet') && L.y + 58 > p.y - 20 && L.y + 58 < p.y + p.vy * p.vy / (2 * T.grav)) tx = L.x + L.itemX;
  // a gloom close above: get under it and shoot it, as a player would
  const G = s.glooms.find(G => G.alive && G.y > p.y + 30 && G.y < p.y + 420);
  if (G && p.lift <= 0) tx = G.x;
  const d = MH.wrapD(tx, p.x);
  return {move: Math.abs(d) < 4 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) / 30),
    shoot: s.glooms.some(G => G.alive && G.y > p.y && G.y < p.y + 450 && Math.abs(MH.wrapD(G.x, p.x)) < 22)};
}

if (suites.includes('pacing')) {
  section('pacing');
  const N = 24, CAP = 600, rows = [], tot = {land: {}, springs: 0, balloons: 0, comets: 0, stomps: 0, kills: 0, blasts: 0, hits: 0, wisps: 0, shots: 0};
  let stuck = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = MH.create(seed, {VH: 760});
    let t = 0, lastUp = 0, best = 0;
    while (!s.over && t < CAP) {
      MH.step(s, 1 / 60, bot(s)); s.events.length = 0; t += 1 / 60;
      if (s.maxY > best + 1) { best = s.maxY; lastUp = t; }
      if (t - lastUp > 30) { stuck++; break; }
    }
    rows.push({seed, m: Math.round(s.maxY / 10), cause: s.over ? s.cause : t >= CAP ? 'cap' : 'stuck', t: Math.round(t)});
    for (const k in s.stats.land) tot.land[k] = (tot.land[k] || 0) + s.stats.land[k];
    for (const k of ['springs', 'balloons', 'comets', 'stomps', 'kills', 'blasts', 'hits', 'wisps', 'shots']) tot[k] += s.stats[k];
  }
  rows.sort((a, b) => a.m - b.m);
  const med = rows[N >> 1].m, causes = {};
  for (const r of rows) causes[r.cause] = (causes[r.cause] || 0) + 1;
  if (process.env.VERBOSE) {
    console.log('  heights (m/cause/s): ' + rows.map(r => `${r.m}/${r.cause}/${r.t}`).join('  '));
    console.log('  causes', JSON.stringify(causes), ' totals', JSON.stringify(tot));
  }
  // the world suite proves no cloud is a dead end; a rare stall here is this simple bot dithering
  // between two targets, so a few are tolerated, but a run of them means the course changed shape
  check(stuck <= 2, `the bot rarely stalls for 30 s (${stuck}/${N})`);
  check(med > 900 && med < 12000, `median bot height ${med} m sits between 900 and 12000`);
  check(rows[0].m > 150, `even the worst bot run passes the Cloud Sea (${rows[0].m} m)`);
  check((causes.gloom || 0) <= N * 0.6, `glooms are not the whole story (${causes.gloom || 0}/${N} deaths)`);
  const landings = Object.values(tot.land).reduce((a, b) => a + b, 0);
  check(tot.land.puff > landings * 0.05 && tot.land.drift > landings * 0.1, 'puffs and drifters are a real share of the landings', JSON.stringify(tot.land));
  check(tot.kills + tot.stomps + tot.blasts > 0, 'glooms get popped');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
