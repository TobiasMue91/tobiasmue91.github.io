#!/usr/bin/env node
// Test suite for games/bottom_of_the_sea.html.
//
// The page keeps its rules, balance and bots in a <script id="core"> block with no DOM; this runs
// that block alone in Node. An incremental is a web of numbers that pull on each other: a cheaper
// tool or one more storage tier can turn a 25-minute sea into a 9-minute one, or leave a newcomer
// stuck behind a full paddling pool for ever. None of that shows on a screenshot.
//
//   node test/bottom_of_the_sea.mjs                 # everything (about ten seconds)
//   node test/bottom_of_the_sea.mjs rules pacing    # named suites only
//   node test/bottom_of_the_sea.mjs --page=old.html # run against another copy of the page
//
// Suites: rules, effects, save, idle, pacing.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'bottom_of_the_sea.html');
const ALL = ['rules', 'effects', 'save', 'idle', 'pacing'];
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
const ctx = vm.createContext({ window: {} });
vm.runInContext(core[1] + '\nthis.SEA = SEA;', ctx);
const SEA = ctx.SEA, CFG = SEA.CFG;
const rich = () => { const S = SEA.newState(); S.storage = CFG.storage.length - 1; S.water = SEA.cap(S); return S; };
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/* ---------------- rules ---------------- */
if (suites.includes('rules')) {
  section('rules');
  {
    const S = SEA.newState();
    SEA.act(S, 'scoop');
    check(near(S.water, CFG.tools[0].scoop) && near(S.removed, CFG.tools[0].scoop), 'a scoop puts its litres in storage and takes them out of the sea');
    S.water = SEA.cap(S); const r0 = S.removed;
    check(SEA.full(S) && !SEA.act(S, 'scoop') && S.removed === r0 && S.spiltL > 0, 'a full puddle: the scoop runs back in, nothing is removed');
  }
  {
    const S = SEA.newState(); S.storage = CFG.storage.findIndex(s => s.blow); S.water = SEA.cap(S); S.tool = 4;
    const r0 = S.removed; SEA.act(S, 'scoop');
    check(S.removed > r0 && S.water === SEA.cap(S) && S.blownL > 0, 'under the clouds a full store still takes water out of the sea (the fan blows it away)');
  }
  {
    const S = SEA.newState(); S.water = 10;
    check(!SEA.act(S, 'tool') && S.tool === 0 && S.water === 10, 'a tool you cannot afford is not bought and costs nothing');
    S.water = CFG.tools[1].cost; check(SEA.act(S, 'tool') && S.tool === 1 && near(S.water, 0), 'a tool you can afford is bought for exactly its price');
  }
  {
    const S = rich(); S.tool = 4; S.water = 1e30;
    const one = SEA.helperCost(S, 0, 1); let seq = 0; const T = SEA.newState(); T.tool = 4;
    for (let i = 0; i < 25; i++) { seq += SEA.helperCost(T, 0, 1); T.helpers[0]++; }
    check(near(SEA.helperCost(S, 0, 25), seq, 1e-9) && one === CFG.helpers[0].cost, 'the price of 25 helpers is the sum of 25 single prices');
    S.water = seq * 1.0000001; check(SEA.helperAfford(S, 0) === 25, 'helperAfford finds the most the purse buys', `got ${SEA.helperAfford(S, 0)}`);
    const H = SEA.newState(); H.water = 1e9; H.storage = 6;
    check(!SEA.act(H, 'helper', 0, 1), 'no helpers before the bucket');
  }
  {
    const S = SEA.newState();
    check(!SEA.act(S, 'collect', 'flipflop'), 'a find cannot be picked up while it is under water');
    S.removed = SEA.removedAt(CFG.finds[0].at + 1e-6); SEA.step(S, 0.01);
    check(S.exposed.flipflop && SEA.act(S, 'collect', 'flipflop') && S.found.flipflop, 'once the gauge passes it, it can');
    check(!SEA.act(S, 'collect', 'flipflop'), 'and only once');
    check(!SEA.act(S, 'pull'), 'the plug cannot be pulled before it is out of the water');
    S.removed = SEA.removedAt(CFG.plugAt + 1e-6); SEA.step(S, 0.01);
    check(SEA.act(S, 'pull') && S.done && SEA.remaining(S) === 0, 'pulling the plug ends the game and empties the sea');
    check(!SEA.act(S, 'scoop'), 'nothing can be scooped after the end');
  }
  {
    let mono = true, prev = -1, inv = true;
    for (let k = 0; k <= 200; k++) { const p = k / 200, r = SEA.removedAt(p), S = SEA.newState(); S.removed = r; const q = SEA.progress(S); if (q < prev - 1e-12) mono = false; prev = q; if (Math.abs(q - p) > 1e-9) inv = false; }
    check(mono && inv, 'progress rises with what is removed and removedAt is its inverse');
    const S = SEA.newState(); S.removed = 1e4;
    check(SEA.progress(S) > 0.1, 'ten thousand litres already move the gauge visibly (the log gauge)', `p=${SEA.progress(S)}`);
  }
  {
    const ids = new Set(); let ok = true;
    for (const list of [CFG.tools, CFG.helpers, CFG.storage, CFG.finds]) for (const x of list) { if (ids.has(x.id)) ok = false; ids.add(x.id); }
    check(ok, 'every tool, helper, storage tier and find has its own id');
    check(CFG.finds.every((f, i) => i === 0 || f.at > CFG.finds[i - 1].at) && CFG.finds[CFG.finds.length - 1].id === 'plug', 'finds come out in order and the plug is last');
    check(CFG.helpers.every(h => h.tool >= 4 && h.tool < CFG.tools.length), 'every helper needs a tool from the bucket on');
    check(CFG.storage.every((s, i) => i === 0 || (s.cap > CFG.storage[i - 1].cap && s.cost <= CFG.storage[i - 1].cap * SEA.bonus(SEA.newState(), 'cap'))), 'each storage tier holds more than the last and fits in it');
  }
}

