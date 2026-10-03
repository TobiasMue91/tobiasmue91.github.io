#!/usr/bin/env node
// Test suite for games/time_travel_agency.html (Departures).
//
// Runs the page's DOM-free <script id="core"> block in Node: the agency's whole economy. The board only ever draws
// what the core says - a coupon's price, a fare, the "a second" figure, what the away stub pays - so a core that is
// slightly wrong (a bulk price that is not the sum of single prices, a guided line that loses a trip between frames,
// time away that pays more than staying) looks exactly like a right one on the page.
//
//   node test/time_travel_agency.mjs                  # everything
//   node test/time_travel_agency.mjs price away       # named suites only
//   node test/time_travel_agency.mjs --page=path.html # run against another copy of the page
//   node test/time_travel_agency.mjs pace --report    # print each bot's day minute by minute
//
// Suites:
//   price  - a bulk buy costs exactly the single prices it replaces; MAX buys the most that is affordable and no more
//   rules  - lines open in order, nothing is bought on credit, guides need an open line, a busy train cannot be sent,
//            and only a guided line can be fitted out with the three classes that each triple its fares
//   tick   - one long frame pays what many short frames pay; a manual train pays once; every 25/50/100... halves the trip
//   away   - time away pays exactly what the same time on the board would, capped at a day
//   save   - a game saved at any moment carries on exactly; broken or hostile saves are refused or cleaned
//   migrate- the old page's save opens the lines its player had reached, and never the Big Bang
//   pace   - bots with a person's reaction time play to the Big Bang: an attentive one in about an hour, a casual one
//            later but within an evening, each line opening after the one before it, the first guide within minutes
//   fmt    - numbers read the way the board prints them

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'time_travel_agency.html'));
const REPORT = args.includes('--report');
const ALL = ['price', 'rules', 'tick', 'away', 'save', 'migrate', 'pace', 'fmt'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const near = (a, b, what, rel = 1e-9) => check(Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)), what, `got ${a}, want ${b}`);
const section = n => console.log(`\n=== ${n} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.T = TTA;', ctx);
const T = ctx.T;
const J = x => JSON.parse(JSON.stringify(x));
const N = T.LINES.length;

// a small seeded generator, so a failure can be replayed
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

if (suites.includes('price')) {
  section('price');
  const R = rng(1);
  for (let trial = 0; trial < 400; trial++) {
    const i = Math.floor(R() * N), n = Math.floor(R() * 300), k = 1 + Math.floor(R() * 60);
    let sum = 0;
    for (let j = 0; j < k; j++) sum += T.price(i, n + j, 1);
    near(T.price(i, n, k), sum, `line ${i}: ${k} cars from ${n} cost the sum of single cars`, 1e-9);
  }
  for (let trial = 0; trial < 600; trial++) {
    const i = Math.floor(R() * N), n = Math.floor(R() * 200);
    const coins = T.price(i, n, 1) * (R() < 0.3 ? 1 : 10 ** (R() * 5)) * (R() < 0.5 ? 1 : 1 + 1e-12);
    const k = T.maxAfford(i, n, coins);
    check(T.price(i, n, k) <= coins, `MAX never overspends (line ${i}, ${n} cars, ${coins})`);
    check(T.price(i, n, k + 1) > coins, `MAX buys all that is affordable (line ${i}, ${n} cars, k=${k})`, `${T.price(i, n, k + 1)} <= ${coins}`);
  }
  // exactly the price is enough
  for (let i = 0; i < N; i++) for (const n of [0, 1, 24, 99]) {
    const p = T.price(i, n, 10);
    check(T.maxAfford(i, n, p) >= 10, `line ${i} at ${n}: holding exactly the price of ten buys ten`);
  }
  const s = T.fresh(); s.coins = 1e9; s.lines[0].n = 5;
  eq(T.quantity(s, 0, 1), 1, 'mode ×1 sells one');
  eq(T.quantity(s, 0, 10), 10, 'mode ×10 sells ten');
  s.coins = 0;
  eq(T.quantity(s, 0, 'max'), 1, 'MAX with nothing to spend still prices one car');
}

if (suites.includes('rules')) {
  section('rules');
  const s = T.fresh();
  eq(s.lines.map(L => L.n), [1, 0, 0, 0, 0, 0, 0], 'the agency opens with one car on the nearest line');
  check(T.visible(s, 1) && !T.visible(s, 2), 'only the next line is offered');
  eq(T.buy(s, 1, 1), 0, 'a line cannot be opened on credit');
  eq(s.lines[1].n, 0, '...and nothing changed');
  s.coins = 1e12;
  eq(T.buy(s, 2, 1), 0, 'a line two ahead cannot be opened, however rich');
  eq(T.buy(s, 1, 1), 1, 'the next line opens when paid for');
  check(T.visible(s, 2), '...and offers the one after it');
  check(!T.hire(s, 2), 'nobody can be hired for a line that is not open');
  const before = s.coins;
  check(T.hire(s, 1), 'a guide is hired for an open line');
  near(before - s.coins, T.LINES[1].guide, 'hiring costs the guide price');
  check(!T.hire(s, 1), 'a guide cannot be hired twice');
  check(s.lines[1].out, 'a guide sends the train out at once');
  check(T.dispatch(s, 0), 'an idle train can be dispatched');
  check(!T.dispatch(s, 0), 'a train already out cannot be dispatched again');
  check(!T.dispatch(s, 1), 'a guided train is never dispatched by hand');
  const t = T.fresh(); t.coins = 5;
  const p = T.price(0, 1, 10);
  eq(T.buy(t, 0, 10), 0, 'ten cars are not sold for the price of one');
  t.coins = p; eq(T.buy(t, 0, 10), 10, 'ten cars are sold for the price of ten');
  near(t.coins, 0, 'and nothing else was taken', 1e-6);
  const k = T.fresh(); k.coins = 1e15; k.lines[0].n = 10;
  check(!T.upgrade(k, 0), 'a line without a guide cannot be fitted out');
  T.hire(k, 0);
  const f0 = T.fareOf(k, 0), c0 = k.coins;
  check(T.upgrade(k, 0), 'a guided line takes its first class');
  near(c0 - k.coins, T.classPrice(0, 0), 'the class costs its price');
  near(T.fareOf(k, 0), 3 * f0, 'and triples the fare');
  T.upgrade(k, 0); T.upgrade(k, 0);
  near(T.fareOf(k, 0), 27 * f0, 'three classes: twenty-seven times the fare');
  check(!T.upgrade(k, 0), 'there is no fourth class');
  eq(T.load(T.save(k)).lines[0].cls, 3, 'the classes survive a save');
  const kk = T.fresh(); kk.coins = T.classPrice(0, 0) - 1; kk.lines[0].guide = true;
  check(!T.upgrade(kk, 0), 'a class is not sold on credit');
  check(!T.bangVisible(t), 'the Big Bang is not offered early');
  const u = T.fresh(); for (let i = 0; i < N; i++) u.lines[i].n = 1;
  check(T.bangVisible(u), 'the Big Bang is offered once the last line runs');
  u.coins = T.FINALE.cost - 1; check(!T.openBang(u), 'the Big Bang is not sold on credit');
  u.coins = T.FINALE.cost; check(T.openBang(u) && T.dispatchBang(u), 'the last train departs');
  check(!T.dispatchBang(u), 'and only once');
  T.tick(u, T.FINALE.t - 0.01); check(!u.bang.done, 'it is not there early');
  T.tick(u, 0.02); check(u.bang.done, 'it arrives on time');
}

if (suites.includes('tick')) {
  section('tick');
  const R = rng(7);
  for (let trial = 0; trial < 60; trial++) {
    const a = T.fresh();
    for (let i = 0; i < N; i++) { a.lines[i].n = Math.floor(R() * 120) + 1; a.lines[i].guide = R() < 0.7; a.lines[i].out = true; a.lines[i].t = R() * T.trip(i, a.lines[i].n); }
    const b = J(a);
    const secs = 1 + R() * 300;
    T.tick(a, secs);                              // one long frame
    let left = secs; while (left > 1e-9) { const d = Math.min(left, 1 / 60); T.tick(b, d); left -= d; }  // a minute of real frames
    // manual lines: both pay their one trip; guided lines: the same number of trips either way
    near(a.coins, b.coins, `trial ${trial}: one ${secs.toFixed(1)}s frame pays what 60fps frames pay`, 1e-6);
  }
  const s = T.fresh(); s.lines[0].n = 3;
  T.dispatch(s, 0); T.tick(s, 1000);
  near(s.coins, T.fareOf(s, 0), 'a manual train pays once, however long it is left');
  check(!s.lines[0].out, '...and waits at the platform');
  eq(T.MILESTONES.map(m => T.trip(0, m) / T.trip(0, m - 1)), T.MILESTONES.map(() => 0.5), 'every milestone halves the round trip');
  const g = T.fresh(); g.lines[0].n = 10; g.lines[0].guide = true; g.lines[0].out = true;
  const r = T.rate(g); T.tick(g, 600);
  near(g.coins, r * 600, 'a guided line earns its "a second" figure', 1e-3);
  const m = T.fresh(); m.timelines = 2;
  near(T.fareOf(m, 0, 1), 4 * T.LINES[0].fare, 'each finished timeline doubles every fare');
}

if (suites.includes('away')) {
  section('away');
  const R = rng(11);
  for (let trial = 0; trial < 60; trial++) {
    const a = T.fresh();
    for (let i = 0; i < N; i++) { a.lines[i].n = Math.floor(R() * 150); a.lines[i].guide = a.lines[i].n > 0 && R() < 0.6; a.lines[i].out = a.lines[i].n > 0 && (a.lines[i].guide || R() < 0.5); a.lines[i].t = a.lines[i].out ? R() * T.trip(i, a.lines[i].n || 1) : 0; }
    const b = J(a);
    const secs = R() * 7200;
    const res = T.away(a, secs);
    let left = secs; while (left > 1e-9) { const d = Math.min(left, 0.5); T.tick(b, d); left -= d; }
    near(a.coins, b.coins, `trial ${trial}: ${Math.round(secs)}s away pays what ${Math.round(secs)}s on the board pays`, 1e-6);
    near(res.coins, a.coins, `trial ${trial}: the stub shows what was paid`, 1e-9);
  }
  const c = T.fresh(); c.lines[0].n = 50; c.lines[0].guide = true; c.lines[0].out = true;
  const d = J(c);
  T.away(c, 3 * 86400); T.away(d, T.AWAY_CAP);
  near(c.coins, d.coins, 'three days away pay the same as one');
  const e = T.fresh(); T.away(e, 1e5); eq(e.coins, 0, 'an agency with no guides earns nothing while nobody watches');
}

if (suites.includes('save')) {
  section('save');
  const R = rng(5);
  for (let trial = 0; trial < 40; trial++) {
    const s = T.fresh(); s.coins = 50;
    const steps = 200 + Math.floor(R() * 2000);
    for (let k = 0; k < steps; k++) bot(s, R, 0.1);
    const copy = T.load(T.save(s));
    check(copy !== null, `trial ${trial}: a save loads`);
    for (let k = 0; k < 500; k++) { const r1 = rng(trial * 1000 + k); const r2 = rng(trial * 1000 + k); bot(s, r1, 0.1); bot(copy, r2, 0.1); }
    near(copy.coins, s.coins, `trial ${trial}: a loaded game carries on exactly`, 1e-9);
    eq(copy.lines, s.lines, `trial ${trial}: every line is where it would have been`);
  }
  for (const bad of ['', 'null', '{', '[]', '{"v":2}', '{"v":1}', '"x"', '{"v":1,"lines":"no"}']) eq(T.load(bad), null, `refuses ${JSON.stringify(bad)}`);
  const h = T.load(JSON.stringify({v: 1, coins: -5, earned: 'lots', timelines: -3, lines: [{n: 3.7, guide: true}, {n: -1}, {n: 2, guide: true, out: true, t: NaN}]}));
  check(h && h.coins === 0 && h.earned === 0 && h.timelines === 0, 'negative and nonsense numbers come back as zero');
  eq(h.lines.slice(0, 3).map(L => [L.n, L.guide, L.out]), [[3, true, true], [1, false, false], [2, true, true]], 'cars are whole, a gap before an open line is filled, a guide always has its train out');
  const z = T.load(JSON.stringify({v: 1, lines: [{n: 0, guide: true}]}));
  check(z.lines[0].guide === false, 'no guide on a line with no cars');
}

// a bot that plays a moment of the game: used by the save suite
function bot(s, R, dt) {
  T.tick(s, dt);
  const i = Math.floor(R() * N);
  const r = R();
  if (r < 0.4) T.dispatch(s, i);
  else if (r < 0.7) T.buy(s, i, [1, 10, 'max'][Math.floor(R() * 3)]);
  else if (r < 0.75) T.hire(s, i);
}

if (suites.includes('migrate')) {
  section('migrate');
  const kinds = k => Array.from({length: 21}, (_, j) => ({id: 'u' + j, owned: j < k ? 3 : 0}));
  eq(T.fromOld('{"timeCrystals":0}'), null, 'an untouched old agency is not migrated');
  eq(T.fromOld('not json'), null, 'a broken old save is ignored');
  const none = T.fromOld(JSON.stringify({timeCrystals: 40, upgrades: kinds(0)}));
  eq(none.lines.map(L => L.n), [1, 0, 0, 0, 0, 0, 0], 'a few crystals and nothing bought: a fresh start');
  near(none.coins, 40, '...with the crystals in the till');
  const all = T.fromOld(JSON.stringify({timeCrystals: 1e30, upgrades: kinds(21), prestigeCount: 4}));
  eq(all.lines.map(L => L.n > 0), [true, true, true, true, true, true, false], 'everything bought opens every line but the last');
  check(!all.bang.open && !T.bangVisible(all), 'the Big Bang is never handed over');
  eq(all.timelines, 1, 'starting over in the old agency counts as one finished timeline');
  near(all.coins, T.LINES[N - 1].base, 'the crystals pay for the next line and no more');
  const half = T.fromOld(JSON.stringify({timeCrystals: 10, upgrades: kinds(11)}));
  eq(half.lines.filter(L => L.n).length, 3, 'half the catalogue: half the lines');
}

if (suites.includes('pace')) {
  section('pace');
  // a player: reaction time between taps, a think every so often, buys what pays back soonest, hires a guide as soon
  // as it can (that is what the glowing medallion asks for), opens a line the moment it can pay for it, saves up for the next line when it is close
  function play({tapGap, think, horizon = 4 * 3600, seed = 1}) {
    const s = T.fresh(), R = rng(seed);
    let t = 0, nextThink = 0, nextTap = 0;
    const marks = {}, report = [];
    const dt = 0.05;
    while (t < horizon && !s.bang.done) {
      T.tick(s, dt); t += dt;
      if (t >= nextTap) {
        let best = -1, bv = -1;
        s.lines.forEach((L, i) => { if (L.n && !L.out && !L.guide) { const v = T.lineRate(s, i); if (v > bv) { bv = v; best = i; } } });
        if (best >= 0) { T.dispatch(s, best); nextTap = t + tapGap * (0.7 + R() * 0.6); }
      }
      if (t >= nextThink) {
        nextThink = t + think * (0.7 + R() * 0.6);
        for (let guard = 0; guard < 80; guard++) {
          let best = null;
          s.lines.forEach((L, i) => {
            if (!T.visible(s, i)) return;
            if (L.n && !L.guide && s.coins >= T.LINES[i].guide) { best = {r: Infinity, c: T.LINES[i].guide, act: () => T.hire(s, i)}; return; }
            if (L.guide && L.cls < T.CLASSES.length) { const c = T.classPrice(i, L.cls), r = 2 * T.lineRate(s, i) / c; if (!best || r > best.r) best = {r, c, act: () => T.upgrade(s, i)}; }
            if (!L.n && s.coins >= T.price(i, 0, 1)) { best = {r: Infinity, c: T.price(i, 0, 1), act: () => T.buy(s, i, 1)}; return; }
            if (best && best.r === Infinity) return;
            const n = L.n, c = T.price(i, n, 1);
            const gain = n ? T.fareOf(s, i, n + 1) / T.trip(i, n + 1) - T.lineRate(s, i) : T.fareOf(s, i, 1) / T.trip(i, 1) * 3;
            const r = gain / c; if (!best || r > best.r) best = {r, c, act: () => T.buy(s, i, 1)};
          });
          if (T.bangVisible(s) && !s.bang.open) {
            if (s.coins >= T.FINALE.cost) { T.openBang(s); T.dispatchBang(s); marks.bang = t; }
            else if (s.coins > T.FINALE.cost * 0.3) break;
          }
          if (!best || best.c > s.coins) break;
          best.act();
        }
        s.lines.forEach((L, i) => { if (L.n && marks['open' + i] == null) marks['open' + i] = t; if (L.guide && marks['guide' + i] == null) marks['guide' + i] = t; });
      }
      if (REPORT && Math.abs(t % 300) < dt / 2) report.push(`${String(Math.round(t / 60)).padStart(4)}m  coins ${T.short(s.coins).padStart(7)}  rate ${T.short(T.rate(s)).padStart(7)}/s  cars ${s.lines.map(L => L.n).join(',')}`);
    }
    if (s.bang.done) marks.end = t;
    return {marks, report, s};
  }
  const players = [
    {name: 'attentive', tapGap: 0.6, think: 2, end: [45, 95]},
    {name: 'steady', tapGap: 1.5, think: 8, end: [50, 110]},
    {name: 'casual', tapGap: 3, think: 30, end: [55, 150]},
  ];
  const min = x => x / 60;
  for (const P of players) {
    for (const seed of [1, 2]) {
      const {marks, report} = play({...P, seed});
      if (REPORT) { console.log(`  ${P.name} (seed ${seed})`); report.forEach(l => console.log('   ' + l)); }
      const end = marks.end != null ? min(marks.end) : Infinity;
      check(end >= P.end[0] && end <= P.end[1], `${P.name} (seed ${seed}) reaches the Big Bang in ${P.end[0]}-${P.end[1]} min`, `took ${end.toFixed(1)} min`);
      if (process.env.VERBOSE) console.log(`        ${P.name} ${seed}: ${end.toFixed(1)} min`);
      const opens = T.LINES.map((_, i) => marks['open' + i]).slice(1);
      check(opens.every((x, k) => x != null && (k === 0 || x > opens[k - 1])), `${P.name}: each line opens after the one before`, JSON.stringify(opens.map(x => x && +min(x).toFixed(1))));
      check(min(opens[0]) >= 0.3 && min(opens[0]) <= 5, `${P.name}: the second line opens within a few minutes`, `${min(opens[0]).toFixed(1)} min`);
      check(min(marks.guide0) <= 6, `${P.name}: the first guide is hired within minutes`, `${min(marks.guide0).toFixed(1)} min`);
      const gaps = opens.map((x, k) => min(x - (k ? opens[k - 1] : 0)));
      check(Math.max(...gaps) <= 30, `${P.name}: no line keeps the player waiting more than half an hour`, JSON.stringify(gaps.map(g => +g.toFixed(1))));
      const lastLine = min(opens[opens.length - 1]);
      check(end - lastLine >= 8, `${P.name}: the last line has time to matter before the end`, `${(end - lastLine).toFixed(1)} min`);
    }
  }
}

if (suites.includes('fmt')) {
  section('fmt');
  eq(T.fmt(0), '0', '0');
  eq(T.fmt(48213.9), '48,213', 'whole coins below a million, with commas');
  eq(T.fmt(999999), '999,999', 'up to a million');
  eq(T.fmt(1e6), '1.000 million', 'a million');
  eq(T.fmt(4213000), '4.213 million', 'four significant figures');
  eq(T.fmt(912.45e9), '912.4 billion', 'billions');
  eq(T.fmt(6e9), '6.000 billion', 'the Big Bang\'s price');
  eq(T.fmt(2.5e15), '2.500 quadrillion', 'quadrillions');
  eq(T.short(400), '400', 'short: small');
  eq(T.short(22500), '22.5K', 'short: thousands');
  eq(T.short(1.26e9), '1.26B', 'short: billions');
  eq(T.short(225000), '225K', 'short: hundreds of thousands');
  check([...Array(40)].every((_, k) => { const x = 10 ** (k / 2.3); return T.fmt(x).length <= 18 && T.short(x).length <= 6; }), 'every figure fits its flaps');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
