#!/usr/bin/env node
// Test suite for games/alphabet.html (A to Z).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises things nobody can see from the
// page: that a run is judged on the keys' own timestamps, that a Daily board is the same for everyone and no
// luckier one day than another, that your best is only ever replaced by a faster run, and that a rank means
// what it says. No browser, no server.
//
//   node test/alphabet.mjs                  # everything
//   node test/alphabet.mjs rules daily      # named suites only
//   node test/alphabet.mjs --page=path.html
//
// Suites: rules, keys, daily, ghost, ranks, share, save, bots, page (needs Playwright's Chromium; skipped without it).

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'alphabet.html'));
const ALL = ['rules', 'keys', 'daily', 'ghost', 'ranks', 'share', 'save', 'bots', 'page'];
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
vm.runInContext(core[1] + '\nthis.Z = AZ;', ctx);
const Z = ctx.Z;
const L = Z.LETTERS;

let seed = 20261009;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

// Plays a sequence of letters at the given times (ms) and returns the events.
const play = (run, letters, times) => letters.map((c, i) => Z.press(run, c, times[i]));
const evenly = (n, step, from = 1000) => Array.from({length: n}, (_, i) => from + i * step);

if (suites.includes('rules')) {
  section('rules');
  let run = Z.newRun(Z.sequence('az'));
  let ev = play(run, [...L], evenly(26, 200));
  check(ev[0].kind === 'start' && ev.slice(1, 25).every(e => e.kind === 'ok') && ev[25].kind === 'done', 'A to Z in order starts, goes on and finishes');
  let res = Z.result(run, 'az');
  check(Math.abs(res.time - 5) < 1e-9, 'the clock runs from the first key to the last', String(res.time));
  check(res.splits[0] === 0 && res.splits.slice(1).every(s => Math.abs(s - 0.2) < 1e-9), 'every split is the time since the key before');
  check(Math.abs(res.splits.reduce((a, b) => a + b, 0) - res.time) < 1e-9, 'splits add up to the time');
  check(res.cum[0] === 0 && res.cum.every((c, i) => i === 0 || c > res.cum[i - 1]), 'cumulative times climb from zero');
  check(Z.press(run, 'A', 9999).kind === 'ignored', 'a finished run takes no more keys');

  run = Z.newRun(Z.sequence('az'));
  check(Z.press(run, 'B', 500).kind === 'early' && run.t0 === null && run.slips === 0, 'a wrong key before the start is no slip and does not start the clock');
  check(Z.press(run, 'a', 1000).kind === 'start' && run.t0 === 1000, 'lower case counts');
  ev = Z.press(run, 'C', 1300);
  check(ev.kind === 'slip' && ev.want === 'B' && run.slips === 1 && run.i === 1, 'a wrong key is a slip and the target stays put');
  check(Z.press(run, 'B', 1500).split === 500, 'the slip costs exactly the time spent finding the right key');
  for (const k of ['1', ' ', 'Enter', 'ß', '', 'AB', null, undefined, 5]) check(Z.press(run, k, 2000).kind === 'ignored', `non-letter ${JSON.stringify(k)} is ignored`);
  check(run.slips === 1 && run.i === 2, 'ignored keys change nothing');

  run = Z.newRun(Z.sequence('za'));
  ev = play(run, [...L].reverse(), evenly(26, 300));
  check(ev[25].kind === 'done' && Math.abs(Z.result(run, 'za').time - 7.5) < 1e-9, 'Z to A runs the other way');
  check(Z.press(Z.newRun(Z.sequence('za')), 'A', 0).kind === 'early', 'on Z to A the first key is Z');
  check(Z.result(Z.newRun(Z.sequence('az')), 'az') === null, 'an unfinished run has no result');

  // A slip at every step still finishes, and the slips are counted.
  run = Z.newRun(Z.sequence('az')); let t = 0, slips = 0;
  for (const c of L) { if (c !== 'A') { Z.press(run, c === 'Z' ? 'Y' : 'Z', t += 50); slips++; } Z.press(run, c, t += 100); }
  check(run.done && run.slips === slips, 'a run with a slip at every step finishes and counts them', `${run.slips}/${slips}`);
  check(Z.result(run, 'az').slips === slips, 'the result carries the slips');
}

