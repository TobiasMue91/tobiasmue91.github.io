#!/usr/bin/env node
// Test suite for games/rock_paper_scissors.html (Tells).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game makes three promises nobody
// can check from the table: the machine never sees your throw before it commits to its own; every
// machine has exactly the habit its tell card claims, strong enough to beat once you know it and
// no stronger than chance once you don't; and when the Oracle explains a read ("After rock, you
// went paper 3 of 4."), the numbers are true.
//
//   node test/rock_paper_scissors.mjs              # everything
//   node test/rock_paper_scissors.mjs fair tells   # named suites only
//   node test/rock_paper_scissors.mjs --page=path.html --matches=400
//
// Suites: rules, fair, tells, ladder, oracle, lines, memory.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'rock_paper_scissors.html'));
const MATCHES = +opt('matches', 300);
const ALL = ['rules', 'fair', 'tells', 'ladder', 'oracle', 'lines', 'memory'];
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
vm.runInContext(core[1] + '\nthis.T = TELLS;', ctx);
const T = ctx.T;
const {beat, outcome} = T;
const clone = o => JSON.parse(JSON.stringify(o));

// players, written plainly. Each sees only what a person at the table would: the history so far,
// the score, and (against Bluff) what the machine just said.
// players draw from their own stream, never the machine's: the same seed on both sides would mirror them
function makeRng(seed) { return T.rng((seed * 2654435761 + 0x9e3779b9) >>> 0); }
function players(seed) {
  const R = makeRng(seed), rnd = () => Math.floor(R() * 3);
  return {
    random: () => rnd(),
    rocky: () => R() < 0.5 ? 0 : rnd(),
    cycler: h => h.you.length ? (h.you[h.you.length - 1] + 1) % 3 : 0,
    sticky: h => h.you.length && R() < 0.7 ? h.you[h.you.length - 1] : rnd(),
    // win-stay, lose-shift with a person's sloppiness
    human: h => {
      const n = h.you.length; if (!n) return R() < 0.45 ? 0 : rnd();
      const o = h.res[n - 1];
      if (o === 1 && R() < 0.55) return h.you[n - 1];
      if (o === 2 && R() < 0.5) return beat(h.them[n - 1]);
      return rnd();
    },
    // reads the machine's row of the tape: the plainest pattern that has held, if any
    observer: h => {
      const n = h.them.length; if (n < 2) return rnd();
      const t = h.them, y = h.you, r = h.res;
      const keys = [i => 'f', i => 'm' + t[i - 1], i => 'y' + y[i - 1], i => 'o' + r[i - 1] + t[i - 1], i => 'p' + r[i - 1] + y[i - 1]];
      let best = -1, pred = null;
      for (const f of keys) {
        const tab = {};
        for (let i = 1; i < n; i++) { const k = f(i); (tab[k] = tab[k] || [0, 0, 0])[t[i]]++; }
        const c = tab[f(n)]; if (!c) continue;
        const tot = c[0] + c[1] + c[2], m = Math.max(...c), conf = (m + 1) / (tot + 3);
        if (tot >= 2 && conf > best) { best = conf; pred = c.indexOf(m); }
      }
      return pred === null || best < 0.45 ? rnd() : beat(pred);
    },
    // knows each machine's tell, as the tell card states it
    tell: {
      pebble: () => 1,
      spin: h => h.them.length ? beat(beat(h.them[h.them.length - 1])) : rnd(),
      echo: h => h.you.length ? beat(h.you[h.you.length - 1]) : rnd(),
      bluff: (h, said, s) => said === null ? rnd() : (s[1] < s[0] ? beat(said) : said),
      grudge: h => { const n = h.them.length; if (!n || h.res[n - 1] === 0) return rnd(); return h.res[n - 1] === 2 ? beat(h.them[n - 1]) : beat(beat(h.you[n - 1])); },
    },
  };
}
function playMatch(id, seed, chooser, memory) {
  const m = T.match(id, seed, memory || null);
  let guard = 0;
  while (!m.isOver() && guard++ < 500) {
    const p = m.prepare();
    m.play(chooser(m.history, p.announce, m.score.slice()));
  }
  return m;
}
function winRate(id, who, n, seed0 = 1) {
  let w = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const P = players(seed0 * 7919 + i);
    const f = who === 'tell' ? P.tell[id] : P[who];
    const m = playMatch(id, seed0 * 104729 + i * 31 + 7, f);
    if (m.score[0] > m.score[1]) w++;
    rounds += m.history.you.length;
  }
  return {rate: w / n, rounds: rounds / n};
}

