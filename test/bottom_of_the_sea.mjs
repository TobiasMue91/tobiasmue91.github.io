#!/usr/bin/env node
// Test suite for games/bottom_of_the_sea.html.
//
// The page keeps its rules, balance and bots in a <script id="core"> block with no DOM; this runs that block alone in
// Node. An incremental is a web of numbers that pull on each other: a cheaper carrier or one more buyer tier can turn
// a half-hour sea into a ten-minute one, or leave a newcomer hiring helpers whose water runs straight back into the
// sea for ever. None of that shows on a screenshot.
//
// The game in one line: you scoop the sea into what you carry, walk it up the beach to a vending machine and sell it;
// the water's edge moves away as the sea goes down, so the walk gets longer until a pipeline ends it. Helpers bring
// water in on their own, but only as much as the buyer can take. Promotion lifts you off the beach (the region),
// then into orbit (the planet). The plug ends it.
//
//   node test/bottom_of_the_sea.mjs                 # everything (about fifteen seconds)
//   node test/bottom_of_the_sea.mjs rules pacing    # named suites only
//   node test/bottom_of_the_sea.mjs --page=old.html # run against another copy of the page
//
// Suites:
//   rules    - scooping into what you carry, spilling when it is full, selling at the machine, the pipeline, buying on
//              each rail, what is on offer at each stage, helpers and the buyer that limits them, the clouds, stages,
//              finds and the plug, the beach's walk (fpDrop, shoreDist) and the forecast.
//   effects  - every find's bonus does what its card says, the duck doubles everything for its time, milestones double.
//   save     - a save comes back equal; junk, other versions and bad numbers come back as a clean or clamped state.
//   idle     - time away: helpers keep selling, the buyer still limits them, eight hours at most, nothing without helpers.
//   pacing   - the three bots (eager, casual, novice) each pull the plug, in order and in time, with no long dead spell,
//              the pipeline before the promotion, every find picked up, and the records an eager player would earn.

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
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const idx = (list, id) => CFG[list].findIndex(x => x.id === id);
const PIPE = CFG.carry.length - 1;