if (suites.includes('keys')) {
  section('keys');
  const seen = new Set(Z.ROWS.join(''));
  check(seen.size === 26 && [...L].every(c => seen.has(c)), 'the keyboard holds each letter once');
  check([...L].every(c => Z.POS[c] && isFinite(Z.POS[c].x)), 'every letter has a place');
  let sym = true; for (const a of L) for (const b of L) if (Math.abs(Z.dist(a, b) - Z.dist(b, a)) > 1e-12) sym = false;
  check(sym && Z.dist('Q', 'Q') === 0, 'distance is symmetric and zero to itself');
  check(Math.abs(Z.dist('Q', 'W') - 1) < 1e-12 && Math.abs(Z.dist('A', 'S') - 1) < 1e-12, 'neighbours are one key apart');
  check(Z.dist('Q', 'P') === 9, 'Q to P is nine keys');
  check(Math.abs(Z.dist('A', 'Z') - Math.hypot(0.5, 1)) < 1e-12, 'the rows are staggered like a real keyboard');
  check(Z.MEAN_TRAVEL > 60 && Z.MEAN_TRAVEL < 110, 'the mean travel of a shuffle is sensible', String(Z.MEAN_TRAVEL));
  // The mean is what random shuffles really cost.
  let sum = 0; const n = 4000; for (let i = 0; i < n; i++) { const a = [...L]; for (let j = 25; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [a[j], a[k]] = [a[k], a[j]]; } sum += Z.travel(a); }
  check(Math.abs(sum / n / Z.MEAN_TRAVEL - 1) < 0.01, 'MEAN_TRAVEL is the average of random shuffles', `${(sum / n).toFixed(2)} vs ${Z.MEAN_TRAVEL.toFixed(2)}`);
}

if (suites.includes('daily')) {
  section('daily');
  const keys = []; for (let d = new Date(2026, 0, 1), i = 0; i < 1100; i++, d.setDate(d.getDate() + 1)) keys.push(Z.dateKey(d));
  check(keys.length === new Set(keys).size, 'a thousand days have a thousand keys (leap days and clock changes included)');
  check(Z.dateKey(new Date(2028, 1, 29)) === '2028-02-29' && Z.dateKey(new Date(2026, 9, 9)) === '2026-10-09', 'keys are local dates, zero padded');
  const boards = keys.map(k => Z.sequence('daily', k));
  check(boards.every(b => b.length === 26 && new Set(b).size === 26 && b.every(c => L.includes(c))), 'every board is each letter once');
  check(boards.every((b, i) => Z.sequence('daily', keys[i]).join('') === b.join('')), 'a day is the same board whenever it is asked');
  check(new Set(boards.map(b => b.join(''))).size === boards.length, 'no two days share a board');
  let bad = 0; for (const b of boards) for (let i = 1; i < 26; i++) if (Math.abs(b[i].charCodeAt(0) - b[i - 1].charCodeAt(0)) === 1) { bad++; break; }
  check(bad === 0, 'no step runs on to the next letter of the alphabet (a free key)', `${bad} boards`);
  const gaps = boards.map(b => Math.abs(Z.travel(b) / Z.MEAN_TRAVEL - 1));
  check(Math.max(...gaps) <= Z.BAND, 'no day is a lucky or an unlucky one: finger travel within the band of the mean', `worst ${Math.max(...gaps).toFixed(3)} vs ${Z.BAND}`);
  const starts = {}; for (const b of boards) starts[b[0]] = (starts[b[0]] || 0) + 1;
  check(L.split('').every(c => (starts[c] || 0) >= 15), 'every letter starts some days (the shuffle is not lopsided)', JSON.stringify(starts));
  const pos = {}; for (const b of boards) b.forEach((c, i) => { if (c === 'Q') pos[i] = (pos[i] || 0) + 1; });
  check(Object.keys(pos).length >= 24, 'a letter lands in nearly every place over the years');
  check(Z.sequence('daily', keys[0]).join('') !== Z.sequence('daily', keys[1]).join(''), 'tomorrow is a different board');
  check(Z.sequence('az').join('') === L && Z.sequence('za').join('') === [...L].reverse().join(''), 'A to Z and Z to A are the alphabet either way round');
  check(Z.dayNumber('2026-10-10') - Z.dayNumber('2026-10-09') === 1 && Z.dayNumber('2028-03-01') - Z.dayNumber('2028-02-28') === 2 && Number.isNaN(Z.dayNumber('nope')), 'day numbers count whole days');
}