if (suites.includes('rules')) {
  section('rules');
  for (let y = 0; y < 3; y++) for (let t = 0; t < 3; t++) {
    const want = y === t ? 0 : (y === 0 && t === 2) || (y === 1 && t === 0) || (y === 2 && t === 1) ? 1 : 2;
    check(outcome(y, t) === want, `${T.NAMES[y]} against ${T.NAMES[t]}`, `outcome ${outcome(y, t)}, want ${want}`);
    check(outcome(beat(t), t) === 1, `beat(${T.NAMES[t]}) beats it`);
  }
  for (const id of T.LINEUP) {
    for (let s = 1; s <= 40; s++) {
      const m = playMatch(id, s, players(s).random);
      const sc = m.score, h = m.history;
      const wins = h.res.filter(r => r === 1).length, losses = h.res.filter(r => r === 2).length;
      if (!(Math.max(...sc) === T.TARGET && Math.min(...sc) < T.TARGET)) { fail(`${id}: a match ends at exactly ${T.TARGET}`, `score ${sc}`); break; }
      if (wins !== sc[0] || losses !== sc[1]) { fail(`${id}: the score is the count of rounds won`, `${sc} vs ${wins}-${losses}`); break; }
      if (h.you.length !== h.them.length || h.res.some((r, i) => r !== outcome(h.you[i], h.them[i]))) { fail(`${id}: each round's result follows the throws`); break; }
      if (m.play(0) !== null) { fail(`${id}: nothing can be played after the match is over`); break; }
      if (s === 40) pass(`${id}: forty matches end at ${T.TARGET} and keep their books`);
    }
    const m = T.match(id, 5, null);
    check([3, -1, 1.5, '1', null, undefined].every(v => m.play(v) === null) && m.history.you.length === 0, `${id}: a throw that is not rock, paper or scissors is refused`);
  }
}

if (suites.includes('fair')) {
  section('fair');
  // three matches with the same seed and the same throws, differing only in the throw of round k:
  // the machine must have played the same hand in round k in all three, and said the same thing
  for (const id of T.LINEUP) {
    let bad = null;
    for (let s = 1; s <= 60 && !bad; s++) {
      const P = players(s * 3 + 1), base = [];
      for (let k = 0; k < 12 && !bad; k++) {
        const mem = id === 'oracle' ? T.emptyMemory() : null;
        const ms = [0, 1, 2].map(() => T.match(id, s, mem ? clone(mem) : null));
        let alive = true;
        for (const x of base) ms.forEach(m => { if (!m.isOver()) m.prepare(); if (m.play(x) === null) alive = false; });
        if (!alive || ms[0].isOver()) break;
        const said = ms.map(m => m.prepare().announce);
        const r = ms.map((m, y) => m.play(y));
        if (new Set(r.map(x => x.t)).size !== 1) bad = `seed ${s} round ${k}: machine played ${r.map(x => x.t)} for your rock/paper/scissors`;
        else if (new Set(said).size !== 1) bad = `seed ${s} round ${k}: it said ${said}`;
        base.push(P.human(ms[0].history));
      }
    }
    check(!bad, `${id}: commits to its hand before seeing yours`, bad);
  }
  // what Bluff says is said in prepare(), before the throw, and the round reports it
  const m = T.match('bluff', 9, null), said = m.prepare().announce, r = m.play(0);
  check(said !== null && r.announce === said, 'bluff: the announcement made before the throw is the one recorded');
}

