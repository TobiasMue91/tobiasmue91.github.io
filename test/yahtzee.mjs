#!/usr/bin/env node
// Test suite for games/yahtzee.html (Yacht).
//
// Runs the page's DOM-free <script id="core"> block in Node. The card is the game: a box that pays
// a point too much on one roll in a thousand, or a joker rule that lets an extra Yacht into the
// wrong box, looks exactly like a working page. No browser, no server.
//
//   node test/yahtzee.mjs                  # everything
//   node test/yahtzee.mjs scoring joker    # named suites only
//   node test/yahtzee.mjs --page=path.html # run against another copy of the page
//
// Suites: scoring, joker, dice, games, skipper.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'yahtzee.html'));
const ALL = ['scoring', 'joker', 'dice', 'games', 'skipper'];
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
vm.runInContext(core[1] + '\nthis.Y = YACHT;', ctx);
const Y = ctx.Y;

// Every roll of five dice, in order, all 7776 of them.
const ROLLS = [];
for (let n = 0; n < 7776; n++) { const d = []; let m = n; for (let i = 0; i < 5; i++) { d.push(m % 6 + 1); m = Math.floor(m / 6); } ROLLS.push(d); }

// The rules written the other way round: by looking for the pattern, not by counting faces.
function reference(cat, d) {
  const s = [...d].sort((a, b) => a - b), sum = d.reduce((a, b) => a + b, 0);
  const same = k => { for (let f = 1; f <= 6; f++) if (d.filter(x => x === f).length >= k) return true; return false; };
  const has = seq => seq.every(f => d.includes(f));
  const up = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].indexOf(cat);
  if (up >= 0) return d.filter(x => x === up + 1).length * (up + 1);
  switch (cat) {
    case 'three': return same(3) ? sum : 0;
    case 'four': return same(4) ? sum : 0;
    case 'full': return (s[0] === s[1] && s[1] === s[2] && s[3] === s[4] && s[2] !== s[3]) || (s[0] === s[1] && s[2] === s[3] && s[3] === s[4] && s[1] !== s[2]) ? 25 : 0;
    case 'small': return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 'large': return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case 'yacht': return same(5) ? 50 : 0;
    case 'chance': return sum;
  }
}
const card = fill => { const c = Y.emptyCard(); Object.assign(c, fill || {}); return c; };

if (suites.includes('scoring')) {
  section('scoring');
  let bad = 0;
  for (const d of ROLLS) for (const c of Y.CATS) {
    const got = Y.value(card(), c, d), want = reference(c, d);
    if (got !== want && bad++ < 5) fail(`${c} on ${d.join('')}`, `got ${got}, want ${want}`);
  }
  check(bad === 0, `all 13 boxes agree with the reference on all 7776 rolls`, bad + ' disagreements');
  const counts = {}; for (const c of ['full', 'small', 'large', 'yacht']) counts[c] = ROLLS.filter(d => Y.value(card(), c, d) > 0).length;
  check(counts.full === 300 && counts.small === 1200 && counts.large === 240 && counts.yacht === 6, 'how often each pattern turns up matches the textbook counts', JSON.stringify(counts));
  const full = card(); Y.CATS.forEach(c => full[c] = 0); full.ones = 3; full.twos = 6; full.threes = 9; full.fours = 12; full.fives = 15; full.sixes = 18;
  check(Y.bonus(full) === 35 && Y.total(full, 0) === 63 + 35, 'three of each face is exactly the 63 that earns +35');
  full.sixes = 17; check(Y.bonus(full) === 0, 'one short of 63 earns nothing');
  const perfect = card({ ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30, three: 30, four: 30, full: 25, small: 30, large: 40, yacht: 50, chance: 30 });
  check(Y.total(perfect, 12) === 1575, 'the highest possible card adds up to 1575', String(Y.total(perfect, 12)));
}

if (suites.includes('joker')) {
  section('joker');
  const five4 = [4, 4, 4, 4, 4];
  check(Y.legal(card(), five4).length === 13, 'a first Yacht may go anywhere');
  check(Y.legal(card({ yacht: 50 }), five4).join() === 'fours', 'an extra Yacht must go in its own upper box while that is open');
  const lowerOpen = Y.legal(card({ yacht: 50, fours: 12 }), five4);
  check(lowerOpen.every(c => Y.LOWER.includes(c)) && lowerOpen.length === 6, 'with its upper box filled it goes in any open lower box', lowerOpen.join());
  const jc = card({ yacht: 0, fours: 12 });
  check(Y.value(jc, 'full', five4) === 25 && Y.value(jc, 'small', five4) === 30 && Y.value(jc, 'large', five4) === 40, 'as a joker it pays full house and both straights in full');
  check(Y.value(jc, 'three', five4) === 20 && Y.value(jc, 'chance', five4) === 20, 'and the sum in the kinds and chance');
  const allLower = card({ yacht: 50, fours: 12, three: 1, four: 1, full: 1, small: 1, large: 1, chance: 1 });
  const up = Y.legal(allLower, five4);
  check(up.length === 5 && !up.includes('fours') && up.every(c => Y.UPPER.includes(c)), 'only when the lower card is full may it go in another upper box', up.join());
  check(Y.value(allLower, 'twos', five4) === 0, 'where it scores nothing');
  check(Y.legal(card({ yacht: 50 }), [4, 4, 4, 4, 3]).length === 12, 'an ordinary roll is free to go in any open box');
  // bonus counting through score()
  const g = Y.newGame('joker'); g.roll = 3;
  g.dice = [6, 6, 6, 6, 6]; Y.score(g, 'yacht'); g.roll = 3;
  g.dice = [6, 6, 6, 6, 6]; let r = Y.score(g, 'chance');
  check(r === null, 'score() refuses a box the joker rules forbid');
  r = Y.score(g, 'sixes'); g.roll = 3;
  check(r && r.yachtBonus && g.yb === 1 && g.card.sixes === 30, 'an extra Yacht after a 50 pays +100', JSON.stringify(r));
  const z = Y.newGame('z'); z.roll = 3; z.dice = [1, 2, 3, 4, 6]; Y.score(z, 'yacht'); z.roll = 3; z.dice = [2, 2, 2, 2, 2];
  r = Y.score(z, 'twos');
  check(r && !r.yachtBonus && z.yb === 0, 'but not after the Yacht box was scratched');
}