/* ---------------- rules ---------------- */
if (suites.includes('rules')) {
  section('rules');
  {
    const S = SEA.newState();
    SEA.act(S, 'scoop');
    check(near(S.held, CFG.tools[0].scoop) && near(S.removed, CFG.tools[0].scoop) && S.money === 0, 'a scoop goes into what you carry and out of the sea, and is not money yet');
    S.held = SEA.capOf(S); const r0 = S.removed;
    check(!SEA.act(S, 'scoop') && S.removed === r0 && S.spiltL > 0, 'with your hands full the scoop runs back in: nothing is removed, the spill is counted');
    const L = S.held;
    check(SEA.act(S, 'sell') && S.held === 0 && near(S.money, L * CFG.price) && near(S.soldL, L), 'selling at the machine pays the price a litre for what you carry');
    check(!SEA.act(S, 'sell'), 'nothing to sell, no sale');
  }
  {
    const S = SEA.newState(); S.carry = PIPE;
    SEA.act(S, 'scoop');
    check(S.held === 0 && near(S.money, CFG.tools[0].scoop * CFG.price) && SEA.piped(S), 'with the pipeline a scoop is sold the moment it leaves the sea');
    const T = SEA.newState(); T.held = 3; T.money = 1e9; T.carry = PIPE - 1;
    SEA.act(T, 'buy', 'carry');
    check(T.held === 0 && T.soldL === 3 && T.ev.some(e => e.k === 'piped'), 'laying the pipeline sells what you were carrying');
  }
  {
    const S = SEA.newState(); S.money = 0.1;
    check(!SEA.act(S, 'buy', 'tool') && S.tool === 0 && S.money === 0.1, 'a tool you cannot afford is not bought and costs nothing');
    S.money = 1;
    const c = SEA.railCost(S, 'tool');
    check(SEA.act(S, 'buy', 'tool') && S.tool === 1 && near(S.money, 1 - c), 'one you can afford is bought at its price');
    for (const rail of Object.keys(SEA.RAILS)) { const T = SEA.newState(); T.money = 1e30; let n = 0; while (SEA.act(T, 'buy', rail)) n++; const stage0 = SEA.RAILS[rail].filter(x => rail !== 'tool' || x.stage === 0).length - 1; check(n === stage0, `on the beach the ${rail} rail goes ${stage0} steps up and no further`, `${n}`); }
    const T = SEA.newState(); T.money = 1e30; T.stage = 1;
    check(!SEA.nextOf(T, 'carry') && !SEA.nextOf(T, 'move') && SEA.piped(T), 'off the beach there is nothing to carry and nowhere to walk: everything is piped');
    T.tool = idx('tools', 'airlift');
    check(!SEA.nextOf(T, 'tool'), 'the region offers no planet-sized tools');
  }
  {
    const S = SEA.newState(); S.money = 1e6;
    check(!SEA.helperOpen(S, 0), 'no helpers before the bucket');
    S.tool = idx('tools', 'bucket');
    check(!SEA.helperOpen(S, 0), 'nor with a bucket while the machine cannot take any more');
    S.buyer = 1;
    check(SEA.helperOpen(S, 0) && !SEA.helperOpen(S, 1), 'a second machine lets volunteers in, and only them');
    const c3 = SEA.helperCost(S, 0, 3), m0 = S.money;
    check(SEA.act(S, 'helper', 0, 3) && S.helpers[0] === 3 && near(m0 - S.money, c3), 'helpers are hired in a batch at the summed price');
    check(near(SEA.helperCost(S, 0, 1), CFG.helpers[0].cost * Math.pow(CFG.helperGrowth, 3)), 'each one costs more than the last');
    for (let k = 0; k < CFG.helpers.length; k++) { const T = SEA.newState(); T.tool = 4; T.stage = 2; T.buyer = k; check(!SEA.helperOpen(T, k), `helper ${k} waits for buyer ${k + 1}`); }
  }
  {
    // the buyer: helpers bring in what it can take, the rest runs back
    const S = SEA.newState(); S.tool = 4; S.buyer = 1; S.helpers[0] = 400;
    const r = SEA.rate(S), b = SEA.buyerRate(S), r0 = S.removed;
    SEA.step(S, 1);
    check(r > b && near(S.removed - r0, b, 1e-6) && near(S.spiltL, r - b, 1e-6) && S.overflow, 'what the buyer cannot take is not removed: it runs back into the sea');
    check(near(S.money, b * SEA.price(S), 1e-6), 'and only what it takes is paid for');
    const B = SEA.newState(); B.tool = 4; B.stage = 2; B.buyer = idx('buyer', 'cloud'); B.helpers[0] = 1; B.helpers[8] = 4000;
    const rb = SEA.rate(B), bb = SEA.buyerRate(B), rain = SEA.rainBack(B), q0 = B.removed;
    SEA.step(B, 1);
    check(rb > bb && near(B.removed - q0, bb + (rb - bb) * (1 - rain), 1e-6) && near(B.rainL, (rb - bb) * rain, 1e-6), 'under the clouds the surplus is blown away and some of it rains back');
    check(CFG.buyer.filter(x => x.blow).every((x, i, a) => i === 0 || x.rain <= a[i - 1].rain) && CFG.buyer[CFG.buyer.length - 1].rain === 0, 'each cloud tier rains back less, the last not at all');
  }
  {
    const S = SEA.newState(); S.money = 1e30;
    check(!SEA.stageNext(S) && !SEA.act(S, 'stage'), 'no promotion before the sea is low enough');
    S.removed = SEA.removedAt(CFG.stages[1].at + 1e-6); S.held = 2;
    check(SEA.act(S, 'stage') && S.stage === 1 && S.held === 0, 'then promotion, and what you carried is sold on the way');
    S.money = 0; S.removed = SEA.removedAt(CFG.stages[2].at + 1e-6);
    check(!SEA.act(S, 'stage') && S.stage === 1, 'a promotion you cannot afford waits');
  }
  {
    const S = SEA.newState();
    S.removed = SEA.removedAt(Math.min(...CFG.finds.map(f => f.at)) - 1e-4); SEA.step(S, 0.1);
    check(!Object.keys(S.exposed).length, 'nothing is uncovered before its depth');
    check(!SEA.act(S, 'collect', 'flipflop'), 'and nothing under water can be picked up');
    S.removed = SEA.removedAt(0.99); SEA.step(S, 0.1);
    check(CFG.finds.every(f => S.exposed[f.id]), 'at the bottom everything is uncovered');
    check(SEA.act(S, 'collect', 'flipflop') && S.found.flipflop && !SEA.act(S, 'collect', 'flipflop'), 'a find is picked up once');
    check(!SEA.act(S, 'collect', 'plug'), 'the plug is not collected: it is pulled');
    check(SEA.act(S, 'pull') && S.done && S.removed === CFG.ocean && !SEA.act(S, 'scoop'), 'pulling the plug empties the sea and ends the game');
  }
  {
    const d = CFG.fpDrop;
    check(d.every((x, i) => i === 0 || (x[0] > d[i - 1][0] && x[1] > d[i - 1][1])), 'the water at the beach only ever goes down');
    check(SEA.shoreDist(0) === CFG.shore.base && near(SEA.shoreDist(0.3), CFG.shore.base + CFG.shore.slope * SEA.fpDrop(0.3)), 'the walk to the water starts at the machine\'s distance and grows with the slope');
    check(SEA.shoreDist(CFG.stages[1].at) > 200, 'by the promotion the water is a long walk away', `${SEA.shoreDist(CFG.stages[1].at)} m`);
    check(near(SEA.progress({ removed: SEA.removedAt(0.42) }), 0.42), 'the gauge and its inverse agree');
  }
  {
    const S = SEA.newState();
    check(SEA.eta(S) === Infinity, 'before the first scoop the forecast is "never"');
    S.tool = 4; S.buyer = 1; S.helpers[0] = 10; for (let i = 0; i < 300; i++) SEA.step(S, 0.1);
    const e = SEA.eta(S);
    check(isFinite(e) && e / 31557600 > 1e9, 'with ten volunteers the sea is still gone in no fewer than a billion years', `${(e / 31557600).toExponential(2)} y`);
    const M = SEA.newState(); M.removed = 3e4; SEA.step(M, 0.1);
    check(M.measure === 2 && M.ev.filter(e => e.k === 'measure').length === 1, 'the first measures passed come as one event for the largest');
  }
}