if (suites.includes('tells')) {
  section('tells');
  // every machine, once you know its tell, is beaten nearly every time; not knowing it, a random
  // player gets a fair coin
  for (const id of ['pebble', 'spin', 'echo', 'bluff', 'grudge']) {
    const told = winRate(id, 'tell', MATCHES), rnd = winRate(id, 'random', MATCHES);
    check(told.rate >= 0.88, `${id}: a player who knows the tell wins ${(told.rate * 100).toFixed(0)}% (want 88%+)`);
    check(rnd.rate > 0.4 && rnd.rate < 0.6, `${id}: a random player wins ${(rnd.rate * 100).toFixed(0)}% (want 40-60%)`);
    check(told.rounds < rnd.rounds, `${id}: knowing the tell makes the match shorter (${told.rounds.toFixed(1)} vs ${rnd.rounds.toFixed(1)} rounds)`);
  }
  // the count on the tell card is the habit, counted plainly from the tape
  for (const id of ['pebble', 'spin', 'echo', 'grudge', 'bluff']) {
    let bad = null;
    for (let s = 1; s <= 120 && !bad; s++) {
      const m = playMatch(id, s, players(s).human), h = m.history, c = m.count();
      let k = 0, of = 0;
      for (let i = 0; i < h.them.length; i++) {
        if (id === 'pebble') { of++; if (h.them[i] === 0) k++; }
        if (id === 'spin' && i) { of++; if (h.them[i] === beat(h.them[i - 1])) k++; }
        if (id === 'echo' && i) { of++; if (h.them[i] === h.you[i - 1]) k++; }
        if (id === 'grudge' && i && h.res[i - 1]) { of++; if (h.them[i] === (h.res[i - 1] === 2 ? h.them[i - 1] : beat(h.you[i - 1]))) k++; }
        if (id === 'bluff') {
          of++; let sy = 0, st = 0; for (let j = 0; j < i; j++) { if (h.res[j] === 1) sy++; if (h.res[j] === 2) st++; }
          if ((h.them[i] === h.said[i]) === (st < sy)) k++;
        }
      }
      if (c.kept !== k || c.of !== of) bad = `seed ${s}: card says ${c.kept} of ${c.of}, the tape says ${k} of ${of}`;
    }
    check(!bad, `${id}: the tell card's count matches the tape`, bad);
  }
  // the habit is really there: kept well above chance over many rounds
  for (const [id, min] of [['pebble', 0.6], ['spin', 0.8], ['echo', 0.8], ['grudge', 0.8], ['bluff', 0.8]]) {
    let k = 0, of = 0;
    for (let s = 1; s <= 200; s++) { const c = playMatch(id, s, players(s).random).count(); k += c.kept; of += c.of; }
    check(k / of >= min, `${id}: keeps its habit ${(k / of * 100).toFixed(0)}% of the time (want ${min * 100}%+)`);
  }
}

if (suites.includes('ladder')) {
  section('ladder');
  // a player who studies the tape: early machines give in quickly, the later ones hold out longer
  const rate = {};
  for (const id of T.LINEUP) rate[id] = winRate(id, 'observer', MATCHES, 3).rate;
  console.log('  observer wins: ' + T.LINEUP.map(id => `${id} ${(rate[id] * 100).toFixed(0)}%`).join(', '));
  check(rate.pebble >= 0.65 && rate.spin >= 0.75 && rate.echo >= 0.7, 'the first three machines give way to someone reading the tape');
  check(Math.min(rate.pebble, rate.spin, rate.echo) > Math.max(rate.bluff, rate.grudge), 'Bluff and Grudge hold out longer than the first three');
  check(rate.oracle < 0.5, `the Oracle beats someone reading the tape (${(rate.oracle * 100).toFixed(0)}% for the reader)`);
}