if (suites.includes('dice')) {
  section('dice');
  const n = [0, 0, 0, 0, 0, 0, 0]; let total = 0;
  for (let s = 0; s < 400; s++) for (let t = 0; t < 13; t++) for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { n[Y.face('seed' + s, t, r, i)]++; total++; }
  const e = total / 6, chi = n.slice(1).reduce((a, x) => a + (x - e) ** 2 / e, 0);
  check(n.slice(1).every(x => x > 0) && n[0] === 0 && chi < 20.5, `the six faces come up equally often (chi² ${chi.toFixed(1)} over ${total} dice)`);
  check(Y.face('daily-2026-10-04', 3, 1, 2) === Y.face('daily-2026-10-04', 3, 1, 2), 'a seed gives the same dice every time');
  let differs = 0; for (let s = 0; s < 50; s++) if (Y.face('a' + s, 0, 0, 0) !== Y.face('b' + s, 0, 0, 0)) differs++;
  check(differs > 30, 'different seeds give different dice');
  // holding never changes what the free dice become
  let ok = true;
  for (let s = 0; s < 200 && ok; s++) {
    const a = Y.newGame('h' + s), b = Y.newGame('h' + s);
    Y.roll(a); Y.roll(b);
    const mask = [s & 1, s & 2, s & 4, s & 8, s & 16].map(Boolean);
    b.held = mask; Y.roll(a); Y.roll(b);
    for (let i = 0; i < 5; i++) if (!mask[i] && a.dice[i] !== b.dice[i]) ok = false;
  }
  check(ok, 'a kept die never changes what the rerolled ones turn into');
  const g = Y.newGame('x');
  check(!Y.hold(g, 0), 'nothing can be kept before the first roll');
  Y.roll(g); Y.roll(g); Y.roll(g);
  check(!Y.roll(g) && !Y.hold(g, 0), 'there is no fourth roll and nothing to keep after the third');
  Y.roll(g); g.held = [true, true, true, true, true];
  const g2 = Y.newGame('y'); Y.roll(g2); Y.hold(g2, 1); Y.score(g2, 'chance'); Y.roll(g2);
  check(g2.held.every(h => !h), 'kept dice are let go when a new turn starts');
  check(Y.dailySeed('2026-10-04') === Y.dailySeed('2026-10-04') && Y.dailySeed('2026-10-04') !== Y.dailySeed('2026-10-05'), 'every day has its own dice, the same for everyone');
}

if (suites.includes('games')) {
  section('games');
  let bad = 0, rng = 12345;
  const rand = k => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng % k; };
  for (let s = 0; s < 2000; s++) {
    const g = Y.newGame('rand' + s);
    let guard = 0, yb = 0;
    while (!Y.over(g) && guard++ < 100) {
      Y.roll(g);
      const extra = rand(3);
      for (let k = 0; k < extra && g.roll < 3; k++) { for (let i = 0; i < 5; i++) Y.hold(g, i, rand(2) === 1); Y.roll(g); }
      const legal = Y.legal(g.card, g.dice);
      const c = legal[rand(legal.length)], expect = Y.value(g.card, c, g.dice);
      const bonusDue = Y.isYacht(g.dice) && g.card.yacht === 50;
      const r = Y.score(g, c);
      if (!r || r.points !== expect) { bad++; break; }
      if (bonusDue) yb++;
    }
    const sum = Y.CATS.reduce((a, c) => a + g.card[c], 0) + Y.bonus(g.card) + 100 * yb;
    if (!Y.over(g) || g.turn !== 13 || g.yb !== yb || Y.total(g.card, g.yb) !== sum || Y.CATS.some(c => g.card[c] === null)) bad++;
    // a saved game is plain JSON and carries on identically
    if (s % 100 === 0) { const copy = JSON.parse(JSON.stringify(g)); if (Y.total(copy.card, copy.yb) !== Y.total(g.card, g.yb)) bad++; }
  }
  check(bad === 0, '2000 random games all fill thirteen boxes, score what the preview said and add up', bad + ' bad games');
}

if (suites.includes('skipper')) {
  section('skipper');
  const N = +opt('games', 8); let sum = 0, min = 1e9; const t0 = Date.now();
  for (let s = 0; s < N; s++) { const g = Y.skipper('skip' + s); const t = Y.total(g.card, g.yb); sum += t; min = Math.min(min, t); if (!Y.over(g)) fail('skipper finishes its game'); }
  const mean = sum / N;
  console.log(`  skipper averages ${mean.toFixed(1)} over ${N} games (${((Date.now() - t0) / N / 1000).toFixed(1)}s each)`);
  check(mean >= 215, 'the Skipper plays a strong game (average 215 or more)', mean.toFixed(1));
  const a = Y.skipper('same'), b = Y.skipper('same');
  check(Y.total(a.card, a.yb) === Y.total(b.card, b.yb), 'on the same dice the Skipper always scores the same, so a daily result is fair');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
