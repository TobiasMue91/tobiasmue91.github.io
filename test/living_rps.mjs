#!/usr/bin/env node
// Test suite for games/living_rps.html (Living RPS).
//
// Runs the page's DOM-free <script id="core"> block in Node. It promises things the page can't show:
// that a contact always converts in the cycle direction and never changes the army total, that a board
// is the same for the same seed, that every board ends (the late-game heat-up) in reasonable time on
// phone, square and wide layouts, and that the payout favours the underdog. No browser, no server.
//
//   node test/living_rps.mjs

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'games', 'living_rps.html'), 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block'); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.R = RPS;', ctx);
const R = ctx.R;

let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log('  FAIL  ' + what); } };

// cycle
check(R.beats(0, 2) && R.beats(1, 0) && R.beats(2, 1), 'rock>scissors, paper>rock, scissors>paper');
check(!R.beats(0, 1) && !R.beats(0, 0), 'no reverse or mirror wins');

const LAYOUTS = [[400, 840], [600, 600], [1100, 520]];
let longest = 0;
for (let seed = 1; seed <= 40; seed++) for (const [w, h] of LAYOUTS) {
  const s = R.create(seed, w, h), total = s.units.length;
  check(total === 54, `seed ${seed}: 54 units`);
  let ok = true;
  while (R.winner(s) < 0 && s.t < 200) {
    R.step(s);
    for (const e of s.events) if (!R.beats(e.to, e.from)) ok = false;
    if (s.units.length !== total) ok = false;
    for (const u of s.units) if (!(u.x >= 0 && u.x <= w && u.y >= 0 && u.y <= h)) ok = false;
  }
  check(ok, `seed ${seed} ${w}x${h}: conversions follow the cycle, total and bounds hold`);
  check(R.winner(s) >= 0, `seed ${seed} ${w}x${h}: board finishes within 200s (took ${s.t | 0}s)`);
  longest = Math.max(longest, s.t);
}

// determinism
const a = R.create(7, 400, 840), b = R.create(7, 400, 840);
for (let i = 0; i < 600; i++) { R.step(a); R.step(b); }
check(JSON.stringify(R.counts(a)) === JSON.stringify(R.counts(b)) && a.units[3].x === b.units[3].x, 'same seed, same board');

// payout
for (let seed = 1; seed <= 50; seed++) {
  const c = R.deal(seed);
  check(c[0] + c[1] + c[2] === 54 && Math.min(...c) >= 12, `deal ${seed} sums to 54, no army under 12`);
  const lo = c.indexOf(Math.min(...c)), hi = c.indexOf(Math.max(...c));
  check(R.award(c, lo) >= R.award(c, hi), `deal ${seed}: underdog pays at least the favourite`);
}

console.log(failures ? `${failures} failures` : `all passed (longest board ${longest.toFixed(0)}s)`);
process.exit(failures ? 1 : 0);