if (suites.includes('ghost')) {
  section('ghost');
  const best = Array.from({length: 26}, (_, i) => i * 0.2);
  check(Z.ghostIndex(best, 0) === 0 && Z.ghostIndex(best, 0.199) === 0 && Z.ghostIndex(best, 0.2) === 1, 'the ghost has struck a letter once its time is reached');
  check(Z.ghostIndex(best, 4.999) === 24 && Z.ghostIndex(best, 5) === 25 && Z.ghostIndex(best, 99) === 25, 'the ghost stops on Z');
  let prev = 0, mono = true; for (let t = 0; t < 6; t += 0.007) { const g = Z.ghostIndex(best, t); if (g < prev) mono = false; prev = g; }
  check(mono, 'the ghost never goes backwards');
  check(Math.abs(Z.ghostPos(best, 0.1) - 0.5) < 1e-9 && Math.abs(Z.ghostPos(best, 1) - 5) < 1e-9 && Z.ghostPos(best, 99) === 25, 'the ghost glides between letters at the pace of the run');
  let glide = true, lastP = 0; for (let t = 0; t < 6; t += 0.003) { const p = Z.ghostPos(best, t); if (p < lastP || p - lastP > 0.02) glide = false; lastP = p; }
  check(glide, 'the glide never goes back and never jumps');
  check(Math.abs(Z.gapAt(best, 5, 1.1) - 0.1) < 1e-9 && Math.abs(Z.gapAt(best, 5, 0.9) + 0.1) < 1e-9, 'the gap is negative when you are ahead');
}

if (suites.includes('ranks')) {
  section('ranks');
  for (const mode of Z.MODES) {
    let last = -1, mono = true;
    for (let t = 30; t > 1; t -= 0.01) { const r = Z.tier(mode, t); if (r.index < last) mono = false; last = r.index; }
    check(mono, `${mode}: a faster time never ranks lower`);
    check(Z.tier(mode, 500).index === 0 && Z.tier(mode, 0.9).next === null, `${mode}: the ladder has a bottom and a top`);
    for (let i = 1; i < Z.TIERS.length; i++) {
      const edge = Z.TIERS[i].max * Z.SCALE[mode];
      check(Z.tier(mode, edge + 0.001).index === i - 1 && Z.tier(mode, edge - 0.001).index === i, `${mode}: ${Z.TIERS[i].name} starts exactly at ${edge.toFixed(2)} s`);
      const r = Z.tier(mode, edge + 0.5); check(Math.abs(r.gap - 0.5) < 1e-9 && Math.abs(r.target - edge) < 1e-9 && r.next === Z.TIERS[i].name, `${mode}: the gap to ${Z.TIERS[i].name} is what is left`);
    }
  }
  check(Z.SCALE.az < Z.SCALE.za && Z.SCALE.za < Z.SCALE.daily, 'the harder boards have longer ladders');
  const names = Z.TIERS.map(t => t.name); check(new Set(names).size === names.length, 'rank names are distinct');
}

if (suites.includes('share')) {
  section('share');
  const mk = (mode, key, slips = 0) => { const run = Z.newRun(Z.sequence(mode, key)); const times = evenly(26, 220).map((v, i) => v + (i === 15 ? 400 : 0) + (i > 15 ? 400 : 0)); play(run, run.seq, times); run.slips = slips; return Z.result(run, mode, key); };
  const r = mk('az', null); const text = Z.share(r, 'https://www.gptgames.dev/games/alphabet.html');
  check(Z.strip(r).length === 25 && /^[▁-█]+$/.test(Z.strip(r)), 'the strip has one bar for every step after the first');
  check([...Z.strip(r)].filter(c => c === '█').length >= 1 && Z.strip(r)[14] === '█', 'the slowest step is the tallest bar');
  check(text.includes(r.time.toFixed(2) + 's') && text.includes('clean') && text.includes('gptgames.dev'), 'the share line carries the time, cleanliness and the link');
  const d = mk('daily', '2026-10-09', 2); const dt = Z.share(d, 'u');
  check(dt.includes('Daily 2026-10-09') && dt.includes('2 slips'), 'a daily share names the day and the slips');
  check(!dt.includes(d.seq) && ![...d.seq].some((c, i) => i < 22 && dt.includes(d.seq.slice(i, i + 4))), 'a daily share gives nothing of the board away');
  check(Z.fmt(6.4213) === '6.42' && Z.fmt(0) === '0.00' && Z.fmt(NaN) === '0.00' && Z.fmt(-1) === '0.00' && Z.fmt(125.43) === '2:05.4', 'times are formatted for a clock');
}

