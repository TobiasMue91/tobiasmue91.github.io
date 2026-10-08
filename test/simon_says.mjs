#!/usr/bin/env node
// Test suite for games/simon_says.html (Simon).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game's promise is that the sequence is
// honest: the same seed is the same sequence for everyone, it only ever grows at the end, a press is judged
// against exactly the pad that was shown, and the tempo never outruns what a person can follow. No browser.
//
//   node test/simon_says.mjs               # everything
//   node test/simon_says.mjs sequence bots # named suites only
//   node test/simon_says.mjs --page=path.html
//
// Suites: sequence, rules, tempo, saves, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'simon_says.html'));
const ALL = ['sequence', 'rules', 'tempo', 'saves', 'bots'];
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
vm.runInContext(core[1] + '\nthis.S = SIMON;', ctx);
const S = ctx.S;
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const arr = a => Array.from(a);

if (suites.includes('sequence')) {
  section('sequence');
  let prefix = true, run = true, same = true, range = true;
  const counts = [0, 0, 0, 0];
  for (let seed = 1; seed <= 400; seed++) {
    const long = arr(S.sequence(seed * 7919, 60)), short = arr(S.sequence(seed * 7919, 17));
    if (short.join() !== long.slice(0, 17).join()) prefix = false;
    if (arr(S.sequence(seed * 7919, 60)).join() !== long.join()) same = false;
    for (let i = 0; i < long.length; i++) {
      if (!(long[i] >= 0 && long[i] < 4 && Number.isInteger(long[i]))) range = false;
      counts[long[i]]++;
      if (i >= 3 && long[i] === long[i - 1] && long[i] === long[i - 2] && long[i] === long[i - 3]) run = false;
    }
  }
  check(prefix, 'a longer sequence only ever adds to the end of a shorter one');
  check(same, 'a seed is the same sequence every time');
  check(range, 'every step is one of the four pads');
  check(run, 'no pad four times running');
  const total = counts.reduce((a, b) => a + b, 0);
  check(counts.every(c => Math.abs(c / total - 0.25) < 0.02), 'the pads come up about equally often', counts.join());
  check(arr(S.sequence(1, 30)).join() !== arr(S.sequence(2, 30)).join(), 'different seeds give different sequences');
  check(S.seedOf('2026-10-08') === S.seedOf('2026-10-08') && S.seedOf('2026-10-08') !== S.seedOf('2026-10-09'), 'a day names a seed');
  // no obvious bias in transitions: any pad follows any pad about equally
  const tr = Array.from({length: 4}, () => [0, 0, 0, 0]);
  for (let seed = 1; seed <= 600; seed++) { const q = arr(S.sequence(seed * 31, 40)); for (let i = 1; i < q.length; i++) tr[q[i - 1]][q[i]]++; }
  check(tr.every(r => { const t = r.reduce((a, b) => a + b, 0); return r.every(c => c / t > 0.2 && c / t < 0.3); }), 'every pad follows every pad about equally');
}

if (suites.includes('rules')) {
  section('rules');
  // reference: a player is right iff each press equals the sequence at that position
  let agree = true, scores = true, ignored = true, fresh = true;
  const r = rng(5);
  for (let g = 0; g < 600; g++) {
    const seed = Math.floor(r() * 1e9);
    let s = S.start(seed);
    const q = arr(S.sequence(seed, 80));
    let len = 1, pos = 0, over = false, completed = 0;
    const skill = r() * 0.12;
    for (let step = 0; step < 3000 && !over; step++) {
      if (s.phase === 'show') {
        const t = S.press(s, 0);
        if (t.result !== 'ignored' || t.state !== s) ignored = false;
        s = S.shown(s);
        continue;
      }
      const want = q[pos];
      const pad = r() < skill ? (want + 1 + Math.floor(r() * 3)) % 4 : want;
      const out = S.press(s, pad);
      const refRight = pad === want;
      if ((out.result === 'wrong') === refRight) agree = false;
      if (out.want !== want) agree = false;
      s = out.state;
      if (!refRight) { over = true; if (s.phase !== 'over' || s.score !== completed) scores = false; break; }
      if (pos + 1 === len) { completed = len; len++; pos = 0; if (out.result !== 'round' || s.phase !== 'show' || s.len !== len || s.score !== completed) scores = false; }
      else { pos++; if (out.result !== 'ok' || s.pos !== pos) agree = false; }
    }
    if (S.press(s, 0).result !== 'ignored' && s.phase === 'over') ignored = false;
  }
  check(agree, 'a press is wrong exactly when it is not the pad that was shown');
  check(scores, 'the score is the longest sequence repeated in full; each round adds one');
  check(ignored, 'presses are ignored while the sequence plays and after the game is over');
  const a = S.start(99); const b = S.press(S.shown(a), S.expected(S.shown(a)));
  check(a.phase === 'show' && a.len === 1 && a.score === 0 && b.result === 'round' && b.state.len === 2, 'a new game starts on a single step and the first right press grows it');
  const frozen = S.start(3); const copy = JSON.stringify(frozen); S.shown(frozen); S.press(S.shown(frozen), 0);
  check(JSON.stringify(frozen) === copy, 'the core never mutates the state it is given');
}