if (suites.includes('oracle')) {
  section('oracle');
  const r = winRate('oracle', 'random', MATCHES * 2, 5);
  check(r.rate > 0.4 && r.rate < 0.6, `a truly random player gets a fair coin against the Oracle (${(r.rate * 100).toFixed(0)}%)`);
  for (const [who, max] of [['cycler', 0.05], ['sticky', 0.25], ['rocky', 0.35], ['human', 0.48]]) {
    const w = winRate('oracle', who, MATCHES, 7).rate;
    check(w <= max, `the Oracle reads a ${who} player (who wins ${(w * 100).toFixed(0)}%, want at most ${max * 100}%)`);
  }
  // it remembers: a rock-heavy player meets an Oracle that already knows them in the first rounds
  const early = mem => {
    let read = 0, n = 0;
    for (let s = 1; s <= 200; s++) {
      const P = players(s), m = T.match('oracle', s, mem ? clone(mem) : null);
      for (let k = 0; k < 3 && !m.isOver(); k++) { m.prepare(); const x = m.play(P.rocky(m.history)); n++; if (x.res === 2) read++; }
    }
    return read / n;
  };
  let mem = T.emptyMemory();
  for (let s = 1; s <= 6; s++) { const m = playMatch('oracle', 900 + s, players(900 + s).rocky, mem); mem = m.memory(); }
  const cold = early(null), warm = early(mem);
  check(warm > cold + 0.05, `with memory it wins the first rounds more often (${(warm * 100).toFixed(0)}% vs ${(cold * 100).toFixed(0)}% cold)`);
}

if (suites.includes('lines')) {
  section('lines');
  // every sentence the Oracle says about you is counted from this match's tape
  const N = T.NAMES;
  let said = 0, bad = null;
  for (let s = 1; s <= 400 && !bad; s++) {
    const P = players(s), m = T.match('oracle', s, null);
    const who = [P.human, P.sticky, P.rocky, P.cycler][s % 4];
    let guard = 0;
    while (!m.isOver() && !bad && guard++ < 500) {
      const before = {you: m.history.you.slice(), them: m.history.them.slice(), res: m.history.res.slice()};
      m.prepare(); const r = m.play(who(m.history));
      if (r.line) {
        said++;
        const h = before, n = h.you.length;
        let mt, ok = false;
        if ((mt = r.line.match(/^After (rock|paper|scissors), you went (rock|paper|scissors) (\d+) of (\d+)\.$/))) {
          const a = N.indexOf(mt[1]), g = N.indexOf(mt[2]); let c = 0, of = 0;
          for (let i = 0; i + 1 < n; i++) if (h.you[i] === a) { of++; if (h.you[i + 1] === g) c++; }
          ok = a === h.you[n - 1] && c === +mt[3] && of === +mt[4] && r.y === g;
        } else if ((mt = r.line.match(/^(rock|paper|scissors), (rock|paper|scissors), then (rock|paper|scissors)\. (\d+) of (\d+)\.$/))) {
          const a = N.indexOf(mt[1]), b = N.indexOf(mt[2]), g = N.indexOf(mt[3]); let c = 0, of = 0;
          for (let i = 0; i + 2 < n; i++) if (h.you[i] === a && h.you[i + 1] === b) { of++; if (h.you[i + 2] === g) c++; }
          ok = a === h.you[n - 2] && b === h.you[n - 1] && c === +mt[4] && of === +mt[5] && r.y === g;
        } else if ((mt = r.line.match(/^After (a draw|a win|a loss), you (stayed|switched to what (beats|loses to) your last) (\d+) of (\d+)\.$/))) {
          const o = ['a draw', 'a win', 'a loss'].indexOf(mt[1]), shift = mt[2] === 'stayed' ? 0 : mt[3] === 'beats' ? 1 : 2;
          let c = 0, of = 0;
          for (let i = 0; i + 1 < n; i++) if (h.res[i] === o) { of++; if ((h.you[i + 1] - h.you[i] + 3) % 3 === shift) c++; }
          ok = o === h.res[n - 1] && c === +mt[4] && of === +mt[5] && (r.y - h.you[n - 1] + 3) % 3 === shift;
        } else if ((mt = r.line.match(/^You (answer|copy) my last hand\. (\d+) of (\d+)\.$/))) {
          const shift = mt[1] === 'copy' ? 0 : 1; let c = 0;
          for (let i = 1; i < n; i++) if ((h.you[i] - h.them[i - 1] + 3) % 3 === shift) c++;
          ok = c === +mt[2] && n - 1 === +mt[3] && (r.y - h.them[n - 1] + 3) % 3 === shift;
        } else if ((mt = r.line.match(/^(Rock|Paper|Scissors) (\d+) of (\d+)\. You like it\.$/))) {
          const g = N.indexOf(mt[1].toLowerCase()), c = h.you.filter(x => x === g).length;
          ok = c === +mt[2] && n === +mt[3] && r.y === g && c * 2 > n;
        }
        if (!ok) bad = `seed ${s}: "${r.line}" after ${JSON.stringify(h)} then you ${r.y}`;
        if (ok && r.ev && r.ev.idx.some(i => i < 0 || i >= n)) bad = `seed ${s}: evidence ${r.ev.idx} points outside the tape`;
      }
      if (r.line && r.res !== 2) bad = `seed ${s}: spoke "${r.line}" on a round it did not win`;
    }
  }
  check(!bad, `every one of ${said} Oracle lines is true and only said when the read won the round`, bad);
  check(said > 100, `the Oracle explains itself often enough to teach (${said} lines in 400 matches)`);
  // the machines that copy or follow show the throw they used as evidence, and it is the right one
  let evBad = null;
  for (let s = 1; s <= 200 && !evBad; s++) for (const id of ['echo', 'spin', 'grudge']) {
    const m = T.match(id, s, null), P = players(s);
    let guard = 0;
    while (!m.isOver() && guard++ < 500) {
      const h = {you: m.history.you.slice(), them: m.history.them.slice(), res: m.history.res.slice()};
      m.prepare(); const r = m.play(P.random(m.history));
      if (!r.ev) continue;
      const n = h.you.length;
      if (id === 'echo' && !(r.ev.idx[0] === n - 1 && h.you[n - 1] === r.t)) evBad = `echo seed ${s}: evidence ${JSON.stringify(r.ev)}`;
      if (id === 'spin' && !(r.ev.own[0] === n - 1 && beat(h.them[n - 1]) === r.t)) evBad = `spin seed ${s}`;
      if (id === 'grudge' && r.ev.own && h.them[n - 1] !== r.t) evBad = `grudge seed ${s}: stayed but shows a different hand`;
      if (id === 'grudge' && r.ev.idx && beat(h.you[n - 1]) !== r.t) evBad = `grudge seed ${s}: shifted but the evidence does not explain it`;
      if (r.res !== 2) evBad = `${id} seed ${s}: shows evidence on a round it did not win`;
    }
  }
  check(!evBad, 'Echo, Spin and Grudge play back exactly the throw they acted on', evBad);
}