if (suites.includes('save')) {
  section('save');
  const hostile = [null, undefined, 0, 1, 'x', [], [1, 2], {}, {best: 5}, {best: {az: 'x', za: {time: -4}}}, {daily: 'no'}, {daily: {key: 7, best: 3, streak: 'a'}}, {sound: 'maybe', mode: {}, runs: -9}, JSON.parse('{"best":{"az":{"time":1e999}}}'), {best: {az: {time: NaN, cum: 'x'}}}];
  let threw = 0; for (const h of hostile) { try { const s = Z.clean(h); if (!(s.v === 2 && s.best && s.daily && Z.MODES.includes(s.mode))) threw++; } catch { threw++; } }
  check(threw === 0, 'a hostile save is cleaned, never thrown at');
  const cum = Array.from({length: 26}, (_, i) => i * 0.24), good = {time: 6, cum, slips: 1, at: '2026-10-09'};
  let s = Z.clean({best: {az: good}, mode: 'za', sound: false, runs: 12});
  check(s.best.az.time === 6 && s.best.az.cum.length === 26 && s.mode === 'za' && s.sound === false && s.runs === 12, 'a real save is kept');
  s = Z.clean({best: {az: {...good, cum: cum.map((v, i) => i === 7 ? v - 0.5 : v)}}});
  check(s.best.az && s.best.az.time === 6 && s.best.az.cum === null, 'a ghost that goes backwards is dropped, the time is kept');
  s = Z.clean({best: {az: {...good, time: 9}}}); check(s.best.az.cum === null, 'a ghost that does not end at the time is dropped');
  s = Z.clean({best: {az: {...good, time: 0.2, cum: null}}}); check(s.best.az === null, 'an impossible time is not a best');
  s = Z.clean({daily: {key: '2026-10-09', best: good, last: '2026-10-09', streak: 4, top: 2}}); check(s.daily.streak === 4 && s.daily.top === 4, 'the longest streak is at least the current one');
  s = Z.clean({daily: {key: 'garbage', best: good, last: 'garbage', streak: 9}}); check(s.daily.streak === 0 && s.daily.best === null, 'a streak without a date is nothing');

  // The page's first version: milliseconds under loose keys.
  const oldCum = Array.from({length: 26}, (_, i) => i * 280), store = {highScore: '7000', ghostBest_az: JSON.stringify(oldCum), highScore_reverse: '12345', muted: '1', attempts: '41', highScore_shuffled: '20000'};
  let old = Z.fromOld(k => store[k] ?? null);
  check(old && old.best.az.time === 7 && old.best.az.cum && old.best.az.cum[25] === 7 && old.best.za.time === 12.345 && old.best.za.cum === null, 'the old page\'s bests carry over, in seconds, with the ghost where it still matches');
  check(old.sound === false && old.runs === 41 && old.best.az && Z.clean(JSON.parse(JSON.stringify(old))).best.az.time === 7, 'its mute switch and attempts carry over, and the result is a valid save');
  check(Z.fromOld(() => null) === null && Z.fromOld(k => ({highScore: 'abc', ghostBest_az: '{{'})[k] ?? null) === null, 'nothing to carry over is nothing');
  old = Z.fromOld(k => ({highScore: '7000', ghostBest_az: '[1,2,3]'})[k] ?? null); check(old.best.az.time === 7 && old.best.az.cum === null, 'a ghost of the wrong shape is dropped, the time stays');
  check(Z.fromOld(k => ({highScore: '12'})[k] ?? null) === null && Z.fromOld(k => ({highScore: '99999999999'})[k] ?? null) === null, 'impossible old times are not carried');
  const mk = (mode, time, key = null) => { const c = Array.from({length: 26}, (_, i) => i * time / 25); return {mode, key, time: c[25], cum: c, splits: [], slips: 0, seq: ''}; };
  s = Z.blank(); let o = Z.record(s, mk('az', 8), '2026-10-01');
  check(o.isBest && o.before === null && s.best.az.time === 8 && s.runs === 1, 'a first run is a best');
  o = Z.record(s, mk('az', 8.5), '2026-10-01'); check(!o.isBest && s.best.az.time === 8, 'a slower run changes nothing');
  o = Z.record(s, mk('az', 8), '2026-10-01'); check(!o.isBest, 'a tie is not a best');
  o = Z.record(s, mk('az', 7.2), '2026-10-01'); check(o.isBest && o.before.time === 8 && s.best.az.time === 7.2, 'a faster run replaces it and remembers what it beat');
  check(s.best.za === null && Z.bestFor(s, 'za') === null, 'boards keep separate bests');

  s = Z.blank();
  o = Z.record(s, mk('daily', 20, '2026-10-01'), '2026-10-01'); check(o.isBest && o.streak === 1 && s.daily.streak === 1, 'the first daily starts a streak of one');
  o = Z.record(s, mk('daily', 18, '2026-10-01'), '2026-10-01'); check(o.isBest && o.streak === null && s.daily.streak === 1, 'a second run the same day does not lengthen it');
  check(Z.bestFor(s, 'daily', '2026-10-01').time === 18 && Z.bestFor(s, 'daily', '2026-10-02') === null, 'a daily best belongs to its day');
  o = Z.record(s, mk('daily', 25, '2026-10-02'), '2026-10-02'); check(o.isBest && o.streak === 2, 'the next day goes on, and starts a new best even if slower');
  o = Z.record(s, mk('daily', 25, '2026-10-05'), '2026-10-05'); check(o.streak === 1 && s.daily.top === 2, 'a missed day breaks it but keeps the record');
  check(Z.streakNow(s, '2026-10-05') === 1 && Z.streakNow(s, '2026-10-06') === 1 && Z.streakNow(s, '2026-10-07') === 0 && Z.streakNow(Z.blank(), '2026-10-07') === 0, 'a streak is alive today and tomorrow, then gone');
  s = Z.blank(); Z.record(s, mk('daily', 20, '2028-02-28'), '2028-02-28'); o = Z.record(s, mk('daily', 20, '2028-03-01'), '2028-03-01'); check(o.streak === 1, 'a skipped leap day is a missed day');
  s = Z.blank(); Z.record(s, mk('daily', 20, '2027-12-31'), '2027-12-31'); o = Z.record(s, mk('daily', 20, '2028-01-01'), '2028-01-01'); check(o.streak === 2, 'new year continues a streak');
  const round = Z.clean(JSON.parse(JSON.stringify(s))); check(JSON.stringify(round) === JSON.stringify(s), 'a save survives a round trip through JSON unchanged');
}