/* ---------------- effects ---------------- */
if (suites.includes('effects')) {
  section('effects');
  const base = () => { const S = SEA.newState(); S.tool = 4; S.buyer = 3; S.helpers[0] = 10; S.helpers[1] = 3; S.contract = 1; return S; };
  const find = id => CFG.finds.find(f => f.id === id).bonus;
  { const A = base(), B = base(); B.found.flipflop = true; check(near(SEA.speed(B), SEA.speed(A) * find('flipflop').speed), 'the flip-flop makes you walk faster'); }
  { const A = base(), B = base(); B.found.bottle = true; check(near(SEA.price(B), SEA.price(A) * find('bottle').price), 'the message in a bottle raises the price'); }
  { const A = base(), B = base(); B.found.wreck = true; check(near(SEA.rate(B), SEA.rate(A) * find('wreck').rate), 'the wreck makes helpers bring more'); }
  { const A = base(), B = base(); B.found.chest = true; check(near(SEA.railCost(B, 'tool'), SEA.railCost(A, 'tool') * find('chest').cost) && near(SEA.helperCost(B, 0), SEA.helperCost(A, 0) * find('chest').cost), 'the chest makes everything cheaper'); }
  {
    const A = base(), B = base(); B.found.octopus = true; A.carry = B.carry = PIPE;
    check(near(SEA.scoopOf(B), SEA.scoopOf(A) + CFG.tools[B.tool].scoop * (find('octopus').scoop - 1)) && SEA.autoScoops(B) === find('octopus').auto, 'the octopus doubles the scoop and scoops by himself');
    const m0 = B.money; SEA.step(B, 1); const C = base(); C.carry = PIPE; C.found.octopus = true; C.helpers = C.helpers.map(() => 0); C.buyer = 0; SEA.step(C, 1);
    check(C.money > 0 && C.scoops === 0, 'his scoops are sold through the pipeline without a click');
  }
  { const A = base(), B = base(); B.found.column = true; check(near(SEA.rate(B), SEA.rate(A) * 2) && near(SEA.buyerRate(B), SEA.buyerRate(A) * 2), 'the column doubles what everything removes'); }
  {
    const A = base(), B = base(); SEA.act(B, 'duck');
    check(near(SEA.rate(B), SEA.rate(A) * CFG.duck.boost) && B.boostT === CFG.duck.sec, 'a duck doubles everything');
    SEA.step(B, CFG.duck.sec + 0.1);
    check(B.boostT === 0 && near(SEA.rate(B), SEA.rate(A)), 'for its time only');
  }
  {
    const S = SEA.newState(); S.tool = 4; S.buyer = 1; S.money = 1e12;
    SEA.act(S, 'helper', 0, 9); const r9 = SEA.helperRate(S, 0);
    SEA.act(S, 'helper', 0, 1); const r10 = SEA.helperRate(S, 0);
    check(near(r10, r9 * 10 / 9 * 2) && S.ev.some(e => e.k === 'milestone'), 'the tenth helper of a kind doubles them all');
  }
}