if (suites.includes('tempo')) {
  section('tempo');
  let mono = true, floor = true;
  for (let n = 2; n <= 200; n++) { const a = S.tempo(n - 1), b = S.tempo(n); if (b.on > a.on || b.gap > a.gap) mono = false; }
  for (let n = 1; n <= 200; n++) { const t = S.tempo(n); if (t.on < 150 || t.gap < 70) floor = false; }
  check(mono, 'playback never slows as the sequence grows');
  check(floor, 'a light stays on at least 150 ms and rests at least 70 ms, however long the sequence');
  check(S.tempo(1).on >= 400, 'the first steps are unhurried');
  const sch = S.schedule(25);
  check(sch.length === 25 && sch.every((e, i) => e.i === i && e.off > e.on && (i === 0 || e.on > sch[i - 1].off)), 'a schedule lights each step once, in order, with a rest between');
  check(S.schedule(10)[9].off < 8000, 'ten steps play in under eight seconds');
}

if (suites.includes('saves')) {
  section('saves');
  const dirty = [null, undefined, 5, 'x', [], {best: -4}, {best: 'abc'}, {best: 1e12}, {days: 7}, {days: {'nope': 3, '2026-01-02': -1, '2026-01-03': 4.7}}];
  const clean = dirty.map(d => S.sanitize(d));
  check(clean.every(c => c.best >= 0 && c.best <= 9999 && Number.isInteger(c.best) && c.days && typeof c.days === 'object'), 'a damaged save loads as a clean one');
  check(clean[9].days['2026-01-03'] === 4 && !clean[9].days['nope'] && !clean[9].days['2026-01-02'], 'only real days with real scores are kept');
  let sv = S.sanitize(null);
  let r1 = S.record(sv, 6, null); check(r1.isBest && r1.save.best === 6, 'a first score is a best');
  let r2 = S.record(r1.save, 4, null); check(!r2.isBest && r2.save.best === 6, 'a lower score is not');
  let r3 = S.record(r2.save, 6, null); check(!r3.isBest, 'a tie is not a new best');
  let d1 = S.record(r3.save, 9, '2026-10-08'); check(d1.isBest && d1.save.days['2026-10-08'] === 9 && d1.save.best === 6, 'a daily score is kept apart from the free-play best');
  let d2 = S.record(d1.save, 3, '2026-10-08'); check(!d2.isBest && d2.save.days['2026-10-08'] === 9, 'a worse try on the same day keeps the better one');
  check(JSON.stringify(S.sanitize(JSON.parse(JSON.stringify(d2.save)))) === JSON.stringify(d2.save), 'a save round-trips exactly');
  let big = {best: 1, days: {}};
  for (let i = 0; i < 200; i++) big.days[S.dayOf(new Date(2025, 0, 1 + i))] = 3;
  check(Object.keys(S.sanitize(big).days).length === 60, 'the daily history is capped');
  const mk = ds => ({best: 0, days: Object.fromEntries(ds.map(d => [d, 5]))});
  check(S.streak(mk(['2026-10-06', '2026-10-07', '2026-10-08']), '2026-10-08') === 3, 'a streak counts consecutive days');
  check(S.streak(mk(['2026-10-06', '2026-10-07']), '2026-10-08') === 2, 'yesterday still counts before today is played');
  check(S.streak(mk(['2026-10-05', '2026-10-08']), '2026-10-08') === 1, 'a missed day breaks it');
  check(S.streak(mk(['2026-09-30', '2026-10-01']), '2026-10-01') === 2, 'streaks cross month ends');
  check(S.streak(mk([]), '2026-10-08') === 0, 'no days, no streak');
}

if (suites.includes('bots')) {
  section('bots');
  // a bot remembers `span` steps perfectly and guesses beyond that; sharper memory must score higher
  const play = (span, seed) => {
    const r = rng(seed ^ 0xabcd);
    let s = S.start(seed);
    for (let i = 0; i < 100000; i++) {
      s = S.shown(s);
      const q = arr(S.sequence(seed, s.len));
      while (s.phase === 'echo') {
        const pad = s.pos < span || s.len <= span ? q[s.pos] : Math.floor(r() * 4);
        s = S.press(s, pad).state;
      }
      if (s.phase === 'over') return s.score;
    }
    return -1;
  };
  const avg = span => { let t = 0; for (let g = 0; g < 200; g++) t += play(span, 1000 + g); return t / 200; };
  const a = avg(4), b = avg(9), c = avg(16), perfect = play(1e9 > 1 ? 40 : 40, 1) ;
  check(a < b && b < c, 'bots with a longer memory score higher', [a, b, c].map(x => x.toFixed(1)).join(' < '));
  check(a >= 4 && a < 9 && b >= 9 && b < 16, 'each bot lands near what its memory deserves', [a, b, c].map(x => x.toFixed(1)).join(' '));
  check(perfect >= 40, 'a perfect memory can keep going');
}

console.log(`\n${failures ? failures + ' FAILED, ' : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