if (suites.includes('bots')) {
  section('bots');
  // A typist: time per key is thinking time plus travel, with noise and the odd slip. Thinking is short for the
  // alphabet in order (the fingers know it), longer backwards, longest when every letter has to be read.
  const SKILL = {
    novice: {speed: 0.14, think: {az: 0.25, za: 0.55, daily: 0.65}, slip: 0.08},
    average: {speed: 0.09, think: {az: 0.12, za: 0.35, daily: 0.4}, slip: 0.04},
    fast: {speed: 0.06, think: {az: 0.06, za: 0.2, daily: 0.25}, slip: 0.02},
    elite: {speed: 0.04, think: {az: 0.03, za: 0.13, daily: 0.16}, slip: 0.01},
  };
  const type = (mode, key, sk) => {
    const run = Z.newRun(Z.sequence(mode, key)); let t = 1000, prev = null;
    for (const c of run.seq) {
      const step = (sk.think[mode] + (prev ? Z.dist(prev, c) * sk.speed : 0.2)) * Math.exp(gauss() * 0.18) * 1000;
      if (rnd() < sk.slip) { t += step * 0.6; const w = run.seq[run.i] === 'Q' ? 'W' : 'Q'; Z.press(run, w, t); t += step * 0.4; }
      t += step; Z.press(run, c, t); prev = c;
    }
    return Z.result(run, mode, key);
  };
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const med = {};
  for (const mode of Z.MODES) for (const who of Object.keys(SKILL)) {
    const times = Array.from({length: 60}, (_, i) => type(mode, `2026-11-${String(1 + i % 28).padStart(2, '0')}`, SKILL[who]).time);
    med[mode + who] = median(times);
  }
  for (const mode of Z.MODES) {
    const m = ['novice', 'average', 'fast', 'elite'].map(w => med[mode + w]);
    check(m[0] > m[1] && m[1] > m[2] && m[2] > m[3], `${mode}: bots finish in order of skill`, m.map(v => v.toFixed(1)).join(' > '));
    const r = ['novice', 'average', 'fast', 'elite'].map(w => Z.tier(mode, med[mode + w]).index);
    check(r[0] <= 1 && r[1] >= 1 && r[1] <= 2 && r[2] >= 2 && r[3] >= 3 && r[0] < r[3], `${mode}: the ladder spreads them from Devil/Journeyman to Foreman/Master`, r.join(','));
  }
  check(med.azaverage < med.zaaverage && med.zaaverage < med.dailyaverage, 'the same typist is slower backwards, and slower again on a shuffle');
  // A player who hammers random letters does not get far: expected 26 presses per right key.
  let slow = 0; for (let k = 0; k < 20; k++) { const run = Z.newRun(Z.sequence('az')); let t = 0; while (!run.done && t < 60000) { t += 120; Z.press(run, L[Math.floor(rnd() * 26)], t); } if (!run.done) slow++; }
  check(slow >= 15, 'mashing random keys does not finish in a minute', `${slow}/20 unfinished`);
  // The first finish of a bot that never slips is a clean run.
  const clean = type('az', null, {...SKILL.fast, slip: 0}); check(clean.slips === 0, 'a bot that never slips has a clean run');
}