/* ---------------- effects: every purchase and every find does something measurable ---------------- */
if (suites.includes('effects')) {
  section('effects');
  for (let i = 1; i < CFG.tools.length; i++) {
    const S = rich(); S.tool = i - 1; S.helpers = CFG.helpers.map(h => h.tool <= i - 1 ? 3 : 0);
    const before = SEA.scoopOf(S); S.tool = i; const after = SEA.scoopOf(S);
    check(after > before * 1.5, `tool ${CFG.tools[i].id}: a scoop gets bigger`, `${before} -> ${after}`);
  }
  for (let k = 0; k < CFG.helpers.length; k++) {
    const S = rich(); S.tool = CFG.helpers[k].tool;
    const r0 = SEA.rate(S); S.helpers[k] = 1; const r1 = SEA.rate(S);
    check(r1 > r0 && near(r1, CFG.helpers[k].rate), `helper ${CFG.helpers[k].id}: one of them scoops its rate`);
    S.helpers[k] = 9; const a = SEA.helperRate(S, k); S.helpers[k] = 10; const b = SEA.helperRate(S, k);
    check(near(b / a, 10 / 9 * 2), `helper ${CFG.helpers[k].id}: the tenth doubles them all`);
  }
  for (let i = 1; i < CFG.storage.length; i++) { const S = SEA.newState(); S.storage = i - 1; const a = SEA.cap(S); S.storage = i; check(SEA.cap(S) > a, `storage ${CFG.storage[i].id} holds more`); }
  const keys = { scoop: S => SEA.scoopOf(S), cap: S => SEA.cap(S), rate: S => SEA.rate(S), cost: S => -SEA.toolCost(S), all: S => SEA.rate(S) + SEA.scoopOf(S), auto: S => SEA.autoScoops(S) };
  for (const f of CFG.finds) {
    if (f.id === 'plug') continue;
    for (const key of Object.keys(f.bonus)) {
      const S = rich(); S.tool = 6; S.helpers = S.helpers.map(() => 4); S.storage = 5;
      const a = keys[key](S); S.found[f.id] = true; const b = keys[key](S);
      check(b > a, `find ${f.id}: its ${key} bonus changes the game`, `${a} -> ${b}`);
    }
  }
}

