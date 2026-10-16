#!/usr/bin/env node
// Test suite for tools/pomodoro_timer.html (Pomodoro Timer).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises a countdown a person can
// leave in a background tab or on a locked phone and still trust, so time here is never ticked: every
// call gets an explicit `now`, and the suite checks the state against plain timestamp arithmetic. The
// cycle follows Cirillo's method (25 min focus, 5 min break, a longer break after every 4 sessions;
// only a session that runs out counts). Also: what people type into a length field (decimal commas,
// units, m:ss, hours), the inputs that break tools, links with lengths in them, and the old page's
// saved pomodoroSettings / tasks.
//
//   node test/pomodoro_timer.mjs              # everything
//   node test/pomodoro_timer.mjs parse cycle  # named suites only
//
// Suites: parse, format, cycle, clock, links, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', process.env.PAGE || 'pomodoro_timer.html');
const ALL = ['parse', 'format', 'cycle', 'clock', 'links', 'saves'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.runInNewContext(src, ctx);
const P = ctx.module.exports;
const MIN = 60e3, T0 = Date.UTC(2026, 9, 16, 7, 0, 0);
const cfg = (o = {}) => P.settings(o);

if (suites.includes('parse')) {
  section('parse');
  const ok = [['25', 25], [' 25 ', 25], ['25m', 25], ['25 min', 25], ['25 minutes', 25], ['25,5', 25.5], ['25.5', 25.5],
    ['1:30', 1.5], ['0:90', null], ['1:00:00', 60], ['1h', 60], ['1h 30', 90], ['1h30m', 90], ['1.5h', 90], ['90s', 1.5],
    ['60 sec', 1], ['600', 600], ['1', 1], ['+5', 5], ['\t50\n', 50], ['  5  MIN ', 5], ['1:05', 65 / 60]];
  for (const [t, m] of ok) {
    const r = P.parseMinutes(t, 'focus');
    if (m === null) check(!r.ok, `"${t}" rejected`); else eq(r.ok && Math.abs(r.minutes - m) < 1e-9, true, `"${t}" -> ${m} min (${JSON.stringify(r)})`);
  }
  for (const t of ['', '   ', 'abc', '0', '0:00', '-5', '−5', '0.5', '30s', '601', '10000', '1e3', '25 minutes please', '١٢', 'NaN', 'Infinity', '25,5,5', '1:60', '5 5'])
    check(!P.parseMinutes(t, 'focus').ok, `"${t}" rejected`);
  for (const t of ['', 'x', '-5', '0', '601']) check(/[a-z]/.test(P.parseMinutes(t, 'focus').error), `"${t}" has a message`);
  eq(P.parseMinutes('0', 'focus').error, 'at least 1 minute', 'zero says the minimum');
  eq(P.parseMinutes('601', 'focus').error, 'at most 600 min (10 hours)', 'huge says the maximum');
  eq(P.parseMinutes('x'.repeat(1e6), 'focus').ok, false, 'a megabyte of junk is rejected');
  eq(P.parseCount('4', 1, 12), {ok: true, value: 4}, 'count 4');
  for (const t of ['0', '13', '2.5', '', '-1', 'four']) check(!P.parseCount(t, 1, 12).ok, `count "${t}" rejected`);
}

if (suites.includes('format')) {
  section('format');
  const cases = [[25 * MIN, '25:00'], [25 * MIN - 1, '25:00'], [25 * MIN - 1000, '24:59'], [24 * MIN + 59001, '25:00'], [61e3, '1:01'],
    [60e3, '1:00'], [59999, '1:00'], [9e3, '0:09'], [1, '0:01'], [0, '0:00'], [-500, '0:00'], [90 * MIN, '1:30:00'], [60 * MIN, '1:00:00'],
    [59 * MIN + 59e3, '59:59'], [600 * MIN, '10:00:00'], [3601e3, '1:00:01']];
  for (const [ms, s] of cases) eq(P.format(ms), s, `${ms} ms -> ${s}`);
  eq(P.describe(25), '25', 'describe 25'); eq(P.describe(1.5), '1:30', 'describe 1.5'); eq(P.describe(90), '90', 'describe 90');
  // a length typed with seconds round-trips through the field
  eq(P.parseMinutes(P.describe(65 / 60)).minutes * 60, 65, '1:05 round-trips');
}

if (suites.includes('cycle')) {
  section('cycle');
  const c = cfg();
  // run the default cycle twice: let every phase run out and record what comes next
  let st = P.initial(), now = T0, seen = [];
  for (let i = 0; i < 16; i++) {
    st = P.start(st, c, now); now = st.endsAt;
    const r = P.tick(st, c, now); eq(r.ended.length, 1, `phase ${i} ends exactly at its end`);
    st = r.state; seen.push(st.phase);
  }
  eq(seen.join(' '), 'short focus short focus short focus long focus short focus short focus short focus long focus', 'focus/short x3, then long, twice');
  eq(st.done, 8, 'eight sessions counted');
  // every = 1 and every = 3
  const one = cfg({every: 1}); let s1 = P.start(P.initial(), one, T0); eq(P.tick(s1, one, s1.endsAt).state.phase, 'long', 'every 1: always long');
  const three = cfg({every: 3}); let s3 = P.initial(), t3 = T0, ph = [];
  for (let i = 0; i < 6; i++) { s3 = P.start(s3, three, t3); t3 = s3.endsAt; s3 = P.tick(s3, three, t3).state; ph.push(s3.phase); }
  eq(ph.join(' '), 'short focus short focus long focus', 'every 3');
  // skip: a skipped focus does not count and goes to a short break; a skipped break goes to focus
  let k = P.start(P.initial(), c, T0); k = P.skip(k, c); eq([k.phase, k.status, k.done], ['short', 'idle', 0], 'skip focus');
  k = P.skip(k, c); eq([k.phase, k.done], ['focus', 0], 'skip break');
  // 1 ms before the end nothing has ended
  let e = P.start(P.initial(), c, T0); eq(P.tick(e, c, e.endsAt - 1).ended.length, 0, 'not ended 1 ms early');
  // manual phase: lands idle with the full length, counts nothing
  let m = P.setPhase(P.start(P.initial(), c, T0), 'long'); eq([m.phase, m.status, P.remaining(m, c, T0 + 5e3)], ['long', 'idle', 15 * MIN], 'tab to long break');
  // dots: focus 2 of 4 after one; long break shows the full cycle
  eq(P.cycle({phase: 'focus', done: 1}, c), {slot: 2, of: 4, filled: 1}, 'focus 2 of 4');
  eq(P.cycle({phase: 'short', done: 1}, c), {slot: 1, of: 4, filled: 1}, 'break after 1');
  eq(P.cycle({phase: 'long', done: 4}, c), {slot: 4, of: 4, filled: 4}, 'long break after 4');
  eq(P.cycle({phase: 'focus', done: 4}, c), {slot: 1, of: 4, filled: 0}, 'new cycle after the long break');
  eq(P.cycle({phase: 'long', done: 0}, c), {slot: 0, of: 4, filled: 0}, 'long break picked by hand on a fresh day');
}

if (suites.includes('clock')) {
  section('clock');
  const c = cfg();
  let st = P.start(P.initial(), c, T0);
  eq(P.format(P.remaining(st, c, T0)), '25:00', 'starts at 25:00');
  eq(P.format(P.remaining(st, c, T0 + 1)), '25:00', 'still 25:00 1 ms in');
  eq(P.format(P.remaining(st, c, T0 + 1000)), '24:59', '24:59 after a second');
  // a throttled tab that wakes after 17 min 3.4 s shows the true time, not 17 missed ticks
  eq(P.format(P.remaining(st, c, T0 + 17 * MIN + 3400)), '7:57', 'wakes at 7:57');
  // pause keeps milliseconds; resume continues from them
  let p = P.pause(st, c, T0 + 10 * MIN + 250);
  eq(p.left, 15 * MIN - 250, 'pause keeps exact remaining');
  eq(P.remaining(p, c, T0 + 99 * MIN), 15 * MIN - 250, 'paused time does not move');
  let r = P.start(p, c, T0 + 60 * MIN); eq(r.endsAt, T0 + 75 * MIN - 250, 'resume ends later by the pause');
  near(P.progress(p, c, 0), 10 / 25 + 250 / (25 * MIN), 'progress while paused');
  function near(a, b, w) { check(Math.abs(a - b) < 1e-9, w, `${a} vs ${b}`); }
  // pause twice / start twice are harmless
  eq(P.pause(p, c, T0), p, 'pause when paused: no change'); eq(P.start(st, c, T0 + 5e3), st, 'start when running: no change');
  eq(P.reset(p).status, 'idle', 'reset'); eq(P.remaining(P.reset(p), c, 0), 25 * MIN, 'reset gives full length');
  // a length change mid-session leaves the running phase alone, applies to the next
  const c50 = cfg({focus: 50});
  eq(P.remaining(st, c50, T0 + MIN), 24 * MIN, 'running focus keeps its end');
  check(Math.abs(P.progress(st, c50, T0 + 5 * MIN) - 0.2) < 1e-12, 'progress uses the length it started with');
  // auto-start: a phone locked for 2 hours replays the chain exactly from the end times
  const auto = cfg({auto: true});
  let a = P.start(P.initial(), auto, T0);
  const res = P.tick(a, auto, T0 + 120 * MIN);
  eq(res.ended.map(e => e.phase).join(' '), 'focus short focus short focus short focus', 'chain while asleep');
  eq(res.ended.map(e => (e.at - T0) / MIN).join(' '), '25 30 55 60 85 90 115', 'ended at the true times');
  eq([res.state.phase, res.state.status, (res.state.endsAt - T0) / MIN], ['long', 'running', 130], 'long break running, ends at 130');
  eq(res.state.done, 4, 'four counted');
  // without auto-start it stops after one
  const r2 = P.tick(P.start(P.initial(), c, T0), c, T0 + 120 * MIN);
  eq([r2.ended.length, r2.state.phase, r2.state.status], [1, 'short', 'idle'], 'manual: stops at the break');
  // fractional lengths
  const odd = cfg({focus: 65 / 60}); let o = P.start(P.initial(), odd, T0); eq(o.endsAt - T0, 65e3, '1:05 lasts 65 s');
  eq(P.title(o, odd, T0 + 1000, 'X'), '1:04 · Focus', 'title while running');
  eq(P.title(P.pause(o, odd, T0 + 1000), odd, 0, 'X'), 'Paused 1:04 · Focus', 'title while paused');
  eq(P.title(P.initial(), odd, 0, 'X'), 'X', 'title when idle');
  // day key is local
  eq(P.dayKey(new Date(2024, 1, 29, 23, 59).getTime()), '2024-02-29', 'leap day key');
}

if (suites.includes('links')) {
  section('links');
  eq(P.fromQuery('?focus=50&short=10'), {focus: 50, short: 10}, 'focus and short');
  eq(P.fromQuery('?work=45&break=15&longbreak=30&rounds=3'), {focus: 45, short: 15, long: 30, every: 3}, 'synonyms');
  eq(P.fromQuery('?pomodoro=25,5&shortBreak=4'), {focus: 25.5, short: 4}, 'old names and decimal comma');
  eq(P.fromQuery('?focus=0&short=-3&long=abc&every=99&x=1'), {}, 'bad values ignored');
  eq(P.fromQuery(''), {}, 'empty');
  eq(P.fromQuery('?focus=1%3A30'), {focus: 1.5}, 'm:ss encoded');
  const c = cfg({focus: 50, short: 10, every: 3});
  eq(P.toQuery(c), '?focus=50&short=10&every=3', 'share only what differs');
  eq(P.toQuery(cfg()), '', 'defaults share nothing');
  eq(P.fromQuery(P.toQuery(cfg({focus: 65 / 60}))), {focus: 65 / 60}, '1:05 survives the link');
}

if (suites.includes('saves')) {
  section('saves');
  const old = {pomodoro: 50, shortBreak: 10, longBreak: 20, soundEnabled: false, notificationsEnabled: true, autoStartBreaks: true};
  const s = P.settings(old);
  eq([s.focus, s.short, s.long, s.sound, s.notify, s.auto, s.every], [50, 10, 20, false, true, true, 4], 'old pomodoroSettings read');
  eq(P.settings(P.toStored(s)), s, 'stored shape round-trips');
  eq(P.toStored(s).pomodoro, 50, 'still written under the old names');
  // what the old page could save without validating
  eq(P.settings({pomodoro: -5}).focus, 25, 'negative falls back');
  eq(P.settings({pomodoro: 100000}).focus, 25, 'huge falls back');
  eq(P.settings({pomodoro: 0}).focus, 25, 'zero falls back');
  eq(P.settings({pomodoro: '45'}).focus, 45, 'string number');
  eq(P.settings(null), P.settings({}), 'null');
  eq(P.settings('garbage'), P.settings({}), 'string');
  eq(P.settings({goal: '6'}).goal, 6, 'old sessionGoal string');
  eq(P.settings({goal: '0'}).goal, 8, 'bad goal falls back');
  eq(P.settings({volume: 7}).volume, 1, 'volume clamped');
  const t = P.tasks([{text: ' Write ', completed: false, estimatedPomodoros: 3, usedPomodoros: 1}, {text: ''}, null, {text: 'x', estimatedPomodoros: -2, usedPomodoros: 'a'}]);
  eq(t, [{text: 'Write', completed: false, estimatedPomodoros: 3, usedPomodoros: 1}, {text: 'x', completed: false, estimatedPomodoros: 1, usedPomodoros: 0}], 'old tasks repaired');
  eq(P.tasks('nope'), [], 'tasks not an array');
  // restored timer state
  eq(P.restore({phase: 'short', status: 'running', endsAt: T0, done: 3, len: 300000}), {phase: 'short', status: 'running', endsAt: T0, left: null, done: 3, len: 300000}, 'running state restored');
  eq(P.restore({phase: 'nap', status: 'running'}), P.initial(), 'unknown phase -> fresh');
  eq(P.restore({phase: 'focus', status: 'paused', left: -4}).status, 'idle', 'bad paused -> idle');
  eq(P.restore(undefined), P.initial(), 'nothing saved');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