if (suites.includes('memory')) {
  section('memory');
  // the Oracle's memory is saved in the browser; whatever comes back from there must not break it
  const junk = [null, undefined, 7, 'x', [], {v: 2}, {v: 1, freq: 'no'}, {v: 1, freq: [1, 2]}, {v: 1, freq: [NaN, 1, 1]},
    {v: 1, after: [[1, -1, 2]]}, {v: 1, after2: {'99': [1, 1, 1], '01': [1, 'a', 1], '__proto__': [1, 1, 1]}}, {v: 1, rounds: -4, w: 'many'}];
  let bad = null;
  for (const j of junk) {
    try {
      const m = playMatch('oracle', 3, players(3).human, j);
      const mem = m.memory();
      if (!mem || mem.v !== 1 || mem.freq.length !== 3 || mem.freq.some(x => !isFinite(x))) bad = `${JSON.stringify(j)} gave ${JSON.stringify(mem).slice(0, 80)}`;
    } catch (e) { bad = `${JSON.stringify(j)} threw ${e.message}`; }
  }
  check(!bad, 'junk in the saved memory is replaced, never trusted', bad);
  const m = playMatch('oracle', 11, players(11).human, null), mem = m.memory();
  const back = T.cleanMemory(JSON.parse(JSON.stringify(mem)));
  check(JSON.stringify(back) === JSON.stringify(mem), 'the memory survives a round trip through JSON unchanged');
  check(mem.w + mem.l === 1 && mem.rounds === m.history.you.length, 'the memory counts the match and its rounds');
  // the same seed and the same memory play the same match: a saved Oracle is the same Oracle
  const a = playMatch('oracle', 77, players(77).human, clone(mem)), b = playMatch('oracle', 77, players(77).human, clone(mem));
  check(JSON.stringify(a.history) === JSON.stringify(b.history), 'an Oracle loaded from the same memory plays the same way');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