/* ---------------- save ---------------- */
if (suites.includes('save')) {
  section('save');
  {
    const S = SEA.newState(); S.money = 123.45; S.held = 3; S.removed = 1e9; S.tool = 5; S.carry = 3; S.move = 2; S.contract = 1; S.buyer = 2; S.helpers[0] = 7; S.found.flipflop = true; S.exposed.bottle = true; S.rec.first = true; S.walked = 812; S.ui = { sound: false, pos: [1, 2, 3] };
    const T = SEA.load(SEA.save(S));
    const strip = o => { const c = JSON.parse(SEA.save(o)); return JSON.stringify(c); };
    check(strip(T) === strip(S), 'a save comes back equal', strip(T).slice(0, 200));
    check(T.ui.pos[2] === 3, 'with the page\'s own settings');
  }
  {
    check(SEA.load('nonsense').removed === 0 && SEA.load(null).tool === 0, 'junk loads as a new sea');
    check(SEA.load(JSON.stringify({ v: 1, removed: 1e9, tool: 3 })).removed === 0, 'a save of the old basin game loads as a new sea');
    const T = SEA.load(JSON.stringify({ v: SEA.VERSION, removed: -5, money: 'x', tool: 99, carry: -2, helpers: [3, -1, 'a'], held: 1e9, stage: 9 }));
    check(T.removed === 0 && T.money === 0 && T.tool === CFG.tools.length - 1 && T.carry === 0 && T.helpers[0] === 3 && T.helpers[1] === 0 && T.helpers[2] === 0 && T.held === SEA.capOf(T) && T.stage === CFG.stages.length - 1, 'bad numbers are clamped, never trusted');
  }
}

/* ---------------- idle ---------------- */
if (suites.includes('idle')) {
  section('idle');
  {
    const S = SEA.newState();
    check(SEA.away(S, 7200) === null, 'no helpers: nothing happens while you are away');
    S.tool = 4; S.buyer = 1; S.helpers[0] = 30;
    const t0 = S.t, r = SEA.away(S, 7200);
    check(r && r.removed > 0 && r.earned > 0 && S.t === t0, 'two hours away: the helpers took water out and sold it; the game clock did not run');
    check(near(r.removed, SEA.buyerRate(S) * 7200, 1e-6), 'no more than the buyer could take');
    const A = SEA.newState(); A.tool = 4; A.buyer = 1; A.helpers[0] = 1;
    const ra = SEA.away(A, 1e6);
    check(ra.sec === CFG.awayCap, 'eight hours at most');
  }
}

/* ---------------- pacing ---------------- */
if (suites.includes('pacing')) {
  section('pacing');
  const LIMITS = { eager: [22, 34, 5], casual: [30, 50, 6], novice: [45, 85, 12] };   // minutes: end between, longest wait with nothing new
  const ends = {};
  for (const style of ['eager', 'casual', 'novice']) {
    const res = SEA.simulate(style, 3 * 3600, 0.1), at = res.log.at, m = k => at[k] / 60;
    const [lo, hi, gapMax] = LIMITS[style];
    const end = res.end ? res.end / 60 : null; ends[style] = end;
    const f = res.log.firsts.map(x => x[0] / 60); let gap = 0, gat = 0; for (let i = 1; i < f.length; i++) if (f[i] - f[i - 1] > gap) { gap = f[i] - f[i - 1]; gat = f[i - 1]; }
    console.log(`  ${style.padEnd(6)} plug at ${end ? end.toFixed(1) : 'never'} min · pipeline ${m('carry:pipe').toFixed(1)} · region ${m('stage:region').toFixed(1)} · planet ${m('stage:planet').toFixed(1)} · longest wait ${gap.toFixed(1)} min at ${gat.toFixed(1)} · ${Object.keys(res.S.rec).length} records`);
    check(end && end >= lo && end <= hi, `${style}: the plug comes out between ${lo} and ${hi} minutes`, `${end}`);
    check(gap <= gapMax, `${style}: never more than ${gapMax} minutes without something new`, `${gap.toFixed(1)} at ${gat.toFixed(1)}`);
    check(m('carry:pipe') < m('stage:region') && m('stage:region') < m('stage:planet'), `${style}: the pipeline, then the coast from above, then the planet`);
    check(m('tool:spoon') < 1.2, `${style}: the first teaspoon within a minute or so`, `${m('tool:spoon')}`);
    check(CFG.finds.every(x => x.id === 'plug' || at['found:' + x.id] != null), `${style}: every find picked up`);
    if (style === 'eager') {
      check(m('stage:region') > 0.45 * end, 'eager: more than half of the game is spent on the beach, on foot', `${m('stage:region')} of ${end}`);
      const need = ['first', 'receipt', 'spill', 'hundred', 'thousand', 'pipe', 'delegate', 'manager', 'bodensee', 'orbit', 'octo', 'lost', 'hurry'];
      const miss = need.filter(r => !res.S.rec[r]);
      check(!miss.length, 'eager: earns the records an eager player would', miss.join(', '));
      check(res.S.walked > 2000, 'eager: walks kilometres before the pipeline', `${res.S.walked.toFixed(0)} m`);
    }
  }
  check(ends.eager < ends.casual && ends.casual < ends.novice, 'the faster you play the sooner it is over');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