/* ---------------- save ---------------- */
if (suites.includes('save')) {
  section('save');
  const r = SEA.simulate('eager', 600, 0.1);
  const S = r.S, json = SEA.save(S), L = SEA.load(json);
  const strip = o => { const c = JSON.parse(SEA.save(o)); return JSON.stringify(c); };
  check(strip(S) === strip(L), 'a game ten minutes in saves and loads unchanged');
  check(JSON.stringify(SEA.load('nonsense')) === JSON.stringify(SEA.newState()) && JSON.stringify(SEA.load(null)) === JSON.stringify(SEA.newState()), 'a broken save gives a fresh sea, not an error');
  const bad = SEA.load({ v: SEA.VERSION, water: -5, removed: 1e40, tool: 99, storage: -3, helpers: ['x', 4.7] });
  check(bad.water === 0 && bad.removed === CFG.ocean && bad.tool === CFG.tools.length - 1 && bad.storage === 0 && bad.helpers[0] === 0 && bad.helpers[1] === 4, 'nonsense in a save is clamped to something playable');
  const big = SEA.newState(); big.storage = 3; big.water = 1e9;
  check(SEA.load(SEA.save(big)).water === SEA.cap(big), 'a purse larger than its storage is trimmed on load');
}

/* ---------------- idle ---------------- */
if (suites.includes('idle')) {
  section('idle');
  {
    const S = SEA.newState(); S.tool = 5; S.helpers[0] = 20; S.storage = 2; S.water = 0;
    const r = SEA.away(S, 3600);
    check(r && r.full && S.water === SEA.cap(S), 'an hour away fills storage and then the helpers stop');
    check(S.t === 0, 'time away is not counted as play time');
  }
  {
    const S = SEA.newState(); S.tool = 5; S.helpers[0] = 20; S.storage = 10; S.water = 0;
    const a = SEA.newState(); Object.assign(a, JSON.parse(SEA.save(S))); a.ev = [];
    const r8 = SEA.away(S, 8 * 3600), r30 = SEA.away(a, 30 * 3600);
    check(near(r8.removed, r30.removed, 1e-6) && r8.sec === CFG.awayCap, 'time away counts for at most eight hours');
    check(r8.removed > 0 && r8.removed >= r8.stored, 'under the clouds the helpers keep removing water while away');
  }
  {
    const S = SEA.newState(); S.tool = 5; S.helpers[0] = 3; S.storage = 4;
    check(SEA.away(S, 30) === null, 'half a minute away is not worth a report');
    const T = SEA.newState(); check(SEA.away(T, 4000) === null, 'with no helpers there is nothing to report');
  }
}

/* ---------------- pacing ---------------- */
if (suites.includes('pacing')) {
  section('pacing');
  const win = { eager: [18, 26], casual: [24, 34], novice: [30, 46] };
  for (const style of ['eager', 'casual', 'novice']) {
    const r = SEA.simulate(style, 3600 * 1.5, 0.1);
    const end = r.end != null ? r.end / 60 : null;
    console.log(`  ${style}: bottom at ${end == null ? 'never' : end.toFixed(1) + ' min'}, storage full for ${(r.S.fullT / 60).toFixed(1)} min, ${(r.S.scoopedL / r.S.removed * 100).toFixed(0)} % by hand`);
    check(end != null && end >= win[style][0] && end <= win[style][1], `${style}: reaches the plug in ${win[style][0]}-${win[style][1]} minutes`, `at ${end == null ? 'never' : end.toFixed(1)}`);
    const lv = r.log.level, at2 = lv.find(x => x[0] === 2);
    check(at2 && at2[1] >= 0.05, `${style}: the water is visibly lower after two minutes`, `p=${at2 && at2[1].toFixed(3)}`);
    check(CFG.finds.every(f => r.S.found[f.id]), `${style}: finds everything on the way down`);
    check(r.S.tool === CFG.tools.length - 1, `${style}: owns every tool by the end`);
    // the gauge never stands still for long: at most three minutes without a percent of progress
    let worst = 0; for (let i = 3; i < lv.length; i++) { let j = i; while (j > 0 && lv[i][1] - lv[j - 1][1] < 0.01) j--; worst = Math.max(worst, lv[i][0] - lv[j][0]); }
    check(worst <= 3, `${style}: the water never stays put for more than three minutes`, `${worst} min`);
    const hand = r.S.scoopedL / r.S.removed;
    if (style !== 'novice') check(hand > 0.2 && hand < 0.8, `${style}: scooping by hand still matters, but the helpers do much of it`, `${(hand * 100).toFixed(0)} % by hand`);
    if (style === 'novice') {
      const f = r.log.firsts.map(x => x[0]);
      check(f[0] <= 120, 'novice: something new within two minutes', `first at ${f[0]?.toFixed(0)} s`);
      check(f.filter(t => t <= 600).length >= 6, 'novice: six new things in the first ten minutes', `${f.filter(t => t <= 600).length}`);
    }
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