if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { ({chromium} = await import('playwright')); } catch { try { ({chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch {} }
  if (!chromium) console.log('  skipped (no Playwright)');
  else {
    const {pathToFileURL} = await import('url');
    const browser = await chromium.launch();
    const errors = [];
    const open = async (opts, url = '') => { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); await p.goto(pathToFileURL(PAGE).href + url); return {p, ctx}; };
    const phone = {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true};
    const desk = {viewport: {width: 1280, height: 800}};
    const state = p => p.evaluate(() => document.querySelector('.app').dataset.state);

    // Desktop: real keys.
    let {p, ctx: c} = await open(desk);
    check(await state(p) === 'ready', 'the page opens ready');
    check((await p.locator('.big').textContent()).trim() === 'A', 'the first letter waits big on the page');
    await p.keyboard.press('b'); check(await state(p) === 'ready', 'a wrong key does not start the clock');
    await p.keyboard.press('a'); check(await state(p) === 'run', 'the first right key starts the run');
    check((await p.locator('.big').textContent()).trim() === 'B', 'the next letter comes up in the same press');
    for (const k of 'BCDEFGHIJKLMNOPQRSTUVWXY') await p.keyboard.press(k.toLowerCase());
    check(await state(p) === 'run', 'the run is still on the last letter');
    await p.keyboard.press('z'); await p.waitForTimeout(1200);
    check(await state(p) === 'done', 'the last letter ends the run');
    check(await p.locator('.sheet').isVisible(), 'the results sheet is up');
    const best = await p.evaluate(() => JSON.parse(localStorage.getItem('gptgames.alphabet.v2')).best.az);
    check(best && best.time > 0 && best.cum.length === 26, 'the best is saved with its ghost');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await state(p) === 'ready', 'Enter plays again');
    await p.keyboard.press('a'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check(await state(p) === 'ready', 'Escape abandons a run');
    await c.close();

    // Phone: taps on the page's own keyboard.
    ({p, ctx: c} = await open(phone));
    const tap = async ch => { const b = await p.locator(`.key[data-k="${ch}"]`).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
    await tap('A'); check(await state(p) === 'run', 'a tap on A starts the run');
    await tap('Q'); check(await p.evaluate(() => document.querySelector('.app').dataset.state) === 'run', 'a wrong tap does not end it');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 2);
    check(!overflow, 'the phone page does not scroll');
    await c.close();

    // Reduced motion and a lying save.
    ({p, ctx: c} = await open({...phone, reducedMotion: 'reduce'}));
    await p.evaluate(() => localStorage.setItem('gptgames.alphabet.v2', '{"best":{"az":{"time":"x"}},"mode":7}')); await p.reload();
    check(await state(p) === 'ready', 'a lying save still opens the page');
    await c.close();
    check(errors.length === 0, 'no console errors', errors.join(' | '));
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
